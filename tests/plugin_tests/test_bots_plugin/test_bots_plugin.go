package main

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	test := func() (bool, string) {
		createdBot, err := p.API.CreateBot(&model.Bot{
			Username:    "bot",
			Description: "a plugin bot",
		})

		if err != nil {
			return false, err.Error() + "failed to create bot"
		}

		fetchedBot, err := p.API.GetBot(createdBot.UserId, false)
		if err != nil {
			return false, err.Error() + "failed to get bot"
		}
		if fetchedBot.Description != "a plugin bot" {
			return false, "GetBot did not return the expected bot Description"
		}
		if fetchedBot.OwnerId != "testpluginbots" {
			return false, "GetBot did not return the expected bot OwnerId"
		}

		updatedDescription := createdBot.Description + ", updated"
		patchedBot, err := p.API.PatchBot(createdBot.UserId, &model.BotPatch{
			Description: &updatedDescription,
		})
		if err != nil {
			return false, err.Error() + "failed to patch bot"
		}

		fetchedBot, err = p.API.GetBot(patchedBot.UserId, false)
		if err != nil {
			return false, err.Error() + "failed to get bot"
		}

		if fetchedBot.UserId != patchedBot.UserId {
			return false, "GetBot did not return the expected bot"
		}
		if fetchedBot.Description != "a plugin bot, updated" {
			return false, "GetBot did not return the updated bot Description"
		}

		fetchedBots, err := p.API.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        1,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		if err != nil {
			return false, err.Error() + "failed to get bots"
		}

		if len(fetchedBots) != 1 {
			return false, "GetBots did not return a single bot"
		}

		if fetchedBot.UserId != fetchedBots[0].UserId {
			return false, "GetBots did not return the expected bot"
		}
		_, err = p.API.UpdateBotActive(fetchedBot.UserId, false)
		if err != nil {
			return false, err.Error() + "failed to disable bot"
		}
		fetchedBot, err = p.API.GetBot(patchedBot.UserId, false)
		if err == nil {
			return false, "expected not to find disabled bot"
		}
		_, err = p.API.UpdateBotActive(fetchedBot.UserId, true)
		if err != nil {
			return false, err.Error() + "failed to disable bot"
		}
		fetchedBot, err = p.API.GetBot(patchedBot.UserId, false)
		if err != nil {
			return false, err.Error() + "failed to get bot after enabling"
		}
		if fetchedBot.UserId != patchedBot.UserId {
			return false, "GetBot did not return the expected bot after enabling"
		}
		err = p.API.PermanentDeleteBot(patchedBot.UserId)
		if err != nil {
			return false, err.Error() + "failed to delete bot"
		}

		_, err = p.API.GetBot(patchedBot.UserId, false)
		if err == nil {
			return false, err.Error() + "found bot after permanently deleting"
		}
		createdBotWithOverriddenCreator, err := p.API.CreateBot(&model.Bot{
			Username:    "bot",
			Description: "a plugin bot",
			OwnerId:     "abc123",
		})
		if err != nil {
			return false, err.Error() + "failed to create bot with overridden creator"
		}
		fetchedBot, err = p.API.GetBot(createdBotWithOverriddenCreator.UserId, false)
		if err != nil {
			return false, err.Error() + "failed to get bot"
		}
		if fetchedBot.Description != "a plugin bot" {
			return false, "GetBot did not return the expected bot Description"
		}
		if fetchedBot.OwnerId != "abc123" {
			return false, "GetBot did not return the expected bot OwnerId"
		}
		return true, ""
	}
	result := map[string]interface{}{}
	ok, e := test()
	if !ok {
		result["Error"] = e
	}
	b, _ := json.Marshal(result)
	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
