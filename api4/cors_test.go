// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

const (
	acAllowOrigin      = "Access-Control-Allow-Origin"
	acExposeHeaders    = "Access-Control-Expose-Headers"
	acMaxAge           = "Access-Control-Max-Age"
	acAllowCredentials = "Access-Control-Allow-Credentials"
	acAllowMethods     = "Access-Control-Allow-Methods"
	acAllowHeaders     = "Access-Control-Allow-Headers"
)

func TestCORSRequestHandling(t *testing.T) {
	for name, testcase := range map[string]struct {
		AllowCorsFrom            string
		CorsExposedHeaders       string
		CorsAllowCredentials     bool
		ModifyRequest            func(req *http.Request)
		ExpectedAllowOrigin      string
		ExpectedExposeHeaders    string
		ExpectedAllowCredentials string
	}{
		"NoCORS": {
			"",
			"",
			false,
			func(req *http.Request) {
			},
			"",
			"",
			"",
		},
		"CORSEnabled": {
			"http://somewhere.com",
			"",
			false,
			func(req *http.Request) {
			},
			"",
			"",
			"",
		},
		"CORSEnabledStarOrigin": {
			"*",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://pre-release.mattermost.com")
			},
			"*",
			"",
			"",
		},
		"CORSEnabledStarNoOrigin": { // CORS spec requires this, not a bug.
			"*",
			"",
			false,
			func(req *http.Request) {
			},
			"",
			"",
			"",
		},
		"CORSEnabledMatching": {
			"http://mattermost.com",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			"http://mattermost.com",
			"",
			"",
		},
		"CORSEnabledMultiple": {
			"http://spinmint.com http://mattermost.com",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			"http://mattermost.com",
			"",
			"",
		},
		"CORSEnabledWithCredentials": {
			"http://mattermost.com",
			"",
			true,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			"http://mattermost.com",
			"",
			"true",
		},
		"CORSEnabledWithHeaders": {
			"http://mattermost.com",
			"x-my-special-header x-blueberry",
			true,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			"http://mattermost.com",
			"X-My-Special-Header, X-Blueberry",
			"true",
		},
	} {
		t.Run(name, func(t *testing.T) {
			th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowCorsFrom = testcase.AllowCorsFrom
				*cfg.ServiceSettings.CorsExposedHeaders = testcase.CorsExposedHeaders
				*cfg.ServiceSettings.CorsAllowCredentials = testcase.CorsAllowCredentials
			})
			defer th.TearDown()
			licenseStore := mocks.LicenseStore{}
			licenseStore.On("Get", "").Return(&model.LicenseRecord{}, nil)
			th.App.Srv().Store().(*mocks.Store).On("License").Return(&licenseStore)

			port := th.App.Srv().ListenAddr.Port
			host := fmt.Sprintf("http://localhost:%v", port)
			url := fmt.Sprintf("%v/api/v4/system/ping", host)

			req, err := http.NewRequest(http.MethodGet, url, http.NoBody)
			require.NoError(t, err)
			testcase.ModifyRequest(req)

			client := &http.Client{}
			resp, err := client.Do(req)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			assert.Equal(t, testcase.ExpectedAllowOrigin, resp.Header.Get(acAllowOrigin))
			assert.Equal(t, testcase.ExpectedExposeHeaders, resp.Header.Get(acExposeHeaders))
			assert.Equal(t, "", resp.Header.Get(acMaxAge))
			assert.Equal(t, testcase.ExpectedAllowCredentials, resp.Header.Get(acAllowCredentials))
			assert.Equal(t, "", resp.Header.Get(acAllowMethods))
			assert.Equal(t, "", resp.Header.Get(acAllowHeaders))
		})
	}
}
