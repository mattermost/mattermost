// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// GetTeamLoad assembles the aggregate TeamLoadResponse for the given user and team.
//
// Pass since=0 for a full response; pass the cursor returned by a previous call for
// a delta response (only changed data since that cursor is returned).
//
// Sidebar categories are included when since==0 (cold start) or when the sidebar
// was mutated after the client's cursor (sidebarVersion > since). The client does not
// need to send a separate sidebar_version parameter — the since cursor is sufficient.
func (a *App) GetTeamLoad(rctx request.CTX, userID, teamID string, since int64) (*model.TeamLoadResponse, *model.AppError) {
	// Verify the user is a member of the requested team.
	_, appErr := a.GetTeamMember(rctx, teamID, userID)
	if appErr != nil {
		return nil, model.NewAppError("GetTeamLoad", "app.team_load.not_member.app_error", nil, "", http.StatusForbidden).Wrap(appErr)
	}

	// -----------------------------------------------------------------------
	// Parallel fan-out
	// -----------------------------------------------------------------------
	var (
		allChannels    model.ChannelList
		channelMembers model.ChannelMembersWithTeamData
		sidebarCats    *model.OrderedSidebarCategories
		removedChIDs   []string
		prefs          model.Preferences
	)

	var eg errgroup.Group

	eg.Go(func() error {
		opts := &model.ChannelSearchOpts{
			IncludeDeleted: since > 0,
		}
		chans, err := a.GetChannelsForTeamForUser(rctx, teamID, userID, opts)
		if err != nil {
			return err
		}
		// GetChannelsForTeamForUser includes DM/GM channels (OR ch.TeamId = '').
		// Filter to this team only.
		filtered := make(model.ChannelList, 0, len(chans))
		for _, ch := range chans {
			if ch.TeamId == teamID {
				filtered = append(filtered, ch)
			}
		}
		allChannels = filtered
		return nil
	})

	eg.Go(func() error {
		cursor := &model.ChannelMemberCursor{Page: 0, PerPage: 10000}
		members, err := a.GetChannelMembersWithTeamDataForUserWithPagination(rctx, userID, cursor)
		if err != nil {
			return err
		}
		channelMembers = members
		return nil
	})

	eg.Go(func() error {
		cats, err := a.GetSidebarCategoriesForTeamForUser(rctx, userID, teamID)
		if err != nil {
			return err
		}
		sidebarCats = cats
		return nil
	})

	// Fetch preferences to determine sidebar version.
	eg.Go(func() error {
		allPrefs, err := a.GetPreferencesForUser(rctx, userID)
		if err != nil {
			return err
		}
		prefs = allPrefs
		return nil
	})

	// Channel tombstones — channels the user left since the cursor (scoped to team via SQL JOIN)
	if since > 0 {
		eg.Go(func() error {
			ids, err := a.Srv().Store().ChannelMemberHistory().GetChannelsLeftInTeamSince(userID, teamID, since)
			if err != nil {
				return model.NewAppError("GetTeamLoad", "app.team_load.channel_history.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			removedChIDs = ids
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetTeamLoad", "app.team_load.fanout.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// -----------------------------------------------------------------------
	// Filter channel members to this team only
	// -----------------------------------------------------------------------
	teamChIDs := make(map[string]struct{}, len(allChannels))
	for _, ch := range allChannels {
		teamChIDs[ch.Id] = struct{}{}
	}

	scopedMembers := make(model.ChannelMembersWithTeamData, 0, len(channelMembers))
	for i := range channelMembers {
		if _, ok := teamChIDs[channelMembers[i].ChannelId]; ok {
			scopedMembers = append(scopedMembers, channelMembers[i])
		}
	}

	// -----------------------------------------------------------------------
	// Delta filtering
	// -----------------------------------------------------------------------
	changedChannels := allChannels
	changedMembers := scopedMembers

	if since > 0 {
		filtered := make(model.ChannelList, 0, len(allChannels))
		for _, ch := range allChannels {
			if ch.UpdateAt > since {
				filtered = append(filtered, ch)
			}
		}
		changedChannels = filtered

		filteredCM := make(model.ChannelMembersWithTeamData, 0, len(scopedMembers))
		for i := range scopedMembers {
			if scopedMembers[i].LastUpdateAt > since {
				filteredCM = append(filteredCM, scopedMembers[i])
			}
		}
		changedMembers = filteredCM
	}

	// -----------------------------------------------------------------------
	// Roles — collect unique names from all scoped members, then delta filter
	// -----------------------------------------------------------------------
	roleNames := collectRoleNamesFromMembers(scopedMembers)
	roles, rolesErr := a.GetRolesByNames(roleNames)
	if rolesErr != nil {
		return nil, rolesErr
	}
	if since > 0 {
		filtered := make([]*model.Role, 0, len(roles))
		for _, r := range roles {
			if r.UpdateAt > since {
				filtered = append(filtered, r)
			}
		}
		roles = filtered
	}

	// -----------------------------------------------------------------------
	// Sidebar — omit when the client's cursor is newer than the last sidebar
	// mutation. Since the sidebar version IS a timestamp, the check is simply:
	// include when since==0 (cold start) or sidebarVersion > since (changed).
	// -----------------------------------------------------------------------
	serverSidebarVersion := getSidebarVersion(prefs, teamID)
	if since > 0 && serverSidebarVersion <= since {
		sidebarCats = nil
	}

	// -----------------------------------------------------------------------
	// Build channel + member lists
	// -----------------------------------------------------------------------
	chList := make([]*model.ChannelLoadItem, 0, len(changedChannels))
	inChList := make(map[string]struct{}, len(changedChannels))
	for _, ch := range changedChannels {
		chList = append(chList, toChannelLoadItem(ch))
		inChList[ch.Id] = struct{}{}
	}

	cmList := make([]*model.ChannelMemberLoadItem, 0, len(changedMembers))
	for i := range changedMembers {
		cmList = append(cmList, toChannelMemberLoadItem(&changedMembers[i]))
	}

	// Companion slim channel items: for every changed member whose channel is
	// not in the delta chList (Channel.UpdateAt unchanged), emit a minimal item
	// so the client can recompute unread counts without needing a schema change.
	// See toSlimChannelLoadItem for the rationale on why update_at is zero.
	allChByID := make(map[string]*model.Channel, len(allChannels))
	for _, ch := range allChannels {
		allChByID[ch.Id] = ch
	}
	for _, cm := range cmList {
		if _, alreadyInList := inChList[cm.ChannelId]; alreadyInList {
			continue
		}
		ch, ok := allChByID[cm.ChannelId]
		if !ok {
			continue
		}
		chList = append(chList, toSlimChannelLoadItem(ch))
		inChList[cm.ChannelId] = struct{}{}
	}

	return &model.TeamLoadResponse{
		Channels: chList,
		ChannelMembers: model.ChannelMemberLoadList{
			Members:           cmList,
			RemovedChannelIds: removedChIDs,
		},
		SidebarCategories: sidebarCats,
		SidebarVersion:    serverSidebarVersion,
		Roles:             toRoleLoadItems(roles),
		Timestamp:         model.GetMillis(),
	}, nil
}

// collectRoleNamesFromMembers returns the deduplicated set of role name strings
// from a slice of channel members.
func collectRoleNamesFromMembers(members model.ChannelMembersWithTeamData) []string {
	seen := make(map[string]struct{})
	for _, cm := range members {
		for _, r := range strings.Fields(cm.Roles) {
			seen[r] = struct{}{}
		}
	}
	names := make([]string, 0, len(seen))
	for n := range seen {
		names = append(names, n)
	}
	return names
}
