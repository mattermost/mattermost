// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) Role(id string) *model.Role {
	return a.roles[id]
}

// Updates the roles based on the app config and the global license check. You may need to invoke
// this when license changes are made.
func (a *App) SetDefaultRolesBasedOnConfig() {
	a.roles = utils.DefaultRolesBasedOnConfig(a.Config())
}
