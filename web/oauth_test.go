// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/mattermost/mattermost-server/model"
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
		CreatorId:    th.BasicUser.Id,
	}

	rapp, appErr := th.App.CreateOAuthApp(oapp)
	CheckNoAppError(t, appErr)
	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	// Test auth code flow
	ruri, resp := ApiClient.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)

	if len(ruri) == 0 {
		t.Fatal("redirect url should be set")
	}

	ru, _ := url.Parse(ruri)
	if ru == nil {
		t.Fatal("redirect url unparseable")
	} else {
		if len(ru.Query().Get("code")) == 0 {
			t.Fatal("authorization code not returned")
		}
		if ru.Query().Get("state") != authRequest.State {
			t.Fatal("returned state doesn't match")
		}
	}

	// Test implicit flow
	authRequest.ResponseType = model.IMPLICIT_RESPONSE_TYPE
	ruri, resp = ApiClient.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
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

func GenerateTestAppName() string {
	return "fakeoauthapp" + model.NewRandomString(10)
}

func CheckNoAppError(t *testing.T, err *model.AppError) {
	t.Helper()

	if err != nil {
		t.Fatalf("Expected no error, got %q", err.Error())
	}
}

func CheckNoError(t *testing.T, resp *model.Response) {
	t.Helper()

	if resp.Error != nil {
		t.Fatalf("Expected no error, got %q", resp.Error.Error())
	}
}

func checkHTTPStatus(t *testing.T, resp *model.Response, expectedStatus int, expectError bool) {
	t.Helper()

	switch {
	case resp == nil:
		t.Fatalf("Unexpected nil response, expected http:%v, expectError:%v)", expectedStatus, expectError)

	case expectError && resp.Error == nil:
		t.Fatalf("Expected a non-nil error and http status:%v, got nil, %v", expectedStatus, resp.StatusCode)

	case !expectError && resp.Error != nil:
		t.Fatalf("Expected no error and http status:%v, got %q, http:%v", expectedStatus, resp.Error, resp.StatusCode)

	case resp.StatusCode != expectedStatus:
		t.Fatalf("Expected http status:%v, got %v (err: %q)", expectedStatus, resp.StatusCode, resp.Error)
	}
}

func CheckForbiddenStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusForbidden, true)
}

func CheckNotFoundStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusNotFound, true)
}

func CheckBadRequestStatus(t *testing.T, resp *model.Response) {
	t.Helper()
	checkHTTPStatus(t, resp, http.StatusBadRequest, true)
}
