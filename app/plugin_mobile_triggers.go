// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type PluginMobileTrigger struct {
	Trigger  *model.MobileTrigger
	PluginId string
}

func (a *App) RegisterPluginMobileTrigger(pluginId string, trigger *model.MobileTrigger) error {
	a.Srv().pluginMobileTriggersLock.Lock()
	defer a.Srv().pluginMobileTriggersLock.Unlock()

	trigger.PluginId = pluginId
	for _, pt := range a.Srv().pluginMobileTriggers {
		if pt.Trigger.Trigger == trigger.Trigger && pt.Trigger.Location == trigger.Location {
			if pt.PluginId == pluginId {
				pt.Trigger = trigger
				return nil
			}
		}
	}

	a.Srv().pluginMobileTriggers = append(a.Srv().pluginMobileTriggers, &PluginMobileTrigger{
		Trigger:  trigger,
		PluginId: pluginId,
	})
	return nil
}

func (a *App) UnregisterPluginMobileTrigger(pluginId, location, trigger string) {
	a.Srv().pluginMobileTriggersLock.Lock()
	defer a.Srv().pluginMobileTriggersLock.Unlock()

	var remaining []*PluginMobileTrigger
	for _, pt := range a.Srv().pluginMobileTriggers {
		if pt.PluginId != pluginId || pt.Trigger.Location != location || pt.Trigger.Trigger != trigger {
			remaining = append(remaining, pt)
		}
	}
	a.Srv().pluginMobileTriggers = remaining
}

func (a *App) UnregisterPluginMobileTriggers(pluginId string) {
	a.Srv().pluginMobileTriggersLock.Lock()
	defer a.Srv().pluginMobileTriggersLock.Unlock()

	var remaining []*PluginMobileTrigger
	for _, pt := range a.Srv().pluginMobileTriggers {
		if pt.PluginId != pluginId {
			remaining = append(remaining, pt)
		}
	}
	a.Srv().pluginMobileTriggers = remaining
}

func (a *App) MobileTriggers() []*model.MobileTrigger {
	a.Srv().pluginMobileTriggersLock.Lock()
	defer a.Srv().pluginMobileTriggersLock.Unlock()

	var triggers []*model.MobileTrigger
	for _, pt := range a.Srv().pluginMobileTriggers {
		triggers = append(triggers, pt.Trigger)
	}
	return triggers
}
