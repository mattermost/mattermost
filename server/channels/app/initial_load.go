// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/sync/errgroup"
	"golang.org/x/text/collate"
	"golang.org/x/text/language"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	preferenceTeamsOrder                 = "teams_order"
	preferenceChannelApproximateViewTime = "channel_approximate_view_time"
	preferenceChannelOpenTime            = "channel_open_time"
)

// initialLoadPreferenceCategories lists the preference categories included in
// InitialLoadResponse. Categories not in this list (e.g. tutorial_step,
// recommended_next_steps, oauth_app) are excluded because clients do not use them.
var initialLoadPreferenceCategories = []string{
	model.PreferenceCategoryDirectChannelShow,
	model.PreferenceCategoryGroupChannelShow,
	model.PreferenceCategoryFavoriteChannel,
	model.PreferenceCategoryDisplaySettings,
	model.PreferenceCategoryAdvancedSettings,
	model.PreferenceCategorySidebarSettings,
	model.PreferenceCategoryNotifications,
	model.PreferenceCategoryCustomStatus,
	model.PreferenceCategoryFlaggedPost,
	model.PreferenceCategoryTheme,
	preferenceTeamsOrder,
	// Required for server-side DM/GM visibility filtering (replicates client's
	// filterAutoclosedDMs which uses these as a fallback for lastViewedAt).
	preferenceChannelApproximateViewTime,
	preferenceChannelOpenTime,
}

// GetInitialLoad assembles the aggregate InitialLoadResponse for the given user.
//
// activeTeamID is the client's currently known active team. When empty the server
// resolves the active team from the user's teams_order preference and
// ExperimentalPrimaryTeam config (mirroring the mobile selectDefaultTeam logic).
//
// activeChannelID is the client's last known active channel, used to populate PriorityHints.
//
// Pass since=0 for a full cold-start response; pass the cursor returned by a
// previous call for a delta response.
func (a *App) GetInitialLoad(rctx request.CTX, userID string, activeTeamID string, activeChannelID string, since int64, listPublicTeams, listPrivateTeams bool) (*model.InitialLoadResponse, *model.AppError) {
	// -----------------------------------------------------------------------
	// Phase A — fully parallel, no inter-dependencies
	// -----------------------------------------------------------------------
	var (
		me                *model.User
		teams             []*model.Team
		deletedTeams      []*model.Team // archived teams (Team.DeleteAt > since); delta only
		teamMembers       []*model.TeamMember
		prefs             model.Preferences
		prefTombstones    []model.PreferenceTombstone
		canJoinOtherTeams bool
		groupMemberships  *model.InitialLoadGroupMembershipList
	)

	var egA errgroup.Group

	egA.Go(func() error {
		var appErr *model.AppError
		me, appErr = a.GetUser(userID)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	egA.Go(func() error {
		var appErr *model.AppError
		teams, appErr = a.GetTeamsForUser(userID)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	// In delta mode, also fetch soft-deleted (archived) teams the user is still
	// a member of (TeamMembers.DeleteAt = 0) but whose Teams.DeleteAt > since.
	// GetTeamsForUser only returns active teams; archived teams need this separate call.
	if since > 0 {
		egA.Go(func() error {
			var appErr *model.AppError
			deletedTeams, appErr = a.GetDeletedTeamsForUserSince(userID, since)
			if appErr != nil {
				return appErr
			}
			return nil
		})
	}

	egA.Go(func() error {
		var appErr *model.AppError
		teamMembers, appErr = a.GetTeamMembersForUser(rctx, userID, "", since > 0)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	egA.Go(func() error {
		allPrefs, err := a.GetPreferencesForUser(rctx, userID)
		if err != nil {
			return err
		}
		categorySet := make(map[string]struct{}, len(initialLoadPreferenceCategories))
		for _, c := range initialLoadPreferenceCategories {
			categorySet[c] = struct{}{}
		}
		prefs = make(model.Preferences, 0, len(allPrefs))
		for _, p := range allPrefs {
			if _, ok := categorySet[p.Category]; ok {
				prefs = append(prefs, p)
			}
		}
		return nil
	})

	// CanJoinOtherTeams — single EXISTS query, gated by ListPublicTeams /
	// ListPrivateTeams permissions (skipped entirely when both are false).
	egA.Go(func() error {
		canJoin, err := a.Srv().Store().Team().UserCanJoinAnyTeam(userID, listPublicTeams, listPrivateTeams)
		if err != nil {
			return model.NewAppError("GetInitialLoad", "app.team.user_can_join_any_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		canJoinOtherTeams = canJoin
		return nil
	})

	egA.Go(func() error {
		var err error
		groupMemberships, err = a.Srv().Store().Group().GetMembershipsByUser(userID, since)
		if err != nil {
			return model.NewAppError("GetInitialLoad", "app.initial_load.get_group_memberships.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	if since > 0 {
		egA.Go(func() error {
			var err error
			prefTombstones, err = a.Srv().Store().Preference().GetDeletedSince(userID, since)
			if err != nil {
				return model.NewAppError("GetInitialLoad", "app.initial_load.get_preference_tombstones.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		})
	}

	if err := egA.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.phase_a.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// -----------------------------------------------------------------------
	// Delta filtering — Phase A results
	// -----------------------------------------------------------------------
	// Me: nil if the user profile has not changed since the cursor.
	if since > 0 && me != nil && me.UpdateAt <= since {
		me = nil
	}

	// Build tombstoned-team set from two sources:
	//   1. TeamMember.DeleteAt > 0  — user left the team (soft delete on membership)
	//   2. deletedTeams             — team was archived (Team.DeleteAt > since);
	//      GetTeamsForUser never returns these so we fetch them separately above.
	// Tombstoned teams are excluded from badge aggregate queries and from the Teams
	// array — they are surfaced only via RemovedTeamIds in the TeamMembers response.
	tombstonedTeamIDs := make(map[string]struct{})
	for _, tm := range teamMembers {
		if tm.DeleteAt > 0 {
			tombstonedTeamIDs[tm.TeamId] = struct{}{}
		}
	}
	for _, t := range deletedTeams {
		tombstonedTeamIDs[t.Id] = struct{}{}
	}

	// Teams delta filtering happens AFTER Phase B because we need teamsUnread to
	// decide whether a team with no metadata change should still be included
	// (any team with badge data must always be present in the response).
	// changedTeams is populated after egB.Wait() below.
	// Preferences: no UpdateAt column — always send full list.

	// -----------------------------------------------------------------------
	// Resolve active team
	// -----------------------------------------------------------------------
	var locale = *a.Config().LocalizationSettings.DefaultClientLocale
	if me != nil {
		locale = me.Locale
	}
	resolvedTeamID := a.resolveActiveTeam(activeTeamID, teams, prefs, locale)

	// Stale team_id hint: if the client passed a team_id but the user is no
	// longer in that team (resolveActiveTeam rejected the hint), surface the
	// reason in RemovedTeamIds even on a cold start (since==0). This covers two
	// cases:
	//   1. Membership was removed: GetTeamMember returns a soft-deleted record.
	//   2. Team was archived/deleted: GetTeam returns a record with DeleteAt > 0.
	// On cold start GetTeamMembersForUser already excludes deleted memberships and
	// deletedTeams is not fetched, so neither case is captured above. The single
	// targeted lookup here closes that gap and lets the mobile client clean up
	// its local DB immediately on the next app launch.
	if activeTeamID != "" && activeTeamID != resolvedTeamID {
		if _, alreadyTombstoned := tombstonedTeamIDs[activeTeamID]; !alreadyTombstoned {
			if tm, appErr := a.GetTeamMember(rctx, activeTeamID, userID); appErr == nil && tm.DeleteAt > 0 {
				// Case 1: user was removed from the team.
				tombstonedTeamIDs[activeTeamID] = struct{}{}
			} else if t, appErr := a.GetTeam(activeTeamID); appErr == nil && t.DeleteAt > 0 {
				// Case 2: team was archived or deleted.
				tombstonedTeamIDs[activeTeamID] = struct{}{}
			}
		}
	}

	// -----------------------------------------------------------------------
	// Phase B — depends on active team being known
	// -----------------------------------------------------------------------
	var (
		teamChannels       model.ChannelList
		dmChannels         model.ChannelList
		channelMembers     model.ChannelMembersWithTeamData
		sidebarCats        *model.OrderedSidebarCategories
		teamsUnread        []*model.TeamUnread
		dmThreadMentions   int64
		dmThreadUrgent     int64
		dmThreadHasUnreads bool
		removedChIDs       []string
	)

	isCRT := a.IsCRTEnabledForUser(rctx, userID)
	dmLimit := getDMLimit(prefs)

	var egB errgroup.Group

	// Channels for the active team (skipped when the user has no teams yet)
	if resolvedTeamID != "" {
		egB.Go(func() error {
			opts := &model.ChannelSearchOpts{
				IncludeDeleted: since > 0,
			}
			chans, err := a.GetChannelsForTeamForUser(rctx, resolvedTeamID, userID, opts)
			if err != nil {
				return err
			}
			teamChannels = chans
			return nil
		})
	}

	// DM and GM channels (cross-team). Fetch ALL so the server-side visibility
	// filter (selectVisibleDMGMChannels) has the complete set — it replicates
	// the mobile filterManuallyClosedDms + filterAutoclosedDMs + sortChannels
	// logic using preferences and sidebar category state, and applies dmLimit.
	egB.Go(func() error {
		chans, err := a.GetChannelsForUser(rctx, userID, since > 0, 0, -1, "")
		if err != nil {
			// A 404 means the user has no DM/GM channels yet — treat as empty.
			if err.StatusCode == http.StatusNotFound {
				return nil
			}
			return err
		}
		filtered := make(model.ChannelList, 0, len(chans))
		for _, ch := range chans {
			if ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
				filtered = append(filtered, ch)
			}
		}
		dmChannels = filtered
		return nil
	})

	// Channel members for the user (all channels)
	egB.Go(func() error {
		cursor := &model.ChannelMemberCursor{Page: 0, PerPage: 10000}
		members, err := a.GetChannelMembersWithTeamDataForUserWithPagination(rctx, userID, cursor)
		if err != nil {
			return err
		}
		channelMembers = members
		return nil
	})

	// Sidebar categories for the active team (skipped when the user has no teams yet)
	if resolvedTeamID != "" {
		egB.Go(func() error {
			cats, err := a.GetSidebarCategoriesForTeamForUser(rctx, userID, resolvedTeamID)
			if err != nil {
				return err
			}
			sidebarCats = cats
			return nil
		})
	}

	// Team unread counts for all teams
	egB.Go(func() error {
		unreads, err := a.GetTeamsUnreadForUser("", userID, isCRT)
		if err != nil {
			return err
		}
		teamsUnread = unreads
		return nil
	})

	// DM/GM thread counts — query threads where ThreadTeamId is empty/NULL directly
	// to avoid the tombstone-team subtraction bug in GetTotalUnreadMentions.
	if isCRT {
		egB.Go(func() error {
			hasUnreads, mentions, urgent, err := a.Srv().Store().Thread().GetDMGMThreadCounts(userID, a.IsPostPriorityEnabled())
			if err != nil {
				return model.NewAppError("GetInitialLoad", "app.initial_load.dm_thread_counts.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			dmThreadHasUnreads = hasUnreads
			dmThreadMentions = mentions
			dmThreadUrgent = urgent
			return nil
		})
	}

	// Channel tombstones — channels the user left since the cursor
	if since > 0 && resolvedTeamID != "" {
		egB.Go(func() error {
			ids, err := a.Srv().Store().ChannelMemberHistory().GetChannelsLeftInTeamSince(userID, resolvedTeamID, since)
			if err != nil {
				return model.NewAppError("GetInitialLoad", "app.initial_load.channel_history.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			removedChIDs = ids
			return nil
		})
	}

	if err := egB.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.phase_b.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Merge team channels + ALL DM/GM channels for Phase C profile fetch.
	// selectVisibleDMGMChannels (below) needs the full profile map — including
	// deactivated-user detection — so profiles must be fetched before filtering.
	allChannels := mergeChannels(teamChannels, dmChannels)

	// -----------------------------------------------------------------------
	// Phase C — parallel: roles + DM/GM member profiles for display names
	// -----------------------------------------------------------------------
	var (
		roles                 []*model.Role
		dmGMProfilesByChannel map[string][]*model.User
	)

	var egC errgroup.Group

	egC.Go(func() error {
		roleNames := collectRoleNames(me, teamMembers, channelMembers)
		var appErr *model.AppError
		roles, appErr = a.GetRolesByNames(roleNames)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	// Fetch member profiles for all DM and GM channels.
	// Uses GetDMGMProfilesByChannelIds which:
	//   - Returns the full profile fields needed for DirectProfiles (display name,
	//     locale, notify_props, etc.) — richer than GetMembersInfoByChannelIds.
	//   - Does NOT filter by Channels.DeleteAt, so deactivated-user DMs are included
	//     for deactivation detection in filterAutoclosedDMs / buildDirectChannelCounts.
	//   - Applies since filter: in delta mode only returns profiles updated/deleted
	//     since the cursor (sufficient for display-name change detection and DirectProfiles).
	//   - On cold start (since == 0) returns all participants.
	// Uses the full dmChannels list (all DM/GMs before visibility filtering).
	egC.Go(func() error {
		channelIDs := make([]string, 0, len(dmChannels))
		for _, ch := range dmChannels {
			channelIDs = append(channelIDs, ch.Id)
		}
		if len(channelIDs) == 0 {
			return nil
		}
		profiles, err := a.Srv().Store().Channel().GetDMGMProfilesByChannelIds(channelIDs, userID, since)
		if err != nil {
			// Non-fatal: fall back to empty display names (client will resolve)
			rctx.Logger().Warn("GetInitialLoad: failed to fetch DM/GM member profiles", mlog.Err(err))
			return nil
		}
		dmGMProfilesByChannel = profiles
		return nil
	})

	if err := egC.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.phase_c.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Apply the same DM/GM visibility rules all clients use:
	// filterManuallyClosedDms → filterAutoclosedDMs → sortChannels.
	// This produces only the channels that should appear in the sidebar,
	// including channels explicitly placed in any non-direct_messages category
	// (favorites, channels, custom). Requires dmGMProfilesByChannel for
	// deactivated-user detection, hence placement after Phase C.
	dmChannels = selectVisibleDMGMChannels(userID, activeChannelID, dmChannels, channelMembers, sidebarCats, prefs, dmGMProfilesByChannel, dmLimit, isCRT, locale)

	// Rebuild allChannels with the filtered DM/GM set.
	allChannels = mergeChannels(teamChannels, dmChannels)

	// -----------------------------------------------------------------------
	// Delta filtering — channels + channel members + roles
	// Done here (after Phase C) so DM/GM member profiles are available for
	// profile-driven name-change detection.
	//
	// allChannels and channelMembers remain the FULL lists — they are used
	// for scope (member filtering, unread counts, priority hints, display
	// names). changedChannels and changedChannelMembers carry only what the
	// client needs to update its cache.
	// -----------------------------------------------------------------------
	// activeSince is the cursor used for active-team-scoped data: channels,
	// channel members, sidebar categories, and team-scoped roles.
	// DM/GM channels and direct profiles are cross-team and keep the original
	// since cursor; they are not affected by a team switch.
	//
	// When the client passes an explicit team_id hint that gets rejected (user
	// removed, team archived, etc.), the resolved active team is different from
	// what the client expected.  The client has no local data for the newly
	// resolved team, so drop the cursor to 0 for all team-scoped data.
	// This does NOT apply when the client sent no team_id hint (activeTeamID==""),
	// in which case the server freely resolves a team and the client's since
	// cursor is still valid for delta filtering.
	activeSince := since
	if since > 0 && activeTeamID != "" && resolvedTeamID != activeTeamID {
		activeSince = 0
	}

	changedChannels := allChannels
	changedChannelMembers := channelMembers
	if activeSince > 0 {
		changedChannels = filterChannelsSince(allChannels, dmGMProfilesByChannel, activeSince)

		filteredCM := make(model.ChannelMembersWithTeamData, 0, len(channelMembers))
		for i := range channelMembers {
			if channelMembers[i].LastUpdateAt > activeSince {
				filteredCM = append(filteredCM, channelMembers[i])
			}
		}
		changedChannelMembers = filteredCM

		// Roles: only those whose permissions changed since the cursor.
		// Roles are global but scoped to what the active team's channels need —
		// drop to 0 if the active team changed (client may be missing role defs).
		filteredRoles := make([]*model.Role, 0, len(roles))
		for _, r := range roles {
			if r.UpdateAt > activeSince {
				filteredRoles = append(filteredRoles, r)
			}
		}
		roles = filteredRoles
	}

	// -----------------------------------------------------------------------
	// Teams delta filtering — done here (after Phase B) so teamsUnread is
	// available. Include a team in the response if ANY of:
	//   1. Team metadata changed (UpdateAt > since) — or cold start (since == 0)
	//   2. Team has active badge data (mentions, unreads, thread mentions/unreads)
	//   3. Team is tombstoned — surfaced via RemovedTeamIds, NOT in Teams array
	// Tombstoned teams are never in the Teams array regardless of since.
	// -----------------------------------------------------------------------
	unreadByTeam := make(map[string]*model.TeamUnread, len(teamsUnread))
	for _, u := range teamsUnread {
		unreadByTeam[u.TeamId] = u
	}

	var changedTeams []*model.Team
	if since == 0 {
		// Cold start: include all non-tombstoned teams.
		changedTeams = make([]*model.Team, 0, len(teams))
		for _, t := range teams {
			if _, isTombstoned := tombstonedTeamIDs[t.Id]; !isTombstoned {
				changedTeams = append(changedTeams, t)
			}
		}
	} else {
		// Delta: include team if metadata changed OR has any badge data.
		changedTeams = make([]*model.Team, 0, len(teams))
		for _, t := range teams {
			if _, isTombstoned := tombstonedTeamIDs[t.Id]; isTombstoned {
				continue // tombstoned — never in Teams array
			}
			if t.UpdateAt > since {
				changedTeams = append(changedTeams, t)
				continue
			}
			// Include if team has any badge-relevant data (mentions or unreads).
			if u, ok := unreadByTeam[t.Id]; ok {
				hasBadge := u.MentionCount > 0 || u.MentionCountRoot > 0 ||
					u.MsgCount > 0 ||
					u.ThreadMentionCount > 0 || u.ThreadCount > 0
				if hasBadge {
					changedTeams = append(changedTeams, t)
				}
			}
		}
	}

	// -----------------------------------------------------------------------
	// TeamMembers delta scoping — in delta mode, only send memberships for:
	//   1. Teams present in changedTeams (the Teams array of this response)
	//   2. The active team (always included)
	//   3. Tombstoned teams (client needs to know the user left/team deleted)
	// On cold start (since == 0), send all memberships as before.
	// -----------------------------------------------------------------------
	scopedTeamMembers := teamMembers
	if since > 0 {
		// Build inclusion set: changedTeams + active team + tombstoned teams.
		includedTeamIDs := make(map[string]struct{}, len(changedTeams)+len(tombstonedTeamIDs)+1)
		for _, t := range changedTeams {
			includedTeamIDs[t.Id] = struct{}{}
		}
		if resolvedTeamID != "" {
			includedTeamIDs[resolvedTeamID] = struct{}{}
		}
		for tid := range tombstonedTeamIDs {
			includedTeamIDs[tid] = struct{}{}
		}
		scopedTeamMembers = make([]*model.TeamMember, 0, len(teamMembers))
		for _, tm := range teamMembers {
			if _, ok := includedTeamIDs[tm.TeamId]; ok {
				scopedTeamMembers = append(scopedTeamMembers, tm)
			}
		}
	}

	// Determine effective name display format and pre-build DM/GM display names
	// server-side so the client doesn't need extra profile fetches to render the list.
	nameFormat := effectiveNameFormat(prefs, a.Config())
	enrichDMGMDisplayNames(userID, allChannels, dmGMProfilesByChannel, nameFormat)

	// Build GM member counts from the profiles map populated in Phase C.
	// dmGMProfilesByChannel maps channelId → []*User with all members of each
	// DM/GM channel. For GMs, len(profiles) == member count.
	gmMemberCounts := make(map[string]int64, len(dmGMProfilesByChannel))
	for chID, profiles := range dmGMProfilesByChannel {
		gmMemberCounts[chID] = int64(len(profiles))
	}

	// -----------------------------------------------------------------------
	// DirectProfiles — profiles of DM/GM participants visible to the user.
	// GetDMGMProfilesByChannelIds already applied the since filter and excluded
	// the requesting user. buildDirectProfiles only deduplicates across channels.
	// -----------------------------------------------------------------------
	directProfiles := buildDirectProfiles(dmGMProfilesByChannel)

	// -----------------------------------------------------------------------
	// Sidebar — omit when client cursor is newer than last sidebar mutation.
	// Uses activeSince (0 when the active team changed) so the full sidebar is
	// always sent when the client has no local data for the resolved team.
	// -----------------------------------------------------------------------
	if activeSince > 0 && getSidebarVersion(prefs, resolvedTeamID) <= activeSince {
		sidebarCats = nil
	}

	// -----------------------------------------------------------------------
	// Assemble response
	// -----------------------------------------------------------------------
	resp := &model.InitialLoadResponse{
		Me:                   toInitialLoadUser(me),
		Teams:                toInitialLoadTeams(changedTeams, teamsUnread, isCRT),
		TeamMembers:          toInitialLoadTeamMemberList(scopedTeamMembers, tombstonedTeamIDs),
		ActiveTeam:           toInitialLoadActiveTeam(resolvedTeamID, teams, allChannels, changedChannels, channelMembers, changedChannelMembers, sidebarCats, removedChIDs, prefs, gmMemberCounts),
		Roles:                toRoleLoadItems(roles),
		Preferences:          prefs,
		DirectChannelCounts:  buildDirectChannelCounts(userID, channelMembers, dmGMProfilesByChannel, prefs, isCRT, dmThreadHasUnreads, dmThreadMentions, dmThreadUrgent),
		DirectProfiles:       directProfiles,
		Timestamp:            model.GetMillis(),
		PriorityHints:        buildPriorityHints(resolvedTeamID, activeChannelID, allChannels, channelMembers),
		CanJoinOtherTeams:    canJoinOtherTeams,
		GroupMemberships:     toInitialLoadGroupMembershipList(groupMemberships),
		PreferenceTombstones: prefTombstones,
	}

	return resp, nil
}

// toInitialLoadGroupMembershipList returns nil when there is nothing to send
// (no members and no tombstones), avoiding an empty object in the JSON response.
func toInitialLoadGroupMembershipList(list *model.InitialLoadGroupMembershipList) *model.InitialLoadGroupMembershipList {
	if list == nil || (len(list.Members) == 0 && len(list.RemovedGroupIds) == 0) {
		return nil
	}
	return list
}

// resolveActiveTeam picks the active team ID from:
//  1. Client hint (activeTeamID) — used if the user is still a member
//  2. ExperimentalPrimaryTeam server config (matched by team Name)
//  3. teams_order preference (comma-separated ordered team IDs)
//  4. First team in the list
func (a *App) resolveActiveTeam(hintID string, teams []*model.Team, prefs model.Preferences, userLocale string) string {
	if len(teams) == 0 {
		return ""
	}

	teamByID := make(map[string]*model.Team, len(teams))
	for _, t := range teams {
		teamByID[t.Id] = t
	}

	// 1. Client hint
	if hintID != "" {
		if _, ok := teamByID[hintID]; ok {
			return hintID
		}
	}

	// 2. ExperimentalPrimaryTeam config (matched by team Name)
	if primaryTeamName := *a.Config().TeamSettings.ExperimentalPrimaryTeam; primaryTeamName != "" {
		for _, t := range teams {
			if t.Name == primaryTeamName {
				return t.Id
			}
		}
	}

	// 3. teams_order preference — comma-separated ordered team IDs
	for _, p := range prefs {
		if p.Category == preferenceTeamsOrder {
			for _, id := range strings.Split(p.Value, ",") {
				id = strings.TrimSpace(id)
				if _, ok := teamByID[id]; ok {
					return id
				}
			}
		}
	}

	// 4. Fallback: sort by locale
	var lang = language.English
	if tag, err := language.Parse(userLocale); err == nil {
		lang = tag
	}

	cl := collate.New(lang)
	sortedTeams := slices.Clone(teams)
	sort.Slice(sortedTeams, func(i, j int) bool {
		// Apply lowercasing if necessary for case-insensitive locale sorting
		s1 := strings.ToLower(sortedTeams[i].DisplayName)
		s2 := strings.ToLower(sortedTeams[j].DisplayName)
		return cl.CompareString(s1, s2) < 0
	})
	mlog.Info("SORTED TEAMS", mlog.Array("teams", sortedTeams))

	return sortedTeams[0].Id
}

// getDMLimit reads the limit_visible_dms_gms preference. Defaults to 20 if unset.
func getDMLimit(prefs model.Preferences) int {
	for _, p := range prefs {
		if p.Category == model.PreferenceCategorySidebarSettings && p.Name == model.PreferenceLimitVisibleDmsGms {
			if v, err := strconv.Atoi(p.Value); err == nil && v > 0 {
				return v
			}
		}
	}
	return 20 // matches CHANNEL_SIDEBAR_LIMIT_DMS_DEFAULT on mobile
}

// effectiveNameFormat returns the display name format to use for DM/GM names.
// Respects LockTeammateNameDisplay: if locked, the server config wins over user pref.
func effectiveNameFormat(prefs model.Preferences, cfg *model.Config) string {
	if cfg.TeamSettings.LockTeammateNameDisplay != nil && *cfg.TeamSettings.LockTeammateNameDisplay {
		if cfg.TeamSettings.TeammateNameDisplay != nil {
			return *cfg.TeamSettings.TeammateNameDisplay
		}
	}
	for _, p := range prefs {
		if p.Category == model.PreferenceCategoryDisplaySettings && p.Name == model.PreferenceNameNameFormat {
			return p.Value
		}
	}
	if cfg.TeamSettings.TeammateNameDisplay != nil {
		return *cfg.TeamSettings.TeammateNameDisplay
	}
	return model.ShowUsername
}

// displayNameForUser formats a user's display name according to nameFormat.
// Mirrors the client-side displayUsername() function used in both mobile and webapp.
func displayNameForUser(u *model.User, nameFormat string) string {
	var name string
	switch nameFormat {
	case model.ShowNicknameFullName:
		name = u.Nickname
		if name == "" {
			name = strings.TrimSpace(u.FirstName + " " + u.LastName)
		}
	case model.ShowFullName:
		name = strings.TrimSpace(u.FirstName + " " + u.LastName)
	}
	if name == "" {
		name = u.Username
	}
	return name
}

// enrichDMGMDisplayNames builds server-side display names for DM and GM channels,
// mirroring what the client would compute from user profiles.
//
// For DMs: formats the partner user's name. For self-DMs (both sides same user),
// falls back to the user's own name.
// For GMs: formats all members excluding self, sorts alphabetically, joins with ", ".
func enrichDMGMDisplayNames(userID string, channels model.ChannelList, profilesByChannel map[string][]*model.User, nameFormat string) {
	if len(profilesByChannel) == 0 {
		return
	}
	for _, ch := range channels {
		members, ok := profilesByChannel[ch.Id]
		if !ok || len(members) == 0 {
			continue
		}
		switch ch.Type {
		case model.ChannelTypeDirect:
			// Find the partner (the member that isn't the current user).
			// For self-DMs all members share the same user ID, so fall back
			// to the user's own profile.
			var displayUser *model.User
			for _, u := range members {
				if u.Id != userID {
					displayUser = u
					break
				}
			}
			if displayUser == nil {
				// Self-DM: use the user's own profile (first member).
				displayUser = members[0]
			}
			ch.DisplayName = displayNameForUser(displayUser, nameFormat)
		case model.ChannelTypeGroup:
			// Format all members excluding self, sort, join with ", "
			names := make([]string, 0, len(members))
			for _, u := range members {
				if u.Id != userID {
					names = append(names, displayNameForUser(u, nameFormat))
				}
			}
			sort.Strings(names)
			ch.DisplayName = strings.Join(names, ", ")
		}
	}
}

// filterChannelsSince returns channels updated since the cursor.
// For DM/GM channels, a channel is included if the channel itself changed OR
// if any member's profile changed (their name may appear in the display name).
func filterChannelsSince(channels model.ChannelList, profilesByChannel map[string][]*model.User, since int64) model.ChannelList {
	out := make(model.ChannelList, 0, len(channels))
	for _, ch := range channels {
		if ch.UpdateAt > since {
			out = append(out, ch)
			continue
		}
		if ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
			for _, u := range profilesByChannel[ch.Id] {
				if u.UpdateAt > since {
					out = append(out, ch)
					break
				}
			}
		}
	}
	return out
}

// mergeChannels combines two channel lists, deduplicating by ID.
func mergeChannels(a, b model.ChannelList) model.ChannelList {
	seen := make(map[string]struct{}, len(a)+len(b))
	out := make(model.ChannelList, 0, len(a)+len(b))
	for _, ch := range a {
		if _, ok := seen[ch.Id]; !ok {
			seen[ch.Id] = struct{}{}
			out = append(out, ch)
		}
	}
	for _, ch := range b {
		if _, ok := seen[ch.Id]; !ok {
			seen[ch.Id] = struct{}{}
			out = append(out, ch)
		}
	}
	return out
}

// collectRoleNames returns the deduplicated set of role name strings needed for
// client-side permission computation.
func collectRoleNames(me *model.User, teamMembers []*model.TeamMember, channelMembers model.ChannelMembersWithTeamData) []string {
	seen := make(map[string]struct{})
	add := func(roles string) {
		for _, r := range strings.Fields(roles) {
			seen[r] = struct{}{}
		}
	}
	if me != nil {
		add(me.Roles)
	}
	for _, tm := range teamMembers {
		add(tm.Roles)
	}
	for _, cm := range channelMembers {
		add(cm.Roles)
	}
	names := make([]string, 0, len(seen))
	for n := range seen {
		names = append(names, n)
	}
	return names
}

// --- Compact conversion helpers ---

func toInitialLoadUser(u *model.User) *model.InitialLoadUser {
	if u == nil {
		return nil
	}
	return &model.InitialLoadUser{
		Id:                     u.Id,
		CreateAt:               u.CreateAt,
		UpdateAt:               u.UpdateAt,
		DeleteAt:               u.DeleteAt,
		Username:               u.Username,
		AuthService:            u.AuthService,
		Email:                  u.Email,
		Nickname:               u.Nickname,
		FirstName:              u.FirstName,
		LastName:               u.LastName,
		Position:               u.Position,
		Roles:                  u.Roles,
		Props:                  u.Props,
		NotifyProps:            u.NotifyProps,
		LastPictureUpdate:      u.LastPictureUpdate,
		Locale:                 u.Locale,
		Timezone:               u.Timezone,
		TermsOfServiceId:       u.TermsOfServiceId,
		TermsOfServiceCreateAt: u.TermsOfServiceCreateAt,
	}
}

func toInitialLoadTeams(teams []*model.Team, unreads []*model.TeamUnread, isCRT bool) []*model.InitialLoadTeam {
	unreadByTeam := make(map[string]*model.TeamUnread, len(unreads))
	for _, u := range unreads {
		unreadByTeam[u.TeamId] = u
	}
	out := make([]*model.InitialLoadTeam, 0, len(teams))
	for _, t := range teams {
		out = append(out, toInitialLoadTeam(t, unreadByTeam[t.Id], isCRT))
	}
	return out
}

func toInitialLoadTeam(t *model.Team, unread *model.TeamUnread, isCRT bool) *model.InitialLoadTeam {
	lt := &model.InitialLoadTeam{
		Id:                 t.Id,
		CreateAt:           t.CreateAt,
		UpdateAt:           t.UpdateAt,
		DeleteAt:           t.DeleteAt,
		DisplayName:        t.DisplayName,
		Name:               t.Name,
		Type:               t.Type,
		InviteId:           t.InviteId,
		GroupConstrained:   t.GroupConstrained,
		LastTeamIconUpdate: t.LastTeamIconUpdate,
	}
	if unread != nil {
		if isCRT {
			lt.MentionCount = unread.MentionCountRoot
			lt.MentionCountRoot = unread.MentionCountRoot
		} else {
			lt.MentionCount = unread.MentionCount
		}
		lt.HasUnreads = unread.MsgCount > 0
		lt.ThreadMentionCount = unread.ThreadMentionCount
		lt.ThreadUrgentMentionCount = unread.ThreadUrgentMentionCount
		lt.ThreadHasUnreads = unread.ThreadCount > 0 || unread.ThreadMentionCount > 0
	}
	return lt
}

// toInitialLoadTeamMemberList converts team memberships to the compact wire format.
// tombstonedTeamIDs is the union of teams the user left (TeamMember.DeleteAt > 0)
// and teams that were archived (Team.DeleteAt > since). All tombstoned team IDs go
// into RemovedTeamIds; their memberships are excluded from the active Members list.
// This lets the client remove all local data for those teams in one pass.
func toInitialLoadTeamMemberList(members []*model.TeamMember, tombstonedTeamIDs map[string]struct{}) *model.InitialLoadTeamMemberList {
	out := make([]*model.InitialLoadTeamMember, 0, len(members))
	for _, m := range members {
		if _, isTombstoned := tombstonedTeamIDs[m.TeamId]; isTombstoned {
			continue
		}
		out = append(out, &model.InitialLoadTeamMember{
			TeamId:      m.TeamId,
			UserId:      m.UserId,
			Roles:       m.Roles,
			DeleteAt:    m.DeleteAt,
			SchemeGuest: m.SchemeGuest,
			SchemeUser:  m.SchemeUser,
			SchemeAdmin: m.SchemeAdmin,
		})
	}

	removedTeamIDs := make([]string, 0, len(tombstonedTeamIDs))
	for teamID := range tombstonedTeamIDs {
		removedTeamIDs = append(removedTeamIDs, teamID)
	}

	return &model.InitialLoadTeamMemberList{
		Members:        out,
		RemovedTeamIds: removedTeamIDs,
	}
}

func toInitialLoadActiveTeam(
	teamID string,
	teams []*model.Team,
	// allChannels is the full merged list — used to build the scope set of
	// channel IDs that belong to this team (for member filtering).
	allChannels model.ChannelList,
	// changedChannels is the delta-filtered subset sent to the client.
	// On cold start it equals allChannels.
	changedChannels model.ChannelList,
	// allChannelMembers is the full member list — not sent directly but used
	// to scope members to the active team + DMs/GMs.
	allChannelMembers model.ChannelMembersWithTeamData,
	// changedChannelMembers is the delta-filtered subset sent to the client.
	// On cold start it equals allChannelMembers.
	changedChannelMembers model.ChannelMembersWithTeamData,
	sidebarCats *model.OrderedSidebarCategories,
	removedChIDs []string,
	prefs model.Preferences,
	// gmMemberCounts maps GM channel IDs to their total member count,
	// derived from the DM/GM profiles fetched in Phase C.
	gmMemberCounts map[string]int64,
) *model.InitialLoadActiveTeam {
	var activeTeam *model.Team
	for _, t := range teams {
		if t.Id == teamID {
			activeTeam = t
			break
		}
	}
	if activeTeam == nil {
		return nil
	}

	// Build the scope set from the FULL channel list so that member filtering
	// is correct even when changedChannels is a small delta subset.
	scopeChIDs := make(map[string]struct{}, len(allChannels))
	for _, ch := range allChannels {
		if ch.TeamId == teamID || ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
			scopeChIDs[ch.Id] = struct{}{}
		}
	}

	// Build the Channels list from the delta subset only.
	chList := make([]*model.ChannelLoadItem, 0, len(changedChannels))
	inChList := make(map[string]struct{}, len(changedChannels))
	for _, ch := range changedChannels {
		if ch.TeamId == teamID || ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
			c := toChannelLoadItem(ch)
			if ch.Type == model.ChannelTypeGroup {
				c.MemberCount = gmMemberCounts[ch.Id]
			}
			chList = append(chList, c)
			inChList[ch.Id] = struct{}{}
		}
	}

	// Filter changed members to those within the active-team scope.
	// GetChannelMembersWithTeamDataForUserWithPagination returns members
	// across ALL teams; we only want the active team + DMs/GMs here.
	cmList := make([]*model.ChannelMemberLoadItem, 0, len(changedChannelMembers))
	for i := range changedChannelMembers {
		if _, ok := scopeChIDs[changedChannelMembers[i].ChannelId]; ok {
			cmList = append(cmList, toChannelMemberLoadItem(&changedChannelMembers[i]))
		}
	}

	// Companion slim channel items: for every channel member whose channel did
	// not make it into the delta chList (because Channel.UpdateAt <= since, so
	// only activity counters changed), emit a minimal ChannelLoadItem carrying
	// just the fields the client needs to recompute unread counts:
	//   total_msg_count / total_msg_count_root → derive message_count (unread)
	//   last_post_at / last_root_post_at        → derive is_unread, last_post_at
	// update_at is intentionally set to 0 so the mobile handleChannel guard
	// (which skips records where incoming update_at == stored updateAt) always
	// treats this as a no-op on the CHANNEL table — only MY_CHANNEL is updated.
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

	return &model.InitialLoadActiveTeam{
		Team:     toInitialLoadTeam(activeTeam, nil, false),
		Channels: chList,
		ChannelMembers: model.ChannelMemberLoadList{
			Members:           cmList,
			RemovedChannelIds: removedChIDs,
		},
		SidebarCategories: sidebarCats,
		SidebarVersion:    getSidebarVersion(prefs, teamID),
	}
}

func toChannelLoadItem(ch *model.Channel) *model.ChannelLoadItem {
	return &model.ChannelLoadItem{
		Id:                ch.Id,
		CreateAt:          ch.CreateAt,
		UpdateAt:          ch.UpdateAt,
		DeleteAt:          ch.DeleteAt,
		TeamId:            ch.TeamId,
		Type:              ch.Type,
		DisplayName:       ch.DisplayName,
		Name:              ch.Name,
		LastPostAt:        ch.LastPostAt,
		TotalMsgCount:     ch.TotalMsgCount,
		CreatorId:         ch.CreatorId,
		GroupConstrained:  ch.GroupConstrained,
		Shared:            ch.Shared,
		TotalMsgCountRoot: ch.TotalMsgCountRoot,
		LastRootPostAt:    ch.LastRootPostAt,
		PolicyEnforced:    ch.PolicyEnforced,
	}
}

// toSlimChannelLoadItem returns a minimal ChannelLoadItem for a channel whose
// metadata has not changed (UpdateAt <= since) but whose activity counters
// (TotalMsgCount, LastPostAt) may have advanced due to new posts.
// The client needs these counters to recompute unread counts for the paired
// ChannelMemberLoadItem.  update_at is included with its real value so that
// the mobile handleChannel guard (skip when incoming update_at == stored value)
// correctly treats this as a no-op on the CHANNEL table — only MY_CHANNEL is
// updated as a result.
func toSlimChannelLoadItem(ch *model.Channel) *model.ChannelLoadItem {
	return &model.ChannelLoadItem{
		Id:                ch.Id,
		UpdateAt:          ch.UpdateAt,
		LastPostAt:        ch.LastPostAt,
		TotalMsgCount:     ch.TotalMsgCount,
		TotalMsgCountRoot: ch.TotalMsgCountRoot,
		LastRootPostAt:    ch.LastRootPostAt,
	}
}

func toChannelMemberLoadItem(cm *model.ChannelMemberWithTeamData) *model.ChannelMemberLoadItem {
	return &model.ChannelMemberLoadItem{
		ChannelId:               cm.ChannelId,
		UserId:                  cm.UserId,
		Roles:                   cm.Roles,
		LastViewedAt:            cm.LastViewedAt,
		NotifyProps:             cm.NotifyProps,
		MsgCount:                cm.MsgCount,
		MentionCount:            cm.MentionCount,
		MentionCountRoot:        cm.MentionCountRoot,
		UrgentMentionCount:      cm.UrgentMentionCount,
		MsgCountRoot:            cm.MsgCountRoot,
		LastUpdateAt:            cm.LastUpdateAt,
		SchemeGuest:             cm.SchemeGuest,
		SchemeUser:              cm.SchemeUser,
		SchemeAdmin:             cm.SchemeAdmin,
		AutoTranslationDisabled: cm.AutoTranslationDisabled,
	}
}

func toRoleLoadItems(roles []*model.Role) []*model.RoleLoadItem {
	out := make([]*model.RoleLoadItem, 0, len(roles))
	for _, r := range roles {
		out = append(out, &model.RoleLoadItem{
			Id:          r.Id,
			Name:        r.Name,
			CreateAt:    r.CreateAt,
			UpdateAt:    r.UpdateAt,
			DeleteAt:    r.DeleteAt,
			Permissions: r.Permissions,
		})
	}
	return out
}

// buildDirectProfiles converts the DM/GM profiles map into a flat deduplicated list
// of InitialLoadUser for the DirectProfiles response field.
//
// profilesByChannel is already pre-filtered by GetDMGMProfilesByChannelIds:
//   - requesting user is excluded
//   - in delta mode: only profiles with UpdateAt > since OR DeleteAt > since
//   - deactivated users (DeleteAt > since) are included even for invisible DMs
//
// The only work left here is deduplication across channels (a user can be a
// member of multiple DM/GM channels and appear under multiple channel keys).
func buildDirectProfiles(profilesByChannel map[string][]*model.User) []*model.InitialLoadUser {
	if len(profilesByChannel) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	var out []*model.InitialLoadUser
	for _, profiles := range profilesByChannel {
		for _, u := range profiles {
			if _, already := seen[u.Id]; already {
				continue
			}
			seen[u.Id] = struct{}{}
			out = append(out, toInitialLoadUser(u))
		}
	}
	return out
}

// buildDirectChannelCounts aggregates unread counts across ALL DM/GM channels
// the user belongs to, excluding:
//   - muted channels (mark_unread == "mention")
//   - DMs with deactivated users where deleteAt > lastViewedAt (same rule as
//     filterAutoclosedDMs — the channel won't appear in the sidebar so its
//     counts should not contribute to the badge)
//
// Uses channelMembers (TeamName == "" identifies DM/GM channels) so no cap applies.
func buildDirectChannelCounts(
	userID string,
	channelMembers model.ChannelMembersWithTeamData,
	profilesByChannel map[string][]*model.User,
	prefs model.Preferences,
	isCRT bool,
	dmThreadHasUnreads bool,
	dmThreadMentions int64,
	dmThreadUrgent int64,
) *model.InitialLoadDirectCounts {
	// Index DM/GM channel members for lastViewedAt fallback computation.
	cmByChannel := make(map[string]*model.ChannelMemberWithTeamData, len(channelMembers))
	for i := range channelMembers {
		if channelMembers[i].TeamName == "" {
			cmByChannel[channelMembers[i].ChannelId] = &channelMembers[i]
		}
	}
	lastViewed := buildDMLastViewedAt(cmByChannel, prefs)

	var counts model.InitialLoadDirectCounts
	for i := range channelMembers {
		cm := &channelMembers[i]
		if cm.TeamName != "" {
			continue // regular team channel
		}
		isMuted := cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
		if isMuted {
			continue
		}

		// Exclude DMs with deactivated teammates (same rule as filterAutoclosedDMs):
		// skip if teammate.DeleteAt > lastViewedAt (deactivated after last view).
		lv := lastViewed[cm.ChannelId]
		if profiles, ok := profilesByChannel[cm.ChannelId]; ok {
			deactivated := false
			for _, u := range profiles {
				if u.Id != userID && u.DeleteAt > 0 && u.DeleteAt > lv {
					deactivated = true
					break
				}
			}
			if deactivated {
				continue
			}
		}

		if isCRT {
			counts.MentionCount += cm.MentionCountRoot
			counts.MentionCountRoot += cm.MentionCountRoot
			if cm.MsgCountRoot > 0 || cm.MentionCountRoot > 0 {
				counts.HasUnreads = true
			}
		} else {
			counts.MentionCount += cm.MentionCount
			if cm.MsgCount > 0 || cm.MentionCount > 0 {
				counts.HasUnreads = true
			}
		}
		counts.UrgentMentionCount += cm.UrgentMentionCount
	}

	// DM/GM thread unread counts — fetched directly via GetDMGMThreadCounts which
	// queries ThreadTeamId = '' / NULL directly (no tombstone-team subtraction needed).
	counts.ThreadHasUnreads = dmThreadHasUnreads
	counts.ThreadMentionCount = dmThreadMentions
	counts.ThreadUrgentMentionCount = dmThreadUrgent

	if counts.MentionCount == 0 && !counts.HasUnreads && counts.ThreadMentionCount == 0 && !counts.ThreadHasUnreads {
		return nil
	}
	return &counts
}

func buildPriorityHints(
	activeTeamID string,
	activeChannelID string,
	channels model.ChannelList,
	channelMembers model.ChannelMembersWithTeamData,
) *model.InitialLoadPriorityHints {
	hints := &model.InitialLoadPriorityHints{
		ActiveTeamID:    activeTeamID,
		ActiveChannelID: activeChannelID,
	}

	memberByChannel := make(map[string]*model.ChannelMemberWithTeamData, len(channelMembers))
	for i := range channelMembers {
		memberByChannel[channelMembers[i].ChannelId] = &channelMembers[i]
	}
	for _, ch := range channels {
		cm, ok := memberByChannel[ch.Id]
		if !ok {
			continue
		}
		if cm.UrgentMentionCount > 0 {
			hints.UrgentChannels = append(hints.UrgentChannels, ch.Id)
		}
	}

	return hints
}

// dmEntry bundles a DM/GM channel with its membership and derived state for filtering.
type dmEntry struct {
	ch         *model.Channel
	cm         *model.ChannelMemberWithTeamData
	lastViewed int64 // max(cm.LastViewedAt, approx_view_time pref, open_time pref)
	unread     bool  // mirrors client isUnreadChannel
}

// buildDMLastViewedAt returns a map of channelId → effective lastViewedAt, taking
// the max of the channel member's LastViewedAt and the channel_approximate_view_time
// / channel_open_time preferences (which the client writes to persist view times
// across sessions when LastViewedAt may not have been updated by the server).
func buildDMLastViewedAt(channelMembers map[string]*model.ChannelMemberWithTeamData, prefs model.Preferences) map[string]int64 {
	lva := make(map[string]int64, len(channelMembers))
	for id, cm := range channelMembers {
		lva[id] = cm.LastViewedAt
	}
	for _, p := range prefs {
		if p.Category == preferenceChannelApproximateViewTime || p.Category == preferenceChannelOpenTime {
			if ts, err := strconv.ParseInt(p.Value, 10, 64); err == nil && ts > lva[p.Name] {
				lva[p.Name] = ts
			}
		}
	}
	return lva
}

// dmIsUnread mirrors the client isUnreadChannel: mentionsCount > 0 OR
// (not muted AND msgCount > 0). CRT-aware.
func dmIsUnread(cm *model.ChannelMemberWithTeamData, isCRT bool) bool {
	if cm == nil {
		return false
	}
	isMuted := cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
	if isCRT {
		return cm.MentionCountRoot > 0 || (!isMuted && cm.MsgCountRoot > 0)
	}
	return cm.MentionCount > 0 || (!isMuted && cm.MsgCount > 0)
}

// filterManuallyClosedDMEntries replicates the client filterManuallyClosedDms:
// removes DMs where direct_channel_show[teammateId] == "false" and GMs where
// group_channel_show[channelId] == "false", unless the channel is unread or
// pinned in a non-direct_messages sidebar category.
func filterManuallyClosedDMEntries(entries []dmEntry, prefs model.Preferences, userID string, pinnedElsewhere map[string]struct{}) []dmEntry {
	directShowFalse := make(map[string]bool)
	groupShowFalse := make(map[string]bool)
	for _, p := range prefs {
		if p.Category == model.PreferenceCategoryDirectChannelShow && p.Value == "false" {
			directShowFalse[p.Name] = true
		}
		if p.Category == model.PreferenceCategoryGroupChannelShow && p.Value == "false" {
			groupShowFalse[p.Name] = true
		}
	}

	result := entries[:0]
	for _, e := range entries {
		if e.unread {
			result = append(result, e)
			continue
		}
		if _, pinned := pinnedElsewhere[e.ch.Id]; pinned {
			result = append(result, e)
			continue
		}
		if e.ch.Type == model.ChannelTypeDirect {
			parts := strings.SplitN(e.ch.Name, "__", 2)
			teammateID := ""
			if len(parts) == 2 {
				if parts[0] == userID {
					teammateID = parts[1]
				} else {
					teammateID = parts[0]
				}
			}
			if directShowFalse[teammateID] {
				continue
			}
		}
		if e.ch.Type == model.ChannelTypeGroup && groupShowFalse[e.ch.Id] {
			continue
		}
		result = append(result, e)
	}
	return result
}

// filterAutoclosedDMEntries replicates the client filterAutoclosedDMs:
// removes never-opened channels and DMs with deactivated teammates
// (deleteAt > lastViewedAt) unless unread, then sorts and limits to
// max(dmLimit, unreadCount). Channels pinned in other categories bypass
// the limit and are returned separately.
func filterAutoclosedDMEntries(
	entries []dmEntry,
	currentChannelID string,
	userID string,
	profilesByChannel map[string][]*model.User,
	dmLimit int,
	pinnedElsewhere map[string]struct{},
) (dmCat []dmEntry, pinned []*model.Channel) {
	for _, e := range entries {
		if _, ok := pinnedElsewhere[e.ch.Id]; ok {
			pinned = append(pinned, e.ch)
			continue
		}
		// Never opened and not unread.
		if e.lastViewed == 0 && !e.unread {
			continue
		}
		// DM with deactivated teammate (deleteAt > lastViewedAt): exclude unless unread.
		if !e.unread && e.ch.Type == model.ChannelTypeDirect {
			if profiles, ok := profilesByChannel[e.ch.Id]; ok {
				deactivated := false
				for _, u := range profiles {
					if u.Id != userID && u.DeleteAt > 0 && u.DeleteAt > e.lastViewed {
						deactivated = true
						break
					}
				}
				if deactivated {
					continue
				}
			}
		}
		dmCat = append(dmCat, e)
	}

	// Sort: current channel first, then unread, then lastViewedAt desc.
	sort.SliceStable(dmCat, func(i, j int) bool {
		a, b := dmCat[i], dmCat[j]
		if a.ch.Id == currentChannelID {
			return true
		}
		if b.ch.Id == currentChannelID {
			return false
		}
		if a.unread != b.unread {
			return a.unread
		}
		return a.lastViewed > b.lastViewed
	})

	// Apply limit: max(dmLimit, unreadCount).
	unreadCount := 0
	for _, e := range dmCat {
		if e.unread {
			unreadCount++
		}
	}
	remaining := dmLimit
	if unreadCount > remaining {
		remaining = unreadCount
	}
	if len(dmCat) > remaining {
		dmCat = dmCat[:remaining]
	}
	return dmCat, pinned
}

// sortDMEntries replicates the client sortChannels for the direct_messages category.
func sortDMEntries(entries []dmEntry, sorting model.SidebarCategorySorting, sortOrderByID map[string]int, locale string) []dmEntry {
	switch sorting {
	case model.SidebarCategorySortAlphabetical:
		col := collate.New(language.Make(locale), collate.Numeric)
		sort.SliceStable(entries, func(i, j int) bool {
			a, b := entries[i], entries[j]
			aMuted := a.cm != nil && a.cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
			bMuted := b.cm != nil && b.cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
			if aMuted != bMuted {
				return !aMuted // muted channels last
			}
			return col.CompareString(a.ch.DisplayName, b.ch.DisplayName) < 0
		})
	case model.SidebarCategorySortManual:
		sort.SliceStable(entries, func(i, j int) bool {
			return sortOrderByID[entries[i].ch.Id] < sortOrderByID[entries[j].ch.Id]
		})
	default: // SidebarCategorySortRecent (default for DMs) and ""
		sort.SliceStable(entries, func(i, j int) bool {
			a := max(entries[i].ch.LastPostAt, entries[i].ch.CreateAt)
			b := max(entries[j].ch.LastPostAt, entries[j].ch.CreateAt)
			return a > b
		})
	}
	return entries
}

// selectVisibleDMGMChannels applies the full client-side DM/GM visibility
// pipeline to produce the list of channels that belong in active_team.channels:
//
//  1. filterManuallyClosedDms
//  2. filterAutoclosedDMs (with limit)
//  3. Always include channels pinned in non-direct_messages sidebar categories
//  4. sortChannels using the direct_messages category's sorting preference
func selectVisibleDMGMChannels(
	userID string,
	currentChannelID string,
	allDMChannels model.ChannelList,
	channelMembers model.ChannelMembersWithTeamData,
	sidebarCats *model.OrderedSidebarCategories,
	prefs model.Preferences,
	profilesByChannel map[string][]*model.User,
	dmLimit int,
	isCRT bool,
	locale string,
) model.ChannelList {
	if len(allDMChannels) == 0 {
		return allDMChannels
	}

	// Index DM/GM channel members by channel ID.
	cmByChannel := make(map[string]*model.ChannelMemberWithTeamData, len(channelMembers))
	for i := range channelMembers {
		if channelMembers[i].TeamName == "" {
			cmByChannel[channelMembers[i].ChannelId] = &channelMembers[i]
		}
	}

	lastViewed := buildDMLastViewedAt(cmByChannel, prefs)

	// Identify channels pinned in non-direct_messages categories and locate
	// the direct_messages category for its sorting config.
	pinnedElsewhere := make(map[string]struct{})
	var dmCategory *model.SidebarCategoryWithChannels
	if sidebarCats != nil {
		for _, cat := range sidebarCats.Categories {
			if cat.Type == model.SidebarCategoryDirectMessages {
				dmCategory = cat
				continue
			}
			for _, chID := range cat.Channels {
				pinnedElsewhere[chID] = struct{}{}
			}
		}
	}

	// Build initial entry list.
	entries := make([]dmEntry, 0, len(allDMChannels))
	for _, ch := range allDMChannels {
		cm := cmByChannel[ch.Id]
		entries = append(entries, dmEntry{
			ch:         ch,
			cm:         cm,
			lastViewed: lastViewed[ch.Id],
			unread:     dmIsUnread(cm, isCRT),
		})
	}

	entries = filterManuallyClosedDMEntries(entries, prefs, userID, pinnedElsewhere)
	dmCatEntries, pinnedChannels := filterAutoclosedDMEntries(entries, currentChannelID, userID, profilesByChannel, dmLimit, pinnedElsewhere)

	// Merge dmCat + pinned, dedup.
	seen := make(map[string]struct{}, len(dmCatEntries)+len(pinnedChannels))
	finalEntries := make([]dmEntry, 0, len(dmCatEntries)+len(pinnedChannels))
	for _, e := range dmCatEntries {
		if _, ok := seen[e.ch.Id]; !ok {
			seen[e.ch.Id] = struct{}{}
			finalEntries = append(finalEntries, e)
		}
	}
	for _, ch := range pinnedChannels {
		if _, ok := seen[ch.Id]; !ok {
			seen[ch.Id] = struct{}{}
			finalEntries = append(finalEntries, dmEntry{ch: ch, cm: cmByChannel[ch.Id], lastViewed: lastViewed[ch.Id]})
		}
	}

	// Determine sorting from the direct_messages category.
	sorting := model.SidebarCategorySortRecent // default for DMs
	sortOrderByID := make(map[string]int)
	if dmCategory != nil {
		if dmCategory.Sorting != "" {
			sorting = dmCategory.Sorting
		}
		for idx, chID := range dmCategory.Channels {
			sortOrderByID[chID] = idx
		}
	}

	finalEntries = sortDMEntries(finalEntries, sorting, sortOrderByID, locale)

	result := make(model.ChannelList, len(finalEntries))
	for i, e := range finalEntries {
		result[i] = e.ch
	}
	return result
}

// getSidebarVersion reads the per-team sidebar_version preference value.
// The key is stored as category="sidebar_settings", name="sidebar_version_{teamId}".
// The value is a millisecond timestamp written by sidebar mutation paths (create,
// update, delete, reorder). Returns 0 if not yet set — sidebar is always included
// on since==0 (cold start) and the timestamp comparison (sidebarVersion > since)
// naturally includes it when 0 <= since, so the first load always sends sidebar.
func getSidebarVersion(prefs model.Preferences, teamID string) int64 {
	key := "sidebar_version_" + teamID
	for _, p := range prefs {
		if p.Category == model.PreferenceCategorySidebarSettings && p.Name == key {
			if v, err := strconv.ParseInt(p.Value, 10, 64); err == nil {
				return v
			}
		}
	}
	return 0
}
