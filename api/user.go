// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"crypto/tls"
	b64 "encoding/base64"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/golang/freetype"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
	"hash/fnv"
	"html/template"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func InitUser(r *mux.Router) {
	l4g.Debug(utils.T("api.user.init.debug"))

	sr := r.PathPrefix("/users").Subrouter()
	sr.Handle("/create", ApiAppHandler(createUser)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateUser)).Methods("POST")
	sr.Handle("/update_roles", ApiUserRequired(updateRoles)).Methods("POST")
	sr.Handle("/update_active", ApiUserRequired(updateActive)).Methods("POST")
	sr.Handle("/update_notify", ApiUserRequired(updateUserNotify)).Methods("POST")
	sr.Handle("/newpassword", ApiUserRequired(updatePassword)).Methods("POST")
	sr.Handle("/send_password_reset", ApiAppHandler(sendPasswordReset)).Methods("POST")
	sr.Handle("/reset_password", ApiAppHandler(resetPassword)).Methods("POST")
	sr.Handle("/login", ApiAppHandler(login)).Methods("POST")
	sr.Handle("/logout", ApiUserRequired(logout)).Methods("POST")
	sr.Handle("/login_ldap", ApiAppHandler(loginLdap)).Methods("POST")
	sr.Handle("/revoke_session", ApiUserRequired(revokeSession)).Methods("POST")
	sr.Handle("/attach_device", ApiUserRequired(attachDeviceId)).Methods("POST")
	sr.Handle("/switch_to_sso", ApiAppHandler(switchToSSO)).Methods("POST")
	sr.Handle("/switch_to_email", ApiUserRequired(switchToEmail)).Methods("POST")
	sr.Handle("/verify_email", ApiAppHandler(verifyEmail)).Methods("POST")
	sr.Handle("/resend_verification", ApiAppHandler(resendVerification)).Methods("POST")

	sr.Handle("/newimage", ApiUserRequired(uploadProfileImage)).Methods("POST")

	sr.Handle("/me", ApiAppHandler(getMe)).Methods("GET")
	sr.Handle("/me_logged_in", ApiAppHandler(getMeLoggedIn)).Methods("GET")
	sr.Handle("/status", ApiUserRequiredActivity(getStatuses, false)).Methods("POST")
	sr.Handle("/profiles", ApiUserRequired(getProfiles)).Methods("GET")
	sr.Handle("/profiles/{id:[A-Za-z0-9]+}", ApiUserRequired(getProfiles)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}", ApiUserRequired(getUser)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/sessions", ApiUserRequired(getSessions)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/audits", ApiUserRequired(getAudits)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/image", ApiUserRequired(getProfileImage)).Methods("GET")
}

func createUser(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail || !utils.Cfg.TeamSettings.EnableUserCreation {
		c.Err = model.NewLocAppError("signupTeam", "api.user.create_user.signup_email_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	user := model.UserFromJson(r.Body)

	if user == nil {
		c.SetInvalidParam("createUser", "user")
		return
	}

	// the user's username is checked to be valid when they are saved to the database

	user.EmailVerified = false

	var team *model.Team

	if result := <-Srv.Store.Team().Get(user.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	hash := r.URL.Query().Get("h")

	sendWelcomeEmail := true

	if IsVerifyHashRequired(user, team, hash) {
		data := r.URL.Query().Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewLocAppError("createUser", "api.user.create_user.signup_link_invalid.app_error", nil, "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewLocAppError("createUser", "api.user.create_user.signup_link_expired.app_error", nil, "")
			return
		}

		if user.TeamId != props["id"] {
			c.Err = model.NewLocAppError("createUser", "api.user.create_user.team_name.app_error", nil, data)
			return
		}

		user.Email = props["email"]
		user.EmailVerified = true
		sendWelcomeEmail = false
	}

	if user.IsSSOUser() {
		user.EmailVerified = true
	}

	if !CheckUserDomain(user, utils.Cfg.TeamSettings.RestrictCreationToDomains) {
		c.Err = model.NewLocAppError("createUser", "api.user.create_user.accepted_domain.app_error", nil, "")
		return
	}

	ruser, err := CreateUser(team, user)
	if err != nil {
		c.Err = err
		return
	}

	if sendWelcomeEmail {
		sendWelcomeEmailAndForget(c, ruser.Id, ruser.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team), ruser.EmailVerified)
	}

	w.Write([]byte(ruser.ToJson()))

}

func CheckUserDomain(user *model.User, domains string) bool {
	if len(domains) == 0 {
		return true
	}

	domainArray := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))

	matched := false
	for _, d := range domainArray {
		if strings.HasSuffix(user.Email, "@"+d) {
			matched = true
			break
		}
	}

	return matched
}

func IsVerifyHashRequired(user *model.User, team *model.Team, hash string) bool {
	shouldVerifyHash := true

	if team.Type == model.TEAM_INVITE && len(team.AllowedDomains) > 0 && len(hash) == 0 && user != nil {
		matched := CheckUserDomain(user, team.AllowedDomains)

		if matched {
			shouldVerifyHash = false
		} else {
			return true
		}
	}

	if team.Type == model.TEAM_OPEN {
		shouldVerifyHash = false
	}

	if len(hash) > 0 {
		shouldVerifyHash = true
	}

	return shouldVerifyHash
}

func CreateUser(team *model.Team, user *model.User) (*model.User, *model.AppError) {

	channelRole := ""
	if team.Email == user.Email {
		user.Roles = model.ROLE_TEAM_ADMIN
		channelRole = model.CHANNEL_ROLE_ADMIN

		// Below is a speical case where the first user in the entire
		// system is granted the system_admin role instead of admin
		if result := <-Srv.Store.User().GetTotalUsersCount(); result.Err != nil {
			return nil, result.Err
		} else {
			count := result.Data.(int64)
			if count <= 0 {
				user.Roles = model.ROLE_SYSTEM_ADMIN
			}
		}

	} else {
		user.Roles = ""
	}

	user.MakeNonNil()

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.user.create_user.save.error"), result.Err)
		return nil, result.Err
	} else {
		ruser := result.Data.(*model.User)

		// Soft error if there is an issue joining the default channels
		if err := JoinDefaultChannels(ruser, channelRole); err != nil {
			l4g.Error(utils.T("api.user.create_user.joining.error"), ruser.Id, ruser.TeamId, err)
		}

		addDirectChannelsAndForget(ruser)

		if user.EmailVerified {
			if cresult := <-Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
				l4g.Error(utils.T("api.user.create_user.verified.error"), cresult.Err)
			}
		}

		pref := model.Preference{UserId: ruser.Id, Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, Name: ruser.Id, Value: "0"}
		if presult := <-Srv.Store.Preference().Save(&model.Preferences{pref}); presult.Err != nil {
			l4g.Error(utils.T("api.user.create_user.tutorial.error"), presult.Err.Message)
		}

		ruser.Sanitize(map[string]bool{})

		// This message goes to every channel, so the channelId is irrelevant
		message := model.NewMessage(team.Id, "", ruser.Id, model.ACTION_NEW_USER)

		PublishAndForget(message)

		return ruser, nil
	}
}

func CreateOAuthUser(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.ReadCloser, team *model.Team) *model.User {
	var user *model.User
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.not_available.app_error", map[string]interface{}{"Service": service}, "")
		return nil
	} else {
		user = provider.GetUserFromJson(userData)
	}

	if user == nil {
		c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]interface{}{"Service": service}, "")
		return nil
	}

	suchan := Srv.Store.User().GetByAuth(team.Id, user.AuthData, service)
	euchan := Srv.Store.User().GetByEmail(team.Id, user.Email)

	if team.Email == "" {
		team.Email = user.Email
		if result := <-Srv.Store.Team().Update(team); result.Err != nil {
			c.Err = result.Err
			return nil
		}
	} else {
		found := true
		count := 0
		for found {
			if found = IsUsernameTaken(user.Username, team.Id); c.Err != nil {
				return nil
			} else if found {
				user.Username = user.Username + strconv.Itoa(count)
				count += 1
			}
		}
	}

	if result := <-suchan; result.Err == nil {
		c.Err = model.NewLocAppError("signupCompleteOAuth", "api.user.create_oauth_user.already_used.app_error",
			map[string]interface{}{"Service": service, "DisplayName": team.DisplayName}, "email="+user.Email)
		return nil
	}

	if result := <-euchan; result.Err == nil {
		c.Err = model.NewLocAppError("signupCompleteOAuth", "api.user.create_oauth_user.already_attached.app_error",
			map[string]interface{}{"Service": service, "DisplayName": team.DisplayName}, "email="+user.Email)
		return nil
	}

	user.TeamId = team.Id
	user.EmailVerified = true

	ruser, err := CreateUser(team, user)
	if err != nil {
		c.Err = err
		return nil
	}

	Login(c, w, r, ruser, "")
	if c.Err != nil {
		return nil
	}

	return ruser
}

func sendWelcomeEmailAndForget(c *Context, userId, email, teamName, teamDisplayName, siteURL, teamURL string, verified bool) {
	go func() {

		subjectPage := utils.NewHTMLTemplate("welcome_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.welcome_subject", map[string]interface{}{"TeamDisplayName": teamDisplayName})

		bodyPage := utils.NewHTMLTemplate("welcome_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.welcome_body.title", map[string]interface{}{"TeamDisplayName": teamDisplayName})
		bodyPage.Props["Info"] = c.T("api.templates.welcome_body.info")
		bodyPage.Props["Button"] = c.T("api.templates.welcome_body.button")
		bodyPage.Props["Info2"] = c.T("api.templates.welcome_body.info2")
		bodyPage.Props["Info3"] = c.T("api.templates.welcome_body.info3")
		bodyPage.Props["TeamURL"] = teamURL

		if !verified {
			link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&teamname=%s&email=%s", siteURL, userId, model.HashPassword(userId), teamName, email)
			bodyPage.Props["VerifyUrl"] = link
		}

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_welcome_email_and_forget.failed.error"), err)
		}
	}()
}

func addDirectChannelsAndForget(user *model.User) {
	go func() {
		var profiles map[string]*model.User
		if result := <-Srv.Store.User().GetProfiles(user.TeamId); result.Err != nil {
			l4g.Error(utils.T("api.user.add_direct_channels_and_forget.failed.error"), user.Id, user.TeamId, result.Err.Error())
			return
		} else {
			profiles = result.Data.(map[string]*model.User)
		}

		var preferences model.Preferences

		for id := range profiles {
			if id == user.Id {
				continue
			}

			profile := profiles[id]

			preference := model.Preference{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
				Name:     profile.Id,
				Value:    "true",
			}

			preferences = append(preferences, preference)

			if len(preferences) >= 10 {
				break
			}
		}

		if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
			l4g.Error(utils.T("api.user.add_direct_channels_and_forget.failed.error"), user.Id, user.TeamId, result.Err.Error())
		}
	}()
}

func SendVerifyEmailAndForget(c *Context, userId, userEmail, teamName, teamDisplayName, siteURL, teamURL string) {
	go func() {

		link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&teamname=%s&email=%s", siteURL, userId, model.HashPassword(userId), teamName, userEmail)

		subjectPage := utils.NewHTMLTemplate("verify_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.verify_subject",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "SiteName": utils.ClientCfg["SiteName"]})

		bodyPage := utils.NewHTMLTemplate("verify_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.verify_body.title", map[string]interface{}{"TeamDisplayName": teamDisplayName})
		bodyPage.Props["Info"] = c.T("api.templates.verify_body.info")
		bodyPage.Props["VerifyUrl"] = link
		bodyPage.Props["Button"] = c.T("api.templates.verify_body.button")

		if err := utils.SendMail(userEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_verify_email_and_forget.failed.error"), err)
		}
	}()
}

func LoginById(c *Context, w http.ResponseWriter, r *http.Request, userId, password, deviceId string) *model.User {
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		user := result.Data.(*model.User)
		if checkUserLoginAttempts(c, user) && checkUserPassword(c, user, password) {
			Login(c, w, r, user, deviceId)
			return user
		}
	}

	return nil
}

func LoginByEmail(c *Context, w http.ResponseWriter, r *http.Request, email, name, password, deviceId string) *model.User {
	var team *model.Team

	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		team = result.Data.(*model.Team)
	}

	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.Err = result.Err
		c.Err.StatusCode = http.StatusForbidden
		return nil
	} else {
		user := result.Data.(*model.User)

		if len(user.AuthData) != 0 {
			c.Err = model.NewLocAppError("LoginByEmail", "api.user.login_by_email.sign_in.app_error",
				map[string]interface{}{"AuthService": user.AuthService}, "")
			return nil
		}

		if checkUserLoginAttempts(c, user) && checkUserPassword(c, user, password) {
			Login(c, w, r, user, deviceId)
			return user
		}
	}

	return nil
}

func LoginByUsername(c *Context, w http.ResponseWriter, r *http.Request, username, name, password, deviceId string) *model.User {
	var team *model.Team

	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		team = result.Data.(*model.Team)
	}

	if result := <-Srv.Store.User().GetByUsername(team.Id, username); result.Err != nil {
		c.Err = result.Err
		c.Err.StatusCode = http.StatusForbidden
		return nil
	} else {
		user := result.Data.(*model.User)

		if len(user.AuthData) != 0 {
			c.Err = model.NewLocAppError("LoginByUsername", "api.user.login_by_email.sign_in.app_error",
				map[string]interface{}{"AuthService": user.AuthService}, "")
			return nil
		}

		if checkUserLoginAttempts(c, user) && checkUserPassword(c, user, password) {
			Login(c, w, r, user, deviceId)
			return user
		}
	}

	return nil
}

func LoginByOAuth(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.ReadCloser, team *model.Team) *model.User {
	authData := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("LoginByOAuth", "api.user.login_by_oauth.not_available.app_error",
			map[string]interface{}{"Service": service}, "")
		return nil
	} else {
		authData = provider.GetAuthDataFromJson(userData)
	}

	if len(authData) == 0 {
		c.Err = model.NewLocAppError("LoginByOAuth", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "")
		return nil
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByAuth(team.Id, authData, service); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		user = result.Data.(*model.User)
		Login(c, w, r, user, "")
		return user
	}
}

func checkUserLoginAttempts(c *Context, user *model.User) bool {
	if user.FailedAttempts >= utils.Cfg.ServiceSettings.MaximumLoginAttempts {
		c.LogAuditWithUserId(user.Id, "fail")
		c.Err = model.NewLocAppError("checkUserLoginAttempts", "api.user.check_user_login_attempts.too_many.app_error", nil, "user_id="+user.Id)
		c.Err.StatusCode = http.StatusForbidden
		return false
	}

	return true
}

func checkUserPassword(c *Context, user *model.User, password string) bool {

	if !model.ComparePassword(user.Password, password) {
		c.LogAuditWithUserId(user.Id, "fail")
		c.Err = model.NewLocAppError("checkUserPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id)
		c.Err.StatusCode = http.StatusForbidden

		if result := <-Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); result.Err != nil {
			c.LogError(result.Err)
		}

		return false
	} else {
		if result := <-Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, 0); result.Err != nil {
			c.LogError(result.Err)
		}

		return true
	}

}

// User MUST be validated before calling Login
func Login(c *Context, w http.ResponseWriter, r *http.Request, user *model.User, deviceId string) {
	c.LogAuditWithUserId(user.Id, "attempt")

	if !user.EmailVerified && utils.Cfg.EmailSettings.RequireEmailVerification {
		c.Err = model.NewLocAppError("Login", "api.user.login.not_verified.app_error", nil, "user_id="+user.Id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if user.DeleteAt > 0 {
		c.Err = model.NewLocAppError("Login", "api.user.login.inactive.app_error", nil, "user_id="+user.Id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	session := &model.Session{UserId: user.Id, TeamId: user.TeamId, Roles: user.Roles, DeviceId: deviceId, IsOAuth: false}

	maxAge := *utils.Cfg.ServiceSettings.SessionLengthWebInDays * 60 * 60 * 24

	if len(deviceId) > 0 {
		session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthMobileInDays)
		maxAge = *utils.Cfg.ServiceSettings.SessionLengthMobileInDays * 60 * 60 * 24

		// A special case where we logout of all other sessions with the same Id
		if result := <-Srv.Store.Session().GetSessions(user.Id); result.Err != nil {
			c.Err = result.Err
			c.Err.StatusCode = http.StatusForbidden
			return
		} else {
			sessions := result.Data.([]*model.Session)
			for _, session := range sessions {
				if session.DeviceId == deviceId {
					l4g.Debug(utils.T("api.user.login.revoking.app_error"), session.Id, user.Id)
					RevokeSessionById(c, session.Id)
					if c.Err != nil {
						c.LogError(c.Err)
						c.Err = nil
					}
				}
			}
		}
	} else {
		session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthWebInDays)
	}

	ua := user_agent.New(r.UserAgent())

	plat := ua.Platform()
	if plat == "" {
		plat = "unknown"
	}

	os := ua.OS()
	if os == "" {
		os = "unknown"
	}

	bname, bversion := ua.Browser()
	if bname == "" {
		bname = "unknown"
	}

	if bversion == "" {
		bversion = "0.0"
	}

	session.AddProp(model.SESSION_PROP_PLATFORM, plat)
	session.AddProp(model.SESSION_PROP_OS, os)
	session.AddProp(model.SESSION_PROP_BROWSER, fmt.Sprintf("%v/%v", bname, bversion))

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		c.Err = result.Err
		c.Err.StatusCode = http.StatusForbidden
		return
	} else {
		session = result.Data.(*model.Session)
		AddSessionToCache(session)
	}

	w.Header().Set(model.HEADER_TOKEN, session.Token)

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAge), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    session.Token,
		Path:     "/",
		MaxAge:   maxAge,
		Expires:  expiresAt,
		HttpOnly: true,
	}

	http.SetCookie(w, sessionCookie)

	c.Session = *session
	c.LogAuditWithUserId(user.Id, "success")
}

func login(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	if len(props["password"]) == 0 {
		c.Err = model.NewLocAppError("login", "api.user.login.blank_pwd.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var user *model.User
	if len(props["id"]) != 0 {
		user = LoginById(c, w, r, props["id"], props["password"], props["device_id"])
	} else if len(props["email"]) != 0 && len(props["name"]) != 0 {
		user = LoginByEmail(c, w, r, props["email"], props["name"], props["password"], props["device_id"])
	} else if len(props["username"]) != 0 && len(props["name"]) != 0 {
		user = LoginByUsername(c, w, r, props["username"], props["name"], props["password"], props["device_id"])
	} else {
		c.Err = model.NewLocAppError("login", "api.user.login.not_provided.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if c.Err != nil {
		return
	}

	if user != nil {
		user.Sanitize(map[string]bool{})
	} else {
		user = &model.User{}
	}
	w.Write([]byte(user.ToJson()))
}

func loginLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.LdapSettings.Enable {
		c.Err = model.NewLocAppError("loginLdap", "api.user.login_ldap.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	props := model.MapFromJson(r.Body)

	password := props["password"]
	id := props["id"]
	teamName := props["teamName"]

	if len(password) == 0 {
		c.Err = model.NewLocAppError("loginLdap", "api.user.login_ldap.blank_pwd.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if len(id) == 0 {
		c.Err = model.NewLocAppError("loginLdap", "api.user.login_ldap.need_id.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	teamc := Srv.Store.Team().GetByName(teamName)

	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil {
		c.Err = model.NewLocAppError("loginLdap", "api.user.login_ldap.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	var team *model.Team
	if result := <-teamc; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	user, err := ldapInterface.DoLogin(team, id, password)
	if err != nil {
		c.Err = err
		return
	}

	if !checkUserLoginAttempts(c, user) {
		return
	}

	// User is authenticated at this point

	Login(c, w, r, user, props["device_id"])

	if user != nil {
		user.Sanitize(map[string]bool{})
	} else {
		user = &model.User{}
	}
	w.Write([]byte(user.ToJson()))
}

func revokeSession(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	id := props["id"]
	RevokeSessionById(c, id)
	w.Write([]byte(model.MapToJson(props)))
}

func attachDeviceId(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	deviceId := props["device_id"]
	if len(deviceId) == 0 {
		c.SetInvalidParam("attachDevice", "deviceId")
		return
	}

	if !(strings.HasPrefix(deviceId, model.PUSH_NOTIFY_APPLE+":") || strings.HasPrefix(deviceId, model.PUSH_NOTIFY_ANDROID+":")) {
		c.SetInvalidParam("attachDevice", "deviceId")
		return
	}

	// A special case where we logout of all other sessions with the same Id
	if result := <-Srv.Store.Session().GetSessions(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		c.Err.StatusCode = http.StatusForbidden
		return
	} else {
		sessions := result.Data.([]*model.Session)
		for _, session := range sessions {
			if session.DeviceId == deviceId && session.Id != c.Session.Id {
				l4g.Debug(utils.T("api.user.login.revoking.app_error"), session.Id, c.Session.UserId)
				RevokeSessionById(c, session.Id)
				if c.Err != nil {
					c.LogError(c.Err)
					c.Err = nil
				}
			}
		}
	}

	sessionCache.Remove(c.Session.Token)

	if result := <-Srv.Store.Session().UpdateDeviceId(c.Session.Id, deviceId); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte(model.MapToJson(props)))
}

func RevokeSessionById(c *Context, sessionId string) {
	if result := <-Srv.Store.Session().Get(sessionId); result.Err != nil {
		c.Err = result.Err
	} else {
		session := result.Data.(*model.Session)
		c.LogAudit("session_id=" + session.Id)

		if session.IsOAuth {
			RevokeAccessToken(session.Token)
		} else {
			sessionCache.Remove(session.Token)

			if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
				c.Err = result.Err
			}
		}
	}
}

func RevokeAllSession(c *Context, userId string) {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			c.LogAuditWithUserId(userId, "session_id="+session.Id)
			if session.IsOAuth {
				RevokeAccessToken(session.Token)
			} else {
				sessionCache.Remove(session.Token)
				if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
					c.Err = result.Err
					return
				}
			}
		}
	}
}

func getSessions(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getSessions") {
		return
	}

	if result := <-Srv.Store.Session().GetSessions(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		sessions := result.Data.([]*model.Session)
		for _, session := range sessions {
			session.Sanitize()
		}

		w.Write([]byte(model.SessionsToJson(sessions)))
	}
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
	if result := <-Srv.Store.Session().Remove(c.Session.Id); result.Err != nil {
		c.Err = result.Err
		return
	}
}

func getMe(c *Context, w http.ResponseWriter, r *http.Request) {

	if len(c.Session.UserId) == 0 {
		return
	}

	if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		c.RemoveSessionCookie(w, r)
		l4g.Error(utils.T("api.user.get_me.getting.error"), c.Session.UserId)
		return
	} else if HandleEtag(result.Data.(*model.User).Etag(), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag())
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getMeLoggedIn(c *Context, w http.ResponseWriter, r *http.Request) {
	data := make(map[string]string)
	data["logged_in"] = "false"
	data["team_name"] = ""

	if len(c.Session.UserId) != 0 {
		teamChan := Srv.Store.Team().Get(c.Session.TeamId)
		var team *model.Team
		if tr := <-teamChan; tr.Err != nil {
			c.Err = tr.Err
			return
		} else {
			team = tr.Data.(*model.Team)
		}
		data["logged_in"] = "true"
		data["team_name"] = team.Name
	}
	w.Write([]byte(model.MapToJson(data)))
}

func getUser(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getUser") {
		return
	}

	if result := <-Srv.Store.User().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.User).Etag(), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag())
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getProfiles(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, ok := params["id"]
	if ok {
		// You must be system admin to access another team
		if id != c.Session.TeamId {
			if !c.HasSystemAdminPermissions("getProfiles") {
				return
			}
		}

	} else {
		id = c.Session.TeamId
	}

	etag := (<-Srv.Store.User().GetEtagForProfiles(id)).Data.(string)
	if HandleEtag(etag, w, r) {
		return
	}

	if result := <-Srv.Store.User().GetProfiles(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		profiles := result.Data.(map[string]*model.User)

		for k, p := range profiles {
			options := utils.Cfg.GetSanitizeOptions()
			options["passwordupdate"] = false

			if c.IsSystemAdmin() {
				options["fullname"] = true
				options["email"] = true
			}

			p.Sanitize(options)
			p.ClearNonProfileFields()
			profiles[k] = p
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(model.UserMapToJson(profiles)))
		return
	}
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getAudits") {
		return
	}

	userChan := Srv.Store.User().Get(id)
	auditChan := Srv.Store.Audit().Get(id, 20)

	if c.Err = (<-userChan).Err; c.Err != nil {
		return
	}

	if result := <-auditChan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		audits := result.Data.(model.Audits)
		etag := audits.Etag()

		if HandleEtag(etag, w, r) {
			return
		}

		if len(etag) > 0 {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		}

		w.Write([]byte(audits.ToJson()))
		return
	}
}

func createProfileImage(username string, userId string) ([]byte, *model.AppError) {
	colors := []color.NRGBA{
		{197, 8, 126, 255},
		{227, 207, 18, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
	}

	h := fnv.New32a()
	h.Write([]byte(userId))
	seed := h.Sum32()

	initial := string(strings.ToUpper(username)[0])

	fontBytes, err := ioutil.ReadFile(utils.FindDir("web/static/fonts") + utils.Cfg.FileSettings.InitialFont)
	if err != nil {
		return nil, model.NewLocAppError("createProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error())
	}
	font, err := freetype.ParseFont(fontBytes)
	if err != nil {
		return nil, model.NewLocAppError("createProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error())
	}

	width := int(utils.Cfg.FileSettings.ProfileWidth)
	height := int(utils.Cfg.FileSettings.ProfileHeight)
	color := colors[int64(seed)%int64(len(colors))]
	dstImg := image.NewRGBA(image.Rect(0, 0, width, height))
	srcImg := image.White
	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.ZP, draw.Src)
	size := float64((width + height) / 4)

	c := freetype.NewContext()
	c.SetFont(font)
	c.SetFontSize(size)
	c.SetClip(dstImg.Bounds())
	c.SetDst(dstImg)
	c.SetSrc(srcImg)

	pt := freetype.Pt(width/6, height*2/3)
	_, err = c.DrawString(initial, pt)
	if err != nil {
		return nil, model.NewLocAppError("createProfileImage", "api.user.create_profile_image.initial.app_error", nil, err.Error())
	}

	buf := new(bytes.Buffer)

	if imgErr := png.Encode(buf, dstImg); imgErr != nil {
		return nil, model.NewLocAppError("createProfileImage", "api.user.create_profile_image.encode.app_error", nil, imgErr.Error())
	} else {
		return buf.Bytes(), nil
	}
}

func getProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if result := <-Srv.Store.User().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		var img []byte

		if len(utils.Cfg.FileSettings.DriverName) == 0 {
			var err *model.AppError
			if img, err = createProfileImage(result.Data.(*model.User).Username, id); err != nil {
				c.Err = err
				return
			}
		} else {
			path := "teams/" + c.Session.TeamId + "/users/" + id + "/profile.png"

			if data, err := readFile(path); err != nil {

				if img, err = createProfileImage(result.Data.(*model.User).Username, id); err != nil {
					c.Err = err
					return
				}

				if err := writeFile(img, path); err != nil {
					c.Err = err
					return
				}

			} else {
				img = data
			}
		}

		if c.Session.UserId == id {
			w.Header().Set("Cache-Control", "max-age=300, public") // 5 mins
		} else {
			w.Header().Set("Cache-Control", "max-age=86400, public") // 24 hrs
		}

		w.Header().Set("Content-Type", "image/png")
		w.Write(img)
	}
}

func uploadProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
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

	file, err := imageData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.open.app_error", nil, err.Error())
		return
	}

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		c.Err = model.NewLocAppError("uploadProfileFile", "api.user.upload_profile_user.decode_config.app_error", nil, err.Error())
		return
	} else if config.Width*config.Height > MaxImageSize {
		c.Err = model.NewLocAppError("uploadProfileFile", "api.user.upload_profile_user.too_large.app_error", nil, err.Error())
		return
	}

	file.Seek(0, 0)

	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.decode.app_error", nil, err.Error())
		return
	}

	// Scale profile image
	img = imaging.Resize(img, utils.Cfg.FileSettings.ProfileWidth, utils.Cfg.FileSettings.ProfileHeight, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.encode.app_error", nil, err.Error())
		return
	}

	path := "teams/" + c.Session.TeamId + "/users/" + c.Session.UserId + "/profile.png"

	if err := writeFile(buf.Bytes(), path); err != nil {
		c.Err = model.NewLocAppError("uploadProfileImage", "api.user.upload_profile_user.upload_profile.app_error", nil, "")
		return
	}

	Srv.Store.User().UpdateLastPictureUpdate(c.Session.UserId)

	c.LogAudit("")

	// write something as the response since jQuery expects a json response
	w.Write([]byte("true"))
}

func updateUser(c *Context, w http.ResponseWriter, r *http.Request) {
	user := model.UserFromJson(r.Body)

	if user == nil {
		c.SetInvalidParam("updateUser", "user")
		return
	}

	if !c.HasPermissionsToUser(user.Id, "updateUser") {
		return
	}

	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("")

		rusers := result.Data.([2]*model.User)

		if rusers[0].Email != rusers[1].Email {
			if tresult := <-Srv.Store.Team().Get(rusers[1].TeamId); tresult.Err != nil {
				l4g.Error(tresult.Err.Message)
			} else {
				team := tresult.Data.(*model.Team)
				sendEmailChangeEmailAndForget(c, rusers[1].Email, rusers[0].Email, team.DisplayName, c.GetTeamURLFromTeam(team), c.GetSiteURL())

				if utils.Cfg.EmailSettings.RequireEmailVerification {
					SendEmailChangeVerifyEmailAndForget(c, rusers[0].Id, rusers[0].Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team))
				}
			}
		}

		rusers[0].Password = ""
		rusers[0].AuthData = ""
		w.Write([]byte(rusers[0].ToJson()))
	}
}

func updatePassword(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempted")

	props := model.MapFromJson(r.Body)
	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updatePassword", "user_id")
		return
	}

	currentPassword := props["current_password"]
	if len(currentPassword) <= 0 {
		c.SetInvalidParam("updatePassword", "current_password")
		return
	}

	newPassword := props["new_password"]
	if len(newPassword) < 5 {
		c.SetInvalidParam("updatePassword", "new_password")
		return
	}

	if userId != c.Session.UserId {
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.context.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var result store.StoreResult

	if result = <-Srv.Store.User().Get(userId); result.Err != nil {
		c.Err = result.Err
		return
	}

	if result.Data == nil {
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.valid_account.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	user := result.Data.(*model.User)

	tchan := Srv.Store.Team().Get(user.TeamId)

	if user.AuthData != "" {
		c.LogAudit("failed - tried to update user password who was logged in through oauth")
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.oauth.app_error", nil, "auth_service="+user.AuthService)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if !model.ComparePassword(user.Password, currentPassword) {
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.incorrect.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if uresult := <-Srv.Store.User().UpdatePassword(c.Session.UserId, model.HashPassword(newPassword)); uresult.Err != nil {
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.failed.app_error", nil, uresult.Err.Error())
		c.Err.StatusCode = http.StatusForbidden
		return
	} else {
		c.LogAudit("completed")

		if tresult := <-tchan; tresult.Err != nil {
			l4g.Error(tresult.Err.Message)
		} else {
			team := tresult.Data.(*model.Team)
			sendPasswordChangeEmailAndForget(c, user.Email, team.DisplayName, c.GetTeamURLFromTeam(team), c.GetSiteURL(), c.T("api.user.update_password.menu"))
		}

		data := make(map[string]string)
		data["user_id"] = uresult.Data.(string)
		w.Write([]byte(model.MapToJson(data)))
	}
}

func updateRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateRoles", "user_id")
		return
	}

	new_roles := props["new_roles"]
	if !model.IsValidRoles(new_roles) {
		c.SetInvalidParam("updateRoles", "new_roles")
		return
	}

	if model.IsInRole(new_roles, model.ROLE_SYSTEM_ADMIN) && !c.IsSystemAdmin() {
		c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.system_admin_set.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(user_id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !c.HasPermissionsToTeam(user.TeamId, "updateRoles") {
		return
	}

	if !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.permissions.app_error", nil, "userId="+user_id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if user.IsInRole(model.ROLE_SYSTEM_ADMIN) && !c.IsSystemAdmin() {
		c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.system_admin_mod.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	ruser := UpdateRoles(c, user, new_roles)
	if c.Err != nil {
		return
	}

	uchan := Srv.Store.Session().UpdateRoles(user.Id, new_roles)
	gchan := Srv.Store.Session().GetSessions(user.Id)

	if result := <-uchan; result.Err != nil {
		// soft error since the user roles were still updated
		l4g.Error(result.Err)
	}

	if result := <-gchan; result.Err != nil {
		// soft error since the user roles were still updated
		l4g.Error(result.Err)
	} else {
		sessions := result.Data.([]*model.Session)
		for _, s := range sessions {
			sessionCache.Remove(s.Token)
		}
	}

	options := utils.Cfg.GetSanitizeOptions()
	options["passwordupdate"] = false
	ruser.Sanitize(options)
	w.Write([]byte(ruser.ToJson()))
}

func UpdateRoles(c *Context, user *model.User, roles string) *model.User {
	// make sure there is at least 1 other active admin

	if !model.IsInRole(roles, model.ROLE_SYSTEM_ADMIN) {
		if model.IsInRole(user.Roles, model.ROLE_TEAM_ADMIN) && !model.IsInRole(roles, model.ROLE_TEAM_ADMIN) {
			if result := <-Srv.Store.User().GetProfiles(user.TeamId); result.Err != nil {
				c.Err = result.Err
				return nil
			} else {
				activeAdmins := -1
				profileUsers := result.Data.(map[string]*model.User)
				for _, profileUser := range profileUsers {
					if profileUser.DeleteAt == 0 && model.IsInRole(profileUser.Roles, model.ROLE_TEAM_ADMIN) {
						activeAdmins = activeAdmins + 1
					}
				}

				if activeAdmins <= 0 {
					c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.one_admin.app_error", nil, "")
					return nil
				}
			}
		}
	}

	user.Roles = roles

	var ruser *model.User
	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		c.LogAuditWithUserId(user.Id, "roles="+roles)
		ruser = result.Data.([2]*model.User)[0]
	}

	return ruser
}

func updateActive(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateActive", "user_id")
		return
	}

	active := props["active"] == "true"

	var user *model.User
	if result := <-Srv.Store.User().Get(user_id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !c.HasPermissionsToTeam(user.TeamId, "updateActive") {
		return
	}

	if !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("updateActive", "api.user.update_active.permissions.app_error", nil, "userId="+user_id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	// make sure there is at least 1 other active admin
	if !active && model.IsInRole(user.Roles, model.ROLE_TEAM_ADMIN) {
		if result := <-Srv.Store.User().GetProfiles(user.TeamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			activeAdmins := -1
			profileUsers := result.Data.(map[string]*model.User)
			for _, profileUser := range profileUsers {
				if profileUser.DeleteAt == 0 && model.IsInRole(profileUser.Roles, model.ROLE_TEAM_ADMIN) {
					activeAdmins = activeAdmins + 1
				}
			}

			if activeAdmins <= 0 {
				c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.one_admin.app_error", nil, "userId="+user_id)
				return
			}
		}
	}

	ruser := UpdateActive(c, user, active)

	if c.Err == nil {
		w.Write([]byte(ruser.ToJson()))
	}
}

func UpdateActive(c *Context, user *model.User, active bool) *model.User {
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		c.LogAuditWithUserId(user.Id, fmt.Sprintf("active=%v", active))

		if user.DeleteAt > 0 {
			RevokeAllSession(c, user.Id)
		}

		if extra := <-Srv.Store.Channel().ExtraUpdateByUser(user.Id, model.GetMillis()); extra.Err != nil {
			c.Err = extra.Err
		}

		ruser := result.Data.([2]*model.User)[0]
		options := utils.Cfg.GetSanitizeOptions()
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		return ruser
	}
}

func PermanentDeleteUser(c *Context, user *model.User) *model.AppError {
	l4g.Warn(utils.T("api.user.permanent_delete_user.attempting.warn"), user.Email, user.Id)
	c.Path = "/users/permanent_delete"
	c.LogAuditWithUserId(user.Id, fmt.Sprintf("attempt userId=%v", user.Id))
	c.LogAuditWithUserId("", fmt.Sprintf("attempt userId=%v", user.Id))
	if user.IsInRole(model.ROLE_SYSTEM_ADMIN) {
		l4g.Warn(utils.T("api.user.permanent_delete_user.system_admin.warn"), user.Email)
	}

	UpdateActive(c, user, false)

	if result := <-Srv.Store.Session().PermanentDeleteSessionsByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.OAuth().PermanentDeleteAuthDataByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteIncomingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteOutgoingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Command().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Preference().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Channel().PermanentDeleteMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Post().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.User().PermanentDelete(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Audit().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	l4g.Warn(utils.T("api.user.permanent_delete_user.deleted.warn"), user.Email, user.Id)
	c.LogAuditWithUserId("", fmt.Sprintf("success userId=%v", user.Id))

	return nil
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("sendPasswordReset", "email")
		return
	}

	name := props["name"]
	if len(name) == 0 {
		c.SetInvalidParam("sendPasswordReset", "name")
		return
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.Err = model.NewLocAppError("sendPasswordReset", "api.user.send_password_reset.find.app_error", nil, "email="+email+" team_id="+team.Id)
		return
	} else {
		user = result.Data.(*model.User)
	}

	if len(user.AuthData) != 0 {
		c.Err = model.NewLocAppError("sendPasswordReset", "api.user.send_password_reset.sso.app_error", nil, "userId="+user.Id+", teamId="+team.Id)
		return
	}

	newProps := make(map[string]string)
	newProps["user_id"] = user.Id
	newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.PasswordResetSalt))

	link := fmt.Sprintf("%s/reset_password_complete?d=%s&h=%s", c.GetTeamURLFromTeam(team), url.QueryEscape(data), url.QueryEscape(hash))

	subjectPage := utils.NewHTMLTemplate("reset_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.reset_subject")

	bodyPage := utils.NewHTMLTemplate("reset_body", c.Locale)
	bodyPage.Props["SiteURL"] = c.GetSiteURL()
	bodyPage.Props["Title"] = c.T("api.templates.reset_body.title")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.reset_body.info"))
	bodyPage.Props["ResetUrl"] = link
	bodyPage.Props["Button"] = c.T("api.templates.reset_body.button")

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		c.Err = model.NewLocAppError("sendPasswordReset", "api.user.send_password_reset.send.app_error", nil, "err="+err.Message)
		return
	}

	c.LogAuditWithUserId(user.Id, "sent="+email)

	w.Write([]byte(model.MapToJson(props)))
}

func resetPassword(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	newPassword := props["new_password"]
	if len(newPassword) < 5 {
		c.SetInvalidParam("resetPassword", "new_password")
		return
	}

	name := props["name"]
	if len(name) == 0 {
		c.SetInvalidParam("resetPassword", "name")
		return
	}

	userId := props["user_id"]
	hash := props["hash"]
	timeStr := ""

	if !c.IsSystemAdmin() {
		if len(hash) == 0 {
			c.SetInvalidParam("resetPassword", "hash")
			return
		}

		data := model.MapFromJson(strings.NewReader(props["data"]))

		userId = data["user_id"]

		timeStr = data["time"]
		if len(timeStr) == 0 {
			c.SetInvalidParam("resetPassword", "data:time")
			return
		}
	}

	if len(userId) != 26 {
		c.SetInvalidParam("resetPassword", "user_id")
		return
	}

	c.LogAuditWithUserId(userId, "attempt")

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if len(user.AuthData) != 0 {
		c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.sso.app_error", nil, "userId="+user.Id+", teamId="+team.Id)
		return
	}

	if user.TeamId != team.Id {
		c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.wrong_team.app_error", nil, "userId="+user.Id+", teamId="+team.Id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if !c.IsSystemAdmin() {
		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", props["data"], utils.Cfg.EmailSettings.PasswordResetSalt)) {
			c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.invalid_link.app_error", nil, "")
			return
		}

		t, err := strconv.ParseInt(timeStr, 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
			c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.link_expired.app_error", nil, "")
			return
		}
	}

	if result := <-Srv.Store.User().UpdatePassword(userId, model.HashPassword(newPassword)); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(userId, "success")
	}

	sendPasswordChangeEmailAndForget(c, user.Email, team.DisplayName, c.GetTeamURLFromTeam(team), c.GetSiteURL(), c.T("api.user.reset_password.method"))

	props["new_password"] = ""
	w.Write([]byte(model.MapToJson(props)))
}

func sendPasswordChangeEmailAndForget(c *Context, email, teamDisplayName, teamURL, siteURL, method string) {
	go func() {

		subjectPage := utils.NewHTMLTemplate("password_change_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.password_change_subject",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "SiteName": utils.ClientCfg["SiteName"]})

		bodyPage := utils.NewHTMLTemplate("password_change_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.password_change_body.title")
		bodyPage.Html["Info"] = template.HTML(c.T("api.templates.password_change_body.info",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "TeamURL": teamURL, "Method": method}))

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_password_change_email_and_forget.error"), err)
		}

	}()
}

func sendEmailChangeEmailAndForget(c *Context, oldEmail, newEmail, teamDisplayName, teamURL, siteURL string) {
	go func() {

		subjectPage := utils.NewHTMLTemplate("email_change_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.email_change_subject",
			map[string]interface{}{"TeamDisplayName": teamDisplayName})
		subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

		bodyPage := utils.NewHTMLTemplate("email_change_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.email_change_body.title")
		bodyPage.Html["Info"] = template.HTML(c.T("api.templates.email_change_body.info",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "NewEmail": newEmail}))

		if err := utils.SendMail(oldEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_email_change_email_and_forget.error"), err)
		}

	}()
}

func SendEmailChangeVerifyEmailAndForget(c *Context, userId, newUserEmail, teamName, teamDisplayName, siteURL, teamURL string) {
	go func() {

		link := fmt.Sprintf("%s/verify_email?uid=%s&hid=%s&teamname=%s&email=%s", siteURL, userId, model.HashPassword(userId), teamName, newUserEmail)

		subjectPage := utils.NewHTMLTemplate("email_change_verify_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.email_change_verify_subject",
			map[string]interface{}{"TeamDisplayName": teamDisplayName})
		subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

		bodyPage := utils.NewHTMLTemplate("email_change_verify_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.email_change_verify_body.title")
		bodyPage.Props["Info"] = c.T("api.templates.email_change_verify_body.info",
			map[string]interface{}{"TeamDisplayName": teamDisplayName})
		bodyPage.Props["VerifyUrl"] = link
		bodyPage.Props["VerifyButton"] = c.T("api.templates.email_change_verify_body.button")

		if err := utils.SendMail(newUserEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_email_change_verify_email_and_forget.error"), err)
		}
	}()
}

func updateUserNotify(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateUserNotify", "user_id")
		return
	}

	uchan := Srv.Store.User().Get(user_id)

	if !c.HasPermissionsToUser(user_id, "updateUserNotify") {
		return
	}

	delete(props, "user_id")

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("updateUserNotify", "email")
		return
	}

	desktop_sound := props["desktop_sound"]
	if len(desktop_sound) == 0 {
		c.SetInvalidParam("updateUserNotify", "desktop_sound")
		return
	}

	desktop := props["desktop"]
	if len(desktop) == 0 {
		c.SetInvalidParam("updateUserNotify", "desktop")
		return
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	user.NotifyProps = props

	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(user.Id, "")

		ruser := result.Data.([2]*model.User)[0]
		options := utils.Cfg.GetSanitizeOptions()
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		w.Write([]byte(ruser.ToJson()))
	}
}

func getStatuses(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("getStatuses", "userIds")
		return
	}

	if result := <-Srv.Store.User().GetProfiles(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		profiles := result.Data.(map[string]*model.User)

		statuses := map[string]string{}
		for _, profile := range profiles {
			found := false
			for _, uid := range userIds {
				if uid == profile.Id {
					found = true
				}
			}

			if !found {
				continue
			}

			if profile.IsOffline() {
				statuses[profile.Id] = model.USER_OFFLINE
			} else if profile.IsAway() {
				statuses[profile.Id] = model.USER_AWAY
			} else {
				statuses[profile.Id] = model.USER_ONLINE
			}
		}

		//w.Header().Set("Cache-Control", "max-age=9, public") // 2 mins
		w.Write([]byte(model.MapToJson(statuses)))
		return
	}
}

func GetAuthorizationCode(c *Context, service, teamName string, props map[string]string, loginHint string) (string, *model.AppError) {

	sso := utils.Cfg.GetSSOService(service)
	if sso != nil && !sso.Enable {
		return "", model.NewLocAppError("GetAuthorizationCode", "api.user.get_authorization_code.unsupported.app_error", nil, "service="+service)
	}

	clientId := sso.Id
	endpoint := sso.AuthEndpoint
	scope := sso.Scope

	props["hash"] = model.HashPassword(clientId)
	props["team"] = teamName
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJson(props)))

	redirectUri := c.GetSiteURL() + "/api/v1/oauth/" + service + "/complete"

	authUrl := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectUri) + "&state=" + url.QueryEscape(state)

	if len(scope) > 0 {
		authUrl += "&scope=" + utils.UrlEncode(scope)
	}

	if len(loginHint) > 0 {
		authUrl += "&login_hint=" + utils.UrlEncode(loginHint)
	}

	return authUrl, nil
}

func AuthorizeOAuthUser(service, code, state, redirectUri string) (io.ReadCloser, *model.Team, map[string]string, *model.AppError) {
	sso := utils.Cfg.GetSSOService(service)
	if sso == nil || !sso.Enable {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.unsupported.app_error", nil, "service="+service)
	}

	stateStr := ""
	if b, err := b64.StdEncoding.DecodeString(state); err != nil {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, err.Error())
	} else {
		stateStr = string(b)
	}

	stateProps := model.MapFromJson(strings.NewReader(stateStr))

	if !model.ComparePassword(stateProps["hash"], sso.Id) {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "")
	}

	ok := true
	teamName := ""
	if teamName, ok = stateProps["team"]; !ok {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state_team.app_error", nil, "")
	}

	tchan := Srv.Store.Team().GetByName(teamName)

	p := url.Values{}
	p.Set("client_id", sso.Id)
	p.Set("client_secret", sso.Secret)
	p.Set("code", code)
	p.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	p.Set("redirect_uri", redirectUri)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	client := &http.Client{Transport: tr}
	req, _ := http.NewRequest("POST", sso.TokenEndpoint, strings.NewReader(p.Encode()))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	var ar *model.AccessResponse
	if resp, err := client.Do(req); err != nil {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error())
	} else {
		ar = model.AccessResponseFromJson(resp.Body)
		if ar == nil {
			return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, "")
		}
	}

	if strings.ToLower(ar.TokenType) != model.ACCESS_TOKEN_TYPE {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType)
	}

	if len(ar.AccessToken) == 0 {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "")
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)
	req, _ = http.NewRequest("GET", sso.UserApiEndpoint, strings.NewReader(""))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	if resp, err := client.Do(req); err != nil {
		return nil, nil, nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error",
			map[string]interface{}{"Service": service}, err.Error())
	} else {
		if result := <-tchan; result.Err != nil {
			return nil, nil, nil, result.Err
		} else {
			return resp.Body, result.Data.(*model.Team), stateProps, nil
		}
	}

}

func IsUsernameTaken(name string, teamId string) bool {

	if !model.IsValidUsername(name) {
		return false
	}

	if result := <-Srv.Store.User().GetByUsername(teamId, name); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func switchToSSO(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	password := props["password"]
	if len(password) == 0 {
		c.SetInvalidParam("switchToSSO", "password")
		return
	}

	teamName := props["team_name"]
	if len(teamName) == 0 {
		c.SetInvalidParam("switchToSSO", "team_name")
		return
	}

	service := props["service"]
	if len(service) == 0 {
		c.SetInvalidParam("switchToSSO", "service")
		return
	}

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("switchToSSO", "email")
		return
	}

	c.LogAudit("attempt")

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.LogAudit("fail - couldn't get team")
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !checkUserLoginAttempts(c, user) || !checkUserPassword(c, user, password) {
		c.LogAuditWithUserId(user.Id, "fail - invalid password")
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	stateProps["email"] = email

	m := map[string]string{}
	if authUrl, err := GetAuthorizationCode(c, service, teamName, stateProps, ""); err != nil {
		c.LogAuditWithUserId(user.Id, "fail - oauth issue")
		c.Err = err
		return
	} else {
		m["follow_link"] = authUrl
	}

	c.LogAuditWithUserId(user.Id, "success")
	w.Write([]byte(model.MapToJson(m)))
}

func CompleteSwitchWithOAuth(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.ReadCloser, team *model.Team, email string) {
	authData := ""
	ssoEmail := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.unavailable.app_error",
			map[string]interface{}{"Service": service}, "")
		return
	} else {
		ssoUser := provider.GetUserFromJson(userData)
		authData = ssoUser.AuthData
		ssoEmail = ssoUser.Email
	}

	if len(authData) == 0 {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "")
		return
	}

	if len(email) == 0 {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.blank_email.app_error", nil, "")
		return
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	RevokeAllSession(c, user.Id)
	if c.Err != nil {
		return
	}

	if result := <-Srv.Store.User().UpdateAuthData(user.Id, service, authData, ssoEmail); result.Err != nil {
		c.Err = result.Err
		return
	}

	sendSignInChangeEmailAndForget(c, user.Email, team.DisplayName, c.GetSiteURL()+"/"+team.Name, c.GetSiteURL(), strings.Title(service)+" SSO")
}

func switchToEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	password := props["password"]
	if len(password) == 0 {
		c.SetInvalidParam("switchToEmail", "password")
		return
	}

	teamName := props["team_name"]
	if len(teamName) == 0 {
		c.SetInvalidParam("switchToEmail", "team_name")
		return
	}

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("switchToEmail", "email")
		return
	}

	c.LogAudit("attempt")

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.LogAudit("fail - couldn't get team")
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if user.Id != c.Session.UserId {
		c.LogAudit("fail - user ids didn't match")
		c.Err = model.NewLocAppError("switchToEmail", "api.user.switch_to_email.context.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if result := <-Srv.Store.User().UpdatePassword(c.Session.UserId, model.HashPassword(password)); result.Err != nil {
		c.LogAudit("fail - database issue")
		c.Err = result.Err
		return
	}

	sendSignInChangeEmailAndForget(c, user.Email, team.DisplayName, c.GetSiteURL()+"/"+team.Name, c.GetSiteURL(), c.T("api.templates.signin_change_email.body.method_email"))

	RevokeAllSession(c, c.Session.UserId)
	if c.Err != nil {
		return
	}

	m := map[string]string{}
	m["follow_link"] = c.GetTeamURL() + "/login?extra=signin_change"

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(m)))
}

func sendSignInChangeEmailAndForget(c *Context, email, teamDisplayName, teamURL, siteURL, method string) {
	go func() {

		subjectPage := utils.NewHTMLTemplate("signin_change_subject", c.Locale)
		subjectPage.Props["Subject"] = c.T("api.templates.singin_change_email.subject",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "SiteName": utils.ClientCfg["SiteName"]})

		bodyPage := utils.NewHTMLTemplate("signin_change_body", c.Locale)
		bodyPage.Props["SiteURL"] = siteURL
		bodyPage.Props["Title"] = c.T("api.templates.signin_change_email.body.title")
		bodyPage.Html["Info"] = template.HTML(c.T("api.templates.singin_change_email.body.info",
			map[string]interface{}{"TeamDisplayName": teamDisplayName, "TeamURL": teamURL, "Method": method}))

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.user.send_sign_in_change_email_and_forget.error"), err)
		}

	}()
}

func verifyEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["uid"]
	if len(userId) != 26 {
		c.SetInvalidParam("verifyEmail", "uid")
		return
	}

	hashedId := props["hid"]
	if len(hashedId) == 0 {
		c.SetInvalidParam("verifyEmail", "hid")
		return
	}

	if model.ComparePassword(hashedId, userId) {
		if c.Err = (<-Srv.Store.User().VerifyEmail(userId)).Err; c.Err != nil {
			return
		} else {
			c.LogAudit("Email Verified")
			return
		}
	}

	c.Err = model.NewLocAppError("verifyEmail", "api.user.verify_email.bad_link.app_error", nil, "")
	c.Err.StatusCode = http.StatusForbidden
}

func resendVerification(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	teamName := props["team_name"]
	if len(teamName) == 0 {
		c.SetInvalidParam("resendVerification", "team_name")
		return
	}

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("resendVerification", "email")
		return
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user := result.Data.(*model.User)

		if user.LastActivityAt > 0 {
			SendEmailChangeVerifyEmailAndForget(c, user.Id, user.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team))
		} else {
			SendVerifyEmailAndForget(c, user.Id, user.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team))
		}
	}
}
