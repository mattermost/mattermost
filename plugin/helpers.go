// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-server/model"

type Helpers interface {
	// EnsureBot ether returns an existing bot user or creates a bot user with
	// the specifications of the passed bot.
	// Returns the id of the bot created or existing.
	EnsureBot(bot *model.Bot) (string, error)
}

type HelpersImpl struct {
	API API
}
