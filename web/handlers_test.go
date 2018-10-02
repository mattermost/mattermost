// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
)

func handlerForTest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Err = model.NewAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
}

func TestHandlerServeHTTPErrors(t *testing.T) {
	a, err := app.New(app.StoreOverride(testStore), app.DisableConfigWatch)
	defer a.Shutdown()

	web := NewWeb(a, a.Srv.Router)
	if err != nil {
		panic(err)
	}
	handler := web.NewHandler(handlerForTest)

	var flagtests = []struct {
		name     string
		url      string
		mobile   bool
		redirect bool
	}{
		// TODO: Fixme for go1.11
		//{"redirect on destkop non-api endpoint", "/login/sso/saml", false, true},
		{"not redirect on destkop api endpoint", "/api/v4/test", false, false},
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
				assert.Contains(t, response.Body.String(), "/error?message=")
			} else {
				assert.NotContains(t, response.Body.String(), "/error?message=")
			}
		})
	}
}
