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
	"strconv"
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

	_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = new(int64(1))
		})

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
		require.NotNil(t, err)
		assert.ErrorContains(t, err, "context deadline exceeded")
	})
}

func TestDoPostActionWithCookieGotoLocation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	wantGoto := "http://127.0.0.1:9999/some/relative/path"
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := json.Marshal(map[string]string{"goto_location": wantGoto})
		_, _ = w.Write(payload)
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

	_, gotoLoc, err := th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
	require.Nil(t, err)
	assert.Equal(t, wantGoto, gotoLoc)
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
		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id,
			attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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
		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id,
			attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

			clientTriggerID, _, err := th.App.DoPostActionWithCookie(th.Context, post.Id, "notavalidid", th.BasicUser.Id, "", nil, nil, nil, "")
			require.NotNil(t, err)
			assert.Equal(t, http.StatusNotFound, err.StatusCode)
			assert.Len(t, clientTriggerID, 0)

			clientTriggerID, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
			require.Nil(t, err)
			assert.Len(t, clientTriggerID, 26)

			clientTriggerID, _, err = th.App.DoPostActionWithCookie(th.Context, post2.Id, attachments2[0].Actions[0].Id, th.BasicUser.Id, "selected", nil, nil, nil, "")
			require.Nil(t, err)
			assert.Len(t, clientTriggerID, 26)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			})

			_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

			_, _, err = th.App.DoPostActionWithCookie(th.Context, postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
			require.Equal(t, "api.post.do_action.action_integration.app_error", err.Id)

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
			})

			_, _, err = th.App.DoPostActionWithCookie(th.Context, postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
			require.Nil(t, err)

			th.App.UpdateConfig(func(cfg *model.Config) {
				// Unreachable localhost port fails immediately (connection refused) instead of
				// waiting for OutgoingIntegrationRequestsTimeout on black-holed addresses.
				*cfg.ServiceSettings.SiteURL = "http://127.0.0.1:1"
				cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = new(int64(1))
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
										URL: "http://127.0.0.1:1/plugins/myplugin/myaction",
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

			_, _, err = th.App.DoPostActionWithCookie(th.Context, postSiteURL.Id, attachmentsSiteURL[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

			_, _, err = th.App.DoPostActionWithCookie(th.Context, postSubpath.Id, attachmentsSubpath[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

	clientTriggerId, _, err := th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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
	// from_webhook is NOT in the default SanitizeProps strip list under hardened-OFF (v11) — it
	// remains user-settable for backward compatibility with the user-PAT-impersonation idiom.
	// The client-supplied value survives sanitization. PostActionRetainPropKeys includes
	// from_webhook, so the post-action update preserves it. (v12 will move the from_* markers
	// into the default strip list — see SanitizeProps doc in public/model/post.go — and this
	// assertion should flip back to nil.)
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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

		_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
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
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = new(int64(1))
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
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = new(int64(1))
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

	t.Run("should preserve 429 status code from plugin", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte("Rate limited"))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.NotNil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
		assert.Equal(t, http.StatusTooManyRequests, err.StatusCode)
		assert.Contains(t, err.Error(), "status=429")
		resp.Body.Close()
	})

	t.Run("should preserve 503 status code from plugin", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("Service unavailable"))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.NotNil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Equal(t, http.StatusServiceUnavailable, err.StatusCode)
		assert.Contains(t, err.Error(), "status=503")
		resp.Body.Close()
	})

	t.Run("should map other 5xx status codes to 502 Bad Gateway", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("Internal error"))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.NotNil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		assert.Equal(t, http.StatusBadGateway, err.StatusCode)
		assert.Contains(t, err.Error(), "status=500")
		resp.Body.Close()
	})

	t.Run("should sanitize other 4xx status codes to 400", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("Not found"))
		}))
		defer ts.Close()

		requestBody := []byte(`{"test": "data"}`)
		resp, err := th.App.DoActionRequest(th.Context, ts.URL, requestBody)
		require.NotNil(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Contains(t, err.Error(), "status=404")
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

		_, _, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", th.BasicUser.Id, "", cookie, nil, nil, "")
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

		_, _, err := th.App.DoPostActionWithCookie(th.Context, "actual_post_id", "action_id", th.BasicUser.Id, "", cookie, nil, nil, "")
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

		_, _, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", th.BasicUser.Id, "", cookie, nil, nil, "")
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

		_, _, err := th.App.DoPostActionWithCookie(th.Context, "nonexistent_post_id", "action_id", "nonexistent_user_id", "", cookie, nil, nil, "")
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "Unable to find the user.")
	})

	t.Run("rejects oversized query at the App boundary (independent of API handler)", func(t *testing.T) {
		// ValidateActionQuery is called at the top of DoPostActionWithCookie,
		// not just in the API handler. Direct App-layer callers (plugins,
		// tests, internal triggers) get the same enforcement as REST clients.
		oversized := make(map[string]string, model.MaxActionQueryEntries+1)
		for i := range model.MaxActionQueryEntries + 1 {
			oversized["k"+strconv.Itoa(i)] = "v"
		}

		_, _, err := th.App.DoPostActionWithCookie(th.Context, "any_post", "any_action", th.BasicUser.Id, "", nil, nil, oversized, "")
		require.NotNil(t, err)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, "api.post.do_action.query.app_error", err.Id)
	})
}

// TestCloneMmBlocksActionsProp guards the deep-clone semantics used when
// restoring an original spec after a plugin update response is rejected.
// A shallow clone would alias the nested per-action map back into post.Props,
// so a later mutation through response.Update could reach into the live post.
func TestCloneMmBlocksActionsProp(t *testing.T) {
	t.Run("nil and non-map values are returned unchanged", func(t *testing.T) {
		assert.Nil(t, cloneMmBlocksActionsProp(nil))
		assert.Equal(t, "string", cloneMmBlocksActionsProp("string"))
	})

	t.Run("top-level and nested mutations on the clone do not leak", func(t *testing.T) {
		original := map[string]any{
			"btn1": map[string]any{
				"type": "external",
				"url":  "http://example.com/hook",
			},
		}

		cloned, ok := cloneMmBlocksActionsProp(original).(map[string]any)
		require.True(t, ok)

		// Mutating the top-level map on the clone (adding a key) must not
		// reach the original.
		cloned["btn2"] = map[string]any{"type": "external", "url": "http://example.com/other"}
		assert.NotContains(t, original, "btn2")

		// Mutating a nested per-action map on the clone (changing the URL)
		// must not reach the original — this is the case the shallow-clone
		// bug actually exposed.
		clonedEntry, ok := cloned["btn1"].(map[string]any)
		require.True(t, ok)
		clonedEntry["url"] = "http://attacker.example/"

		originalEntry, ok := original["btn1"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "http://example.com/hook", originalEntry["url"])
	})

	t.Run("deeply nested context and array mutations on the clone do not leak", func(t *testing.T) {
		// Per-action specs can carry nested context maps and arrays. A
		// shallow per-entry clone would still alias these structures back
		// to the live post's props.
		original := map[string]any{
			"btn1": map[string]any{
				"type":    "external",
				"url":     "http://example.com/hook",
				"context": map[string]any{"team": "alpha", "tags": []any{"a", "b"}},
			},
		}

		cloned, ok := cloneMmBlocksActionsProp(original).(map[string]any)
		require.True(t, ok)

		clonedEntry := cloned["btn1"].(map[string]any)
		clonedContext := clonedEntry["context"].(map[string]any)

		// Mutate the nested context map on the clone.
		clonedContext["team"] = "tampered"
		clonedContext["new"] = "added"

		// Mutate the nested array on the clone.
		clonedTags := clonedContext["tags"].([]any)
		clonedTags[0] = "tampered"

		// Original must be untouched at every level.
		originalEntry := original["btn1"].(map[string]any)
		originalContext := originalEntry["context"].(map[string]any)
		assert.Equal(t, "alpha", originalContext["team"])
		assert.NotContains(t, originalContext, "new")
		assert.Equal(t, []any{"a", "b"}, originalContext["tags"])
	})

	t.Run("pathologically nested input is truncated past maxMmBlocksActionsCloneDepth", func(t *testing.T) {
		// ValidateMmBlocksActions doesn't bound nesting depth inside
		// spec.Context — defense-in-depth against stack exhaustion if a
		// bot/plugin author crafts deeply nested input.
		var leaf any = "leaf"
		const tooDeep = maxMmBlocksActionsCloneDepth + 100
		for range tooDeep {
			leaf = map[string]any{"n": leaf}
		}

		// Must not stack-overflow / panic.
		var cloned any
		require.NotPanics(t, func() {
			cloned = cloneMmBlocksActionsProp(leaf)
		})

		// Walk the clone; should hit nil before reaching the leaf string.
		current := cloned
		for i := range tooDeep {
			m, ok := current.(map[string]any)
			if !ok {
				assert.Greater(t, i, maxMmBlocksActionsCloneDepth-2,
					"truncation should kick in at or near maxMmBlocksActionsCloneDepth")
				assert.Nil(t, current, "subtree past depth cap must be nil, not aliased to source")
				return
			}
			current = m["n"]
		}
		t.Fatalf("clone walked %d levels without hitting truncation", tooDeep)
	})
}

func TestDoPostActionWithCookie(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("mm blocks cookie missing post update", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		})

		const missingPostID = "nonexistent_post_for_mm_blocks_update"

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"update": {"message": "PLAYWRIGHT_MM_BLOCKS_UPDATED"}}`))
		}))
		defer ts.Close()

		mmCookie := &model.MmBlocksActionCookie{
			Kind:       model.MmBlocksActionCookieKind,
			PostId:     missingPostID,
			ChannelId:  th.BasicChannel.Id,
			RootPostId: missingPostID,
			Actions: map[string]map[string]any{
				"apply_update": {
					"type": "external",
					"url":  ts.URL,
				},
			},
		}

		_, _, err := th.App.DoPostActionWithCookie(th.Context, missingPostID, "apply_update", th.BasicUser.Id, "", nil, mmCookie, nil, "")
		require.Nil(t, err)
	})

	t.Run("legacy cookie missing post update", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		})

		const missingPostID = "nonexistent_post_for_legacy_attachment_update"

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"update": {"message": "ephemeral_attachment_updated"}}`))
		}))
		defer ts.Close()

		cookie := &model.PostActionCookie{
			PostId:    missingPostID,
			ChannelId: th.BasicChannel.Id,
			Type:      model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: ts.URL,
			},
		}

		_, _, err := th.App.DoPostActionWithCookie(th.Context, missingPostID, "action_id", th.BasicUser.Id, "", cookie, nil, nil, "")
		require.Nil(t, err)
	})

	t.Run("mm blocks disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = true })

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		})

		botUser := setupBotInChannel(t, th)
		intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}))
		defer ts.Close()

		root := model.Post{
			Message:   "mm_blocks disabled host post",
			ChannelId: th.BasicChannel.Id,
			UserId:    botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocks: []any{
					map[string]any{"type": "button", "text": "Go", "action_id": "mm_blocks_act"},
				},
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("mm_blocks_act", ts.URL, nil),
			},
		}

		post, _, appErr := th.App.CreatePostAsUser(intSeedCtx, &root, "", true)
		require.Nil(t, appErr)

		_, _, err := th.App.DoPostActionWithCookie(
			th.Context,
			post.Id,
			"mm_blocks_act",
			th.BasicUser.Id,
			"",
			nil,
			nil,
			nil,
			model.PostActionIntegrationFormatMmBlock,
		)
		require.NotNil(t, err)
		assert.Equal(t, "api.post.do_action.action_integration.app_error", err.Id)
		assert.Contains(t, err.Error(), "mm_blocks are not enabled")
	})

	t.Run("mm blocks external forwards selected option", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		})

		botUser := setupBotInChannel(t, th)
		intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

		var gotJSON string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, readErr := io.ReadAll(r.Body)
			require.NoError(t, readErr)
			gotJSON = string(body)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
		}))
		defer ts.Close()

		root := model.Post{
			Message:   "mm_blocks static_select host post",
			ChannelId: th.BasicChannel.Id,
			UserId:    botUser.Id,
			Props: model.StringInterface{
				"mm_blocks": []any{
					map[string]any{
						"type":        "static_select",
						"action_id":   "mm_blocks_sel_act",
						"placeholder": "Choose",
						"options": []any{
							map[string]any{"text": "Alpha", "value": "opt_alpha"},
							map[string]any{"text": "Beta", "value": "opt_beta"},
						},
					},
				},
				model.PostPropsMmBlocksActions: map[string]any{
					"mm_blocks_sel_act": map[string]any{
						"type":    model.MmBlocksActionTypeExternal,
						"url":     ts.URL,
						"context": map[string]any{"track": "mm_blocks_select"},
					},
				},
			},
		}

		post, _, appErr := th.App.CreatePostAsUser(intSeedCtx, &root, "", true)
		require.Nil(t, appErr)
		require.NotNil(t, post.GetProp(model.PostPropsMmBlocksActions))

		_, _, err := th.App.DoPostActionWithCookie(
			th.Context,
			post.Id,
			"mm_blocks_sel_act",
			th.BasicUser.Id,
			"opt_beta",
			nil,
			nil,
			nil,
			model.PostActionIntegrationFormatMmBlock,
		)
		require.Nil(t, err)

		var req model.PostActionIntegrationRequest
		require.NoError(t, json.Unmarshal([]byte(gotJSON), &req))
		assert.Equal(t, model.PostActionTypeButton, req.Type)
		sel, ok := req.Context["selected_option"]
		require.True(t, ok)
		assert.Equal(t, "opt_beta", sel)
		_, ok = req.Context["track"]
		require.True(t, ok)
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

func TestDoPostActionIntegrationFormatCollision(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	sharedActionID := "dupact1"
	var sawAttachment, sawMmBlock bool
	tsAttachment := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAttachment = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer tsAttachment.Close()
	tsMmBlock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawMmBlock = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer tsMmBlock.Close()

	interactivePost := &model.Post{
		Message:       "collision",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "a",
					Actions: []*model.PostAction{
						{
							Id:   sharedActionID,
							Type: model.PostActionTypeButton,
							Name: "btn",
							Integration: &model.PostActionIntegration{
								URL: tsAttachment.URL,
							},
						},
					},
				},
			},
			model.PostPropsMmBlocksActions: map[string]any{
				sharedActionID: map[string]any{
					"type": model.MmBlocksActionTypeExternal,
					"url":  tsMmBlock.URL,
				},
			},
		},
	}

	post, _, err := th.App.CreatePostAsUser(intSeedCtx, interactivePost, "", true)
	require.Nil(t, err)
	require.NotNil(t, post.GetProp(model.PostPropsMmBlocksActions))

	sawAttachment = false
	sawMmBlock = false
	_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, sharedActionID, th.BasicUser.Id, "", nil, nil, nil, model.PostActionIntegrationFormatAttachment)
	require.Nil(t, err)
	assert.True(t, sawAttachment)
	assert.False(t, sawMmBlock)

	sawAttachment = false
	sawMmBlock = false
	_, _, err = th.App.DoPostActionWithCookie(th.Context, post.Id, sharedActionID, th.BasicUser.Id, "", nil, nil, nil, model.PostActionIntegrationFormatMmBlock)
	require.Nil(t, err)
	assert.False(t, sawAttachment)
	assert.True(t, sawMmBlock)
}

// buildMmBlocksActionsProp returns a mm_blocks_actions map (an "external"-type
// action) suitable for use as a post prop in tests.
func buildMmBlocksActionsProp(id, url string, context map[string]any) map[string]any {
	entry := map[string]any{
		"type": model.MmBlocksActionTypeExternal,
		"url":  url,
	}
	if context != nil {
		entry["context"] = context
	}
	return map[string]any{id: entry}
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

func TestMmBlocksActionsStrippedOnCreate(t *testing.T) {
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
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"actionone",
				"http://127.0.0.1/plugins/myplugin/doit",
				map[string]any{"operation": "STORM"},
			),
		},
	}

	created, _, err := th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, err)
	assert.Nil(t, created.GetProp(model.PostPropsMmBlocksActions), "non-bot, non-integration user should have mm_blocks_actions stripped")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	assert.Nil(t, stored.GetProp(model.PostPropsMmBlocksActions), "stored post should not carry mm_blocks_actions")
}

func TestMmBlocksActionsKeptForBotIntegration(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// IsOAuth=true makes Session.IsIntegration() return true without needing
	// a full bot-token session.
	intSession := &model.Session{UserId: botUser.Id, IsOAuth: true}
	intCtx := th.Context.WithSession(intSession)

	post := &model.Post{
		Message:       "hello from a bot",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"actiontwo",
				"http://127.0.0.1/plugins/myplugin/doit",
				map[string]any{"operation": "STORM"},
			),
		},
	}

	created, _, err := th.App.CreatePostAsUser(intCtx, post, "", true)
	require.Nil(t, err)
	require.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions), "bot post via integration session should preserve mm_blocks_actions")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	require.NotNil(t, stored.GetProp(model.PostPropsMmBlocksActions), "stored bot post should carry mm_blocks_actions")

	spec := stored.GetMmBlocksActionSpec("actiontwo")
	require.NotNil(t, spec)
	assert.Equal(t, "http://127.0.0.1/plugins/myplugin/doit", spec.URL)
}

// TestPluginAPICreatePostKeepsMmBlocksActions locks the contract that a
// plugin creating a post via PluginAPI.CreatePost retains mm_blocks_actions.
// Plugins are server-trusted code, but their static activation-time rctx
// has an unmarked session — without pluginIntegrationCtx the strip in
// CreatePost would delete the prop and clicks would 404 with
// "invalid action id".
func TestPluginAPICreatePostKeepsMmBlocksActions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	botUser := setupBotInChannel(t, th)

	manifest := &model.Manifest{Id: "com.mattermost.test-plugin"}
	api := NewPluginAPI(th.App, th.Context, manifest)

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    botUser.Id,
		Message:   "issue tracker post",
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"triage",
				"/plugins/com.mattermost.test-plugin/inline_action/triage",
				map[string]any{"project": "Demo Project"},
			),
		},
	}

	created, appErr := api.CreatePost(post)
	require.Nil(t, appErr)
	require.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions),
		"plugin-created post must preserve mm_blocks_actions; the strip in CreatePost should not fire because PluginAPI marks the session as integration")

	// Re-read from the store to confirm persistence (not just in-memory).
	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	spec := stored.GetMmBlocksActionSpec("triage")
	require.NotNil(t, spec, "stored plugin post must resolve the action spec at click time")
	assert.Equal(t, "/plugins/com.mattermost.test-plugin/inline_action/triage", spec.URL)
}

// TestMmBlocksActionsKeptForWebhookImpersonation verifies that an integration
// session is sufficient on its own — the post's author does not need to be a
// bot. This is the webhook-impersonation flow: a webhook posts as a regular
// user with from_webhook=true, and we must not strip the prop just because
// user.IsBot is false.
func TestMmBlocksActionsKeptForWebhookImpersonation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	// Integration session for a regular (non-bot) user.
	intSession := &model.Session{UserId: th.BasicUser.Id, IsOAuth: true}
	intCtx := th.Context.WithSession(intSession)

	post := &model.Post{
		Message:       "post from impersonating webhook",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"webhook1",
				"http://127.0.0.1/plugins/myplugin/wh",
				nil,
			),
		},
	}

	created, _, err := th.App.CreatePostAsUser(intCtx, post, "", true)
	require.Nil(t, err)
	require.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions),
		"non-bot author via integration session must preserve mm_blocks_actions (webhook flow)")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	require.NotNil(t, stored.GetProp(model.PostPropsMmBlocksActions))
}

// TestMmBlocksActionsStripGate locks the create-time strip policy: keep
// when the post is bot-authored or the session is an integration; strip
// when neither signal is present. Incoming webhooks use AllowMmBlocksActions
// (see TestCreateWebhookPostKeepsMmBlocksActions). The bot-author signal
// covers PluginAPI.CreatePost (whose static rctx is unmarked) where the post
// is authored by the plugin's bot user; the integration-session signal
// covers REST callers using bot tokens, PATs, or OAuth apps.
func TestMmBlocksActionsStripGate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	inline := buildMmBlocksActionsProp(
		"mx",
		"http://127.0.0.1/plugins/myplugin/mx",
		nil,
	)

	t.Run("bot author via non-integration session is kept", func(t *testing.T) {
		// Models the PluginAPI.CreatePost path: post.UserId is the plugin's
		// bot user but rctx.Session() is the unmarked plugin context. The
		// bot-author signal alone must be sufficient to keep the prop.
		post := &model.Post{
			Message:       "hello",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props:         model.StringInterface{model.PostPropsMmBlocksActions: inline},
		}
		created, _, err := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, err)
		assert.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions),
			"bot-authored post must keep mm_blocks_actions even without an integration session")
	})

	t.Run("regular user via non-integration session is stripped", func(t *testing.T) {
		// Neither signal present: the prop must be removed. Catches the
		// baseline user-content case.
		post := &model.Post{
			Message:       "hello",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        th.BasicUser.Id,
			Props:         model.StringInterface{model.PostPropsMmBlocksActions: inline},
		}
		created, _, err := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, err)
		assert.Nil(t, created.GetProp(model.PostPropsMmBlocksActions),
			"regular-user post via non-integration session must strip mm_blocks_actions")
	})
}

func TestUpdatePostMmBlocksActionsGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// Bot posts with mm_blocks_actions must be CREATED via an integration
	// session — see the matching create-time strip in CreatePostAsUser.
	intSeedSession := &model.Session{UserId: botUser.Id, IsOAuth: true}
	intSeedCtx := th.Context.WithSession(intSeedSession)

	// originalInline is the mm_blocks_actions value we expect the bot post to
	// keep after non-integration edits.
	originalInline := buildMmBlocksActionsProp(
		"keep",
		"http://127.0.0.1/plugins/myplugin/original",
		map[string]any{"k": "orig"},
	)

	t.Run("non-integration edit of bot post reverts mm_blocks_actions", func(t *testing.T) {
		botPost := &model.Post{
			Message:       "bot post with inline actions",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
		require.Nil(t, cErr)
		require.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions))

		// A non-integration session tries to swap mm_blocks_actions wholesale.
		newInline := buildMmBlocksActionsProp(
			"swap",
			"http://127.0.0.1/plugins/myplugin/swapped",
			map[string]any{"k": "attacker"},
		)
		edit := created.Clone()
		edit.Message = "edited message"
		edit.AddProp(model.PostPropsMmBlocksActions, newInline)

		// th.Context has an empty/zero session — not an integration.
		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)

		// mm_blocks_actions should revert to the original value.
		got := updated.GetMmBlocksActionSpec("keep")
		require.NotNil(t, got, "original inline action should still be reachable")
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/original", got.URL)

		// The attacker's swapped action should not be present.
		assert.Nil(t, updated.GetMmBlocksActionSpec("swap"))

		// Message change should still be applied.
		assert.Equal(t, "edited message", updated.Message)
	})

	t.Run("non-integration edit cannot add mm_blocks_actions when original had none", func(t *testing.T) {
		plainBotPost := &model.Post{
			Message:       "bot post without inline actions",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
		}
		created, _, cErr := th.App.CreatePostAsUser(intSeedCtx, plainBotPost, "", true)
		require.Nil(t, cErr)
		require.Nil(t, created.GetProp(model.PostPropsMmBlocksActions))

		newInline := buildMmBlocksActionsProp(
			"added",
			"http://127.0.0.1/plugins/myplugin/added",
			nil,
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsMmBlocksActions, newInline)

		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)
		assert.Nil(t, updated.GetProp(model.PostPropsMmBlocksActions), "non-integration update must not introduce mm_blocks_actions")
	})

	t.Run("integration session alone cannot modify mm_blocks_actions", func(t *testing.T) {
		// Even with an integration session (PAT / OAuth / bot-token), the
		// UpdatePost path requires AllowMmBlocksActionsUpdate to modify
		// mm_blocks_actions. A PAT-holding user could otherwise inject
		// mm_blocks_actions on any post they can edit.
		botPost := &model.Post{
			Message:       "bot post for integration edit",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
		require.Nil(t, cErr)

		intSession := &model.Session{UserId: th.BasicUser.Id, IsOAuth: true}
		intCtx := th.Context.WithSession(intSession)
		require.True(t, intCtx.Session().IsIntegration())

		newInline := buildMmBlocksActionsProp(
			"replaced",
			"http://127.0.0.1/plugins/myplugin/new",
			map[string]any{"k": "integration"},
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsMmBlocksActions, newInline)

		updated, _, uErr := th.App.UpdatePost(intCtx, edit, &model.UpdatePostOptions{SafeUpdate: false})
		require.Nil(t, uErr)

		// The attacker's "replaced" entry must not land; the original stays.
		assert.Nil(t, updated.GetMmBlocksActionSpec("replaced"), "integration session alone must not overwrite mm_blocks_actions")
		keep := updated.GetMmBlocksActionSpec("keep")
		require.NotNil(t, keep, "original inline action must be preserved")
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/original", keep.URL)
	})

	t.Run("AllowMmBlocksActionsUpdate option accepts new mm_blocks_actions", func(t *testing.T) {
		botPost := &model.Post{
			Message:       "bot post for plugin-path edit",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: originalInline,
			},
		}
		created, _, cErr := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
		require.Nil(t, cErr)

		newInline := buildMmBlocksActionsProp(
			"plugin",
			"http://127.0.0.1/plugins/myplugin/plugin",
			map[string]any{"k": "plugin"},
		)
		edit := created.Clone()
		edit.AddProp(model.PostPropsMmBlocksActions, newInline)

		// Non-integration session, but AllowMmBlocksActionsUpdate grants write.
		updated, _, uErr := th.App.UpdatePost(th.Context, edit, &model.UpdatePostOptions{SafeUpdate: false, AllowMmBlocksActionsUpdate: true})
		require.Nil(t, uErr)

		assert.Nil(t, updated.GetMmBlocksActionSpec("keep"))
		integration := updated.GetMmBlocksActionSpec("plugin")
		require.NotNil(t, integration)
		assert.Equal(t, "http://127.0.0.1/plugins/myplugin/plugin", integration.URL)
	})
}

// TestCreateWebhookPostKeepsMmBlocksActions locks the contract that an
// incoming webhook can persist mm_blocks_actions from its props map.
// CreateWebhookPost passes AllowMmBlocksActions into CreatePost so the
// create-time strip does not remove the prop (the webhook URL is the
// trust boundary, same as legacy attachment actions).
func TestCreateWebhookPostKeepsMmBlocksActions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook, hookErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, hookErr)
	defer func() {
		_ = th.App.DeleteIncomingWebhook(hook.Id)
	}()

	inline := buildMmBlocksActionsProp(
		"actx",
		"http://127.0.0.1/plugins/myplugin/x",
		nil,
	)

	post, appErr := th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, "hello", "user", "http://iconurl", "",
		model.StringInterface{
			model.PostPropsMmBlocks: []any{
				map[string]any{"type": "button", "text": "Go", "action_id": "actx"},
			},
			model.PostPropsMmBlocksActions: inline,
		},
		"", "", nil, false)
	require.Nil(t, appErr)

	require.NotNil(t, post.GetProp(model.PostPropsMmBlocksActions),
		"incoming webhook payload must persist mm_blocks_actions for client action dispatch")

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
	require.NoError(t, nErr)
	require.NotNil(t, stored.GetProp(model.PostPropsMmBlocksActions),
		"stored webhook post must carry mm_blocks_actions")
	spec := stored.GetMmBlocksActionSpec("actx")
	require.NotNil(t, spec)
	assert.Equal(t, "http://127.0.0.1/plugins/myplugin/x", spec.URL)
}

// TestCreateWebhookPostKeepsMmBlocksActionsOnInteractiveSplit verifies split
// webhook posts persist mm_blocks_actions on the chunk that carries mm_blocks.
// CreateWebhookPost returns the first split (typically the leading message chunk).
func TestCreateWebhookPostKeepsMmBlocksActionsOnInteractiveSplit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook, hookErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, hookErr)
	defer func() {
		_ = th.App.DeleteIncomingWebhook(hook.Id)
	}()

	inline := buildMmBlocksActionsProp(
		"actx",
		"http://127.0.0.1/plugins/myplugin/x",
		nil,
	)

	marker := "mm-blocks-split-" + model.NewId()
	longMessage := marker + strings.Repeat("x", th.App.MaxPostSize()+100)

	returned, appErr := th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, longMessage, "user", "http://iconurl", "",
		model.StringInterface{
			model.PostPropsMmBlocks: []any{
				map[string]any{"type": "text", "text": "interactive body"},
				map[string]any{"type": "button", "text": "Go", "action_id": "actx"},
			},
			model.PostPropsMmBlocksActions: inline,
		},
		"", "", nil, false)
	require.Nil(t, appErr)
	require.True(t, strings.HasPrefix(returned.Message, marker))
	require.Nil(t, returned.GetProp(model.PostPropsMmBlocks))
	require.Nil(t, returned.GetProp(model.PostPropsMmBlocksActions))

	list, listErr := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 20)
	require.Nil(t, listErr)

	var mmBlocksPost *model.Post
	messageChunks := 0
	for _, p := range list.Posts {
		if p.Message != "" && strings.Contains(longMessage, p.Message) {
			messageChunks++
		}
		if p.GetProp(model.PostPropsMmBlocks) != nil {
			mmBlocksPost = p
		}
	}
	require.Greater(t, messageChunks, 1, "message should be split into multiple posts")
	require.NotNil(t, mmBlocksPost)
	require.NotEqual(t, returned.Id, mmBlocksPost.Id, "interactive props should be on a later split, not the returned first chunk")

	stored, err := th.App.Srv().Store().Post().GetSingle(th.Context, mmBlocksPost.Id, false)
	require.NoError(t, err)
	require.NotNil(t, stored.GetProp(model.PostPropsMmBlocksActions),
		"mm_blocks_actions must be on the post that carries mm_blocks")

	for _, p := range list.Posts {
		if p.GetProp(model.PostPropsMmBlocksActions) != nil {
			assert.Equal(t, mmBlocksPost.Id, p.Id, "only the mm_blocks post should keep mm_blocks_actions")
		}
	}
}

func TestSendEphemeralPostEncryptsMmBlocksActionsCookie(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	secret := th.App.PostActionCookieSecret()
	ephemeral := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "ephemeral with inline actions",
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"eph",
				"http://127.0.0.1/plugins/myplugin/eph",
				map[string]any{"k": "v"},
			),
		},
	}

	result, _ := th.App.SendEphemeralPost(th.Context, th.BasicUser.Id, ephemeral)
	require.NotNil(t, result)
	raw := result.GetProp(model.PostPropsMmBlocksActions)
	enc, ok := raw.(string)
	require.True(t, ok, "SendEphemeralPost must encrypt mm_blocks_actions into a cookie string for client clicks")
	require.NotEmpty(t, enc)

	plain, err := model.DecryptPostActionCookie(enc, secret)
	require.NoError(t, err)
	_, mm, err := model.ParseDecryptedActionCookiePayload(plain)
	require.NoError(t, err)
	require.NotNil(t, mm)
	spec := mm.ActionSpec("eph")
	require.NotNil(t, spec)
	assert.Equal(t, "http://127.0.0.1/plugins/myplugin/eph", spec.URL)

	ephemeral2 := &model.Post{
		Id:        result.Id,
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "updated ephemeral with inline actions",
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
				"eph2",
				"http://127.0.0.1/plugins/myplugin/eph2",
				nil,
			),
		},
	}
	updated, _ := th.App.UpdateEphemeralPost(th.Context, th.BasicUser.Id, ephemeral2)
	require.NotNil(t, updated)
	enc2, ok := updated.GetProp(model.PostPropsMmBlocksActions).(string)
	require.True(t, ok)
	require.NotEmpty(t, enc2)
}

func TestDoPostActionQueryMergedIntoURL(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	// Capture both the upstream integration request body and the URL the
	// server saw, so we can assert that per-click query lands in the URL
	// (mm_blocks transport) and not in the upstream Context map.
	var (
		capturedReq      model.PostActionIntegrationRequest
		capturedRawQuery string
	)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRawQuery = r.URL.RawQuery
		body, readErr := io.ReadAll(r.Body)
		require.NoError(t, readErr)
		require.NoError(t, json.Unmarshal(body, &capturedReq))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	inlineActions := buildMmBlocksActionsProp(
		"inline1",
		ts.URL,
		map[string]any{"operation": "STORM"},
	)
	botPost := &model.Post{
		Message:       "mm_blocks action post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: inlineActions,
		},
	}
	created, _, err := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
	require.Nil(t, err)
	require.NotNil(t, created.GetProp(model.PostPropsMmBlocksActions))

	query := map[string]string{"tail": "214"}
	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, nil, query, model.PostActionIntegrationFormatMmBlock)
	require.Nil(t, err)

	// Query was appended to the upstream URL.
	parsedQuery, qErr := url.ParseQuery(capturedRawQuery)
	require.NoError(t, qErr)
	assert.Equal(t, "214", parsedQuery.Get("tail"), "per-click query should land in the upstream URL")

	// Original action Context is forwarded as the upstream request's
	// Context, untouched by the query merge.
	assert.Equal(t, "STORM", capturedReq.Context["operation"])
	_, leakedInlineParams := capturedReq.Context["inline_params"]
	assert.False(t, leakedInlineParams, "query must not be injected into upstream Context")
}

func TestDoPostActionStaticQueryMergedWithPerClickQuery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	var capturedRawQuery string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRawQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	// Spec carries a static query (source=fleet) AND a key (tail=999) that
	// the per-click query will override. Per-click should win.
	botPost := &model.Post{
		Message:       "mm_blocks action post with static query",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: map[string]any{
				"inline1": map[string]any{
					"type":  model.MmBlocksActionTypeExternal,
					"url":   ts.URL,
					"query": map[string]any{"source": "fleet", "tail": "999"},
				},
			},
		},
	}
	created, _, err := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
	require.Nil(t, err)

	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, nil, map[string]string{"tail": "214"}, model.PostActionIntegrationFormatMmBlock)
	require.Nil(t, err)

	parsedQuery, qErr := url.ParseQuery(capturedRawQuery)
	require.NoError(t, qErr)
	assert.Equal(t, "fleet", parsedQuery.Get("source"), "spec static query should land in the upstream URL")
	assert.Equal(t, "214", parsedQuery.Get("tail"), "per-click query should override spec static query on overlapping keys")
}

func TestDoPostActionContextMapNotMutated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	originalContext := map[string]any{"operation": "STORM"}
	inlineActions := buildMmBlocksActionsProp("inline1", ts.URL, originalContext)
	botPost := &model.Post{
		Message:       "mm_blocks action post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
		Props: model.StringInterface{
			model.PostPropsMmBlocksActions: inlineActions,
		},
	}
	created, _, err := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
	require.Nil(t, err)

	// First click: carries one set of per-click query values.
	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, nil, map[string]string{"tail": "214"}, model.PostActionIntegrationFormatMmBlock)
	require.Nil(t, err)

	// Post's stored mm_blocks_actions Context must not be mutated by the click.
	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	spec := stored.GetMmBlocksActionSpec("inline1")
	require.NotNil(t, spec)
	assert.Equal(t, "STORM", spec.Context["operation"])
	assert.Equal(t, ts.URL, spec.URL, "stored URL must not absorb per-click query")

	// Second click with a different per-click query.
	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, "inline1", th.BasicUser.Id, "", nil, nil, map[string]string{"tail": "999"}, model.PostActionIntegrationFormatMmBlock)
	require.Nil(t, err)

	stored, nErr = th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	spec = stored.GetMmBlocksActionSpec("inline1")
	require.NotNil(t, spec)
	assert.Equal(t, "STORM", spec.Context["operation"])
	assert.Equal(t, ts.URL, spec.URL, "stored URL must not absorb per-click query")
}

func TestDoPostActionPluginResponseMmBlocksActionsDropped(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)

	// Plugin returns an update that tries to add mm_blocks_actions, even
	// though the original post had none.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		resp := `{
			"update": {
				"message": "updated message",
				"props": {
					"mm_blocks_actions": {
						"sneaky": {"type": "external", "url": "http://127.0.0.1/plugins/myplugin/sneak"}
					}
				}
			}
		}`
		_, _ = w.Write([]byte(resp))
	}))
	defer ts.Close()

	// Bot post has an ATTACHMENT action (not an mm_blocks action), and no
	// mm_blocks_actions prop. The plugin's response to clicking the
	// attachment should not be able to introduce mm_blocks_actions.
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
	require.Nil(t, created.GetProp(model.PostPropsMmBlocksActions))

	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
	require.Nil(t, err)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	assert.Nil(t, stored.GetProp(model.PostPropsMmBlocksActions), "plugin response must not be able to add mm_blocks_actions where none existed")
	assert.Equal(t, "updated message", stored.Message)
}

func TestDoPostActionMmBlocksActions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	t.Run("external posts integration request with merged query on URL", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var request model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
			assert.Equal(t, th.BasicUser.Id, request.UserId)
			assert.Equal(t, model.PostActionTypeButton, request.Type)
			assert.Equal(t, "v", request.Context["k"])
			// clientQuery is merged into the upstream URL, not the integration context.
			assert.Equal(t, "fromClient", r.URL.Query().Get("c"))
			assert.Equal(t, "yes", r.URL.Query().Get("fromAction"))
			assert.Equal(t, "2", r.URL.Query().Get("existing"))
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		actionID := model.NewId()
		interactivePost := &model.Post{
			Message:       "mm_blocks action",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: map[string]any{
					actionID: map[string]any{
						"type":    model.MmBlocksActionTypeExternal,
						"url":     ts.URL + "/base?existing=1",
						"context": map[string]any{"k": "v"},
						"query": map[string]any{
							"fromAction": "yes",
							"existing":   "2",
						},
					},
				},
			},
		}

		post, _, err := th.App.CreatePostAsUser(intSeedCtx, interactivePost, "", true)
		require.Nil(t, err)
		require.NotNil(t, post.GetProp(model.PostPropsMmBlocksActions))

		clientQuery := map[string]string{"c": "fromClient"}
		_, _, appErr := th.App.DoPostActionWithCookie(th.Context, post.Id, actionID, th.BasicUser.Id, "", nil, nil, clientQuery, model.PostActionIntegrationFormatMmBlock)
		require.Nil(t, appErr)
	})

	t.Run("openURL returns goto_location as defined url", func(t *testing.T) {
		actionID := model.NewId()
		interactivePost := &model.Post{
			Message:       "mm_blocks open",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: map[string]any{
					actionID: map[string]any{
						"type": model.MmBlocksActionTypeOpenURL,
						"url":  "https://example.com/page?keep=1",
						"query": map[string]any{
							"a":    "b",
							"keep": "2",
						},
					},
				},
			},
		}
		post, _, err := th.App.CreatePostAsUser(intSeedCtx, interactivePost, "", true)
		require.Nil(t, err)
		require.NotNil(t, post.GetProp(model.PostPropsMmBlocksActions))

		trigger, gotoLoc, appErr := th.App.DoPostActionWithCookie(th.Context, post.Id, actionID, th.BasicUser.Id, "", nil, nil, nil, model.PostActionIntegrationFormatMmBlock)
		require.Nil(t, appErr)
		assert.Equal(t, "", trigger)
		assert.Equal(t, "https://example.com/page?a=b&keep=2", gotoLoc)
	})
}

func TestDoPostActionPluginResponseInvalidMmBlocksActionsRestored(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	// Plugin returns an update where mm_blocks_actions contains an entry
	// with an empty URL — invalid; the original prop should be restored
	// with a warning, while the message update still succeeds.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		resp := `{
			"update": {
				"message": "updated via plugin",
				"props": {
					"mm_blocks_actions": {
						"broken": {"type": "external", "url": ""}
					}
				}
			}
		}`
		_, _ = w.Write([]byte(resp))
	}))
	defer ts.Close()

	// The original post has VALID mm_blocks_actions, so the "drop because
	// original had none" branch is bypassed and we exercise the validation
	// branch.
	originalInline := buildMmBlocksActionsProp(
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
			model.PostPropsMmBlocksActions: originalInline,
		},
	}
	created, _, err := th.App.CreatePostAsUser(intSeedCtx, botPost, "", true)
	require.Nil(t, err)
	attachments, ok := created.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)

	_, _, err = th.App.DoPostActionWithCookie(th.Context, created.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
	require.Nil(t, err)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, created.Id, false)
	require.NoError(t, nErr)
	// Message update still applied — the invalid mm_blocks_actions were
	// restored to the original value with a warning, so the rest of the
	// response.Update is persisted.
	assert.Equal(t, "updated via plugin", stored.Message)
	// The broken action from the plugin response must never be stored.
	assert.Nil(t, stored.GetMmBlocksActionSpec("broken"), "invalid mm_blocks action from plugin response must not be persisted")
	// The original valid mm_blocks_actions must survive — an invalid plugin
	// response must never wipe a post's existing buttons.
	require.NotNil(t, stored.GetMmBlocksActionSpec("orig"), "original valid mm_blocks action must be preserved when plugin response is invalid")
	assert.Equal(t, "http://127.0.0.1/plugins/myplugin/orig", stored.GetMmBlocksActionSpec("orig").URL)
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

	// from_bot and from_plugin are now server-set: from_bot via user.IsBot,
	// from_plugin via the FromPlugin CreatePostFlag. Forged client-supplied
	// values would be stripped by SanitizeProps.
	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	// Plugin response deliberately omits from_bot / from_plugin from props.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"update": {"message": "updated", "props": {"A": "AA"}}}`)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "interactive",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        botUser.Id,
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
		},
	}

	post, _, appErr := th.App.CreatePostAsUserWithFlags(intSeedCtx, &interactivePost, "", model.CreatePostFlags{
		SetOnline:  true,
		FromPlugin: true,
	})
	require.Nil(t, appErr)
	attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)

	_, _, appErr = th.App.DoPostActionWithCookie(th.Context, post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "", nil, nil, nil, "")
	require.Nil(t, appErr)

	stored, nErr := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
	require.NoError(t, nErr)

	assert.Equal(t, "true", stored.GetProp(model.PostPropsFromBot), "from_bot must be retained across plugin update response")
	assert.Equal(t, "true", stored.GetProp(model.PostPropsFromPlugin), "from_plugin must be retained across plugin update response")
	assert.Equal(t, "AA", stored.GetProp("A"), "plugin-supplied prop applied")
}

func TestSubmitInteractiveDialogFileValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := model.SubmitDialogResponse{}
		b, _ := json.Marshal(resp)
		_, _ = w.Write(b)
	}))
	defer ts.Close()

	baseSubmit := model.SubmitDialogRequest{
		URL:        ts.URL,
		UserId:     th.BasicUser.Id,
		ChannelId:  th.BasicChannel.Id,
		TeamId:     th.BasicTeam.Id,
		CallbackId: "someid",
		State:      "somestate",
		Submission: map[string]any{"name1": "value1"},
	}

	t.Run("empty FileIds passes validation", func(t *testing.T) {
		submit := baseSubmit
		submit.FileIds = nil
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("deduplication happens before count check", func(t *testing.T) {
		// Create one valid file
		fileInfo := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)

		// Build FileIds with the same ID repeated MaxDialogFileIds+1 times.
		// After dedup this should be 1 ID, which is within the limit.
		ids := make([]string, model.MaxDialogFileIds+1)
		for i := range ids {
			ids[i] = fileInfo.Id
		}

		submit := baseSubmit
		submit.FileIds = ids
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("too many file IDs after dedup returns error", func(t *testing.T) {
		ids := make([]string, model.MaxDialogFileIds+1)
		for i := range ids {
			fi := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
			ids[i] = fi.Id
		}

		submit := baseSubmit
		submit.FileIds = ids
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "too_many_file_ids")
	})

	t.Run("duplicates that would exceed limit raw but not after dedup passes", func(t *testing.T) {
		// Create exactly MaxDialogFileIds unique files
		uniqueIds := make([]string, model.MaxDialogFileIds)
		for i := range uniqueIds {
			fi := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
			uniqueIds[i] = fi.Id
		}
		// Add a duplicate so raw count is MaxDialogFileIds+1
		ids := make([]string, 0, len(uniqueIds)+1)
		ids = append(ids, uniqueIds...)
		ids = append(ids, uniqueIds[0])

		submit := baseSubmit
		submit.FileIds = ids
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("valid file ID owned by submitting user passes", func(t *testing.T) {
		fileInfo := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = []string{fileInfo.Id}
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("file ID not found returns 400 invalid_file_id", func(t *testing.T) {
		submit := baseSubmit
		submit.FileIds = []string{model.NewId()}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "invalid_file_id")
	})

	t.Run("file owned by different user returns 403 file_not_owned", func(t *testing.T) {
		fileInfo := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = []string{fileInfo.Id}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("batch with a valid owned file and a missing file returns 400 invalid_file_id", func(t *testing.T) {
		// The batched GetByIds returns only the existing file; the not-found ID must
		// still be detected by diffing the found set against the requested IDs.
		fileInfo := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = []string{fileInfo.Id, model.NewId()}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "invalid_file_id")
	})

	t.Run("batch with an owned file and another user's file returns 403 file_not_owned", func(t *testing.T) {
		// Ownership must be enforced across every file in the batch, not just a single ID.
		ownFile := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
		otherFile := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = []string{ownFile.Id, otherFile.Id}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("unowned file ID smuggled via submission (empty FileIds) is rejected", func(t *testing.T) {
		// A client puts another user's file ID in a submission value while sending no
		// FileIds. Integrations read submission values, so this must still be blocked.
		fileInfo := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"single_document": fileInfo.Id}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("own file ID referenced only via submission passes", func(t *testing.T) {
		fileInfo := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"single_document": fileInfo.Id}
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("ID-shaped submission value that is not a real file is treated as text", func(t *testing.T) {
		// A textarea value that happens to be a valid-format ID but isn't a file must
		// not block submission.
		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"notes": model.NewId()}
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("many ID-shaped non-file submission values are not rejected (e.g. select fields)", func(t *testing.T) {
		// Regression guard: a dialog with more than MaxDialogFileIds ID-shaped values
		// that are NOT files (user/channel select IDs) must not trip the file-count cap.
		submission := make(map[string]any)
		for i := range model.MaxDialogFileIds + 5 {
			submission[fmt.Sprintf("select_%d", i)] = model.NewId()
		}
		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = submission
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})

	t.Run("submission ID scan fails closed when breadth cap is exceeded", func(t *testing.T) {
		otherFile := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		maxTokens := model.MaxDialogSubmissionIDShapedTokenScan
		require.Greater(t, maxTokens, 0)

		padded := make([]any, 0, maxTokens+1)
		for range maxTokens {
			padded = append(padded, model.NewId())
		}
		require.Len(t, padded, maxTokens)

		padded = append(padded, otherFile.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"overflow": padded}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "too_many_submission_ids")
	})

	t.Run("submission ID scan fails closed for comma-separated padding attack", func(t *testing.T) {
		otherFile := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		maxTokens := model.MaxDialogSubmissionIDShapedTokenScan
		require.Greater(t, maxTokens, 0)

		var b strings.Builder
		for i := range maxTokens {
			if i > 0 {
				b.WriteString(", ")
			}
			b.WriteString(model.NewId())
		}
		b.WriteString(", ")
		b.WriteString(otherFile.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"documents": b.String()}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "too_many_submission_ids")
	})

	t.Run("unowned file ID smuggled via a nested submission map is rejected", func(t *testing.T) {
		fileInfo := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{
			"metadata": map[string]any{"document": fileInfo.Id},
		}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("unowned file ID smuggled via comma-separated submission string is rejected", func(t *testing.T) {
		ownFile := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
		otherFile := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{
			"documents": ownFile.Id + ", " + otherFile.Id,
		}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("declared and submission file IDs combined cannot exceed MaxDialogFileIds", func(t *testing.T) {
		declaredIds := make([]string, model.MaxDialogFileIds/2)
		for i := range declaredIds {
			fi := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
			declaredIds[i] = fi.Id
		}
		submissionIds := make([]string, model.MaxDialogFileIds-len(declaredIds)+1)
		for i := range submissionIds {
			fi := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
			submissionIds[i] = fi.Id
		}

		submit := baseSubmit
		submit.FileIds = declaredIds
		submit.Submission = map[string]any{"extra": submissionIds}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "too_many_file_ids")
	})

	t.Run("unowned file ID smuggled via a submission array is rejected", func(t *testing.T) {
		fileInfo := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"attachments": []any{fileInfo.Id}}
		_, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.Id, "file_not_owned")
	})

	t.Run("deeply nested submission value is depth-bounded and does not exhaust the stack", func(t *testing.T) {
		// Built in-memory (not via JSON), so this bypasses the json decoder's own depth
		// limit and exercises our explicit recursion guard directly. Nesting far beyond
		// the depth cap must be traversed only up to the cap and then ignored — no panic,
		// no stack overflow — and the submission still succeeds.
		var nested any = model.NewId()
		for range 5000 {
			nested = []any{nested}
		}

		submit := baseSubmit
		submit.FileIds = nil
		submit.Submission = map[string]any{"deep": nested}
		resp, appErr := th.App.SubmitInteractiveDialog(th.Context, submit)
		assert.Nil(t, appErr)
		require.NotNil(t, resp)
	})
}

func TestExecuteDialogAction(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("happy path — returns non-empty trigger ID and integration receives dialog_action request", func(t *testing.T) {
		var received model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewDecoder(r.Body).Decode(&received)
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
			Context:   map[string]string{"key": "value"},
		}

		triggerId, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.Nil(t, appErr)
		assert.NotEmpty(t, triggerId)
		assert.Len(t, triggerId, 26)

		assert.Equal(t, "dialog_action", received.Type)
		assert.Equal(t, th.BasicUser.Id, received.UserId)
		assert.Equal(t, th.BasicUser.Username, received.UserName)
		assert.Equal(t, th.BasicChannel.Id, received.ChannelId)
		assert.Equal(t, th.BasicTeam.Id, received.TeamId)
		assert.Equal(t, "value", received.Context["key"])
		assert.NotEmpty(t, received.TriggerId)
	})

	t.Run("empty TeamId works — no error for DM/GM channels", func(t *testing.T) {
		user1 := th.CreateUser(t)
		dmChannel := th.CreateDmChannel(t, user1)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: dmChannel.Id,
			TeamId:    "",
		}

		triggerId, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.Nil(t, appErr)
		assert.NotEmpty(t, triggerId)
	})

	t.Run("oversized context is rejected with 400", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		oversizedContext := make(map[string]string, model.MaxActionQueryEntries+1)
		for i := range model.MaxActionQueryEntries + 1 {
			oversizedContext[fmt.Sprintf("k%d", i)] = "v"
		}

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
			Context:   oversizedContext,
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("context key exceeding max length is rejected with 400", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
			Context:   map[string]string{strings.Repeat("k", model.MaxActionQueryKeyLength+1): "v"},
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("context value exceeding max length is rejected with 400", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
			Context:   map[string]string{"k": strings.Repeat("v", model.MaxActionQueryValueLength+1)},
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("invalid URL returns 400", func(t *testing.T) {
		req := model.ExecuteDialogActionRequest{
			URL:       "not-a-valid-url",
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("empty URL returns 400", func(t *testing.T) {
		req := model.ExecuteDialogActionRequest{
			URL:       "",
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("non-existent channel returns error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: model.NewId(), // valid-format but non-existent
			TeamId:    th.BasicTeam.Id,
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
	})

	t.Run("non-existent team returns 500", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		// The api4 handler overwrites TeamId with channel.TeamId before calling
		// ExecuteDialogAction, so the only way to exercise the app-layer team
		// lookup error branch is via a direct call with a bogus TeamId and a
		// valid channel whose TeamId is empty (DM channel, so the handler would
		// set TeamId="" and skip the lookup).  Here we call the app layer directly
		// with a real channel but a synthetic non-existent TeamId so the store
		// lookup fails.
		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    model.NewId(), // valid-format but non-existent
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("integration returns 500 — DoActionRequest non-200 path drains body and returns error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}))
		defer ts.Close()

		req := model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		}

		_, appErr := th.App.ExecuteDialogAction(th.Context, th.BasicUser.Id, req)
		require.NotNil(t, appErr)
		// DoActionRequest maps upstream 5xx (other than 429/503) to 502 Bad Gateway.
		assert.Equal(t, http.StatusBadGateway, appErr.StatusCode)
	})
}
