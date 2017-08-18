// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func InitUser() {
	l4g.Debug(utils.T("api.user.init.debug"))

	BaseRoutes.Users.Handle("", ApiHandler(createUser)).Methods("POST")
	BaseRoutes.Users.Handle("", ApiSessionRequired(getUsers)).Methods("GET")
	BaseRoutes.Users.Handle("/ids", ApiSessionRequired(getUsersByIds)).Methods("POST")
	BaseRoutes.Users.Handle("/usernames", ApiSessionRequired(getUsersByNames)).Methods("POST")
	BaseRoutes.Users.Handle("/search", ApiSessionRequired(searchUsers)).Methods("POST")
	BaseRoutes.Users.Handle("/autocomplete", ApiSessionRequired(autocompleteUsers)).Methods("GET")

	BaseRoutes.User.Handle("", ApiSessionRequired(getUser)).Methods("GET")
	BaseRoutes.User.Handle("/image", ApiSessionRequiredTrustRequester(getProfileImage)).Methods("GET")
	BaseRoutes.User.Handle("/image", ApiSessionRequired(setProfileImage)).Methods("POST")
	BaseRoutes.User.Handle("", ApiSessionRequired(updateUser)).Methods("PUT")
	BaseRoutes.User.Handle("/patch", ApiSessionRequired(patchUser)).Methods("PUT")
	BaseRoutes.User.Handle("", ApiSessionRequired(deleteUser)).Methods("DELETE")
	BaseRoutes.User.Handle("/roles", ApiSessionRequired(updateUserRoles)).Methods("PUT")
	BaseRoutes.User.Handle("/active", ApiSessionRequired(updateUserActive)).Methods("PUT")
	BaseRoutes.User.Handle("/password", ApiSessionRequired(updatePassword)).Methods("PUT")
	BaseRoutes.Users.Handle("/password/reset", ApiHandler(resetPassword)).Methods("POST")
	BaseRoutes.Users.Handle("/password/reset/send", ApiHandler(sendPasswordReset)).Methods("POST")
	BaseRoutes.Users.Handle("/email/verify", ApiHandler(verifyUserEmail)).Methods("POST")
	BaseRoutes.Users.Handle("/email/verify/send", ApiHandler(sendVerificationEmail)).Methods("POST")

	BaseRoutes.Users.Handle("/mfa", ApiHandler(checkUserMfa)).Methods("POST")
	BaseRoutes.User.Handle("/mfa", ApiSessionRequiredMfa(updateUserMfa)).Methods("PUT")
	BaseRoutes.User.Handle("/mfa/generate", ApiSessionRequiredMfa(generateMfaSecret)).Methods("POST")

	BaseRoutes.Users.Handle("/login", ApiHandler(login)).Methods("POST")
	BaseRoutes.Users.Handle("/login/switch", ApiHandler(switchAccountType)).Methods("POST")
	BaseRoutes.Users.Handle("/logout", ApiHandler(logout)).Methods("POST")

	BaseRoutes.UserByUsername.Handle("", ApiSessionRequired(getUserByUsername)).Methods("GET")
	BaseRoutes.UserByEmail.Handle("", ApiSessionRequired(getUserByEmail)).Methods("GET")

	BaseRoutes.User.Handle("/sessions", ApiSessionRequired(getSessions)).Methods("GET")
	BaseRoutes.User.Handle("/sessions/revoke", ApiSessionRequired(revokeSession)).Methods("POST")
	BaseRoutes.Users.Handle("/sessions/device", ApiSessionRequired(attachDeviceId)).Methods("PUT")
	BaseRoutes.User.Handle("/audits", ApiSessionRequired(getUserAudits)).Methods("GET")

	BaseRoutes.User.Handle("/tokens", ApiSessionRequired(createUserAccessToken)).Methods("POST")
	BaseRoutes.User.Handle("/tokens", ApiSessionRequired(getUserAccessTokens)).Methods("GET")
	BaseRoutes.Users.Handle("/tokens/{token_id:[A-Za-z0-9]+}", ApiSessionRequired(getUserAccessToken)).Methods("GET")
	BaseRoutes.Users.Handle("/tokens/revoke", ApiSessionRequired(revokeUserAccessToken)).Methods("POST")
}

func createUser(c *Context, w http.ResponseWriter, r *http.Request) {
	user := model.UserFromJson(r.Body)
	if user == nil {
		c.SetInvalidParam("user")
		return
	}

	hash := r.URL.Query().Get("h")
	inviteId := r.URL.Query().Get("iid")

	// No permission check required

	var ruser *model.User
	var err *model.AppError
	if len(hash) > 0 {
		ruser, err = app.CreateUserWithHash(user, hash, r.URL.Query().Get("d"))
	} else if len(inviteId) > 0 {
		ruser, err = app.CreateUserWithInviteId(user, inviteId)
	} else if c.IsSystemAdmin() {
		ruser, err = app.CreateUserAsAdmin(user)
	} else {
		ruser, err = app.CreateUserFromSignup(user)
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

	// No permission check required

	var user *model.User
	var err *model.AppError

	if user, err = app.GetUser(c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	etag := user.Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)

	if HandleEtag(etag, "Get User", w, r) {
		return
	} else {
		if c.Session.UserId == user.Id {
			user.Sanitize(map[string]bool{})
		} else {
			app.SanitizeProfile(user, c.IsSystemAdmin())
		}
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(user.ToJson()))
		return
	}
}

func getUserByUsername(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUsername()
	if c.Err != nil {
		return
	}

	// No permission check required

	var user *model.User
	var err *model.AppError

	if user, err = app.GetUserByUsername(c.Params.Username); err != nil {
		c.Err = err
		return
	}

	etag := user.Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)

	if HandleEtag(etag, "Get User", w, r) {
		return
	} else {
		app.SanitizeProfile(user, c.IsSystemAdmin())
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(user.ToJson()))
		return
	}
}

func getUserByEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmail()
	if c.Err != nil {
		return
	}

	// No permission check required

	var user *model.User
	var err *model.AppError

	if user, err = app.GetUserByEmail(c.Params.Email); err != nil {
		c.Err = err
		return
	}

	etag := user.Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)

	if HandleEtag(etag, "Get User", w, r) {
		return
	} else {
		app.SanitizeProfile(user, c.IsSystemAdmin())
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(user.ToJson()))
		return
	}
}

func getProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if users, err := app.GetUsersByIds([]string{c.Params.UserId}, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		if len(users) == 0 {
			c.Err = err
		}

		user := users[0]
		etag := strconv.FormatInt(user.LastPictureUpdate, 10)
		if HandleEtag(etag, "Get Profile Image", w, r) {
			return
		}

		var img []byte
		img, readFailed, err := app.GetProfileImage(user)
		if err != nil {
			c.Err = err
			return
		}

		if readFailed {
			w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, public", 5*60)) // 5 mins
		} else {
			w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, public", 24*60*60)) // 24 hrs
		}

		w.Header().Set("Content-Type", "image/png")
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write(img)
	}
}

func setProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if r.ContentLength > *utils.Cfg.FileSettings.MaxFileSize {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	if err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, "")
		return
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	imageData := imageArray[0]

	if err := app.SetProfileImage(c.Session.UserId, imageData); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	ReturnStatusOK(w)
}

func getUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	inTeamId := r.URL.Query().Get("in_team")
	notInTeamId := r.URL.Query().Get("not_in_team")
	inChannelId := r.URL.Query().Get("in_channel")
	notInChannelId := r.URL.Query().Get("not_in_channel")
	withoutTeam := r.URL.Query().Get("without_team")
	sort := r.URL.Query().Get("sort")

	if len(notInChannelId) > 0 && len(inTeamId) == 0 {
		c.SetInvalidUrlParam("team_id")
		return
	}

	if sort != "" && sort != "last_activity_at" && sort != "create_at" {
		c.SetInvalidUrlParam("sort")
		return
	}

	// Currently only supports sorting on a team
	if (sort == "last_activity_at" || sort == "create_at") && (inTeamId == "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "") {
		c.SetInvalidUrlParam("sort")
		return
	}

	var profiles []*model.User
	var err *model.AppError
	etag := ""

	if withoutTeamBool, _ := strconv.ParseBool(withoutTeam); withoutTeamBool {
		// Use a special permission for now
		if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_LIST_USERS_WITHOUT_TEAM) {
			c.SetPermissionError(model.PERMISSION_LIST_USERS_WITHOUT_TEAM)
			return
		}

		profiles, err = app.GetUsersWithoutTeamPage(c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	} else if len(notInChannelId) > 0 {
		if !app.SessionHasPermissionToChannel(c.Session, notInChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		profiles, err = app.GetUsersNotInChannelPage(inTeamId, notInChannelId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	} else if len(notInTeamId) > 0 {
		if !app.SessionHasPermissionToTeam(c.Session, notInTeamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		etag = app.GetUsersNotInTeamEtag(inTeamId)
		if HandleEtag(etag, "Get Users Not in Team", w, r) {
			return
		}

		profiles, err = app.GetUsersNotInTeamPage(notInTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	} else if len(inTeamId) > 0 {
		if !app.SessionHasPermissionToTeam(c.Session, inTeamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		if sort == "last_activity_at" {
			profiles, err = app.GetRecentlyActiveUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
		} else if sort == "create_at" {
			profiles, err = app.GetNewUsersForTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
		} else {
			etag = app.GetUsersInTeamEtag(inTeamId)
			if HandleEtag(etag, "Get Users in Team", w, r) {
				return
			}

			profiles, err = app.GetUsersInTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
		}
	} else if len(inChannelId) > 0 {
		if !app.SessionHasPermissionToChannel(c.Session, inChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		profiles, err = app.GetUsersInChannelPage(inChannelId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	} else {
		// No permission check required

		etag = app.GetUsersEtag()
		if HandleEtag(etag, "Get Users", w, r) {
			return
		}
		profiles, err = app.GetUsersPage(c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	}

	if err != nil {
		c.Err = err
		return
	} else {
		if len(etag) > 0 {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		}
		w.Write([]byte(model.UserListToJson(profiles)))
	}
}

func getUsersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	// No permission check required

	if users, err := app.GetUsersByIds(userIds, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.UserListToJson(users)))
	}
}

func getUsersByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	usernames := model.ArrayFromJson(r.Body)

	if len(usernames) == 0 {
		c.SetInvalidParam("usernames")
		return
	}

	// No permission check required

	if users, err := app.GetUsersByUsernames(usernames, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.UserListToJson(users)))
	}
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

	if props.InChannelId != "" && !app.SessionHasPermissionToChannel(c.Session, props.InChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if props.NotInChannelId != "" && !app.SessionHasPermissionToChannel(c.Session, props.NotInChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if props.TeamId != "" && !app.SessionHasPermissionToTeam(c.Session, props.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if props.NotInTeamId != "" && !app.SessionHasPermissionToTeam(c.Session, props.NotInTeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	searchOptions := map[string]bool{}
	searchOptions[store.USER_SEARCH_OPTION_ALLOW_INACTIVE] = props.AllowInactive

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		hideFullName := !utils.Cfg.PrivacySettings.ShowFullName
		hideEmail := !utils.Cfg.PrivacySettings.ShowEmailAddress

		if hideFullName && hideEmail {
			searchOptions[store.USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME] = true
		} else if hideFullName {
			searchOptions[store.USER_SEARCH_OPTION_ALL_NO_FULL_NAME] = true
		} else if hideEmail {
			searchOptions[store.USER_SEARCH_OPTION_NAMES_ONLY] = true
		}
	}

	if profiles, err := app.SearchUsers(props, searchOptions, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.UserListToJson(profiles)))
	}
}

func autocompleteUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("in_channel")
	teamId := r.URL.Query().Get("in_team")
	name := r.URL.Query().Get("name")

	autocomplete := new(model.UserAutocomplete)
	var err *model.AppError

	searchOptions := map[string]bool{}

	hideFullName := !utils.Cfg.PrivacySettings.ShowFullName
	if hideFullName && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		searchOptions[store.USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME] = true
	} else {
		searchOptions[store.USER_SEARCH_OPTION_NAMES_ONLY] = true
	}

	if len(channelId) > 0 {
		if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		result, _ := app.AutocompleteUsersInChannel(teamId, channelId, name, searchOptions, c.IsSystemAdmin())
		autocomplete.Users = result.InChannel
		autocomplete.OutOfChannel = result.OutOfChannel
	} else if len(teamId) > 0 {
		if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		result, _ := app.AutocompleteUsersInTeam(teamId, name, searchOptions, c.IsSystemAdmin())
		autocomplete.Users = result.InTeam
	} else {
		// No permission check required
		result, _ := app.SearchUsersInTeam("", name, searchOptions, c.IsSystemAdmin())
		autocomplete.Users = result
	}

	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte((autocomplete.ToJson())))
	}
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

	if !app.SessionHasPermissionToUser(c.Session, user.Id) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if ruser, err := app.UpdateUserAsUser(user, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("")
		w.Write([]byte(ruser.ToJson()))
	}
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

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if ruser, err := app.PatchUser(c.Params.UserId, patch, c.IsSystemAdmin()); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("")
		w.Write([]byte(ruser.ToJson()))
	}
}

func deleteUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userId := c.Params.UserId

	if !app.SessionHasPermissionToUser(c.Session, userId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	var user *model.User
	var err *model.AppError

	if user, err = app.GetUser(userId); err != nil {
		c.Err = err
		return
	}

	if _, err := app.UpdateActive(user, false); err != nil {
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_ROLES)
		return
	}

	if _, err := app.UpdateUserRoles(c.Params.UserId, newRoles); err != nil {
		c.Err = err
		return
	} else {
		c.LogAuditWithUserId(c.Params.UserId, "roles="+newRoles)
	}

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
	isSelfDeactive := !active && c.Params.UserId == c.Session.UserId

	if !isSelfDeactive && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewLocAppError("updateUserActive", "api.user.update_active.permissions.app_error", nil, "userId="+c.Params.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if ruser, err := app.UpdateActiveNoLdap(c.Params.UserId, active); err != nil {
		c.Err = err
	} else {
		c.LogAuditWithUserId(ruser.Id, fmt.Sprintf("active=%v", active))
		ReturnStatusOK(w)
	}
}

func checkUserMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	loginId := props["login_id"]
	if len(loginId) == 0 {
		c.SetInvalidParam("login_id")
		return
	}

	resp := map[string]interface{}{}
	resp["mfa_required"] = false

	if !utils.IsLicensed() || !*utils.License().Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication {
		w.Write([]byte(model.StringInterfaceToJson(resp)))
		return
	}

	if user, err := app.GetUserForLogin(loginId, false); err == nil {
		resp["mfa_required"] = user.MfaActive
	}

	w.Write([]byte(model.StringInterfaceToJson(resp)))
}

func updateUserMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
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

	if err := app.UpdateMfa(activate, c.Params.UserId, code); err != nil {
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

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	secret, err := app.GenerateMfaSecret(c.Params.UserId)
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
	if c.Params.UserId == c.Session.UserId {
		currentPassword := props["current_password"]
		if len(currentPassword) <= 0 {
			c.SetInvalidParam("current_password")
			return
		}

		err = app.UpdatePasswordAsUser(c.Params.UserId, currentPassword, newPassword)
	} else if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		err = app.UpdatePasswordByUserIdSendEmail(c.Params.UserId, newPassword, c.T("api.user.reset_password.method"))
	} else {
		err = model.NewAppError("updatePassword", "api.user.update_password.context.app_error", nil, "", http.StatusForbidden)
	}

	if err != nil {
		c.LogAudit("failed")
		c.Err = err
		return
	} else {
		c.LogAudit("completed")
		ReturnStatusOK(w)
	}
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

	if err := app.ResetPasswordFromToken(token, newPassword); err != nil {
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

	if sent, err := app.SendPasswordReset(email, utils.GetSiteURL()); err != nil {
		c.Err = err
		return
	} else if sent {
		c.LogAudit("sent=" + email)
	}

	ReturnStatusOK(w)
}

func login(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	loginId := props["login_id"]
	password := props["password"]
	mfaToken := props["token"]
	deviceId := props["device_id"]
	ldapOnly := props["ldap_only"] == "true"

	c.LogAuditWithUserId(id, "attempt - login_id="+loginId)
	user, err := app.AuthenticateUserForLogin(id, loginId, password, mfaToken, deviceId, ldapOnly)
	if err != nil {
		c.LogAuditWithUserId(id, "failure - login_id="+loginId)
		c.Err = err
		return
	}

	c.LogAuditWithUserId(user.Id, "authenticated")

	var session *model.Session
	session, err = app.DoLogin(w, r, user, deviceId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAuditWithUserId(user.Id, "success")

	c.Session = *session

	user.Sanitize(map[string]bool{})

	w.Write([]byte(user.ToJson()))
}

func logout(c *Context, w http.ResponseWriter, r *http.Request) {
	data := make(map[string]string)
	data["user_id"] = c.Session.UserId

	Logout(c, w, r)

}

func Logout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")
	c.RemoveSessionCookie(w, r)
	if c.Session.Id != "" {
		if err := app.RevokeSessionById(c.Session.Id); err != nil {
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

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if sessions, err := app.GetSessions(c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		for _, session := range sessions {
			session.Sanitize()
		}

		w.Write([]byte(model.SessionsToJson(sessions)))
		return
	}
}

func revokeSession(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	props := model.MapFromJson(r.Body)
	sessionId := props["session_id"]

	if sessionId == "" {
		c.SetInvalidParam("session_id")
		return
	}

	if err := app.RevokeSessionById(sessionId); err != nil {
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
	if err := app.RevokeSessionsForDeviceId(c.Session.UserId, deviceId, c.Session.Id); err != nil {
		c.Err = err
		return
	}

	app.ClearSessionCacheForUser(c.Session.UserId)
	c.Session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthMobileInDays)

	maxAge := *utils.Cfg.ServiceSettings.SessionLengthMobileInDays * 60 * 60 * 24

	secure := false
	if app.GetProtocol(r) == "https" {
		secure = true
	}

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAge), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    c.Session.Token,
		Path:     "/",
		MaxAge:   maxAge,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   secure,
	}

	http.SetCookie(w, sessionCookie)

	if err := app.AttachDeviceId(c.Session.Id, deviceId, c.Session.ExpiresAt); err != nil {
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

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if audits, err := app.GetAuditsPage(c.Params.UserId, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(audits.ToJson()))
		return
	}
}

func verifyUserEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	token := props["token"]
	if len(token) != model.TOKEN_SIZE {
		c.SetInvalidParam("token")
		return
	}

	if err := app.VerifyEmailFromToken(token); err != nil {
		c.Err = model.NewLocAppError("verifyUserEmail", "api.user.verify_email.bad_link.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	} else {
		c.LogAudit("Email Verified")
		ReturnStatusOK(w)
		return
	}
}

func sendVerificationEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("email")
		return
	}

	user, err := app.GetUserForLogin(email, false)
	if err != nil {
		// Don't want to leak whether the email is valid or not
		ReturnStatusOK(w)
		return
	}

	err = app.SendEmailVerification(user)
	if err != nil {
		// Don't want to leak whether the email is valid or not
		l4g.Error(err.Error())
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
		link, err = app.SwitchEmailToOAuth(w, r, switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.NewService)
	} else if switchRequest.OAuthToEmail() {
		c.SessionRequired()
		if c.Err != nil {
			return
		}

		link, err = app.SwitchOAuthToEmail(switchRequest.Email, switchRequest.NewPassword, c.Session.UserId)
	} else if switchRequest.EmailToLdap() {
		link, err = app.SwitchEmailToLdap(switchRequest.Email, switchRequest.Password, switchRequest.MfaCode, switchRequest.LdapId, switchRequest.NewPassword)
	} else if switchRequest.LdapToEmail() {
		link, err = app.SwitchLdapToEmail(switchRequest.Password, switchRequest.MfaCode, switchRequest.Email, switchRequest.NewPassword)
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_CREATE_USER_ACCESS_TOKEN)
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	accessToken.UserId = c.Params.UserId
	accessToken.Token = ""

	var err *model.AppError
	accessToken, err = app.CreateUserAccessToken(accessToken)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	w.Write([]byte(accessToken.ToJson()))
}

func getUserAccessTokens(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_READ_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_READ_USER_ACCESS_TOKEN)
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	accessTokens, err := app.GetUserAccessTokensForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_READ_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_READ_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := app.GetUserAccessToken(c.Params.TokenId, true)
	if err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, accessToken.UserId) {
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_REVOKE_USER_ACCESS_TOKEN) {
		c.SetPermissionError(model.PERMISSION_REVOKE_USER_ACCESS_TOKEN)
		return
	}

	accessToken, err := app.GetUserAccessToken(tokenId, false)
	if err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, accessToken.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	err = app.RevokeUserAccessToken(accessToken)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - token_id=" + accessToken.Id)
	ReturnStatusOK(w)
}
