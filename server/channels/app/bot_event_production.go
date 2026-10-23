// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// botEventPostCandidates returns the bots in the channel other than the post's author.
func botEventPostCandidates(profileMap map[string]*model.User, authorID string) []string {
	var candidates []string
	for id, profile := range profileMap {
		if profile.IsBot && id != authorID {
			candidates = append(candidates, id)
		}
	}
	return candidates
}

// classifyBotPostEvent picks one event type per bot and post, in the order
// post_dm > post_mention > post_gm > post_thread_reply. It must use the channel
// type rather than the mention type: the mention map keeps only the highest-priority
// mention per user, and thread and comment mentions outrank GM mentions.
func classifyBotPostEvent(channelType model.ChannelType, mt MentionType, mentioned, isFollower bool) (model.BotEventType, bool) {
	switch {
	case channelType == model.ChannelTypeDirect:
		return model.BotEventTypePostDM, true
	case mentioned && (mt == KeywordMention || mt == ChannelMention || mt == GroupMention):
		return model.BotEventTypePostMention, true
	case channelType == model.ChannelTypeGroup:
		return model.BotEventTypePostGM, true
	case isFollower:
		return model.BotEventTypePostThreadReply, true
	}
	return "", false
}

// enqueueBotPostEvents writes outbox events for subscribed bots. It runs after thread
// auto-follow has finished, so a bot mentioned in a reply is already following, and
// followers can be read without locking. Failures are logged and never returned: event
// production must not affect post creation.
func (a *App) enqueueBotPostEvents(rctx request.CTX, post *model.Post, team *model.Team, channel *model.Channel,
	sender *model.User, profileMap map[string]*model.User, mentions *MentionResults,
	followers model.StringSet, followersLoaded bool) {
	if post.Type == model.PostTypeBurnOnRead || post.IsSystemMessage() {
		return
	}

	candidates := botEventPostCandidates(profileMap, post.UserId)
	if len(candidates) == 0 {
		return
	}

	subs, err := a.Srv().Store().BotEventSubscription().GetForBots(rctx, candidates)
	if err != nil {
		rctx.Logger().Warn("Failed to load bot event subscriptions", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	types := make(map[string]model.BotEventType, len(subs))
	var lookup []string
	for _, sub := range subs {
		if !sub.ShouldProduce() || (sub.IgnoreBotAuthors && sender.IsBot) {
			continue
		}

		mt, mentioned := mentions.Mentions[sub.BotUserId]
		isFollower := post.RootId != "" && followers.Has(sub.BotUserId)
		if t, ok := classifyBotPostEvent(channel.Type, mt, mentioned, isFollower); ok {
			types[sub.BotUserId] = t
		} else if post.RootId != "" && !followersLoaded {
			lookup = append(lookup, sub.BotUserId)
		}
	}

	// Without collapsed threads the follower set holds only the users that were just
	// auto-followed, so earlier followers have to be looked up one by one.
	for _, botID := range lookup {
		membership, memberErr := a.Srv().Store().Thread().GetMembershipForUser(botID, post.RootId)
		if memberErr != nil {
			if !store.IsErrNotFound(memberErr) {
				rctx.Logger().Warn("Failed to load thread membership for bot event", mlog.String("post_id", post.Id), mlog.String("bot_user_id", botID), mlog.Err(memberErr))
			}
			continue
		}
		if membership.Following {
			types[botID] = model.BotEventTypePostThreadReply
		}
	}

	if len(types) == 0 {
		return
	}

	payload, err := json.Marshal(&model.BotEventData{
		Team:    botEventTeam(team, channel),
		Channel: botEventChannel(channel),
		Sender:  botEventUser(sender),
		Post:    model.NewBotEventPost(post),
	})
	if err != nil {
		rctx.Logger().Warn("Failed to encode bot event", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	events := make([]*model.BotEvent, 0, len(types))
	for botID, t := range types {
		events = append(events, &model.BotEvent{BotUserId: botID, Type: t, Payload: payload})
	}
	a.saveBotEvents(rctx, events)
}

// enqueueBotReactionEvents writes reaction events for the post author and, in DMs and
// GMs, the other members, when they are subscribed bots.
func (a *App) enqueueBotReactionEvents(rctx request.CTX, eventType model.BotEventType, reaction *model.Reaction, post *model.Post, channel *model.Channel) {
	if post.Type == model.PostTypeBurnOnRead {
		return
	}

	// memberKnown holds candidates that are channel members by construction.
	candidates := map[string]struct{}{}
	memberKnown := map[string]struct{}{}
	add := func(id string, known bool) {
		if id == "" || id == reaction.UserId {
			return
		}
		candidates[id] = struct{}{}
		if known {
			memberKnown[id] = struct{}{}
		}
	}

	add(post.UserId, false)
	switch channel.Type {
	case model.ChannelTypeDirect:
		first, second := channel.GetBothUsersForDM()
		add(first, true)
		add(second, true)
	case model.ChannelTypeGroup:
		members, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
		if err != nil {
			rctx.Logger().Warn("Failed to load channel members for bot reaction event", mlog.String("channel_id", channel.Id), mlog.Err(err))
			return
		}
		for id := range members {
			add(id, true)
		}
	default:
	}
	if len(candidates) == 0 {
		return
	}

	ids := make([]string, 0, len(candidates))
	for id := range candidates {
		ids = append(ids, id)
	}
	users, err := a.Srv().Store().User().GetMany(rctx, ids)
	if err != nil {
		rctx.Logger().Warn("Failed to load users for bot reaction event", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	var botIDs []string
	for _, u := range users {
		if u.IsBot && u.DeleteAt == 0 {
			botIDs = append(botIDs, u.Id)
		}
	}
	if len(botIDs) == 0 {
		return
	}

	subs, err := a.Srv().Store().BotEventSubscription().GetForBots(rctx, botIDs)
	if err != nil {
		rctx.Logger().Warn("Failed to load bot event subscriptions", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	var producing []*model.BotEventSubscription
	for _, sub := range subs {
		if sub.ShouldProduce() {
			producing = append(producing, sub)
		}
	}
	if len(producing) == 0 {
		return
	}

	reactor, err := a.Srv().Store().User().Get(rctx, reaction.UserId)
	if err != nil {
		rctx.Logger().Warn("Failed to load reactor for bot reaction event", mlog.String("post_id", post.Id), mlog.String("user_id", reaction.UserId), mlog.Err(err))
		return
	}

	var recipients []string
	for _, sub := range producing {
		if sub.IgnoreBotAuthors && reactor.IsBot {
			continue
		}
		if _, known := memberKnown[sub.BotUserId]; !known {
			if _, memberErr := a.Srv().Store().Channel().GetMember(rctx, channel.Id, sub.BotUserId); memberErr != nil {
				if !store.IsErrNotFound(memberErr) {
					rctx.Logger().Warn("Failed to check bot channel membership for reaction event", mlog.String("bot_user_id", sub.BotUserId), mlog.Err(memberErr))
				}
				continue
			}
		}
		recipients = append(recipients, sub.BotUserId)
	}
	if len(recipients) == 0 {
		return
	}

	var team *model.Team
	if channel.TeamId != "" {
		if team, err = a.Srv().Store().Team().Get(channel.TeamId); err != nil {
			rctx.Logger().Warn("Failed to load team for bot reaction event", mlog.String("team_id", channel.TeamId), mlog.Err(err))
			team = nil
		}
	}

	createAt := reaction.CreateAt
	if eventType == model.BotEventTypeReactionRemoved {
		createAt = model.GetMillis()
	}

	payload, err := json.Marshal(&model.BotEventData{
		Team:    botEventTeam(team, channel),
		Channel: botEventChannel(channel),
		Sender:  botEventUser(reactor),
		Post:    &model.BotEventPost{Id: post.Id, RootId: post.RootId, UserId: post.UserId},
		Reaction: &model.BotEventReaction{
			EmojiName: reaction.EmojiName,
			UserId:    reaction.UserId,
			PostId:    reaction.PostId,
			CreateAt:  createAt,
		},
	})
	if err != nil {
		rctx.Logger().Warn("Failed to encode bot reaction event", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	events := make([]*model.BotEvent, 0, len(recipients))
	for _, botID := range recipients {
		events = append(events, &model.BotEvent{BotUserId: botID, Type: eventType, Payload: payload})
	}
	a.saveBotEvents(rctx, events)
}

// saveBotEvents writes synchronously so that a bot's events stay ordered across
// consecutive posts.
func (a *App) saveBotEvents(rctx request.CTX, events []*model.BotEvent) {
	botIDs := make([]string, 0, len(events))
	for _, e := range events {
		e.Id = model.NewId()
		botIDs = append(botIDs, e.BotUserId)
	}

	if _, err := a.Srv().Store().BotEvent().Save(rctx, events); err != nil {
		rctx.Logger().Warn("Failed to save bot events", mlog.Int("count", len(events)), mlog.Err(err))
		return
	}

	a.notifyBotEventsAvailable(botIDs)
}

func botEventTeam(team *model.Team, channel *model.Channel) *model.BotEventTeam {
	if team == nil || team.Id == "" || channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return nil
	}
	return &model.BotEventTeam{Id: team.Id, Name: team.Name}
}

func botEventChannel(channel *model.Channel) *model.BotEventChannel {
	return &model.BotEventChannel{Id: channel.Id, Type: channel.Type, Name: channel.Name, DisplayName: channel.DisplayName}
}

func botEventUser(user *model.User) *model.BotEventUser {
	return &model.BotEventUser{Id: user.Id, Username: user.Username, IsBot: user.IsBot}
}
