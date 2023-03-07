// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/server/v7/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	createdBot, appErr := p.API.CreateBot(&model.Bot{
		Username:    "bot",
		Description: "a plugin bot",
	})

	if appErr != nil {
		return nil, appErr.Error() + "failed to create bot"
	}

	fetchedBot, appErr := p.API.GetBot(createdBot.UserId, false)
	if appErr != nil {
		return nil, appErr.Error() + "failed to get bot"
	}
	if fetchedBot.Description != "a plugin bot" {
		return nil, "GetBot did not return the expected bot Description"
	}
	if fetchedBot.OwnerId != "test_bots_plugin" {
		return nil, "GetBot did not return the expected bot OwnerId"
	}

	updatedDescription := createdBot.Description + ", updated"
	patchedBot, appErr := p.API.PatchBot(createdBot.UserId, &model.BotPatch{
		Description: &updatedDescription,
	})
	if appErr != nil {
		return nil, appErr.Error() + "failed to patch bot"
	}

	fetchedBot, appErr = p.API.GetBot(patchedBot.UserId, false)
	if appErr != nil {
		return nil, appErr.Error() + "failed to get bot"
	}

	if fetchedBot.UserId != patchedBot.UserId {
		return nil, "GetBot did not return the expected bot"
	}
	if fetchedBot.Description != "a plugin bot, updated" {
		return nil, "GetBot did not return the updated bot Description"
	}

	fetchedBots, appErr := p.API.GetBots(&model.BotGetOptions{
		Page:           0,
		PerPage:        1,
		OwnerId:        "",
		IncludeDeleted: false,
	})
	if appErr != nil {
		return nil, appErr.Error() + "failed to get bots"
	}

	if len(fetchedBots) != 1 {
		return nil, "GetBots did not return a single bot"
	}

	if fetchedBot.UserId != fetchedBots[0].UserId {
		return nil, "GetBots did not return the expected bot"
	}
	if _, appErr = p.API.UpdateBotActive(fetchedBot.UserId, false); appErr != nil {
		return nil, appErr.Error() + "failed to disable bot"
	}

	_, err := p.API.EnsureBotUser(&model.Bot{
		Username:    "bot2",
		Description: "another plugin bot",
	})
	if err != nil {
		return nil, err.Error() + "failed to create bot"
	}

	// TODO: investigate why the following code panics
	/*
		if fetchedBot, err = p.API.GetBot(patchedBot.UserId, false); err == nil {
			return nil, "expected not to find disabled bot"
		}
		if _, err = p.API.UpdateBotActive(fetchedBot.UserId, true); err != nil {
			return nil, err.Error() + "failed to disable bot"
		}
		if fetchedBot, err = p.API.GetBot(patchedBot.UserId, false); err != nil {
			return nil, err.Error() + "failed to get bot after enabling"
		}
		if fetchedBot.UserId != patchedBot.UserId {
			return nil, "GetBot did not return the expected bot after enabling"
		}
		if err = p.API.PermanentDeleteBot(patchedBot.UserId); err != nil {
			return nil, err.Error() + "failed to delete bot"
		}

		if _, err = p.API.GetBot(patchedBot.UserId, false); err == nil {
			return nil, err.Error() + "found bot after permanently deleting"
		}
		createdBotWithOverriddenCreator, err := p.API.CreateBot(&model.Bot{
			Username:    "bot",
			Description: "a plugin bot",
			OwnerId:     "abc123",
		})
		if err != nil {
			return nil, err.Error() + "failed to create bot with overridden creator"
		}
		if fetchedBot, err = p.API.GetBot(createdBotWithOverriddenCreator.UserId, false); err != nil {
			return nil, err.Error() + "failed to get bot"
		}
		if fetchedBot.Description != "a plugin bot" {
			return nil, "GetBot did not return the expected bot Description"
		}
		if fetchedBot.OwnerId != "abc123" {
			return nil, "GetBot did not return the expected bot OwnerId"
		}
	*/
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
