// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Command plugin is an empty plugin that the testhelper package's own integration
// tests deploy.
package main

import "github.com/mattermost/mattermost/server/public/plugin"

type Plugin struct {
	plugin.MattermostPlugin
}

func main() {
	plugin.ClientMain(&Plugin{})
}
