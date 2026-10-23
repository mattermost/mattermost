// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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
	var types []model.BotEventType
	for _, e := range events {
		types = append(types, e.Type)
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

// botEventEnv is the fixture each production scenario runs against.
type botEventEnv struct {
	bot     *model.Bot
	botUser *model.User
	channel *model.Channel
	other   *model.User // a second subscribed bot in the channel, for scenarios where it acts
	message string
}

// newBotEventEnv sets up a subscribed bot and a channel of the given kind: "public"
// (default, with BasicUser and BasicUser2 as members), "dm" or "gm".
func newBotEventEnv(t *testing.T, th *TestHelper, kind string, botIsMember bool) *botEventEnv {
	t.Helper()

	env := &botEventEnv{}
	switch kind {
	case "dm":
		env.bot, env.botUser = addTestBot(t, th)
		env.channel = th.CreateDmChannel(t, env.botUser)
	case "gm":
		env.bot, env.botUser = addTestBot(t, th)
		env.channel = th.CreateGroupChannel(t, env.botUser, th.BasicUser2)
	default:
		env.channel = th.CreateChannel(t, th.BasicTeam)
		th.AddUserToChannel(t, th.BasicUser2, env.channel)
		if botIsMember {
			env.bot, env.botUser = addTestBot(t, th, env.channel)
		} else {
			env.bot, env.botUser = addTestBot(t, th)
		}
	}
	return env
}

func (e *botEventEnv) authorID(t *testing.T, th *TestHelper, author string) string {
	t.Helper()

	switch author {
	case "self":
		return e.botUser.Id
	case "other_bot":
		if e.other == nil {
			_, e.other = addTestBot(t, th, e.channel)
		}
		return e.other.Id
	default:
		return th.BasicUser.Id
	}
}

func TestBotPostEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	ignoreChannelMentions := func(t *testing.T, th *TestHelper, env *botEventEnv) {
		_, appErr := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsOn}, env.channel.Id, env.botUser.Id)
		require.Nil(t, appErr)
		require.Nil(t, th.App.Srv().InvalidateAllCaches())
	}
	setSubscription := func(enabled bool, reason string) func(*testing.T, *TestHelper, *botEventEnv) {
		return func(t *testing.T, th *TestHelper, env *botEventEnv) {
			require.NoError(t, th.App.Srv().Store().BotEventSubscription().SetEnabled(th.Context, env.bot.UserId, enabled, reason, model.GetMillis()))
		}
	}

	tests := []struct {
		name      string
		kind      string // "public" (default), "dm" or "gm"
		notMember bool
		author    string // "" is a human, "self" the bot, "other_bot" a second bot
		message   string // %s is the bot's username; defaults to a mention
		postOpts  []PostOptions
		prepare   func(t *testing.T, th *TestHelper, env *botEventEnv)
		act       func(t *testing.T, th *TestHelper, env *botEventEnv)
		want      []model.BotEventType
	}{
		{name: "direct message", kind: "dm", message: "hello", want: []model.BotEventType{model.BotEventTypePostDM}},
		{name: "direct message with a mention is still a dm", kind: "dm", want: []model.BotEventType{model.BotEventTypePostDM}},
		{name: "group message", kind: "gm", message: "hello group", want: []model.BotEventType{model.BotEventTypePostGM}},
		{name: "group message with a mention is a mention", kind: "gm", want: []model.BotEventType{model.BotEventTypePostMention}},
		{name: "mention by username", want: []model.BotEventType{model.BotEventTypePostMention}},
		{name: "unmentioned bot in a channel", message: "just chatting", want: nil},
		{name: "channel mention", message: "@channel attention", want: []model.BotEventType{model.BotEventTypePostMention}},
		{name: "all mention", message: "@all attention", want: []model.BotEventType{model.BotEventTypePostMention}},
		{name: "channel mention ignored by the bot", message: "@channel attention", prepare: ignoreChannelMentions, want: nil},
		{name: "all mention ignored by the bot", message: "@all attention", prepare: ignoreChannelMentions, want: nil},
		{
			name: "group mention",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				// The test license is dropped by earlier cache invalidations, so set it here.
				th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
				group := th.CreateGroup(t)
				group.AllowReference = true
				group, appErr := th.App.UpdateGroup(group)
				require.Nil(t, appErr)
				_, appErr = th.App.UpsertGroupMember(group.Id, env.bot.UserId)
				require.Nil(t, appErr)
				env.message = "calling @" + *group.Name
			},
			want: []model.BotEventType{model.BotEventTypePostMention},
		},
		{name: "post by another bot is ignored by default", author: "other_bot", want: nil},
		{
			name:    "post by another bot when not ignoring bot authors",
			author:  "other_bot",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) { subscribeTestBot(t, th, env.bot, new(false)) },
			want:    []model.BotEventType{model.BotEventTypePostMention},
		},
		{name: "the bot's own post", author: "self", want: nil},
		{
			name: "silent post",
			act: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				// The silent marker is only kept on posts by integrations, so set it directly.
				post := postAs(t, th, th.BasicUser.Id, env.channel, "nothing to see", "")
				post.Message = env.message
				post.AddProp(model.PostPropsSilentNotification, true)
				_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, env.channel, th.BasicUser, nil, false)
				require.NoError(t, err)
			},
			want: nil,
		},
		{name: "system message", postOpts: []PostOptions{func(p *model.Post) { p.Type = model.PostTypeJoinChannel }}, want: nil},
		{
			name:     "burn on read post",
			postOpts: []PostOptions{func(p *model.Post) { p.Type = model.PostTypeBurnOnRead }},
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.BurnOnRead = true })
				enableBoRFeature(th)
			},
			want: nil,
		},
		{name: "bot that is not a channel member", notMember: true, want: nil},
		{
			name: "deactivated bot",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				_, appErr := th.App.UpdateBotActive(th.Context, env.bot.UserId, false)
				require.Nil(t, appErr)
			},
			want: nil,
		},
		{
			name: "bot without a subscription",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				require.Nil(t, th.App.DeleteBotEventSubscription(th.Context, env.bot.UserId))
			},
			want: nil,
		},
		{name: "subscription disabled manually", prepare: setSubscription(false, model.BotEventDisabledReasonManual), want: nil},
		{
			name:    "subscription disabled by delivery failures keeps accumulating",
			prepare: setSubscription(false, model.BotEventDisabledReasonDeliveryFailures),
			want:    []model.BotEventType{model.BotEventTypePostMention},
		},
		{
			name: "archived channel",
			act: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				archived := env.channel.DeepCopy()
				archived.DeleteAt = model.GetMillis()
				post := &model.Post{Id: model.NewId(), UserId: th.BasicUser.Id, ChannelId: env.channel.Id, Message: env.message}
				_, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, archived, th.BasicUser, nil, false)
				require.NoError(t, err)
			},
			want: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env := newBotEventEnv(t, th, tc.kind, !tc.notMember)
			message := tc.message
			if message == "" {
				message = "hi @%s"
			}
			env.message = strings.ReplaceAll(message, "%s", env.bot.Username)

			author := env.authorID(t, th, tc.author)
			if tc.prepare != nil {
				tc.prepare(t, th, env)
			}

			if tc.act != nil {
				tc.act(t, th, env)
			} else {
				postAs(t, th, author, env.channel, env.message, "", tc.postOpts...)
			}

			assert.Equal(t, tc.want, botEventTypes(botEventsFor(t, th, env.bot.UserId)))
		})
	}
}

func TestBotPostEventPayload(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel post", func(t *testing.T) {
		env := newBotEventEnv(t, th, "public", true)

		post := postAs(t, th, th.BasicUser.Id, env.channel, "@"+env.bot.Username+" props", "", func(p *model.Post) {
			p.AddProp("custom", "kept")
			p.AddProp(model.PostPropsForceNotification, true)
		})

		events := botEventsFor(t, th, env.bot.UserId)
		require.Len(t, events, 1)
		assert.NotContains(t, string(events[0].Payload), "metadata")
		assert.NotContains(t, string(events[0].Payload), model.PostPropsForceNotification)

		data := botEventData(t, events[0])
		require.NotNil(t, data.Team)
		assert.Equal(t, &model.BotEventTeam{Id: th.BasicTeam.Id, Name: th.BasicTeam.Name}, data.Team)
		assert.Equal(t, &model.BotEventChannel{Id: env.channel.Id, Type: model.ChannelTypeOpen, Name: env.channel.Name, DisplayName: env.channel.DisplayName}, data.Channel)
		assert.Equal(t, &model.BotEventUser{Id: th.BasicUser.Id, Username: th.BasicUser.Username}, data.Sender)
		assert.Equal(t, post.Id, data.Post.Id)
		assert.Equal(t, "kept", data.Post.Props["custom"])
	})

	t.Run("direct message", func(t *testing.T) {
		env := newBotEventEnv(t, th, "dm", true)

		postAs(t, th, th.BasicUser.Id, env.channel, "hello", "")

		events := botEventsFor(t, th, env.bot.UserId)
		require.Len(t, events, 1)
		data := botEventData(t, events[0])
		assert.Nil(t, data.Team)
		assert.Equal(t, model.ChannelTypeDirect, data.Channel.Type)
		assert.Equal(t, "hello", data.Post.Message)
	})

	t.Run("sender that is a bot", func(t *testing.T) {
		env := newBotEventEnv(t, th, "public", true)
		subscribeTestBot(t, th, env.bot, new(false))

		postAs(t, th, env.authorID(t, th, "other_bot"), env.channel, "hi @"+env.bot.Username, "")

		events := botEventsFor(t, th, env.bot.UserId)
		require.Len(t, events, 1)
		assert.True(t, botEventData(t, events[0]).Sender.IsBot)
	})
}

func TestBotPostEventsAcrossPosts(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("only subscribed bots get events", func(t *testing.T) {
		env := newBotEventEnv(t, th, "public", true)
		_, other := addTestBot(t, th, env.channel)
		unsubscribed := th.CreateBot(t)
		unsubscribedUser, appErr := th.App.GetUser(th.Context, unsubscribed.UserId)
		require.Nil(t, appErr)
		th.LinkUserToTeam(t, unsubscribedUser, th.BasicTeam)
		th.AddUserToChannel(t, unsubscribedUser, env.channel)

		postAs(t, th, th.BasicUser.Id, env.channel, fmt.Sprintf("@%s @%s @%s", env.bot.Username, other.Username, unsubscribed.Username), "")

		assert.Len(t, botEventsFor(t, th, env.bot.UserId), 1)
		assert.Len(t, botEventsFor(t, th, other.Id), 1)
		assert.Empty(t, botEventsFor(t, th, unsubscribed.UserId))
	})

	t.Run("one event per bot and post in a dm thread", func(t *testing.T) {
		env := newBotEventEnv(t, th, "dm", true)

		root := postAs(t, th, th.BasicUser.Id, env.channel, "root", "")
		postAs(t, th, th.BasicUser.Id, env.channel, "reply", root.Id)
		postAs(t, th, th.BasicUser.Id, env.channel, "reply @"+env.bot.Username, root.Id)

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostDM, model.BotEventTypePostDM, model.BotEventTypePostDM}, botEventTypes(botEventsFor(t, th, env.bot.UserId)))
	})

	t.Run("gm reply in a followed thread is one gm event", func(t *testing.T) {
		setThreadConfig(th, model.CollapsedThreadsDefaultOn, true)
		env := newBotEventEnv(t, th, "gm", true)

		root := postAs(t, th, env.botUser.Id, env.channel, "root by the bot", "")
		postAs(t, th, th.BasicUser.Id, env.channel, "reply", root.Id)

		assert.Equal(t, []model.BotEventType{model.BotEventTypePostGM}, botEventTypes(botEventsFor(t, th, env.bot.UserId)))
	})
}

func TestBotPostEventsThreads(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	reply := []model.BotEventType{model.BotEventTypePostThreadReply}
	ifAutoFollow := func(autoFollow bool, types []model.BotEventType) []model.BotEventType {
		if autoFollow {
			return types
		}
		return nil
	}

	scenarios := []struct {
		name string
		act  func(t *testing.T, env *botEventEnv)
		want func(autoFollow bool) []model.BotEventType
	}{
		{
			name: "bot that authored the root",
			act: func(t *testing.T, env *botEventEnv) {
				root := postAs(t, th, env.botUser.Id, env.channel, "root", "")
				postAs(t, th, th.BasicUser.Id, env.channel, "reply", root.Id)
			},
			want: func(autoFollow bool) []model.BotEventType { return ifAutoFollow(autoFollow, reply) },
		},
		{
			name: "bot that replied earlier",
			act: func(t *testing.T, env *botEventEnv) {
				root := postAs(t, th, th.BasicUser.Id, env.channel, "root", "")
				postAs(t, th, env.botUser.Id, env.channel, "bot reply", root.Id)
				postAs(t, th, th.BasicUser2.Id, env.channel, "later reply", root.Id)
			},
			want: func(autoFollow bool) []model.BotEventType { return ifAutoFollow(autoFollow, reply) },
		},
		{
			name: "bot that followed explicitly",
			act: func(t *testing.T, env *botEventEnv) {
				root := postAs(t, th, th.BasicUser.Id, env.channel, "root", "")
				require.Nil(t, th.App.UpdateThreadFollowForUser(env.botUser.Id, th.BasicTeam.Id, root.Id, true))
				postAs(t, th, th.BasicUser2.Id, env.channel, "reply", root.Id)
			},
			want: func(bool) []model.BotEventType { return reply },
		},
		{
			name: "bot that unfollowed explicitly gets no further events",
			act: func(t *testing.T, env *botEventEnv) {
				root := postAs(t, th, env.botUser.Id, env.channel, "root", "")
				postAs(t, th, th.BasicUser.Id, env.channel, "first reply", root.Id)
				require.Nil(t, th.App.UpdateThreadFollowForUser(env.botUser.Id, th.BasicTeam.Id, root.Id, false))
				postAs(t, th, th.BasicUser.Id, env.channel, "second reply", root.Id)
			},
			want: func(autoFollow bool) []model.BotEventType { return ifAutoFollow(autoFollow, reply) },
		},
		{
			name: "bot mentioned in a reply",
			act: func(t *testing.T, env *botEventEnv) {
				root := postAs(t, th, th.BasicUser.Id, env.channel, "root", "")
				postAs(t, th, th.BasicUser2.Id, env.channel, "@"+env.bot.Username+" look", root.Id)
				postAs(t, th, th.BasicUser.Id, env.channel, "follow up", root.Id)
			},
			want: func(autoFollow bool) []model.BotEventType {
				if autoFollow {
					return []model.BotEventType{model.BotEventTypePostMention, model.BotEventTypePostThreadReply}
				}
				return []model.BotEventType{model.BotEventTypePostMention}
			},
		},
		{
			name: "channel that auto follows threads",
			act: func(t *testing.T, env *botEventEnv) {
				_, appErr := th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{model.ChannelAutoFollowThreads: model.ChannelAutoFollowThreadsOn}, env.channel.Id, env.botUser.Id)
				require.Nil(t, appErr)
				require.Nil(t, th.App.Srv().InvalidateAllCaches())

				root := postAs(t, th, th.BasicUser.Id, env.channel, "root", "")
				postAs(t, th, th.BasicUser2.Id, env.channel, "reply", root.Id)
			},
			want: func(autoFollow bool) []model.BotEventType { return ifAutoFollow(autoFollow, reply) },
		},
	}

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

			for _, sc := range scenarios {
				t.Run(sc.name, func(t *testing.T) {
					env := newBotEventEnv(t, th, "public", true)

					sc.act(t, env)

					assert.Equal(t, sc.want(cfg.autoFollow), botEventTypes(botEventsFor(t, th, env.bot.UserId)))
				})
			}
		})
	}
}

func TestBotReactionEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	added, removed := model.BotEventTypeReactionAdded, model.BotEventTypeReactionRemoved

	tests := []struct {
		name    string
		kind    string // "public" (default) or "dm"
		postBy  string // "bot" or, by default, a human
		reactor string // "" is a human, "self" the bot, "other_bot" a second bot
		ops     []string
		prepare func(t *testing.T, th *TestHelper, env *botEventEnv)
		want    []model.BotEventType
	}{
		{name: "added on the bot's post", postBy: "bot", want: []model.BotEventType{added}},
		{name: "added and removed", postBy: "bot", ops: []string{"add", "remove"}, want: []model.BotEventType{added, removed}},
		{name: "removing a missing reaction still emits an event", postBy: "bot", ops: []string{"remove"}, want: []model.BotEventType{removed}},
		{name: "reaction by the bot itself", postBy: "bot", reactor: "self", want: nil},
		{
			name:   "bot that left the channel",
			postBy: "bot",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				_ = th.RemoveUserFromChannel(t, env.botUser, env.channel)
			},
			want: nil,
		},
		{name: "human post in a dm with the bot", kind: "dm", want: []model.BotEventType{added}},
		{
			name:   "disabled subscription",
			postBy: "bot",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) {
				require.NoError(t, th.App.Srv().Store().BotEventSubscription().SetEnabled(th.Context, env.bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
			},
			want: nil,
		},
		{name: "reaction by another bot is ignored by default", postBy: "bot", reactor: "other_bot", want: nil},
		{
			name:    "reaction by another bot when not ignoring bot authors",
			postBy:  "bot",
			reactor: "other_bot",
			prepare: func(t *testing.T, th *TestHelper, env *botEventEnv) { subscribeTestBot(t, th, env.bot, new(false)) },
			want:    []model.BotEventType{added},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env := newBotEventEnv(t, th, tc.kind, true)
			authorID := th.BasicUser.Id
			if tc.postBy == "bot" {
				authorID = env.botUser.Id
			}
			post := postAs(t, th, authorID, env.channel, "a post", "")
			reactorID := env.authorID(t, th, tc.reactor)
			if tc.prepare != nil {
				tc.prepare(t, th, env)
			}

			ops := tc.ops
			if len(ops) == 0 {
				ops = []string{"add"}
			}
			for _, op := range ops {
				reaction := &model.Reaction{UserId: reactorID, PostId: post.Id, EmojiName: "smile"}
				if op == "add" {
					_, appErr := th.App.SaveReactionForPost(th.Context, reaction)
					require.Nil(t, appErr)
				} else {
					require.Nil(t, th.App.DeleteReactionForPost(th.Context, reaction))
				}
			}

			var got []model.BotEventType
			for _, e := range botEventsFor(t, th, env.bot.UserId) {
				if e.Type == added || e.Type == removed {
					got = append(got, e.Type)
				}
			}
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestBotReactionEventPayload(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	env := newBotEventEnv(t, th, "public", true)
	post := postAs(t, th, env.botUser.Id, env.channel, "bot post", "")

	reaction, appErr := th.App.SaveReactionForPost(th.Context, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"})
	require.Nil(t, appErr)
	require.Nil(t, th.App.DeleteReactionForPost(th.Context, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}))

	events := botEventsFor(t, th, env.bot.UserId)
	require.Len(t, events, 2)

	data := botEventData(t, events[0])
	assert.Equal(t, th.BasicUser.Id, data.Sender.Id)
	assert.Equal(t, &model.BotEventPost{Id: post.Id, UserId: env.botUser.Id}, data.Post, "reactions carry a post summary only")
	assert.Equal(t, &model.BotEventReaction{EmojiName: "smile", UserId: th.BasicUser.Id, PostId: post.Id, CreateAt: reaction.CreateAt}, data.Reaction)
	assert.Equal(t, th.BasicTeam.Id, data.Team.Id)

	assert.InDelta(t, model.GetMillis(), botEventData(t, events[1]).Reaction.CreateAt, 10000, "removals are stamped when processed")
}

func TestBotReactionEventsInGroupMessages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	bot1, bot1User := addTestBot(t, th)
	bot2, bot2User := addTestBot(t, th)
	gm := th.CreateGroupChannel(t, bot1User, bot2User)
	post := postAs(t, th, th.BasicUser.Id, gm, "hello", "")
	count := func(botID string) int { return len(botEventsFor(t, th, botID)) }
	before1, before2 := count(bot1.UserId), count(bot2.UserId)

	react := func(userID string) {
		_, appErr := th.App.SaveReactionForPost(th.Context, &model.Reaction{UserId: userID, PostId: post.Id, EmojiName: "smile"})
		require.Nil(t, appErr)
	}

	react(th.BasicUser.Id)
	assert.Equal(t, before1+1, count(bot1.UserId), "every subscribed bot in the gm is notified")
	assert.Equal(t, before2+1, count(bot2.UserId))

	react(bot1User.Id)
	assert.Equal(t, before1+1, count(bot1.UserId), "no event for the bot that reacted")
	assert.Equal(t, before2+1, count(bot2.UserId), "ignore_bot_authors skips reactions by other bots")
}

func TestBotReactionEventsSkipBurnOnReadPosts(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	env := newBotEventEnv(t, th, "public", true)
	post := postAs(t, th, env.botUser.Id, env.channel, "bot post", "")
	borPost := post.Clone()
	borPost.Type = model.PostTypeBurnOnRead

	th.App.enqueueBotReactionEvents(th.Context, model.BotEventTypeReactionAdded, &model.Reaction{UserId: th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}, borPost, env.channel)

	assert.Empty(t, botEventsFor(t, th, env.bot.UserId))
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
