// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/utils"
)

// ONLY FOR APIs SCHEDULED TO BE DEPRECATED

func InitDeprecated() {
	l4g.Debug(utils.T("api.deprecated.init.debug"))
}
