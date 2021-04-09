// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/actionitem"
)

func (a *App) RecieveNotification(notification actionitem.ExternalNotification) error {
	return a.Srv().Store.ActionItem().Save(notification.ActionItem)
}

func (a *App) GetActionItemsForUser(userid string) ([]actionitem.ActionItem, error) {
	return a.Srv().Store.ActionItem().GetForUser(userid)
}

func (a *App) GetCountsForUser(userid string) ([]actionitem.ActionItemCount, error) {
	return a.Srv().Store.ActionItem().GetCountsForUser(userid)
}

func (a *App) RegisterActionItemProvider(provider actionitem.Provider) error {
	return a.Srv().Store.ActionItem().RegisterProvider(provider)
}

func (a *App) RegisterActionItemType(actionItemType actionitem.Type) error {
	return a.Srv().Store.ActionItem().RegisterType(actionItemType)
}

func (a *App) GetActionItemProviders() ([]actionitem.Provider, error) {
	return a.Srv().Store.ActionItem().GetProviders()
}

func (a *App) GetActionItemTypes() ([]actionitem.Type, error) {
	return a.Srv().Store.ActionItem().GetTypes()
}
