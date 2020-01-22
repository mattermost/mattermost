// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (api *API) InitUser() {
	api.BaseRoutes.Users.Handle("", api.ApiHandler(createUser)).Methods("POST")
	api.BaseRoutes.Users.Handle("", api.ApiSessionRequired(getUsers)).Methods("GET")
	api.BaseRoutes.Users.Handle("/ids", api.ApiSessionRequired(getUsersByIds)).Methods("POST")
	api.BaseRoutes.Users.Handle("/usernames", api.ApiSessionRequired(getUsersByNames)).Methods("POST")
	api.BaseRoutes.Users.Handle("/search", api.ApiSessionRequiredDisableWhenBusy(searchUsers)).Methods("POST")
	api.BaseRoutes.Users.Handle("/autocomplete", api.ApiSessionRequired(autocompleteUsers)).Methods("GET")
	api.BaseRoutes.Users.Handle("/stats", api.ApiSessionRequired(getTotalUsersStats)).Methods("GET")
	api.BaseRoutes.Users.Handle("/group_channels", api.ApiSessionRequired(getUsersByGroupChannelIds)).Methods("POST")

	api.BaseRoutes.User.Handle("", api.ApiSessionRequired(getUser)).Methods("GET")
	api.BaseRoutes.User.Handle("/image/default", api.ApiSessionRequiredTrustRequester(getDefaultProfileImage)).Methods("GET")
	api.BaseRoutes.User.Handle("/image", api.ApiSessionRequiredTrustRequester(getProfileImage)).Methods("GET")
	api.BaseRoutes.User.Handle("/image", api.ApiSessionRequired(setProfileImage)).Methods("POST")
	api.BaseRoutes.User.Handle("/image", api.ApiSessionRequired(setDefaultProfileImage)).Methods("DELETE")
	api.BaseRoutes.User.Handle("", api.ApiSessionRequired(updateUser)).Methods("PUT")
	api.BaseRoutes.User.Handle("/patch", api.ApiSessionRequired(patchUser)).Methods("PUT")
	api.BaseRoutes.User.Handle("", api.ApiSessionRequired(deleteUser)).Methods("DELETE")
	api.BaseRoutes.User.Handle("/roles", api.ApiSessionRequired(updateUserRoles)).Methods("PUT")
	api.BaseRoutes.User.Handle("/active", api.ApiSessionRequired(updateUserActive)).Methods("PUT")
	api.BaseRoutes.User.Handle("/password", api.ApiSessionRequired(updatePassword)).Methods("PUT")
	api.BaseRoutes.User.Handle("/promote", api.ApiSessionRequired(promoteGuestToUser)).Methods("POST")
	api.BaseRoutes.User.Handle("/demote", api.ApiSessionRequired(demoteUserToGuest)).Methods("POST")
	api.BaseRoutes.Users.Handle("/password/reset", api.ApiHandler(resetPassword)).Methods("POST")
	api.BaseRoutes.Users.Handle("/password/reset/send", api.ApiHandler(sendPasswordReset)).Methods("POST")
	api.BaseRoutes.Users.Handle("/email/verify", api.ApiHandler(verifyUserEmail)).Methods("POST")
	api.BaseRoutes.Users.Handle("/email/verify/send", api.ApiHandler(sendVerificationEmail)).Methods("POST")
	api.BaseRoutes.User.Handle("/terms_of_service", api.ApiSessionRequired(saveUserTermsOfService)).Methods("POST")
	api.BaseRoutes.User.Handle("/terms_of_service", api.ApiSessionRequired(getUserTermsOfService)).Methods("GET")

	api.BaseRoutes.User.Handle("/auth", api.ApiSessionRequiredTrustRequester(updateUserAuth)).Methods("PUT")

	api.BaseRoutes.Users.Handle("/mfa", api.ApiHandler(checkUserMfa)).Methods("POST")
	api.BaseRoutes.User.Handle("/mfa", api.ApiSessionRequiredMfa(updateUserMfa)).Methods("PUT")
	api.BaseRoutes.User.Handle("/mfa/generate", api.ApiSessionRequiredMfa(generateMfaSecret)).Methods("POST")

	api.BaseRoutes.Users.Handle("/login", api.ApiHandler(login)).Methods("POST")
	api.BaseRoutes.Users.Handle("/login/switch", api.ApiHandler(switchAccountType)).Methods("POST")
	api.BaseRoutes.Users.Handle("/logout", api.ApiHandler(logout)).Methods("POST")

	api.BaseRoutes.UserByUsername.Handle("", api.ApiSessionRequired(getUserByUsername)).Methods("GET")
	api.BaseRoutes.UserByEmail.Handle("", api.ApiSessionRequired(getUserByEmail)).Methods("GET")

	api.BaseRoutes.User.Handle("/sessions", api.ApiSessionRequired(getSessions)).Methods("GET")
	api.BaseRoutes.User.Handle("/sessions/revoke", api.ApiSessionRequired(revokeSession)).Methods("POST")
	api.BaseRoutes.User.Handle("/sessions/revoke/all", api.ApiSessionRequired(revokeAllSessionsForUser)).Methods("POST")
	api.BaseRoutes.Users.Handle("/sessions/revoke/all", api.ApiSessionRequired(revokeAllSessionsAllUsers)).Methods("POST")
	api.BaseRoutes.Users.Handle("/sessions/device", api.ApiSessionRequired(attachDeviceId)).Methods("PUT")
	api.BaseRoutes.User.Handle("/audits", api.ApiSessionRequired(getUserAudits)).Methods("GET")

	api.BaseRoutes.User.Handle("/tokens", api.ApiSessionRequired(createUserAccessToken)).Methods("POST")
	api.BaseRoutes.User.Handle("/tokens", api.ApiSessionRequired(getUserAccessTokensForUser)).Methods("GET")
	api.BaseRoutes.Users.Handle("/tokens", api.ApiSessionRequired(getUserAccessTokens)).Methods("GET")
	api.BaseRoutes.Users.Handle("/tokens/search", api.ApiSessionRequired(searchUserAccessTokens)).Methods("POST")
	api.BaseRoutes.Users.Handle("/tokens/{token_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getUserAccessToken)).Methods("GET")
	api.BaseRoutes.Users.Handle("/tokens/revoke", api.ApiSessionRequired(revokeUserAccessToken)).Methods("POST")
	api.BaseRoutes.Users.Handle("/tokens/disable", api.ApiSessionRequired(disableUserAccessToken)).Methods("POST")
	api.BaseRoutes.Users.Handle("/tokens/enable", api.ApiSessionRequired(enableUserAccessToken)).Methods("POST")
}

func createUser(c *Context, w http.ResponseWriter, r *http.Request) {
	user := model.UserFromJson(r.Body)
	if user == nil {
		c.SetInvalidParam("user")
		return
	}

	user.SanitizeInput(c.IsSystemAdmin())

	tokenId := r.URL.Query().Get("t")
	inviteId := r.URL.Query().Get("iid")

	// No permission check required

	var ruser *model.User
	var err *model.AppError
	if len(tokenId) > 0 {
		var token *model.Token
		token, err = c.App.Srv.Store.Token().GetByToken(tokenId)
		if err != nil {
			c.Err = model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_invalid.app_error", nil, err.Error(), http.StatusBadRequest)
			return
		}

		if token.Type == app.TOKEN_TYPE_GUEST_INVITATION {
			if c.App.License() == nil {
				c.Err = model.NewAppError("CreateUserWithToken", "api.user.create_user.guest_accounts.license.app_error", nil, "", http.StatusBadRequest)
				return
			}
			if !*c.App.Config().GuestAccountsSettings.Enable {
				c.Err = model.NewAppError("CreateUserWithToken", "api.user.create_user.guest_accounts.disabled.app_error", nil, "", http.StatusBadRequest)
				return
			}
		}
		ruser, err = c.App.CreateUserWithToken(user, token)
	} else if len(inviteId) > 0 {
		ruser, err = c.App.CreateUserWithInviteId(user, inviteId)
	} else if c.IsSystemAdmin() {
		ruser, err = c.App.CreateUserAsAdmin(user)
	} else {
		ruser, err = c.App.CreateUserFromSignup(user)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(ruser.ToJson()))
}

func getUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, c.Params.UserId)
	if err != nil {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if c.IsSystemAdmin() || c.App.Session.UserId == user.Id {
		userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			c.Err = err
			return
		}

		if userTermsOfService != nil {
			user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
			user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
		}
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	if c.App.Session.UserId == user.Id {
		user.Sanitize(map[string]bool{})
	} else {
		c.App.SanitizeProfile(user, c.IsSystemAdmin())
	}
	c.App.UpdateLastActivityAtIfNeeded(c.App.Session)
	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(user.ToJson()))
}

func getUserByUsername(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUsername()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUserByUsername(c.Params.Username)
	if err != nil {
		restrictions, err2 := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
		if err2 != nil {
			c.Err = err2
			return
		}
		if restrictions != nil {
			c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
			return
		}
		c.Err = err
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	if c.IsSystemAdmin() || c.App.Session.UserId == user.Id {
		userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			c.Err = err
			return
		}

		if userTermsOfService != nil {
			user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
			user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
		}
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	if c.App.Session.UserId == user.Id {
		user.Sanitize(map[string]bool{})
	} else {
		c.App.SanitizeProfile(user, c.IsSystemAdmin())
	}
	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(user.ToJson()))
}

func getUserByEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmail()
	if c.Err != nil {
		return
	}

	sanitizeOptions := c.App.GetSanitizeOptions(c.IsSystemAdmin())
	if !sanitizeOptions["email"] {
		c.Err = model.NewAppError("getUserByEmail", "api.user.get_user_by_email.permissions.app_error", nil, "userId="+c.App.Session.UserId, http.StatusForbidden)
		return
	}

	user, err := c.App.GetUserByEmail(c.Params.Email)
	if err != nil {
		restrictions, err2 := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
		if err2 != nil {
			c.Err = err2
			return
		}
		if restrictions != nil {
			c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
			return
		}
		c.Err = err
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(user.ToJson()))
}

func getDefaultProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	img, err := c.App.GetDefaultProfileImage(user)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, public", 24*60*60)) // 24 hrs
	w.Header().Set("Content-Type", "image/png")
	w.Write(img)
}

func getProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	etag := strconv.FormatInt(user.LastPictureUpdate, 10)
	if c.HandleEtag(etag, "Get Profile Image", w, r) {
		return
	}

	img, readFailed, err := c.App.GetProfileImage(user)
	if err != nil {
		c.Err = err
		return
	}

	if readFailed {
		w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, public", 5*60)) // 5 mins
	} else {
		w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, public", 24*60*60)) // 24 hrs
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	}

	w.Header().Set("Content-Type", "image/png")
	w.Write(img)
}

func setProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm
	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	imageData := imageArray[0]
	if err := c.App.SetProfileImage(c.Params.UserId, imageData); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func setDefaultProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("setDefaultProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := c.App.SetDefaultProfileImage(user); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func getTotalUsersStats(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	stats, err := c.App.GetTotalUsersStats(restrictions)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(stats.ToJson()))
}

func getUsersByGroupChannelIds(c *Context, w http.ResponseWriter, r *http.Request) {
	channelIds := model.ArrayFromJson(r.Body)

	if len(channelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	usersByChannelId, err := c.App.GetUsersByGroupChannelIds(channelIds, c.IsSystemAdmin())
	if err != nil {
		c.Err = err
		return
	}

	b, _ := json.Marshal(usersByChannelId)
	w.Write(b)
}

func getUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	inTeamId := r.URL.Query().Get("in_team")
	notInTeamId := r.URL.Query().Get("not_in_team")
	inChannelId := r.URL.Query().Get("in_channel")
	notInChannelId := r.URL.Query().Get("not_in_channel")
	groupConstrained := r.URL.Query().Get("group_constrained")
	withoutTeam := r.URL.Query().Get("without_team")
	inactive := r.URL.Query().Get("inactive")
	role := r.URL.Query().Get("role")
	sort := r.URL.Query().Get("sort")

	if len(notInChannelId) > 0 && len(inTeamId) == 0 {
		c.SetInvalidUrlParam("team_id")
		return
	}

	if sort != "" && sort != "last_activity_at" && sort != "create_at" && sort != "status" {
		c.SetInvalidUrlParam("sort")
		return
	}

	// Currently only supports sorting on a team
	// or sort="status" on inChannelId
	if (sort == "last_activity_at" || sort == "create_at") && (inTeamId == "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "") {
		c.SetInvalidUrlParam("sort")
		return
	}
	if sort == "status" && inChannelId == "" {
		c.SetInvalidUrlParam("sort")
		return
	}

	withoutTeamBool, _ := strconv.ParseBool(withoutTeam)
	groupConstrainedBool, _ := strconv.ParseBool(groupConstrained)
	inactiveBool, _ := strconv.ParseBool(inactive)

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	userGetOptions := &model.UserGetOptions{
		InTeamId:         inTeamId,
		InChannelId:      inChannelId,
		NotInTeamId:      notInTeamId,
		NotInChannelId:   notInChannelId,
		GroupConstrained: groupConstrainedBool,
		WithoutTeam:      withoutTeamBool,
		Inactive:         inactiveBool,
		Role:             role,
		Sort:             sort,
		Page:             c.Params.Page,
		PerPage:          c.Params.PerPage,
		ViewRestrictions: restrictions,
	}

	var profiles []*model.User
	etag := ""

	if withoutTeamBool, _ := strconv.ParseBool(withoutTeam); withoutTeamBool {
		// Use a special permission for now
		if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_LIST_USERS_WITHOUT_TEAM) {
			c.SetPermissionError(model.PERMISSION_LIST_USERS_WITHOUT_TEAM)
			return
		}

		profiles, err = c.App.GetUsersWithoutTeamPage(userGetOptions, c.IsSystemAdmin())
	} else if len(notInChannelId) > 0 {
		if !c.App.SessionHasPermissionToChannel(c.App.Session, notInChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		profiles, err = c.App.GetUsersNotInChannelPage(inTeamId, notInChannelId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
	} else if len(notInTeamId) > 0 {
		if !c.App.SessionHasPermissionToTeam(c.App.Session, notInTeamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		etag = c.App.GetUsersNotInTeamEtag(inTeamId, restrictions.Hash())
		if c.HandleEtag(etag, "Get Users Not in Team", w, r) {
			return
		}

		profiles, err = c.App.GetUsersNotInTeamPage(notInTeamId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
	} else if len(inTeamId) > 0 {
		if !c.App.SessionHasPermissionToTeam(c.App.Session, inTeamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		if sort == "last_activity_at" {
			profiles, err = c.App.GetRecentlyActiveUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
		} else if sort == "create_at" {
			profiles, err = c.App.GetNewUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
		} else {
			etag = c.App.GetUsersInTeamEtag(inTeamId, restrictions.Hash())
			if c.HandleEtag(etag, "Get Users in Team", w, r) {
				return
			}
			profiles, err = c.App.GetUsersInTeamPage(userGetOptions, c.IsSystemAdmin())
		}
	} else if len(inChannelId) > 0 {
		if !c.App.SessionHasPermissionToChannel(c.App.Session, inChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
		if sort == "status" {
			profiles, err = c.App.GetUsersInChannelPageByStatus(inChannelId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
		} else {
			profiles, err = c.App.GetUsersInChannelPage(inChannelId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
		}
	} else {
		userGetOptions, err = c.App.RestrictUsersGetByPermissions(c.App.Session.UserId, userGetOptions)
		if err != nil {
			c.Err = err
			return
		}
		profiles, err = c.App.GetUsersPage(userGetOptions, c.IsSystemAdmin())
	}

	if err != nil {
		c.Err = err
		return
	}

	if len(etag) > 0 {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	}
	c.App.UpdateLastActivityAtIfNeeded(c.App.Session)
	w.Write([]byte(model.UserListToJson(profiles)))
}

func getUsersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	sinceString := r.URL.Query().Get("since")

	options := &store.UserGetByIdsOpts{
		IsAdmin: c.IsSystemAdmin(),
	}

	if len(sinceString) > 0 {
		since, parseError := strconv.ParseInt(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParam("since")
			return
		}
		options.Since = since
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}
	options.ViewRestrictions = restrictions

	users, err := c.App.GetUsersByIds(userIds, options)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserListToJson(users)))
}

func getUsersByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	usernames := model.ArrayFromJson(r.Body)

	if len(usernames) == 0 {
		c.SetInvalidParam("usernames")
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	users, err := c.App.GetUsersByUsernames(usernames, c.IsSystemAdmin(), restrictions)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserListToJson(users)))
}

func searchUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.UserSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("")
		return
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("term")
		return
	}

	if props.TeamId == "" && props.NotInChannelId != "" {
		c.SetInvalidParam("team_id")
		return
	}

	if props.InChannelId != "" && !c.App.SessionHasPermissionToChannel(c.App.Session, props.InChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if props.NotInChannelId != "" && !c.App.SessionHasPermissionToChannel(c.App.Session, props.NotInChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if props.TeamId != "" && !c.App.SessionHasPermissionToTeam(c.App.Session, props.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if props.NotInTeamId != "" && !c.App.SessionHasPermissionToTeam(c.App.Session, props.NotInTeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if props.Limit <= 0 || props.Limit > model.USER_SEARCH_MAX_LIMIT {
		c.SetInvalidParam("limit")
		return
	}

	options := &model.UserSearchOptions{
		IsAdmin:          c.IsSystemAdmin(),
		AllowInactive:    props.AllowInactive,
		GroupConstrained: props.GroupConstrained,
		Limit:            props.Limit,
		Role:             props.Role,
	}

	if c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		options.AllowEmails = true
		options.AllowFullNames = true
	} else {
		options.AllowEmails = *c.App.Config().PrivacySettings.ShowEmailAddress
		options.AllowFullNames = *c.App.Config().PrivacySettings.ShowFullName
	}

	options, err := c.App.RestrictUsersSearchByPermissions(c.App.Session.UserId, options)
	if err != nil {
		c.Err = err
		return
	}

	profiles, err := c.App.SearchUsers(props, options)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserListToJson(profiles)))
}

func autocompleteUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("in_channel")
	teamId := r.URL.Query().Get("in_team")
	name := r.URL.Query().Get("name")
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limitStr == "" {
		limit = model.USER_SEARCH_DEFAULT_LIMIT
	} else if limit > model.USER_SEARCH_MAX_LIMIT {
		limit = model.USER_SEARCH_MAX_LIMIT
	}

	options := &model.UserSearchOptions{
		IsAdmin: c.IsSystemAdmin(),
		// Never autocomplete on emails.
		AllowEmails: false,
		Limit:       limit,
	}

	if c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		options.AllowFullNames = true
	} else {
		options.AllowFullNames = *c.App.Config().PrivacySettings.ShowFullName
	}

	if len(channelId) > 0 {
		if !c.App.SessionHasPermissionToChannel(c.App.Session, channelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if len(teamId) > 0 {
		if !c.App.SessionHasPermissionToTeam(c.App.Session, teamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}
	}

	var autocomplete model.UserAutocomplete

	var err *model.AppError
	options, err = c.App.RestrictUsersSearchByPermissions(c.App.Session.UserId, options)
	if err != nil {
		c.Err = err
		return
	}

	if len(channelId) > 0 {
		// Applying the provided teamId here is useful for DMs and GMs which don't belong
		// to a team. Applying it when the channel does belong to a team makes less sense,
		// but the permissions are checked above regardless.
		result, err := c.App.AutocompleteUsersInChannel(teamId, channelId, name, options)
		if err != nil {
			c.Err = err
			return
		}

		autocomplete.Users = result.InChannel
		autocomplete.OutOfChannel = result.OutOfChannel
	} else if len(teamId) > 0 {
		result, err := c.App.AutocompleteUsersInTeam(teamId, name, options)
		if err != nil {
			c.Err = err
			return
		}

		autocomplete.Users = result.InTeam
	} else {
		result, err := c.App.SearchUsersInTeam("", name, options)
		if err != nil {
			c.Err = err
			return
		}
		autocomplete.Users = result
	}

	w.Write([]byte((autocomplete.ToJson())))
}

func updateUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	user := model.UserFromJson(r.Body)
	if user == nil {
		c.SetInvalidParam("user")
		return
	}

	// The user being updated in the payload must be the same one as indicated in the URL.
	if user.Id != c.Params.UserId {
		c.SetInvalidParam("user_id")
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, user.Id) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	ouser, err := c.App.GetUser(user.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.App.Session.IsOAuth {
		if ouser.Email != user.Email {
			c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
			c.Err.DetailedError += ", attempted email update by oauth app"
			return
		}
	}

	// If eMail update is attempted by the currently logged in user, check if correct password was provided
	if user.Email != "" && ouser.Email != user.Email && c.App.Session.UserId == c.Params.UserId {
		err = c.App.DoubleCheckPassword(ouser, user.Password)
		if err != nil {
			c.SetInvalidParam("password")
			return
		}
	}

	ruser, err := c.App.UpdateUserAsUser(user, c.IsSystemAdmin())
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	w.Write([]byte(ruser.ToJson()))
}

func patchUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	patch := model.UserPatchFromJson(r.Body)
	if patch == nil {
		c.SetInvalidParam("user")
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	ouser, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.SetInvalidParam("user_id")
		return
	}

	if c.App.Session.IsOAuth && patch.Email != nil {
		if ouser.Email != *patch.Email {
			c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
			c.Err.DetailedError += ", attempted email update by oauth app"
			return
		}
	}

	// If eMail update is attempted by the currently logged in user, check if correct password was provided
	if patch.Email != nil && ouser.Email != *patch.Email && c.App.Session.UserId == c.Params.UserId {
		if patch.Password == nil {
			c.SetInvalidParam("password")
			return
		}

		if err = c.App.DoubleCheckPassword(ouser, *patch.Password); err != nil {
			c.Err = err
			return
		}
	}

	ruser, err := c.App.PatchUser(c.Params.UserId, patch, c.IsSystemAdmin())
	if err != nil {
		c.Err = err
		return
	}

	c.App.SetAutoResponderStatus(ruser, ouser.NotifyProps)
	c.LogAudit("")
	w.Write([]byte(ruser.ToJson()))
}

func deleteUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userId := c.Params.UserId

	if !c.App.SessionHasPermissionToUser(c.App.Session, userId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	// if EnableUserDeactivation flag is disabled the user cannot deactivate himself.
	if c.Params.UserId == c.App.Session.UserId && !*c.App.Config().TeamSettings.EnableUserDeactivation && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewAppError("deleteUser", "api.user.update_active.not_enable.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	user, err := c.App.GetUser(userId)
	if err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.UpdateActive(user, false); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func updateUserRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("roles")
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_ROLES)
		return
	}

	if _, err := c.App.UpdateUserRoles(c.Params.UserId, newRoles, true); err != nil {
		c.Err = err
		return
	}

	c.LogAudit(fmt.Sprintf("user=%s roles=%s", c.Params.UserId, newRoles))
	ReturnStatusOK(w)
}

func updateUserActive(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJson(r.Body)

	active, ok := props["active"].(bool)
	if !ok {
		c.SetInvalidParam("active")
		return
	}

	// true when you're trying to de-activate yourself
	isSelfDeactive := !active && c.Params.UserId == c.App.Session.UserId

	if !isSelfDeactive && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.permissions.app_error", nil, "userId="+c.Params.UserId, http.StatusForbidden)
		return
	}

	// if EnableUserDeactivation flag is disabled the user cannot deactivate himself.
	if isSelfDeactive && !*c.App.Config().TeamSettings.EnableUserDeactivation {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.not_enable.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if active && user.IsGuest() && !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.cannot_enable_guest_when_guest_feature_is_disabled.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	if _, err = c.App.UpdateActive(user, active); err != nil {
		c.Err = err
	}

	c.LogAudit(fmt.Sprintf("user_id=%s active=%v", user.Id, active))
	if isSelfDeactive {
		c.App.Srv.Go(func() {
			if err = c.App.SendDeactivateAccountEmail(user.Email, user.Locale, c.App.GetSiteURL()); err != nil {
				mlog.Error(err.Error())
			}
		})
	}
	ReturnStatusOK(w)
}

func updateUserAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userAuth := model.UserAuthFromJson(r.Body)
	if userAuth == nil {
		c.SetInvalidParam("user")
		return
	}

	user, err := c.App.UpdateUserAuth(c.Params.UserId, userAuth)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit(fmt.Sprintf("updated user %s auth to service=%v", c.Params.UserId, user.AuthService))
	w.Write([]byte(user.ToJson()))
}

// Deprecated: checkUserMfa is deprecated and should not be used anymore, starting with version 6.0 it will be disabled.
//			   Clients should attempt a login without MFA and will receive a MFA error when it's required.
func checkUserMfa(c *Context, w http.ResponseWriter, r *http.Request) {

	if *c.App.Config().ServiceSettings.DisableLegacyMFA {
		http.NotFound(w, r)
		return
	}

	props := model.MapFromJson(r.Body)

	loginId := props["login_id"]
	if len(loginId) == 0 {
		c.SetInvalidParam("login_id")
		return
	}

	resp := map[string]interface{}{}
	resp["mfa_required"] = false

	if !*c.App.Config().ServiceSettings.EnableMultifactorAuthentication {
		w.Write([]byte(model.StringInterfaceToJson(resp)))
		return
	}

	if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode {
		resp["mfa_required"] = true
	} else if user, err := c.App.GetUserForLogin("", loginId); err == nil {
		resp["mfa_required"] = user.MfaActive
	}

	w.Write([]byte(model.StringInterfaceToJson(resp)))
}

func updateUserMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session.IsOAuth {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	props := model.StringInterfaceFromJson(r.Body)
	activate, ok := props["activate"].(bool)
	if !ok {
		c.SetInvalidParam("activate")
		return
	}

	code := ""
	if activate {
		code, ok = props["code"].(string)
		if !ok || len(code) == 0 {
			c.SetInvalidParam("code")
			return
		}
	}

	c.LogAudit("attempt")

	if err := c.App.UpdateMfa(activate, c.Params.UserId, code); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - mfa updated")
	ReturnStatusOK(w)
}

func generateMfaSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session.IsOAuth {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	secret, err := c.App.GenerateMfaSecret(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Write([]byte(secret.ToJson()))
}

func updatePassword(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)
	newPassword := props["new_password"]

	c.LogAudit("attempted")

	var err *model.AppError
	if c.Params.UserId == c.App.Session.UserId {
		currentPassword := props["current_password"]
		if len(currentPassword) <= 0 {
			c.SetInvalidParam("current_password")
			return
		}

		err = c.App.UpdatePasswordAsUser(c.Params.UserId, currentPassword, newPassword)
	} else if c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		err = c.App.UpdatePasswordByUserIdSendEmail(c.Params.UserId, newPassword, c.App.T("api.user.reset_password.method"))
	} else {
		err = model.NewAppError("updatePassword", "api.user.update_password.context.app_error", nil, "", http.StatusForbidden)
	}

	if err != nil {
		c.LogAudit("failed")
		c.Err = err
		return
	}

	c.LogAudit("completed")
	ReturnStatusOK(w)
}

func resetPassword(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	token := props["token"]
	if len(token) != model.TOKEN_SIZE {
		c.SetInvalidParam("token")
		return
	}

	newPassword := props["new_password"]

	c.LogAudit("attempt - token=" + token)

	if err := c.App.ResetPasswordFromToken(token, newPassword); err != nil {
		c.LogAudit("fail - token=" + token)
		c.Err = err
		return
	}

	c.LogAudit("success - token=" + token)

	ReturnStatusOK(w)
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("email")
		return
	}

	sent, err := c.App.SendPasswordReset(email, c.App.GetSiteURL())
	if err != nil {
		if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode {
			ReturnStatusOK(w)
		} else {
			c.Err = err
		}
		return
	}

	if sent {
		c.LogAudit("sent=" + email)
	}

	ReturnStatusOK(w)
}

func login(c *Context, w http.ResponseWriter, r *http.Request) {
	// Mask all sensitive errors, with the exception of the following
	defer func() {
		if c.Err == nil {
			return
		}

		unmaskedErrors := []string{
			"mfa.validate_token.authenticate.app_error",
			"api.user.check_user_mfa.bad_code.app_error",
			"api.user.login.blank_pwd.app_error",
			"api.user.login.bot_login_forbidden.app_error",
			"api.user.login.client_side_cert.certificate.app_error",
			"api.user.login.inactive.app_error",
			"api.user.login.not_verified.app_error",
			"api.user.check_user_login_attempts.too_many.app_error",
			"app.team.join_user_to_team.max_accounts.app_error",
			"store.sql_user.save.max_accounts.app_error",
		}

		maskError := true

		for _, unmaskedError := range unmaskedErrors {
			if c.Err.Id == unmaskedError {
				maskError = false
			}
		}

		if !maskError {
			return
		}

		config := c.App.Config()
		enableUsername := *config.EmailSettings.EnableSignInWithUsername
		enableEmail := *config.EmailSettings.EnableSignInWithEmail
		samlEnabled := *config.SamlSettings.Enable
		gitlabEnabled := *config.GetSSOService("gitlab").Enable
		googleEnabled := *config.GetSSOService("google").Enable
		office365Enabled := *config.GetSSOService("office365").Enable

		if samlEnabled || gitlabEnabled || googleEnabled || office365Enabled {
			c.Err = model.NewAppError("login", "api.user.login.invalid_credentials_sso", nil, "", http.StatusUnauthorized)
			return
		}

		if enableUsername && !enableEmail {
			c.Err = model.NewAppError("login", "api.user.login.invalid_credentials_username", nil, "", http.StatusUnauthorized)
			return
		}

		if !enableUsername && enableEmail {
			c.Err = model.NewAppError("login", "api.user.login.invalid_credentials_email", nil, "", http.StatusUnauthorized)
			return
		}

		c.Err = model.NewAppError("login", "api.user.login.invalid_credentials_email_username", nil, "", http.StatusUnauthorized)
	}()

	props := model.MapFromJson(r.Body)

	id := props["id"]
	loginId := props["login_id"]
	password := props["password"]
	mfaToken := props["token"]
	deviceId := props["device_id"]
	ldapOnly := props["ldap_only"] == "true"

	if *c.App.Config().ExperimentalSettings.ClientSideCertEnable {
		if license := c.App.License(); license == nil || !*license.Features.SAML {
			c.Err = model.NewAppError("ClientSideCertNotAllowed", "api.user.login.client_side_cert.license.app_error", nil, "", http.StatusBadRequest)
			return
		}
		certPem, certSubject, certEmail := c.App.CheckForClientSideCert(r)
		mlog.Debug("Client Cert", mlog.String("cert_subject", certSubject), mlog.String("cert_email", certEmail))

		if len(certPem) == 0 || len(certEmail) == 0 {
			c.Err = model.NewAppError("ClientSideCertMissing", "api.user.login.client_side_cert.certificate.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if *c.App.Config().ExperimentalSettings.ClientSideCertCheck == model.CLIENT_SIDE_CERT_CHECK_PRIMARY_AUTH {
			loginId = certEmail
			password = "certificate"
		}
	}

	c.LogAuditWithUserId(id, "attempt - login_id="+loginId)
	user, err := c.App.AuthenticateUserForLogin(id, loginId, password, mfaToken, ldapOnly)

	if err != nil {
		c.LogAuditWithUserId(id, "failure - login_id="+loginId)
		c.Err = err
		return
	}

	if user.IsGuest() {
		if c.App.License() == nil {
			c.Err = model.NewAppError("login", "api.user.login.guest_accounts.license.error", nil, "", http.StatusUnauthorized)
			return
		}
		if !*c.App.Config().GuestAccountsSettings.Enable {
			c.Err = model.NewAppError("login", "api.user.login.guest_accounts.disabled.error", nil, "", http.StatusUnauthorized)
			return
		}
	}

	c.LogAuditWithUserId(user.Id, "authenticated")

	err = c.App.DoLogin(w, r, user, deviceId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAuditWithUserId(user.Id, "success")

	if r.Header.Get(model.HEADER_REQUESTED_WITH) == model.HEADER_REQUESTED_WITH_XML {
		c.App.AttachSessionCookies(w, r)
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

	user.Sanitize(map[string]bool{})

	w.Write([]byte(user.ToJson()))
}

func logout(c *Context, w http.ResponseWriter, r *http.Request) {
	Logout(c, w, r)
}

func Logout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")
	c.RemoveSessionCookie(w, r)
	if c.App.Session.Id != "" {
		if err := c.App.RevokeSessionById(c.App.Session.Id); err != nil {
			c.Err = err
			return
		}
	}

	ReturnStatusOK(w)
}

func getSessions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	sessions, err := c.App.GetSessions(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	for _, session := range sessions {
		session.Sanitize()
	}

	w.Write([]byte(model.SessionsToJson(sessions)))
}

func revokeSession(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	props := model.MapFromJson(r.Body)
	sessionId := props["session_id"]
	if sessionId == "" {
		c.SetInvalidParam("session_id")
		return
	}

	session, err := c.App.GetSessionById(sessionId)
	if err != nil {
		c.Err = err
		return
	}

	if session.UserId != c.Params.UserId {
		c.SetInvalidUrlParam("user_id")
		return
	}

	if err := c.App.RevokeSession(session); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func revokeAllSessionsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if err := c.App.RevokeAllSessions(c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func revokeAllSessionsAllUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.RevokeSessionsFromAllUsers(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func attachDeviceId(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	deviceId := props["device_id"]
	if len(deviceId) == 0 {
		c.SetInvalidParam("device_id")
		return
	}

	// A special case where we logout of all other sessions with the same device id
	if err := c.App.RevokeSessionsForDeviceId(c.App.Session.UserId, deviceId, c.App.Session.Id); err != nil {
		c.Err = err
		return
	}

	c.App.ClearSessionCacheForUser(c.App.Session.UserId)
	c.App.Session.SetExpireInDays(*c.App.Config().ServiceSettings.SessionLengthMobileInDays)

	maxAge := *c.App.Config().ServiceSettings.SessionLengthMobileInDays * 60 * 60 * 24

	secure := false
	if app.GetProtocol(r) == "https" {
		secure = true
	}

	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAge), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    c.App.Session.Token,
		Path:     subpath,
		MaxAge:   maxAge,
		Expires:  expiresAt,
		HttpOnly: true,
		Domain:   c.App.GetCookieDomain(),
		Secure:   secure,
	}

	http.SetCookie(w, sessionCookie)

	if err := c.App.AttachDeviceId(c.App.Session.Id, deviceId, c.App.Session.ExpiresAt); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func getUserAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	audits, err := c.App.GetAuditsPage(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(audits.ToJson()))
}

func verifyUserEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	token := props["token"]
	if len(token) != model.TOKEN_SIZE {
		c.SetInvalidParam("token")
		return
	}

	if err := c.App.VerifyEmailFromToken(token); err != nil {
		c.Err = model.NewAppError("verifyUserEmail", "api.user.verify_email.bad_link.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	c.LogAudit("Email Verified")
	ReturnStatusOK(w)
}

func sendVerificationEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("email")
		return
	}

	user, err := c.App.GetUserForLogin("", email)
	if err != nil {
		// Don't want to leak whether the email is valid or not
		ReturnStatusOK(w)
		return
	}

	if err = c.App.SendEmailVerification(user, user.Email); err != nil {
		// Don't want to leak whether the email is valid or not
		mlog.Error(err.Error())
		ReturnStatusOK(w)
		return
	}

	ReturnStatusOK(w)
}

func switchAccountType(c *Context, w http.ResponseWriter, r *http.Request) {
	switchRequest := model.SwitchRequestFromJson(r.Body)
	if switchRequest == nil {
		c.SetInvalidParam("switch_request")
		return
	}

	link := ""
	var err *model.AppError

	if switchRequest.EmailToOAuth() {
		link, err = c.App.SwitchEmailToOAuth(w, r, switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.NewService)
	} else if switchRequest.OAuthToEmail() {
		c.SessionRequired()
		if c.Err != nil {
			return
		}

		link, err = c.App.SwitchOAuthToEmail(switchRequest.Email, switchRequest.NewPassword, c.App.Session.UserId)
	} else if switchRequest.EmailToLdap() {
		link, err = c.App.SwitchEmailToLdap(switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.LdapLoginId, switchRequest.NewPassword)
	} else if switchRequest.LdapToEmail() {
		link, err = c.App.SwitchLdapToEmail(switchRequest.Password, switchRequest.MfaCode, switchRequest.Email, switchRequest.NewPassword)
	} else {
		c.SetInvalidParam("switch_request")
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(map[string]string{"follow_link": link})))
}

func createUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session.IsOAuth {
		c.SetPermissionError(model.PERMISSION_CREATE_USER_ACCESS_TOKEN)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	accessToken := model.UserAccessTokenFromJson(r.Body)
	if accessToken == nil {
		c.SetInvalidParam("user_access_token")
		return
	}

	if accessToken.Description == "" {
		c.SetInvalidParam("description")
		return
	}

	c.LogAudit("")

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_CREATE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_CREATE_USER_ACCESS_TOKEN)
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	accessToken.UserId = c.Params.UserId
	accessToken.Token = ""

	accessToken, err := c.App.CreateUserAccessToken(accessToken)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	w.Write([]byte(accessToken.ToJson()))
}

func searchUserAccessTokens(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}
	props := model.UserAccessTokenSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("user_access_token_search")
		return
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("term")
		return
	}

	accessTokens, err := c.App.SearchUserAccessTokens(props.Term)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserAccessTokenListToJson(accessTokens)))
}

func getUserAccessTokens(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	accessTokens, err := c.App.GetUserAccessTokens(c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserAccessTokenListToJson(accessTokens)))
}

func getUserAccessTokensForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_READ_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_READ_USER_ACCESS_TOKEN)
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	accessTokens, err := c.App.GetUserAccessTokensForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.UserAccessTokenListToJson(accessTokens)))
}

func getUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTokenId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_READ_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_READ_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(c.Params.TokenId, true)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, accessToken.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	w.Write([]byte(accessToken.ToJson()))
}

func revokeUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	tokenId := props["token_id"]
	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	c.LogAudit("")

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_REVOKE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, accessToken.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if err = c.App.RevokeUserAccessToken(accessToken); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	ReturnStatusOK(w)
}

func disableUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	tokenId := props["token_id"]

	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	c.LogAudit("")

	// No separate permission for this action for now
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_REVOKE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, accessToken.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if err = c.App.DisableUserAccessToken(accessToken); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	ReturnStatusOK(w)
}

func enableUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	tokenId := props["token_id"]
	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	c.LogAudit("")

	// No separate permission for this action for now
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_CREATE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_CREATE_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.App.Session, accessToken.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if err = c.App.EnableUserAccessToken(accessToken); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	ReturnStatusOK(w)
}

func saveUserTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)

	userId := c.App.Session.UserId
	termsOfServiceId := props["termsOfServiceId"].(string)
	accepted := props["accepted"].(bool)

	if _, err := c.App.GetTermsOfService(termsOfServiceId); err != nil {
		c.Err = err
		return
	}

	if err := c.App.SaveUserTermsOfService(userId, termsOfServiceId, accepted); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("TermsOfServiceId=" + termsOfServiceId + ", accepted=" + strconv.FormatBool(accepted))
	ReturnStatusOK(w)
}

func getUserTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	userId := c.App.Session.UserId
	result, err := c.App.GetUserTermsOfService(userId)
	if err != nil {
		c.Err = err
		return
	}
	w.Write([]byte(result.ToJson()))
}

func promoteGuestToUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.License() == nil {
		c.Err = model.NewAppError("Api4.promoteGuestToUser", "api.team.promote_guest_to_user.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("Api4.promoteGuestToUser", "api.team.promote_guest_to_user.disabled.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_PROMOTE_GUEST) {
		c.SetPermissionError(model.PERMISSION_PROMOTE_GUEST)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !user.IsGuest() {
		c.Err = model.NewAppError("Api4.promoteGuestToUser", "api.user.promote_guest_to_user.no_guest.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if err := c.App.PromoteGuestToUser(user, c.App.Session.UserId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func demoteUserToGuest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.License() == nil {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.team.demote_user_to_guest.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.team.demote_user_to_guest.disabled.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_DEMOTE_TO_GUEST) {
		c.SetPermissionError(model.PERMISSION_DEMOTE_TO_GUEST)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if user.IsGuest() {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.user.demote_user_to_guest.already_guest.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if err := c.App.DemoteUserToGuest(user); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
