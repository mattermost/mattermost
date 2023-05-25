// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

// This is a list of all the current versions including any patches.
// It should be maintained in chronological order with most current
// release at the front of the list.
var versions = []string{
	"7.9.0",
	"7.8.0",
	"7.7.0",
	"7.6.0",
	"7.5.0",
	"7.4.0",
	"7.3.0",
	"7.2.0",
	"7.0.0",
	"0.16.0",
	"0.15.0",
	"0.14.0",
	"0.12.0",
	"0.11.0",
	"0.10.0",
	"0.9.4",
	"0.9.3",
	"0.9.2",
	"0.9.1",
	"0.9.0",
	"0.8.2",
	"0.8.1",
	"0.8.0",
	"0.7.3",
	"0.7.2",
	"0.7.1",
	"0.7.0",
	"0.6.7",
	"0.6.6",
	"0.6.5",
	"0.6.2",
	"0.6.1",
	"0.6.0",
	"0.5.0",
}

var (
	CurrentVersion = versions[0]
	BuildNumber    string
	BuildDate      string
	BuildHash      string
	Edition        string
)

// LogServerInfo logs information about the server instance.
func LogServerInfo(logger mlog.LoggerIFace) {
	logger.Info("Focalboard server",
		mlog.String("version", CurrentVersion),
		mlog.String("edition", Edition),
		mlog.String("build_number", BuildNumber),
		mlog.String("build_date", BuildDate),
		mlog.String("build_hash", BuildHash),
	)
}
