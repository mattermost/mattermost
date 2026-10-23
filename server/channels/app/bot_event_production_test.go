// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// addTestBot creates a bot in the basic team and the given channels, and subscribes it in pull mode.
func addTestBot(t *testing.T, th *TestHelper, channels ...*model.Channel) (*model.Bot, *model.User) {
	t.Helper()

	bot := th.CreateBot(t)
	user, appErr := th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)

	th.LinkUserToTeam(t, user, th.BasicTeam)
	for _, channel := range channels {
		th.AddUserToChannel(t, user, channel)
	}

	subscribeTestBot(t, th, bot, nil)
	return bot, user
}

func subscribeTestBot(t *testing.T, th *TestHelper, bot *model.Bot, ignoreBotAuthors *bool) *model.BotEventSubscription {
	t.Helper()

	sub, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{
		Mode:             new(model.BotEventSubscriptionModePull),
		IgnoreBotAuthors: ignoreBotAuthors,
	})
	require.Nil(t, appErr)
	return sub
}

func botEventsFor(t *testing.T, th *TestHelper, botID string) []*model.BotEvent {
	t.Helper()

	events, err := th.App.Srv().Store().BotEvent().GetAfterCursor(th.Context, botID, model.BotEventCursor{}, 0, model.BotEventsMaxLimit)
	require.NoError(t, err)
	return events
}

func botEventTypes(events []*model.BotEvent) []model.BotEventType {
	types := make([]model.BotEventType, len(events))
	for i, e := range events {
		types[i] = e.Type
	}
	return types
}

func botEventData(t *testing.T, e *model.BotEvent) *model.BotEventData {
	t.Helper()

	var data model.BotEventData
	require.NoError(t, json.Unmarshal(e.Payload, &data))
	return &data
}

func postAs(t *testing.T, th *TestHelper, userID string, channel *model.Channel, message, rootID string, opts ...PostOptions) *model.Post {
	t.Helper()

	post := &model.Post{UserId: userID, ChannelId: channel.Id, RootId: rootID, Message: message}
	for _, opt := range opts {
		opt(post)
	}
	created, _, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	return created
}

func setThreadConfig(th *TestHelper, collapsedThreads string, autoFollow bool) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.CollapsedThreads = &collapsedThreads
		cfg.ServiceSettings.ThreadAutoFollow = &autoFollow
	})
}

func TestClassifyBotPostEvent(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name        string
		channelType model.ChannelType
		mt          MentionType
		mentioned   bool
		isFollower  bool
		want        model.BotEventType
		wantOK      bool
	}{
		{"dm", model.ChannelTypeDirect, DMMention, true, false, model.BotEventTypePostDM, true},
		{"dm without a mention", model.ChannelTypeDirect, NoMention, false, false, model.BotEventTypePostDM, true},
		{"dm with a keyword mention", model.ChannelTypeDirect, KeywordMention, true, false, model.BotEventTypePostDM, true},
		{"dm reply in a followed thread", model.ChannelTypeDirect, NoMention, false, true, model.BotEventTypePostDM, true},
		{"gm", model.ChannelTypeGroup, GMMention, true, false, model.BotEventTypePostGM, true},
		{"gm without a mention", model.ChannelTypeGroup, NoMention, false, false, model.BotEventTypePostGM, true},
		{"gm with a keyword mention", model.ChannelTypeGroup, KeywordMention, true, false, model.BotEventTypePostMention, true},
		{"gm with a group mention", model.ChannelTypeGroup, GroupMention, true, false, model.BotEventTypePostMention, true},
		{"gm with a thread mention is still a gm", model.ChannelTypeGroup, ThreadMention, true, false, model.BotEventTypePostGM, true},
		{"gm with a comment mention is still a gm", model.ChannelTypeGroup, CommentMention, true, false, model.BotEventTypePostGM, true},
		{"gm reply with a follower", model.ChannelTypeGroup, NoMention, false, true, model.BotEventTypePostGM, true},
		{"open keyword mention", model.ChannelTypeOpen, KeywordMention, true, false, model.BotEventTypePostMention, true},
		{"private channel mention", model.ChannelTypePrivate, ChannelMention, true, false, model.BotEventTypePostMention, true},
		{"group mention", model.ChannelTypeOpen, GroupMention, true, false, model.BotEventTypePostMention, true},
		{"mention in a followed thread", model.ChannelTypeOpen, KeywordMention, true, true, model.BotEventTypePostMention, true},
		{"thread mention only", model.ChannelTypeOpen, ThreadMention, true, false, "", false},
		{"comment mention only", model.ChannelTypeOpen, CommentMention, true, false, "", false},
		{"gm mention type outside a gm", model.ChannelTypeOpen, GMMention, true, false, "", false},
		{"follower without a mention", model.ChannelTypeOpen, NoMention, false, true, model.BotEventTypePostThreadReply, true},
		{"follower with a thread mention", model.ChannelTypeOpen, ThreadMention, true, true, model.BotEventTypePostThreadReply, true},
		{"nothing", model.ChannelTypeOpen, NoMention, false, false, "", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := classifyBotPostEvent(tc.channelType, tc.mt, tc.mentioned, tc.isFollower)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestBotEventPostCandidates(t *testing.T) {
	mainHelper.Parallel(t)

	human := &model.User{Id: "human1"}
	bot1 := &model.User{Id: "bot1", IsBot: true}
	bot2 := &model.User{Id: "bot2", IsBot: true}

	assert.Empty(t, botEventPostCandidates(map[string]*model.User{"human1": human}, "human1"))
	assert.Empty(t, botEventPostCandidates(map[string]*model.User{"bot1": bot1}, "bot1"), "the author is not a candidate")
	assert.Empty(t, botEventPostCandidates(nil, "x"))
	assert.ElementsMatch(t, []string{"bot1", "bot2"}, botEventPostCandidates(map[string]*model.User{"human1": human, "bot1": bot1, "bot2": bot2}, "human1"))
	assert.ElementsMatch(t, []string{"bot2"}, botEventPostCandidates(map[string]*model.User{"human1": human, "bot1": bot1, "bot2": bot2}, "bot1"))
}

func TestBotPostEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	newChannel := func(t *testing.T) *model.Channel {
		channel := th.CreateChannel(t, th.BasicTeam)
		th.AddUserToChannel(t, th.BasicUser2, channel)
		return channel
	}

	t.Run("direct message", func(t *testing.T) {
		bot, botUser := addTestBot(t, th)
		dm := th.CreateDmChannel(t, botUser)

		post := postAs(t, th, th.BasicUser.Id, dm, "hello", "")

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 1)
		assert.Equal(t, model.BotEventTypePostDM, events[0].Type)

		data := botEventData(t, events[0])
		assert.Nil(t, data.Team)
		assert.Equal(t, dm.Id, data.Channel.Id)
		assert.Equal(t, model.ChannelTypeDirect, data.Channel.Type)
		assert.Equal(t, th.BasicUser.Id, data.Sender.Id)
		assert.False(t, data.Sender.IsBot)
		assert.Equal(t, post.Id, data.Post.Id)
		assert.Equal(t, "hello", data.Post.Message)
	})

	t.Run("group message", func(t *testing.T) {
		bot, botUser := addTestBot(t, th)
		gm := th.CreateGroupChannel(t, botUser, th.BasicUser2)

		postAs(t, th, th.BasicUser.Id, gm, "hello group", "")

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 1)
		assert.Equal(t, model.BotEventTypePostGM, events[0].Type)
		assert.Nil(t, botEventData(t, events[0]).Team)
	})

	t.Run("group message with a mention is a mention", func(t *testing.T) {
		bot, botUser := addTestBot(t, th)
		gm := th.CreateGroupChannel(t, botUser, th.BasicUser2)

		postAs(t, th, th.BasicUser.Id, gm, "hey @"+bot.Username, "")

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostMention}, botEventTypes(botEventsFor(t, th, bot.UserId)))
	})

	t.Run("mention by username", func(t *testing.T) {
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)

		post := postAs(t, th, th.BasicUser.Id, channel, "hi @"+bot.Username, "")

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 1)
		assert.Equal(t, model.BotEventTypePostMention, events[0].Type)

		data := botEventData(t, events[0])
		require.NotNil(t, data.Team)
		assert.Equal(t, th.BasicTeam.Id, data.Team.Id)
		assert.Equal(t, th.BasicTeam.Name, data.Team.Name)
		assert.Equal(t, channel.Id, data.Channel.Id)
		assert.Equal(t, channel.DisplayName, data.Channel.DisplayName)
		assert.Equal(t, model.ChannelTypeOpen, data.Channel.Type)
		assert.Equal(t, post.Id, data.Post.Id)
		assert.Equal(t, th.BasicUser.Username, data.Sender.Username)
	})

	t.Run("channel and all mentions", func(t *testing.T) {
		for _, mention := range []string{"@channel", "@all"} {
			channel := newChannel(t)
			bot, botUser := addTestBot(t, th, channel)

			postAs(t, th, th.BasicUser.Id, channel, mention+" attention", "")
			assert.Equal(t, []model.BotEventType{model.BotEventTypePostMention}, botEventTypes(botEventsFor(t, th, bot.UserId)), mention)

			_, appErr := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsOn}, channel.Id, botUser.Id)
			require.Nil(t, appErr)
			require.Nil(t, th.App.Srv().InvalidateAllCaches())

			postAs(t, th, th.BasicUser.Id, channel, mention+" again", "")
			assert.Len(t, botEventsFor(t, th, bot.UserId), 1, "%s is ignored when the bot ignores channel mentions", mention)
		}
	})

	t.Run("group mention", func(t *testing.T) {
		// Invalidating caches in earlier subtests drops the test license.
		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)

		group := th.CreateGroup(t)
		group.AllowReference = true
		group, appErr := th.App.UpdateGroup(group)
		require.Nil(t, appErr)
		_, appErr = th.App.UpsertGroupMember(group.Id, bot.UserId)
		require.Nil(t, appErr)

		postAs(t, th, th.BasicUser.Id, channel, "calling @"+*group.Name, "")

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostMention}, botEventTypes(botEventsFor(t, th, bot.UserId)))
	})

	t.Run("unmentioned bot in a channel gets nothing", func(t *testing.T) {
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)

		postAs(t, th, th.BasicUser.Id, channel, "just chatting", "")

		assert.Empty(t, botEventsFor(t, th, bot.UserId))
	})

	t.Run("payload excludes metadata and notification policy props", func(t *testing.T) {
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)

		postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" props", "", func(p *model.Post) {
			p.AddProp("custom", "kept")
			p.AddProp(model.PostPropsForceNotification, true)
		})

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 1)
		assert.NotContains(t, string(events[0].Payload), "metadata")
		assert.NotContains(t, string(events[0].Payload), model.PostPropsForceNotification)
		assert.Equal(t, "kept", botEventData(t, events[0]).Post.Props["custom"])
	})

	t.Run("post by another bot", func(t *testing.T) {
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)
		other, otherUser := addTestBot(t, th, channel)
		_ = other

		postAs(t, th, otherUser.Id, channel, "hi @"+bot.Username, "")
		assert.Empty(t, botEventsFor(t, th, bot.UserId), "ignore_bot_authors defaults to true")

		subscribeTestBot(t, th, bot, new(false))
		postAs(t, th, otherUser.Id, channel, "hi again @"+bot.Username, "")

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 1)
		assert.True(t, botEventData(t, events[0]).Sender.IsBot)
	})

	t.Run("exclusions", func(t *testing.T) {
		t.Run("the bot's own post", func(t *testing.T) {
			channel := newChannel(t)
			bot, botUser := addTestBot(t, th, channel)

			postAs(t, th, botUser.Id, channel, "@"+bot.Username+" talking to myself", "")

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("silent post", func(t *testing.T) {
			channel := newChannel(t)
			bot, _ := addTestBot(t, th, channel)

			// The silent marker is only kept on posts by integrations, so set it directly.
			post := postAs(t, th, th.BasicUser.Id, channel, "nothing to see", "")
			post.Message = "@" + bot.Username + " shh"
			post.AddProp(model.PostPropsSilentNotification, true)
			_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, channel, th.BasicUser, nil, false)
			require.NoError(t, err)

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("system message", func(t *testing.T) {
			channel := newChannel(t)
			bot, _ := addTestBot(t, th, channel)

			postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" joined", "", func(p *model.Post) {
				p.Type = model.PostTypeJoinChannel
			})

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("burn on read post", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.BurnOnRead = true })
			enableBoRFeature(th)
			channel := newChannel(t)
			bot, _ := addTestBot(t, th, channel)

			postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" secret", "", func(p *model.Post) {
				p.Type = model.PostTypeBurnOnRead
			})

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("bot that is not a channel member", func(t *testing.T) {
			channel := newChannel(t)
			bot, _ := addTestBot(t, th)

			postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" are you there", "")

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("deactivated bot", func(t *testing.T) {
			channel := newChannel(t)
			bot, _ := addTestBot(t, th, channel)
			_, appErr := th.App.UpdateBotActive(th.Context, bot.UserId, false)
			require.Nil(t, appErr)

			postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" hello", "")

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("bot without a subscription", func(t *testing.T) {
			channel := newChannel(t)
			bot := th.CreateBot(t)
			botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
			require.Nil(t, appErr)
			th.LinkUserToTeam(t, botUser, th.BasicTeam)
			th.AddUserToChannel(t, botUser, channel)

			postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" hello", "")

			assert.Empty(t, botEventsFor(t, th, bot.UserId))
		})

		t.Run("archived channel", func(t *testing.T) {
			channel := newChannel(t)
			bot, _ := addTestBot(t, th, channel)
			post := postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" before archive", "")
			require.Len(t, botEventsFor(t, th, bot.UserId), 1)

			archived := channel.DeepCopy()
			archived.DeleteAt = model.GetMillis()
			_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, archived, th.BasicUser, nil, false)
			require.NoError(t, err)

			assert.Len(t, botEventsFor(t, th, bot.UserId), 1)
		})
	})

	t.Run("disabled subscriptions", func(t *testing.T) {
		channel := newChannel(t)
		bot, _ := addTestBot(t, th, channel)
		subs := th.App.Srv().Store().BotEventSubscription()

		require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
		postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" manual", "")
		assert.Empty(t, botEventsFor(t, th, bot.UserId), "manually disabled subscriptions do not accumulate events")

		require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonDeliveryFailures, model.GetMillis()))
		postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" failing", "")
		assert.Len(t, botEventsFor(t, th, bot.UserId), 1, "events keep accumulating while delivery is failing")
	})

	t.Run("only subscribed bots get events", func(t *testing.T) {
		channel := newChannel(t)
		bot1, _ := addTestBot(t, th, channel)
		bot2, _ := addTestBot(t, th, channel)

		postAs(t, th, th.BasicUser.Id, channel, fmt.Sprintf("@%s and @%s", bot1.Username, bot2.Username), "")

		assert.Len(t, botEventsFor(t, th, bot1.UserId), 1)
		assert.Len(t, botEventsFor(t, th, bot2.UserId), 1)
	})

	t.Run("one event per bot and post", func(t *testing.T) {
		bot, botUser := addTestBot(t, th)
		dm := th.CreateDmChannel(t, botUser)

		root := postAs(t, th, th.BasicUser.Id, dm, "root", "")
		postAs(t, th, th.BasicUser.Id, dm, "reply", root.Id)
		postAs(t, th, th.BasicUser.Id, dm, "reply @"+bot.Username, root.Id)

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostDM, model.BotEventTypePostDM, model.BotEventTypePostDM}, botEventTypes(botEventsFor(t, th, bot.UserId)))
	})

	t.Run("gm reply in a followed thread is one gm event", func(t *testing.T) {
		setThreadConfig(th, model.CollapsedThreadsDefaultOn, true)
		bot, botUser := addTestBot(t, th)
		gm := th.CreateGroupChannel(t, botUser, th.BasicUser2)

		root := postAs(t, th, botUser.Id, gm, "root by the bot", "")
		postAs(t, th, th.BasicUser.Id, gm, "reply", root.Id)

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostGM}, botEventTypes(botEventsFor(t, th, bot.UserId)))
	})
}

func TestBotPostEventsThreads(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	configs := []struct {
		name             string
		collapsedThreads string
		autoFollow       bool
	}{
		{"crt disabled, autofollow on", model.CollapsedThreadsDisabled, true},
		{"crt disabled, autofollow off", model.CollapsedThreadsDisabled, false},
		{"crt default_on, autofollow on", model.CollapsedThreadsDefaultOn, true},
	}

	for _, cfg := range configs {
		t.Run(cfg.name, func(t *testing.T) {
			setThreadConfig(th, cfg.collapsedThreads, cfg.autoFollow)

			newThreadSetup := func(t *testing.T) (*model.Channel, *model.Bot, *model.User) {
				channel := th.CreateChannel(t, th.BasicTeam)
				th.AddUserToChannel(t, th.BasicUser2, channel)
				bot, botUser := addTestBot(t, th, channel)
				return channel, bot, botUser
			}

			t.Run("bot that authored the root", func(t *testing.T) {
				channel, bot, botUser := newThreadSetup(t)

				root := postAs(t, th, botUser.Id, channel, "root", "")
				postAs(t, th, th.BasicUser.Id, channel, "reply", root.Id)

				if cfg.autoFollow {
					assert.Equal(t, []model.BotEventType{model.BotEventTypePostThreadReply}, botEventTypes(botEventsFor(t, th, bot.UserId)))
				} else {
					assert.Empty(t, botEventsFor(t, th, bot.UserId))
				}
			})

			t.Run("bot that replied earlier", func(t *testing.T) {
				channel, bot, botUser := newThreadSetup(t)

				root := postAs(t, th, th.BasicUser.Id, channel, "root", "")
				postAs(t, th, botUser.Id, channel, "bot reply", root.Id)
				postAs(t, th, th.BasicUser2.Id, channel, "later reply", root.Id)

				if cfg.autoFollow {
					assert.Equal(t, []model.BotEventType{model.BotEventTypePostThreadReply}, botEventTypes(botEventsFor(t, th, bot.UserId)))
				} else {
					assert.Empty(t, botEventsFor(t, th, bot.UserId))
				}
			})

			t.Run("bot that followed explicitly", func(t *testing.T) {
				channel, bot, botUser := newThreadSetup(t)

				root := postAs(t, th, th.BasicUser.Id, channel, "root", "")
				require.Nil(t, th.App.UpdateThreadFollowForUser(botUser.Id, th.BasicTeam.Id, root.Id, true))
				postAs(t, th, th.BasicUser2.Id, channel, "reply", root.Id)

				assert.Equal(t, []model.BotEventType{model.BotEventTypePostThreadReply}, botEventTypes(botEventsFor(t, th, bot.UserId)))
			})

			t.Run("bot that unfollowed explicitly", func(t *testing.T) {
				channel, bot, botUser := newThreadSetup(t)

				root := postAs(t, th, botUser.Id, channel, "root", "")
				postAs(t, th, th.BasicUser.Id, channel, "first reply", root.Id)
				require.Nil(t, th.App.UpdateThreadFollowForUser(botUser.Id, th.BasicTeam.Id, root.Id, false))
				before := len(botEventsFor(t, th, bot.UserId))

				postAs(t, th, th.BasicUser.Id, channel, "second reply", root.Id)

				assert.Len(t, botEventsFor(t, th, bot.UserId), before)
			})

			t.Run("bot mentioned in a reply", func(t *testing.T) {
				channel, bot, _ := newThreadSetup(t)

				root := postAs(t, th, th.BasicUser.Id, channel, "root", "")
				postAs(t, th, th.BasicUser2.Id, channel, "@"+bot.Username+" look", root.Id)
				postAs(t, th, th.BasicUser.Id, channel, "follow up", root.Id)

				types := botEventTypes(botEventsFor(t, th, bot.UserId))
				if cfg.autoFollow {
					assert.Equal(t, []model.BotEventType{model.BotEventTypePostMention, model.BotEventTypePostThreadReply}, types)
				} else {
					assert.Equal(t, []model.BotEventType{model.BotEventTypePostMention}, types)
				}
			})

			t.Run("channel that auto follows threads", func(t *testing.T) {
				channel, bot, botUser := newThreadSetup(t)
				_, appErr := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{model.ChannelAutoFollowThreads: model.ChannelAutoFollowThreadsOn}, channel.Id, botUser.Id)
				require.Nil(t, appErr)
				require.Nil(t, th.App.Srv().InvalidateAllCaches())

				root := postAs(t, th, th.BasicUser.Id, channel, "root", "")
				postAs(t, th, th.BasicUser2.Id, channel, "reply", root.Id)

				if cfg.autoFollow {
					assert.Equal(t, []model.BotEventType{model.BotEventTypePostThreadReply}, botEventTypes(botEventsFor(t, th, bot.UserId)))
				} else {
					assert.Empty(t, botEventsFor(t, th, bot.UserId))
				}
			})
		})
	}
}

func TestBotReactionEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	newChannel := func(t *testing.T) *model.Channel {
		channel := th.CreateChannel(t, th.BasicTeam)
		th.AddUserToChannel(t, th.BasicUser2, channel)
		return channel
	}
	react := func(t *testing.T, userID string, post *model.Post) *model.Reaction {
		reaction, appErr := th.App.SaveReactionForPost(th.Context, &model.Reaction{UserId: userID, PostId: post.Id, EmojiName: "smile"})
		require.Nil(t, appErr)
		return reaction
	}

	t.Run("added and removed on the bot's post", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")

		added := react(t, th.BasicUser.Id, post)
		require.Nil(t, th.App.DeleteReactionForPost(th.Context, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}))

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 2)
		assert.Equal(t, model.BotEventTypeReactionAdded, events[0].Type)
		assert.Equal(t, model.BotEventTypeReactionRemoved, events[1].Type)

		data := botEventData(t, events[0])
		assert.Equal(t, th.BasicUser.Id, data.Sender.Id)
		assert.Equal(t, &model.BotEventPost{Id: post.Id, RootId: "", UserId: botUser.Id}, data.Post, "reactions carry a post summary only")
		require.NotNil(t, data.Reaction)
		assert.Equal(t, "smile", data.Reaction.EmojiName)
		assert.Equal(t, added.CreateAt, data.Reaction.CreateAt)
		assert.Equal(t, th.BasicTeam.Id, data.Team.Id)

		removed := botEventData(t, events[1])
		assert.InDelta(t, model.GetMillis(), removed.Reaction.CreateAt, 10000)
	})

	t.Run("reaction by the bot itself", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")

		react(t, botUser.Id, post)

		assert.Empty(t, botEventsFor(t, th, bot.UserId))
	})

	t.Run("bot that left the channel", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")
		_ = th.RemoveUserFromChannel(t, botUser, channel)

		react(t, th.BasicUser.Id, post)

		assert.Empty(t, botEventsFor(t, th, bot.UserId))
	})

	t.Run("human post in a dm with the bot", func(t *testing.T) {
		bot, botUser := addTestBot(t, th)
		dm := th.CreateDmChannel(t, botUser)
		post := postAs(t, th, th.BasicUser.Id, dm, "hi", "")

		react(t, th.BasicUser.Id, post)

		events := botEventsFor(t, th, bot.UserId)
		require.Len(t, events, 2, "the dm message and the reaction")
		assert.Equal(t, model.BotEventTypeReactionAdded, events[1].Type)
		assert.Nil(t, botEventData(t, events[1]).Team)
	})

	t.Run("human post in a gm reaches every subscribed bot but the reactor", func(t *testing.T) {
		bot1, bot1User := addTestBot(t, th)
		bot2, bot2User := addTestBot(t, th)
		gm := th.CreateGroupChannel(t, bot1User, bot2User)
		post := postAs(t, th, th.BasicUser.Id, gm, "hello", "")
		before1, before2 := len(botEventsFor(t, th, bot1.UserId)), len(botEventsFor(t, th, bot2.UserId))

		react(t, th.BasicUser.Id, post)

		assert.Len(t, botEventsFor(t, th, bot1.UserId), before1+1)
		assert.Len(t, botEventsFor(t, th, bot2.UserId), before2+1)
		assert.Equal(t, model.BotEventTypeReactionAdded, botEventsFor(t, th, bot1.UserId)[before1].Type)

		react(t, bot1User.Id, post)
		assert.Len(t, botEventsFor(t, th, bot1.UserId), before1+1, "no event for the bot that reacted")
		assert.Len(t, botEventsFor(t, th, bot2.UserId), before2+1, "ignore_bot_authors skips reactions by other bots")

		subscribeTestBot(t, th, bot2, new(false))
		require.Nil(t, th.App.DeleteReactionForPost(th.Context, &model.Reaction{UserId: bot1User.Id, PostId: post.Id, EmojiName: "smile"}))
		react(t, bot1User.Id, post)
		assert.Greater(t, len(botEventsFor(t, th, bot2.UserId)), before2+1)
	})

	t.Run("disabled subscription and no subscription", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")
		require.NoError(t, th.App.Srv().Store().BotEventSubscription().SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))

		react(t, th.BasicUser.Id, post)

		assert.Empty(t, botEventsFor(t, th, bot.UserId))
	})

	t.Run("burn on read post", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")
		borPost := post.Clone()
		borPost.Type = model.PostTypeBurnOnRead

		th.App.enqueueBotReactionEvents(th.Context, model.BotEventTypeReactionAdded, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}, borPost, channel)

		assert.Empty(t, botEventsFor(t, th, bot.UserId))
	})

	t.Run("removing a missing reaction still emits an event", func(t *testing.T) {
		channel := newChannel(t)
		bot, botUser := addTestBot(t, th, channel)
		post := postAs(t, th, botUser.Id, channel, "bot post", "")

		require.Nil(t, th.App.DeleteReactionForPost(th.Context, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}))

		assert.Equal(t, []model.BotEventType{model.BotEventTypeReactionRemoved}, botEventTypes(botEventsFor(t, th, bot.UserId)))
	})
}

type failingBotEventStore struct {
	store.BotEventStore
}

func (failingBotEventStore) Save(request.CTX, []*model.BotEvent) ([]*model.BotEvent, error) {
	return nil, errors.New("boom")
}

type failingBotEventsStore struct {
	store.Store
}

func (s failingBotEventsStore) BotEvent() store.BotEventStore {
	return failingBotEventStore{s.Store.BotEvent()}
}

func TestBotEventProductionDoesNotBreakPosting(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.CreateChannel(t, th.BasicTeam)
	bot, botUser := addTestBot(t, th, channel)
	botPost := postAs(t, th, botUser.Id, channel, "bot post", "")

	original := th.App.Srv().Store()
	th.App.Srv().SetStore(failingBotEventsStore{original})
	t.Cleanup(func() { th.App.Srv().SetStore(original) })

	post := postAs(t, th, th.BasicUser.Id, channel, "@"+bot.Username+" hello", "")
	assert.NotEmpty(t, post.Id)

	_, appErr := th.App.SaveReactionForPost(th.Context, &model.Reaction{UserId: th.BasicUser.Id, PostId: botPost.Id, EmojiName: "smile"})
	require.Nil(t, appErr)

	th.App.Srv().SetStore(original)
	assert.Empty(t, botEventsFor(t, th, bot.UserId))
}

func TestBotEventProductionSkipsStoreWithoutBots(t *testing.T) {
	th := SetupWithStoreMock(t)

	// The mock store has no expectation for BotEventSubscription, so any lookup fails the test.
	profileMap := map[string]*model.User{"u1": {Id: "u1"}, "u2": {Id: "u2"}}
	post := &model.Post{Id: model.NewId(), UserId: "u1", ChannelId: model.NewId(), Message: "hi"}
	channel := &model.Channel{Id: post.ChannelId, Type: model.ChannelTypeOpen}

	th.App.enqueueBotPostEvents(th.Context, post, &model.Team{}, channel, profileMap["u1"], profileMap, &MentionResults{}, model.StringSet{}, true)
}

func BenchmarkEnqueueBotPostEventsNoBots(b *testing.B) {
	th := SetupWithStoreMock(b)

	profileMap := make(map[string]*model.User, 10000)
	for i := range 10000 {
		id := fmt.Sprintf("user%d", i)
		profileMap[id] = &model.User{Id: id}
	}
	post := &model.Post{Id: model.NewId(), UserId: "user0", ChannelId: model.NewId(), Message: "hi"}
	channel := &model.Channel{Id: post.ChannelId, Type: model.ChannelTypeOpen}
	mentions := &MentionResults{}
	followers := model.StringSet{}

	b.ResetTimer()
	for b.Loop() {
		th.App.enqueueBotPostEvents(th.Context, post, &model.Team{}, channel, profileMap["user0"], profileMap, mentions, followers, true)
	}
}
