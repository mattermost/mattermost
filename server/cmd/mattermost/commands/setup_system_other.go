// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package commands

import "github.com/mattermost/mattermost/server/public/model"

func collectSystemInfo() systemFacts {
	return systemFacts{rows: [][2]string{{"Mattermost", model.CurrentVersion}}}
}
