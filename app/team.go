// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (a *App) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	team.InviteId = ""
	rteam, err := a.Srv.Store.Team().Save(team)
	if err != nil {
		return nil, err
	}

	if _, err := a.CreateDefaultChannels(rteam.Id); err != nil {
		return nil, err
	}

	return rteam, nil
}

func (a *App) CreateTeamWithUser(team *model.Team, userId string) (*model.Team, *model.AppError) {
	user, err := a.GetUser(userId)
	if err != nil {
		return nil, err
	}
	team.Email = user.Email

	if !a.isTeamEmailAllowed(user, team) {
		return nil, model.NewAppError("isTeamEmailAllowed", "api.team.is_team_creation_allowed.domain.app_error", nil, "", http.StatusBadRequest)
	}

	rteam, err := a.CreateTeam(team)
	if err != nil {
		return nil, err
	}

	if err = a.JoinUserToTeam(rteam, user, ""); err != nil {
		return nil, err
	}

	return rteam, nil
}

func (a *App) normalizeDomains(domains string) []string {
	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	return strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))
}

func (a *App) isTeamEmailAddressAllowed(email string, allowedDomains string) bool {
	email = strings.ToLower(email)
	// First check per team allowedDomains, then app wide restrictions
	for _, restriction := range []string{allowedDomains, *a.Config().TeamSettings.RestrictCreationToDomains} {
		domains := a.normalizeDomains(restriction)
		if len(domains) <= 0 {
			continue
		}
		matched := false
		for _, d := range domains {
			if strings.HasSuffix(email, "@"+d) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

func (a *App) isTeamEmailAllowed(user *model.User, team *model.Team) bool {
	if user.IsBot {
		return true
	}
	email := strings.ToLower(user.Email)
	return a.isTeamEmailAddressAllowed(email, team.AllowedDomains)
}

func (a *App) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	oldTeam, err := a.GetTeam(team.Id)
	if err != nil {
		return nil, err
	}

	validDomains := a.normalizeDomains(*a.Config().TeamSettings.RestrictCreationToDomains)
	if len(validDomains) > 0 {
		for _, domain := range a.normalizeDomains(team.AllowedDomains) {
			matched := false
			for _, d := range validDomains {
				if domain == d {
					matched = true
					break
				}
			}
			if !matched {
				err = model.NewAppError("UpdateTeam", "api.team.update_restricted_domains.mismatch.app_error", map[string]interface{}{"Domain": domain}, "", http.StatusBadRequest)
				return nil, err
			}
		}
	}

	oldTeam.DisplayName = team.DisplayName
	oldTeam.Description = team.Description
	oldTeam.AllowOpenInvite = team.AllowOpenInvite
	oldTeam.CompanyName = team.CompanyName
	oldTeam.AllowedDomains = team.AllowedDomains
	oldTeam.LastTeamIconUpdate = team.LastTeamIconUpdate
	oldTeam.GroupConstrained = team.GroupConstrained

	oldTeam, err = a.updateTeamUnsanitized(oldTeam)
	if err != nil {
		return team, err
	}

	a.sendTeamEvent(oldTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return oldTeam, nil
}

func (a *App) updateTeamUnsanitized(team *model.Team) (*model.Team, *model.AppError) {
	return a.Srv.Store.Team().Update(team)
}

// RenameTeam is used to rename the team Name and the DisplayName fields
func (a *App) RenameTeam(team *model.Team, newTeamName string, newDisplayName string) (*model.Team, *model.AppError) {

	// check if name is occupied
	_, errnf := a.GetTeamByName(newTeamName)

	// "-" can be used as a newTeamName if only DisplayName change is wanted
	if errnf == nil && newTeamName != "-" {
		errbody := fmt.Sprintf("team with name %s already exists", newTeamName)
		return nil, model.NewAppError("RenameTeam", "app.team.rename_team.name_occupied", nil, errbody, http.StatusBadRequest)
	}

	if newTeamName != "-" {
		team.Name = newTeamName
	}

	if newDisplayName != "" {
		team.DisplayName = newDisplayName
	}

	newTeam, err := a.updateTeamUnsanitized(team)
	if err != nil {
		return nil, err
	}

	return newTeam, nil
}

func (a *App) UpdateTeamScheme(team *model.Team) (*model.Team, *model.AppError) {
	oldTeam, err := a.GetTeam(team.Id)
	if err != nil {
		return nil, err
	}

	oldTeam.SchemeId = team.SchemeId

	if oldTeam, err = a.Srv.Store.Team().Update(oldTeam); err != nil {
		return nil, err
	}

	a.sendTeamEvent(oldTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return oldTeam, nil
}

func (a *App) UpdateTeamPrivacy(teamId string, teamType string, allowOpenInvite bool) *model.AppError {
	oldTeam, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	oldTeam.Type = teamType
	oldTeam.AllowOpenInvite = allowOpenInvite

	if oldTeam, err = a.Srv.Store.Team().Update(oldTeam); err != nil {
		return err
	}

	a.sendTeamEvent(oldTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return nil
}

func (a *App) PatchTeam(teamId string, patch *model.TeamPatch) (*model.Team, *model.AppError) {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return nil, err
	}

	team.Patch(patch)

	updatedTeam, err := a.UpdateTeam(team)
	if err != nil {
		return nil, err
	}

	a.sendTeamEvent(updatedTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return updatedTeam, nil
}

func (a *App) RegenerateTeamInviteId(teamId string) (*model.Team, *model.AppError) {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return nil, err
	}

	team.InviteId = model.NewId()

	updatedTeam, err := a.Srv.Store.Team().Update(team)
	if err != nil {
		return nil, err
	}

	a.sendTeamEvent(updatedTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return updatedTeam, nil
}

func (a *App) sendTeamEvent(team *model.Team, event string) {
	sanitizedTeam := &model.Team{}
	*sanitizedTeam = *team
	sanitizedTeam.Sanitize()

	message := model.NewWebSocketEvent(event, "", "", "", nil)
	message.Add("team", sanitizedTeam.ToJson())
	a.Publish(message)
}

func (a *App) GetSchemeRolesForTeam(teamId string) (string, string, string, *model.AppError) {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return "", "", "", err
	}

	if team.SchemeId != nil && len(*team.SchemeId) != 0 {
		scheme, err := a.GetScheme(*team.SchemeId)
		if err != nil {
			return "", "", "", err
		}
		return scheme.DefaultTeamGuestRole, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole, nil
	}

	return model.TEAM_GUEST_ROLE_ID, model.TEAM_USER_ROLE_ID, model.TEAM_ADMIN_ROLE_ID, nil
}

func (a *App) UpdateTeamMemberRoles(teamId string, userId string, newRoles string) (*model.TeamMember, *model.AppError) {
	member, err := a.Srv.Store.Team().GetMember(teamId, userId)
	if err != nil {
		return nil, err
	}

	if member == nil {
		err = model.NewAppError("UpdateTeamMemberRoles", "api.team.update_member_roles.not_a_member", nil, "userId="+userId+" teamId="+teamId, http.StatusBadRequest)
		return nil, err
	}

	schemeGuestRole, schemeUserRole, schemeAdminRole, err := a.GetSchemeRolesForTeam(teamId)
	if err != nil {
		return nil, err
	}

	prevSchemeGuestValue := member.SchemeGuest

	var newExplicitRoles []string
	member.SchemeGuest = false
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		var role *model.Role
		role, err = a.GetRoleByName(roleName)
		if err != nil {
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}
		if !role.SchemeManaged {
			// The role is not scheme-managed, so it's OK to apply it to the explicit roles field.
			newExplicitRoles = append(newExplicitRoles, roleName)
		} else {
			// The role is scheme-managed, so need to check if it is part of the scheme for this channel or not.
			switch roleName {
			case schemeAdminRole:
				member.SchemeAdmin = true
			case schemeUserRole:
				member.SchemeUser = true
			case schemeGuestRole:
				member.SchemeGuest = true
			default:
				// If not part of the scheme for this team, then it is not allowed to apply it as an explicit role.
				return nil, model.NewAppError("UpdateTeamMemberRoles", "api.channel.update_team_member_roles.scheme_role.app_error", nil, "role_name="+roleName, http.StatusBadRequest)
			}
		}
	}

	if member.SchemeGuest && member.SchemeUser {
		return nil, model.NewAppError("UpdateTeamMemberRoles", "api.team.update_team_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	if prevSchemeGuestValue != member.SchemeGuest {
		return nil, model.NewAppError("UpdateTeamMemberRoles", "api.channel.update_team_member_roles.changing_guest_role.app_error", nil, "", http.StatusBadRequest)
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	member, err = a.Srv.Store.Team().UpdateMember(member)
	if err != nil {
		return nil, err
	}

	a.ClearSessionCacheForUser(userId)

	a.sendUpdatedMemberRoleEvent(userId, member)

	return member, nil
}

func (a *App) UpdateTeamMemberSchemeRoles(teamId string, userId string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.TeamMember, *model.AppError) {
	member, err := a.GetTeamMember(teamId, userId)
	if err != nil {
		return nil, err
	}

	member.SchemeAdmin = isSchemeAdmin
	member.SchemeUser = isSchemeUser
	member.SchemeGuest = isSchemeGuest

	if member.SchemeUser && member.SchemeGuest {
		return nil, model.NewAppError("UpdateTeamMemberSchemeRoles", "api.team.update_team_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	// If the migration is not completed, we also need to check the default team_admin/team_user roles are not present in the roles field.
	if err = a.IsPhase2MigrationCompleted(); err != nil {
		member.ExplicitRoles = RemoveRoles([]string{model.TEAM_GUEST_ROLE_ID, model.TEAM_USER_ROLE_ID, model.TEAM_ADMIN_ROLE_ID}, member.ExplicitRoles)
	}

	member, err = a.Srv.Store.Team().UpdateMember(member)
	if err != nil {
		return nil, err
	}

	a.ClearSessionCacheForUser(userId)

	a.sendUpdatedMemberRoleEvent(userId, member)

	return member, nil
}

func (a *App) sendUpdatedMemberRoleEvent(userId string, member *model.TeamMember) {
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_MEMBERROLE_UPDATED, "", "", userId, nil)
	message.Add("member", member.ToJson())
	a.Publish(message)
}

func (a *App) AddUserToTeam(teamId string, userId string, userRequestorId string) (*model.Team, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().Get(teamId)
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(userId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-tchan
	if result.Err != nil {
		return nil, result.Err
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	if err := a.JoinUserToTeam(team, user, userRequestorId); err != nil {
		return nil, err
	}

	return team, nil
}

func (a *App) AddUserToTeamByTeamId(teamId string, user *model.User) *model.AppError {
	team, err := a.Srv.Store.Team().Get(teamId)
	if err != nil {
		return err
	}

	return a.JoinUserToTeam(team, user, "")
}

func (a *App) AddUserToTeamByToken(userId string, tokenId string) (*model.Team, *model.AppError) {
	token, err := a.Srv.Store.Token().GetByToken(tokenId)
	if err != nil {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if token.Type != TOKEN_TYPE_TEAM_INVITATION && token.Type != TOKEN_TYPE_GUEST_INVITATION {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= INVITATION_EXPIRY_TIME {
		a.DeleteToken(token)
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJson(strings.NewReader(token.Extra))

	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().Get(tokenData["teamId"])
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(userId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-tchan
	if result.Err != nil {
		return nil, result.Err
	}
	team := result.Data.(*model.Team)

	if team.IsGroupConstrained() {
		return nil, model.NewAppError("AddUserToTeamByToken", "app.team.invite_token.group_constrained.error", nil, "", http.StatusForbidden)
	}

	result = <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	if user.IsGuest() && token.Type == TOKEN_TYPE_TEAM_INVITATION {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.invalid_invitation_type.app_error", nil, "", http.StatusBadRequest)
	}
	if !user.IsGuest() && token.Type == TOKEN_TYPE_GUEST_INVITATION {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.invalid_invitation_type.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		return nil, err
	}

	if token.Type == TOKEN_TYPE_GUEST_INVITATION {
		channels, err := a.Srv.Store.Channel().GetChannelsByIds(strings.Split(tokenData["channels"], " "))
		if err != nil {
			return nil, err
		}

		for _, channel := range channels {
			_, err := a.AddUserToChannel(user, channel)
			if err != nil {
				mlog.Error("error adding user to channel", mlog.Err(err))
			}
		}
	}

	if err := a.DeleteToken(token); err != nil {
		return nil, err
	}

	return team, nil
}

func (a *App) AddUserToTeamByInviteId(inviteId string, userId string) (*model.Team, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().GetByInviteId(inviteId)
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(userId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-tchan
	if result.Err != nil {
		return nil, result.Err
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		return nil, err
	}

	return team, nil
}

// Returns three values:
// 1. a pointer to the team member, if successful
// 2. a boolean: true if the user has a non-deleted team member for that team already, otherwise false.
// 3. a pointer to an AppError if something went wrong.
func (a *App) joinUserToTeam(team *model.Team, user *model.User) (*model.TeamMember, bool, *model.AppError) {
	tm := &model.TeamMember{
		TeamId:      team.Id,
		UserId:      user.Id,
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}

	if !user.IsGuest() {
		userShouldBeAdmin, err := a.UserIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
		if err != nil {
			return nil, false, err
		}
		tm.SchemeAdmin = userShouldBeAdmin
	}

	if team.Email == user.Email {
		tm.SchemeAdmin = true
	}

	rtm, err := a.Srv.Store.Team().GetMember(team.Id, user.Id)
	if err != nil {
		// Membership appears to be missing. Lets try to add.
		var tmr *model.TeamMember
		tmr, err = a.Srv.Store.Team().SaveMember(tm, *a.Config().TeamSettings.MaxUsersPerTeam)
		if err != nil {
			return nil, false, err
		}
		return tmr, false, nil
	}

	// Membership already exists.  Check if deleted and update, otherwise do nothing
	// Do nothing if already added
	if rtm.DeleteAt == 0 {
		return rtm, true, nil
	}

	membersCount, err := a.Srv.Store.Team().GetActiveMemberCount(tm.TeamId, nil)
	if err != nil {
		return nil, false, err
	}

	if membersCount >= int64(*a.Config().TeamSettings.MaxUsersPerTeam) {
		return nil, false, model.NewAppError("joinUserToTeam", "app.team.join_user_to_team.max_accounts.app_error", nil, "teamId="+tm.TeamId, http.StatusBadRequest)
	}

	member, err := a.Srv.Store.Team().UpdateMember(tm)
	if err != nil {
		return nil, false, err
	}

	return member, false, nil
}

func (a *App) JoinUserToTeam(team *model.Team, user *model.User, userRequestorId string) *model.AppError {
	if !a.isTeamEmailAllowed(user, team) {
		return model.NewAppError("JoinUserToTeam", "api.team.join_user_to_team.allowed_domains.app_error", nil, "", http.StatusBadRequest)
	}
	tm, alreadyAdded, err := a.joinUserToTeam(team, user)
	if err != nil {
		return err
	}
	if alreadyAdded {
		return nil
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var actor *model.User
		if userRequestorId != "" {
			actor, _ = a.GetUser(userRequestorId)
		}

		a.Srv.Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasJoinedTeam(pluginContext, tm, actor)
				return true
			}, plugin.UserHasJoinedTeamId)
		})
	}

	if _, err := a.Srv.Store.User().UpdateUpdateAt(user.Id); err != nil {
		return err
	}

	shouldBeAdmin := team.Email == user.Email

	if !user.IsGuest() {
		// Soft error if there is an issue joining the default channels
		if err := a.JoinDefaultChannels(team.Id, user, shouldBeAdmin, userRequestorId); err != nil {
			mlog.Error(
				"Encountered an issue joining default channels.",
				mlog.String("user_id", user.Id),
				mlog.String("team_id", team.Id),
				mlog.Err(err),
			)
		}
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)
	a.InvalidateCacheForUserTeams(user.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", user.Id, nil)
	message.Add("team_id", team.Id)
	message.Add("user_id", user.Id)
	a.Publish(message)

	return nil
}

func (a *App) GetTeam(teamId string) (*model.Team, *model.AppError) {
	return a.Srv.Store.Team().Get(teamId)
}

func (a *App) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetByName(name)
}

func (a *App) GetTeamByInviteId(inviteId string) (*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetByInviteId(inviteId)
}

func (a *App) GetAllTeams() ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAll()
}

func (a *App) GetAllTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAllPage(offset, limit)
}

func (a *App) GetAllTeamsPageWithCount(offset int, limit int) (*model.TeamsWithCount, *model.AppError) {
	totalCount, err := a.Srv.Store.Team().AnalyticsTeamCount(true)
	if err != nil {
		return nil, err
	}
	teams, err := a.Srv.Store.Team().GetAllPage(offset, limit)
	if err != nil {
		return nil, err
	}
	return &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}, nil
}

func (a *App) GetAllPrivateTeams() ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAllPrivateTeamListing()
}

func (a *App) GetAllPrivateTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAllPrivateTeamPageListing(offset, limit)
}

func (a *App) GetAllPrivateTeamsPageWithCount(offset int, limit int) (*model.TeamsWithCount, *model.AppError) {
	totalCount, err := a.Srv.Store.Team().AnalyticsPrivateTeamCount()
	if err != nil {
		return nil, err
	}
	teams, err := a.Srv.Store.Team().GetAllPrivateTeamPageListing(offset, limit)
	if err != nil {
		return nil, err
	}
	return &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}, nil
}

func (a *App) GetAllPublicTeams() ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAllTeamListing()
}

func (a *App) GetAllPublicTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetAllTeamPageListing(offset, limit)
}

func (a *App) GetAllPublicTeamsPageWithCount(offset int, limit int) (*model.TeamsWithCount, *model.AppError) {
	totalCount, err := a.Srv.Store.Team().AnalyticsPublicTeamCount()
	if err != nil {
		return nil, err
	}
	teams, err := a.Srv.Store.Team().GetAllPublicTeamPageListing(offset, limit)
	if err != nil {
		return nil, err
	}
	return &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}, nil
}

// SearchAllTeams returns a team list and the total count of the results
func (a *App) SearchAllTeams(searchOpts *model.TeamSearch) ([]*model.Team, int64, *model.AppError) {
	if searchOpts.IsPaginated() {
		return a.Srv.Store.Team().SearchAllPaged(searchOpts.Term, *searchOpts.Page, *searchOpts.PerPage)
	}
	results, err := a.Srv.Store.Team().SearchAll(searchOpts.Term)
	return results, int64(len(results)), err
}

func (a *App) SearchPublicTeams(term string) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().SearchOpen(term)
}

func (a *App) SearchPrivateTeams(term string) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().SearchPrivate(term)
}

func (a *App) GetTeamsForUser(userId string) ([]*model.Team, *model.AppError) {
	return a.Srv.Store.Team().GetTeamsByUserId(userId)
}

func (a *App) GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Team().GetMember(teamId, userId)
}

func (a *App) GetTeamMembersForUser(userId string) ([]*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Team().GetTeamsForUser(userId)
}

func (a *App) GetTeamMembersForUserWithPagination(userId string, page, perPage int) ([]*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Team().GetTeamsForUserWithPagination(userId, page, perPage)
}

func (a *App) GetTeamMembers(teamId string, offset int, limit int, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Team().GetMembers(teamId, offset, limit, restrictions)
}

func (a *App) GetTeamMembersByIds(teamId string, userIds []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Team().GetMembersByIds(teamId, userIds, restrictions)
}

func (a *App) AddTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	if _, err := a.AddUserToTeam(teamId, userId, ""); err != nil {
		return nil, err
	}

	teamMember, err := a.GetTeamMember(teamId, userId)
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", userId, nil)
	message.Add("team_id", teamId)
	message.Add("user_id", userId)
	a.Publish(message)

	return teamMember, nil
}

func (a *App) AddTeamMembers(teamId string, userIds []string, userRequestorId string, graceful bool) ([]*model.TeamMemberWithError, *model.AppError) {
	var membersWithErrors []*model.TeamMemberWithError

	for _, userId := range userIds {
		if _, err := a.AddUserToTeam(teamId, userId, userRequestorId); err != nil {
			if graceful {
				membersWithErrors = append(membersWithErrors, &model.TeamMemberWithError{
					UserId: userId,
					Error:  err,
				})
				continue
			}
			return nil, err
		}

		teamMember, err := a.GetTeamMember(teamId, userId)
		if err != nil {
			return nil, err
		}
		membersWithErrors = append(membersWithErrors, &model.TeamMemberWithError{
			UserId: userId,
			Member: teamMember,
		})

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", userId, nil)
		message.Add("team_id", teamId)
		message.Add("user_id", userId)
		a.Publish(message)
	}

	return membersWithErrors, nil
}

func (a *App) AddTeamMemberByToken(userId, tokenId string) (*model.TeamMember, *model.AppError) {
	team, err := a.AddUserToTeamByToken(userId, tokenId)
	if err != nil {
		return nil, err
	}

	teamMember, err := a.GetTeamMember(team.Id, userId)
	if err != nil {
		return nil, err
	}

	return teamMember, nil
}

func (a *App) AddTeamMemberByInviteId(inviteId, userId string) (*model.TeamMember, *model.AppError) {
	team, err := a.AddUserToTeamByInviteId(inviteId, userId)
	if err != nil {
		return nil, err
	}

	if team.IsGroupConstrained() {
		return nil, model.NewAppError("AddTeamMemberByInviteId", "app.team.invite_id.group_constrained.error", nil, "", http.StatusForbidden)
	}

	teamMember, err := a.GetTeamMember(team.Id, userId)
	if err != nil {
		return nil, err
	}
	return teamMember, nil
}

func (a *App) GetTeamUnread(teamId, userId string) (*model.TeamUnread, *model.AppError) {
	channelUnreads, err := a.Srv.Store.Team().GetChannelUnreadsForTeam(teamId, userId)
	if err != nil {
		return nil, err
	}

	var teamUnread = &model.TeamUnread{
		MsgCount:     0,
		MentionCount: 0,
		TeamId:       teamId,
	}

	for _, cu := range channelUnreads {
		teamUnread.MentionCount += cu.MentionCount

		if cu.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_MENTION {
			teamUnread.MsgCount += cu.MsgCount
		}
	}

	return teamUnread, nil
}

func (a *App) RemoveUserFromTeam(teamId string, userId string, requestorId string) *model.AppError {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().Get(teamId)
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(userId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-tchan
	if result.Err != nil {
		return result.Err
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.Err != nil {
		return result.Err
	}
	user := result.Data.(*model.User)

	if err := a.LeaveTeam(team, user, requestorId); err != nil {
		return err
	}

	return nil
}

func (a *App) RemoveTeamMemberFromTeam(teamMember *model.TeamMember, requestorId string) *model.AppError {
	// Send the websocket message before we actually do the remove so the user being removed gets it.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LEAVE_TEAM, teamMember.TeamId, "", "", nil)
	message.Add("user_id", teamMember.UserId)
	message.Add("team_id", teamMember.TeamId)
	a.Publish(message)

	user, err := a.Srv.Store.User().Get(teamMember.UserId)
	if err != nil {
		return err
	}

	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if _, err := a.Srv.Store.Team().UpdateMember(teamMember); err != nil {
		return err
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var actor *model.User
		if requestorId != "" {
			actor, _ = a.GetUser(requestorId)
		}

		a.Srv.Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasLeftTeam(pluginContext, teamMember, actor)
				return true
			}, plugin.UserHasLeftTeamId)
		})
	}

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
		a.Srv.Go(func() {
			if err := a.indexUser(user); err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
			}
		})
	}

	if _, err := a.Srv.Store.User().UpdateUpdateAt(user.Id); err != nil {
		return err
	}

	// delete the preferences that set the last channel used in the team and other team specific preferences
	if err := a.Srv.Store.Preference().DeleteCategory(user.Id, teamMember.TeamId); err != nil {
		return err
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)
	a.InvalidateCacheForUserTeams(user.Id)

	return nil
}

func (a *App) LeaveTeam(team *model.Team, user *model.User, requestorId string) *model.AppError {
	teamMember, err := a.GetTeamMember(team.Id, user.Id)
	if err != nil {
		return model.NewAppError("LeaveTeam", "api.team.remove_user_from_team.missing.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	var channelList *model.ChannelList

	if channelList, err = a.Srv.Store.Channel().GetChannels(team.Id, user.Id, true); err != nil {
		if err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			channelList = &model.ChannelList{}
		} else {
			return err
		}
	}

	for _, channel := range *channelList {
		if !channel.IsGroupOrDirect() {
			a.InvalidateCacheForChannelMembers(channel.Id)
			if err = a.Srv.Store.Channel().RemoveMember(channel.Id, user.Id); err != nil {
				return err
			}
		}
	}

	channel, err := a.Srv.Store.Channel().GetByName(team.Id, model.DEFAULT_CHANNEL, false)
	if err != nil {
		return err
	}

	if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
		if requestorId == user.Id {
			if err = a.postLeaveTeamMessage(user, channel); err != nil {
				mlog.Error("Failed to post join/leave message", mlog.Err(err))
			}
		} else {
			if err = a.postRemoveFromTeamMessage(user, channel); err != nil {
				mlog.Error("Failed to post join/leave message", mlog.Err(err))
			}
		}
	}

	err = a.RemoveTeamMemberFromTeam(teamMember, requestorId)
	if err != nil {
		return err
	}

	return nil
}

func (a *App) postLeaveTeamMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.leave.left"), user.Username),
		Type:      model.POST_LEAVE_TEAM,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) postRemoveFromTeamMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.remove_user_from_team.removed"), user.Username),
		Type:      model.POST_REMOVE_FROM_TEAM,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postRemoveFromTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) InviteNewUsersToTeam(emailList []string, teamId, senderId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(emailList) == 0 {
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.no_one.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().Get(teamId)
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(senderId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-tchan
	if result.Err != nil {
		return result.Err
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.Err != nil {
		return result.Err
	}
	user := result.Data.(*model.User)

	var invalidEmailList []string

	for _, email := range emailList {
		if !a.isTeamEmailAddressAllowed(email, team.AllowedDomains) {
			invalidEmailList = append(invalidEmailList, email)
		}
	}

	if len(invalidEmailList) > 0 {
		s := strings.Join(invalidEmailList, ", ")
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]interface{}{"Addresses": s}, "", http.StatusBadRequest)
		return err
	}

	nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
	a.SendInviteEmails(team, user.GetDisplayName(nameFormat), user.Id, emailList, a.GetSiteURL())

	return nil
}

func (a *App) InviteGuestsToChannels(teamId string, guestsInvite *model.GuestsInvite, senderId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := guestsInvite.IsValid(); err != nil {
		return err
	}

	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv.Store.Team().Get(teamId)
		tchan <- store.StoreResult{Data: team, Err: err}
		close(tchan)
	}()
	cchan := make(chan store.StoreResult, 1)
	go func() {
		channels, err := a.Srv.Store.Channel().GetChannelsByIds(guestsInvite.Channels)
		cchan <- store.StoreResult{Data: channels, Err: err}
		close(cchan)
	}()
	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv.Store.User().Get(senderId)
		uchan <- store.StoreResult{Data: user, Err: err}
		close(uchan)
	}()

	result := <-cchan
	if result.Err != nil {
		return result.Err
	}
	channels := result.Data.([]*model.Channel)

	result = <-uchan
	if result.Err != nil {
		return result.Err
	}
	user := result.Data.(*model.User)

	result = <-tchan
	if result.Err != nil {
		return result.Err
	}
	team := result.Data.(*model.Team)

	for _, channel := range channels {
		if channel.TeamId != teamId {
			return model.NewAppError("InviteGuestsToChannels", "api.team.invite_guests.channel_in_invalid_team.app_error", nil, "", http.StatusBadRequest)
		}
	}

	var invalidEmailList []string
	for _, email := range guestsInvite.Emails {
		if !CheckEmailDomain(email, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
			invalidEmailList = append(invalidEmailList, email)
		}
	}

	if len(invalidEmailList) > 0 {
		s := strings.Join(invalidEmailList, ", ")
		err := model.NewAppError("InviteGuestsToChannels", "api.team.invite_members.invalid_email.app_error", map[string]interface{}{"Addresses": s}, "", http.StatusBadRequest)
		return err
	}

	nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
	a.SendGuestInviteEmails(team, channels, user.GetDisplayName(nameFormat), user.Id, guestsInvite.Emails, a.GetSiteURL(), guestsInvite.Message)

	return nil
}

func (a *App) FindTeamByName(name string) bool {
	if _, err := a.Srv.Store.Team().GetByName(name); err != nil {
		return false
	}
	return true
}

func (a *App) GetTeamsUnreadForUser(excludeTeamId string, userId string) ([]*model.TeamUnread, *model.AppError) {
	data, err := a.Srv.Store.Team().GetChannelUnreadsForAllTeams(excludeTeamId, userId)
	if err != nil {
		return nil, err
	}
	members := []*model.TeamUnread{}
	membersMap := make(map[string]*model.TeamUnread)

	unreads := func(cu *model.ChannelUnread, tu *model.TeamUnread) *model.TeamUnread {
		tu.MentionCount += cu.MentionCount

		if cu.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.CHANNEL_MARK_UNREAD_MENTION {
			tu.MsgCount += cu.MsgCount
		}

		return tu
	}

	for i := range data {
		id := data[i].TeamId
		if mu, ok := membersMap[id]; ok {
			membersMap[id] = unreads(data[i], mu)
		} else {
			membersMap[id] = unreads(data[i], &model.TeamUnread{
				MsgCount:     0,
				MentionCount: 0,
				TeamId:       id,
			})
		}
	}

	for _, val := range membersMap {
		members = append(members, val)
	}

	return members, nil
}

func (a *App) PermanentDeleteTeamId(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	return a.PermanentDeleteTeam(team)
}

func (a *App) PermanentDeleteTeam(team *model.Team) *model.AppError {
	team.DeleteAt = model.GetMillis()
	if _, err := a.Srv.Store.Team().Update(team); err != nil {
		return err
	}

	if channels, err := a.Srv.Store.Channel().GetTeamChannels(team.Id); err != nil {
		if err.Id != "store.sql_channel.get_channels.not_found.app_error" {
			return err
		}
	} else {
		for _, c := range *channels {
			a.PermanentDeleteChannel(c)
		}
	}

	if err := a.Srv.Store.Team().RemoveAllMembersByTeam(team.Id); err != nil {
		return err
	}

	if err := a.Srv.Store.Command().PermanentDeleteByTeam(team.Id); err != nil {
		return err
	}

	if err := a.Srv.Store.Team().PermanentDelete(team.Id); err != nil {
		return err
	}

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_DELETE_TEAM)

	return nil
}

func (a *App) SoftDeleteTeam(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	team.DeleteAt = model.GetMillis()
	if team, err = a.Srv.Store.Team().Update(team); err != nil {
		return err
	}

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_DELETE_TEAM)

	return nil
}

func (a *App) RestoreTeam(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	team.DeleteAt = 0
	if team, err = a.Srv.Store.Team().Update(team); err != nil {
		return err
	}

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_RESTORE_TEAM)
	return nil
}

func (a *App) GetTeamStats(teamId string, restrictions *model.ViewUsersRestrictions) (*model.TeamStats, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		totalMemberCount, err := a.Srv.Store.Team().GetTotalMemberCount(teamId, restrictions)
		tchan <- store.StoreResult{Data: totalMemberCount, Err: err}
		close(tchan)
	}()
	achan := make(chan store.StoreResult, 1)
	go func() {
		memberCount, err := a.Srv.Store.Team().GetActiveMemberCount(teamId, restrictions)
		achan <- store.StoreResult{Data: memberCount, Err: err}
		close(achan)
	}()

	stats := &model.TeamStats{}
	stats.TeamId = teamId

	result := <-tchan
	if result.Err != nil {
		return nil, result.Err
	}
	stats.TotalMemberCount = result.Data.(int64)

	result = <-achan
	if result.Err != nil {
		return nil, result.Err
	}
	stats.ActiveMemberCount = result.Data.(int64)

	return stats, nil
}

func (a *App) GetTeamIdFromQuery(query url.Values) (string, *model.AppError) {
	tokenId := query.Get("t")
	inviteId := query.Get("id")

	if len(tokenId) > 0 {
		token, err := a.Srv.Store.Token().GetByToken(tokenId)
		if err != nil {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		if token.Type != TOKEN_TYPE_TEAM_INVITATION {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		if model.GetMillis()-token.CreateAt >= INVITATION_EXPIRY_TIME {
			a.DeleteToken(token)
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.expired_link.app_error", nil, "", http.StatusBadRequest)
		}

		tokenData := model.MapFromJson(strings.NewReader(token.Extra))

		return tokenData["teamId"], nil
	}
	if len(inviteId) > 0 {
		team, err := a.Srv.Store.Team().GetByInviteId(inviteId)
		if err == nil {
			return team.Id, nil
		}
		// soft fail, so we still create user but don't auto-join team
		mlog.Error("error getting team by inviteId.", mlog.String("invite_id", inviteId), mlog.Err(err))
	}

	return "", nil
}

func (a *App) SanitizeTeam(session model.Session, team *model.Team) *model.Team {
	if a.SessionHasPermissionToTeam(session, team.Id, model.PERMISSION_MANAGE_TEAM) {
		return team
	}

	if a.SessionHasPermissionToTeam(session, team.Id, model.PERMISSION_INVITE_USER) {
		inviteId := team.InviteId
		team.Sanitize()
		team.InviteId = inviteId
		return team
	}

	team.Sanitize()

	return team
}

func (a *App) SanitizeTeams(session model.Session, teams []*model.Team) []*model.Team {
	for _, team := range teams {
		a.SanitizeTeam(session, team)
	}

	return teams
}

func (a *App) GetTeamIcon(team *model.Team) ([]byte, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.filesettings_no_driver.app_error", nil, "", http.StatusNotImplemented)
	}

	path := "teams/" + team.Id + "/teamIcon.png"
	data, err := a.ReadFile(path)
	if err != nil {
		return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.read_file.app_error", nil, err.Error(), http.StatusNotFound)
	}

	return data, nil
}

func (a *App) SetTeamIcon(teamId string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.open.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer file.Close()
	return a.SetTeamIconFromMultiPartFile(teamId, file)
}

func (a *App) SetTeamIconFromMultiPartFile(teamId string, file multipart.File) *model.AppError {
	team, getTeamErr := a.GetTeam(teamId)

	if getTeamErr != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.get_team.app_error", nil, getTeamErr.Error(), http.StatusBadRequest)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return model.NewAppError("setTeamIcon", "api.team.set_team_icon.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.decode_config.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	if config.Width*config.Height > model.MaxImageSize {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.too_large.app_error", nil, "", http.StatusBadRequest)
	}

	file.Seek(0, 0)

	return a.SetTeamIconFromFile(team, file)
}

func (a *App) SetTeamIconFromFile(team *model.Team, file io.Reader) *model.AppError {
	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.decode.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	orientation, _ := getImageOrientation(file)
	img = makeImageUpright(img, orientation)

	// Scale team icon
	teamIconWidthAndHeight := 128
	img = imaging.Fill(img, teamIconWidthAndHeight, teamIconWidthAndHeight, imaging.Center, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	path := "teams/" + team.Id + "/teamIcon.png"

	if _, err := a.WriteFile(buf, path); err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.write_file.app_error", nil, "", http.StatusInternalServerError)
	}

	curTime := model.GetMillis()

	if err := a.Srv.Store.Team().UpdateLastTeamIconUpdate(team.Id, curTime); err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.team_icon.update.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	// manually set time to avoid possible cluster inconsistencies
	team.LastTeamIconUpdate = curTime

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return nil
}

func (a *App) RemoveTeamIcon(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return model.NewAppError("RemoveTeamIcon", "api.team.remove_team_icon.get_team.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err := a.Srv.Store.Team().UpdateLastTeamIconUpdate(teamId, 0); err != nil {
		return model.NewAppError("RemoveTeamIcon", "api.team.team_icon.update.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	team.LastTeamIconUpdate = 0

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return nil
}

func (a *App) InvalidateAllEmailInvites() *model.AppError {
	if err := a.Srv.Store.Token().RemoveAllTokensByType(TOKEN_TYPE_TEAM_INVITATION); err != nil {
		return model.NewAppError("InvalidateAllEmailInvites", "api.team.invalidate_all_email_invites.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	if err := a.Srv.Store.Token().RemoveAllTokensByType(TOKEN_TYPE_GUEST_INVITATION); err != nil {
		return model.NewAppError("InvalidateAllEmailInvites", "api.team.invalidate_all_email_invites.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) ClearTeamMembersCache(teamID string) {
	perPage := 100
	page := 0

	for {
		teamMembers, err := a.Srv.Store.Team().GetMembers(teamID, page, perPage, &model.ViewUsersRestrictions{})
		if err != nil {
			a.Log.Warn("error clearing cache for team members", mlog.String("team_id", teamID))
			break
		}

		for _, teamMember := range teamMembers {
			a.ClearSessionCacheForUser(teamMember.UserId)

			message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_MEMBERROLE_UPDATED, "", "", teamMember.UserId, nil)
			message.Add("member", teamMember.ToJson())
			a.Publish(message)
		}

		length := len(teamMembers)
		if length < perPage {
			break
		}

		page++
	}
}
