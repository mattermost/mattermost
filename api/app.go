// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

func InitApp(r *mux.Router) {
	l4g.Debug("Initializing user api routes")

	sr := r.PathPrefix("/apps").Subrouter()

	sr.Handle("/oauth2/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	sr.Handle("/oauth2/allow", ApiUserRequired(allowOAuth)).Methods("GET")
	sr.Handle("/oauth2/access_token", ApiAppHandler(getAccessToken)).Methods("POST")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	app := model.AppFromJson(r.Body)

	if app == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	secret := model.NewId()

	app.ClientSecret = secret
	app.CreatorId = c.Session.UserId

	if result := <-Srv.Store.App().Save(app); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.App)
		app.ClientSecret = secret

		w.Write([]byte(app.ToJson()))
		return
	}

}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.SetInvalidParam("allowOAuth", "response_type")
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.SetInvalidParam("allowOAuth", "client_id")
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")

	state := r.URL.Query().Get("state")
	if len(state) == 0 {
		c.SetInvalidParam("allowOAuth", "state")
		return
	}

	var app *model.App
	if result := <-Srv.Store.App().Get(clientId); result.Err != nil {
		c.Err = model.NewAppError("allowOAuth", "We encountered an error retrieving the app", "client_id="+clientId)
		return
	} else {
		app = result.Data.(*model.App)
	}

	callback := app.CallbackUrl

	if len(redirectUri) > 0 {
		registeredUrl, _ := url.Parse(app.CallbackUrl)
		redirectUrl, _ := url.Parse(redirectUri)

		if redirectUrl.Scheme != "https" {
			c.Err = model.NewAppError("allowOAuth", "Supplied redirect_uri must be https", "redirect_uri="+redirectUri+", client_id="+clientId)
			return
		}

		if registeredUrl.Host != redirectUrl.Host {
			c.Err = model.NewAppError("allowOAuth", "Supplied redirect_uri host/port did not match registered callback_url", "redirect_uri="+redirectUri+", client_id="+clientId)
			return
		}

		callback = redirectUri
	}

	if responseType != "code" {
		responseData["redirect"] = callback + "?error=unsupported_response_type&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	authData := &model.AuthData{UserId: c.Session.UserId, ClientId: clientId, CreateAt: model.GetMillis(), RedirectUri: redirectUri, State: state, Scope: scope}
	authData.Code = model.HashPassword(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, c.Session.UserId))

	if result := <-Srv.Store.AuthData().Save(authData); result.Err != nil {
		c.Err = model.NewAppError("allowOAuth", "Couldn't save the authorization code.", "client_id="+clientId)
		return
	}

	authCodeCache.Add(authData.Code, authData)

	responseData["redirect"] = callback + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State)

	w.Write([]byte(model.MapToJson(responseData)))
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	grantType := props["grant_type"]
	if grantType != model.ACCESS_TOKEN_GRANT_TYPE {
		c.Err = model.NewAppError("getAccessToken", "invalid_request", "Bad grant_type")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	clientId := props["client_id"]
	if len(clientId) != 26 {
		c.SetInvalidParam("getAccessToken", "client_id")
		return
	}

	secret := props["client_secret"]
	if len(secret) == 0 {
		c.SetInvalidParam("getAccessToken", "client_secret")
		return
	}

	code := props["code"]
	if len(code) == 0 {
		c.SetInvalidParam("getAccessToken", "code")
		return
	}

	redirectUri := props["redirect_uri"]

	achan := Srv.Store.App().Get(clientId)
	tchan := Srv.Store.AccessData().GetByAuthCode(code)

	var authData *model.AuthData
	if ad, ok := authCodeCache.Get(code); ok {
		authData = ad.(*model.AuthData)
	}

	if authData == nil {
		if result := <-Srv.Store.AuthData().Get(code); result.Err != nil {
			c.Err = model.NewAppError("getAccessToken", "invalid_grant", "Invalid or expired authorization code")
			c.Err.StatusCode = http.StatusBadRequest
			return
		} else {
			authData = result.Data.(*model.AuthData)
		}
	}

	if authData == nil || authData.IsExpired() {
		c.Err = model.NewAppError("getAccessToken", "invalid_grant", "Invalid or expired authorization code")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if authData.RedirectUri != redirectUri {
		c.Err = model.NewAppError("getAccessToken", "invalid_request", "Supplied redirect_uri does not match authorization code redirect_uri")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if !model.ComparePassword(code, fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
		c.Err = model.NewAppError("getAccessToken", "invalid_grant", "Invalid or expired authorization code")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	var app *model.App
	if result := <-achan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "invalid_client", "Invalid client credentials")
		return
	} else {
		app = result.Data.(*model.App)
	}

	if !model.ComparePassword(app.ClientSecret, secret) {
		c.Err = model.NewAppError("getAccessToken", "invalid_client", "Invalid client credentials")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	callback := redirectUri
	if len(callback) == 0 {
		callback = app.CallbackUrl
	}

	if result := <-tchan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "server_error", "Encountered internal server error while accessing database")
		c.Err.StatusCode = http.StatusBadRequest
		return
	} else if result.Data != nil {
		accessData := result.Data.(*model.AccessData)
		token, _ := model.AesDecrypt(utils.Cfg.ServiceSettings.AesKey, accessData.Token)

		// Revoke access token, related auth code, and session from DB as well as from cache
		if err := RevokeAccessToken(token); err != nil {
			l4g.Error("Encountered an error revoking an access token, err=" + err.Message)
		}

		c.Err = model.NewAppError("getAccessToken", "invalid_grant", "Authorization code already exchanged for an access token")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	accessToken := model.NewId()
	refreshToken := model.NewId()

	accessData := &model.AccessData{AuthCode: authData.Code, UserId: authData.UserId, Token: accessToken, RefreshToken: refreshToken, RedirectUri: callback, Scope: authData.Scope}

	var savedData *model.AccessData
	if result := <-Srv.Store.AccessData().Save(accessData); result.Err != nil {
		l4g.Error(result.Err)
		c.Err = model.NewAppError("getAccessToken", "server_error", "Encountered internal server error while accessing database")
		c.Err.StatusCode = http.StatusBadRequest
		return
	} else {
		savedData = result.Data.(*model.AccessData)
	}

	accessTokenCache.Add(accessToken, accessData)

	accessRsp := &model.AccessResponse{AccessToken: accessToken, TokenType: model.ACCESS_TOKEN_TYPE, ExpiresIn: savedData.ExpiresIn, Scope: savedData.Scope, RefreshToken: refreshToken}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	w.Write([]byte(accessRsp.ToJson()))
}

func GetAccessData(token string) *model.AccessData {
	var accessData *model.AccessData
	if ad, ok := accessTokenCache.Get(token); ok {
		accessData = ad.(*model.AccessData)
	}

	if accessData == nil {
		if result := <-Srv.Store.AccessData().Get(token); result.Err != nil {
			l4g.Error("Encountered an error getting the access token data, err=" + result.Err.Message)
			return nil
		} else {
			accessData = result.Data.(*model.AccessData)
		}
	}

	return accessData
}

func RevokeAccessToken(token string) *model.AppError {
	accessData := GetAccessData(token)

	if accessData == nil {
		return model.NewAppError("RevokeAccessToken", "Could not find token to revoke", "")
	}

	tchan := Srv.Store.AccessData().Remove(token)
	cchan := Srv.Store.AuthData().Remove(accessData.AuthCode)
	schan := Srv.Store.Session().RemoveByAccessToken(token)

	accessTokenCache.Remove(token)
	sessionCache.Remove(token)
	authCodeCache.Remove(accessData.AuthCode)

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
