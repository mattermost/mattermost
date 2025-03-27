// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
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

	const maxFailedLoginAttempts = 3
	const concurrentAttempts = maxFailedLoginAttempts + 1
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.MaximumLoginAttempts = maxFailedLoginAttempts
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
	})

	password := "newpassword1"
	appErr := th.App.UpdatePassword(th.Context, th.BasicUser, password)
	require.Nil(t, appErr)

	// setup MFA
	secret, appErr := th.App.GenerateMfaSecret(th.BasicUser.Id)
	require.Nil(t, appErr)
	err := th.Server.Store().User().UpdateMfaActive(th.BasicUser.Id, true)
	require.NoError(t, err)
	err = th.Server.Store().User().UpdateMfaSecret(th.BasicUser.Id, secret.Secret)
	require.NoError(t, err)

	t.Run("should run successfully when attempts are available", func(t *testing.T) {
		err = th.App.Srv().Store().User().UpdateFailedPasswordAttempts(th.BasicUser.Id, maxFailedLoginAttempts-1)
		require.NoError(t, err)
		code := dgoogauth.ComputeCode(secret.Secret, time.Now().UTC().Unix()/30)
		token := fmt.Sprintf("%06d", code)

		appErr = th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, password, token)
		require.Nil(t, appErr)
	})

	t.Run("validate concurrent failed attempts to bypass checks", func(t *testing.T) {
		testCases := []struct {
			name          string
			password      string
			mfaToken      string
			expectedErrID string
		}{
			{
				name:          "should not breach max. login attempts when password is wrong",
				password:      "wrong password",
				expectedErrID: "api.user.check_user_password.invalid.app_error",
			},
			{
				name:          "should not breach max. login attempts when MFA is wrong",
				password:      password,
				mfaToken:      "123456",
				expectedErrID: "api.user.check_user_mfa.bad_code.app_error",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				// Reset login attempts
				err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(th.BasicUser.Id, 0)
				require.NoError(t, err)

				// Capture all concurrent errors
				appErrs := make([]*model.AppError, concurrentAttempts)

				// Wait to complete the test
				var completeWG sync.WaitGroup
				completeWG.Add(concurrentAttempts)

				for i := 0; i < concurrentAttempts; i++ {
					go func(i int) {
						defer completeWG.Done()
						// Simulate concurrent failed login checks by same user
						appErrs[i] = th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, tc.password, tc.mfaToken)
					}(i)
				}

				completeWG.Wait()

				expectedErrsCount := 0
				for i := 0; i < concurrentAttempts; i++ {
					if appErrs[i].Id == tc.expectedErrID {
						expectedErrsCount++
						continue
					}

					require.Equal(t, "api.user.check_user_login_attempts.too_many.app_error", appErrs[i].Id, "All other errors should be of too many login attempts only.")
				}

				// Password/MFA failure attempts should not breach the maxFailedAttempts
				// even during concurrent access by the same user.
				require.Equal(t, maxFailedLoginAttempts, expectedErrsCount)
			})
		}
	})
}

func TestCheckLdapUserPasswordAndAllCriteria(t *testing.T) {
	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	// update config
	const maxFailedLoginAttempts = 3
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LdapSettings.MaximumLoginAttempts = maxFailedLoginAttempts
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
	})

	mockLdap := &mocks.LdapInterface{}
	th.App.Channels().Ldap = mockLdap

	authData := model.NewRandomString(32)

	// create an ldap user by calling createUser
	ldapUser := &model.User{
		Email:         "ldapuser@mattermost-customer.com",
		Username:      "ldapuser",
		AuthService:   model.UserAuthServiceLdap,
		AuthData:      &authData,
		EmailVerified: true,
	}
	user, appErr := th.App.CreateUser(th.Context, ldapUser)
	require.Nil(t, appErr)
	user.AuthData = &authData

	testCases := []struct {
		name          string
		password      string
		expectedErrID string
		mockDoLogin   func()
	}{
		{
			name:          "valid password",
			password:      "password",
			expectedErrID: "",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, "password").Return(user, nil)
			},
		},
		{
			name:          "invalid password",
			password:      "wrongpassword",
			expectedErrID: "api.user.check_user_password.invalid.app_error",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, "wrongpassword").Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"})
			},
		},
		{
			name:          "too many login attempts",
			password:      "wrongpassword",
			expectedErrID: "api.user.check_user_login_attempts.too_many_ldap.app_error",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, "wrongpassword").Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"}).Once()
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset login attempts
			err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0)
			require.NoError(t, err)

			tc.mockDoLogin()

			ldapUser := user

			// Simulate failed login attempts if necessary
			if tc.expectedErrID == "api.user.check_user_login_attempts.too_many_ldap.app_error" {
				for i := 0; i < maxFailedLoginAttempts-1; i++ {
					_, appErr = th.App.checkLdapUserPasswordAndAllCriteria(th.Context, ldapUser, "wrongpassword", "")
					require.NotNil(t, appErr)
					require.Equal(t, "ent.ldap.do_login.invalid_password.app_error", appErr.Id)
				}
			}
			// Call the method with the test case parameters
			_, appErr := th.App.checkLdapUserPasswordAndAllCriteria(th.Context, ldapUser, tc.password, "")

			// Verify the returned error matches the expected error
			if tc.expectedErrID == "" {
				require.Nil(t, appErr)
			} else {
				require.NotNil(t, appErr)
			}

			if tc.expectedErrID == "api.user.check_user_login_attempts.too_many_ldap.app_error" {
				updatedUser, err := th.App.GetUser(ldapUser.Id)
				require.Nil(t, err)
				require.Equal(t, maxFailedLoginAttempts, updatedUser.FailedAttempts)
			}
		})
	}
}

func TestCheckLdapUserPasswordConcurrency(t *testing.T) {
	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	// update config
	const maxFailedLoginAttempts = 1
	const concurrentAttempts = 10
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.LdapSettings.MaximumLoginAttempts = maxFailedLoginAttempts
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
	})

	authData := model.NewRandomString(32)

	// create an ldap user by calling createUser
	ldapUser := &model.User{
		Email:         "ldapuser@mattermost-customer.com",
		Username:      "ldapuser",
		AuthService:   model.UserAuthServiceLdap,
		AuthData:      &authData,
		EmailVerified: true,
	}
	user, appErr := th.App.CreateUser(th.Context, ldapUser)
	require.Nil(t, appErr)

	// setup MFA
	secret, appErr := th.App.GenerateMfaSecret(user.Id)
	require.Nil(t, appErr)
	err := th.Server.Store().User().UpdateMfaActive(user.Id, true)
	require.NoError(t, err)
	err = th.Server.Store().User().UpdateMfaSecret(user.Id, secret.Secret)
	require.NoError(t, err)

	user, appErr = th.App.GetUser(user.Id)
	require.Nil(t, appErr)
	user.AuthData = &authData

	t.Run("validate concurrent failed attempts to bypass checks", func(t *testing.T) {
		testCases := []struct {
			name                 string
			password             string
			mfaToken             string
			expectedErrID        string
			doLoginExpectedErrID string
		}{
			{
				name:                 "should not breach max. login attempts when password is wrong",
				password:             "wrong password",
				mfaToken:             "",
				doLoginExpectedErrID: "ent.ldap.do_login.invalid_password.app_error",
				expectedErrID:        "ent.ldap.do_login.invalid_password.app_error",
			},
			{
				name:                 "should not breach max. login attempts when MFA is wrong",
				password:             "password",
				mfaToken:             "123456",
				doLoginExpectedErrID: "",
				expectedErrID:        "api.user.check_user_mfa.bad_code.app_error",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				mockLdap := &mocks.LdapInterface{}
				th.App.Channels().Ldap = mockLdap
				// Reset login attempts
				err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0)
				require.NoError(t, err)

				// Capture all concurrent errors
				appErrs := make([]*model.AppError, concurrentAttempts)

				// Wait to complete the test
				var completeWG sync.WaitGroup
				completeWG.Add(concurrentAttempts)

				for i := 0; i < concurrentAttempts; i++ {
					go func(i int) {
						defer completeWG.Done()

						if tc.doLoginExpectedErrID == "ent.ldap.do_login.invalid_password.app_error" {
							mockLdap.Mock.On("DoLogin", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil, &model.AppError{Id: tc.doLoginExpectedErrID})
						} else {
							mockLdap.Mock.On("DoLogin", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string"), tc.password).Return(user, nil)
						}
						_, appErrs[i] = th.App.checkLdapUserPasswordAndAllCriteria(th.Context, user, tc.password, tc.mfaToken)
					}(i)
				}

				completeWG.Wait()

				expectedErrsCount := 0
				for i := 0; i < concurrentAttempts; i++ {
					if appErrs[i].Id == tc.expectedErrID {
						expectedErrsCount++
						continue
					}

					if appErrs[i] != nil {
						require.Equal(t, "api.user.check_user_login_attempts.too_many_ldap.app_error", appErrs[i].Id, "All other errors should be of too many login attempts only.")
					}
				}

				// Password/MFA failure attempts should not breach the maxFailedAttempts
				// even during concurrent access by the same user.
				require.Equal(t, maxFailedLoginAttempts, expectedErrsCount)
			})
		}
	})
}
