// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/testlib"
)

func TestCreateIncomingWebhookForChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	type TestCase struct {
		EnableIncomingHooks        bool
		EnablePostUsernameOverride bool
		EnablePostIconOverride     bool
		IncomingWebhook            model.IncomingWebhook

		ExpectedError           bool
		ExpectedIncomingWebhook *model.IncomingWebhook
	}

	for name, tc := range map[string]TestCase{
		"webhooks not enabled": {
			EnableIncomingHooks:        false,
			EnablePostUsernameOverride: false,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},

			ExpectedError:           true,
			ExpectedIncomingWebhook: nil,
		},
		"valid: username and post icon url ignored, since override not enabled": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: false,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    ":invalid and ignored:",
				IconURL:     "ignored",
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},
		},
		"invalid username, override enabled": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    ":invalid:",
			},

			ExpectedError:           true,
			ExpectedIncomingWebhook: nil,
		},
		"valid, no username or post icon url provided": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     true,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},
		},
		"valid, with username and post icon": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     true,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    "valid",
				IconURL:     "http://example.com/icon",
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    "valid",
				IconURL:     "http://example.com/icon",
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = tc.EnableIncomingHooks })
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnablePostUsernameOverride = tc.EnablePostUsernameOverride
			})
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = tc.EnablePostIconOverride })

			createdHook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &tc.IncomingWebhook)
			if tc.ExpectedError {
				require.NotNil(t, err, "should have failed")
			} else {
				require.Nil(t, err, "should not have failed")
			}
			if createdHook != nil {
				defer th.App.DeleteIncomingWebhook(createdHook.Id)
			}
			if tc.ExpectedIncomingWebhook == nil {
				assert.Nil(t, createdHook, "expected nil webhook")
			} else if assert.NotNil(t, createdHook, "expected non-nil webhook") {
				assert.Equal(t, tc.ExpectedIncomingWebhook.DisplayName, createdHook.DisplayName)
				assert.Equal(t, tc.ExpectedIncomingWebhook.Description, createdHook.Description)
				assert.Equal(t, tc.ExpectedIncomingWebhook.ChannelId, createdHook.ChannelId)
				assert.Equal(t, tc.ExpectedIncomingWebhook.Username, createdHook.Username)
				assert.Equal(t, tc.ExpectedIncomingWebhook.IconURL, createdHook.IconURL)
			}
		})
	}
}

func TestUpdateIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	type TestCase struct {
		EnableIncomingHooks        bool
		EnablePostUsernameOverride bool
		EnablePostIconOverride     bool
		IncomingWebhook            model.IncomingWebhook

		ExpectedError           bool
		ExpectedIncomingWebhook *model.IncomingWebhook
	}

	for name, tc := range map[string]TestCase{
		"webhooks not enabled": {
			EnableIncomingHooks:        false,
			EnablePostUsernameOverride: false,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},

			ExpectedError:           true,
			ExpectedIncomingWebhook: nil,
		},
		"valid: username and post icon url ignored, since override not enabled": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: false,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    ":invalid and ignored:",
				IconURL:     "ignored",
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},
		},
		"invalid username, override enabled": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     false,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    ":invalid:",
			},

			ExpectedError:           true,
			ExpectedIncomingWebhook: nil,
		},
		"valid, no username or post icon url provided": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     true,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
			},
		},
		"valid, with username and post icon": {
			EnableIncomingHooks:        true,
			EnablePostUsernameOverride: true,
			EnablePostIconOverride:     true,
			IncomingWebhook: model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    "valid",
				IconURL:     "http://example.com/icon",
			},

			ExpectedError: false,
			ExpectedIncomingWebhook: &model.IncomingWebhook{
				DisplayName: "title",
				Description: "description",
				ChannelId:   th.BasicChannel.Id,
				Username:    "valid",
				IconURL:     "http://example.com/icon",
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

			hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{
				ChannelId: th.BasicChannel.Id,
			})
			require.Nil(t, err)
			defer th.App.DeleteIncomingWebhook(hook.Id)

			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = tc.EnableIncomingHooks })
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnablePostUsernameOverride = tc.EnablePostUsernameOverride
			})
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = tc.EnablePostIconOverride })

			updatedHook, err := th.App.UpdateIncomingWebhook(hook, &tc.IncomingWebhook)
			if tc.ExpectedError {
				require.NotNil(t, err, "should have failed")
			} else {
				require.Nil(t, err, "should not have failed")
			}
			if tc.ExpectedIncomingWebhook == nil {
				assert.Nil(t, updatedHook, "expected nil webhook")
			} else if assert.NotNil(t, updatedHook, "expected non-nil webhook") {
				assert.Equal(t, tc.ExpectedIncomingWebhook.DisplayName, updatedHook.DisplayName)
				assert.Equal(t, tc.ExpectedIncomingWebhook.Description, updatedHook.Description)
				assert.Equal(t, tc.ExpectedIncomingWebhook.ChannelId, updatedHook.ChannelId)
				assert.Equal(t, tc.ExpectedIncomingWebhook.Username, updatedHook.Username)
				assert.Equal(t, tc.ExpectedIncomingWebhook.IconURL, updatedHook.IconURL)
			}
		})
	}
}

func TestCreateWebhookPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, err)
	defer th.App.DeleteIncomingWebhook(hook.Id)

	post, err := th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, "foo", "user", "http://iconurl", "", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			{
				Text: "text",
			},
		},
		"webhook_display_name": hook.DisplayName,
	}, model.PostTypeSlackAttachment, "")
	require.Nil(t, err)

	assert.Contains(t, post.GetProps(), "from_webhook", "missing from_webhook prop")
	assert.Contains(t, post.GetProps(), "attachments", "missing attachments prop")
	assert.Contains(t, post.GetProps(), "webhook_display_name", "missing webhook_display_name prop")

	_, err = th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, "foo", "user", "http://iconurl", "", nil, model.PostTypeSystemGeneric, "")
	require.NotNil(t, err, "Should have failed - bad post type")

	expectedText := "`<>|<>|`"
	post, err = th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, expectedText, "user", "http://iconurl", "", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			{
				Text: "text",
			},
		},
		"webhook_display_name": hook.DisplayName,
	}, model.PostTypeSlackAttachment, "")
	require.Nil(t, err)
	assert.Equal(t, expectedText, post.Message)

	expectedText = "< | \n|\n>"
	post, err = th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, expectedText, "user", "http://iconurl", "", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			{
				Text: "text",
			},
		},
		"webhook_display_name": hook.DisplayName,
	}, model.PostTypeSlackAttachment, "")
	require.Nil(t, err)
	assert.Equal(t, expectedText, post.Message)

	expectedText = `commit bc95839e4a430ace453e8b209a3723c000c1729a
Author: foo <foo@example.org>
Date:   Thu Mar 1 19:46:54 2018 +0300

    commit message 2

  test | 1 +
 1 file changed, 1 insertion(+)

commit 5df78b7139b543997838071cd912e375d8bd69b2
Author: foo <foo@example.org>
Date:   Thu Mar 1 19:46:48 2018 +0300

    commit message 1

 test | 3 +++
 1 file changed, 3 insertions(+)`
	post, err = th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, expectedText, "user", "http://iconurl", "", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			{
				Text: "text",
			},
		},
		"webhook_display_name": hook.DisplayName,
	}, model.PostTypeSlackAttachment, "")
	require.Nil(t, err)
	assert.Equal(t, expectedText, post.Message)

	t.Run("should set webhook creator status to online", func(t *testing.T) {
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(testCluster)
		defer th.Server.Platform().SetCluster(nil)

		testCluster.ClearMessages()
		_, appErr := th.App.CreateWebhookPost(th.Context, hook.UserId, th.BasicChannel, "text", "", "", "", model.StringInterface{}, model.PostTypeDefault, "")
		require.Nil(t, appErr)


		msgs := testCluster.GetMessages()
		// The first message is ClusterEventInvalidateCacheForChannelByName so we skip it
		ev, err1 := model.WebSocketEventFromJSON(bytes.NewReader(msgs[1].Data))
		require.NoError(t, err1)
		require.Equal(t, model.WebsocketEventPosted, ev.EventType())
		assert.Equal(t, false, ev.GetData()["set_online"])
	})
}

func TestSplitWebhookPost(t *testing.T) {
	type TestCase struct {
		Post     *model.Post
		Expected []*model.Post
	}

	maxPostSize := 10000

	for name, tc := range map[string]TestCase{
		"LongPost": {
			Post: &model.Post{
				Message: strings.Repeat("本", maxPostSize*3/2),
			},
			Expected: []*model.Post{
				{
					Message: strings.Repeat("本", maxPostSize),
				},
				{
					Message: strings.Repeat("本", maxPostSize/2),
				},
			},
		},
		"LongPostAndMultipleAttachments": {
			Post: &model.Post{
				Message: strings.Repeat("本", maxPostSize*3/2),
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text: strings.Repeat("本", 1000),
						},
						{
							Text: strings.Repeat("本", 2000),
						},
						{
							Text: strings.Repeat("本", model.PostPropsMaxUserRunes-1000),
						},
					},
				},
			},
			Expected: []*model.Post{
				{
					Message: strings.Repeat("本", maxPostSize),
				},
				{
					Message: strings.Repeat("本", maxPostSize/2),
					Props: map[string]any{
						"attachments": []*model.SlackAttachment{
							{
								Text: strings.Repeat("本", 1000),
							},
							{
								Text: strings.Repeat("本", 2000),
							},
						},
					},
				},
				{
					Props: map[string]any{
						"attachments": []*model.SlackAttachment{
							{
								Text: strings.Repeat("本", model.PostPropsMaxUserRunes-1000),
							},
						},
					},
				},
			},
		},
		"UnsplittableProps": {
			Post: &model.Post{
				Message: "foo",
				Props: map[string]any{
					"foo": strings.Repeat("x", model.PostPropsMaxUserRunes*2),
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			splits, err := SplitWebhookPost(tc.Post, maxPostSize)
			if tc.Expected == nil {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
			assert.Equal(t, len(tc.Expected), len(splits))
			for i, split := range splits {
				if i < len(tc.Expected) {
					assert.Equal(t, tc.Expected[i].Message, split.Message)
					assert.Equal(t, tc.Expected[i].GetProp("attachments"), split.GetProp("attachments"))
				}
			}
		})
	}
}

func makePost(message int, attachments []int) *model.Post {
	var props model.StringInterface
	if len(attachments) > 0 {
		sa := make([]*model.SlackAttachment, 0, len(attachments))
		for _, a := range attachments {
			attach := &model.SlackAttachment{
				Text: strings.Repeat("那", a),
			}
			sa = append(sa, attach)
		}
		props = map[string]any{"attachments": sa}
	}
	post := &model.Post{
		Message: strings.Repeat("那", message),
		Props:   props,
	}
	return post
}

func TestSplitWebhookPostAttachments(t *testing.T) {
	maxPostSize := 10000
	testCases := []struct {
		name     string
		post     *model.Post
		expected []*model.Post
	}{
		{
			// makePost(messageLength, []int{attachmentLength, ...})
			name:     "no split",
			post:     makePost(10, []int{100, 150, 200}),
			expected: []*model.Post{makePost(10, []int{100, 150, 200})},
		},
		{
			name: "split into 2",
			post: makePost(maxPostSize-1, []int{model.PostPropsMaxUserRunes * 3 / 4, model.PostPropsMaxUserRunes * 1 / 4}),
			expected: []*model.Post{
				makePost(maxPostSize-1, []int{model.PostPropsMaxUserRunes * 3 / 4}),
				makePost(0, []int{model.PostPropsMaxUserRunes * 1 / 4}),
			},
		},
		{
			name: "split into 3",
			post: makePost(maxPostSize*3/2, []int{1000, 2000, model.PostPropsMaxUserRunes - 1000}),
			expected: []*model.Post{
				makePost(maxPostSize, nil),
				makePost(maxPostSize/2, []int{1000, 2000}),
				makePost(0, []int{model.PostPropsMaxUserRunes - 1000}),
			},
		},
		{
			name: "MM-24644 split into 3",
			post: makePost(maxPostSize*3/2, []int{5150, 2000, model.PostPropsMaxUserRunes - 1000}),
			expected: []*model.Post{
				makePost(maxPostSize, nil),
				makePost(maxPostSize/2, []int{5150, 2000}),
				makePost(0, []int{model.PostPropsMaxUserRunes - 1000}),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			splits, err := SplitWebhookPost(tc.post, maxPostSize)
			if tc.expected == nil {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
			assert.Equal(t, len(tc.expected), len(splits))
			for i, split := range splits {
				if i < len(tc.expected) {
					assert.Equal(t, tc.expected[i].Message, split.Message, i)
					assert.Equal(t, tc.expected[i].GetProp("attachments"), split.GetProp("attachments"), i)
				}
			}
		})
	}
}

func TestCreateOutGoingWebhookWithUsernameAndIconURL(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	outgoingWebhook := model.OutgoingWebhook{
		ChannelId:    th.BasicChannel.Id,
		TeamId:       th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"},
		Username:     "some-user-name",
		IconURL:      "http://some-icon/",
		DisplayName:  "some-display-name",
		Description:  "some-description",
		CreatorId:    th.BasicUser.Id,
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	createdHook, err := th.App.CreateOutgoingWebhook(&outgoingWebhook)
	require.Nil(t, err)

	assert.NotNil(t, createdHook, "should not be null")

	assert.Equal(t, createdHook.ChannelId, outgoingWebhook.ChannelId)
	assert.Equal(t, createdHook.TeamId, outgoingWebhook.TeamId)
	assert.Equal(t, createdHook.CallbackURLs, outgoingWebhook.CallbackURLs)
	assert.Equal(t, createdHook.Username, outgoingWebhook.Username)
	assert.Equal(t, createdHook.IconURL, outgoingWebhook.IconURL)
	assert.Equal(t, createdHook.DisplayName, outgoingWebhook.DisplayName)
	assert.Equal(t, createdHook.Description, outgoingWebhook.Description)

}

func TestTriggerOutGoingWebhookWithUsernameAndIconURL(t *testing.T) {

	getPayload := func(hook *model.OutgoingWebhook, th *TestHelper, channel *model.Channel) *model.OutgoingWebhookPayload {
		return &model.OutgoingWebhookPayload{
			Token:       hook.Token,
			TeamId:      hook.TeamId,
			TeamDomain:  th.BasicTeam.Name,
			ChannelId:   channel.Id,
			ChannelName: channel.Name,
			Timestamp:   th.BasicPost.CreateAt,
			UserId:      th.BasicPost.UserId,
			UserName:    th.BasicUser.Username,
			PostId:      th.BasicPost.Id,
			Text:        th.BasicPost.Message,
			TriggerWord: "Abracadabra",
			FileIds:     strings.Join(th.BasicPost.FileIds, ","),
		}
	}

	waitUntilWebhookResponseIsCreatedAsPost := func(channel *model.Channel, th *TestHelper, createdPost chan *model.Post) {
		go func() {
			for i := 0; i < 5; i++ {
				time.Sleep(time.Second)
				posts, _ := th.App.GetPosts(channel.Id, 0, 5)
				if len(posts.Posts) > 0 {
					for _, post := range posts.Posts {
						createdPost <- post
						return
					}
				}
			}
		}()
	}

	type TestCaseOutgoing struct {
		EnablePostUsernameOverride bool
		EnablePostIconOverride     bool
		ExpectedUsername           string
		ExpectedIconURL            string
		WebhookResponse            *model.OutgoingWebhookResponse
	}

	createOutgoingWebhook := func(channel *model.Channel, testCallBackURL string, th *TestHelper) (*model.OutgoingWebhook, *model.AppError) {
		outgoingWebhook := model.OutgoingWebhook{
			ChannelId:    channel.Id,
			TeamId:       channel.TeamId,
			CallbackURLs: []string{testCallBackURL},
			Username:     "some-user-name",
			IconURL:      "http://some-icon/",
			DisplayName:  "some-display-name",
			Description:  "some-description",
			CreatorId:    th.BasicUser.Id,
			TriggerWords: []string{"Abracadabra"},
			ContentType:  "application/json",
		}

		return th.App.CreateOutgoingWebhook(&outgoingWebhook)
	}

	getTestCases := func() map[string]TestCaseOutgoing {

		webHookResponse := "sample response text from test server"
		testCasesOutgoing := map[string]TestCaseOutgoing{

			"Should override username and Icon": {
				EnablePostUsernameOverride: true,
				EnablePostIconOverride:     true,
				ExpectedUsername:           "some-user-name",
				ExpectedIconURL:            "http://some-icon/",
			},
			"Should not override username and Icon": {
				EnablePostUsernameOverride: false,
				EnablePostIconOverride:     false,
			},
			"Should not override username and Icon if the webhook response already has it": {
				EnablePostUsernameOverride: true,
				EnablePostIconOverride:     true,
				ExpectedUsername:           "webhookuser",
				ExpectedIconURL:            "http://webhook/icon",
				WebhookResponse:            &model.OutgoingWebhookResponse{Text: &webHookResponse, Username: "webhookuser", IconURL: "http://webhook/icon"},
			},
		}
		return testCasesOutgoing
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})
	createdPost := make(chan *model.Post)

	for name, testCase := range getTestCases() {
		t.Run(name, func(t *testing.T) {

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnableOutgoingWebhooks = true
				*cfg.ServiceSettings.EnablePostUsernameOverride = testCase.EnablePostUsernameOverride
				*cfg.ServiceSettings.EnablePostIconOverride = testCase.EnablePostIconOverride
			})

			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if testCase.WebhookResponse != nil {
					js, jsonErr := json.Marshal(testCase.WebhookResponse)
					require.NoError(t, jsonErr)
					w.Write(js)
				} else {
					w.Write([]byte(`{"text": "sample response text from test server"}`))
				}
			}))
			defer ts.Close()

			channel := th.CreateChannel(th.Context, th.BasicTeam)
			hook, _ := createOutgoingWebhook(channel, ts.URL, th)
			payload := getPayload(hook, th, channel)

			th.App.TriggerWebhook(th.Context, payload, hook, th.BasicPost, channel)

			waitUntilWebhookResponseIsCreatedAsPost(channel, th, createdPost)

			select {
			case webhookPost := <-createdPost:
				assert.Equal(t, webhookPost.Message, "sample response text from test server")
				assert.Equal(t, webhookPost.GetProp("from_webhook"), "true")
				if testCase.ExpectedIconURL != "" {
					assert.Equal(t, webhookPost.GetProp("override_icon_url"), testCase.ExpectedIconURL)
				} else {
					assert.Nil(t, webhookPost.GetProp("override_icon_url"))
				}

				if testCase.ExpectedUsername != "" {
					assert.Equal(t, webhookPost.GetProp("override_username"), testCase.ExpectedUsername)
				} else {
					assert.Nil(t, webhookPost.GetProp("override_username"))
				}
			case <-time.After(5 * time.Second):
				require.Fail(t, "Timeout, webhook response not created as post")
			}

		})
	}

}

type InfiniteReader struct {
	Prefix string
}

func (r InfiniteReader) Read(p []byte) (n int, err error) {
	for i := range p {
		p[i] = 'a'
	}

	return len(p), nil
}

func TestDoOutgoingWebhookRequest(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.AllowedUntrustedInternalConnections = model.NewString("127.0.0.1")
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
	})

	t.Run("with a valid response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, strings.NewReader(`{"text": "Hello, World!"}`))
		}))
		defer server.Close()

		resp, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.NoError(t, err)

		assert.NotNil(t, resp)
		assert.NotNil(t, resp.Text)
		assert.Equal(t, "Hello, World!", *resp.Text)
	})

	t.Run("with an invalid response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, strings.NewReader("aaaaaaaa"))
		}))
		defer server.Close()

		_, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.Error(t, err)
		require.Equal(t, "api.unmarshal_error", err.(*model.AppError).Id)
	})

	t.Run("with a large, valid response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, io.MultiReader(strings.NewReader(`{"text": "`), InfiniteReader{}, strings.NewReader(`"}`)))
		}))
		defer server.Close()

		_, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.Error(t, err)
		require.Equal(t, "api.unmarshal_error", err.(*model.AppError).Id)
	})

	t.Run("with a large, invalid response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, InfiniteReader{})
		}))
		defer server.Close()

		_, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.Error(t, err)
		require.Equal(t, "api.unmarshal_error", err.(*model.AppError).Id)
	})

	t.Run("with a slow response", func(t *testing.T) {
		releaseHandler := make(chan any)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Don't actually handle the response, allowing the app to timeout.
			<-releaseHandler
		}))
		defer server.Close()
		defer close(releaseHandler)

		th.App.HTTPService().(*httpservice.HTTPServiceImpl).RequestTimeout = 500 * time.Millisecond
		defer func() {
			th.App.HTTPService().(*httpservice.HTTPServiceImpl).RequestTimeout = httpservice.RequestTimeout
		}()

		_, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.Error(t, err)
		require.IsType(t, &url.Error{}, err)
	})

	t.Run("without response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		}))
		defer server.Close()

		resp, err := th.App.doOutgoingWebhookRequest(server.URL, strings.NewReader(""), "application/json")
		require.NoError(t, err)
		require.Nil(t, resp)
	})
}
