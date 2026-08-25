// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"maps"
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
	preferenceAgents                     = "agents"
	preferenceSelectedAgent              = "selected_agent"
)

// experiencePreferenceCategories lists the preference categories sent by all experience
// endpoints. Categories not in this list (e.g. tutorial_step, recommended_next_steps,
// oauth_app) are excluded because clients do not use them.
var experiencePreferenceCategories = []string{
	model.PreferenceCategoryDirectChannelShow,
	model.PreferenceCategoryGroupChannelShow,
	model.PreferenceCategoryFavoriteChannel,
	model.PreferenceCategoryDisplaySettings,
	model.PreferenceCategoryAdvancedSettings,
	model.PreferenceCategorySidebarSettings,
	model.PreferenceCategorySidebarVersion,
	model.PreferenceCategoryNotifications,
	model.PreferenceCategoryCustomStatus,
	model.PreferenceCategoryFlaggedPost,
	model.PreferenceCategoryTheme,
	preferenceTeamsOrder,
	// Required for server-side DM/GM visibility filtering (replicates client's
	// filterAutoclosedDMs which uses these as a fallback for lastViewedAt).
	preferenceChannelApproximateViewTime,
	preferenceChannelOpenTime,

	preferenceAgents,
	preferenceSelectedAgent,
}

type experienceLoadSnapshot struct {
	me               *model.User
	teams            []*model.Team
	deletedTeams     []*model.Team
	teamMembers      []*model.TeamMember
	prefs            model.Preferences
	prefTombstones   []model.PreferenceTombstone
	groupMemberships *model.ExperienceGroupMembershipList
}

type experienceLoadErrorKeys struct {
	function  string
	loadError string
}

func (a *App) loadExperienceSnapshot(rctx request.CTX, userID string, since int64, keys experienceLoadErrorKeys) (*experienceLoadSnapshot, *model.AppError) {
	res := &experienceLoadSnapshot{}

	eg, _ := errgroup.WithContext(rctx.Context())

	eg.Go(func() error {
		var appErr *model.AppError
		res.me, appErr = a.GetUser(userID)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	eg.Go(func() error {
		var appErr *model.AppError
		res.teams, appErr = a.GetTeamsForUser(userID)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	if since > 0 {
		eg.Go(func() error {
			var appErr *model.AppError
			res.deletedTeams, appErr = a.GetDeletedTeamsForUserSince(userID, since)
			if appErr != nil {
				return appErr
			}
			return nil
		})
	}

	eg.Go(func() error {
		var appErr *model.AppError
		res.teamMembers, appErr = a.GetTeamMembersForUser(rctx, userID, "", since > 0)
		if appErr != nil {
			return appErr
		}
		return nil
	})

	eg.Go(func() error {
		allPrefs, appErr := a.GetPreferencesForUser(rctx, userID)
		if appErr != nil {
			return appErr
		}
		res.prefs = filterExperiencePreferences(allPrefs)
		return nil
	})

	if since > 0 {
		eg.Go(func() error {
			tombstones, err := a.Srv().Store().Preference().GetDeletedSince(userID, since)
			if err != nil {
				return model.NewAppError(keys.function, "app.initial_load.get_preference_tombstones.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			res.prefTombstones = filterExperienceTombstones(tombstones)
			return nil
		})
	}

	eg.Go(func() error {
		var err error
		res.groupMemberships, err = a.Srv().Store().Group().GetMembershipsByUser(userID, since)
		if err != nil {
			return model.NewAppError(keys.function, "app.initial_load.get_group_memberships.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	if err := eg.Wait(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError(keys.function, keys.loadError, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return res, nil
}

const channelMembersPageSize = 2000

// getAllChannelMembersForUser pages through GetChannelMembersWithTeamDataForUserWithPagination
// so callers never silently truncate a user's channel memberships regardless of how many
// teams/channels they belong to.
func (a *App) getAllChannelMembersForUser(rctx request.CTX, userID string) (model.ChannelMembersWithTeamData, *model.AppError) {
	var all model.ChannelMembersWithTeamData
	fromChannelID := ""
	for {
		cursor := &model.ChannelMemberCursor{Page: -1, PerPage: channelMembersPageSize, FromChannelID: fromChannelID}
		page, appErr := a.GetChannelMembersWithTeamDataForUserWithPagination(rctx, userID, cursor)
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				break
			}
			return nil, appErr
		}
		all = append(all, page...)
		if len(page) < channelMembersPageSize {
			break
		}
		fromChannelID = page[len(page)-1].ChannelId
	}
	return all, nil
}

const dmChannelsPageSize = 2000

// getAllDMGMChannelsForUser pages through GetChannelsForUser so a teamless
// user's DM/GM history never forces a single unbounded query.
func (a *App) getAllDMGMChannelsForUser(rctx request.CTX, userID string, includeDeleted bool) (model.ChannelList, *model.AppError) {
	var all model.ChannelList
	fromChannelID := ""
	for {
		page, appErr := a.GetChannelsForUser(rctx, userID, includeDeleted, 0, dmChannelsPageSize, fromChannelID)
		if appErr != nil {
			if appErr.StatusCode == http.StatusNotFound {
				break
			}
			return nil, appErr
		}
		for _, ch := range page {
			if ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
				all = append(all, ch)
			}
		}
		if len(page) < dmChannelsPageSize {
			break
		}
		fromChannelID = page[len(page)-1].Id
	}
	return all, nil
}

// toExperienceGroupMembershipList returns nil when there is nothing to send
// (no members and no tombstones), avoiding an empty object in the JSON response.
func toExperienceGroupMembershipList(list *model.ExperienceGroupMembershipList) *model.ExperienceGroupMembershipList {
	if list == nil || (len(list.Members) == 0 && len(list.RemovedGroupIds) == 0) {
		return nil
	}
	return list
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
// falls back to the user's own profile.
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
				displayUser = members[0]
			}
			ch.DisplayName = displayNameForUser(displayUser, nameFormat)
		case model.ChannelTypeGroup:
			names := make([]string, 0, len(members))
			for _, u := range members {
				if u.Id != userID {
					names = append(names, displayNameForUser(u, nameFormat))
				}
			}
			slices.Sort(names)
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

func filterMembersSince(members model.ChannelMembersWithTeamData, since int64) model.ChannelMembersWithTeamData {
	out := make(model.ChannelMembersWithTeamData, 0, len(members))
	for i := range members {
		if members[i].LastUpdateAt > since {
			out = append(out, members[i])
		}
	}
	return out
}

func filterExperiencePreferences(allPrefs model.Preferences) model.Preferences {
	categorySet := experiencePreferenceCategorySet()
	prefs := make(model.Preferences, 0, len(allPrefs))
	for _, p := range allPrefs {
		if _, ok := categorySet[p.Category]; ok {
			prefs = append(prefs, p)
		}
	}
	return prefs
}

// filterExperienceTombstones applies the same category allowlist as
// filterExperiencePreferences, so clients never receive delete tombstones for
// categories they were never sent in the first place.
func filterExperienceTombstones(allTombstones []model.PreferenceTombstone) []model.PreferenceTombstone {
	categorySet := experiencePreferenceCategorySet()
	tombstones := make([]model.PreferenceTombstone, 0, len(allTombstones))
	for _, tb := range allTombstones {
		if _, ok := categorySet[tb.Category]; ok {
			tombstones = append(tombstones, tb)
		}
	}
	return tombstones
}

func experiencePreferenceCategorySet() map[string]struct{} {
	categorySet := make(map[string]struct{}, len(experiencePreferenceCategories))
	for _, c := range experiencePreferenceCategories {
		categorySet[c] = struct{}{}
	}
	return categorySet
}

func buildTombstonedTeamIDs(teamMembers []*model.TeamMember, deletedTeams []*model.Team) map[string]struct{} {
	tombstonedTeamIDs := make(map[string]struct{})
	for _, tm := range teamMembers {
		if tm.DeleteAt > 0 {
			tombstonedTeamIDs[tm.TeamId] = struct{}{}
		}
	}
	for _, t := range deletedTeams {
		tombstonedTeamIDs[t.Id] = struct{}{}
	}
	return tombstonedTeamIDs
}

func indexTeamUnreadsByTeamID(teamsUnread []*model.TeamUnread) map[string]*model.TeamUnread {
	unreadByTeam := make(map[string]*model.TeamUnread, len(teamsUnread))
	for _, u := range teamsUnread {
		unreadByTeam[u.TeamId] = u
	}
	return unreadByTeam
}

// collectRoleNames returns the deduplicated set of role name strings needed for
// client-side permission computation.
func collectRoleNames(me *model.User, teamMembers []*model.TeamMember, channelMembers model.ChannelMembersWithTeamData) []string {
	seen := make(map[string]struct{})
	add := func(roles string) {
		for r := range strings.FieldsSeq(roles) {
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

func toExperienceChannel(ch *model.Channel) *model.ExperienceChannel {
	return &model.ExperienceChannel{
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

func toSlimExperienceChannel(ch *model.Channel) *model.ExperienceChannel {
	return &model.ExperienceChannel{
		Id:                ch.Id,
		UpdateAt:          ch.UpdateAt,
		LastPostAt:        ch.LastPostAt,
		TotalMsgCount:     ch.TotalMsgCount,
		TotalMsgCountRoot: ch.TotalMsgCountRoot,
		LastRootPostAt:    ch.LastRootPostAt,
	}
}

func toExperienceChannelMember(cm *model.ChannelMemberWithTeamData) *model.ExperienceChannelMember {
	return &model.ExperienceChannelMember{
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

func toExperienceRoles(roles []*model.Role) []*model.ExperienceRole {
	out := make([]*model.ExperienceRole, 0, len(roles))
	for _, r := range roles {
		out = append(out, &model.ExperienceRole{
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

// buildDirectProfiles converts the DM/GM profiles map into a flat deduplicated list.
func buildDirectProfiles(profilesByChannel map[string][]*model.User, showEmail bool, showFullName bool) []*model.ExperienceUser {
	if len(profilesByChannel) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	var out []*model.ExperienceUser
	for _, profiles := range profilesByChannel {
		for _, u := range profiles {
			if _, already := seen[u.Id]; already {
				continue
			}
			seen[u.Id] = struct{}{}
			out = append(out, toExperienceUser(u, false, showEmail, showFullName))
		}
	}
	return out
}

// buildDirectUnreads aggregates unread counts across ALL DM/GM channels the user belongs to.
// Excludes muted channels and DMs with deactivated users deactivated after the last view.
func buildDirectUnreads(
	userID string,
	channelMembers model.ChannelMembersWithTeamData,
	channelsByID map[string]*model.Channel,
	profilesByChannel map[string][]*model.User,
	prefs model.Preferences,
	isCRT bool,
	dmThreadHasUnreads bool,
	dmThreadMentions int64,
	dmThreadUrgent int64,
) *model.ExperienceUnreads {
	cmByChannel := make(map[string]*model.ChannelMemberWithTeamData, len(channelMembers))
	for i := range channelMembers {
		if channelMembers[i].TeamName == "" {
			cmByChannel[channelMembers[i].ChannelId] = &channelMembers[i]
		}
	}
	lastViewed := buildDMLastViewedAt(cmByChannel, prefs)

	var counts model.ExperienceUnreads
	for i := range channelMembers {
		cm := &channelMembers[i]
		if cm.TeamName != "" {
			continue
		}
		isMuted := cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
		if isMuted {
			continue
		}

		// Skip DMs with deactivated teammates deactivated after the last view.
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

		ch := channelsByID[cm.ChannelId]

		if isCRT {
			counts.MentionCount += cm.MentionCountRoot
			counts.MentionCountRoot += cm.MentionCountRoot
			if (ch != nil && ch.TotalMsgCountRoot-cm.MsgCountRoot > 0) || cm.MentionCountRoot > 0 {
				counts.HasUnreads = true
			}
		} else {
			counts.MentionCount += cm.MentionCount
			if (ch != nil && ch.TotalMsgCount-cm.MsgCount > 0) || cm.MentionCount > 0 {
				counts.HasUnreads = true
			}
		}
		counts.UrgentMentionCount += cm.UrgentMentionCount
	}

	// DM/GM thread counts — queries ThreadTeamId = '' / NULL directly to avoid
	// the tombstone-team subtraction bug in GetTotalUnreadMentions.
	counts.ThreadHasUnreads = dmThreadHasUnreads
	counts.ThreadMentionCount = dmThreadMentions
	counts.ThreadUrgentMentionCount = dmThreadUrgent

	if counts.MentionCount == 0 && !counts.HasUnreads && counts.ThreadMentionCount == 0 && !counts.ThreadHasUnreads {
		return nil
	}
	return &counts
}

// buildDMLastViewedAt returns a map of channelId -> effective lastViewedAt, taking
// the max of the channel member's LastViewedAt and the channel_approximate_view_time
// channel_open_time preferences (which the client writes to persist view times
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

// resolveActiveTeam picks the active team ID from:
//  1. Client hint (activeTeamID) — used if the user is still a member
//  2. ExperimentalPrimaryTeam server config (matched by team Name)
//  3. teams_order preference (comma-separated ordered team IDs)
//  4. First team sorted alphabetically by locale
func (a *App) resolveActiveTeam(hintID string, teams []*model.Team, prefs model.Preferences, userLocale string) string {
	if len(teams) == 0 {
		return ""
	}

	teamByID := make(map[string]*model.Team, len(teams))
	for _, t := range teams {
		teamByID[t.Id] = t
	}

	if hintID != "" {
		if _, ok := teamByID[hintID]; ok {
			return hintID
		}
	}

	if primaryTeamName := *a.Config().TeamSettings.ExperimentalPrimaryTeam; primaryTeamName != "" {
		for _, t := range teams {
			if t.Name == primaryTeamName {
				return t.Id
			}
		}
	}

	for _, p := range prefs {
		if p.Category == preferenceTeamsOrder {
			for id := range strings.SplitSeq(p.Value, ",") {
				id = strings.TrimSpace(id)
				if _, ok := teamByID[id]; ok {
					return id
				}
			}
		}
	}

	var lang = language.English
	if tag, err := language.Parse(userLocale); err == nil {
		lang = tag
	}

	cl := collate.New(lang)
	sortedTeams := slices.Clone(teams)
	sort.Slice(sortedTeams, func(i, j int) bool {
		s1 := strings.ToLower(sortedTeams[i].DisplayName)
		s2 := strings.ToLower(sortedTeams[j].DisplayName)
		return cl.CompareString(s1, s2) < 0
	})
	return sortedTeams[0].Id
}

func getDMLimit(prefs model.Preferences) int {
	for _, p := range prefs {
		if p.Category == model.PreferenceCategorySidebarSettings && p.Name == model.PreferenceLimitVisibleDmsGms {
			if v, err := strconv.Atoi(p.Value); err == nil && v > 0 {
				return v
			}
		}
	}
	return 20
}

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

// isSelf preserves Email/NotifyProps/FirstName/LastName (the user's own);
// otherwise Email is gated on showEmail, FirstName/LastName are gated on
// showFullName, and NotifyProps is omitted, mirroring User.Sanitize.
func toExperienceUser(u *model.User, isSelf bool, showEmail bool, showFullName bool) *model.ExperienceUser {
	if u == nil {
		return nil
	}
	out := &model.ExperienceUser{
		Id:                     u.Id,
		CreateAt:               u.CreateAt,
		UpdateAt:               u.UpdateAt,
		DeleteAt:               u.DeleteAt,
		Username:               u.Username,
		AuthService:            u.AuthService,
		Nickname:               u.Nickname,
		Position:               u.Position,
		Roles:                  u.Roles,
		Props:                  u.Props,
		LastPictureUpdate:      u.LastPictureUpdate,
		Locale:                 u.Locale,
		Timezone:               u.Timezone,
		TermsOfServiceId:       u.TermsOfServiceId,
		TermsOfServiceCreateAt: u.TermsOfServiceCreateAt,
	}
	if isSelf || showFullName {
		out.FirstName = u.FirstName
		out.LastName = u.LastName
	}
	if isSelf {
		out.Email = u.Email
		out.NotifyProps = u.NotifyProps
	} else if showEmail {
		out.Email = u.Email
	} else if _, ok := u.Props[model.UserPropsKeyRemoteEmail]; ok {
		// Mirrors User.Sanitize: a shared-channel remote user's real email can
		// live in Props even when Email itself is blanked, so it must be
		// stripped the same way whenever email visibility is denied. Copy
		// first — u.Props is the same map instance as the source User and may
		// be shared/cached elsewhere.
		props := make(model.StringMap, len(u.Props))
		maps.Copy(props, u.Props)
		delete(props, model.UserPropsKeyRemoteEmail)
		out.Props = props
	}
	return out
}

func toExperienceTeams(teams []*model.Team) []*model.ExperienceTeam {
	out := make([]*model.ExperienceTeam, 0, len(teams))
	for _, t := range teams {
		out = append(out, toExperienceTeam(t))
	}
	return out
}

func toExperienceTeam(t *model.Team) *model.ExperienceTeam {
	return &model.ExperienceTeam{
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
}

func toExperienceTeamUnreads(teamID string, unread *model.TeamUnread, isCRT bool) *model.ExperienceUnreads {
	u := &model.ExperienceUnreads{TeamID: teamID}
	if unread != nil {
		if isCRT {
			u.MentionCount = unread.MentionCountRoot
			u.MentionCountRoot = unread.MentionCountRoot
		} else {
			u.MentionCount = unread.MentionCount
		}
		u.HasUnreads = unread.MsgCount > 0
		u.ThreadMentionCount = unread.ThreadMentionCount
		u.ThreadUrgentMentionCount = unread.ThreadUrgentMentionCount
		u.ThreadHasUnreads = unread.ThreadCount > 0 || unread.ThreadMentionCount > 0
	}
	return u
}

func toExperienceTeamUnreadsList(teams []*model.Team, unreads []*model.TeamUnread, isCRT bool) []*model.ExperienceUnreads {
	unreadByTeam := indexTeamUnreadsByTeamID(unreads)
	out := make([]*model.ExperienceUnreads, 0, len(teams))
	for _, t := range teams {
		out = append(out, toExperienceTeamUnreads(t.Id, unreadByTeam[t.Id], isCRT))
	}
	return out
}

func toExperienceTeamMemberList(members []*model.TeamMember, tombstonedTeamIDs map[string]struct{}) *model.ExperienceTeamMemberList {
	out := make([]*model.ExperienceTeamMember, 0, len(members))
	for _, m := range members {
		if _, isTombstoned := tombstonedTeamIDs[m.TeamId]; isTombstoned {
			continue
		}
		out = append(out, &model.ExperienceTeamMember{
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

	return &model.ExperienceTeamMemberList{
		Members:        out,
		RemovedTeamIds: removedTeamIDs,
	}
}

// buildExperienceChannelLists converts changed channels and members into compact load items.
// For changed members whose channel is not in the delta set (channel metadata unchanged),
// a slim channel entry is added so the client can recompute unread counts.
// include gates which channels from allChannels are eligible for the output.
func buildExperienceChannelLists(
	allChannels model.ChannelList,
	changedChannels model.ChannelList,
	changedMembers model.ChannelMembersWithTeamData,
	include func(*model.Channel) bool,
	gmMemberCounts map[string]int64,
) ([]*model.ExperienceChannel, []*model.ExperienceChannelMember) {
	chList := make([]*model.ExperienceChannel, 0, len(changedChannels))
	inChList := make(map[string]struct{}, len(changedChannels))
	for _, ch := range changedChannels {
		if include(ch) {
			c := toExperienceChannel(ch)
			if ch.Type == model.ChannelTypeGroup && gmMemberCounts != nil {
				c.MemberCount = gmMemberCounts[ch.Id]
			}
			chList = append(chList, c)
			inChList[ch.Id] = struct{}{}
		}
	}

	cmList := make([]*model.ExperienceChannelMember, 0, len(changedMembers))
	for i := range changedMembers {
		cmList = append(cmList, toExperienceChannelMember(&changedMembers[i]))
	}

	allChByID := make(map[string]*model.Channel, len(allChannels))
	for _, ch := range allChannels {
		if include(ch) {
			allChByID[ch.Id] = ch
		}
	}
	for _, cm := range cmList {
		if _, alreadyInList := inChList[cm.ChannelId]; alreadyInList {
			continue
		}
		ch, ok := allChByID[cm.ChannelId]
		if !ok {
			continue
		}
		chList = append(chList, toSlimExperienceChannel(ch))
		inChList[cm.ChannelId] = struct{}{}
	}

	return chList, cmList
}

func toExperienceActiveTeam(
	teamID string,
	teams []*model.Team,
	allChannels model.ChannelList,
	changedChannels model.ChannelList,
	changedChannelMembers model.ChannelMembersWithTeamData,
	sidebarCats *model.OrderedSidebarCategories,
	removedChIDs []string,
	prefs model.Preferences,
	gmMemberCounts map[string]int64,
) *model.ExperienceActiveTeam {
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

	scopeChIDs := make(map[string]struct{}, len(allChannels))
	for _, ch := range allChannels {
		if ch.TeamId == teamID || ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup {
			scopeChIDs[ch.Id] = struct{}{}
		}
	}
	scopedMembers := make(model.ChannelMembersWithTeamData, 0, len(changedChannelMembers))
	for i := range changedChannelMembers {
		if _, ok := scopeChIDs[changedChannelMembers[i].ChannelId]; ok {
			scopedMembers = append(scopedMembers, changedChannelMembers[i])
		}
	}

	include := func(ch *model.Channel) bool {
		return ch.TeamId == teamID || ch.Type == model.ChannelTypeDirect || ch.Type == model.ChannelTypeGroup
	}
	chList, cmList := buildExperienceChannelLists(allChannels, changedChannels, scopedMembers, include, gmMemberCounts)

	return &model.ExperienceActiveTeam{
		Team:     toExperienceTeam(activeTeam),
		Channels: chList,
		ChannelMembers: model.ExperienceChannelMemberList{
			Members:           cmList,
			RemovedChannelIds: removedChIDs,
		},
		SidebarCategories: sidebarCats,
		SidebarVersion:    getSidebarVersion(prefs, teamID),
	}
}

type dmEntry struct {
	ch         *model.Channel
	cm         *model.ChannelMemberWithTeamData
	lastViewed int64
	unread     bool
}

// dmIsUnread reports whether the channel has unread messages for cm's user.
// ChannelMember.MsgCount/MsgCountRoot are read counters, not unread counts —
// the actual unread total is the channel's TotalMsgCount/TotalMsgCountRoot
// minus what the member has read, matching every other unread computation in
// this codebase (e.g. the IsUnread calculation in channel.go's
// attachMuteToggleData).
func dmIsUnread(ch *model.Channel, cm *model.ChannelMemberWithTeamData, isCRT bool) bool {
	if cm == nil || ch == nil {
		return false
	}
	isMuted := cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
	if isCRT {
		return cm.MentionCountRoot > 0 || (!isMuted && ch.TotalMsgCountRoot-cm.MsgCountRoot > 0)
	}
	return cm.MentionCount > 0 || (!isMuted && ch.TotalMsgCount-cm.MsgCount > 0)
}

func filterManuallyClosedDMEntries(entries []dmEntry, prefs model.Preferences, userID string, pinnedInOtherCategory map[string]struct{}) []dmEntry {
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
		if _, pinned := pinnedInOtherCategory[e.ch.Id]; pinned {
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

func filterAutoclosedDMEntries(
	entries []dmEntry,
	currentChannelID string,
	userID string,
	profilesByChannel map[string][]*model.User,
	dmLimit int,
	pinnedInOtherCategory map[string]struct{},
) (dmCat []dmEntry, pinned []*model.Channel) {
	for _, e := range entries {
		if _, ok := pinnedInOtherCategory[e.ch.Id]; ok {
			pinned = append(pinned, e.ch)
			continue
		}
		if e.lastViewed == 0 && !e.unread {
			continue
		}
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

	unreadCount := 0
	for _, e := range dmCat {
		if e.unread {
			unreadCount++
		}
	}
	remaining := max(dmLimit, unreadCount)
	if len(dmCat) > remaining {
		dmCat = dmCat[:remaining]
	}
	return dmCat, pinned
}

func sortDMEntries(entries []dmEntry, sorting model.SidebarCategorySorting, sortOrderByID map[string]int, locale string) []dmEntry {
	switch sorting {
	case model.SidebarCategorySortAlphabetical:
		col := collate.New(language.Make(locale), collate.Numeric)
		sort.SliceStable(entries, func(i, j int) bool {
			a, b := entries[i], entries[j]
			aMuted := a.cm != nil && a.cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
			bMuted := b.cm != nil && b.cm.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention
			if aMuted != bMuted {
				return !aMuted
			}
			return col.CompareString(a.ch.DisplayName, b.ch.DisplayName) < 0
		})
	case model.SidebarCategorySortManual:
		sort.SliceStable(entries, func(i, j int) bool {
			return sortOrderByID[entries[i].ch.Id] < sortOrderByID[entries[j].ch.Id]
		})
	default:
		sort.SliceStable(entries, func(i, j int) bool {
			a := max(entries[i].ch.LastPostAt, entries[i].ch.CreateAt)
			b := max(entries[j].ch.LastPostAt, entries[j].ch.CreateAt)
			return a > b
		})
	}
	return entries
}

// buildDMEntries assembles one dmEntry per channel plus the set of channels
// pinned into a sidebar category other than the default DM one. Shared by
// limitDMChannelsForProfiles and selectVisibleDMGMChannels so both agree on
// unread/pinned status without fetching or computing it twice.
func buildDMEntries(
	channels model.ChannelList,
	channelMembers model.ChannelMembersWithTeamData,
	sidebarCats *model.OrderedSidebarCategories,
	prefs model.Preferences,
	isCRT bool,
) (entries []dmEntry, dmCategory *model.SidebarCategoryWithChannels, pinnedInOtherCategory map[string]struct{}) {
	cmByChannel := make(map[string]*model.ChannelMemberWithTeamData, len(channelMembers))
	for i := range channelMembers {
		if channelMembers[i].TeamName == "" {
			cmByChannel[channelMembers[i].ChannelId] = &channelMembers[i]
		}
	}

	lastViewed := buildDMLastViewedAt(cmByChannel, prefs)

	pinnedInOtherCategory = make(map[string]struct{})
	if sidebarCats != nil {
		for _, cat := range sidebarCats.Categories {
			if cat.Type == model.SidebarCategoryDirectMessages {
				dmCategory = cat
				continue
			}
			for _, chID := range cat.Channels {
				pinnedInOtherCategory[chID] = struct{}{}
			}
		}
	}

	entries = make([]dmEntry, 0, len(channels))
	for _, ch := range channels {
		cm := cmByChannel[ch.Id]
		entries = append(entries, dmEntry{
			ch:         ch,
			cm:         cm,
			lastViewed: lastViewed[ch.Id],
			unread:     dmIsUnread(ch, cm, isCRT),
		})
	}
	return entries, dmCategory, pinnedInOtherCategory
}

// limitDMChannelsForProfiles bounds how many DM/GM channels get their member
// profiles fetched, so a very large DM/GM history doesn't force an unbounded
// query. Unread, pinned-elsewhere, and the active channel are always kept; the
// rest are ranked by recency and capped to a multiple of dmLimit.
func limitDMChannelsForProfiles(
	channels model.ChannelList,
	channelMembers model.ChannelMembersWithTeamData,
	sidebarCats *model.OrderedSidebarCategories,
	prefs model.Preferences,
	dmLimit int,
	isCRT bool,
	activeChannelID string,
) model.ChannelList {
	const dmProfileFetchLimitMultiplier = 3

	limit := dmLimit * dmProfileFetchLimitMultiplier
	if len(channels) <= limit {
		return channels
	}

	entries, _, pinnedInOtherCategory := buildDMEntries(channels, channelMembers, sidebarCats, prefs, isCRT)

	var kept, rest []dmEntry
	for _, e := range entries {
		if e.unread {
			kept = append(kept, e)
			continue
		}
		if _, pinned := pinnedInOtherCategory[e.ch.Id]; pinned {
			kept = append(kept, e)
			continue
		}
		if activeChannelID != "" && e.ch.Id == activeChannelID {
			kept = append(kept, e)
			continue
		}
		rest = append(rest, e)
	}

	sort.SliceStable(rest, func(i, j int) bool {
		a := max(rest[i].ch.LastPostAt, rest[i].ch.CreateAt)
		b := max(rest[j].ch.LastPostAt, rest[j].ch.CreateAt)
		return a > b
	})

	if remaining := limit - len(kept); remaining > 0 && len(rest) > remaining {
		rest = rest[:remaining]
	} else if remaining <= 0 {
		rest = nil
	}

	out := make(model.ChannelList, 0, len(kept)+len(rest))
	for _, e := range kept {
		out = append(out, e.ch)
	}
	for _, e := range rest {
		out = append(out, e.ch)
	}
	return out
}

// selectVisibleDMGMChannels applies the same DM/GM visibility rules clients use:
// filterManuallyClosedDMs → filterAutoclosedDMs → sortChannels.
// Server-side replication ensures consistent behaviour across all clients.
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

	entries, dmCategory, pinnedInOtherCategory := buildDMEntries(allDMChannels, channelMembers, sidebarCats, prefs, isCRT)

	entryByChannelID := make(map[string]dmEntry, len(entries))
	for _, e := range entries {
		entryByChannelID[e.ch.Id] = e
	}

	entries = filterManuallyClosedDMEntries(entries, prefs, userID, pinnedInOtherCategory)
	dmCatEntries, pinnedChannels := filterAutoclosedDMEntries(entries, currentChannelID, userID, profilesByChannel, dmLimit, pinnedInOtherCategory)

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
			finalEntries = append(finalEntries, entryByChannelID[ch.Id])
		}
	}

	sorting := model.SidebarCategorySortRecent
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

func getSidebarVersion(prefs model.Preferences, teamID string) int64 {
	for _, p := range prefs {
		if p.Category == model.PreferenceCategorySidebarVersion && p.Name == teamID {
			if v, err := strconv.ParseInt(p.Value, 10, 64); err == nil {
				return v
			}
		}
	}
	return 0
}

// buildStatusSnapshot fetches presence for the given user IDs and returns a
// map keyed by user_id. ActiveChannel is stripped — it must not be visible to
// other users. Non-fatal: returns nil on error so callers can proceed without
// status data rather than failing the whole response.
func (a *App) buildStatusSnapshot(userIDs []string) map[string]*model.Status {
	if len(userIDs) == 0 {
		return nil
	}
	statuses, appErr := a.GetUserStatusesByIds(userIDs)
	if appErr != nil {
		a.Log().Warn("Failed to fetch status snapshot", mlog.Err(appErr))
		return nil
	}
	out := make(map[string]*model.Status, len(statuses))
	for _, s := range statuses {
		s.ActiveChannel = ""
		out[s.UserId] = s
	}
	return out
}
