// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (api *API) InitUserLocal() {
	api.BaseRoutes.Users.Handle("", api.APILocal(localGetUsers)).Methods("GET")
	api.BaseRoutes.Users.Handle("", api.APILocal(localPermanentDeleteAllUsers)).Methods("DELETE")
	api.BaseRoutes.Users.Handle("", api.APILocal(createUser)).Methods("POST")
	api.BaseRoutes.Users.Handle("/password/reset/send", api.APILocal(sendPasswordReset)).Methods("POST")
	api.BaseRoutes.Users.Handle("/ids", api.APILocal(localGetUsersByIds)).Methods("POST")

	api.BaseRoutes.User.Handle("", api.APILocal(localGetUser)).Methods("GET")
	api.BaseRoutes.User.Handle("", api.APILocal(updateUser)).Methods("PUT")
	api.BaseRoutes.User.Handle("", api.APILocal(localDeleteUser)).Methods("DELETE")
	api.BaseRoutes.User.Handle("/roles", api.APILocal(updateUserRoles)).Methods("PUT")
	api.BaseRoutes.User.Handle("/mfa", api.APILocal(updateUserMfa)).Methods("PUT")
	api.BaseRoutes.User.Handle("/active", api.APILocal(updateUserActive)).Methods("PUT")
	api.BaseRoutes.User.Handle("/password", api.APILocal(updatePassword)).Methods("PUT")
	api.BaseRoutes.User.Handle("/convert_to_bot", api.APILocal(convertUserToBot)).Methods("POST")
	api.BaseRoutes.User.Handle("/email/verify/member", api.APILocal(verifyUserEmailWithoutToken)).Methods("POST")
	api.BaseRoutes.User.Handle("/promote", api.APILocal(promoteGuestToUser)).Methods("POST")
	api.BaseRoutes.User.Handle("/demote", api.APILocal(demoteUserToGuest)).Methods("POST")

	api.BaseRoutes.UserByUsername.Handle("", api.APILocal(localGetUserByUsername)).Methods("GET")
	api.BaseRoutes.UserByEmail.Handle("", api.APILocal(localGetUserByEmail)).Methods("GET")

	api.BaseRoutes.Users.Handle("/tokens/revoke", api.APILocal(revokeUserAccessToken)).Methods("POST")
	api.BaseRoutes.User.Handle("/tokens", api.APILocal(getUserAccessTokensForUser)).Methods("GET")
	api.BaseRoutes.User.Handle("/tokens", api.APILocal(createUserAccessToken)).Methods("POST")

	api.BaseRoutes.Users.Handle("/migrate_auth/ldap", api.APILocal(migrateAuthToLDAP)).Methods("POST")
	api.BaseRoutes.Users.Handle("/migrate_auth/saml", api.APILocal(migrateAuthToSaml)).Methods("POST")

	api.BaseRoutes.User.Handle("/uploads", api.APILocal(localGetUploadsForUser)).Methods("GET")
}

func localGetUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	inTeamId := r.URL.Query().Get("in_team")
	notInTeamId := r.URL.Query().Get("not_in_team")
	inChannelId := r.URL.Query().Get("in_channel")
	notInChannelId := r.URL.Query().Get("not_in_channel")
	groupConstrained := r.URL.Query().Get("group_constrained")
	withoutTeam := r.URL.Query().Get("without_team")
	active := r.URL.Query().Get("active")
	inactive := r.URL.Query().Get("inactive")
	role := r.URL.Query().Get("role")
	rolesString := r.URL.Query().Get("roles")
	channelRolesString := r.URL.Query().Get("channel_roles")
	teamRolesString := r.URL.Query().Get("team_roles")
	sort := r.URL.Query().Get("sort")
	roleNamesAll := []string{}
	// MM-47378: validate 'role' related parameters
	if role != "" || rolesString != "" || channelRolesString != "" || teamRolesString != "" {
		// fetch all role names
		rolesAll, err := c.App.GetAllRoles()
		if err != nil {
			c.Err = model.NewAppError("Api4.getUsers", "api.user.get_users.validation.app_error", nil, "Error fetching roles during validation.", http.StatusBadRequest)
			return
		}
		for _, role := range rolesAll {
			roleNamesAll = append(roleNamesAll, role.Name)
		}
	}

	var roles []string
	var rolesValid bool

	if role != "" {
		_, rolesValid = model.CleanRoleNames([]string{role})
		if !rolesValid {
			c.SetInvalidParam("role")
			return
		}
		roleValid := utils.StringInSlice(role, roleNamesAll)
		if !roleValid {
			c.SetInvalidParam("role")
			return
		}
	}

	if rolesString != "" {
		roles, rolesValid = model.CleanRoleNames(strings.Split(rolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("roles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, roles)
		if len(validRoleNames) != len(roles) {
			c.SetInvalidParam("roles")
			return
		}
	}
	var channelRoles []string
	if channelRolesString != "" && inChannelId != "" {
		channelRoles, rolesValid = model.CleanRoleNames(strings.Split(channelRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("channelRoles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, channelRoles)
		if len(validRoleNames) != len(channelRoles) {
			c.SetInvalidParam("channelRoles")
			return
		}
	}
	var teamRoles []string
	if teamRolesString != "" && inTeamId != "" {
		teamRoles, rolesValid = model.CleanRoleNames(strings.Split(teamRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("teamRoles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, teamRoles)
		if len(validRoleNames) != len(teamRoles) {
			c.SetInvalidParam("teamRoles")
			return
		}
	}

	if notInChannelId != "" && inTeamId == "" {
		c.SetInvalidURLParam("team_id")
		return
	}

	if sort != "" && sort != "last_activity_at" && sort != "create_at" && sort != "status" {
		c.SetInvalidURLParam("sort")
		return
	}

	// Currently only supports sorting on a team
	// or sort="status" on inChannelId
	if (sort == "last_activity_at" || sort == "create_at") && (inTeamId == "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "") {
		c.SetInvalidURLParam("sort")
		return
	}
	if sort == "status" && inChannelId == "" {
		c.SetInvalidURLParam("sort")
		return
	}

	withoutTeamBool, _ := strconv.ParseBool(withoutTeam)
	groupConstrainedBool, _ := strconv.ParseBool(groupConstrained)
	activeBool, _ := strconv.ParseBool(active)
	inactiveBool, _ := strconv.ParseBool(inactive)

	userGetOptions := &model.UserGetOptions{
		InTeamId:         inTeamId,
		InChannelId:      inChannelId,
		NotInTeamId:      notInTeamId,
		NotInChannelId:   notInChannelId,
		GroupConstrained: groupConstrainedBool,
		WithoutTeam:      withoutTeamBool,
		Active:           activeBool,
		Inactive:         inactiveBool,
		Role:             role,
		Sort:             sort,
		Page:             c.Params.Page,
		PerPage:          c.Params.PerPage,
		ViewRestrictions: nil,
	}

	var (
		appErr   *model.AppError
		profiles []*model.User
		etag     string
	)

	if withoutTeamBool, _ := strconv.ParseBool(withoutTeam); withoutTeamBool {
		profiles, appErr = c.App.GetUsersWithoutTeamPage(userGetOptions, c.IsSystemAdmin())
	} else if notInChannelId != "" {
		profiles, appErr = c.App.GetUsersNotInChannelPage(inTeamId, notInChannelId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), nil)
	} else if notInTeamId != "" {
		etag = c.App.GetUsersNotInTeamEtag(inTeamId, "")
		if c.HandleEtag(etag, "Get Users Not in Team", w, r) {
			return
		}

		profiles, appErr = c.App.GetUsersNotInTeamPage(notInTeamId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), nil)
	} else if inTeamId != "" {
		if sort == "last_activity_at" {
			profiles, appErr = c.App.GetRecentlyActiveUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), nil)
		} else if sort == "create_at" {
			profiles, appErr = c.App.GetNewUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), nil)
		} else {
			etag = c.App.GetUsersInTeamEtag(inTeamId, "")
			if c.HandleEtag(etag, "Get Users in Team", w, r) {
				return
			}
			profiles, appErr = c.App.GetUsersInTeamPage(userGetOptions, c.IsSystemAdmin())
		}
	} else if inChannelId != "" {
		if sort == "status" {
			profiles, appErr = c.App.GetUsersInChannelPageByStatus(userGetOptions, c.IsSystemAdmin())
		} else {
			profiles, appErr = c.App.GetUsersInChannelPage(userGetOptions, c.IsSystemAdmin())
		}
	} else {
		profiles, appErr = c.App.GetUsersPage(userGetOptions, c.IsSystemAdmin())
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}

	js, err := json.Marshal(profiles)
	if err != nil {
		c.Err = model.NewAppError("localGetUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func localGetUsersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJSON(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	sinceString := r.URL.Query().Get("since")

	options := &store.UserGetByIdsOpts{
		IsAdmin: c.IsSystemAdmin(),
	}

	if sinceString != "" {
		since, err := strconv.ParseInt(sinceString, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("since", err)
			return
		}
		options.Since = since
	}

	users, appErr := c.App.GetUsersByIds(userIds, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(users)
	if err != nil {
		c.Err = model.NewAppError("localGetUsersByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func localGetUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
	if err != nil && err.StatusCode != http.StatusNotFound {
		c.Err = err
		return
	}

	if userTermsOfService != nil {
		user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
		user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localDeleteUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userId := c.Params.UserId

	auditRec := c.MakeAuditRecord("localDeleteUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	user, err := c.App.GetUser(userId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventParameter("user_id", c.Params.UserId)
	auditRec.AddEventPriorState(user)
	auditRec.AddEventObjectType("user")

	if c.Params.Permanent {
		err = c.App.PermanentDeleteUser(c.AppContext, user)
	} else {
		_, err = c.App.UpdateActive(c.AppContext, user, false)
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func localPermanentDeleteAllUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("localPermanentDeleteAllUsers", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.PermanentDeleteAllUsers(c.AppContext); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func localGetUserByUsername(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUsername()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUserByUsername(c.Params.Username)
	if err != nil {
		c.Err = err
		return
	}

	userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
	if err != nil && err.StatusCode != http.StatusNotFound {
		c.Err = err
		return
	}

	if userTermsOfService != nil {
		user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
		user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUserByEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.SanitizeEmail()
	if c.Err != nil {
		return
	}

	sanitizeOptions := c.App.GetSanitizeOptions(c.IsSystemAdmin())
	if !sanitizeOptions["email"] {
		c.Err = model.NewAppError("getUserByEmail", "api.user.get_user_by_email.permissions.app_error", nil, "userId="+c.AppContext.Session().UserId, http.StatusForbidden)
		return
	}

	user, err := c.App.GetUserByEmail(c.Params.Email)
	if err != nil {
		c.Err = err
		return
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUploadsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	uss, appErr := c.App.GetUploadSessionsForUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(uss)
	if err != nil {
		c.Err = model.NewAppError("localGetUploadsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}
