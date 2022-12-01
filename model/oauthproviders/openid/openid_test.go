// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthopenid

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGetAuthData(t *testing.T) {
	ou := OpenIdUser{
		Id:        "12345",
		FirstName: "firstname",
		LastName:  "lastname",
		Nickname:  "nickname",
		Email:     "name@test.com",
		Oid:       "0e8fddd4-50d3-4499-9a93-a390ee8cb83d",
	}

	provider := &OpenIdProvider{
		CacheData: &CacheData{
			Service: model.ServiceGitlab,
		},
	}

	t.Run("validate return id", func(t *testing.T) {
		authData := provider.getAuthData(&ou)
		assert.Equal(t, ou.Id, authData)
	})

	provider.CacheData.Service = model.ServiceOffice365

	fmt.Println(provider.CacheData.Service)
	t.Run("validate Oid return", func(t *testing.T) {
		authData := provider.getAuthData(&ou)
		assert.Equal(t, ou.Oid, authData)
	})
}
func TestOpenIdUserFromJSON(t *testing.T) {
	ou := OpenIdUser{
		Id:        "12345",
		FirstName: "firstname",
		LastName:  "lastname",
		Nickname:  "nickname",
		Email:     "name@test.com",
	}

	provider := &OpenIdProvider{
		CacheData: &CacheData{
			Service: model.ServiceOpenid,
		},
	}

	t.Run("valid OpenId user", func(t *testing.T) {
		b, err := json.Marshal(ou)
		require.NoError(t, err)

		_, err = provider.GetUserFromJSON(bytes.NewReader(b), nil)
		require.NoError(t, err)

		_, err = provider.GetAuthDataFromJSON(bytes.NewReader(b))
		require.NoError(t, err)
	})

	t.Run("valid GitLab user", func(t *testing.T) {
		glu := OpenIdUser{
			Id:       ou.Id,
			Email:    ou.Email,
			Nickname: ou.Nickname,
			Name:     ou.FirstName + " " + ou.LastName + " another-lastname",
		}

		b, err := json.Marshal(glu)
		require.NoError(t, err)

		gitLabProvider := &OpenIdProvider{
			CacheData: &CacheData{
				Service: model.ServiceGitlab,
			},
		}
		userData, err := gitLabProvider.GetUserFromJSON(bytes.NewReader(b), nil)
		require.NoError(t, err)
		require.Equal(t, ou.Nickname, userData.Username)
		require.Equal(t, ou.FirstName, userData.FirstName)
		require.Equal(t, ou.LastName+" another-lastname", userData.LastName)
	})

	t.Run("empty body should fail without panic", func(t *testing.T) {
		_, err := provider.GetUserFromJSON(strings.NewReader("{}"), nil)
		require.NoError(t, err)

		_, err = provider.GetAuthDataFromJSON(strings.NewReader("{}"))
		require.Error(t, err)
	})

	t.Run("test getUserFromIdToken", func(t *testing.T) {
		header := "dummyHeader"
		payload := "eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxMDIyOTIwNzU1ODQ2LWtyM2JrMjBxdDRhMTlkODhqMWt1cjNqcnM2MmI2ZXFjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMTAyMjkyMDc1NTg0Ni1rcjNiazIwcXQ0YTE5ZDg4ajFrdXIzanJzNjJiNmVxYy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExMDIxNjMwMDI2MzA5MTY3MzQ2MSIsImhkIjoibWF0dGVybW9zdC5jb20iLCJlbWFpbCI6InNjb3R0LmJpc2hlbEBtYXR0ZXJtb3N0LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiWTVscFFoQlR0UkxHUGZqZ1BLSUhzUSIsIm5hbWUiOiJTY290dCBCaXNoZWwiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2dMR1Nfa19KV2dacmc1Y1BGLU9JNV9oUkhaREFvUUNoUFUyVE1VPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IlNjb3R0IiwiZmFtaWx5X25hbWUiOiJCaXNoZWwiLCJsb2NhbGUiOiJlbiIsImlhdCI6MTYwODI0OTg5MSwiZXhwIjoxNjA4MjUzNDkxfQ"
		signature := "dummysignature"

		testToken := header
		_, err := provider.GetUserFromIdToken(testToken)
		require.Error(t, err)

		testToken = header + "." + payload
		_, err = provider.GetUserFromIdToken(testToken)
		require.Error(t, err)

		t.Run("non ascii string encoded in the payload", func(t *testing.T) {
			cases := []struct {
				payload      string
				expectedName string
			}{
				{
					payload:      "eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxMDIyOTIwNzU1ODQ2LWtyM2JrMjBxdDRhMTlkODhqMWt1cjNqcnM2MmI2ZXFjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMTAyMjkyMDc1NTg0Ni1rcjNiazIwcXQ0YTE5ZDg4ajFrdXIzanJzNjJiNmVxYy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExMDIxNjMwMDI2MzA5MTY3MzQ2MSIsImhkIjoibWF0dGVybW9zdC5jb20iLCJlbWFpbCI6InNjb3R0LmJpc2hlbEBtYXR0ZXJtb3N0LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiWTVscFFoQlR0UkxHUGZqZ1BLSUhzUSIsIm5hbWUiOiJTY290dCBCaXNoZWwiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2dMR1Nfa19KV2dacmc1Y1BGLU9JNV9oUkhaREFvUUNoUFUyVE1VPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6InRlc3TFiMWhxb4iLCJmYW1pbHlfbmFtZSI6IkJpc2hlbCIsImxvY2FsZSI6ImVuIiwiaWF0IjoxNjA4MjQ5ODkxLCJleHAiOjE2MDgyNTM0OTF9",
					expectedName: "testňšž",
				},
				{
					payload:      "eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxMDIyOTIwNzU1ODQ2LWtyM2JrMjBxdDRhMTlkODhqMWt1cjNqcnM2MmI2ZXFjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMTAyMjkyMDc1NTg0Ni1rcjNiazIwcXQ0YTE5ZDg4ajFrdXIzanJzNjJiNmVxYy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExMDIxNjMwMDI2MzA5MTY3MzQ2MSIsImhkIjoibWF0dGVybW9zdC5jb20iLCJlbWFpbCI6InNjb3R0LmJpc2hlbEBtYXR0ZXJtb3N0LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiWTVscFFoQlR0UkxHUGZqZ1BLSUhzUSIsIm5hbWUiOiJTY290dCBCaXNoZWwiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2dMR1Nfa19KV2dacmc1Y1BGLU9JNV9oUkhaREFvUUNoUFUyVE1VPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IlNjb3R0IiwiZmFtaWx5X25hbWUiOiJCaXNoZWwiLCJsb2NhbGUiOiJlbiIsImlhdCI6MTYwODI0OTg5MSwiZXhwIjoxNjA4MjUzNDkxfQ",
					expectedName: "Scott",
				},
				{
					payload:      "eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxMDIyOTIwNzU1ODQ2LWtyM2JrMjBxdDRhMTlkODhqMWt1cjNqcnM2MmI2ZXFjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMTAyMjkyMDc1NTg0Ni1rcjNiazIwcXQ0YTE5ZDg4ajFrdXIzanJzNjJiNmVxYy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExMDIxNjMwMDI2MzA5MTY3MzQ2MSIsImhkIjoibWF0dGVybW9zdC5jb20iLCJlbWFpbCI6InNjb3R0LmJpc2hlbEBtYXR0ZXJtb3N0LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiWTVscFFoQlR0UkxHUGZqZ1BLSUhzUSIsIm5hbWUiOiJTY290dCBCaXNoZWwiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2dMR1Nfa19KV2dacmc1Y1BGLU9JNV9oUkhaREFvUUNoUFUyVE1VPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6InRlc3TEjcSNxI0iLCJmYW1pbHlfbmFtZSI6IkJpc2hlbCIsImxvY2FsZSI6ImVuIiwiaWF0IjoxNjA4MjQ5ODkxLCJleHAiOjE2MDgyNTM0OTF9",
					expectedName: "testččč",
				},
			}
			for _, c := range cases {
				testToken = header + "." + c.payload + "." + signature
				user, err := provider.GetUserFromIdToken(testToken)
				require.NoError(t, err)
				require.NotNil(t, user)
				require.Equal(t, c.expectedName, user.FirstName)
			}
		})

	})
}

func TestGetSSOSettings(t *testing.T) {
	provider := &OpenIdProvider{
		CacheData: &CacheData{
			Service: model.ServiceOpenid,
		},
	}
	validJSON := `{
		"issuer": "issuer",
		"authorization_endpoint": "authorization_endpoint",
		"token_endpoint": "token_endpoint",
		"userinfo_endpoint": "userinfo_endpoint",
		"jwks_uri": "jwks_uri",
		"id_token_signing_alg_values_supported": ["RS256"]
	}`
	var validFunctionCalled int
	validServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Cache-Control", "max-age=3600")
		fmt.Fprintln(w, validJSON)
		validFunctionCalled++
	}))
	defer validServer.Close()

	validConfig := model.Config{
		OpenIdSettings: model.SSOSettings{
			Enable:            model.NewBool(true),
			Secret:            model.NewString("secret string"),
			Id:                model.NewString("id"),
			Scope:             model.NewString("profile openid email"),
			AuthEndpoint:      model.NewString(""),
			TokenEndpoint:     model.NewString(""),
			UserAPIEndpoint:   model.NewString(""),
			DiscoveryEndpoint: model.NewString(validServer.URL),
		},
	}

	t.Run("Error", func(t *testing.T) {
		errorFunctionCalled := 0
		errorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			errorFunctionCalled++
			w.Header().Add("Cache-Control", "max-age=3600")
			http.Error(w, "Not found", 404)
		}))

		errCfg := validConfig
		errCfg.OpenIdSettings.DiscoveryEndpoint = model.NewString(errorServer.URL)
		_, err := provider.GetSSOSettings(&errCfg, model.ServiceOpenid)
		assert.Error(t, err)
		assert.Equal(t, 1, errorFunctionCalled)
	})

	t.Run("UseCache", func(t *testing.T) {
		validFunctionCalled = 0

		settings, _ := provider.GetSSOSettings(&validConfig, model.ServiceOpenid)
		assert.Equal(t, "authorization_endpoint", *settings.AuthEndpoint)
		assert.Equal(t, "token_endpoint", *settings.TokenEndpoint)
		assert.Equal(t, "userinfo_endpoint", *settings.UserAPIEndpoint)
		assert.Equal(t, 1, validFunctionCalled)
		// Should set cache
		assert.Equal(t, provider.CacheData.Settings, *settings)
		assert.True(t, provider.CacheData.Expires > 0)
		currentCacheExpires := provider.CacheData.Expires

		// Call again should come from cache
		settings, _ = provider.GetSSOSettings(&validConfig, model.ServiceOpenid)
		assert.Equal(t, provider.CacheData.Settings, *settings)
		assert.Equal(t, currentCacheExpires, provider.CacheData.Expires)
		// should still be 1
		assert.Equal(t, 1, validFunctionCalled)
	})

	t.Run("CacheExpired", func(t *testing.T) {
		// reset to original cache settings
		settings, _ := provider.GetSSOSettings(&validConfig, model.ServiceOpenid)
		// Should set cache
		assert.Equal(t, provider.CacheData.Settings, *settings)

		// set cache to expired
		provider.CacheData.Expires = time.Now().Add(time.Duration(-1) * time.Minute).Unix()

		// same config, should call endpoint
		validFunctionCalled = 0
		provider.GetSSOSettings(&validConfig, model.ServiceOpenid)
		assert.Equal(t, 1, validFunctionCalled)
		assert.True(t, provider.CacheData.Expires > time.Now().Unix())
	})

	t.Run("NoCache", func(t *testing.T) {
		noCacheFunctionCalled := 0
		noCacheServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintln(w, validJSON)
			noCacheFunctionCalled++
		}))
		defer noCacheServer.Close()

		newCfg := validConfig
		newCfg.OpenIdSettings.DiscoveryEndpoint = model.NewString(noCacheServer.URL)

		settings, err := provider.GetSSOSettings(&newCfg, model.ServiceOpenid)
		require.NoError(t, err)
		assert.Equal(t, "authorization_endpoint", *settings.AuthEndpoint)
		assert.Equal(t, "token_endpoint", *settings.TokenEndpoint)
		assert.Equal(t, "userinfo_endpoint", *settings.UserAPIEndpoint)
		assert.Equal(t, 1, noCacheFunctionCalled)
		// Should set cache
		assert.Equal(t, provider.CacheData.Settings, *settings)
		// Cache Expires, set, less than, equal now.
		assert.True(t, provider.CacheData.Expires <= time.Now().Unix())

		// Call again, should call server again
		_, err = provider.GetSSOSettings(&newCfg, model.ServiceOpenid)
		require.NoError(t, err)
		assert.Equal(t, 2, noCacheFunctionCalled)
	})

	t.Run("ChangeService", func(t *testing.T) {
		// reset to original cache settings
		settings, _ := provider.GetSSOSettings(&validConfig, model.ServiceOpenid)
		// Should set cache
		assert.Equal(t, provider.CacheData.Settings, *settings)
		assert.True(t, provider.CacheData.Expires > time.Now().Unix())

		// create identical setting for Google
		googleCfg := model.Config{
			GoogleSettings: model.SSOSettings{},
		}
		googleCfg.GoogleSettings = validConfig.OpenIdSettings

		// call with different service, same config settings
		validFunctionCalled = 0
		provider.GetSSOSettings(&googleCfg, model.ServiceGoogle)
		assert.Equal(t, model.ServiceGoogle, provider.CacheData.Service)
		assert.Equal(t, 1, validFunctionCalled)
	})

	t.Run("ChangeConfigSettings", func(t *testing.T) {
		secondFunctionCalled := 0
		secondServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Cache-Control", "max-age=3600")
			fmt.Fprintln(w, validJSON)
			secondFunctionCalled++
		}))
		defer secondServer.Close()

		newCfg := validConfig
		newCfg.OpenIdSettings.DiscoveryEndpoint = model.NewString(secondServer.URL)

		// new URL
		settings, err := provider.GetSSOSettings(&newCfg, model.ServiceOpenid)
		require.NoError(t, err)
		assert.Equal(t, "authorization_endpoint", *settings.AuthEndpoint)
		assert.Equal(t, "token_endpoint", *settings.TokenEndpoint)
		assert.Equal(t, "userinfo_endpoint", *settings.UserAPIEndpoint)
		assert.Equal(t, 1, secondFunctionCalled)

		// new secret
		newCfg.OpenIdSettings.Secret = model.NewString("NewSecret")
		_, err = provider.GetSSOSettings(&newCfg, model.ServiceOpenid)
		require.NoError(t, err)
		assert.Equal(t, newCfg.OpenIdSettings.Secret, provider.CacheData.Settings.Secret)
		assert.Equal(t, 2, secondFunctionCalled)

		// new Id
		newCfg.OpenIdSettings.Id = model.NewString("NewId")
		_, err = provider.GetSSOSettings(&newCfg, model.ServiceOpenid)
		require.NoError(t, err)
		assert.Equal(t, newCfg.OpenIdSettings.Id, provider.CacheData.Settings.Id)
		assert.Equal(t, 3, secondFunctionCalled)
	})
}

func TestCacheControlPanic(t *testing.T) {
	provider := &OpenIdProvider{
		CacheData: &CacheData{
			Service: model.ServiceOpenid,
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "no header")
	}))
	defer ts.Close()

	cfg := &model.Config{
		OpenIdSettings: model.SSOSettings{
			DiscoveryEndpoint: model.NewString(ts.URL),
		},
	}

	require.NotPanics(t, func() {
		provider.GetSSOSettings(cfg, model.ServiceOpenid)
	})
}

func TestIsSameUser(t *testing.T) {
	provider := &OpenIdProvider{
		CacheData: &CacheData{
			Service: model.ServiceOpenid,
		},
	}
	cases := []struct {
		dbUser    model.User
		oauthUser model.User
		verified  bool
	}{
		{model.User{AuthData: model.NewString("202993a800824dc1b4496d598d47c58a")}, model.User{AuthData: model.NewString("202993a8-0082-4dc1-b449-6d598d47c58a")}, true},
		{model.User{AuthData: model.NewString("202993a85a824dc1b4496d598d47c58a")}, model.User{AuthData: model.NewString("")}, false},
		{model.User{AuthData: model.NewString("")}, model.User{AuthData: model.NewString("202993a8-5a82-4dc1-b449-6d598d47c58a")}, false},
		{model.User{AuthData: model.NewString("be95fe607df5dbeb")}, model.User{AuthData: model.NewString("00000000-0000-0000-be95-fe607df5dbeb")}, true},
		{model.User{AuthData: model.NewString("be95fe607df5dbeb")}, model.User{AuthData: model.NewString("00000000-0000-0000-be90-fe607df5dbeb")}, false},
		{model.User{AuthData: model.NewString("be95fe607df5dbeb")}, model.User{AuthData: model.NewString("00000000-0000-0000-be95-fe607df5dbe0")}, false},
		{model.User{AuthData: model.NewString("hello")}, model.User{}, false},
	}
	for _, c := range cases {
		verified := provider.IsSameUser(&c.dbUser, &c.oauthUser)
		if verified != c.verified {
			if c.verified {
				t.Logf("'%v' should have matched '%v'", c.dbUser, c.oauthUser)
			} else {
				t.Logf("'%v' should not have matched '%v'", c.dbUser, c.oauthUser)
			}
			t.FailNow()
		}
	}
}
