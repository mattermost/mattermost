// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strconv"

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
	BaseRoutes.Users.Handle("/autocomplete", ApiSessionRequired(autocompleteUsers)).Methods("GET")

	BaseRoutes.User.Handle("", ApiSessionRequired(getUser)).Methods("GET")
	BaseRoutes.User.Handle("/image", ApiSessionRequired(getProfileImage)).Methods("GET")
	BaseRoutes.User.Handle("/image", ApiSessionRequired(setProfileImage)).Methods("POST")
	BaseRoutes.User.Handle("", ApiSessionRequired(updateUser)).Methods("PUT")
	BaseRoutes.User.Handle("/patch", ApiSessionRequired(patchUser)).Methods("PUT")
	BaseRoutes.User.Handle("/mfa", ApiSessionRequired(updateUserMfa)).Methods("PUT")
	BaseRoutes.User.Handle("", ApiSessionRequired(deleteUser)).Methods("DELETE")
	BaseRoutes.User.Handle("/roles", ApiSessionRequired(updateUserRoles)).Methods("PUT")
	BaseRoutes.User.Handle("/password", ApiSessionRequired(updatePassword)).Methods("PUT")
	BaseRoutes.Users.Handle("/password/reset", ApiHandler(resetPassword)).Methods("POST")
	BaseRoutes.Users.Handle("/password/reset/send", ApiHandler(sendPasswordReset)).Methods("POST")
	BaseRoutes.User.Handle("/email/verify", ApiHandler(verify)).Methods("POST")

	BaseRoutes.Users.Handle("/login", ApiHandler(login)).Methods("POST")
	BaseRoutes.Users.Handle("/logout", ApiHandler(logout)).Methods("POST")

	BaseRoutes.UserByUsername.Handle("", ApiSessionRequired(getUserByUsername)).Methods("GET")
	BaseRoutes.UserByEmail.Handle("", ApiSessionRequired(getUserByEmail)).Methods("GET")

	BaseRoutes.User.Handle("/sessions", ApiSessionRequired(getSessions)).Methods("GET")
	BaseRoutes.User.Handle("/sessions/revoke", ApiSessionRequired(revokeSession)).Methods("POST")
	BaseRoutes.User.Handle("/audits", ApiSessionRequired(getUserAudits)).Methods("GET")
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
		ruser, err = app.CreateUserWithHash(user, hash, r.URL.Query().Get("d"), c.GetSiteURL())
	} else if len(inviteId) > 0 {
		ruser, err = app.CreateUserWithInviteId(user, inviteId, c.GetSiteURL())
	} else {
		ruser, err = app.CreateUserFromSignup(user, c.GetSiteURL())
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
		app.SanitizeProfile(user, c.IsSystemAdmin())
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
	inChannelId := r.URL.Query().Get("in_channel")
	notInChannelId := r.URL.Query().Get("not_in_channel")

	if len(notInChannelId) > 0 && len(inTeamId) == 0 {
		c.SetInvalidParam("team_id")
		return
	}

	var profiles []*model.User
	var err *model.AppError
	etag := ""

	if len(notInChannelId) > 0 {
		if !app.SessionHasPermissionToChannel(c.Session, notInChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		profiles, err = app.GetUsersNotInChannelPage(inTeamId, notInChannelId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
	} else if len(inTeamId) > 0 {
		if !app.SessionHasPermissionToTeam(c.Session, inTeamId, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		etag = app.GetUsersInTeamEtag(inTeamId)
		if HandleEtag(etag, "Get Users in Team", w, r) {
			return
		}

		profiles, err = app.GetUsersInTeamPage(inTeamId, c.Params.Page, c.Params.PerPage, c.IsSystemAdmin())
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

	if len(teamId) > 0 {
		if len(channelId) > 0 {
			if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
				return
			}

			result, _ := app.AutocompleteUsersInChannel(teamId, channelId, name, searchOptions, c.IsSystemAdmin())
			autocomplete.Users = result.InChannel
			autocomplete.OutOfChannel = result.OutOfChannel
		} else {
			if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_VIEW_TEAM) {
				c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
				return
			}

			result, _ := app.AutocompleteUsersInTeam(teamId, name, searchOptions, c.IsSystemAdmin())
			autocomplete.Users = result.InTeam
		}
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

	if ruser, err := app.UpdateUserAsUser(user, c.GetSiteURL(), c.IsSystemAdmin()); err != nil {
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

	if ruser, err := app.PatchUser(c.Params.UserId, patch, c.GetSiteURL(), c.IsSystemAdmin()); err != nil {
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

	if err := app.UpdateMfa(activate, c.Params.UserId, code, c.GetSiteURL()); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success - mfa updated")
	ReturnStatusOK(w)
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

		err = app.UpdatePasswordAsUser(c.Params.UserId, currentPassword, newPassword, c.GetSiteURL())
	} else if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		err = app.UpdatePasswordByUserIdSendEmail(c.Params.UserId, newPassword, c.T("api.user.reset_password.method"), c.GetSiteURL())
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

	code := props["code"]
	if len(code) != model.PASSWORD_RECOVERY_CODE_SIZE {
		c.SetInvalidParam("code")
		return
	}

	newPassword := props["new_password"]

	c.LogAudit("attempt - code=" + code)

	if err := app.ResetPasswordFromCode(code, newPassword, c.GetSiteURL()); err != nil {
		c.LogAudit("fail - code=" + code)
		c.Err = err
		return
	}

	c.LogAudit("success - code=" + code)

	ReturnStatusOK(w)
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("email")
		return
	}

	if sent, err := app.SendPasswordReset(email, c.GetSiteURL()); err != nil {
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
	}

	if err := app.RevokeSessionById(sessionId); err != nil {
		c.Err = err
		return
	}

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

func verify(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["uid"]
	if len(userId) != 26 {
		c.SetInvalidParam("uid")
		return
	}

	hashedId := props["hid"]
	if len(hashedId) == 0 {
		c.SetInvalidParam("hid")
		return
	}

	hashed := model.HashPassword(hashedId)
	if model.ComparePassword(hashed, userId+utils.Cfg.EmailSettings.InviteSalt) {
		if c.Err = app.VerifyUserEmail(userId); c.Err != nil {
			return
		} else {
			c.LogAudit("Email Verified")
			ReturnStatusOK(w)
			return
		}
	}

	c.Err = model.NewLocAppError("verifyEmail", "api.user.verify_email.bad_link.app_error", nil, "")
	c.Err.StatusCode = http.StatusBadRequest
	return
}
