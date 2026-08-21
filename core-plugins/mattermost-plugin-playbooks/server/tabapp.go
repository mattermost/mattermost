// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"os"
	"path/filepath"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

const (
	MicrosoftOnlineJWKSURL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
)

func (p *Plugin) setupTeamsTabApp() error {
	if p.config.GetConfiguration().EnableTeamsTabApp {
		return p.startTeamsTabApp()
	}

	return p.stopTeamsTabApp()
}

func (p *Plugin) startTeamsTabApp() error {
	err := p.createTeamsTabAppBot()
	if err != nil {
		return errors.Wrap(err, "failed to create @msteams bot")
	}

	p.cancelRunningLock.Lock()
	if p.cancelRunning == nil {
		// Setup JWK set to assist in verifying JWTs passed from Microsoft Teams.
		ctx, cancelCtx := context.WithCancel(context.Background())
		p.cancelRunning = cancelCtx

		k, err := keyfunc.NewDefaultCtx(ctx, []string{MicrosoftOnlineJWKSURL})
		if err != nil {
			logrus.WithError(err).WithField("jwks_url", MicrosoftOnlineJWKSURL).Error("Failed to create a keyfunc.Keyfunc")
		}
		p.tabAppJWTKeyFunc = k
		logrus.Info("Started JWKS monitor")
	}
	p.cancelRunningLock.Unlock()

	return nil
}

func (p *Plugin) createTeamsTabAppBot() error {
	// If we've previously created or found the bot, nothing to do.
	if p.config.GetConfiguration().TeamsTabAppBotUserID != "" {
		return nil
	}

	botUserID := ""

	// Check for an existing bot, created either by us or the MS Teams plugin.
	user, err := p.pluginAPI.User.GetByUsername("msteams")
	if err != nil && err != pluginapi.ErrNotFound {
		return errors.Wrap(err, "failed to look for @msteams bot")
	} else if user != nil {
		if user.DeleteAt > 0 {
			return errors.Wrap(err, "@msteams is a deleted user")
		}

		// Check that the user is actually a bot.
		bot, err := p.pluginAPI.Bot.Get(user.Id, true)
		if err != nil && err != pluginapi.ErrNotFound {
			return errors.Wrap(err, "failed to check if @msteams is a bot")
		} else if bot == nil {
			return errors.New("@msteams is not a bot user")
		} else if bot.DeleteAt > 0 {
			return errors.New("@msteams is a deleted bot user")
		}

		botUserID = user.Id
	}

	// Create the bot, if needed. This will allow the MS Teams plugin to use the
	// bot normally as well.
	if botUserID == "" {
		bot := &model.Bot{
			Username:    "msteams",
			DisplayName: "MS Teams",
			OwnerId:     "playbooks",
		}

		err := p.pluginAPI.Bot.Create(bot)
		if err != nil {
			return errors.Wrap(err, "failed to create @msteams bot")
		}

		bundlePath, err := p.API.GetBundlePath()
		if err != nil {
			return errors.Wrapf(err, "unable to get bundle path")
		}

		profileImageBytes, err := os.ReadFile(filepath.Join(bundlePath, "assets/msteams_icon.svg"))
		if err != nil {
			return errors.Wrap(err, "failed to read profile image for @msteams bot")
		}

		appErr := p.API.SetProfileImage(botUserID, profileImageBytes)
		if appErr != nil {
			logrus.WithError(appErr).Warn("failed to set profile image for @msteams bot")
		}

		botUserID = bot.UserId
		logrus.WithField("bot_user_id", botUserID).Info("created msteams bot")
	}

	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.TeamsTabAppBotUserID = botUserID
	})
	if err != nil {
		return errors.Wrap(err, "failed to save msteams bot to config")
	}

	logrus.WithField("bot_user_id", botUserID).Info("setup msteams bot")
	return nil
}

func (p *Plugin) stopTeamsTabApp() error {
	p.cancelRunningLock.Lock()
	if p.cancelRunning != nil {
		logrus.Info("Shutdown JWKS monitor")
		p.cancelRunning()
		p.cancelRunning = nil
	}
	p.cancelRunningLock.Unlock()

	return nil
}
