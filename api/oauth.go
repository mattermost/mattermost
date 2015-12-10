// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/i18n"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"net/http"
	"net/url"
)

func InitOAuth(r *mux.Router) {
	l4g.Debug(T("Initializing oauth api routes"))

	sr := r.PathPrefix("/oauth").Subrouter()

	sr.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	sr.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("registerOAuthApp", T("The system admin has turned off OAuth service providing."), "")
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

	if result := <-Srv.Store.OAuth().SaveApp(app, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
		app.ClientSecret = secret

		c.LogAudit("client_id=" + app.Id, T)

		w.Write([]byte(app.ToJson()))
		return
	}

}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("allowOAuth", T("The system admin has turned off OAuth service providing."), "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt", T)

	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewAppError("allowOAuth", T("invalid_request: Bad response_type"), "")
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("allowOAuth", T("invalid_request: Bad client_id"), "")
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewAppError("allowOAuth", T("invalid_request: Missing or bad redirect_uri"), "")
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	var app *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId, T); result.Err != nil {
		c.Err = model.NewAppError("allowOAuth", T("server_error: Error accessing the database"), "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !app.IsValidRedirectURL(redirectUri) {
		c.LogAudit(T("fail - redirect_uri did not match registered callback"), T)
		c.Err = model.NewAppError("allowOAuth", T("invalid_request: Supplied redirect_uri did not match registered callback_url"), "")
		return
	}

	if responseType != model.AUTHCODE_RESPONSE_TYPE {
		responseData["redirect"] = redirectUri + "?error=unsupported_response_type&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	authData := &model.AuthData{UserId: c.Session.UserId, ClientId: clientId, CreateAt: model.GetMillis(), RedirectUri: redirectUri, State: state, Scope: scope}
	authData.Code = model.HashPassword(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, c.Session.UserId))

	if result := <-Srv.Store.OAuth().SaveAuthData(authData, T); result.Err != nil {
		responseData["redirect"] = redirectUri + "?error=server_error&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	c.LogAudit("success", T)

	responseData["redirect"] = redirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State)

	w.Write([]byte(model.MapToJson(responseData)))
}

func RevokeAccessToken(token string, T goi18n.TranslateFunc) *model.AppError {

	schan := Srv.Store.Session().Remove(token, T)
	sessionCache.Remove(token)

	var accessData *model.AccessData
	if result := <-Srv.Store.OAuth().GetAccessData(token, T); result.Err != nil {
		return model.NewAppError("RevokeAccessToken", T("Error getting access token from DB before deletion"), "")
	} else {
		accessData = result.Data.(*model.AccessData)
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token, T)
	cchan := Srv.Store.OAuth().RemoveAuthData(accessData.AuthCode, T)

	if result := <-tchan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", T("Error deleting access token from DB"), "")
	}

	if result := <-cchan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", T("Error deleting authorization code from DB"), "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", T("Error deleting session from DB"), "")
	}

	return nil
}

func GetAuthData(code string, T goi18n.TranslateFunc) *model.AuthData {
	if result := <-Srv.Store.OAuth().GetAuthData(code, T); result.Err != nil {
		l4g.Error(T("Couldn't find auth code for code=%s"), code)
		return nil
	} else {
		return result.Data.(*model.AuthData)
	}
}
