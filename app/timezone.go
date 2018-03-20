// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) Timezones() model.SupportedTimezones {
	if cfg := a.timezones.Load(); cfg != nil {
		return cfg.(model.SupportedTimezones)
	}
	return model.SupportedTimezones{}
}

func (a *App) LoadTimezones() {
	timezonePath := "timezones.json"

	if a.Config().TimezoneSettings.SupportedTimezonesPath != nil && len(*a.Config().TimezoneSettings.SupportedTimezonesPath) > 0 {
		timezonePath = *a.Config().TimezoneSettings.SupportedTimezonesPath
	}

	timezoneCfg := utils.LoadTimezones(timezonePath)

	a.timezones.Store(timezoneCfg)
}
