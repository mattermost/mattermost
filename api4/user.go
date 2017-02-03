// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitUser() {
	l4g.Debug(utils.T("api.user.init.debug"))

	BaseRoutes.Users.Handle("", ApiHandler(createUser)).Methods("POST")
	BaseRoutes.Users.Handle("", ApiSessionRequired(getUsers)).Methods("GET")
	BaseRoutes.Users.Handle("/ids", ApiSessionRequired(getUsersByIds)).Methods("POST")

	BaseRoutes.User.Handle("", ApiSessionRequired(getUser)).Methods("GET")
	BaseRoutes.User.Handle("", ApiSessionRequired(updateUser)).Methods("PUT")
	BaseRoutes.User.Handle("/roles", ApiSessionRequired(updateUserRoles)).Methods("PUT")

	BaseRoutes.Users.Handle("/login", ApiHandler(login)).Methods("POST")
	BaseRoutes.Users.Handle("/logout", ApiHandler(logout)).Methods("POST")

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
	if c.Err == nil {
		w.Write([]byte(model.MapToJson(data)))
	}
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
