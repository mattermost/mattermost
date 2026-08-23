// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"maps"
	"net/http"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// GetInitialLoad assembles the aggregate InitialLoadResponse for the given user.
//
// activeTeamID is the client's currently known active team. When empty the server
// resolves the active team from the user's teams_order preference and
// ExperimentalPrimaryTeam config (mirroring the client selectDefaultTeam logic).
//
// Pass since=0 for a full cold-start response; pass the cursor returned by a
// previous call for a delta response.
func (a *App) GetInitialLoad(rctx request.CTX, userID string, activeTeamID string, activeChannelID string, since int64, listPublicTeams, listPrivateTeams bool) (*model.InitialLoadResponse, *model.AppError) {
	var (
		baseData          *experienceLoadSnapshot
		me                *model.User
		teams             []*model.Team
		deletedTeams      []*model.Team
		teamMembers       []*model.TeamMember
		prefs             model.Preferences
		prefTombstones    []model.PreferenceTombstone
		canJoinOtherTeams bool
		groupMemberships  *model.ExperienceGroupMembershipList
	)

	baseLoadGroup, _ := errgroup.WithContext(rctx.Context())

	baseLoadGroup.Go(func() error {
		var appErr *model.AppError
		baseData, appErr = a.loadExperienceSnapshot(rctx, userID, since, experienceLoadErrorKeys{
			function:  "GetInitialLoad",
			loadError: "app.initial_load.base_data.error",
		})
		if appErr != nil {
			return appErr
		}
		return nil
	})

	// CanJoinOtherTeams: single EXISTS query gated by ListPublicTeams /
	// ListPrivateTeams permissions (skipped entirely when both are false).
	baseLoadGroup.Go(func() error {
		canJoin, err := a.Srv().Store().Team().UserCanJoinAnyTeam(userID, listPublicTeams, listPrivateTeams)
		if err != nil {
			return model.NewAppError("GetInitialLoad", "app.team.user_can_join_any_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		canJoinOtherTeams = canJoin
		return nil
	})

	if err := baseLoadGroup.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.base_data.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	me = baseData.me
	teams = baseData.teams
	deletedTeams = baseData.deletedTeams
	teamMembers = baseData.teamMembers
	prefs = baseData.prefs
	prefTombstones = baseData.prefTombstones
	groupMemberships = baseData.groupMemberships

	// Capture locale before the delta suppression below nils me — team/DM sort
	// ordering needs the user's real locale even when the profile itself is omitted.
	var locale = *a.Config().LocalizationSettings.DefaultClientLocale
	if me != nil {
		locale = me.Locale
	}

	// Delta: suppress unchanged user profile.
	if since > 0 && me != nil && me.UpdateAt <= since {
		me = nil
	}

	// Build tombstoned-team set from two sources:
	//   1. TeamMember.DeleteAt > 0  — user left the team (soft delete on membership)
	//   2. deletedTeams             — team was archived (Team.DeleteAt > since)
	// GetTeamsForUser never returns archived teams so we fetch them separately.
	tombstonedTeamIDs := buildTombstonedTeamIDs(teamMembers, deletedTeams)

	resolvedTeamID := a.resolveActiveTeam(activeTeamID, teams, prefs, locale)

	// Stale team_id hint: if the client passed a team_id the user no longer belongs to,
	// surface the reason in RemovedTeamIds even on a cold start (since==0). This covers:
	//   1. Membership was removed: GetTeamMember returns a soft-deleted record.
	//   2. Team was archived/deleted: GetTeam returns a record with DeleteAt > 0.
	// On cold start GetTeamMembersForUser excludes deleted memberships and deletedTeams
	// is not fetched, so neither case is captured above. The targeted lookup here closes
	// that gap and lets the client clean up its local DB.
	if activeTeamID != "" && activeTeamID != resolvedTeamID {
		if _, alreadyTombstoned := tombstonedTeamIDs[activeTeamID]; !alreadyTombstoned {
			if tm, appErr := a.GetTeamMember(rctx, activeTeamID, userID); appErr == nil && tm.DeleteAt > 0 {
				tombstonedTeamIDs[activeTeamID] = struct{}{}
			} else if t, appErr := a.GetTeam(activeTeamID); appErr == nil && t.DeleteAt > 0 {
				tombstonedTeamIDs[activeTeamID] = struct{}{}
			}
		}
	}

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

	teamDataGroup, _ := errgroup.WithContext(rctx.Context())

	// selectVisibleDMGMChannels needs the complete DM/GM set to apply dmLimit.
	// DM/GM channels have an empty TeamId and GetChannels matches
	// "TeamId = resolvedTeamID OR TeamId = ''", so the team query already returns
	// all of them; split that result rather than issuing a second equivalent query.
	// Only when no team resolves do we need a dedicated DM/GM fetch.
	if resolvedTeamID != "" {
		teamDataGroup.Go(func() error {
			opts := &model.ChannelSearchOpts{
				IncludeDeleted: since > 0,
			}
			chans, err := a.GetChannelsForTeamForUser(rctx, resolvedTeamID, userID, opts)
			if err != nil {
				// An empty result set surfaces as 404; treat it as no channels
				// rather than failing the whole load.
				if err.StatusCode == http.StatusNotFound {
					return nil
				}
				return err
			}
			teamChannels = make(model.ChannelList, 0, len(chans))
			dmChannels = make(model.ChannelList, 0, len(chans))
			for _, ch := range chans {
				if ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
					dmChannels = append(dmChannels, ch)
				} else {
					teamChannels = append(teamChannels, ch)
				}
			}
			return nil
		})
	} else {
		teamDataGroup.Go(func() error {
			chans, err := a.GetChannelsForUser(rctx, userID, since > 0, 0, -1, "")
			if err != nil {
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
	}

	teamDataGroup.Go(func() error {
		members, err := a.getAllChannelMembersForUser(rctx, userID)
		if err != nil {
			return err
		}
		channelMembers = members
		return nil
	})

	if resolvedTeamID != "" {
		teamDataGroup.Go(func() error {
			cats, err := a.GetSidebarCategoriesForTeamForUser(rctx, userID, resolvedTeamID)
			if err != nil {
				return err
			}
			sidebarCats = cats
			return nil
		})
	}

	teamDataGroup.Go(func() error {
		unreads, err := a.GetTeamsUnreadForUserExperience("", userID, isCRT)
		if err != nil {
			return err
		}
		teamsUnread = unreads
		return nil
	})

	// DM/GM thread counts — query threads where ThreadTeamId is empty/NULL directly
	// to avoid the tombstone-team subtraction bug in GetTotalUnreadMentions.
	if isCRT {
		teamDataGroup.Go(func() error {
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

	if since > 0 && resolvedTeamID != "" {
		teamDataGroup.Go(func() error {
			ids, err := a.Srv().Store().ChannelMemberHistory().GetChannelsLeftInTeamSince(userID, resolvedTeamID, since)
			if err != nil {
				return model.NewAppError("GetInitialLoad", "app.initial_load.channel_history.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			removedChIDs = ids
			return nil
		})
	}

	if err := teamDataGroup.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.team_data.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var (
		allChannels           model.ChannelList
		roles                 []*model.Role
		dmGMProfilesByChannel map[string][]*model.User
	)

	profileAndRoleGroup, _ := errgroup.WithContext(rctx.Context())

	profileAndRoleGroup.Go(func() error {
		var appErr *model.AppError
		roles, appErr = a.getRolesSince(me, teamMembers, channelMembers, 0)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	// Fetch member profiles for all DM and GM channels. GetDMGMProfilesByChannelIds:
	//   - applies the since filter in delta mode (UpdateAt > since OR DeleteAt > since)
	//   - includes deactivated users so filterAutoclosedDMs can detect them
	//   - does NOT filter by Channels.DeleteAt so deactivated-user DMs are included
	profileAndRoleGroup.Go(func() error {
		channelIDs := make([]string, 0, len(dmChannels))
		for _, ch := range dmChannels {
			channelIDs = append(channelIDs, ch.Id)
		}
		if len(channelIDs) == 0 {
			return nil
		}
		profiles, err := a.Srv().Store().Channel().GetDMGMProfilesByChannelIds(channelIDs, userID, since)
		if err != nil {
			return model.NewAppError("GetInitialLoad", "app.initial_load.dm_profiles.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		dmGMProfilesByChannel = profiles
		return nil
	})

	if err := profileAndRoleGroup.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("GetInitialLoad", "app.initial_load.profile_role_data.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// In delta mode, dmGMProfilesByChannel only contains members whose profile changed
	// since the cursor. That's correct for DMs (only the partner's own profile matters),
	// but a GM's display name and member count depend on its FULL membership — if only
	// one member changed, using the delta-filtered set would truncate the name and
	// undercount members. Back-fill full membership for any GM that had at least one
	// changed member (GMs have a small member cap, so this stays cheap).
	if since > 0 {
		changedGMIDs := make([]string, 0, len(dmGMProfilesByChannel))
		for _, ch := range dmChannels {
			if ch.Type == model.ChannelTypeGroup {
				if _, changed := dmGMProfilesByChannel[ch.Id]; changed {
					changedGMIDs = append(changedGMIDs, ch.Id)
				}
			}
		}
		if len(changedGMIDs) > 0 {
			fullGMProfiles, err := a.Srv().Store().Channel().GetDMGMProfilesByChannelIds(changedGMIDs, userID, 0)
			if err != nil {
				return nil, model.NewAppError("GetInitialLoad", "app.initial_load.dm_profiles.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			maps.Copy(dmGMProfilesByChannel, fullGMProfiles)
		}
	}

	dmChannels = selectVisibleDMGMChannels(userID, activeChannelID, dmChannels, channelMembers, sidebarCats, prefs, dmGMProfilesByChannel, dmLimit, isCRT, locale)
	allChannels = mergeChannels(teamChannels, dmChannels)

	// activeSince: cursor used for team-scoped data (channels, members, sidebar, roles).
	// When the client's team_id hint is rejected (user removed, team archived), the client
	// has no local data for the newly resolved team — drop to 0 to force a full team sync.
	// This does NOT apply when the client sent no team_id hint (activeTeamID==""), in which
	// case the server resolves a team and the client's since cursor remains valid.
	activeSince := since
	if since > 0 && activeTeamID != "" && resolvedTeamID != activeTeamID {
		activeSince = 0
	}

	changedChannels := allChannels
	changedChannelMembers := channelMembers
	if activeSince > 0 {
		changedChannels = filterChannelsSince(allChannels, dmGMProfilesByChannel, activeSince)
		changedChannelMembers = filterMembersSince(channelMembers, activeSince)

		// Roles are global but scoped to the active team's needs — drop to 0 if the
		// team changed (client may be missing role definitions for the new team).
		// activeSince is only known here, after the DM/GM selection above, so the
		// roles were fetched unfiltered and the cursor is applied in memory.
		roles = filterRolesSince(roles, activeSince)
	}

	// Teams delta: include a team when ANY of:
	//   1. Team metadata changed (UpdateAt > since) — or cold start (since == 0)
	//   2. Team has active badge data (mentions, unreads)
	//   3. Team is tombstoned — surfaced via RemovedTeamIds, NOT in Teams array
	unreadByTeam := indexTeamUnreadsByTeamID(teamsUnread)

	var changedTeams []*model.Team
	if since == 0 {
		changedTeams = make([]*model.Team, 0, len(teams))
		for _, t := range teams {
			if _, isTombstoned := tombstonedTeamIDs[t.Id]; !isTombstoned {
				changedTeams = append(changedTeams, t)
			}
		}
	} else {
		changedTeams = make([]*model.Team, 0, len(teams))
		for _, t := range teams {
			if _, isTombstoned := tombstonedTeamIDs[t.Id]; isTombstoned {
				continue
			}
			if t.UpdateAt > since {
				changedTeams = append(changedTeams, t)
				continue
			}
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

	// TeamMembers: scope to teams in changedTeams + active team + tombstoned teams.
	scopedTeamMembers := teamMembers
	if since > 0 {
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

	nameFormat := effectiveNameFormat(prefs, a.Config())
	enrichDMGMDisplayNames(userID, allChannels, dmGMProfilesByChannel, nameFormat)

	gmMemberCounts := make(map[string]int64, len(dmGMProfilesByChannel))
	for chID, profiles := range dmGMProfilesByChannel {
		gmMemberCounts[chID] = int64(len(profiles))
	}

	directProfiles := buildDirectProfiles(dmGMProfilesByChannel, *a.Config().PrivacySettings.ShowEmailAddress)

	channelsByID := make(map[string]*model.Channel, len(allChannels))
	for _, ch := range allChannels {
		channelsByID[ch.Id] = ch
	}

	// Omit sidebar when client cursor is newer than the last sidebar mutation.
	// Uses activeSince (0 when the active team changed) so the full sidebar is always
	// sent when the client has no local data for the resolved team.
	if activeSince > 0 && getSidebarVersion(prefs, resolvedTeamID) <= activeSince {
		sidebarCats = nil
	}

	// Collect user IDs for presence: the requesting user + all DM/GM participants.
	statusUserIDs := make([]string, 0, 1+len(dmGMProfilesByChannel))
	statusUserIDs = append(statusUserIDs, userID)
	for _, profiles := range dmGMProfilesByChannel {
		for _, u := range profiles {
			statusUserIDs = append(statusUserIDs, u.Id)
		}
	}

	return &model.InitialLoadResponse{
		Me:                   toExperienceUser(me, true, true),
		Teams:                toExperienceTeams(changedTeams),
		TeamMembers:          toExperienceTeamMemberList(scopedTeamMembers, tombstonedTeamIDs),
		ActiveTeam:           toExperienceActiveTeam(resolvedTeamID, teams, allChannels, changedChannels, changedChannelMembers, sidebarCats, removedChIDs, prefs, gmMemberCounts),
		TeamUnreads:          toExperienceTeamUnreadsList(changedTeams, teamsUnread, isCRT),
		DirectUnreads:        buildDirectUnreads(userID, channelMembers, channelsByID, dmGMProfilesByChannel, prefs, isCRT, dmThreadHasUnreads, dmThreadMentions, dmThreadUrgent),
		DirectProfiles:       directProfiles,
		Roles:                toExperienceRoles(roles),
		Preferences:          prefs,
		PreferenceTombstones: prefTombstones,
		Timestamp:            model.GetMillis(),
		CanJoinOtherTeams:    canJoinOtherTeams,
		GroupMemberships:     toExperienceGroupMembershipList(groupMemberships),
		Statuses:             a.buildStatusSnapshot(statusUserIDs),
	}, nil
}
