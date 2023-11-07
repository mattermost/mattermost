// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"os"

	"github.com/mattermost/mattermost/server/v8/cmd/mattermost/commands"
	// Import and register app layer slash commands
	_ "github.com/mattermost/mattermost/server/v8/channels/app/slashcommands"
	// Plugins
	_ "github.com/mattermost/mattermost/server/v8/channels/app/oauthproviders/gitlab"

	// Enterprise Imports
	_ "github.com/mattermost/mattermost/server/v8/channels/imports"
)

func main() {
	if err := commands.Run(os.Args[1:]); err != nil {
		os.Exit(1)
	}
}
