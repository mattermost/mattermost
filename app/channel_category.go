// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) createInitialSidebarCategories(userId, teamId string) *model.AppError {
	nErr := a.Srv().Store.Channel().CreateInitialSidebarCategories(userId, teamId)

	if nErr != nil {
		return model.NewAppError("createInitialSidebarCategories", "app.channel.create_initial_sidebar_categories.internal_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) GetSidebarCategories(userId, teamId string) (*model.OrderedSidebarCategories, *model.AppError) {
	categories, err := a.Srv().Store.Channel().GetSidebarCategories(userId, teamId)

	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		nErr := a.createInitialSidebarCategories(userId, teamId)
		if nErr != nil {
			return nil, nErr
		}

		categories, err = a.waitForSidebarCategories(userId, teamId)
	}

	return categories, err
}

// waitForSidebarCategories is used to get a user's sidebar categories after they've been created since there may be
// replication lag if any database replicas exist. It will wait until results are available to return them.
func (a *App) waitForSidebarCategories(userId, teamId string) (*model.OrderedSidebarCategories, *model.AppError) {
	if len(a.Config().SqlSettings.DataSourceReplicas) == 0 {
		// The categories should be available immediately on a single database
		return a.Srv().Store.Channel().GetSidebarCategories(userId, teamId)
	}

	now := model.GetMillis()

	for model.GetMillis()-now < 12000 {
		time.Sleep(100 * time.Millisecond)

		categories, err := a.Srv().Store.Channel().GetSidebarCategories(userId, teamId)

		if err != nil || len(categories.Categories) > 0 {
			// We've found something, so return
			return categories, err
		}
	}

	mlog.Error("waitForSidebarCategories giving up", mlog.String("user_id", userId), mlog.String("team_id", teamId))

	return &model.OrderedSidebarCategories{}, nil
}

func (a *App) GetSidebarCategoryOrder(userId, teamId string) ([]string, *model.AppError) {
	return a.Srv().Store.Channel().GetSidebarCategoryOrder(userId, teamId)
}

func (a *App) GetSidebarCategory(categoryId string) (*model.SidebarCategoryWithChannels, *model.AppError) {
	return a.Srv().Store.Channel().GetSidebarCategory(categoryId)
}

func (a *App) CreateSidebarCategory(userId, teamId string, newCategory *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, *model.AppError) {
	category, err := a.Srv().Store.Channel().CreateSidebarCategory(userId, teamId, newCategory)
	if err != nil {
		return nil, err
	}
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_CREATED, teamId, "", userId, nil)
	message.Add("category_id", category.Id)
	a.Publish(message)
	return category, nil
}

func (a *App) UpdateSidebarCategoryOrder(userId, teamId string, categoryOrder []string) *model.AppError {
	err := a.Srv().Store.Channel().UpdateSidebarCategoryOrder(userId, teamId, categoryOrder)
	if err != nil {
		return err
	}
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_ORDER_UPDATED, teamId, "", userId, nil)
	message.Add("order", categoryOrder)
	a.Publish(message)
	return nil
}

func (a *App) UpdateSidebarCategories(userId, teamId string, categories []*model.SidebarCategoryWithChannels) ([]*model.SidebarCategoryWithChannels, *model.AppError) {
	result, err := a.Srv().Store.Channel().UpdateSidebarCategories(userId, teamId, categories)
	if err != nil {
		return nil, err
	}
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_UPDATED, teamId, "", userId, nil)
	a.Publish(message)
	return result, nil
}

func (a *App) DeleteSidebarCategory(userId, teamId, categoryId string) *model.AppError {
	err := a.Srv().Store.Channel().DeleteSidebarCategory(categoryId)
	if err != nil {
		return err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_DELETED, teamId, "", userId, nil)
	message.Add("category_id", categoryId)
	a.Publish(message)

	return nil
}
