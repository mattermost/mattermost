// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/tls"
	b64 "encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func InitOAuth() {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	BaseRoutes.OAuth.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/list", ApiUserRequired(getOAuthApps)).Methods("GET")
	BaseRoutes.OAuth.Handle("/app/{client_id}", ApiUserRequired(getOAuthAppInfo)).Methods("GET")
	BaseRoutes.OAuth.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/authorized", ApiUserRequired(getAuthorizedApps)).Methods("GET")
	BaseRoutes.OAuth.Handle("/delete", ApiUserRequired(deleteOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/deauthorize", ApiUserRequired(deauthorizeOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/regen_secret", ApiUserRequired(regenerateOAuthSecret)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/login", AppHandlerIndependent(loginWithOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/signup", AppHandlerIndependent(signupWithOAuth)).Methods("GET")

	BaseRoutes.Root.Handle("/oauth/authorize", AppHandlerTrustRequester(authorizeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/oauth/access_token", ApiAppHandlerTrustRequester(getAccessToken)).Methods("POST")

	// Handle all the old routes, to be later removed
	BaseRoutes.Root.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/signup/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/login/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("registerOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewLocAppError("registerOAuthApp", "api.command.admin_only.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	oauthApp := model.OAuthAppFromJson(r.Body)

	if oauthApp == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	secret := model.NewId()

	oauthApp.ClientSecret = secret
	oauthApp.CreatorId = c.Session.UserId

	if result := <-app.Srv.Store.OAuth().SaveApp(oauthApp); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)

		c.LogAudit("client_id=" + oauthApp.Id)

		w.Write([]byte(oauthApp.ToJson()))
		return
	}

}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("getOAuthAppsByUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewLocAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var ochan store.StoreChannel
	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		ochan = app.Srv.Store.OAuth().GetApps()
	} else {
		c.Err = nil
		ochan = app.Srv.Store.OAuth().GetAppByUser(c.Session.UserId)
	}

	if result := <-ochan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		apps := result.Data.([]*model.OAuthApp)
		w.Write([]byte(model.OAuthAppListToJson(apps)))
	}
}

func getOAuthAppInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("getOAuthAppInfo", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)

	clientId := params["client_id"]

	var oauthApp *model.OAuthApp
	if result := <-app.Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = model.NewLocAppError("getOAuthAppInfo", "api.oauth.allow_oauth.database.app_error", nil, "")
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	oauthApp.Sanitize()
	w.Write([]byte(oauthApp.ToJson()))
}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_response.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_client.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_redirect.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(scope) == 0 {
		scope = model.DEFAULT_SCOPE
	}

	var oauthApp *model.OAuthApp
	if result := <-app.Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.database.app_error", nil, "")
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	if !oauthApp.IsValidRedirectURL(redirectUri) {
		c.LogAudit("fail - redirect_uri did not match registered callback")
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if responseType != model.AUTHCODE_RESPONSE_TYPE {
		responseData["redirect"] = redirectUri + "?error=unsupported_response_type&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	authData := &model.AuthData{UserId: c.Session.UserId, ClientId: clientId, CreateAt: model.GetMillis(), RedirectUri: redirectUri, State: state, Scope: scope}
	authData.Code = model.HashPassword(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, c.Session.UserId))

	// this saves the OAuth2 app as authorized
	authorizedApp := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP,
		Name:     clientId,
		Value:    scope,
	}

	if result := <-app.Srv.Store.Preference().Save(&model.Preferences{authorizedApp}); result.Err != nil {
		responseData["redirect"] = redirectUri + "?error=server_error&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	if result := <-app.Srv.Store.OAuth().SaveAuthData(authData); result.Err != nil {
		responseData["redirect"] = redirectUri + "?error=server_error&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	c.LogAudit("success")

	responseData["redirect"] = redirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State)
	w.Write([]byte(model.MapToJson(responseData)))
}

func getAuthorizedApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("getAuthorizedApps", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	ochan := app.Srv.Store.OAuth().GetAuthorizedApps(c.Session.UserId)
	if result := <-ochan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		apps := result.Data.([]*model.OAuthApp)
		for k, a := range apps {
			a.Sanitize()
			apps[k] = a
		}

		w.Write([]byte(model.OAuthAppListToJson(apps)))
	}
}

func GetAuthData(code string) *model.AuthData {
	if result := <-app.Srv.Store.OAuth().GetAuthData(code); result.Err != nil {
		l4g.Error(utils.T("api.oauth.get_auth_data.find.error"), code)
		return nil
	} else {
		return result.Data.(*model.AuthData)
	}
}

func completeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	code := r.URL.Query().Get("code")
	if len(code) == 0 {
		c.Err = model.NewLocAppError("completeOAuth", "api.oauth.complete_oauth.missing_code.app_error", map[string]interface{}{"service": strings.Title(service)}, "URL: "+r.URL.String())
		return
	}

	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/signup/" + service + "/complete"

	if body, teamId, props, err := AuthorizeOAuthUser(service, code, state, uri); err != nil {
		c.Err = err
		return
	} else {
		defer func() {
			ioutil.ReadAll(body)
			body.Close()
		}()

		action := props["action"]
		switch action {
		case model.OAUTH_ACTION_SIGNUP:
			if user, err := app.CreateOAuthUser(service, body, teamId); err != nil {
				c.Err = err
			} else {
				doLogin(c, w, r, user, "")
			}
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_LOGIN:
			user := LoginByOAuth(c, w, r, service, body)
			if len(teamId) > 0 {
				c.Err = app.AddUserToTeamByTeamId(teamId, user)
			}
			if c.Err == nil {
				if val, ok := props["redirect_to"]; ok {
					http.Redirect(w, r, c.GetSiteURL()+val, http.StatusTemporaryRedirect)
					return
				}
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_EMAIL_TO_SSO:
			CompleteSwitchWithOAuth(c, w, r, service, body, props["email"])
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/login?extra=signin_change", http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_SSO_TO_EMAIL:
			LoginByOAuth(c, w, r, service, body)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/claim?email="+url.QueryEscape(props["email"]), http.StatusTemporaryRedirect)
			}
			break
		default:
			LoginByOAuth(c, w, r, service, body)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		}
	}
}

func authorizeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("authorizeOAuth", "api.oauth.authorize_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientId := r.URL.Query().Get("client_id")
	redirect := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(scope) == 0 {
		scope = model.DEFAULT_SCOPE
	}

	if len(responseType) == 0 || len(clientId) == 0 || len(redirect) == 0 {
		c.Err = model.NewLocAppError("authorizeOAuth", "api.oauth.authorize_oauth.missing.app_error", nil, "")
		return
	}

	var oauthApp *model.OAuthApp
	if result := <-app.Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	// here we should check if the user is logged in
	if len(c.Session.UserId) == 0 {
		http.Redirect(w, r, c.GetSiteURL()+"/login?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		return
	}

	isAuthorized := false
	if result := <-app.Srv.Store.Preference().Get(c.Session.UserId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, clientId); result.Err == nil {
		// when we support scopes we should check if the scopes match
		isAuthorized = true
	}

	// Automatically allow if the app is trusted
	if oauthApp.IsTrusted || isAuthorized {
		closeBody := func(r *http.Response) {
			if r.Body != nil {
				ioutil.ReadAll(r.Body)
				r.Body.Close()
			}
		}

		doAllow := func() (*http.Response, *model.AppError) {
			HttpClient := &http.Client{}
			url := c.GetSiteURL() + "/api/v3/oauth/allow?response_type=" + model.AUTHCODE_RESPONSE_TYPE + "&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirect) + "&scope=" + scope + "&state=" + url.QueryEscape(state)
			rq, _ := http.NewRequest("GET", url, strings.NewReader(""))

			rq.Header.Set(model.HEADER_AUTH, model.HEADER_BEARER+" "+c.Session.Token)

			if rp, err := HttpClient.Do(rq); err != nil {
				return nil, model.NewLocAppError(url, "model.client.connecting.app_error", nil, err.Error())
			} else if rp.StatusCode == 304 {
				return rp, nil
			} else if rp.StatusCode >= 300 {
				defer closeBody(rp)
				return rp, model.AppErrorFromJson(rp.Body)
			} else {
				return rp, nil
			}
		}

		if result, err := doAllow(); err != nil {
			c.Err = err
			return
		} else {
			//defer closeBody(result)
			data := model.MapFromJson(result.Body)
			redirectTo := data["redirect"]
			http.Redirect(w, r, redirectTo, http.StatusFound)
			return
		}
	}

	w.Header().Set("Content-Type", "text/html")

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")
	http.ServeFile(w, r, utils.FindDir(model.CLIENT_DIR)+"root.html")
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	r.ParseForm()

	code := r.FormValue("code")
	refreshToken := r.FormValue("refresh_token")

	grantType := r.FormValue("grant_type")
	switch grantType {
	case model.ACCESS_TOKEN_GRANT_TYPE:
		if len(code) == 0 {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.missing_code.app_error", nil, "")
			return
		}
	case model.REFRESH_TOKEN_GRANT_TYPE:
		if len(refreshToken) == 0 {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.missing_refresh_token.app_error", nil, "")
			return
		}
	default:
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_grant.app_error", nil, "")
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_client_id.app_error", nil, "")
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_client_secret.app_error", nil, "")
		return
	}

	var oauthApp *model.OAuthApp
	achan := app.Srv.Store.OAuth().GetApp(clientId)
	if result := <-achan; result.Err != nil {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "")
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	if oauthApp.ClientSecret != secret {
		c.LogAudit("fail - invalid client credentials")
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "")
		return
	}

	var user *model.User
	var accessData *model.AccessData
	var accessRsp *model.AccessResponse
	if grantType == model.ACCESS_TOKEN_GRANT_TYPE {
		redirectUri := r.FormValue("redirect_uri")
		authData := GetAuthData(code)

		if authData == nil {
			c.LogAudit("fail - invalid auth code")
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "")
			return
		}

		if authData.IsExpired() {
			<-app.Srv.Store.OAuth().RemoveAuthData(authData.Code)
			c.LogAudit("fail - auth code expired")
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "")
			return
		}

		if authData.RedirectUri != redirectUri {
			c.LogAudit("fail - redirect uri provided did not match previous redirect uri")
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.redirect_uri.app_error", nil, "")
			return
		}

		if !model.ComparePassword(code, fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
			c.LogAudit("fail - auth code is invalid")
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "")
			return
		}

		uchan := app.Srv.Store.User().Get(authData.UserId)
		if result := <-uchan; result.Err != nil {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "")
			return
		} else {
			user = result.Data.(*model.User)
		}

		tchan := app.Srv.Store.OAuth().GetPreviousAccessData(user.Id, clientId)
		if result := <-tchan; result.Err != nil {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.internal.app_error", nil, "")
			return
		} else if result.Data != nil {
			accessData := result.Data.(*model.AccessData)
			if accessData.IsExpired() {
				if access, err := newSessionUpdateToken(oauthApp.Name, accessData, user); err != nil {
					c.Err = err
					return
				} else {
					accessRsp = access
				}
			} else {
				//return the same token and no need to create a new session
				accessRsp = &model.AccessResponse{
					AccessToken: accessData.Token,
					TokenType:   model.ACCESS_TOKEN_TYPE,
					ExpiresIn:   int32((accessData.ExpiresAt - model.GetMillis()) / 1000),
				}
			}
		} else {
			// create a new session and return new access token
			var session *model.Session
			if result, err := newSession(oauthApp.Name, user); err != nil {
				c.Err = err
				return
			} else {
				session = result
			}

			accessData = &model.AccessData{ClientId: clientId, UserId: user.Id, Token: session.Token, RefreshToken: model.NewId(), RedirectUri: redirectUri, ExpiresAt: session.ExpiresAt}

			if result := <-app.Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
				l4g.Error(result.Err)
				c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "")
				return
			}

			accessRsp = &model.AccessResponse{
				AccessToken:  session.Token,
				TokenType:    model.ACCESS_TOKEN_TYPE,
				RefreshToken: accessData.RefreshToken,
				ExpiresIn:    int32(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
			}
		}

		<-app.Srv.Store.OAuth().RemoveAuthData(authData.Code)
	} else {
		// when grantType is refresh_token
		if result := <-app.Srv.Store.OAuth().GetAccessDataByRefreshToken(refreshToken); result.Err != nil {
			c.LogAudit("fail - refresh token is invalid")
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.refresh_token.app_error", nil, "")
			return
		} else {
			accessData = result.Data.(*model.AccessData)
		}

		uchan := app.Srv.Store.User().Get(accessData.UserId)
		if result := <-uchan; result.Err != nil {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "")
			return
		} else {
			user = result.Data.(*model.User)
		}

		if access, err := newSessionUpdateToken(oauthApp.Name, accessData, user); err != nil {
			c.Err = err
			return
		} else {
			accessRsp = access
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	c.LogAuditWithUserId(user.Id, "success")

	w.Write([]byte(accessRsp.ToJson()))
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	loginHint := r.URL.Query().Get("login_hint")
	redirectTo := r.URL.Query().Get("redirect_to")

	teamId, err := getTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if len(redirectTo) != 0 {
		stateProps["redirect_to"] = redirectTo
	}

	if authUrl, err := GetAuthorizationCode(c, service, stateProps, loginHint); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func getTeamIdFromQuery(query url.Values) (string, *model.AppError) {
	hash := query.Get("h")
	inviteId := query.Get("id")

	if len(hash) > 0 {
		data := query.Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			return "", model.NewLocAppError("getTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "")
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			return "", model.NewLocAppError("getTeamIdFromQuery", "api.oauth.singup_with_oauth.expired_link.app_error", nil, "")
		}

		return props["id"], nil
	} else if len(inviteId) > 0 {
		if result := <-app.Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
			// soft fail, so we still create user but don't auto-join team
			l4g.Error("%v", result.Err)
		} else {
			return result.Data.(*model.Team).Id, nil
		}
	}

	return "", nil
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	if !utils.Cfg.TeamSettings.EnableUserCreation {
		c.Err = model.NewLocAppError("signupWithOAuth", "api.oauth.singup_with_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	teamId, err := getTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if authUrl, err := GetAuthorizationCode(c, service, stateProps, ""); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func GetAuthorizationCode(c *Context, service string, props map[string]string, loginHint string) (string, *model.AppError) {

	sso := utils.Cfg.GetSSOService(service)
	if sso != nil && !sso.Enable {
		return "", model.NewLocAppError("GetAuthorizationCode", "api.user.get_authorization_code.unsupported.app_error", nil, "service="+service)
	}

	clientId := sso.Id
	endpoint := sso.AuthEndpoint
	scope := sso.Scope

	props["hash"] = model.HashPassword(clientId)
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJson(props)))

	redirectUri := c.GetSiteURL() + "/signup/" + service + "/complete"

	authUrl := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectUri) + "&state=" + url.QueryEscape(state)

	if len(scope) > 0 {
		authUrl += "&scope=" + utils.UrlEncode(scope)
	}

	if len(loginHint) > 0 {
		authUrl += "&login_hint=" + utils.UrlEncode(loginHint)
	}

	return authUrl, nil
}

func AuthorizeOAuthUser(service, code, state, redirectUri string) (io.ReadCloser, string, map[string]string, *model.AppError) {
	sso := utils.Cfg.GetSSOService(service)
	if sso == nil || !sso.Enable {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.unsupported.app_error", nil, "service="+service)
	}

	stateStr := ""
	if b, err := b64.StdEncoding.DecodeString(state); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, err.Error())
	} else {
		stateStr = string(b)
	}

	stateProps := model.MapFromJson(strings.NewReader(stateStr))

	if !model.ComparePassword(stateProps["hash"], sso.Id) {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "")
	}

	teamId := stateProps["team_id"]

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
	var respBody []byte
	if resp, err := client.Do(req); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error())
	} else {
		ar = model.AccessResponseFromJson(resp.Body)
		defer func() {
			ioutil.ReadAll(resp.Body)
			resp.Body.Close()
		}()
		if ar == nil {
			return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, "")
		}
	}

	if strings.ToLower(ar.TokenType) != model.ACCESS_TOKEN_TYPE {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType+", response_body="+string(respBody))
	}

	if len(ar.AccessToken) == 0 {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "")
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)
	req, _ = http.NewRequest("GET", sso.UserApiEndpoint, strings.NewReader(""))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	if resp, err := client.Do(req); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error",
			map[string]interface{}{"Service": service}, err.Error())
	} else {
		return resp.Body, teamId, stateProps, nil
	}

}

func CompleteSwitchWithOAuth(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.ReadCloser, email string) {
	authData := ""
	ssoEmail := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.unavailable.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "")
		return
	} else {
		ssoUser := provider.GetUserFromJson(userData)
		ssoEmail = ssoUser.Email

		if ssoUser.AuthData != nil {
			authData = *ssoUser.AuthData
		}
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
	if result := <-app.Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if err := app.RevokeAllSessions(user.Id); err != nil {
		c.Err = err
		return
	}
	c.LogAuditWithUserId(user.Id, "Revoked all sessions for user")

	if result := <-app.Srv.Store.User().UpdateAuthData(user.Id, service, &authData, ssoEmail, true); result.Err != nil {
		c.Err = result.Err
		return
	}

	go func() {
		if err := app.SendSignInChangeEmail(user.Email, strings.Title(service)+" SSO", user.Locale, c.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	}()
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("deleteOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewLocAppError("deleteOAuthApp", "api.command.admin_only.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteOAuthApp", "id")
		return
	}

	if result := <-app.Srv.Store.OAuth().GetApp(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.OAuthApp).CreatorId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteOAuthApp", "api.oauth.delete.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-app.Srv.Store.OAuth().DeleteApp(id)).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func deauthorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("deleteOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)
	id := params["id"]

	if len(id) == 0 {
		c.SetInvalidParam("deauthorizeOAuthApp", "id")
		return
	}

	// revoke app sessions
	if result := <-app.Srv.Store.OAuth().GetAccessDataByUserForApp(c.Session.UserId, id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		accessData := result.Data.([]*model.AccessData)

		for _, a := range accessData {
			if err := app.RevokeAccessToken(a.Token); err != nil {
				c.Err = err
				return
			}

			if rad := <-app.Srv.Store.OAuth().RemoveAccessData(a.Token); rad.Err != nil {
				c.Err = rad.Err
				return
			}
		}
	}

	// Deauthorize the app
	if err := (<-app.Srv.Store.Preference().Delete(c.Session.UserId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, id)).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func regenerateOAuthSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("registerOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)
	id := params["id"]

	if len(id) == 0 {
		c.SetInvalidParam("regenerateOAuthSecret", "id")
		return
	}

	var oauthApp *model.OAuthApp
	if result := <-app.Srv.Store.OAuth().GetApp(id); result.Err != nil {
		c.Err = model.NewLocAppError("regenerateOAuthSecret", "api.oauth.allow_oauth.database.app_error", nil, "")
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)

		if oauthApp.CreatorId != c.Session.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
			c.Err = model.NewLocAppError("registerOAuthApp", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		oauthApp.ClientSecret = model.NewId()
		if update := <-app.Srv.Store.OAuth().UpdateApp(oauthApp); update.Err != nil {
			c.Err = update.Err
			return
		}

		w.Write([]byte(oauthApp.ToJson()))
		return
	}
}

func newSession(appName string, user *model.User) (*model.Session, *model.AppError) {
	// set new token an session
	session := &model.Session{UserId: user.Id, Roles: user.Roles, IsOAuth: true}
	session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays)
	session.AddProp(model.SESSION_PROP_PLATFORM, appName)
	session.AddProp(model.SESSION_PROP_OS, "OAuth2")
	session.AddProp(model.SESSION_PROP_BROWSER, "OAuth2")

	if result := <-app.Srv.Store.Session().Save(session); result.Err != nil {
		return nil, model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.internal_session.app_error", nil, "")
	} else {
		session = result.Data.(*model.Session)
		app.AddSessionToCache(session)
	}

	return session, nil
}

func newSessionUpdateToken(appName string, accessData *model.AccessData, user *model.User) (*model.AccessResponse, *model.AppError) {
	var session *model.Session
	<-app.Srv.Store.Session().Remove(accessData.Token) //remove the previous session

	if result, err := newSession(appName, user); err != nil {
		return nil, err
	} else {
		session = result
	}

	accessData.Token = session.Token
	accessData.ExpiresAt = session.ExpiresAt
	if result := <-app.Srv.Store.OAuth().UpdateAccessData(accessData); result.Err != nil {
		l4g.Error(result.Err)
		return nil, model.NewLocAppError("getAccessToken", "web.get_access_token.internal_saving.app_error", nil, "")
	}
	accessRsp := &model.AccessResponse{
		AccessToken: session.Token,
		TokenType:   model.ACCESS_TOKEN_TYPE,
		ExpiresIn:   int32(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
	}

	return accessRsp, nil
}
