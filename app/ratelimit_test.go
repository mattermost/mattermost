// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func genRateLimitSettings(useAuth, useIP bool, header string) *model.RateLimitSettings {
	return &model.RateLimitSettings{
		Enable:           model.NewBool(true),
		PerSec:           model.NewInt(10),
		MaxBurst:         model.NewInt(100),
		MemoryStoreSize:  model.NewInt(10000),
		VaryByRemoteAddr: model.NewBool(useIP),
		VaryByUser:       model.NewBool(useAuth),
		VaryByHeader:     header,
	}
}

func TestGenerateKey(t *testing.T) {
	cases := []struct {
		useAuth         bool
		useIP           bool
		header          string
		authTokenResult string
		ipResult        string
		headerResult    string
		expectedKey     string
	}{
		{false, false, "", "", "", "", ""},
		{true, false, "", "resultkey", "notme", "notme", "resultkey"},
		{false, true, "", "notme", "resultkey", "notme", "resultkey"},
		{false, false, "myheader", "notme", "notme", "resultkey", "resultkey"},
		{true, true, "", "resultkey", "ipaddr", "notme", "resultkey"},
		{true, true, "", "", "ipaddr", "notme", "ipaddr"},
		{true, true, "myheader", "resultkey", "ipaddr", "hadd", "resultkeyhadd"},
		{true, true, "myheader", "", "ipaddr", "hadd", "ipaddrhadd"},
	}

	for testnum, tc := range cases {
		req := httptest.NewRequest("GET", "/", nil)
		if tc.authTokenResult != "" {
			req.AddCookie(&http.Cookie{
				Name:  model.SESSION_COOKIE_TOKEN,
				Value: tc.authTokenResult,
			})
		}
		req.RemoteAddr = tc.ipResult + ":80"
		if tc.headerResult != "" {
			req.Header.Set(tc.header, tc.headerResult)
		}

		rateLimiter := NewRateLimiter(genRateLimitSettings(tc.useAuth, tc.useIP, tc.header))

		key := rateLimiter.GenerateKey(req)

		require.Equal(t, tc.expectedKey, key, "Wrong key on test "+strconv.Itoa(testnum))
	}
}
