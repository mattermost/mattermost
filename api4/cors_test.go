package api4

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
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
		AllowCorsFrom        string
		CorsExposedHeaders   string
		CorsAllowCredentials bool
		ModifyRequest        func(req *http.Request)
		VerifyResponse       func(t *testing.T, resp *http.Response)
	}{
		"NoCORS": {
			"",
			"",
			false,
			func(req *http.Request) {
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acMaxAge))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
				assert.Equal(t, "", resp.Header.Get(acAllowMethods))
				assert.Equal(t, "", resp.Header.Get(acAllowHeaders))
			},
		},
		"CORSEnabled": {
			"http://somewhere.com",
			"",
			false,
			func(req *http.Request) {
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acMaxAge))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
				assert.Equal(t, "", resp.Header.Get(acAllowMethods))
				assert.Equal(t, "", resp.Header.Get(acAllowHeaders))
			},
		},
		"CORSEnabledStarOrigin": {
			"*",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://pre-release.mattermost.com")
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "*", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
			},
		},
		"CORSEnabledStarNoOrigin": { // CORS spec requires this, not a bug.
			"*",
			"",
			false,
			func(req *http.Request) {
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
			},
		},
		"CORSEnabledMatching": {
			"http://mattermost.com",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "http://mattermost.com", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
			},
		},
		"CORSEnabledMultiple": {
			"http://spinmint.com http://mattermost.com",
			"",
			false,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "http://mattermost.com", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "", resp.Header.Get(acAllowCredentials))
			},
		},
		"CORSEnabledWithCredentials": {
			"http://mattermost.com",
			"",
			true,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "http://mattermost.com", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "true", resp.Header.Get(acAllowCredentials))
			},
		},
		"CORSEnabledWithHeaders": {
			"http://mattermost.com",
			"x-my-special-header x-blueberry",
			true,
			func(req *http.Request) {
				req.Header.Set("Origin", "http://mattermost.com")
			},
			func(t *testing.T, resp *http.Response) {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "http://mattermost.com", resp.Header.Get(acAllowOrigin))
				assert.Equal(t, "X-My-Special-Header, X-Blueberry", resp.Header.Get(acExposeHeaders))
				assert.Equal(t, "true", resp.Header.Get(acAllowCredentials))
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			th := SetupConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.AllowCorsFrom = testcase.AllowCorsFrom
				*cfg.ServiceSettings.CorsExposedHeaders = testcase.CorsExposedHeaders
				*cfg.ServiceSettings.CorsAllowCredentials = testcase.CorsAllowCredentials
			})
			defer th.TearDown()

			port := th.App.Srv.ListenAddr.Port
			host := fmt.Sprintf("http://localhost:%v", port)
			url := fmt.Sprintf("%v/api/v4/system/ping", host)

			req, err := http.NewRequest("GET", url, nil)
			if err != nil {
				t.Fatal(err)
			}
			testcase.ModifyRequest(req)

			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			testcase.VerifyResponse(t, resp)
		})
	}

}
