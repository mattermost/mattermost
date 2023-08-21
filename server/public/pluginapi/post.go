package pluginapi

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// PostService exposes methods to manipulate posts.
type PostService struct {
	api plugin.API
}

// CreatePost creates a post.
//
// Minimum server version: 5.2
func (p *PostService) CreatePost(post *model.Post) error {
	createdPost, appErr := p.api.CreatePost(post)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	err := createdPost.ShallowCopy(post)
	if err != nil {
		return err
	}

	return nil
}

// DM sends a post as a direct message
//
// Minimum server version: 5.2
func (p *PostService) DM(senderUserID, receiverUserID string, post *model.Post) error {
	channel, appErr := p.api.GetDirectChannel(senderUserID, receiverUserID)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}
	post.ChannelId = channel.Id
	post.UserId = senderUserID
	return p.CreatePost(post)
}

// GetPost gets a post.
//
// Minimum server version: 5.2
func (p *PostService) GetPost(postID string) (*model.Post, error) {
	post, appErr := p.api.GetPost(postID)

	return post, normalizeAppErr(appErr)
}

// UpdatePost updates a post.
//
// Minimum server version: 5.2
func (p *PostService) UpdatePost(post *model.Post) error {
	updatedPost, appErr := p.api.UpdatePost(post)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	err := updatedPost.ShallowCopy(post)
	if err != nil {
		return err
	}

	return nil
}

// DeletePost deletes a post.
//
// Minimum server version: 5.2
func (p *PostService) DeletePost(postID string) error {
	return normalizeAppErr(p.api.DeletePost(postID))
}

// SendEphemeralPost creates an ephemeral post.
//
// Minimum server version: 5.2
func (p *PostService) SendEphemeralPost(userID string, post *model.Post) {
	*post = *p.api.SendEphemeralPost(userID, post)
}

// UpdateEphemeralPost updates an ephemeral message previously sent to the user.
// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
//
// Minimum server version: 5.2
func (p *PostService) UpdateEphemeralPost(userID string, post *model.Post) {
	*post = *p.api.UpdateEphemeralPost(userID, post)
}

// DeleteEphemeralPost deletes an ephemeral message previously sent to the user.
// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
//
// Minimum server version: 5.2
func (p *PostService) DeleteEphemeralPost(userID, postID string) {
	p.api.DeleteEphemeralPost(userID, postID)
}

// GetPostThread gets a post with all the other posts in the same thread.
//
// Minimum server version: 5.6
func (p *PostService) GetPostThread(postID string) (*model.PostList, error) {
	postList, appErr := p.api.GetPostThread(postID)

	return postList, normalizeAppErr(appErr)
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsSince(channelID string, time int64) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsSince(channelID, time)

	return postList, normalizeAppErr(appErr)
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsAfter(channelID, postID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsAfter(channelID, postID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsBefore(channelID, postID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsBefore(channelID, postID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// GetPostsForChannel gets a list of posts for a channel.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsForChannel(channelID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsForChannel(channelID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// SearchPostsInTeam returns a list of posts in a specific team that match the given params.
//
// Minimum server version: 5.10
func (p *PostService) SearchPostsInTeam(teamID string, paramsList []*model.SearchParams) ([]*model.Post, error) {
	postList, appErr := p.api.SearchPostsInTeam(teamID, paramsList)

	return postList, normalizeAppErr(appErr)
}

// AddReaction add a reaction to a post.
//
// Minimum server version: 5.3
func (p *PostService) AddReaction(reaction *model.Reaction) error {
	addedReaction, appErr := p.api.AddReaction(reaction)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*reaction = *addedReaction

	return nil
}

// GetReactions get the reactions of a post.
//
// Minimum server version: 5.3
func (p *PostService) GetReactions(postID string) ([]*model.Reaction, error) {
	reactions, appErr := p.api.GetReactions(postID)

	return reactions, normalizeAppErr(appErr)
}

// RemoveReaction remove a reaction from a post.
//
// Minimum server version: 5.3
func (p *PostService) RemoveReaction(reaction *model.Reaction) error {
	return normalizeAppErr(p.api.RemoveReaction(reaction))
}

type ShouldProcessMessageOption func(*shouldProcessMessageOptions)

type shouldProcessMessageOptions struct {
	AllowSystemMessages bool
	AllowBots           bool
	AllowWebhook        bool
	FilterChannelIDs    []string
	FilterUserIDs       []string
	OnlyBotDMs          bool
	BotID               string
}

// AllowSystemMessages configures a call to ShouldProcessMessage to return true for system messages.
//
// As it is typically desirable only to consume messages from users of the system, ShouldProcessMessage ignores system messages by default.
func AllowSystemMessages() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowSystemMessages = true
	}
}

// AllowBots configures a call to ShouldProcessMessage to return true for bot posts.
//
// As it is typically desirable only to consume messages from human users of the system, ShouldProcessMessage ignores bot messages by default.
// When allowing bots, take care to avoid a loop where two plugins respond to each others posts repeatedly.
func AllowBots() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowBots = true
	}
}

// AllowWebhook configures a call to ShouldProcessMessage to return true for posts from webhook.
//
// As it is typically desirable only to consume messages from human users of the system, ShouldProcessMessage ignores webhook messages by default.
func AllowWebhook() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowWebhook = true
	}
}

// FilterChannelIDs configures a call to ShouldProcessMessage to return true only for the given channels.
//
// By default, posts from all channels are allowed to be processed.
func FilterChannelIDs(filterChannelIDs []string) ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.FilterChannelIDs = filterChannelIDs
	}
}

// FilterUserIDs configures a call to ShouldProcessMessage to return true only for the given users.
//
// By default, posts from all non-bot users are allowed.
func FilterUserIDs(filterUserIDs []string) ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.FilterUserIDs = filterUserIDs
	}
}

// OnlyBotDMs configures a call to ShouldProcessMessage to return true only for direct messages sent to the bot created by EnsureBot.
//
// By default, posts from all channels are allowed.
func OnlyBotDMs() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.OnlyBotDMs = true
	}
}

// If provided, BotID configures ShouldProcessMessage to skip its retrieval from the store.
//
// By default, posts from all non-bot users are allowed.
func BotID(botID string) ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.BotID = botID
	}
}

// ShouldProcessMessage returns if the message should be processed by a message hook.
//
// Use this method to avoid processing unnecessary messages in a MessageHasBeenPosted
// or MessageWillBePosted hook, and indeed in some cases avoid an infinite loop between
// two automated bots or plugins.
//
// The behavior is customizable using the given options, since plugin needs may vary.
// By default, system messages and messages from bots will be skipped.
//
// Minimum server version: 5.2
func (p *PostService) ShouldProcessMessage(post *model.Post, options ...ShouldProcessMessageOption) (bool, error) {
	messageProcessOptions := &shouldProcessMessageOptions{}
	for _, option := range options {
		option(messageProcessOptions)
	}

	var botIDBytes []byte
	var kvGetErr *model.AppError

	if messageProcessOptions.BotID != "" {
		botIDBytes = []byte(messageProcessOptions.BotID)
	} else {
		botIDBytes, kvGetErr = p.api.KVGet(botUserKey)

		if kvGetErr != nil {
			return false, errors.Wrap(kvGetErr, "failed to get bot")
		}
	}

	if botIDBytes != nil {
		if post.UserId == string(botIDBytes) {
			return false, nil
		}
	}

	if post.IsSystemMessage() && !messageProcessOptions.AllowSystemMessages {
		return false, nil
	}

	if !messageProcessOptions.AllowWebhook && post.GetProp("from_webhook") == "true" {
		return false, nil
	}

	if !messageProcessOptions.AllowBots {
		user, appErr := p.api.GetUser(post.UserId)
		if appErr != nil {
			return false, errors.Wrap(appErr, "unable to get user")
		}

		if user.IsBot {
			return false, nil
		}
	}

	if len(messageProcessOptions.FilterChannelIDs) != 0 && !stringInSlice(post.ChannelId, messageProcessOptions.FilterChannelIDs) {
		return false, nil
	}

	if len(messageProcessOptions.FilterUserIDs) != 0 && !stringInSlice(post.UserId, messageProcessOptions.FilterUserIDs) {
		return false, nil
	}

	if botIDBytes != nil && messageProcessOptions.OnlyBotDMs {
		channel, appErr := p.api.GetChannel(post.ChannelId)
		if appErr != nil {
			return false, errors.Wrap(appErr, "unable to get channel")
		}

		if !model.IsBotDMChannel(channel, string(botIDBytes)) {
			return false, nil
		}
	}

	return true, nil
}
