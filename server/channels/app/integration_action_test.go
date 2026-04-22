// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Test for MM-13598 where an invalid integration URL was causing a crash
func TestPostActionInvalidURL(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.PostActionIntegrationRequest
		jsonErr := json.NewDecoder(r.Body).Decode(&request)
		assert.NoError(t, jsonErr)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type: model.PostActionTypeButton,
							Name: "action",
							Integration: &model.PostActionIntegration{
								URL: ":test",
							},
						},
					},
				},
			},
		},
	}

	post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
	require.Nil(t, err)
	attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)

	_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
	require.NotNil(t, err)
	assert.ErrorContains(t, err, "missing protocol scheme")
}

func TestPostActionEmptyResponse(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("Empty response on post action", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		defer ts.Close()

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     channel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type:       model.PostActionTypeSelect,
								Name:       "action",
								DataSource: model.PostActionDataSourceUsers,
								Integration: &model.PostActionIntegration{
									Context: model.StringInterface{
										"s": "foo",
										"n": 3,
									},
									URL: ts.URL,
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)

		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.Nil(t, err)
	})

	t.Run("Empty response on post action, timeout", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(2 * time.Second)
		}))
		defer ts.Close()

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     channel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type:       model.PostActionTypeSelect,
								Name:       "action",
								DataSource: model.PostActionDataSourceUsers,
								Integration: &model.PostActionIntegration{
									Context: model.StringInterface{
										"s": "foo",
										"n": 3,
									},
									URL: ts.URL,
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)

		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = model.NewPointer(int64(1))
		})

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
		assert.ErrorContains(t, err, "context deadline exceeded")
	})
}

// infiniteReader generates unlimited data for testing response size limits
type infiniteReader struct{}

func (r infiniteReader) Read(p []byte) (n int, err error) {
	for i := range p {
		p[i] = 'a'
	}
	return len(p), nil
}

// MM-67074: TestPostActionResponseSizeLimit verifies that DoPostActionWithCookie
// properly limits response sizes to prevent OOM attacks
func TestPostActionResponseSizeLimit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("large valid JSON response is truncated", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Send response larger than MaxIntegrationResponseSize (1MB)
			// Response starts as valid JSON but becomes truncated
			_, _ = io.Copy(w, io.MultiReader(
				strings.NewReader(`{"update":{"message":"`),
				infiniteReader{},
				strings.NewReader(`"}}`),
			))
		}))
		defer server.Close()

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     channel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: server.URL,
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)

		// Should return error due to truncated JSON, but NOT crash or OOM
		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id,
			attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
		// Truncated JSON causes unmarshal error
		assert.Equal(t, "api.post.do_action.action_integration.app_error", err.Id)
	})

	t.Run("large invalid response is truncated", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Send infinite non-JSON data
			_, _ = io.Copy(w, infiniteReader{})
		}))
		defer server.Close()

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     channel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: server.URL,
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)

		// Should return error due to invalid JSON, but NOT crash or OOM
		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id,
			attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
		assert.Equal(t, "api.post.do_action.action_integration.app_error", err.Id)
	})
}

func TestPostAction(t *testing.T) {
	mainHelper.Parallel(t)
	testCases := []struct {
		Description string
		Channel     func(th *TestHelper) *model.Channel
	}{
		{"public channel", func(th *TestHelper) *model.Channel {
			return th.BasicChannel
		}},
		{"direct channel", func(th *TestHelper) *model.Channel {
			user1 := th.CreateUser(t)

			return th.CreateDmChannel(t, user1)
		}},
		{"group channel", func(th *TestHelper) *model.Channel {
			user1 := th.CreateUser(t)
			user2 := th.CreateUser(t)

			return th.CreateGroupChannel(t, user1, user2)
		}},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			channel := testCase.Channel(th)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
			})

			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var request model.PostActionIntegrationRequest
				jsonErr := json.NewDecoder(r.Body).Decode(&request)
				assert.NoError(t, jsonErr)

				assert.Equal(t, th.BasicUser.Id, request.UserId)
				assert.Equal(t, th.BasicUser.Username, request.UserName)
				assert.Equal(t, channel.Id, request.ChannelId)
				assert.Equal(t, channel.Name, request.ChannelName)
				if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
					assert.Empty(t, request.TeamId)
					assert.Empty(t, request.TeamName)
				} else {
					assert.Equal(t, th.BasicTeam.Id, request.TeamId)
					assert.Equal(t, th.BasicTeam.Name, request.TeamName)
				}
				assert.True(t, request.TriggerId != "")
				if request.Type == model.PostActionTypeSelect {
					if selectedOption, ok := request.Context["selected_option"]; ok {
						// If something was selected, confirm that the data source and selected option are present
						assert.Equal(t, model.PostActionDataSourceUsers, request.DataSource)
						assert.Equal(t, "selected", selectedOption)
					} else {
						assert.Empty(t, request.DataSource)
					}
				} else {
					assert.Equal(t, "", request.DataSource)
				}
				assert.Equal(t, "foo", request.Context["s"])
				assert.EqualValues(t, 3, request.Context["n"])
				fmt.Fprintf(w, `{"post": {"message": "updated"}, "ephemeral_text": "foo"}`)
			}))
			defer ts.Close()

			interactivePost := model.Post{
				Message:       "Interactive post",
				ChannelId:     channel.Id,
				PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
				UserId:        th.BasicUser.Id,
				Props: model.StringInterface{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "hello",
							Actions: []*model.PostAction{
								{
									Type:       model.PostActionTypeSelect,
									Name:       "action",
									DataSource: model.PostActionDataSourceUsers,
									Integration: &model.PostActionIntegration{
										Context: model.StringInterface{
											"s": "foo",
											"n": 3,
										},
										URL: ts.URL,
									},
								},
							},
						},
					},
				},
			}

			post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
			require.Nil(t, err)

			attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
			require.True(t, ok)

			require.NotEmpty(t, attachments[0].Actions)
			require.NotEmpty(t, attachments[0].Actions[0].Id)

			menuPost := model.Post{
				Message:       "Interactive post",
				ChannelId:     channel.Id,
				PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
				UserId:        th.BasicUser.Id,
				Props: model.StringInterface{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "hello",
							Actions: []*model.PostAction{
								{
									Type:       model.PostActionTypeSelect,
									Name:       "action",
									DataSource: model.PostActionDataSourceUsers,
									Integration: &model.PostActionIntegration{
										Context: model.StringInterface{
											"s": "foo",
											"n": 3,
										},
										URL: ts.URL,
									},
								},
							},
						},
					},
				},
			}

			post2, _, err := th.App.CreatePostAsUser(th.Context, &menuPost, "", true)
			require.Nil(t, err)

			attachments2, ok := post2.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
			require.True(t, ok)

			require.NotEmpty(t, attachments2[0].Actions)
			require.NotEmpty(t, attachments2[0].Actions[0].Id)

			clientTriggerID, err := th.App.DoPostActionWithCookie(th.Context, post.Id, "notavalidid", th.BasicUser.Id, "", nil, nil)
			require.NotNil(t, err)
			assert.Equal(t, http.StatusNotFound, err.StatusCode)
			assert.Len(t, clientTriggerID, 0)

			clientTriggerID, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.Nil(t, err)
			assert.Len(t, clientTriggerID, 26)

			clientTriggerID, err = th.App.DoPostActionWithCookie(th.Context, post2.Id, attachments2[0].Actions[0].Id, th.BasicUser.Id, "selected", nil, nil)
			require.Nil(t, err)
			assert.Len(t, clientTriggerID, 26)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			})

			_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.NotNil(t, err)
			assert.ErrorContains(t, err, "address forbidden")

			interactivePostPlugin := model.Post{
				Message:       "Interactive post",
				ChannelId:     channel.Id,
				PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
				UserId:        th.BasicUser.Id,
				Props: model.StringInterface{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "hello",
							Actions: []*model.PostAction{
								{
									Type:       model.PostActionTypeSelect,
									Name:       "action",
									DataSource: model.PostActionDataSourceUsers,
									Integration: &model.PostActionIntegration{
										Context: model.StringInterface{
											"s": "foo",
											"n": 3,
										},
										URL: ts.URL + "/plugins/myplugin/myaction",
									},
								},
							},
						},
					},
				},
			}

			postplugin, _, err := th.App.CreatePostAsUser(th.Context, &interactivePostPlugin, "", true)
			require.Nil(t, err)

			attachmentsPlugin, ok := postplugin.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
			require.True(t, ok)

			_, err = th.App.DoPostActionWithCookie(th.Context, postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.Equal(t, "api.post.do_action.action_integration.app_error", err.Id)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
			})

			_, err = th.App.DoPostActionWithCookie(th.Context, postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.Nil(t, err)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.SiteURL = "http://127.1.1.1"
			})

			interactivePostSiteURL := model.Post{
				Message:       "Interactive post",
				ChannelId:     channel.Id,
				PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
				UserId:        th.BasicUser.Id,
				Props: model.StringInterface{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "hello",
							Actions: []*model.PostAction{
								{
									Type:       model.PostActionTypeSelect,
									Name:       "action",
									DataSource: model.PostActionDataSourceUsers,
									Integration: &model.PostActionIntegration{
										Context: model.StringInterface{
											"s": "foo",
											"n": 3,
										},
										URL: "http://127.1.1.1/plugins/myplugin/myaction",
									},
								},
							},
						},
					},
				},
			}

			postSiteURL, _, err := th.App.CreatePostAsUser(th.Context, &interactivePostSiteURL, "", true)
			require.Nil(t, err)

			attachmentsSiteURL, ok := postSiteURL.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
			require.True(t, ok)

			_, err = th.App.DoPostActionWithCookie(th.Context, postSiteURL.Id, attachmentsSiteURL[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.NotNil(t, err)
			assert.ErrorContains(t, err, "connection refused")

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.SiteURL = ts.URL + "/subpath"
			})

			interactivePostSubpath := model.Post{
				Message:       "Interactive post",
				ChannelId:     channel.Id,
				PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
				UserId:        th.BasicUser.Id,
				Props: model.StringInterface{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "hello",
							Actions: []*model.PostAction{
								{
									Type:       model.PostActionTypeSelect,
									Name:       "action",
									DataSource: model.PostActionDataSourceUsers,
									Integration: &model.PostActionIntegration{
										Context: model.StringInterface{
											"s": "foo",
											"n": 3,
										},
										URL: ts.URL + "/subpath/plugins/myplugin/myaction",
									},
								},
							},
						},
					},
				},
			}

			postSubpath, _, err := th.App.CreatePostAsUser(th.Context, &interactivePostSubpath, "", true)
			require.Nil(t, err)

			attachmentsSubpath, ok := postSubpath.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
			require.True(t, ok)

			_, err = th.App.DoPostActionWithCookie(th.Context, postSubpath.Id, attachmentsSubpath[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
			require.Nil(t, err)
		})
	}
}

func TestPostActionProps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.PostActionIntegrationRequest
		jsonErr := json.NewDecoder(r.Body).Decode(&request)
		assert.NoError(t, jsonErr)

		fmt.Fprintf(w, `{
			"update": {
				"message": "updated",
				"has_reactions": true,
				"is_pinned": false,
				"props": {
					"from_webhook":"true",
					"override_username":"new_override_user",
					"override_icon_url":"new_override_icon",
					"A":"AA"
				}
			},
			"ephemeral_text": "foo"
		}`)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		HasReactions:  false,
		IsPinned:      true,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type:       model.PostActionTypeSelect,
							Name:       "action",
							DataSource: model.PostActionDataSourceUsers,
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL,
							},
						},
					},
				},
			},
			model.PostPropsOverrideIconURL: "old_override_icon",
			model.PostPropsFromWebhook:     "false",
			"B":                            "BB",
		},
	}

	post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
	require.Nil(t, err)
	attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)

	clientTriggerId, err := th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
	require.Nil(t, err)
	assert.Len(t, clientTriggerId, 26)

	newPost, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
	require.NoError(t, nErr)

	assert.True(t, newPost.IsPinned)
	assert.False(t, newPost.HasReactions)
	assert.Nil(t, newPost.GetProp("B"))
	assert.Nil(t, newPost.GetProp(model.PostPropsOverrideUsername))
	assert.Equal(t, "AA", newPost.GetProp("A"))
	assert.Equal(t, "old_override_icon", newPost.GetProp(model.PostPropsOverrideIconURL))
	assert.Equal(t, "false", newPost.GetProp(model.PostPropsFromWebhook))
}

func TestSubmitInteractiveDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	submit := model.SubmitDialogRequest{
		UserId:     th.BasicUser.Id,
		ChannelId:  th.BasicChannel.Id,
		TeamId:     th.BasicTeam.Id,
		CallbackId: "someid",
		State:      "somestate",
		Submission: map[string]any{
			"name1": "value1",
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.SubmitDialogRequest
		err := json.NewDecoder(r.Body).Decode(&request)
		require.NoError(t, err)
		assert.NotNil(t, request)

		assert.Equal(t, request.URL, "")
		assert.Equal(t, request.UserId, submit.UserId)
		assert.Equal(t, request.ChannelId, submit.ChannelId)
		assert.Equal(t, request.TeamId, submit.TeamId)
		assert.Equal(t, request.CallbackId, submit.CallbackId)
		assert.Equal(t, request.State, submit.State)
		val, ok := request.Submission["name1"].(string)
		require.True(t, ok)
		assert.Equal(t, "value1", val)

		resp := model.SubmitDialogResponse{
			Error:  "some generic error",
			Errors: map[string]string{"name1": "some error"},
		}

		b, err := json.Marshal(resp)
		require.NoError(t, err)

		_, err = w.Write(b)
		require.NoError(t, err)
	}))
	defer ts.Close()

	setupPluginAPITest(t,
		`
		package main

		import (
			"net/http"
			"encoding/json"

			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			errReply := "some error"
 			if r.URL.Query().Get("abc") == "xyz" {
				errReply = "some other error"
			}
			response := &model.SubmitDialogResponse{
				Errors: map[string]string{"name1": errReply},
			}
			w.WriteHeader(http.StatusOK)
			responseJSON, _ := json.Marshal(response)
			_, _ = w.Write(responseJSON)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`, `{"id": "myplugin", "server": {"executable": "backend.exe"}}`, "myplugin", th.App, th.Context)

	hooks, err2 := th.App.GetPluginsEnvironment().HooksForPlugin("myplugin")
	require.NoError(t, err2)
	require.NotNil(t, hooks)

	submit.URL = ts.URL

	resp, err := th.App.SubmitInteractiveDialog(th.Context, submit)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "some generic error", resp.Error)
	assert.Equal(t, "some error", resp.Errors["name1"])

	submit.URL = ""
	resp, err = th.App.SubmitInteractiveDialog(th.Context, submit)
	assert.NotNil(t, err)
	assert.Nil(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
		*cfg.ServiceSettings.SiteURL = ts.URL
	})

	submit.URL = "/notvalid/myplugin/myaction"
	resp, err = th.App.SubmitInteractiveDialog(th.Context, submit)
	assert.NotNil(t, err)
	require.Nil(t, resp)

	submit.URL = "/plugins/myplugin/myaction"
	resp, err = th.App.SubmitInteractiveDialog(th.Context, submit)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "some error", resp.Errors["name1"])

	submit.URL = "/plugins/myplugin/myaction?abc=xyz"
	resp, err = th.App.SubmitInteractiveDialog(th.Context, submit)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "some other error", resp.Errors["name1"])
}

func TestPostActionRelativeURL(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.PostActionIntegrationRequest
		jsonErr := json.NewDecoder(r.Body).Decode(&request)
		assert.NoError(t, jsonErr)
		fmt.Fprintf(w, `{"post": {"message": "updated"}, "ephemeral_text": "foo"}`)
	}))
	defer ts.Close()

	t.Run("invalid relative URL", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ts.URL
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "/notaplugin/some/path",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})

	t.Run("valid relative URL without SiteURL set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "/plugins/myplugin/myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})

	t.Run("valid relative URL with SiteURL set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ts.URL
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "/plugins/myplugin/myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})

	t.Run("valid (but dirty) relative URL with SiteURL set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ts.URL
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "//plugins/myplugin///myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})

	t.Run("valid relative URL with SiteURL set and no leading slash", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ts.URL
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "plugins/myplugin/myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})
}

func TestPostActionRelativePluginURL(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	setupPluginAPITest(t,
		`
		package main

		import (
			"net/http"
			"encoding/json"

			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) 	ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			response := &model.PostActionIntegrationResponse{}
			w.WriteHeader(http.StatusOK)
			responseJSON, _ := json.Marshal(response)
			_, _ = w.Write(responseJSON)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`, `{"id": "myplugin", "server": {"executable": "backend.exe"}}`, "myplugin", th.App, th.Context)

	hooks, err2 := th.App.GetPluginsEnvironment().HooksForPlugin("myplugin")
	require.NoError(t, err2)
	require.NotNil(t, hooks)

	t.Run("invalid relative URL", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "/notaplugin/some/path",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.NotNil(t, err)
	})

	t.Run("valid relative URL", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "/plugins/myplugin/myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.Nil(t, err)
	})

	t.Run("valid (but dirty) relative URL", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "//plugins/myplugin///myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.Nil(t, err)
	})

	t.Run("valid relative URL and no leading slash", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		interactivePost := model.Post{
			Message:       "Interactive post",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props: model.StringInterface{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Text: "hello",
						Actions: []*model.PostAction{
							{
								Type: model.PostActionTypeButton,
								Name: "action",
								Integration: &model.PostActionIntegration{
									URL: "plugins/myplugin/myaction",
								},
							},
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
		require.Nil(t, err)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.NotEmpty(t, attachments[0].Actions)
		require.NotEmpty(t, attachments[0].Actions[0].Id)

		_, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
		require.Nil(t, err)
	})
}

func TestLookupInteractiveDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("should handle successful lookup request", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var request model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&request)
			require.NoError(t, err)

			assert.Equal(t, "dialog_lookup", request.Type)
			assert.Equal(t, th.BasicUser.Id, request.UserId)
			assert.Equal(t, th.BasicChannel.Id, request.ChannelId)
			assert.Equal(t, th.BasicTeam.Id, request.TeamId)
			assert.Equal(t, "callbackid", request.CallbackId)

			// Check for query and selected_field in submission
			query, ok := request.Submission["query"].(string)
			require.True(t, ok)
			assert.Equal(t, "test query", query)

			selectedField, ok := request.Submission["selected_field"].(string)
			require.True(t, ok)
			assert.Equal(t, "dynamic_field", selectedField)

			// Return mock lookup response
			response := model.LookupDialogResponse{
				Items: []model.DialogSelectOption{
					{Text: "Option 1", Value: "value1"},
					{Text: "Option 2", Value: "value2"},
					{Text: "Option 3", Value: "value3"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer ts.Close()

		submit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{
				"query":          "test query",
				"selected_field": "dynamic_field",
			},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Len(t, resp.Items, 3)
		assert.Equal(t, "Option 1", resp.Items[0].Text)
		assert.Equal(t, "value1", resp.Items[0].Value)
		assert.Equal(t, "Option 2", resp.Items[1].Text)
		assert.Equal(t, "value2", resp.Items[1].Value)
	})

	t.Run("should handle empty response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Empty response body
		}))
		defer ts.Close()

		submit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Empty(t, resp.Items)
	})

	t.Run("should handle HTTP error response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("Internal server error"))
		}))
		defer ts.Close()

		submit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "status=500")
	})

	t.Run("should handle malformed JSON response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("invalid json"))
		}))
		defer ts.Close()

		submit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "Encountered an error decoding JSON response")
	})

	t.Run("should handle plugin lookup", func(t *testing.T) {
		setupPluginAPITest(t,
			`
			package main

			import (
				"encoding/json"
				"net/http"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
				var request model.SubmitDialogRequest
				json.NewDecoder(r.Body).Decode(&request)

				response := &model.LookupDialogResponse{
					Items: []model.DialogSelectOption{
						{Text: "Plugin Option 1", Value: "plugin_value1"},
						{Text: "Plugin Option 2", Value: "plugin_value2"},
					},
				}
				w.WriteHeader(http.StatusOK)
				responseJSON, _ := json.Marshal(response)
				w.Write(responseJSON)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`, `{"id": "myplugin", "server": {"executable": "backend.exe"}}`, "myplugin", th.App, th.Context)

		submit := model.SubmitDialogRequest{
			URL:        "/plugins/myplugin/lookup",
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Len(t, resp.Items, 2)
		assert.Equal(t, "Plugin Option 1", resp.Items[0].Text)
		assert.Equal(t, "plugin_value1", resp.Items[0].Value)
	})

	t.Run("should fail on invalid URL", func(t *testing.T) {
		submit := model.SubmitDialogRequest{
			URL:        "not-a-valid-url",
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "unsupported protocol scheme")
	})

	t.Run("should handle timeout", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate a slow response that would trigger a timeout
			time.Sleep(2 * time.Second)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = model.NewPointer(int64(1))
		})

		submit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		resp, err := th.App.LookupInteractiveDialog(th.Context, submit)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "context deadline exceeded")
	})
}

func TestOpenInteractiveDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("should successfully open dialog with valid trigger ID", func(t *testing.T) {
		_, triggerId, err := model.GenerateTriggerId(th.BasicUser.Id, th.App.AsymmetricSigningKey())
		require.Nil(t, err)

		request := model.OpenDialogRequest{
			TriggerId: triggerId,
			URL:       "http://localhost:8065",
			Dialog: model.Dialog{
				CallbackId: "callbackid",
				Title:      "Test Dialog",
				Elements: []model.DialogElement{
					{
						DisplayName: "Field Name",
						Name:        "field_name",
						Type:        "text",
						Placeholder: "Enter value",
					},
				},
				SubmitLabel:    "Submit",
				NotifyOnCancel: false,
				State:          "somestate",
			},
		}

		err = th.App.OpenInteractiveDialog(th.Context, request)
		require.Nil(t, err)
	})

	t.Run("should fail with invalid trigger ID", func(t *testing.T) {
		request := model.OpenDialogRequest{
			TriggerId: "invalid_trigger_id",
			URL:       "http://localhost:8065",
			Dialog: model.Dialog{
				CallbackId: "callbackid",
				Title:      "Test Dialog",
			},
		}

		err := th.App.OpenInteractiveDialog(th.Context, request)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "trigger ID")
	})

	t.Run("should fail with expired trigger ID", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = model.NewPointer(int64(1))
		})

		// Generate trigger ID and wait for it to expire
		_, triggerId, err := model.GenerateTriggerId(th.BasicUser.Id, th.App.AsymmetricSigningKey())
		require.Nil(t, err)

		time.Sleep(2 * time.Second)

		request := model.OpenDialogRequest{
			TriggerId: triggerId,
			URL:       "http://localhost:8065",
			Dialog: model.Dialog{
				CallbackId: "callbackid",
				Title:      "Test Dialog",
			},
		}

		err = th.App.OpenInteractiveDialog(th.Context, request)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "Trigger ID for interactive dialog is expired")
	})

	t.Run("should handle dialog with invalid elements", func(t *testing.T) {
		_, triggerId, err := model.GenerateTriggerId(th.BasicUser.Id, th.App.AsymmetricSigningKey())
		require.Nil(t, err)

		request := model.OpenDialogRequest{
			TriggerId: triggerId,
			URL:       "http://localhost:8065",
			Dialog: model.Dialog{
				CallbackId: "callbackid",
				Title:      "Test Dialog",
				Elements: []model.DialogElement{
					{
						DisplayName: strings.Repeat("A", 500), // Too long display name
						Name:        "field_name",
						Type:        "text",
					},
				},
			},
		}

		// Should succeed but log warning about invalid dialog
		err = th.App.OpenInteractiveDialog(th.Context, request)
		require.Nil(t, err)
	})
}

func TestDoActionRequest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("should handle successful external request", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
			assert.Equal(t, "application/json", r.Header.Get("Accept"))

			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			assert.NotEmpty(t, body)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"success": true}`))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body, readErr := io.ReadAll(resp.Body)
		require.NoError(t, readErr)
		assert.Equal(t, `{"success": true}`, string(body))
		resp.Body.Close()
	})

	t.Run("should handle non-200 status code", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("Bad request"))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.NotNil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, err.Error(), "status=400")
		resp.Body.Close()
	})

	t.Run("should handle invalid URL", func(t *testing.T) {
		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, "invalid-url", requestBody)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "unsupported protocol scheme")
	})

	t.Run("should handle plugin URL", func(t *testing.T) {
		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, "/plugins/myplugin/action", requestBody)
		require.Nil(t, err) // Plugin URLs return HTTP response, not Go error
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode) // Plugin doesn't exist, returns 404
		resp.Body.Close()
	})

	t.Run("should handle context timeout", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(2 * time.Second)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		c := th.Context.WithContext(ctx)

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(c, ts.URL, requestBody)
		require.NotNil(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "context deadline exceeded")
	})

	t.Run("should handle network error", func(t *testing.T) {
		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, "http://invalid-host-that-does-not-exist:9999", requestBody)
		require.NotNil(t, err)
		assert.Nil(t, resp)
	})
}

func TestGetPostActionClient(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tests := []struct {
		name       string
		siteURL    string
		subpath    string
		requestURL string
		expectAuth bool
	}{
		{
			name:       "same host with plugin path gets auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/plugins/myplugin/action",
			expectAuth: true,
		},
		{
			name:       "same host with non-plugin path does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/api/v4/posts",
			expectAuth: false,
		},
		{
			name:       "different host with plugin path does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://evil.com/plugins/myplugin/action",
			expectAuth: false,
		},
		{
			name:       "different host same port does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://attacker.com:8065/plugins/myplugin/action",
			expectAuth: false,
		},
		{
			name:       "path traversal to reach plugins does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/api/../../plugins/myplugin",
			expectAuth: true, // path.Clean normalizes to /plugins/myplugin
		},
		{
			name:       "path traversal escaping plugins does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/plugins/../api/v4/posts",
			expectAuth: false, // path.Clean normalizes to /api/v4/posts
		},
		{
			name:       "subpath with plugin path gets auth",
			siteURL:    "http://localhost:8065/mattermost",
			subpath:    "/mattermost",
			requestURL: "http://localhost:8065/mattermost/plugins/myplugin/action",
			expectAuth: true,
		},
		{
			name:       "subpath without subpath prefix does not get auth",
			siteURL:    "http://localhost:8065/mattermost",
			subpath:    "/mattermost",
			requestURL: "http://localhost:8065/plugins/myplugin/action",
			expectAuth: false, // plugins path doesn't include subpath
		},
		{
			name:       "empty path does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/",
			expectAuth: false,
		},
		{
			name:       "plugins as query param does not get auth",
			siteURL:    "http://localhost:8065",
			requestURL: "http://localhost:8065/api?path=plugins/myplugin",
			expectAuth: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.SiteURL = tc.siteURL
			})

			inURL, err := url.Parse(tc.requestURL)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", tc.requestURL, nil)
			require.NoError(t, err)

			_ = th.App.getPostActionClient(th.Context, inURL, req)

			if tc.expectAuth {
				assert.NotEmpty(t, req.Header.Get(model.HeaderAuth), "expected auth header to be set")
				assert.Contains(t, req.Header.Get(model.HeaderAuth), "Bearer ")
			} else {
				assert.Empty(t, req.Header.Get(model.HeaderAuth), "expected no auth header")
			}
		})
	}
}

func TestDoLocalRequest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("should delegate to doPluginRequest", func(t *testing.T) {
		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoLocalRequest(th.Context, "/plugins/nonexistent/action", requestBody)
		require.Nil(t, err) // DoLocalRequest returns HTTP response, not error
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode) // Plugin doesn't exist, returns 404
	})
}

func TestDoPostActionWithCookieEdgeCases(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("should handle missing post with valid cookie", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}))
		defer ts.Close()

		cookie := &model.PostActionCookie{
			PostId:    "nonexistent_post_id",
			ChannelId: th.BasicChannel.Id,
			Type:      model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: ts.URL,
			},
		}

		_, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", th.BasicUser.Id, "", cookie, nil)
		require.Nil(t, err)
	})

	t.Run("should handle cookie with mismatched post ID", func(t *testing.T) {
		cookie := &model.PostActionCookie{
			PostId:    "different_post_id",
			ChannelId: th.BasicChannel.Id,
			Type:      model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: "http://example.com",
			},
		}

		_, err := th.App.DoPostActionWithCookie(th.Context, "actual_post_id", "action_id", th.BasicUser.Id, "", cookie, nil)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "postId doesn't match")
	})

	t.Run("should handle cookie with nil integration", func(t *testing.T) {
		cookie := &model.PostActionCookie{
			PostId:      "nonexistent_post_id",
			ChannelId:   th.BasicChannel.Id,
			Type:        model.PostActionTypeButton,
			Integration: nil,
		}

		_, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", th.BasicUser.Id, "", cookie, nil)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "no Integration in action cookie")
	})

	t.Run("should handle missing user error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}))
		defer ts.Close()

		cookie := &model.PostActionCookie{
			PostId:    "nonexistent_post_id",
			ChannelId: th.BasicChannel.Id,
			Type:      model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: ts.URL,
			},
		}

		_, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", "nonexistent_user_id", "", cookie, nil)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "Unable to find the user.")
	})
}

func TestDoPluginRequest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	setupPluginAPITest(t,
		`
		package main

		import (
			"net/http"
			"reflect"
			"sort"

			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			if q.Get("abc") != "xyz" {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("could not find param abc=xyz"))
				return
			}

			multiple := q["multiple"]
			if len(multiple) != 3 {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("param multiple should have 3 values"))
				return
			}
			sort.Strings(multiple)
			if !reflect.DeepEqual(multiple, []string{"1 first", "2 second", "3 third"}) {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("param multiple not correct"))
				return
			}

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OK"))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`, `{"id": "myplugin", "server": {"executable": "backend.exe"}}`, "myplugin", th.App, th.Context)

	hooks, err2 := th.App.GetPluginsEnvironment().HooksForPlugin("myplugin")
	require.NoError(t, err2)
	require.NotNil(t, hooks)

	resp, err := th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin", nil, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, "could not find param abc=xyz", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin?abc=xyz", nil, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "param multiple should have 3 values", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin",
		url.Values{"abc": []string{"xyz"}, "multiple": []string{"1 first", "2 second", "3 third"}}, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "OK", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin?abc=xyz&multiple=1%20first",
		url.Values{"multiple": []string{"2 second", "3 third"}}, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "OK", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin?abc=xyz&multiple=1%20first&multiple=3%20third",
		url.Values{"multiple": []string{"2 second"}}, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "OK", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin?multiple=1%20first&multiple=3%20third",
		url.Values{"multiple": []string{"2 second"}, "abc": []string{"xyz"}}, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "OK", string(body))

	resp, err = th.App.doPluginRequest(th.Context, "GET", "/plugins/myplugin?multiple=1%20first&multiple=3%20third",
		url.Values{"multiple": []string{"4 fourth"}, "abc": []string{"xyz"}}, nil)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	body, _ = io.ReadAll(resp.Body)
	assert.Equal(t, "param multiple not correct", string(body))

	t.Run("should handle URLs with path traversals", func(t *testing.T) {
		tests := []struct {
			name      string
			rawURL    string
			expectErr bool
			errDetail string
		}{
			{
				name:      "path traversal to escape plugins directory",
				rawURL:    "/plugins/../../../etc/passwd",
				expectErr: true,
				errDetail: "plugins not in path",
			},
			{
				name:      "path traversal with encoded slashes",
				rawURL:    "/plugins/..%2F..%2F..%2Fetc%2Fpasswd",
				expectErr: true, // url.Parse decodes %2F, path.Clean normalizes traversal
				errDetail: "plugins not in path",
			},
			{
				name:      "double dot in plugin path",
				rawURL:    "/plugins/../plugins/myplugin/action",
				expectErr: false, // path.Clean normalizes this back to plugins/myplugin/action
			},
			{
				name:      "path traversal without leading slash",
				rawURL:    "plugins/../../../etc/passwd",
				expectErr: true,
				errDetail: "plugins not in path",
			},
			{
				name:      "only plugins with no plugin ID",
				rawURL:    "/plugins/",
				expectErr: true,
				errDetail: "Unable to find pluginId",
			},
			{
				name:      "just plugins no trailing slash",
				rawURL:    "/plugins",
				expectErr: true,
				errDetail: "Unable to find pluginId",
			},
			{
				name:      "non-plugins path",
				rawURL:    "/api/v4/users",
				expectErr: true,
				errDetail: "plugins not in path",
			},
			{
				name:      "path traversal via dot segments after plugin ID",
				rawURL:    "/plugins/myplugin/../../etc/passwd",
				expectErr: true,
				errDetail: "plugins not in path",
			},
			{
				name:      "backslash traversal attempt",
				rawURL:    "/plugins/myplugin/..\\..\\etc\\passwd",
				expectErr: false, // backslashes are not path separators in URL paths; treated as literal
			},
			{
				name:      "null byte injection attempt",
				rawURL:    "/plugins/myplugin\x00/action",
				expectErr: true, // url.Parse rejects URLs with null bytes
			},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				resp, appErr := th.App.doPluginRequest(th.Context, "GET", tc.rawURL, nil, nil)
				if tc.expectErr {
					require.NotNil(t, appErr, "expected error for URL: %s", tc.rawURL)
					if tc.errDetail != "" {
						assert.Contains(t, appErr.DetailedError, tc.errDetail)
					}
				} else {
					// Should not return an app error from path validation;
					// may still get a 404 if the plugin doesn't exist, which is fine.
					assert.Nil(t, appErr, "unexpected error for URL: %s - %v", tc.rawURL, appErr)
					if resp != nil {
						resp.Body.Close()
					}
				}
			})
		}
	})
}

// buildInlineActionsProp returns a typed inline_actions map suitable for use as
// a post prop in tests.
func buildInlineActionsProp(id, url string, context map[string]any) map[string]*model.PostActionIntegration {
	return map[string]*model.PostActionIntegration{
		id: {
			URL:     url,
			Context: context,
		},
	}
}

// setupBotInChannel creates a bot, joins it to the team and channel, and
// returns the resolved *model.User for the bot.
func setupBotInChannel(t *testing.T, th *TestHelper) *model.User {
	t.Helper()
	bot := th.CreateBot(t)
	botUser, appErr := th.App.GetUser(bot.UserId)
	require.Nil(t, appErr)
	_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, botUser.Id, "")
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
	require.Nil(t, appErr)
	return botUser
}

func TestInlineActionsStrippedOnCreate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	post := &model.Post{
		Message:       "hello with inline actions",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			model.PostPropsInlineActions: buildInlineActionsProp(
				"actionone",
				"http://127.0.0.1/plugins/myplugin/doit",
				map[string]any{"operation": "STORM"},
			),
		},
	}

	created, _, err := th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, err)
	assert.Nil(t, created.GetProp(model.PostPropsInlineActions), "non-bot, non-integration user should have inline_actions stripped")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	assert.Nil(t, stored.GetProp(model.PostPropsInlineActions), "stored post should not carry inline_actions")
}

func TestInlineActionsKeptForBot(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	post := &model.Post{
		Message:       "hello from a bot",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsInlineActions: buildInlineActionsProp(
				"actiontwo",
				"http://127.0.0.1/plugins/myplugin/doit",
				map[string]any{"operation": "STORM"},
			),
		},
	}

	created, _, err := th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, err)
	require.NotNil(t, created.GetProp(model.PostPropsInlineActions), "bot post should preserve inline_actions")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	require.NotNil(t, stored.GetProp(model.PostPropsInlineActions), "stored bot post should carry inline_actions")

	// Sanity-check we can round-trip the inline action back to a lookup.
	integration := stored.GetInlineAction("actiontwo")
	require.NotNil(t, integration)
	assert.Equal(t, "http://127.0.0.1/plugins/myplugin/doit", integration.URL)
}

func TestUpdatePostInlineActionsGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// originalInline is the inline_actions value we expect the bot post to
	// keep after non-integration edits.
	originalInline := buildInlineActionsProp(
		"keep",
		"http://127.0.0.1/plugins/myplugin/original",
		map[string]any{"k": "orig"},
	)

	t.Run("non-integration edit of bot post reverts inline_actions", func(t *testing.T) {
		botPost := &model.Post{
			Message:       "bot post with inline actions",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsInlineActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(th.Context, botPost, "", true)
		require.Nil(t, cErr)
		require.NotNil(t, created.GetProp(model.PostPropsInlineActions))

		// A non-integration session tries to swap inline_actions wholesale.
		newInline := buildInlineActionsProp(
			"swap",
			"http://127.0.0.1/plugins/myplugin/swapped",
			map[string]any{"k": "attacker"},
		)
		edit := created.Clone()
		edit.Message = "edited message"
		edit.AddProp(model.PostPropsInlineActions, newInline)

		// th.Context has an empty/zero session — not an integration.
		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)

		// inline_actions should revert to the original value.
		got := updated.GetInlineAction("keep")
		require.NotNil(t, got, "original inline action should still be reachable")
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/original", got.URL)

		// The attacker's swapped action should not be present.
		assert.Nil(t, updated.GetInlineAction("swap"))

		// Message change should still be applied.
		assert.Equal(t, "edited message", updated.Message)
	})

	t.Run("non-integration edit cannot add inline_actions when original had none", func(t *testing.T) {
		plainBotPost := &model.Post{
			Message:       "bot post without inline actions",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
		}
		created, _, cErr := th.App.CreatePostAsUser(th.Context, plainBotPost, "", true)
		require.Nil(t, cErr)
		require.Nil(t, created.GetProp(model.PostPropsInlineActions))

		newInline := buildInlineActionsProp(
			"added",
			"http://127.0.0.1/plugins/myplugin/added",
			nil,
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsInlineActions, newInline)

		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)
		assert.Nil(t, updated.GetProp(model.PostPropsInlineActions), "non-integration update must not introduce inline_actions")
	})

	t.Run("integration session can modify inline_actions", func(t *testing.T) {
		botPost := &model.Post{
			Message:       "bot post for integration edit",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsInlineActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(th.Context, botPost, "", true)
		require.Nil(t, cErr)

		// IsOAuth=true makes Session.IsIntegration() return true without
		// needing a full bot or user-access-token session.
		intSession := &model.Session{UserId: th.BasicUser.Id, IsOAuth: true}
		intCtx := th.Context.WithSession(intSession)
		require.True(t, intCtx.Session().IsIntegration())

		newInline := buildInlineActionsProp(
			"replaced",
			"http://127.0.0.1/plugins/myplugin/new",
			map[string]any{"k": "integration"},
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsInlineActions, newInline)

		updated, _, uErr := th.App.UpdatePost(intCtx, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)

		assert.Nil(t, updated.GetInlineAction("keep"), "original action should be overwritten by integration edit")
		integration := updated.GetInlineAction("replaced")
		require.NotNil(t, integration)
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/new", integration.URL)
	})

	t.Run("AllowInlineActionsUpdate option accepts new inline_actions", func(t *testing.T) {
		botPost := &model.Post{
			Message:       "bot post for plugin-path edit",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsInlineActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(th.Context, botPost, "", true)
		require.Nil(t, cErr)

		newInline := buildInlineActionsProp(
			"plugin",
			"http://127.0.0.1/plugins/myplugin/plugin",
			map[string]any{"k": "plugin"},
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsInlineActions, newInline)

		// Non-integration session, but AllowInlineActionsUpdate grants write.
		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false, AllowInlineActionsUpdate: true})
		require.Nil(t, uErr)

		assert.Nil(t, updated.GetInlineAction("keep"))
		integration := updated.GetInlineAction("plugin")
		require.NotNil(t, integration)
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/plugin", integration.URL)
	})
}

func TestSendEphemeralPostStripsInlineActions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	ephemeral := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "ephemeral with inline actions",
		Props: model.StringInterface{
			model.PostPropsInlineActions: buildInlineActionsProp(
				"eph",
				"http://127.0.0.1/plugins/myplugin/eph",
				map[string]any{"k": "v"},
			),
		},
	}

	result, _ := th.App.SendEphemeralPost(th.Context, th.BasicUser.Id, ephemeral)
	require.NotNil(t, result)
	assert.Nil(t, result.GetProp(model.PostPropsInlineActions), "SendEphemeralPost must drop inline_actions")

	// UpdateEphemeralPost path
	ephemeral2 := &model.Post{
		Id:        result.Id,
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "updated ephemeral with inline actions",
		Props: model.StringInterface{
			model.PostPropsInlineActions: buildInlineActionsProp(
				"eph2",
				"http://127.0.0.1/plugins/myplugin/eph2",
				nil,
			),
		},
	}
	updated, _ := th.App.UpdateEphemeralPost(th.Context, th.BasicUser.Id, ephemeral2)
	require.NotNil(t, updated)
	assert.Nil(t, updated.GetProp(model.PostPropsInlineActions), "UpdateEphemeralPost must drop inline_actions")
}

func TestDoPostActionInlineContextMerged(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// Capture the upstream integration request.
	var capturedReq model.PostActionIntegrationRequest
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, readErr := io.ReadAll(r.Body)
		require.NoError(t, readErr)
		require.NoError(t, json.Unmarshal(body, &capturedReq))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	inlineActions := buildInlineActionsProp(
		"inline1",
		ts.URL,
		map[string]any{"operation": "STORM"},
	)
	botPost := &model.Post{
		Message:       "inline action post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsInlineActions: inlineActions,
		},
	}
	created, _, err := th.App.CreatePostAsUser(th.Context, botPost, "", true)
	require.Nil(t, err)
	require.NotNil(t, created.GetProp(model.PostPropsInlineActions))

	inlineContext := map[string]string{"tail": "214"}
	_, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, inlineContext)
	require.Nil(t, err)

	// inline_params was merged into the upstream Context map.
	rawInline, ok := capturedReq.Context[model.PostActionInlineParamsKey]
	require.True(t, ok, "upstream request Context should contain inline_params")
	inlineMap, ok := rawInline.(map[string]any)
	require.True(t, ok, "inline_params should decode as a map")
	assert.Equal(t, "214", inlineMap["tail"])

	// Original Context fields are preserved alongside inline_params.
	assert.Equal(t, "STORM", capturedReq.Context["operation"])
}

func TestDoPostActionContextMapNotMutated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	originalContext := map[string]any{"operation": "STORM"}
	inlineActions := buildInlineActionsProp("inline1", ts.URL, originalContext)
	botPost := &model.Post{
		Message:       "inline action post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsInlineActions: inlineActions,
		},
	}
	created, _, err := th.App.CreatePostAsUser(th.Context, botPost, "", true)
	require.Nil(t, err)

	// First click: carries one set of inline_context values.
	_, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, map[string]string{"tail": "214"})
	require.Nil(t, err)

	// Post's stored Context should not leak inline_params from the first click.
	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	integration := stored.GetInlineAction("inline1")
	require.NotNil(t, integration)
	_, leaked := integration.Context[model.PostActionInlineParamsKey]
	assert.False(t, leaked, "first click must not leak inline_params into stored post Context")
	assert.Equal(t, "STORM", integration.Context["operation"])

	// Second click with a different inline_context.
	_, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, map[string]string{"tail": "999"})
	require.Nil(t, err)

	stored, nErr = th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	integration = stored.GetInlineAction("inline1")
	require.NotNil(t, integration)
	_, leaked = integration.Context[model.PostActionInlineParamsKey]
	assert.False(t, leaked, "second click must not leak inline_params into stored post Context")
	assert.Equal(t, "STORM", integration.Context["operation"])
}

func TestDoPostActionPluginResponseInlineActionsDropped(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// Plugin returns an update that tries to add inline_actions, even though
	// the original post had none.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		resp := `{
			"update": {
				"message": "updated message",
				"props": {
					"inline_actions": {
						"sneaky": {"url": "http://127.0.0.1/plugins/myplugin/sneak"}
					}
				}
			}
		}`
		_, _ = w.Write([]byte(resp))
	}))
	defer ts.Close()

	// Bot post has an ATTACHMENT action (not an inline action), and no
	// inline_actions prop. The plugin's response to clicking the attachment
	// should not be able to introduce inline_actions.
	botPost := &model.Post{
		Message:       "attachment-only bot post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type: model.PostActionTypeButton,
							Name: "click",
							Integration: &model.PostActionIntegration{
								URL: ts.URL,
							},
						},
					},
				},
			},
		},
	}
	created, _, err := th.App.CreatePostAsUser(th.Context, botPost, "", true)
	require.Nil(t, err)
	attachments, ok := created.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)
	require.Nil(t, created.GetProp(model.PostPropsInlineActions))

	_, err = th.App.DoPostActionWithCookie(th.Context, created.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
	require.Nil(t, err)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	assert.Nil(t, stored.GetProp(model.PostPropsInlineActions), "plugin response must not be able to add inline_actions where none existed")
	assert.Equal(t, "updated message", stored.Message)
}

func TestDoPostActionPluginResponseInvalidInlineActionsDropped(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// Plugin returns an update where inline_actions contains an entry with an
	// empty URL — invalid and should be dropped with a warning, while the
	// message update still succeeds.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		resp := `{
			"update": {
				"message": "updated via plugin",
				"props": {
					"inline_actions": {
						"broken": {"url": ""}
					}
				}
			}
		}`
		_, _ = w.Write([]byte(resp))
	}))
	defer ts.Close()

	// The original post has VALID inline_actions, so the "drop because original
	// had none" branch is bypassed and we exercise the validation branch.
	originalInline := buildInlineActionsProp(
		"orig",
		"http://127.0.0.1/plugins/myplugin/orig",
		nil,
	)
	botPost := &model.Post{
		Message:       "bot post with valid inline actions",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type: model.PostActionTypeButton,
							Name: "click",
							Integration: &model.PostActionIntegration{
								URL: ts.URL,
							},
						},
					},
				},
			},
			model.PostPropsInlineActions: originalInline,
		},
	}
	created, _, err := th.App.CreatePostAsUser(th.Context, botPost, "", true)
	require.Nil(t, err)
	attachments, ok := created.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)

	_, err = th.App.DoPostActionWithCookie(th.Context, created.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
	require.Nil(t, err)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	// Message update still applied — the invalid inline_actions were dropped
	// with a warning, so the rest of the response.Update is persisted.
	assert.Equal(t, "updated via plugin", stored.Message)
	// The broken inline action from the plugin response must never be stored.
	assert.Nil(t, stored.GetInlineAction("broken"), "invalid inline action from plugin response must not be persisted")
}

// TestPostActionRetainsFromBotAndFromPlugin verifies that from_bot and
// from_plugin props are retained across a plugin-returned post update even
// when the plugin's response.Props omits them. This matters because the
// webapp's allowInlineActions gate is derived from these markers; losing
// them on first update would hide every inline button on subsequent renders.
func TestPostActionRetainsFromBotAndFromPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// Plugin response deliberately omits from_bot / from_plugin from props.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"update": {"message": "updated", "props": {"A": "AA"}}}`)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "interactive",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{{
				Text: "hello",
				Actions: []*model.PostAction{{
					Type: model.PostActionTypeButton,
					Name: "click",
					Integration: &model.PostActionIntegration{
						URL: ts.URL,
					},
				}},
			}},
			model.PostPropsFromBot:    "true",
			model.PostPropsFromPlugin: "true",
		},
	}

	post, _, appErr := th.App.CreatePostAsUser(th.Context, &interactivePost, "", true)
	require.Nil(t, appErr)
	attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)

	_, appErr = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil)
	require.Nil(t, appErr)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
	require.NoError(t, nErr)

	assert.Equal(t, "true", stored.GetProp(model.PostPropsFromBot), "from_bot must be retained across plugin update response")
	assert.Equal(t, "true", stored.GetProp(model.PostPropsFromPlugin), "from_plugin must be retained across plugin update response")
	assert.Equal(t, "AA", stored.GetProp("A"), "plugin-supplied prop applied")
}
