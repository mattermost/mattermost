package app

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// --- Query functions ---

// IsChannelSyncEnabled checks if the ChannelSync feature flag is enabled.
func (a *App) IsChannelSyncEnabled() bool {
	return a.Config().FeatureFlags.ChannelSync
}

// ShouldSyncUser checks if a specific user should have their sidebar synced.
// Returns false if: feature disabled or user is excluded.
func (a *App) ShouldSyncUser(rctx request.CTX, userId string, teamId string) (bool, *model.AppError) {
	if !a.IsChannelSyncEnabled() {
		return false, nil
	}

	// Check exclusion list
	user, err := a.GetUser(userId)
	if err != nil {
		return false, err
	}
	if a.isUserExcludedFromSync(user.Username) {
		return false, nil
	}

	return true, nil
}

// isUserExcludedFromSync checks the comma-separated exclusion list.
func (a *App) isUserExcludedFromSync(username string) bool {
	excludedStr := *a.Config().MattermostExtendedSettings.ChannelSync.ExcludedUsernames
	if excludedStr == "" {
		return false
	}
	excluded := strings.Split(excludedStr, ",")
	for _, u := range excluded {
		if strings.TrimSpace(u) == username {
			return true
		}
	}
	return false
}

// --- Layout CRUD ---

// GetChannelSyncLayout retrieves the canonical layout for a team.
func (a *App) GetChannelSyncLayout(rctx request.CTX, teamId string) (*model.ChannelSyncLayout, *model.AppError) {
	layout, err := a.Srv().Store().ChannelSync().GetLayout(teamId)
	if err != nil {
		return nil, model.NewAppError("GetChannelSyncLayout", "app.channel_sync.get_layout.store_error", nil, "", 500).Wrap(err)
	}
	return layout, nil
}

// SaveChannelSyncLayout creates or updates the canonical layout for a team.
func (a *App) SaveChannelSyncLayout(rctx request.CTX, layout *model.ChannelSyncLayout, updatedBy string) (*model.ChannelSyncLayout, *model.AppError) {
	if appErr := layout.IsValid(); appErr != nil {
		return nil, appErr
	}

	layout.UpdateAt = model.GetMillis()
	layout.UpdateBy = updatedBy

	if err := a.Srv().Store().ChannelSync().SaveLayout(layout); err != nil {
		return nil, model.NewAppError("SaveChannelSyncLayout", "app.channel_sync.save_layout.store_error", nil, "", 500).Wrap(err)
	}

	a.publishChannelSyncUpdate(layout.TeamId)

	return layout, nil
}

// DeleteChannelSyncLayout removes the canonical layout for a team.
func (a *App) DeleteChannelSyncLayout(rctx request.CTX, teamId string) *model.AppError {
	if err := a.Srv().Store().ChannelSync().DeleteLayout(teamId); err != nil {
		return model.NewAppError("DeleteChannelSyncLayout", "app.channel_sync.delete_layout.store_error", nil, "", 500).Wrap(err)
	}

	a.publishChannelSyncUpdate(teamId)
	return nil
}

// --- User-facing merged view ---

// GetSyncedCategoriesForUser builds the merged view of categories for a synced user.
func (a *App) GetSyncedCategoriesForUser(rctx request.CTX, userId string, teamId string) (*model.ChannelSyncUserState, *model.AppError) {
	// 0. Check if user is excluded from sync
	user, userErr := a.GetUser(userId)
	if userErr != nil {
		return nil, userErr
	}
	if a.isUserExcludedFromSync(user.Username) {
		return &model.ChannelSyncUserState{TeamId: teamId, ShouldSync: false}, nil
	}

	// 1. Get canonical layout
	layout, err := a.Srv().Store().ChannelSync().GetLayout(teamId)
	if err != nil {
		return nil, model.NewAppError("GetSyncedCategoriesForUser", "app.channel_sync.get_synced.store_error", nil, "", 500).Wrap(err)
	}
	if layout == nil {
		// No layout defined yet — still sync, with empty categories.
		// The webapp will show all team channels in an "Uncategorized" category.
		return &model.ChannelSyncUserState{
			TeamId:     teamId,
			ShouldSync: true,
			Categories: []*model.ChannelSyncUserCategory{},
		}, nil
	}

	// 2. Get user's channel memberships for this team
	memberships, storeErr := a.Srv().Store().Channel().GetMembersForUser(teamId, userId)
	if storeErr != nil {
		return nil, model.NewAppError("GetSyncedCategoriesForUser", "app.channel_sync.get_synced.members_error", nil, "", 500).Wrap(storeErr)
	}
	memberChannelIds := make(map[string]bool)
	for _, m := range memberships {
		memberChannelIds[m.ChannelId] = true
	}

	// 3. Get user's existing categories (for collapsed/muted state and category IDs)
	userCategories, appErr := a.GetSidebarCategoriesForTeamForUser(rctx, userId, teamId)
	if appErr != nil {
		return nil, appErr
	}

	userCatByName := make(map[string]*model.SidebarCategoryWithChannels)
	userCatByType := make(map[model.SidebarCategoryType]*model.SidebarCategoryWithChannels)
	if userCategories != nil {
		for _, cat := range userCategories.Categories {
			userCatByName[cat.DisplayName] = cat
			userCatByType[cat.Type] = cat
		}
	}

	// 4. Get dismissals
	dismissals, storeErr := a.Srv().Store().ChannelSync().GetDismissals(userId, teamId)
	if storeErr != nil {
		return nil, model.NewAppError("GetSyncedCategoriesForUser", "app.channel_sync.get_synced.dismissals_error", nil, "", 500).Wrap(storeErr)
	}
	dismissedSet := make(map[string]bool)
	for _, d := range dismissals {
		dismissedSet[d] = true
	}

	// 5. Build merged categories
	var categories []*model.ChannelSyncUserCategory
	for _, canonCat := range layout.Categories {
		userCat := &model.ChannelSyncUserCategory{
			DisplayName: canonCat.DisplayName,
			SortOrder:   canonCat.SortOrder,
		}

		// Try to match to user's existing category (for ID, collapsed, muted state)
		if existingCat, ok := userCatByName[canonCat.DisplayName]; ok {
			userCat.Id = existingCat.Id
			userCat.Collapsed = existingCat.Collapsed
			userCat.Muted = existingCat.Muted
		} else if existingCat, ok := userCatByType[model.SidebarCategoryChannels]; ok {
			// Fallback: use the "Channels" system category ID for the first unmatched category
			userCat.Id = existingCat.Id
		}

		// Split channels into joined (show normally) and unjoined (Quick Join)
		for _, chId := range canonCat.ChannelIds {
			if memberChannelIds[chId] {
				userCat.ChannelIds = append(userCat.ChannelIds, chId)
			} else if !dismissedSet[chId] {
				userCat.QuickJoin = append(userCat.QuickJoin, chId)
			}
		}

		// Skip empty categories (user has no channels and no Quick Join items)
		if len(userCat.ChannelIds) == 0 && len(userCat.QuickJoin) == 0 {
			continue
		}

		categories = append(categories, userCat)
	}

	// 6. Preserve the DM category from user's personal categories
	if dmCat, ok := userCatByType[model.SidebarCategoryDirectMessages]; ok {
		categories = append(categories, &model.ChannelSyncUserCategory{
			Id:          dmCat.Id,
			DisplayName: dmCat.DisplayName,
			SortOrder:   dmCat.SortOrder,
			Collapsed:   dmCat.Collapsed,
			Muted:       dmCat.Muted,
			ChannelIds:  dmCat.Channels,
		})
	}

	return &model.ChannelSyncUserState{
		TeamId:     teamId,
		ShouldSync: true,
		Categories: categories,
	}, nil
}

// --- Auto-categorization ---

// EnsureChannelInSyncLayout adds a channel to the canonical layout if it's not already in any category.
func (a *App) EnsureChannelInSyncLayout(rctx request.CTX, channel *model.Channel) *model.AppError {
	if !a.IsChannelSyncEnabled() {
		return nil
	}
	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return nil
	}

	layout, err := a.Srv().Store().ChannelSync().GetLayout(channel.TeamId)
	if err != nil {
		return model.NewAppError("EnsureChannelInSyncLayout", "app.channel_sync.ensure.store_error", nil, "", 500).Wrap(err)
	}
	if layout == nil || len(layout.Categories) == 0 {
		return nil
	}

	// Check if channel already in layout
	if layout.FindCategoryForChannel(channel.Id) != nil {
		return nil
	}

	// Find the default category (first one, or one named "Channels")
	targetCat := layout.Categories[0]
	for _, cat := range layout.Categories {
		if cat.DisplayName == "Channels" {
			targetCat = cat
			break
		}
	}

	targetCat.ChannelIds = append(targetCat.ChannelIds, channel.Id)
	layout.UpdateAt = model.GetMillis()

	if err := a.Srv().Store().ChannelSync().SaveLayout(layout); err != nil {
		return model.NewAppError("EnsureChannelInSyncLayout", "app.channel_sync.ensure.save_error", nil, "", 500).Wrap(err)
	}

	a.publishChannelSyncUpdate(channel.TeamId)
	return nil
}

// --- Layout Edit Mode helpers ---

// GetAllChannelsForLayoutEditor returns all channels in a team for Layout Edit Mode.
func (a *App) GetAllChannelsForLayoutEditor(rctx request.CTX, userId string, teamId string, isSystemAdmin bool) ([]*model.Channel, *model.AppError) {
	if isSystemAdmin {
		// System Admin: get ALL channels in the team via GetAllChannels with team filter
		page := 0
		perPage := 200
		opts := store.ChannelSearchOpts{
			TeamIds: []string{teamId},
		}
		var result []*model.Channel
		for {
			channels, err := a.Srv().Store().Channel().GetAllChannels(page, perPage, opts)
			if err != nil {
				return nil, model.NewAppError("GetAllChannelsForLayoutEditor", "app.channel_sync.editor.store_error", nil, "", 500).Wrap(err)
			}
			for _, ch := range channels {
				if ch.TeamId == teamId && ch.DeleteAt == 0 && (ch.Type == model.ChannelTypeOpen || ch.Type == model.ChannelTypePrivate) {
					result = append(result, &ch.Channel)
				}
			}
			if len(channels) < perPage {
				break
			}
			page++
		}
		return result, nil
	}

	// Team Admin: public channels + private channels they're in
	publicChannels, err := a.Srv().Store().Channel().GetPublicChannelsForTeam(teamId, 0, 10000)
	if err != nil {
		return nil, model.NewAppError("GetAllChannelsForLayoutEditor", "app.channel_sync.editor.public_error", nil, "", 500).Wrap(err)
	}

	memberships, err := a.Srv().Store().Channel().GetMembersForUser(teamId, userId)
	if err != nil {
		return nil, model.NewAppError("GetAllChannelsForLayoutEditor", "app.channel_sync.editor.members_error", nil, "", 500).Wrap(err)
	}

	channelMap := make(map[string]*model.Channel)
	for i := range publicChannels {
		ch := publicChannels[i]
		if ch.DeleteAt == 0 {
			channelMap[ch.Id] = ch
		}
	}

	// Add private channels the team admin is a member of
	for _, m := range memberships {
		if _, exists := channelMap[m.ChannelId]; !exists {
			ch, chErr := a.GetChannel(rctx, m.ChannelId)
			if chErr == nil && ch.Type == model.ChannelTypePrivate && ch.TeamId == teamId && ch.DeleteAt == 0 {
				channelMap[ch.Id] = ch
			}
		}
	}

	result := make([]*model.Channel, 0, len(channelMap))
	for _, ch := range channelMap {
		result = append(result, ch)
	}
	return result, nil
}

// --- Dismissal management ---

// DismissQuickJoinChannel records a user dismissing a Quick Join channel.
func (a *App) DismissQuickJoinChannel(rctx request.CTX, userId string, channelId string, teamId string) *model.AppError {
	err := a.Srv().Store().ChannelSync().SaveDismissal(&model.ChannelSyncDismissal{
		UserId:    userId,
		ChannelId: channelId,
		TeamId:    teamId,
	})
	if err != nil {
		return model.NewAppError("DismissQuickJoinChannel", "app.channel_sync.dismiss.store_error", nil, "", 500).Wrap(err)
	}
	return nil
}

// ClearDismissalOnJoin removes a dismissal when a user joins a channel.
func (a *App) ClearDismissalOnJoin(rctx request.CTX, userId string, channelId string, teamId string) *model.AppError {
	err := a.Srv().Store().ChannelSync().DeleteDismissal(userId, channelId, teamId)
	if err != nil {
		return model.NewAppError("ClearDismissalOnJoin", "app.channel_sync.clear_dismissal.store_error", nil, "", 500).Wrap(err)
	}
	return nil
}

// --- WebSocket publishing ---

// publishChannelSyncUpdate broadcasts a channel sync layout change to all users in the team.
func (a *App) publishChannelSyncUpdate(teamId string) {
	event := model.NewWebSocketEvent(model.WebsocketEventChannelSyncUpdated, teamId, "", "", nil, "")
	event.Add("team_id", teamId)
	a.Publish(event)
}
