// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost-server/model"
)

const (
	INTERNAL_KEY_PREFIX = "mmi_"
	BOT_USER_KEY        = INTERNAL_KEY_PREFIX + "botid"
)

// Starts the serving of a Mattermost plugin over net/rpc. gRPC is not yet supported.
//
// Call this when your plugin is ready to start.
func ClientMain(pluginImplementation interface{}) {
	if impl, ok := pluginImplementation.(interface {
		SetAPI(api API)
	}); !ok {
		panic("Plugin implementation given must embed plugin.MattermostPlugin")
	} else {
		impl.SetAPI(nil)
	}

	pluginMap := map[string]plugin.Plugin{
		"hooks": &hooksPlugin{hooks: pluginImplementation},
	}

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: handshake,
		Plugins:         pluginMap,
	})
}

type MattermostPlugin struct {
	// API exposes the plugin api, and becomes available just prior to the OnActive hook.
	API API
}

// SetAPI persists the given API interface to the plugin. It is invoked just prior to the
// OnActivate hook, exposing the API for use by the plugin.
func (p *MattermostPlugin) SetAPI(api API) {
	p.API = api
}

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
		return "", err
	}

	// If the bot has already been created, there is nothing to do.
	if botIdBytes != nil {
		botId := string(botIdBytes)
		p.API.PatchBot(botId, &model.BotPatch{
			Username:    &bot.Username,
			DisplayName: &bot.DisplayName,
			Description: &bot.Description,
		})
		return string(botIdBytes), nil
	}

	// Check for an existing bot user with that username. If one exists, then use that.
	if user, err := p.API.GetUserByUsername(bot.Username); err == nil && user != nil {
		if retrievedBot, err := p.API.GetBot(user.Id, true); err == nil && retrievedBot != nil {
			p.API.KVSet(BOT_USER_KEY, []byte(retrievedBot.UserId))
			return retrievedBot.UserId, nil
		}
	}

	// Create a new bot user for the plugin
	createdBot, err := p.API.CreateBot(bot)
	if err != nil {
		p.API.LogError("Failed to create bot user.", "error", err)
		return "", err
	}

	p.API.KVSet(BOT_USER_KEY, []byte(createdBot.UserId))

	return createdBot.UserId, nil
}
