// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
)

func handlerForHTTPErrors(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Err = model.NewAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
}

func TestHandlerServeHTTPErrors(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	web := New(th.Server, th.Server.AppOptions, th.Server.Router)
	handler := web.NewHandler(handlerForHTTPErrors)

	var flagtests = []struct {
		name     string
		url      string
		mobile   bool
		redirect bool
	}{
		{"redirect on desktop non-api endpoint", "/login/sso/saml", false, true},
		{"not redirect on desktop api endpoint", "/api/v4/test", false, false},
		{"not redirect on mobile non-api endpoint", "/login/sso/saml", true, false},
		{"not redirect on mobile api endpoint", "/api/v4/test", true, false},
	}

	for _, tt := range flagtests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", tt.url, nil)
			if tt.mobile {
				request.Header.Add("X-Mobile-App", "mattermost")
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			if tt.redirect {
				assert.Equal(t, response.Code, http.StatusFound)
			} else {
				assert.NotContains(t, response.Body.String(), "/error?message=")
			}
		})
	}
}

func handlerForHTTPSecureTransport(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeHTTPSecureTransport(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.TLSStrictTransport = true
		*config.ServiceSettings.TLSStrictTransportMaxAge = 6000
	})

	web := New(th.Server, th.Server.AppOptions, th.Server.Router)
	handler := web.NewHandler(handlerForHTTPSecureTransport)

	request := httptest.NewRequest("GET", "/api/v4/test", nil)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	header := response.Header().Get("Strict-Transport-Security")

	if header == "" {
		t.Errorf("Strict-Transport-Security expected but not existent")
	}

	if header != "max-age=6000" {
		t.Errorf("Expected max-age=6000, got %s", header)
	}

	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.TLSStrictTransport = false
	})

	request = httptest.NewRequest("GET", "/api/v4/test", nil)

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	header = response.Header().Get("Strict-Transport-Security")

	if header != "" {
		t.Errorf("Strict-Transport-Security header is not expected, but returned")
	}
}

func handlerForCSRFToken(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeCSRFToken(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	session := &model.Session{
		UserId:   th.BasicUser.Id,
		CreateAt: model.GetMillis(),
		Roles:    model.SYSTEM_USER_ROLE_ID,
		IsOAuth:  false,
	}
	session.GenerateCSRF()
	session.SetExpireInDays(1)
	session, err := th.App.CreateSession(session)
	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	web := New(th.Server, th.Server.AppOptions, th.Server.Router)

	handler := Handler{
		GetGlobalAppOptions: web.GetGlobalAppOptions,
		HandleFunc:          handlerForCSRFToken,
		RequireSession:      true,
		TrustRequester:      false,
		RequireMfa:          false,
		IsStatic:            false,
	}

	cookie := &http.Cookie{
		Name:  model.SESSION_COOKIE_USER,
		Value: th.BasicUser.Username,
	}
	cookie2 := &http.Cookie{
		Name:  model.SESSION_COOKIE_TOKEN,
		Value: session.Token,
	}
	cookie3 := &http.Cookie{
		Name:  model.SESSION_COOKIE_CSRF,
		Value: session.GetCSRF(),
	}

	// CSRF Token Used - Success Expected

	request := httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	request.Header.Add(model.HEADER_CSRF_TOKEN, session.GetCSRF())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 200 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// No CSRF Token Used - Failure Expected

	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 401 {
		t.Errorf("Expected status 401, got %d", response.Code)
	}

	// Fallback Behavior Used - Success expected
	// ToDo (DSchalla) 2019/01/04: Remove once legacy CSRF Handling is removed
	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.ExperimentalStrictCSRFEnforcement = false
	})
	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	request.Header.Add(model.HEADER_REQUESTED_WITH, model.HEADER_REQUESTED_WITH_XML)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 200 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// Fallback Behavior Used with Strict Enforcement - Failure Expected
	// ToDo (DSchalla) 2019/01/04: Remove once legacy CSRF Handling is removed
	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.ExperimentalStrictCSRFEnforcement = true
	})
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 401 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}
}
