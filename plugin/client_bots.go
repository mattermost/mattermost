// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

// EnsureBot ether returns an existing bot user or creates a bot user with
// the specifications of the passed bot.
// Returns the id of the bot created or existing.
func (p *MattermostPlugin) EnsureBot(bot *model.Bot) (retBotId string, retErr error) {
	// Must provide a bot with a username
	if bot == nil || len(bot.Username) < 1 {
		return "", fmt.Errorf("EnsureBot was passed a bad bot")
	}

	// If we fail for any reason, this could be a race between creation of bot and
	// retreval from anouther EnsureBot. Just try the basic retrieve existing again.
	defer func() {
		if retBotId == "" || retErr != nil {
			time.Sleep(time.Second)
			botIdBytes, err := p.API.KVGet(BOT_USER_KEY)
			if err == nil {
				retBotId = string(botIdBytes)
				retErr = nil
			}
		}
	}()

	botIdBytes, err := p.API.KVGet(BOT_USER_KEY)
	if err != nil {
		return "", errors.Wrap(err, "Failed to get bot in EnsureBot")
	}

	// If the bot has already been created, there is nothing to do.
	if botIdBytes != nil {
		botId := string(botIdBytes)
		return botId, nil
	}

	// Check for an existing bot user with that username. If one exists, then use that.
	if user, err := p.API.GetUserByUsername(bot.Username); err == nil && user != nil {
		if user.IsBot {
			p.API.KVSet(BOT_USER_KEY, []byte(user.Id))
			return user.Id, nil
		}
	}

	// Create a new bot user for the plugin
	createdBot, err := p.API.CreateBot(bot)
	if err != nil {
		return "", errors.Wrap(err, "Failed to create bot in EnsureBot")
	}

	p.API.KVSet(BOT_USER_KEY, []byte(createdBot.UserId))

	return createdBot.UserId, nil
}
