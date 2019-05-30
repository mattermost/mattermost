// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

func (p *HelpersImpl) EnsureBot(bot *model.Bot) (retBotId string, retErr error) {
	// Must provide a bot with a username
	if bot == nil || len(bot.Username) < 1 {
		return "", errors.New("passed a bad bot, nil or no username")
	}

	// If we fail for any reason, this could be a race between creation of bot and
	// retreval from anouther EnsureBot. Just try the basic retrieve existing again.
	defer func() {
		if retBotId == "" || retErr != nil {
			time.Sleep(time.Second)
			botIdBytes, err := p.API.KVGet(BOT_USER_KEY)
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
			return user.Id, nil
		} else {
			return "", errors.New("unable to create bot because user exists with the same name")
		}
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
