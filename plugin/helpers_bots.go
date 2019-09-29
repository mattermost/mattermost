// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
	"strings"
)

type shouldProcessMessageOptions struct {
	AllowSelf           bool
	AllowSystemMessages bool
	AllowBots           bool
	FilterChannelIDs    []string
	FilterUserIDs       []string
}

type ShouldProcessMessageOption func(*shouldProcessMessageOptions)

func AllowSelf() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowSelf = true
	}
}

func AllowSystemMessages() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowSystemMessages = true
	}
}

func FilterChannelIDs(filterChannelIDs []string) ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.FilterChannelIDs = filterChannelIDs
	}
}

func AllowBots() ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.AllowBots = true
	}
}

func FilterUserIDs(filterUserIDs []string) ShouldProcessMessageOption {
	return func(options *shouldProcessMessageOptions) {
		options.FilterUserIDs = filterUserIDs
	}
}

func (p *HelpersImpl) EnsureBot(bot *model.Bot) (retBotId string, retErr error) {
	// Must provide a bot with a username
	if bot == nil || len(bot.Username) < 1 {
		return "", errors.New("passed a bad bot, nil or no username")
	}

	// If we fail for any reason, this could be a race between creation of bot and
	// retrieval from another EnsureBot. Just try the basic retrieve existing again.
	defer func() {
		if retBotId == "" || retErr != nil {
			var err error
			var botIdBytes []byte

			err = utils.ProgressiveRetry(func() error {
				botIdBytes, err = p.API.KVGet(BOT_USER_KEY)
				if err != nil {
					return err
				}
				return nil
			})

			if err == nil && botIdBytes != nil {
				retBotId = string(botIdBytes)
				retErr = nil
			}
		}
	}()

	botIdBytes, kvGetErr := p.API.KVGet(BOT_USER_KEY)
	if kvGetErr != nil {
		return "", errors.Wrap(kvGetErr, "failed to get bot")
	}

	// If the bot has already been created, there is nothing to do.
	if botIdBytes != nil {
		botId := string(botIdBytes)
		return botId, nil
	}

	// Check for an existing bot user with that username. If one exists, then use that.
	if user, userGetErr := p.API.GetUserByUsername(bot.Username); userGetErr == nil && user != nil {
		if user.IsBot {
			if kvSetErr := p.API.KVSet(BOT_USER_KEY, []byte(user.Id)); kvSetErr != nil {
				p.API.LogWarn("Failed to set claimed bot user id.", "userid", user.Id, "err", kvSetErr)
			}
		} else {
			p.API.LogError("Plugin attempted to use an account that already exists. Convert user to a bot account in the CLI by running 'mattermost user convert <username> --bot'. If the user is an existing user account you want to preserve, change its username and restart the Mattermost server, after which the plugin will create a bot account with that name. For more information about bot accounts, see https://mattermost.com/pl/default-bot-accounts", "username", bot.Username, "user_id", user.Id)
		}
		return user.Id, nil
	}

	// Create a new bot user for the plugin
	createdBot, createBotErr := p.API.CreateBot(bot)
	if createBotErr != nil {
		return "", errors.Wrap(createBotErr, "failed to create bot")
	}

	if kvSetErr := p.API.KVSet(BOT_USER_KEY, []byte(createdBot.UserId)); kvSetErr != nil {
		p.API.LogWarn("Failed to set created bot user id.", "userid", createdBot.UserId, "err", kvSetErr)
	}

	return createdBot.UserId, nil
}

func (p *HelpersImpl) ShouldProcessMessage(post *model.Post, botUserId string, options ...ShouldProcessMessageOption) bool {
	messageProcessOptions := initialiseOptions(options)

	if !messageProcessOptions.AllowSelf {
		if post.UserId == botUserId {
			return false
		}
	}

	if !messageProcessOptions.AllowSystemMessages {
		if post.IsSystemMessage() {
			return false
		}
	}

	if !contains(messageProcessOptions.FilterChannelIDs, post.ChannelId) {
		channel, _ := p.API.GetChannel(post.ChannelId)

		if !IsBotDMChannel(channel, botUserId) {
			return false
		}
	}

	if !contains(messageProcessOptions.FilterUserIDs, post.UserId) {
		user, _ := p.API.GetUser(post.UserId)
		if !messageProcessOptions.AllowBots {
			if user.IsBot {
				return false
			}
		}
	}

	return true
}

func initialiseOptions(options []ShouldProcessMessageOption) *shouldProcessMessageOptions {
	messageProcessOptions := &shouldProcessMessageOptions{}
	for _, option := range options {
		option(messageProcessOptions)
	}
	return messageProcessOptions
}

func IsBotDMChannel(channel *model.Channel, botUserID string) bool {
	if channel.Type != model.CHANNEL_DIRECT {
		return false
	}

	if !strings.HasPrefix(channel.Name, botUserID+"__") && !strings.HasSuffix(channel.Name, "__"+botUserID) {
		return false
	}

	return true
}

func contains(a []string, x string) bool {
	for _, n := range a {
		if x == n {
			return true
		}
	}
	return false
}
