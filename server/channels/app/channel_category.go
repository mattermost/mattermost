// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (a *App) createInitialSidebarCategories(userID string, opts *store.SidebarCategorySearchOpts) (*model.OrderedSidebarCategories, *model.AppError) {
	categories, nErr := a.Srv().Store().Channel().CreateInitialSidebarCategories(userID, opts)
	if nErr != nil {
		return nil, model.NewAppError("createInitialSidebarCategories", "app.channel.create_initial_sidebar_categories.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return categories, nil
}

func (a *App) GetSidebarCategoriesForTeamForUser(c request.CTX, userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	var appErr *model.AppError
	categories, err := a.Srv().Store().Channel().GetSidebarCategoriesForTeamForUser(userID, teamID)
	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		categories, appErr = a.createInitialSidebarCategories(userID, &store.SidebarCategorySearchOpts{
			TeamID:      teamID,
			ExcludeTeam: false,
		})
		if appErr != nil {
			return nil, appErr
		}
	}

	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSidebarCategoriesForTeamForUser", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSidebarCategoriesForTeamForUser", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return categories, nil
}

func (a *App) GetSidebarCategories(c request.CTX, userID string, opts *store.SidebarCategorySearchOpts) (*model.OrderedSidebarCategories, *model.AppError) {
	var appErr *model.AppError
	categories, err := a.Srv().Store().Channel().GetSidebarCategories(userID, opts)
	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		categories, appErr = a.createInitialSidebarCategories(userID, opts)
		if appErr != nil {
			return nil, appErr
		}
	}

	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSidebarCategories", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSidebarCategories", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return categories, nil
}

func (a *App) GetSidebarCategoryOrder(c request.CTX, userID, teamID string) ([]string, *model.AppError) {
	categories, err := a.Srv().Store().Channel().GetSidebarCategoryOrder(userID, teamID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSidebarCategoryOrder", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSidebarCategoryOrder", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return categories, nil
}

func (a *App) GetSidebarCategory(c request.CTX, categoryId string) (*model.SidebarCategoryWithChannels, *model.AppError) {
	category, err := a.Srv().Store().Channel().GetSidebarCategory(categoryId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return category, nil
}

func (a *App) CreateSidebarCategory(c request.CTX, userID, teamID string, newCategory *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, *model.AppError) {
	category, err := a.Srv().Store().Channel().CreateSidebarCategory(userID, teamID, newCategory)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("CreateSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("CreateSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryCreated, teamID, "", userID, nil, "")
	message.Add("category_id", category.Id)
	a.Publish(message)
	return category, nil
}

func (a *App) UpdateSidebarCategoryOrder(c request.CTX, userID, teamID string, categoryOrder []string) *model.AppError {
	err := a.Srv().Store().Channel().UpdateSidebarCategoryOrder(userID, teamID, categoryOrder)
	if err != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("UpdateSidebarCategoryOrder", "app.channel.sidebar_categories.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return model.NewAppError("UpdateSidebarCategoryOrder", "app.channel.sidebar_categories.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return model.NewAppError("UpdateSidebarCategoryOrder", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryOrderUpdated, teamID, "", userID, nil, "")
	message.Add("order", categoryOrder)
	a.Publish(message)
	return nil
}

func (a *App) UpdateSidebarCategories(c request.CTX, userID, teamID string, categories []*model.SidebarCategoryWithChannels) ([]*model.SidebarCategoryWithChannels, *model.AppError) {
	updatedCategories, originalCategories, err := a.Srv().Store().Channel().UpdateSidebarCategories(userID, teamID, categories)
	if err != nil {
		return nil, model.NewAppError("UpdateSidebarCategories", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryUpdated, teamID, "", userID, nil, "")

	updatedCategoriesJSON, jsonErr := json.Marshal(updatedCategories)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateSidebarCategories", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	message.Add("updatedCategories", string(updatedCategoriesJSON))

	a.Publish(message)

	a.muteChannelsForUpdatedCategories(c, userID, updatedCategories, originalCategories)

	return updatedCategories, nil
}

func (a *App) muteChannelsForUpdatedCategories(c request.CTX, userID string, updatedCategories []*model.SidebarCategoryWithChannels, originalCategories []*model.SidebarCategoryWithChannels) {
	var channelsToMute []string
	var channelsToUnmute []string

	// Mute or unmute all channels in categories that were muted or unmuted
	for i, updatedCategory := range updatedCategories {
		if i > len(originalCategories)-1 {
			// The two slices should be the same length, but double check that to be safe
			continue
		}

		originalCategory := originalCategories[i]

		if updatedCategory.Muted && !originalCategory.Muted {
			channelsToMute = append(channelsToMute, updatedCategory.Channels...)
		} else if !updatedCategory.Muted && originalCategory.Muted {
			channelsToUnmute = append(channelsToUnmute, updatedCategory.Channels...)
		}
	}

	// Mute any channels moved from an unmuted category into a muted one and vice versa
	channelsDiff := diffChannelsBetweenCategories(updatedCategories, originalCategories)
	if len(channelsDiff) != 0 {
		makeCategoryMap := func(categories []*model.SidebarCategoryWithChannels) map[string]*model.SidebarCategoryWithChannels {
			result := make(map[string]*model.SidebarCategoryWithChannels)
			for _, category := range categories {
				result[category.Id] = category
			}

			return result
		}

		updatedCategoriesById := makeCategoryMap(updatedCategories)
		originalCategoriesById := makeCategoryMap(originalCategories)

		for channelID, diff := range channelsDiff {
			fromCategory := originalCategoriesById[diff.fromCategoryId]
			toCategory := updatedCategoriesById[diff.toCategoryId]

			if toCategory.Muted && !fromCategory.Muted {
				channelsToMute = append(channelsToMute, channelID)
			} else if !toCategory.Muted && fromCategory.Muted {
				channelsToUnmute = append(channelsToUnmute, channelID)
			}
		}
	}

	if len(channelsToMute) > 0 {
		_, err := a.setChannelsMuted(c, channelsToMute, userID, true)
		if err != nil {
			c.Logger().Error(
				"Failed to mute channels to match category",
				mlog.String("user_id", userID),
				mlog.Err(err),
			)
		}
	}

	if len(channelsToUnmute) > 0 {
		_, err := a.setChannelsMuted(c, channelsToUnmute, userID, false)
		if err != nil {
			c.Logger().Error(
				"Failed to unmute channels to match category",
				mlog.String("user_id", userID),
				mlog.Err(err),
			)
		}
	}
}

type categoryChannelDiff struct {
	fromCategoryId string
	toCategoryId   string
}

func diffChannelsBetweenCategories(updatedCategories []*model.SidebarCategoryWithChannels, originalCategories []*model.SidebarCategoryWithChannels) map[string]*categoryChannelDiff {
	// mapChannelIdsToCategories returns a map of channel IDs to the IDs of the categories that they're a member of.
	mapChannelIdsToCategories := func(categories []*model.SidebarCategoryWithChannels) map[string]string {
		result := make(map[string]string)
		for _, category := range categories {
			for _, channelID := range category.Channels {
				result[channelID] = category.Id
			}
		}

		return result
	}

	updatedChannelIdsMap := mapChannelIdsToCategories(updatedCategories)
	originalChannelIdsMap := mapChannelIdsToCategories(originalCategories)

	// Check for any channels that have changed categories. Note that we don't worry about any channels that have moved
	// outside of these categories since that heavily complicates things and doesn't currently happen in our apps.
	channelsDiff := make(map[string]*categoryChannelDiff)
	for channelID, originalCategoryId := range originalChannelIdsMap {
		updatedCategoryId := updatedChannelIdsMap[channelID]

		if originalCategoryId != updatedCategoryId && updatedCategoryId != "" {
			channelsDiff[channelID] = &categoryChannelDiff{originalCategoryId, updatedCategoryId}
		}
	}

	return channelsDiff
}

func (a *App) DeleteSidebarCategory(c request.CTX, userID, teamID, categoryId string) *model.AppError {
	err := a.Srv().Store().Channel().DeleteSidebarCategory(categoryId)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("DeleteSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return model.NewAppError("DeleteSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryDeleted, teamID, "", userID, nil, "")
	message.Add("category_id", categoryId)
	a.Publish(message)

	return nil
}
