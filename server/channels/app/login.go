// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/avct/uasurfer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const cwsTokenEnv = "CWS_CLOUD_TOKEN"

func (a *App) CheckForClientSideCert(r *http.Request) (string, string, string) {
	pem := r.Header.Get("X-SSL-Client-Cert")                // mapped to $ssl_client_cert from nginx
	subject := r.Header.Get("X-SSL-Client-Cert-Subject-DN") // mapped to $ssl_client_s_dn from nginx
	email := ""

	if subject != "" {
		for _, v := range strings.Split(subject, "/") {
			kv := strings.Split(v, "=")
			if len(kv) == 2 && kv[0] == "emailAddress" {
				email = kv[1]
			}
		}
	}

	return pem, subject, email
}

func (a *App) AuthenticateUserForLogin(c request.CTX, id, loginId, password, mfaToken, cwsToken string, ldapOnly bool) (user *model.User, err *model.AppError) {
	// Do statistics
	defer func() {
		if a.Metrics() != nil {
			if user == nil || err != nil {
				a.Metrics().IncrementLoginFail()
			} else {
				a.Metrics().IncrementLogin()
			}
		}
	}()

	if password == "" && !isCWSLogin(a, cwsToken) {
		return nil, model.NewAppError("AuthenticateUserForLogin", "api.user.login.blank_pwd.app_error", nil, "", http.StatusBadRequest)
	}

	// Get the MM user we are trying to login
	if user, err = a.GetUserForLogin(c, id, loginId); err != nil {
		return nil, err
	}

	// CWS login allow to use the one-time token to login the users when they're redirected to their
	// installation for the first time
	if isCWSLogin(a, cwsToken) {
		if err = checkUserNotBot(user); err != nil {
			return nil, err
		}
		token, err := a.Srv().Store().Token().GetByToken(cwsToken)
		if nfErr := new(store.ErrNotFound); err != nil && !errors.As(err, &nfErr) {
			c.Logger().Debug("Error retrieving the cws token from the store", mlog.Err(err))
			return nil, model.NewAppError("AuthenticateUserForLogin",
				"api.user.login_by_cws.invalid_token.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		// If token is stored in the database that means it was used
		if token != nil {
			return nil, model.NewAppError("AuthenticateUserForLogin",
				"api.user.login_by_cws.invalid_token.app_error", nil, "", http.StatusBadRequest)
		}
		envToken, ok := os.LookupEnv(cwsTokenEnv)
		if ok && subtle.ConstantTimeCompare([]byte(envToken), []byte(cwsToken)) == 1 {
			token = &model.Token{
				Token:    cwsToken,
				CreateAt: model.GetMillis(),
				Type:     TokenTypeCWSAccess,
			}
			err := a.Srv().Store().Token().Save(token)
			if err != nil {
				c.Logger().Debug("Error storing the cws token in the store", mlog.Err(err))
				return nil, model.NewAppError("AuthenticateUserForLogin",
					"api.user.login_by_cws.invalid_token.app_error", nil, "", http.StatusInternalServerError)
			}
			return user, nil
		}
		return nil, model.NewAppError("AuthenticateUserForLogin",
			"api.user.login_by_cws.invalid_token.app_error", nil, "", http.StatusBadRequest)
	}

	// If client side cert is enable and it's checking as a primary source
	// then trust the proxy and cert that the correct user is supplied and allow
	// them access
	if *a.Config().ExperimentalSettings.ClientSideCertEnable && *a.Config().ExperimentalSettings.ClientSideCertCheck == model.ClientSideCertCheckPrimaryAuth {
		// Unless the user is a bot.
		if err = checkUserNotBot(user); err != nil {
			return nil, err
		}

		return user, nil
	}

	// and then authenticate them
	if user, err = a.authenticateUser(c, user, password, mfaToken); err != nil {
		return nil, err
	}

	return user, nil
}

func (a *App) GetUserForLogin(c request.CTX, id, loginId string) (*model.User, *model.AppError) {
	enableUsername := *a.Config().EmailSettings.EnableSignInWithUsername
	enableEmail := *a.Config().EmailSettings.EnableSignInWithEmail

	// If we are given a userID then fail if we can't find a user with that ID
	if id != "" {
		user, err := a.GetUser(id)
		if err != nil {
			if err.Id != MissingAccountError {
				err.StatusCode = http.StatusInternalServerError
				return nil, err
			}
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}
		return user, nil
	}

	// Try to get the user by username/email
	if user, err := a.Srv().Store().User().GetForLogin(loginId, enableUsername, enableEmail); err == nil {
		return user, nil
	}

	// Try to get the user with LDAP if enabled
	if *a.Config().LdapSettings.Enable && a.Ldap() != nil {
		if ldapUser, err := a.Ldap().GetUser(c, loginId); err == nil {
			if user, err := a.GetUserByAuth(ldapUser.AuthData, model.UserAuthServiceLdap); err == nil {
				return user, nil
			}
			return ldapUser, nil
		}
	}

	return nil, model.NewAppError("GetUserForLogin", "store.sql_user.get_for_login.app_error", nil, "", http.StatusBadRequest)
}

func (a *App) DoLogin(c request.CTX, w http.ResponseWriter, r *http.Request, user *model.User, deviceID string, isMobile, isOAuthUser, isSaml bool) (*model.Session, *model.AppError) {
	var rejectionReason string
	pluginContext := pluginContext(c)
	a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		rejectionReason = hooks.UserWillLogIn(pluginContext, user)
		return rejectionReason == ""
	}, plugin.UserWillLogInID)

	if rejectionReason != "" {
		return nil, model.NewAppError("DoLogin", "Login rejected by plugin: "+rejectionReason, nil, "", http.StatusBadRequest)
	}

	session := &model.Session{UserId: user.Id, Roles: user.GetRawRoles(), DeviceId: deviceID, IsOAuth: false, Props: map[string]string{
		model.UserAuthServiceIsMobile: strconv.FormatBool(isMobile),
		model.UserAuthServiceIsSaml:   strconv.FormatBool(isSaml),
		model.UserAuthServiceIsOAuth:  strconv.FormatBool(isOAuthUser),
	}}
	session.GenerateCSRF()

	if deviceID != "" {
		a.ch.srv.platform.SetSessionExpireInHours(session, *a.Config().ServiceSettings.SessionLengthMobileInHours)

		// A special case where we logout of all other sessions with the same Id
		if err := a.RevokeSessionsForDeviceId(c, user.Id, deviceID, ""); err != nil {
			err.StatusCode = http.StatusInternalServerError
			return nil, err
		}
	} else if isMobile {
		a.ch.srv.platform.SetSessionExpireInHours(session, *a.Config().ServiceSettings.SessionLengthMobileInHours)
	} else if isOAuthUser || isSaml {
		a.ch.srv.platform.SetSessionExpireInHours(session, *a.Config().ServiceSettings.SessionLengthSSOInHours)
	} else {
		a.ch.srv.platform.SetSessionExpireInHours(session, *a.Config().ServiceSettings.SessionLengthWebInHours)
	}

	ua := uasurfer.Parse(r.UserAgent())

	plat := getPlatformName(ua, r.UserAgent())
	os := getOSName(ua, r.UserAgent())
	bname := getBrowserName(ua, r.UserAgent())
	bversion := getBrowserVersion(ua, r.UserAgent())

	session.AddProp(model.SessionPropPlatform, plat)
	session.AddProp(model.SessionPropOs, os)
	session.AddProp(model.SessionPropBrowser, fmt.Sprintf("%v/%v", bname, bversion))
	if user.IsGuest() {
		session.AddProp(model.SessionPropIsGuest, "true")
	} else {
		session.AddProp(model.SessionPropIsGuest, "false")
	}

	var err *model.AppError
	if session, err = a.CreateSession(c, session); err != nil {
		err.StatusCode = http.StatusInternalServerError
		return nil, err
	}

	if updateErr := a.Srv().Store().User().UpdateLastLogin(user.Id, session.CreateAt); updateErr != nil {
		return nil, model.NewAppError("DoLogin", "app.login.doLogin.updateLastLogin.error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	w.Header().Set(model.HeaderToken, session.Token)

	c = c.WithSession(session)

	if a.Srv().License() != nil && *a.Srv().License().Features.LDAP && a.Ldap() != nil {
		userVal := *user
		sessionVal := *session
		a.Srv().Go(func() {
			a.Ldap().UpdateProfilePictureIfNecessary(c, userVal, sessionVal)
		})
	}

	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			hooks.UserHasLoggedIn(pluginContext, user)
			return true
		}, plugin.UserHasLoggedInID)
	})

	return session, nil
}

func (a *App) AttachCloudSessionCookie(c request.CTX, w http.ResponseWriter, r *http.Request) {
	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	maxAgeSeconds := *a.Config().ServiceSettings.SessionLengthWebInHours * 60 * 60
	subpath, _ := utils.GetSubpathFromConfig(a.Config())
	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAgeSeconds), 0)

	domain := ""
	if siteURL, err := url.Parse(a.GetSiteURL()); err == nil {
		domain = siteURL.Hostname()
	}

	if domain == "" {
		return
	}

	var workspaceName string
	if strings.Contains(domain, "localhost") {
		workspaceName = "localhost"
	} else {
		// ensure we have a format for a cloud workspace url i.e. example.cloud.mattermost.com
		if len(strings.Split(domain, ".")) != 4 {
			return
		}
		workspaceName = strings.SplitN(domain, ".", 2)[0]
		domain = strings.SplitN(domain, ".", 3)[2]
		domain = "." + domain
	}

	cookie := &http.Cookie{
		Name:    model.SessionCookieCloudUrl,
		Value:   workspaceName,
		Path:    subpath,
		MaxAge:  maxAgeSeconds,
		Expires: expiresAt,
		Domain:  domain,
		Secure:  secure,
	}

	http.SetCookie(w, cookie)
}

func (a *App) AttachSessionCookies(c request.CTX, w http.ResponseWriter, r *http.Request) {
	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	maxAgeSeconds := *a.Config().ServiceSettings.SessionLengthWebInHours * 60 * 60
	domain := a.GetCookieDomain()
	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	expiresAt := time.Unix(model.GetMillis()/1000+int64(maxAgeSeconds), 0)
	sessionCookie := &http.Cookie{
		Name:     model.SessionCookieToken,
		Value:    c.Session().Token,
		Path:     subpath,
		MaxAge:   maxAgeSeconds,
		Expires:  expiresAt,
		HttpOnly: true,
		Domain:   domain,
		Secure:   secure,
	}

	userCookie := &http.Cookie{
		Name:    model.SessionCookieUser,
		Value:   c.Session().UserId,
		Path:    subpath,
		MaxAge:  maxAgeSeconds,
		Expires: expiresAt,
		Domain:  domain,
		Secure:  secure,
	}

	csrfCookie := &http.Cookie{
		Name:    model.SessionCookieCsrf,
		Value:   c.Session().GetCSRF(),
		Path:    subpath,
		MaxAge:  maxAgeSeconds,
		Expires: expiresAt,
		Domain:  domain,
		Secure:  secure,
	}

	if secure && utils.CheckEmbeddedCookie(r) {
		sessionCookie.SameSite = http.SameSiteNoneMode
		userCookie.SameSite = http.SameSiteNoneMode
		csrfCookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(w, sessionCookie)
	http.SetCookie(w, userCookie)
	http.SetCookie(w, csrfCookie)

	// For context see: https://mattermost.atlassian.net/browse/MM-39583
	if a.License().IsCloud() {
		a.AttachCloudSessionCookie(c, w, r)
	}
}

func GetProtocol(r *http.Request) string {
	if r.Header.Get(model.HeaderForwardedProto) == "https" || r.TLS != nil {
		return "https"
	}
	return "http"
}

func isCWSLogin(a *App, token string) bool {
	return a.License().IsCloud() && token != ""
}
