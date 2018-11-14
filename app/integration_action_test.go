// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestPostAction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := model.PostActionIntegrationRequestFromJson(r.Body)
		assert.NotNil(t, request)

		assert.Equal(t, request.UserId, th.BasicUser.Id)
		assert.Equal(t, request.ChannelId, th.BasicChannel.Id)
		assert.Equal(t, request.TeamId, th.BasicTeam.Id)
		assert.True(t, len(request.TriggerId) > 0)
		if request.Type == model.POST_ACTION_TYPE_SELECT {
			assert.Equal(t, request.DataSource, "some_source")
			assert.Equal(t, request.Context["selected_option"], "selected")
		} else {
			assert.Equal(t, request.DataSource, "")
		}
		assert.Equal(t, "foo", request.Context["s"])
		assert.EqualValues(t, 3, request.Context["n"])
		fmt.Fprintf(w, `{"post": {"message": "updated"}, "ephemeral_text": "foo"}`)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL,
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	post, err := th.App.CreatePostAsUser(&interactivePost, false)
	require.Nil(t, err)

	attachments, ok := post.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)

	menuPost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL,
							},
							Name:       "action",
							Type:       model.POST_ACTION_TYPE_SELECT,
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	post2, err := th.App.CreatePostAsUser(&menuPost, false)
	require.Nil(t, err)

	attachments2, ok := post2.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	require.NotEmpty(t, attachments2[0].Actions)
	require.NotEmpty(t, attachments2[0].Actions[0].Id)

	clientTriggerId, err := th.App.DoPostAction(post.Id, "notavalidid", th.BasicUser.Id, "")
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)
	assert.True(t, clientTriggerId == "")

	clientTriggerId, err = th.App.DoPostAction(post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)
	assert.True(t, len(clientTriggerId) == 26)

	clientTriggerId, err = th.App.DoPostAction(post2.Id, attachments2[0].Actions[0].Id, th.BasicUser.Id, "selected")
	require.Nil(t, err)
	assert.True(t, len(clientTriggerId) == 26)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
	})

	_, err = th.App.DoPostAction(post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "")
	require.NotNil(t, err)
	require.True(t, strings.Contains(err.Error(), "address forbidden"))

	interactivePostPlugin := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL + "/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postplugin, err := th.App.CreatePostAsUser(&interactivePostPlugin, false)
	require.Nil(t, err)

	attachmentsPlugin, ok := postplugin.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	_, err = th.App.DoPostAction(postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://127.1.1.1"
	})

	interactivePostSiteURL := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: "http://127.1.1.1/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postSiteURL, err := th.App.CreatePostAsUser(&interactivePostSiteURL, false)
	require.Nil(t, err)

	attachmentsSiteURL, ok := postSiteURL.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	_, err = th.App.DoPostAction(postSiteURL.Id, attachmentsSiteURL[0].Actions[0].Id, th.BasicUser.Id, "")
	require.NotNil(t, err)
	require.False(t, strings.Contains(err.Error(), "address forbidden"))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = ts.URL + "/subpath"
	})

	interactivePostSubpath := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL + "/subpath/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postSubpath, err := th.App.CreatePostAsUser(&interactivePostSubpath, false)
	require.Nil(t, err)

	attachmentsSubpath, ok := postSubpath.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	_, err = th.App.DoPostAction(postSubpath.Id, attachmentsSubpath[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)
}

func TestSubmitInteractiveDialog(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	submit := model.SubmitDialogRequest{
		UserId:     th.BasicUser.Id,
		ChannelId:  th.BasicChannel.Id,
		TeamId:     th.BasicTeam.Id,
		CallbackId: "someid",
		State:      "somestate",
		Submission: map[string]interface{}{
			"name1": "value1",
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.SubmitDialogRequest
		err := json.NewDecoder(r.Body).Decode(&request)
		require.Nil(t, err)
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
			Errors: map[string]string{"name1": "some error"},
		}

		b, _ := json.Marshal(resp)

		w.Write(b)
	}))
	defer ts.Close()

	submit.URL = ts.URL

	resp, err := th.App.SubmitInteractiveDialog(submit)
	assert.Nil(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "some error", resp.Errors["name1"])

	submit.URL = ""
	resp, err = th.App.SubmitInteractiveDialog(submit)
	assert.NotNil(t, err)
	assert.Nil(t, resp)
}
