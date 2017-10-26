// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateWebhookPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	utils.SetDefaultRolesBasedOnConfig()

	hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteIncomingWebhook(hook.Id)

	post, err := th.App.CreateWebhookPost(hook.UserId, th.BasicChannel, "foo", "user", "http://iconurl", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			{
				Text: "text",
			},
		},
	}, model.POST_SLACK_ATTACHMENT)
	if err != nil {
		t.Fatal(err.Error())
	}

	for _, k := range []string{"from_webhook", "attachments"} {
		if _, ok := post.Props[k]; !ok {
			t.Fatal(k)
		}
	}

	_, err = th.App.CreateWebhookPost(hook.UserId, th.BasicChannel, "foo", "user", "http://iconurl", nil, model.POST_SYSTEM_GENERIC)
	if err == nil {
		t.Fatal("should have failed - bad post type")
	}
}

func TestSplitWebhookPost(t *testing.T) {
	type TestCase struct {
		Post     *model.Post
		Expected []*model.Post
	}

	for name, tc := range map[string]TestCase{
		"LongPost": {
			Post: &model.Post{
				Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES*3/2),
			},
			Expected: []*model.Post{
				{
					Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES),
				},
				{
					Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES/2),
				},
			},
		},
		"LongPostAndMultipleAttachments": {
			Post: &model.Post{
				Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES*3/2),
				Props: map[string]interface{}{
					"attachments": []*model.SlackAttachment{
						&model.SlackAttachment{
							Text: strings.Repeat("本", 1000),
						},
						&model.SlackAttachment{
							Text: strings.Repeat("本", 2000),
						},
						&model.SlackAttachment{
							Text: strings.Repeat("本", model.POST_PROPS_MAX_USER_RUNES-1000),
						},
					},
				},
			},
			Expected: []*model.Post{
				{
					Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES),
				},
				{
					Message: strings.Repeat("本", model.POST_MESSAGE_MAX_RUNES/2),
					Props: map[string]interface{}{
						"attachments": []*model.SlackAttachment{
							&model.SlackAttachment{
								Text: strings.Repeat("本", 1000),
							},
							&model.SlackAttachment{
								Text: strings.Repeat("本", 2000),
							},
						},
					},
				},
				{
					Props: map[string]interface{}{
						"attachments": []*model.SlackAttachment{
							&model.SlackAttachment{
								Text: strings.Repeat("本", model.POST_PROPS_MAX_USER_RUNES-1000),
							},
						},
					},
				},
			},
		},
		"UnsplittableProps": {
			Post: &model.Post{
				Message: "foo",
				Props: map[string]interface{}{
					"foo": strings.Repeat("x", model.POST_PROPS_MAX_USER_RUNES*2),
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			splits, err := SplitWebhookPost(tc.Post)
			if tc.Expected == nil {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
			assert.Equal(t, len(tc.Expected), len(splits))
			for i, split := range splits {
				if i < len(tc.Expected) {
					assert.Equal(t, tc.Expected[i].Message, split.Message)
					assert.Equal(t, tc.Expected[i].Props["attachments"], split.Props["attachments"])
				}
			}
		})
	}
}
