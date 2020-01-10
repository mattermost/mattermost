// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/base64"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAuthComplete_AccessDenied(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	c := &Context{
		App: th.App,
		Params: &Params{
			Service: "TestService",
		},
	}
	responseWriter := httptest.NewRecorder()
	request, _ := http.NewRequest(http.MethodGet, th.App.GetSiteURL()+"/signup/TestService/complete?error=access_denied", nil)

	completeOAuth(c, responseWriter, request)

	response := responseWriter.Result()

	assert.Equal(t, http.StatusTemporaryRedirect, response.StatusCode)

	location, _ := url.Parse(response.Header.Get("Location"))
	assert.Equal(t, "oauth_access_denied", location.Query().Get("type"))
	assert.Equal(t, "TestService", location.Query().Get("service"))
}

func TestAuthorizeOAuthApp(t *testing.T) {
	th := Setup().InitBasic()
	th.Login(ApiClient, th.SystemAdminUser)
	defer th.TearDown()

	enableOAuth := *th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         GenerateTestAppName(),
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
		CreatorId:    th.SystemAdminUser.Id,
	}

	rapp, appErr := th.App.CreateOAuthApp(oapp)
	require.Nil(t, appErr)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	// Test auth code flow
	ruri, resp := ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)

	require.NotEmpty(t, ruri, "redirect url should be set")

	ru, _ := url.Parse(ruri)
	require.NotNil(t, ru, "redirect url unparseable")
	require.NotEmpty(t, ru.Query().Get("code"), "authorization code not returned")
	require.Equal(t, ru.Query().Get("state"), authRequest.State, "returned state doesn't match")

	// Test implicit flow
	authRequest.ResponseType = model.IMPLICIT_RESPONSE_TYPE
	ruri, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	require.False(t, len(ruri) == 0, "redirect url should be set")

	ru, _ = url.Parse(ruri)
	require.NotNil(t, ru, "redirect url unparseable")
	values, err := url.ParseQuery(ru.Fragment)
	require.Nil(t, err)
	assert.False(t, len(values.Get("access_token")) == 0, "access_token not returned")
	assert.Equal(t, authRequest.State, values.Get("state"), "returned state doesn't match")

	oldToken := ApiClient.AuthToken
	ApiClient.AuthToken = values.Get("access_token")
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckForbiddenStatus(t, resp)

	ApiClient.AuthToken = oldToken

	authRequest.RedirectUri = ""
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.RedirectUri = "http://somewhereelse.com"
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.RedirectUri = rapp.CallbackUrls[0]
	authRequest.ResponseType = ""
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.ResponseType = model.AUTHCODE_RESPONSE_TYPE
	authRequest.ClientId = ""
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.ClientId = model.NewId()
	_, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckNotFoundStatus(t, resp)
}

func TestDeauthorizeOAuthApp(t *testing.T) {
	th := Setup().InitBasic()
	th.Login(ApiClient, th.SystemAdminUser)
	defer th.TearDown()

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         GenerateTestAppName(),
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
		CreatorId:    th.SystemAdminUser.Id,
	}

	rapp, appErr := th.App.CreateOAuthApp(oapp)
	require.Nil(t, appErr)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	_, resp := ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)

	pass, resp := ApiClient.DeauthorizeOAuthApp(rapp.Id)
	require.Nil(t, resp.Error)

	require.True(t, pass, "should have passed")

	_, resp = ApiClient.DeauthorizeOAuthApp("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = ApiClient.DeauthorizeOAuthApp(model.NewId())
	require.Nil(t, resp.Error)

	th.Logout(ApiClient)
	_, resp = ApiClient.DeauthorizeOAuthApp(rapp.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestOAuthAccessToken(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	th.Login(ApiClient, th.SystemAdminUser)
	defer th.TearDown()

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	oauthApp := &model.OAuthApp{
		Name:         "TestApp5" + model.NewId(),
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
		CreatorId:    th.SystemAdminUser.Id,
	}
	oauthApp, appErr := th.App.CreateOAuthApp(oauthApp)
	require.Nil(t, appErr)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{"12345678901234567890123456"}, "client_secret": []string{"12345678901234567890123456"}, "code": []string{"junk"}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	_, resp := ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - oauth providing turned off - response status code: %v", resp.StatusCode)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     oauthApp.Id,
		RedirectUri:  oauthApp.CallbackUrls[0],
		Scope:        "all",
		State:        "123",
	}

	redirect, resp := ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ := url.Parse(redirect)

	ApiClient.Logout()

	data = url.Values{"grant_type": []string{"junk"}, "client_id": []string{oauthApp.Id}, "client_secret": []string{oauthApp.ClientSecret}, "code": []string{rurl.Query().Get("code")}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - bad grant type")

	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", "")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - missing client id")

	data.Set("client_id", "junk")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - bad client id")

	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", "")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - missing client secret")

	data.Set("client_secret", "junk")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - bad client secret")

	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", "")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - missing code")

	data.Set("code", "junk")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - bad code")

	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", "junk")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - non-matching redirect uri")

	// reset data for successful request
	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])

	token := ""
	refreshToken := ""
	rsp, resp := ApiClient.GetOAuthAccessToken(data)
	require.Nil(t, resp.Error)
	require.NotEmpty(t, rsp.AccessToken, "access token not returned")
	require.NotEmpty(t, rsp.RefreshToken, "refresh token not returned")
	token, refreshToken = rsp.AccessToken, rsp.RefreshToken
	require.Equal(t, rsp.TokenType, model.ACCESS_TOKEN_TYPE, "access token type incorrect")

	_, err := ApiClient.DoApiGet("/oauth_test", "")
	require.Nil(t, err)

	ApiClient.SetOAuthToken("")
	_, err = ApiClient.DoApiGet("/oauth_test", "")
	require.NotNil(t, err, "should have failed - no access token provided")

	ApiClient.SetOAuthToken("badtoken")
	_, err = ApiClient.DoApiGet("/oauth_test", "")
	require.NotNil(t, err, "should have failed - bad token provided")

	ApiClient.SetOAuthToken(token)
	_, err = ApiClient.DoApiGet("/oauth_test", "")
	require.Nil(t, err)

	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "should have failed - tried to reuse auth code")

	data.Set("grant_type", model.REFRESH_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("refresh_token", "")
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])
	data.Del("code")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "Should have failed - refresh token empty")

	data.Set("refresh_token", refreshToken)
	rsp, resp = ApiClient.GetOAuthAccessToken(data)
	require.Nil(t, resp.Error)
	require.NotEmpty(t, rsp.AccessToken, "access token not returned")
	require.NotEmpty(t, rsp.RefreshToken, "refresh token not returned")
	require.NotEqual(t, rsp.RefreshToken, refreshToken, "refresh token did not update")
	require.Equal(t, rsp.TokenType, model.ACCESS_TOKEN_TYPE, "access token type incorrect")

	ApiClient.SetOAuthToken(rsp.AccessToken)
	_, err = ApiClient.DoApiGet("/oauth_test", "")
	require.Nil(t, err)

	data.Set("refresh_token", rsp.RefreshToken)
	rsp, resp = ApiClient.GetOAuthAccessToken(data)
	require.Nil(t, resp.Error)
	require.NotEmpty(t, rsp.AccessToken, "access token not returned")
	require.NotEmpty(t, rsp.RefreshToken, "refresh token not returned")
	require.NotEqual(t, rsp.RefreshToken, refreshToken, "refresh token did not update")
	require.Equal(t, rsp.TokenType, model.ACCESS_TOKEN_TYPE, "access token type incorrect")

	ApiClient.SetOAuthToken(rsp.AccessToken)
	_, err = ApiClient.DoApiGet("/oauth_test", "")
	require.Nil(t, err)

	authData := &model.AuthData{ClientId: oauthApp.Id, RedirectUri: oauthApp.CallbackUrls[0], UserId: th.BasicUser.Id, Code: model.NewId(), ExpiresIn: -1}
	_, err = th.App.Srv.Store.OAuth().SaveAuthData(authData)
	require.Nil(t, err)

	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])
	data.Set("code", authData.Code)
	data.Del("refresh_token")
	_, resp = ApiClient.GetOAuthAccessToken(data)
	require.NotNil(t, resp.Error, "Should have failed - code is expired")

	ApiClient.ClearOAuthToken()
}

func TestOAuthComplete(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	th.Login(ApiClient, th.SystemAdminUser)
	defer th.TearDown()

	gitLabSettingsEnable := th.App.Config().GitLabSettings.Enable
	gitLabSettingsAuthEndpoint := th.App.Config().GitLabSettings.AuthEndpoint
	gitLabSettingsId := th.App.Config().GitLabSettings.Id
	gitLabSettingsSecret := th.App.Config().GitLabSettings.Secret
	gitLabSettingsTokenEndpoint := th.App.Config().GitLabSettings.TokenEndpoint
	gitLabSettingsUserApiEndpoint := th.App.Config().GitLabSettings.UserApiEndpoint
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Enable = gitLabSettingsEnable })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = gitLabSettingsAuthEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = gitLabSettingsId })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Secret = gitLabSettingsSecret })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.TokenEndpoint = gitLabSettingsTokenEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.UserApiEndpoint = gitLabSettingsUserApiEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	r, err := HttpGet(ApiClient.Url+"/login/gitlab/complete?code=123", ApiClient.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Enable = true })
	r, err = HttpGet(ApiClient.Url+"/login/gitlab/complete?code=123&state=!#$#F@#Yˆ&~ñ", ApiClient.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.AuthEndpoint = ApiClient.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Id = model.NewId() })

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	stateProps["team_id"] = th.BasicTeam.Id
	stateProps["redirect_to"] = *th.App.Config().GitLabSettings.AuthEndpoint

	state := base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	r, err = HttpGet(ApiClient.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), ApiClient.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	stateProps["hash"] = utils.HashSha256(*th.App.Config().GitLabSettings.Id)
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	r, err = HttpGet(ApiClient.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), ApiClient.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	// We are going to use mattermost as the provider emulating gitlab
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	oauthApp := &model.OAuthApp{
		Name:        "TestApp5" + model.NewId(),
		Homepage:    "https://nowhere.com",
		Description: "test",
		CallbackUrls: []string{
			ApiClient.Url + "/signup/" + model.SERVICE_GITLAB + "/complete",
			ApiClient.Url + "/login/" + model.SERVICE_GITLAB + "/complete",
		},
		CreatorId: th.SystemAdminUser.Id,
		IsTrusted: true,
	}
	oauthApp, appErr := th.App.CreateOAuthApp(oauthApp)
	require.Nil(t, appErr)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Id = oauthApp.Id })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.Secret = oauthApp.ClientSecret })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.AuthEndpoint = ApiClient.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.TokenEndpoint = ApiClient.Url + "/oauth/access_token" })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GitLabSettings.UserApiEndpoint = ApiClient.ApiUrl + "/users/me" })

	provider := &MattermostTestProvider{}

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     oauthApp.Id,
		RedirectUri:  oauthApp.CallbackUrls[0],
		Scope:        "all",
		State:        "123",
	}

	redirect, resp := ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ := url.Parse(redirect)

	code := rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	delete(stateProps, "team_id")
	stateProps["redirect_to"] = *th.App.Config().GitLabSettings.AuthEndpoint
	stateProps["hash"] = utils.HashSha256(*th.App.Config().GitLabSettings.Id)
	stateProps["redirect_to"] = "/oauth/authorize"
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	r, err = HttpGet(ApiClient.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), ApiClient.HttpClient, "", false)
	if err == nil {
		closeBody(r)
	}

	einterfaces.RegisterOauthProvider(model.SERVICE_GITLAB, provider)

	redirect, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	r, err = HttpGet(ApiClient.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), ApiClient.HttpClient, "", false)
	if err == nil {
		closeBody(r)
	}

	_, err = th.App.Srv.Store.User().UpdateAuthData(
		th.BasicUser.Id, model.SERVICE_GITLAB, &th.BasicUser.Email, th.BasicUser.Email, true)
	require.Nil(t, err)

	redirect, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(ApiClient.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), ApiClient.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	delete(stateProps, "action")
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(ApiClient.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), ApiClient.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	require.Nil(t, resp.Error)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(ApiClient.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), ApiClient.HttpClient, "", false); err == nil {
		closeBody(r)
	}
}

func HttpGet(url string, httpClient *http.Client, authToken string, followRedirect bool) (*http.Response, *model.AppError) {
	rq, _ := http.NewRequest("GET", url, nil)
	rq.Close = true

	if len(authToken) > 0 {
		rq.Header.Set(model.HEADER_AUTH, authToken)
	}

	if !followRedirect {
		httpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	if rp, err := httpClient.Do(rq); err != nil {
		return nil, model.NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode == 304 {
		return rp, nil
	} else if rp.StatusCode == 307 {
		return rp, nil
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, model.AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func closeBody(r *http.Response) {
	if r != nil && r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}

type MattermostTestProvider struct {
}

func (m *MattermostTestProvider) GetUserFromJson(data io.Reader) *model.User {
	user := model.UserFromJson(data)
	user.AuthData = &user.Email
	return user
}

func GenerateTestAppName() string {
	return "fakeoauthapp" + model.NewRandomString(10)
}

func checkHTTPStatus(t *testing.T, resp *model.Response, expectedStatus int, expectError bool) {
	t.Helper()

	require.NotNil(t, resp, "Unexpected nil response, expected http:%v, expectError:%v)", expectedStatus, expectError)

	if expectError {
		require.NotNil(t, resp.Error, "Expected a non-nil error and http status:%v, got nil, %v", expectedStatus, resp.StatusCode)
	} else {
		require.Nil(t, resp.Error, "Expected no error and http status:%v, got %q, http:%v", expectedStatus, resp.Error, resp.StatusCode)
	}

	require.Equal(t, resp.StatusCode, expectedStatus, "Expected http status:%v, got %v (err: %q)", expectedStatus, resp.StatusCode, resp.Error)
}

func CheckForbiddenStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusForbidden, true)
}

func CheckUnauthorizedStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusUnauthorized, true)
}

func CheckNotFoundStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusNotFound, true)
}

func CheckBadRequestStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusBadRequest, true)
}

func (th *TestHelper) Login(client *model.Client4, user *model.User) {
	session := &model.Session{
		UserId:  user.Id,
		Roles:   user.GetRawRoles(),
		IsOAuth: false,
	}
	session, _ = th.App.CreateSession(session)
	client.AuthToken = session.Token
	client.AuthType = model.HEADER_BEARER
}

func (th *TestHelper) Logout(client *model.Client4) {
	client.AuthToken = ""
}

func (th *TestHelper) SaveDefaultRolePermissions() map[string][]string {
	utils.DisableDebugLogForTest()

	results := make(map[string][]string)

	for _, roleName := range []string{
		"system_user",
		"system_admin",
		"team_user",
		"team_admin",
		"channel_user",
		"channel_admin",
	} {
		role, err1 := th.App.GetRoleByName(roleName)
		if err1 != nil {
			utils.EnableDebugLogForTest()
			panic(err1)
		}

		results[roleName] = role.Permissions
	}

	utils.EnableDebugLogForTest()
	return results
}

func (th *TestHelper) RestoreDefaultRolePermissions(data map[string][]string) {
	utils.DisableDebugLogForTest()

	for roleName, permissions := range data {
		role, err1 := th.App.GetRoleByName(roleName)
		if err1 != nil {
			utils.EnableDebugLogForTest()
			panic(err1)
		}

		if strings.Join(role.Permissions, " ") == strings.Join(permissions, " ") {
			continue
		}

		role.Permissions = permissions

		_, err2 := th.App.UpdateRole(role)
		if err2 != nil {
			utils.EnableDebugLogForTest()
			panic(err2)
		}
	}

	utils.EnableDebugLogForTest()
}

// func (th *TestHelper) RemovePermissionFromRole(permission string, roleName string) {
// 	utils.DisableDebugLogForTest()

// 	role, err1 := th.App.GetRoleByName(roleName)
// 	if err1 != nil {
// 		utils.EnableDebugLogForTest()
// 		panic(err1)
// 	}

// 	var newPermissions []string
// 	for _, p := range role.Permissions {
// 		if p != permission {
// 			newPermissions = append(newPermissions, p)
// 		}
// 	}

// 	if strings.Join(role.Permissions, " ") == strings.Join(newPermissions, " ") {
// 		utils.EnableDebugLogForTest()
// 		return
// 	}

// 	role.Permissions = newPermissions

// 	_, err2 := th.App.UpdateRole(role)
// 	if err2 != nil {
// 		utils.EnableDebugLogForTest()
// 		panic(err2)
// 	}

// 	utils.EnableDebugLogForTest()
// }

func (th *TestHelper) AddPermissionToRole(permission string, roleName string) {
	utils.DisableDebugLogForTest()

	role, err1 := th.App.GetRoleByName(roleName)
	if err1 != nil {
		utils.EnableDebugLogForTest()
		panic(err1)
	}

	for _, existingPermission := range role.Permissions {
		if existingPermission == permission {
			utils.EnableDebugLogForTest()
			return
		}
	}

	role.Permissions = append(role.Permissions, permission)

	_, err2 := th.App.UpdateRole(role)
	if err2 != nil {
		utils.EnableDebugLogForTest()
		panic(err2)
	}

	utils.EnableDebugLogForTest()
}
