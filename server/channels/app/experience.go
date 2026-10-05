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

// An empty activeTeamID resolves from teams_order/ExperimentalPrimaryTeam, mirroring
// the client's selectDefaultTeam. since=0 is a cold start; otherwise it's a delta cursor.
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

	// GetTeamsForUser never returns archived teams, so deletedTeams is fetched separately.
	tombstonedTeamIDs := buildTombstonedTeamIDs(teamMembers, deletedTeams)

	resolvedTeamID := a.resolveActiveTeam(activeTeamID, teams, prefs, locale)

	// On a cold start neither deleted memberships nor archived teams are fetched above,
	// so a stale team_id hint needs this targeted lookup to reach RemovedTeamIds.
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

	// DM/GM channels have an empty TeamId, which the team query already matches, so
	// its result is split rather than issuing a second equivalent query.
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
			chans, err := a.getAllDMGMChannelsForUser(rctx, userID, since > 0)
			if err != nil {
				if err.StatusCode == http.StatusNotFound {
					return nil
				}
				return err
			}
			dmChannels = chans
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

	// Bound the profile fetch below for accounts with a very large DM/GM
	// history; unread and pinned-elsewhere channels are never dropped.
	dmChannels = limitDMChannelsForProfiles(dmChannels, channelMembers, sidebarCats, prefs, dmLimit, isCRT, activeChannelID)

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

	// Deliberately includes deactivated users and their DMs, so filterAutoclosedDMs
	// can detect them.
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

	// A GM's display name and member count need its full membership, so the
	// delta-filtered profile set would truncate both. Back-fill the changed GMs.
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

	// A rejected team_id hint means the client holds no data for the resolved team, so
	// team-scoped data drops to a full sync. Sending no hint at all keeps the cursor valid.
	activeSince := since
	if since > 0 && activeTeamID != "" && resolvedTeamID != activeTeamID {
		activeSince = 0
	}

	changedChannels := allChannels
	changedChannelMembers := channelMembers
	if activeSince > 0 {
		changedChannels = filterChannelsSince(allChannels, dmGMProfilesByChannel, activeSince)
		changedChannelMembers = filterMembersSince(channelMembers, activeSince)

		// activeSince is only known here, so roles were fetched unfiltered above and
		// the cursor is applied in memory.
		roles = filterRolesSince(roles, activeSince)
	}

	// Tombstoned teams are surfaced via RemovedTeamIds, never in the Teams array.
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

	directProfiles := buildDirectProfiles(dmGMProfilesByChannel, *a.Config().PrivacySettings.ShowEmailAddress, *a.Config().PrivacySettings.ShowFullName)

	channelsByID := make(map[string]*model.Channel, len(allChannels))
	for _, ch := range allChannels {
		channelsByID[ch.Id] = ch
	}

	// activeSince is 0 when the active team changed, so a client with no local data
	// for the resolved team always gets the full sidebar.
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
		Me:                   toExperienceUser(me, true, true, true),
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
