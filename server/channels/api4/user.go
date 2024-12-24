// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/blang/semver/v4"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (api *API) InitUser() {
	api.BaseRoutes.Users.Handle("", api.APIHandler(createUser)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("", api.APISessionRequired(getUsers)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/ids", api.APISessionRequired(getUsersByIds)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/usernames", api.APISessionRequired(getUsersByNames)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/known", api.APISessionRequired(getKnownUsers)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchUsers)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/autocomplete", api.APISessionRequired(autocompleteUsers)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/stats", api.APISessionRequired(getTotalUsersStats)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/stats/filtered", api.APISessionRequired(getFilteredUsersStats)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/group_channels", api.APISessionRequired(getUsersByGroupChannelIds)).Methods(http.MethodPost)

	api.BaseRoutes.User.Handle("", api.APISessionRequired(getUser)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/image/default", api.APISessionRequiredTrustRequester(getDefaultProfileImage)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/image", api.APISessionRequiredTrustRequester(getProfileImage)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/image", api.APISessionRequired(setProfileImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/image", api.APISessionRequired(setDefaultProfileImage)).Methods(http.MethodDelete)
	api.BaseRoutes.User.Handle("", api.APISessionRequired(updateUser)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/patch", api.APISessionRequired(patchUser)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("", api.APISessionRequired(deleteUser)).Methods(http.MethodDelete)
	api.BaseRoutes.User.Handle("/roles", api.APISessionRequired(updateUserRoles)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/active", api.APISessionRequired(updateUserActive)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/password", api.APISessionRequired(updatePassword)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/promote", api.APISessionRequired(promoteGuestToUser)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/demote", api.APISessionRequired(demoteUserToGuest)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/convert_to_bot", api.APISessionRequired(convertUserToBot)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/password/reset", api.APIHandler(resetPassword)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/password/reset/send", api.APIHandler(sendPasswordReset)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/email/verify", api.APIHandler(verifyUserEmail)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/email/verify/send", api.APIHandler(sendVerificationEmail)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/email/verify/member", api.APISessionRequired(verifyUserEmailWithoutToken)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/terms_of_service", api.APISessionRequired(saveUserTermsOfService)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/terms_of_service", api.APISessionRequired(getUserTermsOfService)).Methods(http.MethodGet)

	api.BaseRoutes.User.Handle("/auth", api.APISessionRequiredTrustRequester(updateUserAuth)).Methods(http.MethodPut)

	api.BaseRoutes.User.Handle("/mfa", api.APISessionRequiredMfa(updateUserMfa)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/mfa/generate", api.APISessionRequiredMfa(generateMfaSecret)).Methods(http.MethodPost)

	api.BaseRoutes.Users.Handle("/login", api.APIHandler(login)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/login/desktop_token", api.RateLimitedHandler(api.APIHandler(loginWithDesktopToken), model.RateLimitSettings{PerSec: model.NewPointer(2), MaxBurst: model.NewPointer(1)})).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/login/switch", api.APIHandler(switchAccountType)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/login/cws", api.APIHandlerTrustRequester(loginCWS)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/logout", api.APIHandler(logout)).Methods(http.MethodPost)

	api.BaseRoutes.UserByUsername.Handle("", api.APISessionRequired(getUserByUsername)).Methods(http.MethodGet)
	api.BaseRoutes.UserByEmail.Handle("", api.APISessionRequired(getUserByEmail)).Methods(http.MethodGet)

	api.BaseRoutes.User.Handle("/sessions", api.APISessionRequired(getSessions)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/sessions/revoke", api.APISessionRequired(revokeSession)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/sessions/revoke/all", api.APISessionRequired(revokeAllSessionsForUser)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/sessions/revoke/all", api.APISessionRequired(revokeAllSessionsAllUsers)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/sessions/device", api.APISessionRequired(handleDeviceProps)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/audits", api.APISessionRequired(getUserAudits)).Methods(http.MethodGet)

	api.BaseRoutes.User.Handle("/tokens", api.APISessionRequired(createUserAccessToken)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/tokens", api.APISessionRequired(getUserAccessTokensForUser)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/tokens", api.APISessionRequired(getUserAccessTokens)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/tokens/search", api.APISessionRequired(searchUserAccessTokens)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/tokens/{token_id:[A-Za-z0-9]+}", api.APISessionRequired(getUserAccessToken)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/tokens/revoke", api.APISessionRequired(revokeUserAccessToken)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/tokens/disable", api.APISessionRequired(disableUserAccessToken)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/tokens/enable", api.APISessionRequired(enableUserAccessToken)).Methods(http.MethodPost)

	api.BaseRoutes.User.Handle("/typing", api.APISessionRequiredDisableWhenBusy(publishUserTyping)).Methods(http.MethodPost)

	api.BaseRoutes.Users.Handle("/migrate_auth/ldap", api.APISessionRequired(migrateAuthToLDAP)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/migrate_auth/saml", api.APISessionRequired(migrateAuthToSaml)).Methods(http.MethodPost)

	api.BaseRoutes.User.Handle("/uploads", api.APISessionRequired(getUploadsForUser)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/channel_members", api.APISessionRequired(getChannelMembersForUser)).Methods(http.MethodGet)

	api.BaseRoutes.Users.Handle("/invalid_emails", api.APISessionRequired(getUsersWithInvalidEmails)).Methods(http.MethodGet)

	api.BaseRoutes.UserThreads.Handle("", api.APISessionRequired(getThreadsForUser)).Methods(http.MethodGet)
	api.BaseRoutes.UserThreads.Handle("/read", api.APISessionRequired(updateReadStateAllThreadsByUser)).Methods(http.MethodPut)

	api.BaseRoutes.UserThread.Handle("", api.APISessionRequired(getThreadForUser)).Methods(http.MethodGet)
	api.BaseRoutes.UserThread.Handle("/following", api.APISessionRequired(followThreadByUser)).Methods(http.MethodPut)
	api.BaseRoutes.UserThread.Handle("/following", api.APISessionRequired(unfollowThreadByUser)).Methods(http.MethodDelete)
	api.BaseRoutes.UserThread.Handle("/read/{timestamp:[0-9]+}", api.APISessionRequired(updateReadStateThreadByUser)).Methods(http.MethodPut)
	api.BaseRoutes.UserThread.Handle("/set_unread/{post_id:[A-Za-z0-9]+}", api.APISessionRequired(setUnreadThreadByPostId)).Methods(http.MethodPost)

	api.BaseRoutes.Users.Handle("/notify-admin", api.APISessionRequired(handleNotifyAdmin)).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/trigger-notify-admin-posts", api.APISessionRequired(handleTriggerNotifyAdminPosts)).Methods(http.MethodPost)
}

func createUser(c *Context, w http.ResponseWriter, r *http.Request) {
	var user model.User
	if jsonErr := json.NewDecoder(r.Body).Decode(&user); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	user.SanitizeInput(c.IsSystemAdmin())

	tokenId := r.URL.Query().Get("t")
	inviteId := r.URL.Query().Get("iid")
	redirect := r.URL.Query().Get("r")

	auditRec := c.MakeAuditRecord("createUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "invite_id", inviteId)
	audit.AddEventParameter(auditRec, "redirect", redirect)
	audit.AddEventParameterAuditable(auditRec, "user", &user)

	// No permission check required

	var ruser *model.User
	var err *model.AppError
	if tokenId != "" {
		token, appErr := c.App.GetTokenById(tokenId)
		if appErr != nil {
			c.Err = appErr
			return
		}
		auditRec.AddMeta("token_type", token.Type)

		if token.Type == app.TokenTypeGuestInvitation {
			if c.App.Channels().License() == nil {
				c.Err = model.NewAppError("CreateUserWithToken", "api.user.create_user.guest_accounts.license.app_error", nil, "", http.StatusBadRequest)
				return
			}
			if !*c.App.Config().GuestAccountsSettings.Enable {
				c.Err = model.NewAppError("CreateUserWithToken", "api.user.create_user.guest_accounts.disabled.app_error", nil, "", http.StatusBadRequest)
				return
			}
		}
		ruser, err = c.App.CreateUserWithToken(c.AppContext, &user, token)
	} else if inviteId != "" {
		ruser, err = c.App.CreateUserWithInviteId(c.AppContext, &user, inviteId, redirect)
	} else if c.IsSystemAdmin() {
		ruser, err = c.App.CreateUserAsAdmin(c.AppContext, &user, redirect)
		auditRec.AddMeta("admin", true)
	} else {
		ruser, err = c.App.CreateUserFromSignup(c.AppContext, &user, redirect)
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(ruser)
	auditRec.AddEventObjectType("user")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(ruser); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, c.Params.UserId)
	if err != nil {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if c.IsSystemAdmin() || c.AppContext.Session().UserId == user.Id {
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

	if c.AppContext.Session().UserId == user.Id {
		user.Sanitize(map[string]bool{})
	} else {
		c.App.SanitizeProfile(user, c.IsSystemAdmin())
	}
	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserByUsername(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUsername()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUserByUsername(c.Params.Username)
	if err != nil {
		restrictions, err2 := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
		if err2 != nil {
			c.Err = err2
			return
		}
		if restrictions != nil {
			c.SetPermissionError(model.PermissionViewMembers)
			return
		}
		c.Err = err
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	if c.IsSystemAdmin() || c.AppContext.Session().UserId == user.Id {
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

	if c.AppContext.Session().UserId == user.Id {
		user.Sanitize(map[string]bool{})
	} else {
		c.App.SanitizeProfile(user, c.IsSystemAdmin())
	}
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserByEmail(c *Context, w http.ResponseWriter, r *http.Request) {
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
		restrictions, err2 := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
		if err2 != nil {
			c.Err = err2
			return
		}
		if restrictions != nil {
			c.SetPermissionError(model.PermissionViewMembers)
			return
		}
		c.Err = err
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
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

func getDefaultProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
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

	w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", model.DayInSeconds)) // 24 hrs
	w.Header().Set("Content-Type", "image/png")
	if _, err := w.Write(img); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
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
		w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", 5*60)) // 5 mins
	} else {
		w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", model.DayInSeconds)) // 24 hrs
		w.Header().Set(model.HeaderEtagServer, etag)
	}

	w.Header().Set("Content-Type", "image/png")
	if _, err := w.Write(img); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer func() {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			c.Logger.Warn("Error discarding request body", mlog.Err(err))
		}
	}()

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if *c.App.Config().FileSettings.DriverName == "" {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	auditRec := c.MakeAuditRecord("setProfileImage", audit.Fail)
	defer c.LogAuditRec(auditRec)
	if imageArray[0] != nil {
		audit.AddEventParameter(auditRec, "filename", imageArray[0].Filename)
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.SetInvalidURLParam("user_id")
		return
	}
	auditRec.AddEventResultState(user)

	if (user.IsLDAPUser() || (user.IsSAMLUser() && *c.App.Config().SamlSettings.EnableSyncWithLdap)) &&
		*c.App.Config().LdapSettings.PictureAttribute != "" {
		c.Err = model.NewAppError(
			"uploadProfileImage", "api.user.upload_profile_user.login_provider_attribute_set.app_error",
			nil, "", http.StatusConflict)
		return
	}

	imageData := imageArray[0]
	if err := c.App.SetProfileImage(c.AppContext, c.Params.UserId, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func setDefaultProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if *c.App.Config().FileSettings.DriverName == "" {
		c.Err = model.NewAppError("setDefaultProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("setDefaultProfileImage", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}
	audit.AddEventParameterAuditable(auditRec, "user", user)

	if err := c.App.SetDefaultProfileImage(c.AppContext, user); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func getTotalUsersStats(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	stats, err := c.App.GetTotalUsersStats(restrictions)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(stats); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getFilteredUsersStats(c *Context, w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("in_team")
	channelID := r.URL.Query().Get("in_channel")
	includeDeleted := r.URL.Query().Get("include_deleted")
	includeBotAccounts := r.URL.Query().Get("include_bots")
	includeRemoteUsers := r.URL.Query().Get("include_remote_users")
	rolesString := r.URL.Query().Get("roles")
	channelRolesString := r.URL.Query().Get("channel_roles")
	teamRolesString := r.URL.Query().Get("team_roles")

	includeDeletedBool, _ := strconv.ParseBool(includeDeleted)
	includeBotAccountsBool, _ := strconv.ParseBool(includeBotAccounts)
	includeRemoteUsersBool, _ := strconv.ParseBool(includeRemoteUsers)

	roles := []string{}
	var rolesValid bool
	if rolesString != "" {
		roles, rolesValid = model.CleanRoleNames(strings.Split(rolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("roles")
			return
		}
	}
	channelRoles := []string{}
	if channelRolesString != "" && channelID != "" {
		channelRoles, rolesValid = model.CleanRoleNames(strings.Split(channelRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("channelRoles")
			return
		}
	}
	teamRoles := []string{}
	if teamRolesString != "" && teamID != "" {
		teamRoles, rolesValid = model.CleanRoleNames(strings.Split(teamRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("teamRoles")
			return
		}
	}

	options := &model.UserCountOptions{
		IncludeDeleted:     includeDeletedBool,
		IncludeBotAccounts: includeBotAccountsBool,
		IncludeRemoteUsers: includeRemoteUsersBool,
		TeamId:             teamID,
		ChannelId:          channelID,
		Roles:              roles,
		ChannelRoles:       channelRoles,
		TeamRoles:          teamRoles,
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	stats, err := c.App.GetFilteredUsersStats(options)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(stats); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUsersByGroupChannelIds(c *Context, w http.ResponseWriter, r *http.Request) {
	channelIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil || len(channelIds) == 0 {
		c.Err = model.NewAppError("getUsersByGroupChannelIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(channelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	usersByChannelId, appErr := c.App.GetUsersByGroupChannelIds(c.AppContext, channelIds, c.IsSystemAdmin())
	if appErr != nil {
		c.Err = appErr
		return
	}

	err = json.NewEncoder(w).Encode(usersByChannelId)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func getUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	var (
		query              = r.URL.Query()
		inTeamId           = query.Get("in_team")
		notInTeamId        = query.Get("not_in_team")
		inChannelId        = query.Get("in_channel")
		inGroupId          = query.Get("in_group")
		notInGroupId       = query.Get("not_in_group")
		notInChannelId     = query.Get("not_in_channel")
		groupConstrained   = query.Get("group_constrained")
		withoutTeam        = query.Get("without_team")
		inactive           = query.Get("inactive")
		active             = query.Get("active")
		role               = query.Get("role")
		sort               = query.Get("sort")
		rolesString        = query.Get("roles")
		channelRolesString = query.Get("channel_roles")
		teamRolesString    = query.Get("team_roles")
	)

	if notInChannelId != "" && inTeamId == "" {
		c.SetInvalidURLParam("team_id")
		return
	}

	if sort != "" && sort != "last_activity_at" && sort != "create_at" && sort != "status" && sort != "admin" && sort != "display_name" {
		c.SetInvalidURLParam("sort")
		return
	}

	// Currently only supports sorting on a team
	// or sort="status" on inChannelId
	// or sort="display_name" on inGroupId
	if (sort == "last_activity_at" || sort == "create_at") && (inTeamId == "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "" || inGroupId != "" || notInGroupId != "") {
		c.SetInvalidURLParam("sort")
		return
	}
	if sort == "status" && inChannelId == "" {
		c.SetInvalidURLParam("sort")
		return
	}
	if sort == "admin" && inChannelId == "" {
		c.SetInvalidURLParam("sort")
		return
	}
	if sort == "display_name" && (inGroupId == "" || notInGroupId != "" || inTeamId != "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "") {
		c.SetInvalidURLParam("sort")
		return
	}

	var (
		withoutTeamBool, _      = strconv.ParseBool(withoutTeam)
		groupConstrainedBool, _ = strconv.ParseBool(groupConstrained)
		inactiveBool, _         = strconv.ParseBool(inactive)
		activeBool, _           = strconv.ParseBool(active)
	)

	if inactiveBool && activeBool {
		c.SetInvalidURLParam("inactive")
	}

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
	roles := []string{}
	var rolesValid bool
	if role != "" {
		roles, rolesValid = model.CleanRoleNames([]string{role})
		if !rolesValid {
			c.SetInvalidParam("role")
			return
		}
		roleValid := slices.Contains(roleNamesAll, role)
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
	channelRoles := []string{}
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
	teamRoles := []string{}
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

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	userGetOptions := &model.UserGetOptions{
		InTeamId:         inTeamId,
		InChannelId:      inChannelId,
		NotInTeamId:      notInTeamId,
		NotInChannelId:   notInChannelId,
		InGroupId:        inGroupId,
		NotInGroupId:     notInGroupId,
		GroupConstrained: groupConstrainedBool,
		WithoutTeam:      withoutTeamBool,
		Inactive:         inactiveBool,
		Active:           activeBool,
		Role:             role,
		Roles:            roles,
		ChannelRoles:     channelRoles,
		TeamRoles:        teamRoles,
		Sort:             sort,
		Page:             c.Params.Page,
		PerPage:          c.Params.PerPage,
		ViewRestrictions: restrictions,
	}

	var (
		profiles []*model.User
		etag     string
	)

	if inChannelId != "" {
		if !*c.App.Config().TeamSettings.ExperimentalViewArchivedChannels {
			channel, cErr := c.App.GetChannel(c.AppContext, inChannelId)
			if cErr != nil {
				c.Err = cErr
				return
			}
			if channel.DeleteAt != 0 {
				c.Err = model.NewAppError("Api4.getUsersInChannel", "api.user.view_archived_channels.get_users_in_channel.app_error", nil, "", http.StatusForbidden)
				return
			}
		}
	}

	if withoutTeamBool, _ := strconv.ParseBool(withoutTeam); withoutTeamBool {
		// Use a special permission for now
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListUsersWithoutTeam) {
			c.SetPermissionError(model.PermissionListUsersWithoutTeam)
			return
		}

		profiles, appErr = c.App.GetUsersWithoutTeamPage(userGetOptions, c.IsSystemAdmin())
	} else if notInChannelId != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), notInChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}

		profiles, appErr = c.App.GetUsersNotInChannelPage(inTeamId, notInChannelId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
	} else if notInTeamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), notInTeamId, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return
		}

		etag = c.App.GetUsersNotInTeamEtag(inTeamId, restrictions.Hash())
		if c.HandleEtag(etag, "Get Users Not in Team", w, r) {
			return
		}

		profiles, appErr = c.App.GetUsersNotInTeamPage(notInTeamId, groupConstrainedBool, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
	} else if inTeamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), inTeamId, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return
		}

		if sort == "last_activity_at" {
			profiles, appErr = c.App.GetRecentlyActiveUsersForTeamPage(c.AppContext, inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
		} else if sort == "create_at" {
			profiles, appErr = c.App.GetNewUsersForTeamPage(c.AppContext, inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin(), restrictions)
		} else {
			etag = c.App.GetUsersInTeamEtag(inTeamId, restrictions.Hash())
			if c.HandleEtag(etag, "Get Users in Team", w, r) {
				return
			}
			profiles, appErr = c.App.GetUsersInTeamPage(userGetOptions, c.IsSystemAdmin())
		}
	} else if inChannelId != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), inChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}

		if sort == "status" {
			profiles, appErr = c.App.GetUsersInChannelPageByStatus(userGetOptions, c.IsSystemAdmin())
		} else if sort == "admin" {
			profiles, appErr = c.App.GetUsersInChannelPageByAdmin(userGetOptions, c.IsSystemAdmin())
		} else {
			profiles, appErr = c.App.GetUsersInChannelPage(userGetOptions, c.IsSystemAdmin())
		}
	} else if inGroupId != "" {
		if gErr := hasPermissionToReadGroupMembers(c, inGroupId); gErr != nil {
			gErr.Where = "Api.getUsers"
			c.Err = gErr
			return
		}

		if sort == "display_name" {
			var user *model.User

			user, appErr = c.App.GetUser(c.AppContext.Session().UserId)
			if appErr != nil {
				c.Err = appErr
				return
			}

			profiles, _, appErr = c.App.GetGroupMemberUsersSortedPage(inGroupId, c.Params.Page, c.Params.PerPage, userGetOptions.ViewRestrictions, c.App.GetNotificationNameFormat(user))
		} else {
			profiles, _, appErr = c.App.GetGroupMemberUsersPage(inGroupId, c.Params.Page, c.Params.PerPage, userGetOptions.ViewRestrictions)
		}
	} else if notInGroupId != "" {
		appErr = hasPermissionToReadGroupMembers(c, notInGroupId)
		if appErr != nil {
			appErr.Where = "Api.getUsers"
			c.Err = appErr
			return
		}

		profiles, appErr = c.App.GetUsersNotInGroupPage(notInGroupId, c.Params.Page, c.Params.PerPage, userGetOptions.ViewRestrictions)
		if appErr != nil {
			c.Err = appErr
			return
		}
	} else {
		userGetOptions, appErr = c.App.RestrictUsersGetByPermissions(c.AppContext, c.AppContext.Session().UserId, userGetOptions)
		if appErr != nil {
			c.Err = appErr
			return
		}
		profiles, appErr = c.App.GetUsersPage(userGetOptions, c.IsSystemAdmin())
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}
	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())

	js, err := json.Marshal(profiles)
	if err != nil {
		c.Err = model.NewAppError("getUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUsersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getUsersByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(userIDs) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	sinceString := r.URL.Query().Get("since")

	options := &store.UserGetByIdsOpts{
		IsAdmin: c.IsSystemAdmin(),
	}

	if sinceString != "" {
		since, sErr := strconv.ParseInt(sinceString, 10, 64)
		if sErr != nil {
			c.SetInvalidParamWithErr("since", sErr)
			return
		}
		options.Since = since
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	options.ViewRestrictions = restrictions

	users, appErr := c.App.GetUsersByIds(userIDs, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(users)
	if err != nil {
		c.Err = model.NewAppError("getUsersByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUsersByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	usernames, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getUsersByNames", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(usernames) == 0 {
		c.SetInvalidParam("usernames")
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	users, appErr := c.App.GetUsersByUsernames(usernames, c.IsSystemAdmin(), restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(users)
	if err != nil {
		c.Err = model.NewAppError("getUsersByNames", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getKnownUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	userIDs, appErr := c.App.GetKnownUsers(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	err := json.NewEncoder(w).Encode(userIDs)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func searchUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	var props model.UserSearch
	if err := json.NewDecoder(r.Body).Decode(&props); err != nil {
		c.SetInvalidParamWithErr("props", err)
		return
	}

	if props.Limit == 0 {
		props.Limit = model.UserSearchDefaultLimit
	}

	if props.Term == "" {
		c.SetInvalidParam("term")
		return
	}

	if props.TeamId == "" && props.NotInChannelId != "" {
		c.SetInvalidParam("team_id")
		return
	}

	if props.InGroupId != "" {
		if appErr := hasPermissionToReadGroupMembers(c, props.InGroupId); appErr != nil {
			appErr.Where = "Api.searchUsers"
			c.Err = appErr
			return
		}
	}

	if props.NotInGroupId != "" {
		if appErr := hasPermissionToReadGroupMembers(c, props.NotInGroupId); appErr != nil {
			appErr.Where = "Api.searchUsers"
			c.Err = appErr
			return
		}
	}

	if props.InChannelId != "" && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), props.InChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if props.NotInChannelId != "" && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), props.NotInChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if props.TeamId != "" && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), props.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	if props.NotInTeamId != "" && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), props.NotInTeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	if props.Limit <= 0 || props.Limit > model.UserSearchMaxLimit {
		c.SetInvalidParam("limit")
		return
	}

	options := &model.UserSearchOptions{
		IsAdmin:          c.IsSystemAdmin(),
		AllowInactive:    props.AllowInactive,
		GroupConstrained: props.GroupConstrained,
		Limit:            props.Limit,
		Role:             props.Role,
		Roles:            props.Roles,
		ChannelRoles:     props.ChannelRoles,
		TeamRoles:        props.TeamRoles,
	}

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		options.AllowEmails = true
		options.AllowFullNames = true
	} else {
		options.AllowEmails = *c.App.Config().PrivacySettings.ShowEmailAddress
		options.AllowFullNames = *c.App.Config().PrivacySettings.ShowFullName
	}

	options, appErr := c.App.RestrictUsersSearchByPermissions(c.AppContext, c.AppContext.Session().UserId, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	profiles, appErr := c.App.SearchUsers(c.AppContext, &props, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(profiles)
	if err != nil {
		c.Err = model.NewAppError("searchUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func autocompleteUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("in_channel")
	teamId := r.URL.Query().Get("in_team")
	name := r.URL.Query().Get("name")
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limitStr == "" {
		limit = model.UserSearchDefaultLimit
	} else if limit > model.UserSearchMaxLimit {
		limit = model.UserSearchMaxLimit
	}

	options := &model.UserSearchOptions{
		IsAdmin: c.IsSystemAdmin(),
		// Never autocomplete on emails.
		AllowEmails: false,
		Limit:       limit,
	}

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		options.AllowFullNames = true
	} else {
		options.AllowFullNames = *c.App.Config().PrivacySettings.ShowFullName
	}

	if channelId != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}

	if teamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return
		}
	}

	var autocomplete model.UserAutocomplete

	var err *model.AppError
	options, err = c.App.RestrictUsersSearchByPermissions(c.AppContext, c.AppContext.Session().UserId, options)
	if err != nil {
		c.Err = err
		return
	}

	if channelId != "" {
		// We're using the channelId to search for users inside that channel and the team
		// to get the not in channel list. Also we want to include the DM and GM users for
		// that team which could only be obtained having the team id.
		if teamId == "" {
			c.Err = model.NewAppError("autocompleteUser",
				"api.user.autocomplete_users.missing_team_id.app_error",
				nil,
				"channelId="+channelId,
				http.StatusInternalServerError,
			)
			return
		}
		result, err := c.App.AutocompleteUsersInChannel(c.AppContext, teamId, channelId, name, options)
		if err != nil {
			c.Err = err
			return
		}

		autocomplete.Users = result.InChannel
		autocomplete.OutOfChannel = result.OutOfChannel
	} else if teamId != "" {
		result, err := c.App.AutocompleteUsersInTeam(c.AppContext, teamId, name, options)
		if err != nil {
			c.Err = err
			return
		}

		autocomplete.Users = result.InTeam
	} else {
		result, err := c.App.SearchUsersInTeam(c.AppContext, "", name, options)
		if err != nil {
			c.Err = err
			return
		}
		autocomplete.Users = result
	}

	if err := json.NewEncoder(w).Encode(autocomplete); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var user model.User
	if jsonErr := json.NewDecoder(r.Body).Decode(&user); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "user", &user)
	// The user being updated in the payload must be the same one as indicated in the URL.
	if user.Id != c.Params.UserId {
		c.SetInvalidParam("user_id")
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), user.Id) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	ouser, err := c.App.GetUser(user.Id)
	if err != nil {
		c.Err = err
		return
	}

	// Cannot update a system admin unless user making request is a systemadmin also.
	if ouser.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	auditRec.AddEventPriorState(ouser)
	auditRec.AddEventObjectType("user")

	if c.AppContext.Session().IsOAuth {
		if ouser.Email != user.Email {
			c.SetPermissionError(model.PermissionEditOtherUsers)
			c.Err.DetailedError += ", attempted email update by oauth app"
			return
		}
	}

	// Check that the fields being updated are not set by the login provider
	conflictField := c.App.CheckProviderAttributes(c.AppContext, ouser, user.ToPatch())
	if conflictField != "" {
		c.Err = model.NewAppError(
			"updateUser", "api.user.update_user.login_provider_attribute_set.app_error",
			map[string]any{"Field": conflictField}, "", http.StatusConflict)
		return
	}

	// If eMail update is attempted by the currently logged in user, check if correct password was provided
	if user.Email != "" && ouser.Email != user.Email && c.AppContext.Session().UserId == c.Params.UserId {
		err = c.App.DoubleCheckPassword(c.AppContext, ouser, user.Password)
		if err != nil {
			c.SetInvalidParam("password")
			return
		}
	}

	ruser, err := c.App.UpdateUserAsUser(c.AppContext, &user, c.IsSystemAdmin())
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(ruser)
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(ruser); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	var patch model.UserPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("patchUser", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "user_patch", &patch)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	ouser, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.SetInvalidParam("user_id")
		return
	}

	auditRec.AddEventPriorState(ouser)
	auditRec.AddEventObjectType("user")

	// Cannot update a system admin unless user making request is a systemadmin also
	if ouser.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if c.AppContext.Session().IsOAuth && patch.Email != nil {
		if ouser.Email != *patch.Email {
			c.SetPermissionError(model.PermissionEditOtherUsers)
			c.Err.DetailedError += ", attempted email update by oauth app"
			return
		}
	}

	conflictField := c.App.CheckProviderAttributes(c.AppContext, ouser, &patch)
	if conflictField != "" {
		c.Err = model.NewAppError(
			"patchUser", "api.user.patch_user.login_provider_attribute_set.app_error",
			map[string]any{"Field": conflictField}, "", http.StatusConflict)
		return
	}

	// If eMail update is attempted by the currently logged in user, check if correct password was provided
	if patch.Email != nil && ouser.Email != *patch.Email && c.AppContext.Session().UserId == c.Params.UserId {
		if patch.Password == nil {
			c.SetInvalidParam("password")
			return
		}

		if err = c.App.DoubleCheckPassword(c.AppContext, ouser, *patch.Password); err != nil {
			c.Err = err
			return
		}
	}

	ruser, err := c.App.PatchUser(c.AppContext, c.Params.UserId, &patch, c.IsSystemAdmin())
	if err != nil {
		c.Err = err
		return
	}

	c.App.SetAutoResponderStatus(c.AppContext, ruser, ouser.NotifyProps)

	auditRec.Success()
	auditRec.AddEventResultState(ruser)
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(ruser); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userId := c.Params.UserId
	permanent := c.Params.Permanent

	auditRec := c.MakeAuditRecord("deleteUser", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", userId)
	audit.AddEventParameter(auditRec, "permanent", permanent)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), userId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	// if EnableUserDeactivation flag is disabled the user cannot deactivate himself.
	if c.Params.UserId == c.AppContext.Session().UserId && !*c.App.Config().TeamSettings.EnableUserDeactivation && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.Err = model.NewAppError("deleteUser", "api.user.update_active.not_enable.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	user, err := c.App.GetUser(userId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(user)
	auditRec.AddEventObjectType("user")

	// Cannot update a system admin unless user making request is a systemadmin also
	if user.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if permanent {
		if *c.App.Config().ServiceSettings.EnableAPIUserDeletion {
			err = c.App.PermanentDeleteUser(c.AppContext, user)
		} else {
			err = model.NewAppError("deleteUser", "api.user.delete_user.not_enabled.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		}
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

func updateUserRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJSON(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("roles")
		return
	}

	// require license feature to assign "new system roles"
	for _, roleName := range strings.Fields(newRoles) {
		for _, id := range model.NewSystemRoleIDs {
			if roleName == id {
				if license := c.App.Channels().License(); license == nil || !*license.Features.CustomPermissionsSchemes {
					c.Err = model.NewAppError("updateUserRoles", "api.user.update_user_roles.license.app_error", nil, "", http.StatusBadRequest)
					return
				}
			}
		}
	}

	auditRec := c.MakeAuditRecord("updateUserRoles", audit.Fail)
	audit.AddEventParameter(auditRec, "roles", newRoles)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageRoles) {
		c.SetPermissionError(model.PermissionManageRoles)
		return
	}

	user, err := c.App.UpdateUserRoles(c.AppContext, c.Params.UserId, newRoles, true)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(user)
	auditRec.AddEventObjectType("user")
	c.LogAudit(fmt.Sprintf("user=%s roles=%s", c.Params.UserId, newRoles))

	ReturnStatusOK(w)
}

func updateUserActive(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)

	active, ok := props["active"].(bool)
	if !ok {
		c.SetInvalidParam("active")
		return
	}

	auditRec := c.MakeAuditRecord("updateUserActive", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "active", active)

	// true when you're trying to de-activate yourself
	isSelfDeactivate := !active && c.Params.UserId == c.AppContext.Session().UserId

	if !isSelfDeactivate && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementUsers) {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.permissions.app_error", nil, "userId="+c.Params.UserId, http.StatusForbidden)
		return
	}

	// if EnableUserDeactivation flag is disabled the user cannot deactivate himself.
	if isSelfDeactivate && !*c.App.Config().TeamSettings.EnableUserDeactivation {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.not_enable.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(user)
	auditRec.AddEventObjectType("user")

	if user.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if active && user.IsGuest() && !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.cannot_enable_guest_when_guest_feature_is_disabled.app_error", nil, "userId="+c.Params.UserId, http.StatusUnauthorized)
		return
	}

	if user.AuthService == model.UserAuthServiceLdap {
		c.Err = model.NewAppError("updateUserActive", "api.user.update_active.cannot_modify_status_when_user_is_managed_by_ldap.app_error", nil, "userId="+c.Params.UserId, http.StatusForbidden)
		return
	}

	if _, err = c.App.UpdateActive(c.AppContext, user, active); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit(fmt.Sprintf("user_id=%s active=%v", user.Id, active))

	if isSelfDeactivate {
		c.App.Srv().Go(func() {
			if err := c.App.Srv().EmailService.SendDeactivateAccountEmail(user.Email, user.Locale, c.App.GetSiteURL()); err != nil {
				c.LogErrorByCode(model.NewAppError("SendDeactivateEmail", "api.user.send_deactivate_email_and_forget.failed.error", nil, "", http.StatusInternalServerError).Wrap(err))
			}
		})
	}

	message := model.NewWebSocketEvent(model.WebsocketEventUserActivationStatusChange, "", "", "", nil, "")
	c.App.Publish(message)

	ReturnStatusOK(w)
}

func updateUserAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateUserAuth", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var userAuth model.UserAuth
	if jsonErr := json.NewDecoder(r.Body).Decode(&userAuth); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "user_auth", &userAuth)

	if userAuth.AuthData == nil || *userAuth.AuthData == "" || userAuth.AuthService == "" {
		c.Err = model.NewAppError("updateUserAuth", "api.user.update_user_auth.invalid_request", nil, "", http.StatusBadRequest)
		return
	}

	if user, err := c.App.GetUser(c.Params.UserId); err == nil {
		auditRec.AddEventPriorState(user)
	}

	user, err := c.App.UpdateUserAuth(c.AppContext, c.Params.UserId, &userAuth)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(user)

	auditRec.Success()
	auditRec.AddMeta("auth_service", user.AuthService)
	c.LogAudit(fmt.Sprintf("updated user %s auth to service=%v", c.Params.UserId, user.AuthService))

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateUserMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateUserMfa", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.AppContext.Session().IsOAuth {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if user, err := c.App.GetUser(c.Params.UserId); err == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	props := model.StringInterfaceFromJSON(r.Body)
	activate, ok := props["activate"].(bool)
	if !ok {
		c.SetInvalidParam("activate")
		return
	}

	code := ""
	if activate {
		code, ok = props["code"].(string)
		if !ok || code == "" {
			c.SetInvalidParam("code")
			return
		}
	}

	c.LogAudit("attempt")

	if err := c.App.UpdateMfa(c.AppContext, activate, c.Params.UserId, code); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("activate", activate)
	c.LogAudit("success - mfa updated")

	ReturnStatusOK(w)
}

func generateMfaSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().IsOAuth {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
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
	if err := json.NewEncoder(w).Encode(secret); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePassword(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJSON(r.Body)
	newPassword := props["new_password"]

	auditRec := c.MakeAuditRecord("updatePassword", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempted")

	var canUpdatePassword bool
	if user, err := c.App.GetUser(c.Params.UserId); err == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)

		if user.IsSystemAdmin() {
			canUpdatePassword = c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
		} else {
			canUpdatePassword = c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementUsers)
		}
	}

	var err *model.AppError

	// There are two main update flows depending on whether the provided password
	// is already hashed or not.
	if props["already_hashed"] == "true" {
		if canUpdatePassword {
			err = c.App.UpdateHashedPasswordByUserId(c.Params.UserId, newPassword)
		} else if c.Params.UserId == c.AppContext.Session().UserId {
			err = model.NewAppError("updatePassword", "api.user.update_password.user_and_hashed.app_error", nil, "", http.StatusUnauthorized)
		} else {
			err = model.NewAppError("updatePassword", "api.user.update_password.context.app_error", nil, "", http.StatusForbidden)
		}
	} else {
		if c.Params.UserId == c.AppContext.Session().UserId {
			currentPassword := props["current_password"]
			if currentPassword == "" {
				c.SetInvalidParam("current_password")
				return
			}

			err = c.App.UpdatePasswordAsUser(c.AppContext, c.Params.UserId, currentPassword, newPassword)
		} else if canUpdatePassword {
			err = c.App.UpdatePasswordByUserIdSendEmail(c.AppContext, c.Params.UserId, newPassword, c.AppContext.T("api.user.reset_password.method"))
		} else {
			err = model.NewAppError("updatePassword", "api.user.update_password.context.app_error", nil, "", http.StatusForbidden)
		}
	}

	if err != nil {
		c.LogAudit("failed")
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("completed")

	ReturnStatusOK(w)
}

func resetPassword(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	token := props["token"]
	if len(token) != model.TokenSize {
		c.SetInvalidParam("token")
		return
	}

	newPassword := props["new_password"]

	auditRec := c.MakeAuditRecord("resetPassword", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt - token=" + token)

	if err := c.App.ResetPasswordFromToken(c.AppContext, token, newPassword); err != nil {
		c.LogAudit("fail - token=" + token)
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success - token=" + token)

	ReturnStatusOK(w)
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	email := props["email"]
	email = strings.ToLower(email)
	if email == "" {
		c.SetInvalidParam("email")
		return
	}

	auditRec := c.MakeAuditRecord("sendPasswordReset", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "email", email)

	sent, err := c.App.SendPasswordReset(c.AppContext, email, c.App.GetSiteURL())
	if err != nil {
		if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode {
			ReturnStatusOK(w)
		} else {
			c.Err = err
		}
		return
	}

	if sent {
		auditRec.Success()
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
			"api.user.login.remote_users.login.error",
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
		gitlabEnabled := *config.GitLabSettings.Enable
		openidEnabled := *config.OpenIdSettings.Enable
		googleEnabled := *config.GoogleSettings.Enable
		office365Enabled := *config.Office365Settings.Enable

		if samlEnabled || gitlabEnabled || googleEnabled || office365Enabled || openidEnabled {
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

	props := model.MapFromJSON(r.Body)
	id := props["id"]
	loginId := props["login_id"]
	password := props["password"]
	mfaToken := props["token"]
	deviceId := props["device_id"]
	ldapOnly := props["ldap_only"] == "true"

	if *c.App.Config().ExperimentalSettings.ClientSideCertEnable {
		if license := c.App.Channels().License(); license == nil || !*license.Features.FutureFeatures {
			c.Err = model.NewAppError("ClientSideCertNotAllowed", "api.user.login.client_side_cert.license.app_error", nil, "", http.StatusBadRequest)
			return
		}
		certPem, certSubject, certEmail := c.App.CheckForClientSideCert(r)
		c.Logger.Debug("Client Cert", mlog.String("cert_subject", certSubject), mlog.String("cert_email", certEmail))

		if certPem == "" || certEmail == "" {
			c.Err = model.NewAppError("ClientSideCertMissing", "api.user.login.client_side_cert.certificate.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if *c.App.Config().ExperimentalSettings.ClientSideCertCheck == model.ClientSideCertCheckPrimaryAuth {
			loginId = certEmail
			password = "certificate"
		}
	}

	auditRec := c.MakeAuditRecord("login", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "login_id", loginId)
	audit.AddEventParameter(auditRec, "device_id", deviceId)

	c.LogAuditWithUserId(id, "attempt - login_id="+loginId)

	user, err := c.App.AuthenticateUserForLogin(c.AppContext, id, loginId, password, mfaToken, "", ldapOnly)
	if err != nil {
		c.LogAuditWithUserId(id, "failure - login_id="+loginId)
		c.Err = err
		return
	}
	auditRec.AddEventResultState(user)

	if user.IsGuest() {
		if c.App.Channels().License() == nil {
			c.Err = model.NewAppError("login", "api.user.login.guest_accounts.license.error", nil, "", http.StatusUnauthorized)
			return
		}
		if !*c.App.Config().GuestAccountsSettings.Enable {
			c.Err = model.NewAppError("login", "api.user.login.guest_accounts.disabled.error", nil, "", http.StatusUnauthorized)
			return
		}
	}

	if user.IsRemote() {
		c.Err = model.NewAppError("login", "api.user.login.remote_users.login.error", nil, "", http.StatusUnauthorized)
		return
	}

	c.LogAuditWithUserId(user.Id, "authenticated")

	isMobileDevice := utils.IsMobileRequest(r)
	session, err := c.App.DoLogin(c.AppContext, w, r, user, deviceId, isMobileDevice, false, false)
	if err != nil {
		c.Err = err
		return
	}
	c.AppContext = c.AppContext.WithSession(session)

	c.LogAuditWithUserId(user.Id, "success")

	if r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML {
		c.App.AttachSessionCookies(c.AppContext, w, r)
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

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func loginWithDesktopToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)
	token := props["token"]
	deviceId := props["device_id"]

	user, err := c.App.ValidateDesktopToken(token, time.Now().Add(-model.DesktopTokenTTL).Unix())
	if err != nil {
		c.Err = err
		return
	}

	isOAuthUser := user.IsOAuthUser()
	isSamlUser := user.IsSAMLUser()

	if !isOAuthUser && !isSamlUser {
		c.Err = model.NewAppError("loginWithDesktopToken", "api.user.login_with_desktop_token.not_oauth_or_saml_user.app_error", nil, "", http.StatusUnauthorized)
		return
	}

	session, err := c.App.DoLogin(c.AppContext, w, r, user, deviceId, false, isOAuthUser, isSamlUser)
	if err != nil {
		c.Err = err
		return
	}
	c.AppContext = c.AppContext.WithSession(session)

	c.App.AttachSessionCookies(c.AppContext, w, r)

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func loginCWS(c *Context, w http.ResponseWriter, r *http.Request) {
	campaignToURL := map[string]string{
		"focalboard": "/boards",
	}

	if !c.App.Channels().License().IsCloud() {
		c.Err = model.NewAppError("loginCWS", "api.user.login_cws.license.error", nil, "", http.StatusUnauthorized)
		return
	}
	if err := r.ParseForm(); err != nil {
		c.Logger.Warn("Failed to parse form data", mlog.Err(err))
	}
	var loginID string
	var token string
	var campaign string
	if len(r.Form) > 0 {
		for key, value := range r.Form {
			if key == "login_id" {
				loginID = value[0]
			}
			if key == "cws_token" {
				token = value[0]
			}
			if key == "utm_campaign" {
				campaign = value[0]
			}
		}
	}

	auditRec := c.MakeAuditRecord("login", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "login_id", loginID)
	user, err := c.App.AuthenticateUserForLogin(c.AppContext, "", loginID, "", "", token, false)
	if err != nil {
		c.LogAuditWithUserId("", "failure - login_id="+loginID)
		c.LogErrorByCode(err)
		http.Redirect(w, r, *c.App.Config().ServiceSettings.SiteURL, http.StatusFound)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "user", user)
	c.LogAuditWithUserId(user.Id, "authenticated")
	isMobileDevice := utils.IsMobileRequest(r)
	session, err := c.App.DoLogin(c.AppContext, w, r, user, "", isMobileDevice, false, false)
	if err != nil {
		c.LogErrorByCode(err)
		http.Redirect(w, r, *c.App.Config().ServiceSettings.SiteURL, http.StatusFound)
		return
	}
	c.AppContext = c.AppContext.WithSession(session)
	c.LogAuditWithUserId(user.Id, "success")
	c.App.AttachSessionCookies(c.AppContext, w, r)

	redirectURL := *c.App.Config().ServiceSettings.SiteURL
	if campaign != "" {
		if url, ok := campaignToURL[campaign]; ok {
			properties := map[string]any{
				"category":    "acquisition",
				"redirect_to": strings.TrimSuffix(url, "/"),
			}
			c.App.Srv().GetTelemetryService().SendTelemetry("product_start_redirect", properties)
			redirectURL += url
		}
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func logout(c *Context, w http.ResponseWriter, r *http.Request) {
	Logout(c, w, r)
}

func Logout(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("Logout", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("")

	c.RemoveSessionCookie(w, r)
	if c.AppContext.Session().Id != "" {
		if err := c.App.RevokeSessionById(c.AppContext, c.AppContext.Session().Id); err != nil {
			c.Err = err
			return
		}
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getSessions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	sessions, appErr := c.App.GetSessions(c.AppContext, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, session := range sessions {
		session.Sanitize()
	}

	js, err := json.Marshal(sessions)
	if err != nil {
		c.Err = model.NewAppError("getSessions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func revokeSession(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("revokeSession", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	props := model.MapFromJSON(r.Body)
	sessionId := props["session_id"]
	if sessionId == "" {
		c.SetInvalidParam("session_id")
		return
	}
	audit.AddEventParameter(auditRec, "session_id", sessionId)

	session, err := c.App.GetSessionById(c.AppContext, sessionId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(session)
	auditRec.AddEventObjectType("session")

	if session.UserId != c.Params.UserId {
		c.SetInvalidURLParam("user_id")
		return
	}

	if err := c.App.RevokeSession(c.AppContext, session); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func revokeAllSessionsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("revokeAllSessionsForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := c.App.RevokeAllSessions(c.AppContext, c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func revokeAllSessionsAllUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	auditRec := c.MakeAuditRecord("revokeAllSessionsAllUsers", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RevokeSessionsFromAllUsers(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func handleDeviceProps(c *Context, w http.ResponseWriter, r *http.Request) {
	receivedProps := model.MapFromJSON(r.Body)
	deviceId := receivedProps["device_id"]

	newProps := map[string]string{}

	deviceNotificationsDisabled := receivedProps[model.SessionPropDeviceNotificationDisabled]
	if deviceNotificationsDisabled != "" {
		if deviceNotificationsDisabled != "false" && deviceNotificationsDisabled != "true" {
			c.SetInvalidParam(model.SessionPropDeviceNotificationDisabled)
			return
		}

		newProps[model.SessionPropDeviceNotificationDisabled] = deviceNotificationsDisabled
	}

	mobileVersion := receivedProps[model.SessionPropMobileVersion]
	if mobileVersion != "" {
		if _, err := semver.Parse(mobileVersion); err != nil {
			c.SetInvalidParam(model.SessionPropMobileVersion)
			return
		}
		newProps[model.SessionPropMobileVersion] = mobileVersion
	}

	if deviceId != "" {
		attachDeviceId(c, w, r, deviceId)
	}

	if c.Err != nil {
		return
	}

	if err := c.App.SetExtraSessionProps(c.AppContext.Session(), newProps); err != nil {
		c.Err = err
		return
	}

	c.App.ClearSessionCacheForUser(c.AppContext.Session().UserId)
	ReturnStatusOK(w)
}

func attachDeviceId(c *Context, w http.ResponseWriter, r *http.Request, deviceId string) {
	auditRec := c.MakeAuditRecord("attachDeviceId", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "device_id", deviceId)

	// A special case where we logout of all other sessions with the same device id
	if err := c.App.RevokeSessionsForDeviceId(c.AppContext, c.AppContext.Session().UserId, deviceId, c.AppContext.Session().Id); err != nil {
		c.Err = err
		return
	}

	c.App.ClearSessionCacheForUser(c.AppContext.Session().UserId)
	c.App.SetSessionExpireInHours(c.AppContext.Session(), *c.App.Config().ServiceSettings.SessionLengthMobileInHours)

	maxAgeSeconds := *c.App.Config().ServiceSettings.SessionLengthMobileInHours * 60 * 60

	secure := false
	if app.GetProtocol(r) == "https" {
		secure = true
	}

	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAgeSeconds), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SessionCookieToken,
		Value:    c.AppContext.Session().Token,
		Path:     subpath,
		MaxAge:   maxAgeSeconds,
		Expires:  expiresAt,
		HttpOnly: true,
		Domain:   c.App.GetCookieDomain(),
		Secure:   secure,
	}

	if secure && utils.CheckEmbeddedCookie(r) {
		sessionCookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(w, sessionCookie)

	if err := c.App.AttachDeviceId(c.AppContext.Session().Id, deviceId, c.AppContext.Session().ExpiresAt); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")
}

func getUserAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("getUserAudits", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)

	if user, err := c.App.GetUser(c.Params.UserId); err == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	audits, err := c.App.GetAuditsPage(c.AppContext, c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("page", c.Params.Page)
	auditRec.AddMeta("audits_per_page", c.Params.LogsPerPage)

	if err := json.NewEncoder(w).Encode(audits); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func verifyUserEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	token := props["token"]
	if len(token) != model.TokenSize {
		c.SetInvalidParam("token")
		return
	}

	auditRec := c.MakeAuditRecord("verifyUserEmail", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.VerifyEmailFromToken(c.AppContext, token); err != nil {
		c.Err = model.NewAppError("verifyUserEmail", "api.user.verify_email.bad_link.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec.Success()
	c.LogAudit("Email Verified")

	ReturnStatusOK(w)
}

func sendVerificationEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	email := props["email"]
	email = strings.ToLower(email)
	if email == "" {
		c.SetInvalidParam("email")
		return
	}
	redirect := r.URL.Query().Get("r")

	auditRec := c.MakeAuditRecord("sendVerificationEmail", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "email", email)
	audit.AddEventParameter(auditRec, "redirect", redirect)

	user, err := c.App.GetUserForLogin(c.AppContext, "", email)
	if err != nil {
		// Don't want to leak whether the email is valid or not
		ReturnStatusOK(w)
		return
	}
	auditRec.AddEventResultState(user)

	if err = c.App.SendEmailVerification(user, user.Email, redirect); err != nil {
		// Don't want to leak whether the email is valid or not
		c.LogErrorByCode(err)
		ReturnStatusOK(w)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func switchAccountType(c *Context, w http.ResponseWriter, r *http.Request) {
	var switchRequest model.SwitchRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&switchRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("switch_request", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("switchAccountType", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "switch_request", &switchRequest)

	link := ""
	var err *model.AppError

	if switchRequest.EmailToOAuth() {
		link, err = c.App.SwitchEmailToOAuth(c.AppContext, w, r, switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.NewService)
	} else if switchRequest.OAuthToEmail() {
		c.SessionRequired()
		if c.Err != nil {
			return
		}

		link, err = c.App.SwitchOAuthToEmail(c.AppContext, switchRequest.Email, switchRequest.NewPassword, c.AppContext.Session().UserId)
	} else if switchRequest.EmailToLdap() {
		link, err = c.App.SwitchEmailToLdap(c.AppContext, switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.LdapLoginId, switchRequest.NewPassword)
	} else if switchRequest.LdapToEmail() {
		link, err = c.App.SwitchLdapToEmail(c.AppContext, switchRequest.Password, switchRequest.MfaCode, switchRequest.Email, switchRequest.NewPassword)
	} else {
		c.SetInvalidParam("switch_request")
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if _, err := w.Write([]byte(model.MapToJSON(map[string]string{"follow_link": link}))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("createUserAccessToken", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	audit.AddEventParameterAuditable(auditRec, "user", user)

	if user.IsRemote() {
		// remote/synthetic users cannot have access tokens
		c.SetPermissionError(model.PermissionCreateUserAccessToken)
		return
	}

	if c.AppContext.Session().IsOAuth {
		c.SetPermissionError(model.PermissionCreateUserAccessToken)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	var accessToken model.UserAccessToken
	if jsonErr := json.NewDecoder(r.Body).Decode(&accessToken); jsonErr != nil {
		c.SetInvalidParamWithErr("user_access_token", jsonErr)
		return
	}

	if accessToken.Description == "" {
		c.SetInvalidParam("description")
		return
	}

	c.LogAudit("")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateUserAccessToken) {
		c.SetPermissionError(model.PermissionCreateUserAccessToken)
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if user.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	accessToken.UserId = c.Params.UserId
	accessToken.Token = ""

	token, err := c.App.CreateUserAccessToken(c.AppContext, &accessToken)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("token_id", token.Id)
	c.LogAudit("success - token_id=" + token.Id)

	if err := json.NewEncoder(w).Encode(token); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchUserAccessTokens(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var props model.UserAccessTokenSearch
	if err := json.NewDecoder(r.Body).Decode(&props); err != nil {
		c.SetInvalidParamWithErr("user_access_token_search", err)
		return
	}

	if props.Term == "" {
		c.SetInvalidParam("term")
		return
	}

	accessTokens, appErr := c.App.SearchUserAccessTokens(props.Term)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(accessTokens)
	if err != nil {
		c.Err = model.NewAppError("searchUserAccessTokens", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserAccessTokens(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	accessTokens, appErr := c.App.GetUserAccessTokens(c.Params.Page, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(accessTokens)
	if err != nil {
		c.Err = model.NewAppError("searchUserAccessTokens", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserAccessTokensForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadUserAccessToken) {
		c.SetPermissionError(model.PermissionReadUserAccessToken)
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	accessTokens, appErr := c.App.GetUserAccessTokensForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(accessTokens)
	if err != nil {
		c.Err = model.NewAppError("searchUserAccessTokens", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTokenId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadUserAccessToken) {
		c.SetPermissionError(model.PermissionReadUserAccessToken)
		return
	}

	accessToken, appErr := c.App.GetUserAccessToken(c.Params.TokenId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), accessToken.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := json.NewEncoder(w).Encode(accessToken); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func revokeUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	tokenId := props["token_id"]
	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	auditRec := c.MakeAuditRecord("revokeUserAccessToken", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "token_id", tokenId)
	c.LogAudit("")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRevokeUserAccessToken) {
		c.SetPermissionError(model.PermissionRevokeUserAccessToken)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if user, errGet := c.App.GetUser(accessToken.UserId); errGet == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), accessToken.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err = c.App.RevokeUserAccessToken(c.AppContext, accessToken); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success - token_id=" + accessToken.Id)

	ReturnStatusOK(w)
}

func disableUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)
	tokenId := props["token_id"]

	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	auditRec := c.MakeAuditRecord("disableUserAccessToken", audit.Fail)
	audit.AddEventParameter(auditRec, "token_id", tokenId)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("")

	// No separate permission for this action for now
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRevokeUserAccessToken) {
		c.SetPermissionError(model.PermissionRevokeUserAccessToken)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if user, errGet := c.App.GetUser(accessToken.UserId); errGet == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), accessToken.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err = c.App.DisableUserAccessToken(c.AppContext, accessToken); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success - token_id=" + accessToken.Id)

	ReturnStatusOK(w)
}

func enableUserAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJSON(r.Body)

	tokenId := props["token_id"]
	if tokenId == "" {
		c.SetInvalidParam("token_id")
	}

	auditRec := c.MakeAuditRecord("enableUserAccessToken", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "token_id", tokenId)
	c.LogAudit("")

	// No separate permission for this action for now
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateUserAccessToken) {
		c.SetPermissionError(model.PermissionCreateUserAccessToken)
		return
	}

	accessToken, err := c.App.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if user, errGet := c.App.GetUser(accessToken.UserId); errGet == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	if !c.App.SessionHasPermissionToUserOrBot(c.AppContext, *c.AppContext.Session(), accessToken.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err = c.App.EnableUserAccessToken(c.AppContext, accessToken); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success - token_id=" + accessToken.Id)

	ReturnStatusOK(w)
}

func saveUserTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJSON(r.Body)

	auditRec := c.MakeAuditRecord("saveUserTermsOfService", audit.Fail)
	defer c.LogAuditRec(auditRec)

	userId := c.AppContext.Session().UserId
	termsOfServiceId, ok := props["termsOfServiceId"].(string)
	if !ok {
		c.SetInvalidParam("termsOfServiceId")
		return
	}
	audit.AddEventParameter(auditRec, "terms_of_service_id", termsOfServiceId)
	accepted, ok := props["accepted"].(bool)
	if !ok {
		c.SetInvalidParam("accepted")
		return
	}
	audit.AddEventParameter(auditRec, "accepted", accepted)

	if user, err := c.App.GetUser(userId); err == nil {
		audit.AddEventParameterAuditable(auditRec, "user", user)
	}

	if _, err := c.App.GetTermsOfService(termsOfServiceId); err != nil {
		c.Err = err
		return
	}

	if err := c.App.SaveUserTermsOfService(userId, termsOfServiceId, accepted); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("TermsOfServiceId=" + termsOfServiceId + ", accepted=" + strconv.FormatBool(accepted))

	ReturnStatusOK(w)
}

func getUserTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	userId := c.AppContext.Session().UserId
	result, err := c.App.GetUserTermsOfService(userId)
	if err != nil {
		c.Err = err
		return
	}
	if err := json.NewEncoder(w).Encode(result); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func promoteGuestToUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("promoteGuestToUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionPromoteGuest) {
		c.SetPermissionError(model.PermissionPromoteGuest)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(user)

	if !user.IsGuest() {
		c.Err = model.NewAppError("Api4.promoteGuestToUser", "api.user.promote_guest_to_user.no_guest.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if err := c.App.PromoteGuestToUser(c.AppContext, user, c.AppContext.Session().UserId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func demoteUserToGuest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.team.demote_user_to_guest.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.team.demote_user_to_guest.disabled.error", nil, "", http.StatusNotImplemented)
		return
	}

	guestEnabled := c.App.Channels().License() != nil && *c.App.Channels().License().Features.GuestAccounts

	if !guestEnabled {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.team.invite_guests_to_channels.disabled.error", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord("demoteUserToGuest", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDemoteToGuest) {
		c.SetPermissionError(model.PermissionDemoteToGuest)
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if user.IsSystemAdmin() && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	auditRec.AddEventResultState(user)

	if user.IsGuest() {
		c.Err = model.NewAppError("Api4.demoteUserToGuest", "api.user.demote_user_to_guest.already_guest.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if err := c.App.DemoteUserToGuest(c.AppContext, user); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func publishUserTyping(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	var typingRequest model.TypingRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&typingRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("typing_request", jsonErr)
		return
	}

	if c.Params.UserId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !c.App.HasPermissionToChannel(c.AppContext, c.Params.UserId, typingRequest.ChannelId, model.PermissionCreatePost) {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	if err := c.App.PublishUserTyping(c.Params.UserId, typingRequest.ChannelId, typingRequest.ParentId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func verifyUserEmailWithoutToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("verifyUserEmailWithoutToken", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("user_id", user.Id)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.VerifyUserEmail(user.Id, user.Email); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("user verified")

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func convertUserToBot(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	user, appErr := c.App.GetUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("convertUserToBot", audit.Fail)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "user", user)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	bot, appErr := c.App.ConvertUserToBot(c.AppContext, user)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(user)
	auditRec.AddEventResultState(bot)
	auditRec.AddEventObjectType("bot")

	js, err := json.Marshal(bot)
	if err != nil {
		c.Err = model.NewAppError("convertUserToBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUploadsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Params.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("getUploadsForUser", "api.user.get_uploads_for_user.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	uss, appErr := c.App.GetUploadSessionsForUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(uss)
	if err != nil {
		c.Err = model.NewAppError("getUploadsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	members, err := c.App.GetChannelMembersWithTeamDataForUserWithPagination(c.AppContext, c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(members); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func migrateAuthToLDAP(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJSON(r.Body)
	from, ok := props["from"].(string)
	if !ok {
		c.SetInvalidParam("from")
		return
	}
	if from == "" || (from != "email" && from != "gitlab" && from != "saml" && from != "google" && from != "office365") {
		c.SetInvalidParam("from")
		return
	}

	force, ok := props["force"].(bool)
	if !ok {
		c.SetInvalidParam("force")
		return
	}

	matchField, ok := props["match_field"].(string)
	if !ok {
		c.SetInvalidParam("match_field")
		return
	}

	auditRec := c.MakeAuditRecord("migrateAuthToLdap", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "from", from)
	audit.AddEventParameter(auditRec, "force", force)
	audit.AddEventParameter(auditRec, "match_field", matchField)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAP {
		c.Err = model.NewAppError("api.migrateAuthToLDAP", "api.admin.ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	// Email auth in Mattermost system is represented by ""
	if from == "email" {
		from = ""
	}

	if migrate := c.App.AccountMigration(); migrate != nil {
		if err := migrate.MigrateToLdap(c.AppContext, from, matchField, force, false); err != nil {
			c.Err = model.NewAppError("api.migrateAuthToLdap", "api.migrate_to_saml.error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
	} else {
		c.Err = model.NewAppError("api.migrateAuthToLdap", "api.admin.ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func migrateAuthToSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJSON(r.Body)
	from, ok := props["from"].(string)
	if !ok {
		c.SetInvalidParam("from")
		return
	}
	if from == "" || (from != "email" && from != "gitlab" && from != "ldap" && from != "google" && from != "office365") {
		c.SetInvalidParam("from")
		return
	}

	auto, ok := props["auto"].(bool)
	if !ok {
		c.SetInvalidParam("auto")
		return
	}
	matches, ok := props["matches"].(map[string]any)
	if !ok {
		c.SetInvalidParam("matches")
		return
	}
	usersMap := model.MapFromJSON(strings.NewReader(model.StringInterfaceToJSON(matches)))

	auditRec := c.MakeAuditRecord("migrateAuthToSaml", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "from", from)
	audit.AddEventParameter(auditRec, "auto", auto)
	audit.AddEventParameter(auditRec, "users_map", usersMap)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.SAML {
		c.Err = model.NewAppError("api.migrateAuthToSaml", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	// Email auth in Mattermost system is represented by ""
	if from == "email" {
		from = ""
	}

	if migrate := c.App.AccountMigration(); migrate != nil {
		if err := migrate.MigrateToSaml(c.AppContext, from, usersMap, auto, false); err != nil {
			c.Err = model.NewAppError("api.migrateAuthToSaml", "api.migrate_to_saml.error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
	} else {
		c.Err = model.NewAppError("api.migrateAuthToSaml", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getThreadForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireThreadId()
	if c.Err != nil {
		return
	}
	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.ThreadId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}
	extendedStr := r.URL.Query().Get("extended")
	extended, _ := strconv.ParseBool(extendedStr)

	threadMembership, err := c.App.GetThreadMembershipForUser(c.Params.UserId, c.Params.ThreadId)
	if err != nil {
		c.Err = err
		return
	}

	thread, err := c.App.GetThreadForUser(threadMembership, extended)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(thread); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getThreadsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	options := model.GetUserThreadsOpts{
		Since:       0,
		Before:      "",
		After:       "",
		PageSize:    uint64(c.Params.PerPage),
		Unread:      false,
		Extended:    false,
		Deleted:     false,
		TotalsOnly:  false,
		ThreadsOnly: false,
	}

	sinceString := r.URL.Query().Get("since")
	if sinceString != "" {
		since, parseError := strconv.ParseUint(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParam("since")
			return
		}
		options.Since = since
	}

	options.Before = r.URL.Query().Get("before")
	options.After = r.URL.Query().Get("after")
	totalsOnlyStr := r.URL.Query().Get("totalsOnly")
	threadsOnlyStr := r.URL.Query().Get("threadsOnly")
	excludeDirectStr := r.URL.Query().Get("excludeDirect")
	options.TotalsOnly, _ = strconv.ParseBool(totalsOnlyStr)
	options.ThreadsOnly, _ = strconv.ParseBool(threadsOnlyStr)
	options.ExcludeDirect, _ = strconv.ParseBool(excludeDirectStr)

	// parameters are mutually exclusive
	if options.Before != "" && options.After != "" {
		c.Err = model.NewAppError("api.getThreadsForUser", "api.getThreadsForUser.bad_params", nil, "", http.StatusBadRequest)
		return
	}

	// parameters are mutually exclusive
	if options.TotalsOnly && options.ThreadsOnly {
		c.Err = model.NewAppError("api.getThreadsForUser", "api.getThreadsForUser.bad_only_params", nil, "", http.StatusBadRequest)
		return
	}

	deletedStr := r.URL.Query().Get("deleted")
	unreadStr := r.URL.Query().Get("unread")
	extendedStr := r.URL.Query().Get("extended")

	options.Deleted, _ = strconv.ParseBool(deletedStr)
	options.Unread, _ = strconv.ParseBool(unreadStr)
	options.Extended, _ = strconv.ParseBool(extendedStr)

	threads, err := c.App.GetThreadsForUser(c.Params.UserId, c.Params.TeamId, options)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(threads); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateReadStateThreadByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireThreadId().RequireTimestamp().RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateReadStateThreadByUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	audit.AddEventParameter(auditRec, "thread_id", c.Params.ThreadId)
	audit.AddEventParameter(auditRec, "team_id", c.Params.TeamId)
	audit.AddEventParameter(auditRec, "timestamp", c.Params.Timestamp)
	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.ThreadId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	thread, err := c.App.UpdateThreadReadForUser(c.AppContext, c.AppContext.Session().Id, c.Params.UserId, c.Params.TeamId, c.Params.ThreadId, c.Params.Timestamp)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(thread); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec.Success()
}

func setUnreadThreadByPostId(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireThreadId().RequirePostId().RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("setUnreadThreadByPostId", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	audit.AddEventParameter(auditRec, "thread_id", c.Params.ThreadId)
	audit.AddEventParameter(auditRec, "team_id", c.Params.TeamId)
	audit.AddEventParameter(auditRec, "post_id", c.Params.PostId)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.ThreadId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	// We want to make sure the thread is followed when marking as unread
	// https://mattermost.atlassian.net/browse/MM-36430
	err := c.App.UpdateThreadFollowForUser(c.Params.UserId, c.Params.TeamId, c.Params.ThreadId, true)
	if err != nil {
		c.Err = err
		return
	}

	thread, err := c.App.UpdateThreadReadForUserByPost(c.AppContext, c.AppContext.Session().Id, c.Params.UserId, c.Params.TeamId, c.Params.ThreadId, c.Params.PostId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(thread); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec.Success()
}

func unfollowThreadByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireThreadId().RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("unfollowThreadByUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	audit.AddEventParameter(auditRec, "thread_id", c.Params.ThreadId)
	audit.AddEventParameter(auditRec, "team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.ThreadId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	err := c.App.UpdateThreadFollowForUser(c.Params.UserId, c.Params.TeamId, c.Params.ThreadId, false)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)

	auditRec.Success()
}

func followThreadByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireThreadId().RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("followThreadByUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	audit.AddEventParameter(auditRec, "thread_id", c.Params.ThreadId)
	audit.AddEventParameter(auditRec, "team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.ThreadId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	err := c.App.UpdateThreadFollowForUser(c.Params.UserId, c.Params.TeamId, c.Params.ThreadId, true)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
	auditRec.Success()
}

func updateReadStateAllThreadsByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateReadStateAllThreadsByUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)
	audit.AddEventParameter(auditRec, "team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	err := c.App.UpdateThreadsReadForUser(c.Params.UserId, c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
	auditRec.Success()
}

func getUsersWithInvalidEmails(c *Context, w http.ResponseWriter, r *http.Request) {
	if *c.App.Config().TeamSettings.EnableOpenServer {
		c.Err = model.NewAppError("GetUsersWithInvalidEmails", model.NoTranslation, nil, "TeamSettings.EnableOpenServer is enabled", http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	users, appErr := c.App.GetUsersWithInvalidEmails(c.Params.Page, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	err := json.NewEncoder(w).Encode(users)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}
