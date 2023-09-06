// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package bot

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

type Bot interface {
	Ensure(stored *model.Bot, iconPath string) error
	MattermostUserID() string
	String() string
}

type bot struct {
	botService       pluginapi.BotService
	mattermostUserID string
	displayName      string
}

func New(botService pluginapi.BotService) Bot {
	newBot := &bot{
		botService: botService,
	}
	return newBot
}

func (bot *bot) Ensure(stored *model.Bot, iconPath string) error {
	if bot.mattermostUserID != "" {
		// Already done
		return nil
	}

	botUserID, err := bot.botService.EnsureBot(stored, pluginapi.ProfileImagePath(iconPath))
	if err != nil {
		return errors.Wrap(err, "failed to ensure bot account")
	}
	bot.mattermostUserID = botUserID
	bot.displayName = stored.DisplayName
	return nil
}

func (bot *bot) MattermostUserID() string {
	return bot.mattermostUserID
}

func (bot *bot) String() string {
	return bot.displayName
}
