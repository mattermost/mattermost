// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	b64 "encoding/base64"
	"fmt"
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

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/golang/freetype"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

func InitUser() {
	l4g.Debug(utils.T("api.user.init.debug"))

	BaseRoutes.Users.Handle("/create", ApiAppHandler(createUser)).Methods("POST")
	BaseRoutes.Users.Handle("/update", ApiUserRequired(updateUser)).Methods("POST")
	BaseRoutes.Users.Handle("/update_roles", ApiUserRequired(updateRoles)).Methods("POST")
	BaseRoutes.Users.Handle("/update_active", ApiUserRequired(updateActive)).Methods("POST")
	BaseRoutes.Users.Handle("/update_notify", ApiUserRequired(updateUserNotify)).Methods("POST")
	BaseRoutes.Users.Handle("/newpassword", ApiUserRequired(updatePassword)).Methods("POST")
	BaseRoutes.Users.Handle("/send_password_reset", ApiAppHandler(sendPasswordReset)).Methods("POST")
	BaseRoutes.Users.Handle("/reset_password", ApiAppHandler(resetPassword)).Methods("POST")
	BaseRoutes.Users.Handle("/login", ApiAppHandler(login)).Methods("POST")
	BaseRoutes.Users.Handle("/logout", ApiAppHandler(logout)).Methods("POST")
	BaseRoutes.Users.Handle("/revoke_session", ApiUserRequired(revokeSession)).Methods("POST")
	BaseRoutes.Users.Handle("/attach_device", ApiUserRequired(attachDeviceId)).Methods("POST")
	BaseRoutes.Users.Handle("/verify_email", ApiAppHandler(verifyEmail)).Methods("POST")
	BaseRoutes.Users.Handle("/resend_verification", ApiAppHandler(resendVerification)).Methods("POST")
	BaseRoutes.Users.Handle("/newimage", ApiUserRequired(uploadProfileImage)).Methods("POST")
	BaseRoutes.Users.Handle("/me", ApiAppHandler(getMe)).Methods("GET")
	BaseRoutes.Users.Handle("/initial_load", ApiAppHandler(getInitialLoad)).Methods("GET")
	BaseRoutes.Users.Handle("/direct_profiles", ApiUserRequired(getDirectProfiles)).Methods("GET")
	BaseRoutes.Users.Handle("/profiles/{id:[A-Za-z0-9]+}", ApiUserRequired(getProfiles)).Methods("GET")
	BaseRoutes.Users.Handle("/profiles_for_dm_list/{id:[A-Za-z0-9]+}", ApiUserRequired(getProfilesForDirectMessageList)).Methods("GET")

	BaseRoutes.Users.Handle("/mfa", ApiAppHandler(checkMfa)).Methods("POST")
	BaseRoutes.Users.Handle("/generate_mfa_qr", ApiUserRequiredTrustRequester(generateMfaQrCode)).Methods("GET")
	BaseRoutes.Users.Handle("/update_mfa", ApiUserRequired(updateMfa)).Methods("POST")

	BaseRoutes.Users.Handle("/claim/email_to_oauth", ApiAppHandler(emailToOAuth)).Methods("POST")
	BaseRoutes.Users.Handle("/claim/oauth_to_email", ApiUserRequired(oauthToEmail)).Methods("POST")
	BaseRoutes.Users.Handle("/claim/email_to_ldap", ApiAppHandler(emailToLdap)).Methods("POST")
	BaseRoutes.Users.Handle("/claim/ldap_to_email", ApiAppHandler(ldapToEmail)).Methods("POST")

	BaseRoutes.NeedUser.Handle("/get", ApiUserRequired(getUser)).Methods("GET")
	BaseRoutes.NeedUser.Handle("/sessions", ApiUserRequired(getSessions)).Methods("GET")
	BaseRoutes.NeedUser.Handle("/audits", ApiUserRequired(getAudits)).Methods("GET")
	BaseRoutes.NeedUser.Handle("/image", ApiUserRequiredTrustRequester(getProfileImage)).Methods("GET")

	BaseRoutes.Root.Handle("/login/sso/saml", AppHandlerIndependent(loginWithSaml)).Methods("GET")
	BaseRoutes.Root.Handle("/login/sso/saml", AppHandlerIndependent(completeSaml)).Methods("POST")

	BaseRoutes.WebSocket.Handle("user_typing", ApiWebSocketHandler(userTyping))
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

	hash := r.URL.Query().Get("h")
	teamId := ""
	var team *model.Team
	shouldSendWelcomeEmail := true
	user.EmailVerified = false

	if len(hash) > 0 {
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

		teamId = props["id"]

		// try to load the team to make sure it exists
		if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team = result.Data.(*model.Team)
		}

		user.Email = props["email"]
		user.EmailVerified = true
		shouldSendWelcomeEmail = false
	}

	inviteId := r.URL.Query().Get("iid")
	if len(inviteId) > 0 {
		if result := <-Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team = result.Data.(*model.Team)
			teamId = team.Id
		}
	}

	firstAccount := false
	if sessionCache.Len() == 0 {
		if cr := <-Srv.Store.User().GetTotalUsersCount(); cr.Err != nil {
			c.Err = cr.Err
			return
		} else {
			count := cr.Data.(int64)
			if count <= 0 {
				firstAccount = true
			}
		}
	}

	if !firstAccount && !*utils.Cfg.TeamSettings.EnableOpenServer && len(teamId) == 0 {
		c.Err = model.NewLocAppError("createUser", "api.user.create_user.no_open_server", nil, "email="+user.Email)
		return
	}

	if !CheckUserDomain(user, utils.Cfg.TeamSettings.RestrictCreationToDomains) {
		c.Err = model.NewLocAppError("createUser", "api.user.create_user.accepted_domain.app_error", nil, "")
		return
	}

	ruser, err := CreateUser(user)
	if err != nil {
		c.Err = err
		return
	}

	if len(teamId) > 0 {
		err := JoinUserToTeam(team, ruser)
		if err != nil {
			c.Err = err
			return
		}

		go addDirectChannels(team.Id, ruser)
	}

	if shouldSendWelcomeEmail {
		go sendWelcomeEmail(c, ruser.Id, ruser.Email, c.GetSiteURL(), ruser.EmailVerified)
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
		if strings.HasSuffix(strings.ToLower(user.Email), "@"+d) {
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

func CreateUser(user *model.User) (*model.User, *model.AppError) {

	user.Roles = ""

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role instead of admin
	if result := <-Srv.Store.User().GetTotalUsersCount(); result.Err != nil {
		return nil, result.Err
	} else {
		count := result.Data.(int64)
		if count <= 0 {
			user.Roles = model.ROLE_SYSTEM_ADMIN
		}
	}

	user.MakeNonNil()
	user.Locale = *utils.Cfg.LocalizationSettings.DefaultClientLocale

	if err := utils.IsPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.user.create_user.save.error"), result.Err)
		return nil, result.Err
	} else {
		ruser := result.Data.(*model.User)

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
		go Publish(model.NewWebSocketEvent("", "", ruser.Id, model.WEBSOCKET_EVENT_NEW_USER))

		return ruser, nil
	}
}

func CreateOAuthUser(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.Reader, teamId string) *model.User {
	var user *model.User
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.not_available.app_error", map[string]interface{}{"Service": strings.Title(service)}, "")
		return nil
	} else {
		user = provider.GetUserFromJson(userData)
	}

	if user == nil {
		c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]interface{}{"Service": service}, "")
		return nil
	}

	suchan := Srv.Store.User().GetByAuth(user.AuthData, service)
	euchan := Srv.Store.User().GetByEmail(user.Email)

	found := true
	count := 0
	for found {
		if found = IsUsernameTaken(user.Username); found {
			user.Username = user.Username + strconv.Itoa(count)
			count += 1
		}
	}

	if result := <-suchan; result.Err == nil {
		c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_used.app_error",
			map[string]interface{}{"Service": service}, "email="+user.Email)
		return nil
	}

	if result := <-euchan; result.Err == nil {
		authService := result.Data.(*model.User).AuthService
		if authService == "" {
			c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error",
				map[string]interface{}{"Service": service, "Auth": model.USER_AUTH_SERVICE_EMAIL}, "email="+user.Email)
		} else {
			c.Err = model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error",
				map[string]interface{}{"Service": service, "Auth": authService}, "email="+user.Email)
		}
		return nil
	}

	user.EmailVerified = true

	ruser, err := CreateUser(user)
	if err != nil {
		c.Err = err
		return nil
	}

	if len(teamId) > 0 {
		err = JoinUserToTeamById(teamId, user)
		if err != nil {
			c.Err = err
			return nil
		}

		go addDirectChannels(teamId, user)
	}

	doLogin(c, w, r, ruser, "")
	if c.Err != nil {
		return nil
	}

	return ruser
}

func sendWelcomeEmail(c *Context, userId string, email string, siteURL string, verified bool) {
	rawUrl, _ := url.Parse(siteURL)

	subjectPage := utils.NewHTMLTemplate("welcome_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.welcome_subject", map[string]interface{}{"ServerURL": rawUrl.Host})

	bodyPage := utils.NewHTMLTemplate("welcome_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.welcome_body.title", map[string]interface{}{"ServerURL": rawUrl.Host})
	bodyPage.Props["Info"] = c.T("api.templates.welcome_body.info")
	bodyPage.Props["Button"] = c.T("api.templates.welcome_body.button")
	bodyPage.Props["Info2"] = c.T("api.templates.welcome_body.info2")
	bodyPage.Props["Info3"] = c.T("api.templates.welcome_body.info3")
	bodyPage.Props["SiteURL"] = siteURL

	if *utils.Cfg.NativeAppSettings.AppDownloadLink != "" {
		bodyPage.Props["AppDownloadInfo"] = c.T("api.templates.welcome_body.app_download_info")
		bodyPage.Props["AppDownloadLink"] = *utils.Cfg.NativeAppSettings.AppDownloadLink
	}

	if !verified {
		link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", siteURL, userId, model.HashPassword(userId), url.QueryEscape(email))
		bodyPage.Props["VerifyUrl"] = link
	}

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_welcome_email_and_forget.failed.error"), err)
	}
}

func addDirectChannels(teamId string, user *model.User) {
	var profiles map[string]*model.User
	if result := <-Srv.Store.User().GetProfiles(teamId); result.Err != nil {
		l4g.Error(utils.T("api.user.add_direct_channels_and_forget.failed.error"), user.Id, teamId, result.Err.Error())
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
		l4g.Error(utils.T("api.user.add_direct_channels_and_forget.failed.error"), user.Id, teamId, result.Err.Error())
	}
}

func SendVerifyEmail(c *Context, userId, userEmail, siteURL string) {
	link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", siteURL, userId, model.HashPassword(userId), url.QueryEscape(userEmail))

	url, _ := url.Parse(siteURL)

	subjectPage := utils.NewHTMLTemplate("verify_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.verify_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("verify_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.verify_body.title", map[string]interface{}{"ServerURL": url.Host})
	bodyPage.Props["Info"] = c.T("api.templates.verify_body.info")
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["Button"] = c.T("api.templates.verify_body.button")

	if err := utils.SendMail(userEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_verify_email_and_forget.failed.error"), err)
	}
}

func login(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	loginId := props["login_id"]
	password := props["password"]
	mfaToken := props["token"]
	deviceId := props["device_id"]
	ldapOnly := props["ldap_only"] == "true"

	if len(password) == 0 {
		c.Err = model.NewLocAppError("login", "api.user.login.blank_pwd.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	var user *model.User
	var err *model.AppError

	if len(id) != 0 {
		c.LogAuditWithUserId(id, "attempt")

		if result := <-Srv.Store.User().Get(id); result.Err != nil {
			c.LogAuditWithUserId(user.Id, "failure")
			c.Err = result.Err
			c.Err.StatusCode = http.StatusBadRequest
			return
		} else {
			user = result.Data.(*model.User)
		}
	} else {
		c.LogAudit("attempt")

		if user, err = getUserForLogin(loginId, ldapOnly); err != nil {
			c.LogAudit("failure")
			c.Err = err
			return
		}

		c.LogAuditWithUserId(user.Id, "attempt")
	}

	// and then authenticate them
	if user, err = authenticateUser(user, password, mfaToken); err != nil {
		c.LogAuditWithUserId(user.Id, "failure")
		c.Err = err
		return
	}

	c.LogAuditWithUserId(user.Id, "success")

	doLogin(c, w, r, user, deviceId)

	user.Sanitize(map[string]bool{})

	w.Write([]byte(user.ToJson()))
}

func getUserForLogin(loginId string, onlyLdap bool) (*model.User, *model.AppError) {
	ldapAvailable := *utils.Cfg.LdapSettings.Enable && einterfaces.GetLdapInterface() != nil && utils.IsLicensed && *utils.License.Features.LDAP

	if result := <-Srv.Store.User().GetForLogin(
		loginId,
		*utils.Cfg.EmailSettings.EnableSignInWithUsername && !onlyLdap,
		*utils.Cfg.EmailSettings.EnableSignInWithEmail && !onlyLdap,
		ldapAvailable,
	); result.Err != nil && result.Err.Id == "store.sql_user.get_for_login.multiple_users" {
		// don't fall back to LDAP in this case since we already know there's an LDAP user, but that it shouldn't work
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else if result.Err != nil {
		if !ldapAvailable {
			// failed to find user and no LDAP server to fall back on
			result.Err.StatusCode = http.StatusBadRequest
			return nil, result.Err
		}

		// fall back to LDAP server to see if we can find a user
		if ldapUser, ldapErr := einterfaces.GetLdapInterface().GetUser(loginId); ldapErr != nil {
			ldapErr.StatusCode = http.StatusBadRequest
			return nil, ldapErr
		} else {
			return ldapUser, nil
		}
	} else {
		return result.Data.(*model.User), nil
	}
}

func LoginByOAuth(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.Reader) *model.User {
	buf := bytes.Buffer{}
	buf.ReadFrom(userData)

	authData := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("LoginByOAuth", "api.user.login_by_oauth.not_available.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "")
		return nil
	} else {
		authData = provider.GetAuthDataFromJson(bytes.NewReader(buf.Bytes()))
	}

	if len(authData) == 0 {
		c.Err = model.NewLocAppError("LoginByOAuth", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "")
		return nil
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByAuth(&authData, service); result.Err != nil {
		if result.Err.Id == store.MISSING_AUTH_ACCOUNT_ERROR {
			return CreateOAuthUser(c, w, r, service, bytes.NewReader(buf.Bytes()), "")
		}
		c.Err = result.Err
		return nil
	} else {
		user = result.Data.(*model.User)
		doLogin(c, w, r, user, "")
		return user
	}
}

// User MUST be authenticated completely before calling Login
func doLogin(c *Context, w http.ResponseWriter, r *http.Request, user *model.User, deviceId string) {

	session := &model.Session{UserId: user.Id, Roles: user.Roles, DeviceId: deviceId, IsOAuth: false}

	maxAge := *utils.Cfg.ServiceSettings.SessionLengthWebInDays * 60 * 60 * 24

	if len(deviceId) > 0 {
		session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthMobileInDays)
		maxAge = *utils.Cfg.ServiceSettings.SessionLengthMobileInDays * 60 * 60 * 24

		// A special case where we logout of all other sessions with the same Id
		if result := <-Srv.Store.Session().GetSessions(user.Id); result.Err != nil {
			c.Err = result.Err
			c.Err.StatusCode = http.StatusInternalServerError
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
		c.Err.StatusCode = http.StatusInternalServerError
		return
	} else {
		session = result.Data.(*model.Session)
		AddSessionToCache(session)
	}

	w.Header().Set(model.HEADER_TOKEN, session.Token)

	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAge), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    session.Token,
		Path:     "/",
		MaxAge:   maxAge,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   secure,
	}

	http.SetCookie(w, sessionCookie)

	c.Session = *session
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
		c.Err.StatusCode = http.StatusInternalServerError
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
	c.Session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthMobileInDays)

	maxAge := *utils.Cfg.ServiceSettings.SessionLengthMobileInDays * 60 * 60 * 24

	secure := false
	if GetProtocol(r) == "https" {
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

	if result := <-Srv.Store.Session().UpdateDeviceId(c.Session.Id, deviceId, c.Session.ExpiresAt); result.Err != nil {
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

// IF YOU UPDATE THIS PLEASE UPDATE BELOW
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

// UGH...
// If you update this please update above
func RevokeAllSessionsNoContext(userId string) *model.AppError {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return result.Err
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			if session.IsOAuth {
				RevokeAccessToken(session.Token)
			} else {
				sessionCache.Remove(session.Token)
				if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
					return result.Err
				}
			}
		}
	}
	return nil
}

func getSessions(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["user_id"]

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
	if c.Session.Id != "" {
		RevokeSessionById(c, c.Session.Id)
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
	} else if HandleEtag(result.Data.(*model.User).Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress))
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getInitialLoad(c *Context, w http.ResponseWriter, r *http.Request) {

	il := model.InitialLoad{}

	var cchan store.StoreChannel

	if sessionCache.Len() == 0 {
		// Below is a special case when intializating a new server
		// Lets check to make sure the server is really empty

		cchan = Srv.Store.User().GetTotalUsersCount()
	}

	if len(c.Session.UserId) != 0 {
		uchan := Srv.Store.User().Get(c.Session.UserId)
		pchan := Srv.Store.Preference().GetAll(c.Session.UserId)
		tchan := Srv.Store.Team().GetTeamsByUserId(c.Session.UserId)
		dpchan := Srv.Store.User().GetDirectProfiles(c.Session.UserId)

		il.TeamMembers = c.Session.TeamMembers

		if ru := <-uchan; ru.Err != nil {
			c.Err = ru.Err
			return
		} else {
			il.User = ru.Data.(*model.User)
			il.User.Sanitize(map[string]bool{})
		}

		if rp := <-pchan; rp.Err != nil {
			c.Err = rp.Err
			return
		} else {
			il.Preferences = rp.Data.(model.Preferences)
		}

		if rt := <-tchan; rt.Err != nil {
			c.Err = rt.Err
			return
		} else {
			il.Teams = rt.Data.([]*model.Team)

			for _, team := range il.Teams {
				team.Sanitize()
			}
		}

		if dp := <-dpchan; dp.Err != nil {
			c.Err = dp.Err
			return
		} else {
			profiles := dp.Data.(map[string]*model.User)

			for k, p := range profiles {
				options := utils.Cfg.GetSanitizeOptions()
				options["passwordupdate"] = false

				if c.IsSystemAdmin() {
					options["fullname"] = true
					options["email"] = true
				} else {
					p.ClearNonProfileFields()
				}

				p.Sanitize(options)
				profiles[k] = p
			}

			il.DirectProfiles = profiles
		}
	}

	if cchan != nil {
		if cr := <-cchan; cr.Err != nil {
			c.Err = cr.Err
			return
		} else {
			count := cr.Data.(int64)
			if count <= 0 {
				il.NoAccounts = true
			}
		}
	}

	il.ClientCfg = utils.ClientCfg
	if c.IsSystemAdmin() {
		il.LicenseCfg = utils.ClientLicense
	} else {
		il.LicenseCfg = utils.GetSantizedClientLicense()
	}

	w.Write([]byte(il.ToJson()))
}

func getUser(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["user_id"]

	if !c.HasPermissionsToUser(id, "getUser") {
		return
	}

	if result := <-Srv.Store.User().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.User).Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag(utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress))
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getProfilesForDirectMessageList(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var pchan store.StoreChannel

	if *utils.Cfg.TeamSettings.RestrictDirectMessage == model.DIRECT_MESSAGE_TEAM {
		if c.Session.GetTeamByTeamId(id) == nil {
			if !c.HasSystemAdminPermissions("getProfiles") {
				return
			}
		}

		pchan = Srv.Store.User().GetProfiles(id)
	} else {
		pchan = Srv.Store.User().GetAllProfiles()
	}

	if result := <-pchan; result.Err != nil {
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
			} else {
				p.ClearNonProfileFields()
			}

			p.Sanitize(options)
			profiles[k] = p
		}

		w.Write([]byte(model.UserMapToJson(profiles)))
	}
}

func getProfiles(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if c.Session.GetTeamByTeamId(id) == nil {
		if !c.HasSystemAdminPermissions("getProfiles") {
			return
		}
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
			} else {
				p.ClearNonProfileFields()
			}

			p.Sanitize(options)
			profiles[k] = p
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(model.UserMapToJson(profiles)))
	}
}

func getDirectProfiles(c *Context, w http.ResponseWriter, r *http.Request) {
	etag := (<-Srv.Store.User().GetEtagForDirectProfiles(c.Session.UserId)).Data.(string)
	if HandleEtag(etag, w, r) {
		return
	}

	if result := <-Srv.Store.User().GetDirectProfiles(c.Session.UserId); result.Err != nil {
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
			} else {
				p.ClearNonProfileFields()
			}

			p.Sanitize(options)
			profiles[k] = p
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(model.UserMapToJson(profiles)))
	}
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["user_id"]

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

	fontBytes, err := ioutil.ReadFile(utils.FindDir("fonts") + utils.Cfg.FileSettings.InitialFont)
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
	id := params["user_id"]

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
			path := "/users/" + id + "/profile.png"

			if data, err := ReadFile(path); err != nil {

				if img, err = createProfileImage(result.Data.(*model.User).Username, id); err != nil {
					c.Err = err
					return
				}

				if err := WriteFile(img, path); err != nil {
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

	path := "users/" + c.Session.UserId + "/profile.png"

	if err := WriteFile(buf.Bytes(), path); err != nil {
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

	if err := utils.IsPasswordValid(user.Password); user.Password != "" && err != nil {
		c.Err = err
		return
	}

	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("")

		rusers := result.Data.([2]*model.User)

		if rusers[0].Email != rusers[1].Email {
			go sendEmailChangeEmail(c, rusers[1].Email, rusers[0].Email, c.GetSiteURL())

			if utils.Cfg.EmailSettings.RequireEmailVerification {
				go SendEmailChangeVerifyEmail(c, rusers[0].Id, rusers[0].Email, c.GetSiteURL())
			}
		}

		if rusers[0].Username != rusers[1].Username {
			go sendEmailChangeUsername(c, rusers[1].Username, rusers[0].Username, rusers[0].Email, c.GetSiteURL())
		}

		rusers[0].Password = ""
		rusers[0].AuthData = new(string)
		*rusers[0].AuthData = ""
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

	if err := utils.IsPasswordValid(newPassword); err != nil {
		c.Err = err
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

	if user.AuthData != nil && *user.AuthData != "" {
		c.LogAudit("failed - tried to update user password who was logged in through oauth")
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.oauth.app_error", nil, "auth_service="+user.AuthService)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if err := doubleCheckPassword(user, currentPassword); err != nil {
		if err.Id == "api.user.check_user_password.invalid.app_error" {
			c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.incorrect.app_error", nil, "")
		} else {
			c.Err = err
		}
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if uresult := <-Srv.Store.User().UpdatePassword(c.Session.UserId, model.HashPassword(newPassword)); uresult.Err != nil {
		c.Err = model.NewLocAppError("updatePassword", "api.user.update_password.failed.app_error", nil, uresult.Err.Error())
		return
	} else {
		c.LogAudit("completed")

		go sendPasswordChangeEmail(c, user.Email, c.GetSiteURL(), c.T("api.user.update_password.menu"))

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

	team_id := props["team_id"]

	// Set context TeamId as the team_id in the request cause at this point c.TeamId is empty
	if len(c.TeamId) == 0 {
		c.TeamId = team_id
	}

	if !(len(user_id) == 26 || len(user_id) == 0) {
		c.SetInvalidParam("updateRoles", "team_id")
		return
	}

	new_roles := props["new_roles"]
	if !(model.IsValidUserRoles(new_roles) || model.IsValidTeamRoles(new_roles)) {
		c.SetInvalidParam("updateRoles", "new_roles")
		return
	}

	// If you are not the team admin then you can only demote yourself
	if !c.IsTeamAdmin() && user_id != c.Session.UserId {
		c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.team_admin_needed.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	// Only another system admin can add the system admin role
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

	// only another system admin can remove another system admin
	if model.IsInRole(user.Roles, model.ROLE_SYSTEM_ADMIN) && !c.IsSystemAdmin() {
		c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.system_admin_needed.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	// if the team role has changed then lets update team members
	if model.IsValidTeamRoles(new_roles) && len(team_id) > 0 {

		var members []*model.TeamMember
		if result := <-Srv.Store.Team().GetTeamsForUser(user_id); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			members = result.Data.([]*model.TeamMember)
		}

		var member *model.TeamMember
		for _, m := range members {
			if m.TeamId == team_id {
				member = m
			}
		}

		if member == nil {
			c.SetInvalidParam("updateRoles", "team_id")
			return
		}

		if !c.IsSystemAdmin() {
			currentUserTeamMember := c.Session.GetTeamByTeamId(team_id)

			// Only the system admin can modify other team
			if currentUserTeamMember == nil {
				c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.system_admin_needed.app_error", nil, "")
				c.Err.StatusCode = http.StatusForbidden
				return
			}

			// Only another team admin can make a team admin
			if !currentUserTeamMember.IsTeamAdmin() && model.IsInRole(new_roles, model.ROLE_TEAM_ADMIN) {
				c.Err = model.NewLocAppError("updateRoles", "api.user.update_roles.team_admin_needed.app_error", nil, "")
				c.Err.StatusCode = http.StatusForbidden
				return
			}
		}

		member.Roles = new_roles

		if result := <-Srv.Store.Team().UpdateMember(member); result.Err != nil {
			c.Err = result.Err
			return
		}
	}

	// If the users role has changed then lets update the user
	if model.IsValidUserRoles(new_roles) {
		UpdateUserRoles(c, user, new_roles)
		if c.Err != nil {
			return
		}

		uchan := Srv.Store.Session().UpdateRoles(user.Id, new_roles)

		if result := <-uchan; result.Err != nil {
			// soft error since the user roles were still updated
			l4g.Error(result.Err)
		}
	}

	RemoveAllSessionsForUserId(user_id)

	data := make(map[string]string)
	data["user_id"] = user_id
	w.Write([]byte(model.MapToJson(data)))
}

func UpdateUserRoles(c *Context, user *model.User, roles string) *model.User {

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

	// true when you're trying to de-activate yourself
	isSelfDeactive := !active && user_id == c.Session.UserId

	if !isSelfDeactive && !c.IsSystemAdmin() {
		c.Err = model.NewLocAppError("updateActive", "api.user.update_active.permissions.app_error", nil, "userId="+user_id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if user.IsLDAPUser() {
		c.Err = model.NewLocAppError("updateActive", "api.user.update_active.no_deactivate_ldap.app_error", nil, "userId="+user_id)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if ruser, err := UpdateActive(user, active); err != nil {
		c.Err = err
	} else {
		c.LogAuditWithUserId(ruser.Id, fmt.Sprintf("active=%v", active))
		w.Write([]byte(ruser.ToJson()))
	}
}

func UpdateActive(user *model.User, active bool) (*model.User, *model.AppError) {
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		return nil, result.Err
	} else {
		if user.DeleteAt > 0 {
			RevokeAllSessionsNoContext(user.Id)
		}

		if extra := <-Srv.Store.Channel().ExtraUpdateByUser(user.Id, model.GetMillis()); extra.Err != nil {
			return nil, extra.Err
		}

		ruser := result.Data.([2]*model.User)[0]
		options := utils.Cfg.GetSanitizeOptions()
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		return ruser, nil
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

	if _, err := UpdateActive(user, false); err != nil {
		return err
	}

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

	if result := <-Srv.Store.Team().RemoveAllMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.PasswordRecovery().Delete(user.Id); result.Err != nil {
		return result.Err
	}

	l4g.Warn(utils.T("api.user.permanent_delete_user.deleted.warn"), user.Email, user.Id)
	c.LogAuditWithUserId("", fmt.Sprintf("success userId=%v", user.Id))

	return nil
}

func PermanentDeleteAllUsers(c *Context) *model.AppError {
	if result := <-Srv.Store.User().GetAll(); result.Err != nil {
		return result.Err
	} else {
		users := result.Data.([]*model.User)
		for _, user := range users {
			PermanentDeleteUser(c, user)
		}
	}

	return nil
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("sendPasswordReset", "email")
		return
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.Err = model.NewLocAppError("sendPasswordReset", "api.user.send_password_reset.find.app_error", nil, "email="+email)
		return
	} else {
		user = result.Data.(*model.User)
	}

	if user.AuthData != nil && len(*user.AuthData) != 0 {
		c.Err = model.NewLocAppError("sendPasswordReset", "api.user.send_password_reset.sso.app_error", nil, "userId="+user.Id)
		return
	}

	recovery := &model.PasswordRecovery{}
	recovery.UserId = user.Id

	if result := <-Srv.Store.PasswordRecovery().SaveOrUpdate(recovery); result.Err != nil {
		c.Err = result.Err
		return
	}

	link := fmt.Sprintf("%s/reset_password_complete?code=%s", c.GetSiteURL(), url.QueryEscape(recovery.Code))

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

	code := props["code"]
	if len(code) != model.PASSWORD_RECOVERY_CODE_SIZE {
		c.SetInvalidParam("resetPassword", "code")
		return
	}

	newPassword := props["new_password"]
	if err := utils.IsPasswordValid(newPassword); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	userId := ""

	if result := <-Srv.Store.PasswordRecovery().GetByCode(code); result.Err != nil {
		c.LogAuditWithUserId(userId, "fail - bad code")
		c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.invalid_link.app_error", nil, result.Err.Error())
		return
	} else {
		recovery := result.Data.(*model.PasswordRecovery)

		if model.GetMillis()-recovery.CreateAt < model.PASSWORD_RECOVER_EXPIRY_TIME {
			userId = recovery.UserId
		} else {
			c.LogAuditWithUserId(userId, "fail - link expired")
			c.Err = model.NewLocAppError("resetPassword", "api.user.reset_password.link_expired.app_error", nil, "")
			return
		}

		go func() {
			if result := <-Srv.Store.PasswordRecovery().Delete(userId); result.Err != nil {
				l4g.Error("%v", result.Err)
			}
		}()
	}

	if err := ResetPassword(c, userId, newPassword); err != nil {
		c.Err = err
		return
	}

	c.LogAuditWithUserId(userId, "success")

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ResetPassword(c *Context, userId, newPassword string) *model.AppError {
	var user *model.User
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if user.AuthData != nil && len(*user.AuthData) != 0 && !c.IsSystemAdmin() {
		return model.NewLocAppError("ResetPassword", "api.user.reset_password.sso.app_error", nil, "userId="+user.Id)

	}

	if result := <-Srv.Store.User().UpdatePassword(userId, model.HashPassword(newPassword)); result.Err != nil {
		return result.Err
	}

	go sendPasswordChangeEmail(c, user.Email, c.GetSiteURL(), c.T("api.user.reset_password.method"))

	return nil
}

func sendPasswordChangeEmail(c *Context, email, siteURL, method string) {
	subjectPage := utils.NewHTMLTemplate("password_change_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.password_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "SiteName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("password_change_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.password_change_body.title")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.password_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "TeamURL": siteURL, "Method": method}))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_password_change_email_and_forget.error"), err)
	}
}

func sendEmailChangeEmail(c *Context, oldEmail, newEmail, siteURL string) {
	subjectPage := utils.NewHTMLTemplate("email_change_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.email_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})
	subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

	bodyPage := utils.NewHTMLTemplate("email_change_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.email_change_body.title")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.email_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewEmail": newEmail}))

	if err := utils.SendMail(oldEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_email_change_email_and_forget.error"), err)
	}
}

func SendEmailChangeVerifyEmail(c *Context, userId, newUserEmail, siteURL string) {
	link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", siteURL, userId, model.HashPassword(userId), url.QueryEscape(newUserEmail))

	subjectPage := utils.NewHTMLTemplate("email_change_verify_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.email_change_verify_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})
	subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

	bodyPage := utils.NewHTMLTemplate("email_change_verify_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.email_change_verify_body.title")
	bodyPage.Props["Info"] = c.T("api.templates.email_change_verify_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["VerifyButton"] = c.T("api.templates.email_change_verify_body.button")

	if err := utils.SendMail(newUserEmail, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_email_change_verify_email_and_forget.error"), err)
	}
}

func sendEmailChangeUsername(c *Context, oldUsername, newUsername, email, siteURL string) {
	subjectPage := utils.NewHTMLTemplate("username_change_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.username_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})
	subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

	bodyPage := utils.NewHTMLTemplate("email_change_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.username_change_body.title")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.username_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewUsername": newUsername}))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_email_change_username_and_forget.error"), err)
	}

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

	comments := props["comments"]
	if len(comments) == 0 {
		c.SetInvalidParam("updateUserNotify", "comments")
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

func IsUsernameTaken(name string) bool {

	if !model.IsValidUsername(name) {
		return false
	}

	if result := <-Srv.Store.User().GetByUsername(name); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func emailToOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	password := props["password"]
	if len(password) == 0 {
		c.SetInvalidParam("emailToOAuth", "password")
		return
	}

	service := props["service"]
	if len(service) == 0 {
		c.SetInvalidParam("emailToOAuth", "service")
		return
	}

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("emailToOAuth", "email")
		return
	}

	c.LogAudit("attempt")

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if err := checkPasswordAndAllCriteria(user, password, ""); err != nil {
		c.LogAuditWithUserId(user.Id, "failed - bad authentication")
		c.Err = err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	stateProps["email"] = email

	m := map[string]string{}
	if service == model.USER_AUTH_SERVICE_SAML {
		m["follow_link"] = c.GetSiteURL() + "/login/sso/saml?action=" + model.OAUTH_ACTION_EMAIL_TO_SSO + "&email=" + email
	} else {
		if authUrl, err := GetAuthorizationCode(c, service, stateProps, ""); err != nil {
			c.LogAuditWithUserId(user.Id, "fail - oauth issue")
			c.Err = err
			return
		} else {
			m["follow_link"] = authUrl
		}
	}

	c.LogAuditWithUserId(user.Id, "success")
	w.Write([]byte(model.MapToJson(m)))
}

func oauthToEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	password := props["password"]
	if err := utils.IsPasswordValid(password); err != nil {
		c.Err = err
		return
	}

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("oauthToEmail", "email")
		return
	}

	c.LogAudit("attempt")

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if user.Id != c.Session.UserId {
		c.LogAudit("fail - user ids didn't match")
		c.Err = model.NewLocAppError("oauthToEmail", "api.user.oauth_to_email.context.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if result := <-Srv.Store.User().UpdatePassword(c.Session.UserId, model.HashPassword(password)); result.Err != nil {
		c.LogAudit("fail - database issue")
		c.Err = result.Err
		return
	}

	go sendSignInChangeEmail(c, user.Email, c.GetSiteURL(), c.T("api.templates.signin_change_email.body.method_email"))

	RevokeAllSession(c, c.Session.UserId)
	c.RemoveSessionCookie(w, r)
	if c.Err != nil {
		return
	}

	m := map[string]string{}
	m["follow_link"] = "/login?extra=signin_change"

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(m)))
}

func emailToLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("emailToLdap", "email")
		return
	}

	emailPassword := props["email_password"]
	if len(emailPassword) == 0 {
		c.SetInvalidParam("emailToLdap", "email_password")
		return
	}

	ldapId := props["ldap_id"]
	if len(ldapId) == 0 {
		c.SetInvalidParam("emailToLdap", "ldap_id")
		return
	}

	ldapPassword := props["ldap_password"]
	if len(ldapPassword) == 0 {
		c.SetInvalidParam("emailToLdap", "ldap_password")
		return
	}

	c.LogAudit("attempt")

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if err := checkPasswordAndAllCriteria(user, emailPassword, ""); err != nil {
		c.LogAuditWithUserId(user.Id, "failed - bad authentication")
		c.Err = err
		return
	}

	RevokeAllSession(c, user.Id)
	c.RemoveSessionCookie(w, r)
	if c.Err != nil {
		return
	}

	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil {
		c.Err = model.NewLocAppError("emailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if err := ldapInterface.SwitchToLdap(user.Id, ldapId, ldapPassword); err != nil {
		c.LogAuditWithUserId(user.Id, "fail - ldap switch failed")
		c.Err = err
		return
	}

	go sendSignInChangeEmail(c, user.Email, c.GetSiteURL(), "LDAP")

	m := map[string]string{}
	m["follow_link"] = "/login?extra=signin_change"

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(m)))
}

func ldapToEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("ldapToEmail", "email")
		return
	}

	emailPassword := props["email_password"]
	if err := utils.IsPasswordValid(emailPassword); err != nil {
		c.Err = err
		return
	}

	ldapPassword := props["ldap_password"]
	if len(ldapPassword) == 0 {
		c.SetInvalidParam("ldapToEmail", "ldap_password")
		return
	}

	c.LogAudit("attempt")

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.LogAudit("fail - couldn't get user")
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		c.Err = model.NewLocAppError("ldapToEmail", "api.user.ldap_to_email.not_ldap_account.app_error", nil, "")
		return
	}

	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil || user.AuthData == nil {
		c.Err = model.NewLocAppError("ldapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if err := ldapInterface.CheckPassword(*user.AuthData, ldapPassword); err != nil {
		c.LogAuditWithUserId(user.Id, "fail - ldap authentication failed")
		c.Err = err
		return
	}

	if result := <-Srv.Store.User().UpdatePassword(user.Id, model.HashPassword(emailPassword)); result.Err != nil {
		c.LogAudit("fail - database issue")
		c.Err = result.Err
		return
	}

	RevokeAllSession(c, user.Id)
	c.RemoveSessionCookie(w, r)
	if c.Err != nil {
		return
	}

	go sendSignInChangeEmail(c, user.Email, c.GetSiteURL(), c.T("api.templates.signin_change_email.body.method_email"))

	m := map[string]string{}
	m["follow_link"] = "/login?extra=signin_change"

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(m)))
}

func sendSignInChangeEmail(c *Context, email, siteURL, method string) {
	subjectPage := utils.NewHTMLTemplate("signin_change_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.singin_change_email.subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("signin_change_body", c.Locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = c.T("api.templates.signin_change_email.body.title")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.singin_change_email.body.info",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"], "Method": method}))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.user.send_sign_in_change_email_and_forget.error"), err)
	}
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
	c.Err.StatusCode = http.StatusBadRequest
}

func resendVerification(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("resendVerification", "email")
		return
	}

	if user, error := getUserForLogin(email, false); error != nil {
		c.Err = error
		return
	} else {
		if _, err := GetStatus(user.Id); err != nil {
			go SendEmailChangeVerifyEmail(c, user.Id, user.Email, c.GetSiteURL())
		} else {
			go SendVerifyEmail(c, user.Id, user.Email, c.GetSiteURL())
		}
	}
}

func generateMfaQrCode(c *Context, w http.ResponseWriter, r *http.Request) {
	uchan := Srv.Store.User().Get(c.Session.UserId)

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		c.Err = model.NewLocAppError("generateMfaQrCode", "api.user.generate_mfa_qr.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	img, err := mfaInterface.GenerateQrCode(user)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Write(img)
}

func updateMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)

	activate, ok := props["activate"].(bool)
	if !ok {
		c.SetInvalidParam("updateMfa", "activate")
		return
	}

	token := ""
	if activate {
		token = props["token"].(string)
		if len(token) == 0 {
			c.SetInvalidParam("updateMfa", "token")
			return
		}
	}

	if activate {
		if err := ActivateMfa(c.Session.UserId, token); err != nil {
			c.Err = err
			return
		}
	} else {
		if err := DeactivateMfa(c.Session.UserId); err != nil {
			c.Err = err
			return
		}
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func ActivateMfa(userId, token string) *model.AppError {
	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		err := model.NewLocAppError("ActivateMfa", "api.user.update_mfa.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if len(user.AuthService) > 0 && user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return model.NewLocAppError("ActivateMfa", "api.user.activate_mfa.email_and_ldap_only.app_error", nil, "")
	}

	if err := mfaInterface.Activate(user, token); err != nil {
		return err
	}

	return nil
}

func DeactivateMfa(userId string) *model.AppError {
	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		err := model.NewLocAppError("DeactivateMfa", "api.user.update_mfa.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	if err := mfaInterface.Deactivate(userId); err != nil {
		return err
	}

	return nil
}

func checkMfa(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.IsLicensed || !*utils.License.Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication {
		rdata := map[string]string{}
		rdata["mfa_required"] = "false"
		w.Write([]byte(model.MapToJson(rdata)))
		return
	}

	props := model.MapFromJson(r.Body)

	loginId := props["login_id"]
	if len(loginId) == 0 {
		c.SetInvalidParam("checkMfa", "login_id")
		return
	}

	// we don't need to worry about contacting the ldap server to get this user because
	// only users already in the system could have MFA enabled
	uchan := Srv.Store.User().GetForLogin(
		loginId,
		*utils.Cfg.EmailSettings.EnableSignInWithUsername,
		*utils.Cfg.EmailSettings.EnableSignInWithEmail,
		*utils.Cfg.LdapSettings.Enable,
	)

	rdata := map[string]string{}
	if result := <-uchan; result.Err != nil {
		rdata["mfa_required"] = "false"
	} else {
		rdata["mfa_required"] = strconv.FormatBool(result.Data.(*model.User).MfaActive)
	}
	w.Write([]byte(model.MapToJson(rdata)))
}

func loginWithSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := einterfaces.GetSamlInterface()

	if samlInterface == nil {
		c.Err = model.NewLocAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusFound
		return
	}

	teamId, err := getTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}
	action := r.URL.Query().Get("action")
	redirectTo := r.URL.Query().Get("redirect_to")
	relayProps := map[string]string{}
	relayState := ""

	if len(action) != 0 {
		relayProps["team_id"] = teamId
		relayProps["action"] = action
		if action == model.OAUTH_ACTION_EMAIL_TO_SSO {
			relayProps["email"] = r.URL.Query().Get("email")
		}
	}

	if len(redirectTo) != 0 {
		relayProps["redirect_to"] = redirectTo
	}

	if len(relayProps) > 0 {
		relayState = b64.StdEncoding.EncodeToString([]byte(model.MapToJson(relayProps)))
	}

	if data, err := samlInterface.BuildRequest(relayState); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
		http.Redirect(w, r, data.URL, http.StatusFound)
	}
}

func completeSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := einterfaces.GetSamlInterface()

	if samlInterface == nil {
		c.Err = model.NewLocAppError("completeSaml", "api.user.saml.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusFound
		return
	}

	//Validate that the user is with SAML and all that
	encodedXML := r.FormValue("SAMLResponse")
	relayState := r.FormValue("RelayState")

	relayProps := make(map[string]string)
	if len(relayState) > 0 {
		stateStr := ""
		if b, err := b64.StdEncoding.DecodeString(relayState); err != nil {
			c.Err = model.NewLocAppError("completeSaml", "api.user.authorize_oauth_user.invalid_state.app_error", nil, err.Error())
			c.Err.StatusCode = http.StatusFound
			return
		} else {
			stateStr = string(b)
		}
		relayProps = model.MapFromJson(strings.NewReader(stateStr))
	}

	if user, err := samlInterface.DoLogin(encodedXML, relayProps); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusFound
		return
	} else {
		if err := checkUserAdditionalAuthenticationCriteria(user, ""); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusFound
			return
		}
		action := relayProps["action"]
		switch action {
		case model.OAUTH_ACTION_SIGNUP:
			teamId := relayProps["team_id"]
			if len(teamId) > 0 {
				go addDirectChannels(teamId, user)
			}
			break
		case model.OAUTH_ACTION_EMAIL_TO_SSO:
			RevokeAllSession(c, user.Id)
			go sendSignInChangeEmail(c, user.Email, c.GetSiteURL(), strings.Title(model.USER_AUTH_SERVICE_SAML)+" SSO")
			break
		}
		doLogin(c, w, r, user, "")

		if val, ok := relayProps["redirect_to"]; ok {
			http.Redirect(w, r, c.GetSiteURL()+val, http.StatusFound)
			return
		}
		http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusFound)
	}
}

func userTyping(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var channelId string
	if channelId, ok = req.Data["channel_id"].(string); !ok || len(channelId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	var parentId string
	if parentId, ok = req.Data["parent_id"].(string); !ok {
		parentId = ""
	}

	event := model.NewWebSocketEvent("", channelId, req.Session.UserId, model.WEBSOCKET_EVENT_TYPING)
	event.Add("parent_id", parentId)
	go Publish(event)

	return nil, nil
}
