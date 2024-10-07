// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestParseAuthTokenFromRequest(t *testing.T) {
	cases := []struct {
		header           string
		cookie           string
		query            string
		expectedToken    string
		expectedLocation TokenLocation
	}{
		{"", "", "", "", TokenLocationNotFound},
		{"token mytoken", "", "", "mytoken", TokenLocationHeader},
		{"BEARER mytoken", "", "", "mytoken", TokenLocationHeader},
		{"", "mytoken", "", "mytoken", TokenLocationCookie},
		{"", "a very large token to test out tokentokentokentokentokentokentokentokentokentokentokentokentoken", "", "a very large token to test out tokentokentokentoke", TokenLocationCookie},
		{"", "", "mytoken", "mytoken", TokenLocationQueryString},
		{"mytoken", "", "", "mytoken", TokenLocationCloudHeader},
	}

	for testnum, tc := range cases {
		pathname := "/test/here"
		if tc.query != "" {
			pathname += "?access_token=" + tc.query
		}
		req := httptest.NewRequest("GET", pathname, nil)
		switch tc.expectedLocation {
		case TokenLocationHeader:
			req.Header.Add(model.HeaderAuth, tc.header)
		case TokenLocationCloudHeader:
			req.Header.Add(model.HeaderCloudToken, tc.header)
		case TokenLocationCookie:
			req.AddCookie(&http.Cookie{
				Name:  model.SessionCookieToken,
				Value: tc.cookie,
			})
		}

		token, location := ParseAuthTokenFromRequest(req)

		require.Equal(t, tc.expectedToken, token, "Wrong token on test "+strconv.Itoa(testnum))
		require.Equal(t, tc.expectedLocation, location, "Wrong location on test "+strconv.Itoa(testnum))
	}
}

func TestCheckPasswordAndAllCriteria(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	const maxFailedLoginAttempts = 1
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.MaximumLoginAttempts = maxFailedLoginAttempts
	})

	concurrentAttempts := maxFailedLoginAttempts + 1
	appErrs := make([]*model.AppError, concurrentAttempts)

	// Wait to complete the test
	var completeWG sync.WaitGroup
	completeWG.Add(concurrentAttempts)

	// Wait to fetch the login attempts
	var fetchedWG sync.WaitGroup
	fetchedWG.Add(concurrentAttempts)

	for i := 0; i < concurrentAttempts; i++ {
		go func(i int) {
			defer completeWG.Done()

			// Simulate concurrent login attempts for the same user
			user, _ := th.App.Srv().Store().User().Get(th.Context.Context(), th.BasicUser.Id)
			fetchedWG.Done()

			// Wait to fetch all user objects before ever reaching the password check
			fetchedWG.Wait()

			// Simulate concurrent password and login attempts check
			appErrs[i] = th.App.CheckPasswordAndAllCriteria(th.Context, user, "wrong password", user.MfaSecret)
		}(i)
	}

	completeWG.Wait()

	passwordFails := 0
	for i := 0; i < concurrentAttempts; i++ {
		if appErrs[i].Id == "api.user.check_user_password.invalid.app_error" {
			passwordFails++
		}
	}

	// Password failure attempts will not breach the maxFailedAttempts
	// even during concurrent access by the same user
	require.Equal(t, maxFailedLoginAttempts, passwordFails)

	// TODO: Parallel test.run for Wrong Password, Wrong MFA, on Success - 0
}
