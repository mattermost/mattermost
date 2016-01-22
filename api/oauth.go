// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"net/url"
)

func InitOAuth(r *mux.Router) {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	sr := r.PathPrefix("/oauth").Subrouter()

	sr.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	sr.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("registerOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	app := model.OAuthAppFromJson(r.Body)

	if app == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	secret := model.NewId()

	app.ClientSecret = secret
	app.CreatorId = c.Session.UserId

	if result := <-Srv.Store.OAuth().SaveApp(app); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
		app.ClientSecret = secret

		c.LogAudit("client_id=" + app.Id)

		w.Write([]byte(app.ToJson()))
		return
	}

}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_response.app_error", nil, "")
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_client.app_error", nil, "")
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_redirect.app_error", nil, "")
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	var app *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.database.app_error", nil, "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !app.IsValidRedirectURL(redirectUri) {
		c.LogAudit("fail - redirect_uri did not match registered callback")
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "")
		return
	}

	if responseType != model.AUTHCODE_RESPONSE_TYPE {
		responseData["redirect"] = redirectUri + "?error=unsupported_response_type&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	authData := &model.AuthData{UserId: c.Session.UserId, ClientId: clientId, CreateAt: model.GetMillis(), RedirectUri: redirectUri, State: state, Scope: scope}
	authData.Code = model.HashPassword(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, c.Session.UserId))

	if result := <-Srv.Store.OAuth().SaveAuthData(authData); result.Err != nil {
		responseData["redirect"] = redirectUri + "?error=server_error&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	c.LogAudit("success")

	responseData["redirect"] = redirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State)

	w.Write([]byte(model.MapToJson(responseData)))
}

func RevokeAccessToken(token string) *model.AppError {

	schan := Srv.Store.Session().Remove(token)
	sessionCache.Remove(token)

	var accessData *model.AccessData
	if result := <-Srv.Store.OAuth().GetAccessData(token); result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "")
	} else {
		accessData = result.Data.(*model.AccessData)
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token)
	cchan := Srv.Store.OAuth().RemoveAuthData(accessData.AuthCode)

	if result := <-tchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "")
	}

	if result := <-cchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_code.app_error", nil, "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "")
	}

	return nil
}

func GetAuthData(code string) *model.AuthData {
	if result := <-Srv.Store.OAuth().GetAuthData(code); result.Err != nil {
		l4g.Error(utils.T("api.oauth.get_auth_data.find.error"), code)
		return nil
	} else {
		return result.Data.(*model.AuthData)
	}
}
