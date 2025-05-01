// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) createInitialSidebarCategories(c request.CTX, userID string, opts *store.SidebarCategorySearchOpts) (*model.OrderedSidebarCategories, *model.AppError) {
	categories, nErr := a.Srv().Store().Channel().CreateInitialSidebarCategories(c, userID, opts)
	if nErr != nil {
		return nil, model.NewAppError("createInitialSidebarCategories", "app.channel.create_initial_sidebar_categories.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return categories, nil
}

func (a *App) GetSidebarCategoriesForTeamForUser(c request.CTX, userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	var appErr *model.AppError
	categories, err := a.Srv().Store().Channel().GetSidebarCategoriesForTeamForUser(userID, teamID, false)
	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		categories, appErr = a.createInitialSidebarCategories(c, userID, &store.SidebarCategorySearchOpts{
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
		categories, appErr = a.createInitialSidebarCategories(c, userID, opts)
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
	allOriginalCategories, err := a.Srv().Store().Channel().GetSidebarCategoriesForTeamForUser(userID, teamID, false)
	if err != nil {
		return nil, model.NewAppError("UpdateSidebarCategory", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	updatedCategories, _, err := a.Srv().Store().Channel().UpdateSidebarCategories(userID, teamID, categories)
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

	a.muteChannelsForUpdatedCategories(c, userID, teamID, updatedCategories, allOriginalCategories.Categories)

	return updatedCategories, nil
}

func (a *App) muteChannelsForUpdatedCategories(c request.CTX, userID string, teamID string, modifiedCategories []*model.SidebarCategoryWithChannels, originalCategories []*model.SidebarCategoryWithChannels) {
	anyCategoryMuted := func() bool {
		for _, category := range append(modifiedCategories, originalCategories...) {
			if category.Muted {
				return true
			}
		}

		return false
	}

	if !anyCategoryMuted() {
		// None of the categories are/were muted, so no channels will be muted or unmuted
		return
	}

	var channelsToMute []string
	var channelsToUnmute []string

	// Mute or unmute all channels in categories that were muted or unmuted
	originalCategoriesById := makeCategoryMap(originalCategories)
	for _, modifiedCategory := range modifiedCategories {
		originalCategory := originalCategoriesById[modifiedCategory.Id]

		if modifiedCategory.Muted && !originalCategory.Muted {
			channelsToMute = append(channelsToMute, modifiedCategory.Channels...)
		} else if !modifiedCategory.Muted && originalCategory.Muted {
			channelsToUnmute = append(channelsToUnmute, modifiedCategory.Channels...)
		}
	}

	// Mute any channels moved from an unmuted category into a muted one and vice versa
	channelsDiff := diffChannelsBetweenCategories(updatedCategories.Categories, originalCategories)
	if len(channelsDiff) != 0 {
		for channelID, diff := range channelsDiff {
			if diff.toCategory.Muted && !diff.fromCategory.Muted {
				channelsToMute = append(channelsToMute, channelID)
			} else if !diff.toCategory.Muted && diff.fromCategory.Muted {
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

func makeCategoryMap(categories []*model.SidebarCategoryWithChannels) map[string]*model.SidebarCategoryWithChannels {
	result := make(map[string]*model.SidebarCategoryWithChannels)
	for _, category := range categories {
		result[category.Id] = category
	}

	return result
}

type categoryChannelDiff struct {
	fromCategory *model.SidebarCategoryWithChannels
	toCategory   *model.SidebarCategoryWithChannels
}

func diffChannelsBetweenCategories(updatedCategories []*model.SidebarCategoryWithChannels, originalCategories []*model.SidebarCategoryWithChannels) map[string]*categoryChannelDiff {
	// mapChannelIdsToCategories returns a map of channel IDs to the categories that they're a member of.
	mapChannelIdsToCategories := func(categories []*model.SidebarCategoryWithChannels) map[string]*model.SidebarCategoryWithChannels {
		result := make(map[string]*model.SidebarCategoryWithChannels)
		for _, category := range categories {
			for _, channelID := range category.Channels {
				result[channelID] = category
			}
		}

		return result
	}

	updatedChannelIdsMap := mapChannelIdsToCategories(updatedCategories)
	originalChannelIdsMap := mapChannelIdsToCategories(originalCategories)

	// Check for any channels that have changed categories. Note that we don't worry about any channels that have moved
	// outside of these categories since that heavily complicates things and doesn't currently happen in our apps.
	channelsDiff := make(map[string]*categoryChannelDiff)
	for channelID, originalCategory := range originalChannelIdsMap {
		updatedCategory := updatedChannelIdsMap[channelID]

		if updatedCategory != nil && originalCategory.Id != updatedCategory.Id {
			channelsDiff[channelID] = &categoryChannelDiff{originalCategory, updatedCategory}
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
