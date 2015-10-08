// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"net/url"
)

func InitOAuth(r *mux.Router) {
	l4g.Debug("Initializing oauth api routes")

	sr := r.PathPrefix("/oauth").Subrouter()

	sr.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	sr.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("registerOAuthApp", "The system admin has turned off OAuth service providing.", "")
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
		c.Err = model.NewAppError("allowOAuth", "The system admin has turned off OAuth service providing.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewAppError("allowOAuth", "invalid_request: Bad response_type", "")
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("allowOAuth", "invalid_request: Bad client_id", "")
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewAppError("allowOAuth", "invalid_request: Missing or bad redirect_uri", "")
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	var app *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = model.NewAppError("allowOAuth", "server_error: Error accessing the database", "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !app.IsValidRedirectURL(redirectUri) {
		c.LogAudit("fail - redirect_uri did not match registered callback")
		c.Err = model.NewAppError("allowOAuth", "invalid_request: Supplied redirect_uri did not match registered callback_url", "")
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
		return model.NewAppError("RevokeAccessToken", "Error getting access token from DB before deletion", "")
	} else {
		accessData = result.Data.(*model.AccessData)
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token)
	cchan := Srv.Store.OAuth().RemoveAuthData(accessData.AuthCode)

	if result := <-tchan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", "Error deleting access token from DB", "")
	}

	if result := <-cchan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", "Error deleting authorization code from DB", "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewAppError("RevokeAccessToken", "Error deleting session from DB", "")
	}

	return nil
}

func GetAuthData(code string) *model.AuthData {
	if result := <-Srv.Store.OAuth().GetAuthData(code); result.Err != nil {
		l4g.Error("Couldn't find auth code for code=%s", code)
		return nil
	} else {
		return result.Data.(*model.AuthData)
	}
}
