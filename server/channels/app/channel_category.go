// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) createInitialSidebarCategories(rctx request.CTX, userID string, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	categories, nErr := a.Srv().Store().Channel().CreateInitialSidebarCategories(rctx, userID, teamID)
	if nErr != nil {
		return nil, model.NewAppError("createInitialSidebarCategories", "app.channel.create_initial_sidebar_categories.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return categories, nil
}

func (a *App) GetSidebarCategoriesForTeamForUser(rctx request.CTX, userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	var appErr *model.AppError
	categories, err := a.Srv().Store().Channel().GetSidebarCategoriesForTeamForUser(userID, teamID)
	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		categories, appErr = a.createInitialSidebarCategories(rctx, userID, teamID)
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

func (a *App) GetSidebarCategories(rctx request.CTX, userID string, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	var appErr *model.AppError
	categories, err := a.Srv().Store().Channel().GetSidebarCategories(userID, teamID)
	if err == nil && len(categories.Categories) == 0 {
		// A user must always have categories, so migration must not have happened yet, and we should run it ourselves
		categories, appErr = a.createInitialSidebarCategories(rctx, userID, teamID)
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

func (a *App) GetSidebarCategoryOrder(rctx request.CTX, userID, teamID string) ([]string, *model.AppError) {
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

func (a *App) GetSidebarCategory(rctx request.CTX, categoryId string) (*model.SidebarCategoryWithChannels, *model.AppError) {
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

func (a *App) CreateSidebarCategory(rctx request.CTX, userID, teamID string, newCategory *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, *model.AppError) {
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

func (a *App) UpdateSidebarCategoryOrder(rctx request.CTX, userID, teamID string, categoryOrder []string) *model.AppError {
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

func (a *App) UpdateSidebarCategories(rctx request.CTX, userID, teamID string, categories []*model.SidebarCategoryWithChannels) ([]*model.SidebarCategoryWithChannels, *model.AppError) {
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

	a.muteChannelsForUpdatedCategories(rctx, userID, updatedCategories, originalCategories)

	return updatedCategories, nil
}

func (a *App) muteChannelsForUpdatedCategories(rctx request.CTX, userID string, updatedCategories []*model.SidebarCategoryWithChannels, originalCategories []*model.SidebarCategoryWithChannels) {
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
		_, err := a.setChannelsMuted(rctx, channelsToMute, userID, true)
		if err != nil {
			rctx.Logger().Error(
				"Failed to mute channels to match category",
				mlog.String("user_id", userID),
				mlog.Err(err),
			)
		}
	}

	if len(channelsToUnmute) > 0 {
		_, err := a.setChannelsMuted(rctx, channelsToUnmute, userID, false)
		if err != nil {
			rctx.Logger().Error(
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

func (a *App) DeleteSidebarCategory(rctx request.CTX, userID, teamID, categoryId string) *model.AppError {
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

func (a *App) SetChannelManagedCategory(rctx request.CTX, channelID, categoryName string) *model.AppError {
	categoryName = strings.TrimSpace(categoryName)
	if categoryName == "" {
		return model.NewAppError("SetChannelManagedCategory", "app.managed_category.empty_name.app_error", nil, "", http.StatusBadRequest)
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}
	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return model.NewAppError("SetChannelManagedCategory", "app.managed_category.dm_gm_not_allowed.app_error", nil, "", http.StatusBadRequest)
	}

	nameJSON, _ := json.Marshal(categoryName)

	value := &model.PropertyValue{
		GroupID:    a.Channels().managedCategoryGroupID,
		FieldID:    a.Channels().managedCategoryFieldID,
		TargetID:   channelID,
		TargetType: model.PropertyValueTargetTypeChannel,
		Value:      nameJSON,
	}

	if _, appErr := a.UpsertPropertyValues(rctx, []*model.PropertyValue{value}, model.PropertyFieldObjectTypeChannel, channelID, ""); appErr != nil {
		return model.NewAppError("SetChannelManagedCategory", "app.managed_category.set.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	a.publishManagedCategorySidebarUpdated(channel.TeamId, channelID, categoryName)

	return nil
}

func (a *App) ClearChannelManagedCategory(rctx request.CTX, channelID string) *model.AppError {
	values, appErr := a.SearchPropertyValues(rctx, a.Channels().managedCategoryGroupID, model.PropertyValueSearchOpts{
		FieldID:   a.Channels().managedCategoryFieldID,
		TargetIDs: []string{channelID},
		PerPage:   1,
	})
	if appErr != nil {
		return model.NewAppError("ClearChannelManagedCategory", "app.managed_category.search.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	if len(values) == 0 {
		return nil
	}

	if appErr := a.DeletePropertyValue(rctx, a.Channels().managedCategoryGroupID, values[0].ID); appErr != nil {
		return model.NewAppError("ClearChannelManagedCategory", "app.managed_category.clear.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	ch, chErr := a.GetChannel(rctx, channelID)
	if chErr == nil {
		a.publishManagedCategorySidebarUpdated(ch.TeamId, channelID, "")
	}

	return nil
}

// GetVisibleManagedCategoryMappings returns a map of channelID -> categoryName for all channels
// the user is a member of (within the given team) that have a managed category assigned.
func (a *App) GetVisibleManagedCategoryMappings(rctx request.CTX, teamID string) (map[string]string, *model.AppError) {
	return a.GetVisibleManagedCategoryMappingsForUser(rctx, rctx.Session().UserId, teamID)
}

// GetVisibleManagedCategoryMappingsForUser is like GetVisibleManagedCategoryMappings but uses an explicit userID
// (e.g. when loading another user's sidebar with EditOtherUsers).
func (a *App) GetVisibleManagedCategoryMappingsForUser(rctx request.CTX, userID, teamID string) (map[string]string, *model.AppError) {
	channels, appErr := a.GetChannelsForTeamForUser(rctx, teamID, userID, &model.ChannelSearchOpts{})
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return map[string]string{}, nil
		}
		return nil, appErr
	}

	if len(channels) == 0 {
		return map[string]string{}, nil
	}

	channelIDs := make([]string, 0, len(channels))
	for _, ch := range channels {
		channelIDs = append(channelIDs, ch.Id)
	}

	values, appErr := a.SearchPropertyValues(rctx, a.Channels().managedCategoryGroupID, model.PropertyValueSearchOpts{
		FieldID:   a.Channels().managedCategoryFieldID,
		TargetIDs: channelIDs,
		PerPage:   len(channelIDs),
	})
	if appErr != nil {
		return nil, model.NewAppError("GetVisibleManagedCategoryMappingsForUser", "app.managed_category.get_mappings.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	result := make(map[string]string, len(values))
	for _, v := range values {
		var name string
		if err := json.Unmarshal(v.Value, &name); err != nil {
			rctx.Logger().Warn("Failed to unmarshal managed category name",
				mlog.String("channel_id", v.TargetID),
				mlog.Err(err),
			)
			continue
		}
		result[v.TargetID] = name
	}

	return result, nil
}

// GetSidebarCategoriesWithManagedForTeamForUser returns sidebar categories merged with synthetic managed categories
// for clients that do not use the dedicated managed_categories API (e.g. older mobile apps).
//
// Channels are intentionally left in their original user categories AND included in managed
// categories. The mobile client uses a composite CategoryChannel key (teamId_channelId) that
// allows only one category per channel; by placing managed categories after user categories
// in the array, the mobile's "last writer wins" dedup assigns the channel to the managed
// category. Leaving the channel in user categories prevents the mobile's prune logic from
// deleting the CategoryChannel record (prune only deletes channels missing from the remote
// category's channel_ids list).
func (a *App) GetSidebarCategoriesWithManagedForTeamForUser(rctx request.CTX, userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	base, appErr := a.GetSidebarCategoriesForTeamForUser(rctx, userID, teamID)
	if appErr != nil {
		return nil, appErr
	}

	mappings, appErr := a.GetVisibleManagedCategoryMappingsForUser(rctx, userID, teamID)
	if appErr != nil {
		return nil, appErr
	}
	if len(mappings) == 0 {
		return base, nil
	}

	managed := a.buildManagedSidebarCategories(userID, teamID, mappings)
	if len(managed) == 0 {
		return base, nil
	}

	managedOrder := make([]string, 0, len(managed))
	for _, mc := range managed {
		managedOrder = append(managedOrder, mc.Id)
	}

	// Managed categories go AFTER user categories in the array so the mobile's
	// CategoryChannel dedup (last writer wins) assigns the channel to the managed category.
	// Managed category IDs go BEFORE user category IDs in the order for display priority.
	out := &model.OrderedSidebarCategories{
		Categories: append(append([]*model.SidebarCategoryWithChannels{}, base.Categories...), managed...),
		Order:      append(append([]string{}, managedOrder...), base.Order...),
	}

	return out, nil
}

// managedCategorySyntheticID returns a stable 26-char ID for a managed sidebar row so clients
// (e.g. mobile WatermelonDB) do not thrash on every GET. It must match model.IsValidId.
func managedCategorySyntheticID(teamID, displayName string) string {
	sum := sha256.Sum256([]byte(teamID + "\x00" + displayName))
	// SHA-256 hex is 64 chars; take first 26 (letters + digits) for SidebarCategory.Id shape.
	return hex.EncodeToString(sum[:])[:26]
}

func (a *App) buildManagedSidebarCategories(userID, teamID string, mappings map[string]string) []*model.SidebarCategoryWithChannels {
	channelsByName := make(map[string][]string)
	for channelID, name := range mappings {
		channelsByName[name] = append(channelsByName[name], channelID)
	}
	names := make([]string, 0, len(channelsByName))
	for name := range channelsByName {
		names = append(names, name)
	}
	sort.Strings(names)

	out := make([]*model.SidebarCategoryWithChannels, 0, len(names))
	for i, name := range names {
		chIDs := channelsByName[name]
		sort.Strings(chIDs)
		sortOrder := int64(model.DefaultSidebarSortOrderFavorites - model.MinimalSidebarSortDistance*(len(names)-i))
		out = append(out, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				Id:          managedCategorySyntheticID(teamID, name),
				UserId:      userID,
				TeamId:      teamID,
				SortOrder:   sortOrder,
				Sorting:     model.SidebarCategorySortAlphabetical,
				Type:        model.SidebarCategoryManaged,
				DisplayName: name,
				Muted:       false,
				Collapsed:   false,
			},
			Channels: chIDs,
		})
	}
	return out
}

// publishManagedCategorySidebarUpdated sends a sidebar_category_updated WS event.
//
// When channelID and categoryName are provided (Set path), the event carries valid JSON
// in updatedCategories so the mobile client takes the addOrUpdateCategories path (no prune,
// no DELETE/UPDATE race in WatermelonDB).
//
// When channelID is provided but categoryName is empty (Clear path), a broadcast hook
// resolves each recipient's "Channels" category and populates updatedCategories per-user
// so the channel moves back into the default category via addOrUpdateCategories.
func (a *App) publishManagedCategorySidebarUpdated(teamID, channelID, categoryName string) {
	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryUpdated, teamID, "", "", nil, "")

	if channelID != "" && categoryName != "" {
		cat := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				Id:          managedCategorySyntheticID(teamID, categoryName),
				TeamId:      teamID,
				SortOrder:   int64(model.DefaultSidebarSortOrderFavorites - model.MinimalSidebarSortDistance),
				Sorting:     model.SidebarCategorySortAlphabetical,
				Type:        model.SidebarCategoryManaged,
				DisplayName: categoryName,
			},
			Channels: []string{channelID},
		}

		if data, jsonErr := json.Marshal([]*model.SidebarCategoryWithChannels{cat}); jsonErr == nil {
			message.Add("updatedCategories", string(data))
			a.Publish(message)
			return
		}
	}

	if channelID != "" {
		useManagedCategoryClearHook(message, teamID, channelID)
	}

	a.Publish(message)
}
