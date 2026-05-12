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
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/hashers"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestParseAuthTokenFromRequest(t *testing.T) {
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const maxFailedLoginAttempts = 3
	const concurrentAttempts = maxFailedLoginAttempts + 1
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.MaximumLoginAttempts = maxFailedLoginAttempts
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
	})

	password := model.NewTestPassword()
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

		updatedUser, appErr := th.App.GetUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "successful login must reset FailedAttempts")
	})

	t.Run("MFA pre-flight probe does not consume a slot", func(t *testing.T) {
		// An empty mfaToken on an MFA-enabled user is a pre-flight probe
		// (the client is checking whether MFA is required) and must not
		// count as a failed attempt.
		err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(th.BasicUser.Id, 0)
		require.NoError(t, err)

		appErr := th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, password, "")
		require.NotNil(t, appErr)
		require.Equal(t, "mfa.validate_token.authenticate.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "MFA probe must not consume a slot")
	})

	t.Run("MFA real attempt with a wrong token consumes a slot", func(t *testing.T) {
		// A non-empty bad mfaToken is a real attempt, not a probe; the
		// slot the pre-claim consumed stays consumed.
		err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(th.BasicUser.Id, 0)
		require.NoError(t, err)

		appErr := th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, password, "123456")
		require.NotNil(t, appErr)
		require.Equal(t, "api.user.check_user_mfa.bad_code.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, updatedUser.FailedAttempts, "real MFA failure must consume a slot")
	})

	t.Run("backend error refunds the slot", func(t *testing.T) {
		// Backend errors during the password check (malformed stored hash,
		// hasher misc failure, migration failure) must not consume a slot
		// or a transient infra issue could lock out a user with valid
		// credentials. We trigger this via an unparseable PHC string,
		// which surfaces as invalid_hash.app_error.
		badHashUser := th.CreateUser(t)
		err := th.Server.Store().User().UpdatePassword(badHashUser.Id, "$pbkdf2$bogus")
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(badHashUser.Id)
		err = th.App.Srv().Store().User().UpdateFailedPasswordAttempts(badHashUser.Id, 0)
		require.NoError(t, err)

		appErr := th.App.CheckPasswordAndAllCriteria(th.Context, badHashUser.Id, "any-password", "")
		require.NotNil(t, appErr)
		require.Equal(t, "api.user.check_user_password.invalid_hash.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(badHashUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "backend error must not consume a slot")
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
				password:      model.NewTestPassword(),
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

				for i := range concurrentAttempts {
					go func(i int) {
						defer completeWG.Done()
						// Simulate concurrent failed login checks by same user
						appErrs[i] = th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, tc.password, tc.mfaToken)
					}(i)
				}

				completeWG.Wait()

				expectedErrsCount := 0
				for i := range concurrentAttempts {
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

func TestDoubleCheckPassword(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const maxFailedLoginAttempts = 3
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.MaximumLoginAttempts = maxFailedLoginAttempts
	})

	password := model.NewTestPassword()
	appErr := th.App.UpdatePassword(th.Context, th.BasicUser, password)
	require.Nil(t, appErr)

	// DoubleCheckPassword does not re-fetch the user; it inspects user.Password
	// directly. Pull a fresh struct that reflects the hash we just wrote.
	user, appErr := th.App.GetUser(th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("correct password succeeds and resets the counter", func(t *testing.T) {
		err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, maxFailedLoginAttempts-1)
		require.NoError(t, err)

		appErr := th.App.DoubleCheckPassword(th.Context, user, password)
		require.Nil(t, appErr)

		updatedUser, appErr := th.App.GetUser(user.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts)
	})

	t.Run("rate limit is enforced once max attempts is reached", func(t *testing.T) {
		err := th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, maxFailedLoginAttempts)
		require.NoError(t, err)

		appErr := th.App.DoubleCheckPassword(th.Context, user, password)
		require.NotNil(t, appErr)
		require.Equal(t, "api.user.check_user_login_attempts.too_many.app_error", appErr.Id)
	})

	t.Run("backend error refunds the slot", func(t *testing.T) {
		badHashUser := th.CreateUser(t)
		err := th.Server.Store().User().UpdatePassword(badHashUser.Id, "$pbkdf2$bogus")
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(badHashUser.Id)
		err = th.App.Srv().Store().User().UpdateFailedPasswordAttempts(badHashUser.Id, 0)
		require.NoError(t, err)

		user, appErr := th.App.GetUser(badHashUser.Id)
		require.Nil(t, appErr)

		appErr = th.App.DoubleCheckPassword(th.Context, user, "any-password")
		require.NotNil(t, appErr)
		require.Equal(t, "api.user.check_user_password.invalid_hash.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(badHashUser.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "backend error must not consume a slot")
	})
}

func TestCheckLdapUserPasswordAndAllCriteria(t *testing.T) {
	th := SetupEnterprise(t).InitBasic(t)

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

	validPassword := model.NewTestPassword()
	wrongPassword := model.NewTestPassword()

	testCases := []struct {
		name          string
		password      string
		expectedErrID string
		mockDoLogin   func()
	}{
		{
			name:          "valid password",
			password:      validPassword,
			expectedErrID: "",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, validPassword).Return(user, nil)
			},
		},
		{
			name:          "invalid password",
			password:      wrongPassword,
			expectedErrID: "api.user.check_user_password.invalid.app_error",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, wrongPassword).Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"})
			},
		},
		{
			name:          "too many login attempts",
			password:      wrongPassword,
			expectedErrID: "api.user.check_user_login_attempts.too_many_ldap.app_error",
			mockDoLogin: func() {
				mockLdap.Mock.On("DoLogin", th.Context, authData, wrongPassword).Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"}).Once()
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
				for range maxFailedLoginAttempts - 1 {
					_, appErr = th.App.checkLdapUserPasswordAndAllCriteria(th.Context, ldapUser, wrongPassword, "")
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

	// The cases below cover paths the table loop above does not exercise:
	// first-time LDAP users (user.Id == ""), LDAP backend errors that are
	// not credential failures, and the MFA pre-flight probe refund. Each
	// subtest builds its own mockLdap so expectations from previous
	// subtests cannot match the wrong call.

	createLdapUserWithMFA := func(t *testing.T, emailLocal string) (*model.User, *string) {
		t.Helper()
		userAuthData := model.NewRandomString(32)
		created, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:         emailLocal + "@mattermost-customer.com",
			Username:      emailLocal,
			AuthService:   model.UserAuthServiceLdap,
			AuthData:      &userAuthData,
			EmailVerified: true,
		})
		require.Nil(t, appErr)
		secret, appErr := th.App.GenerateMfaSecret(created.Id)
		require.Nil(t, appErr)
		require.NoError(t, th.Server.Store().User().UpdateMfaActive(created.Id, true))
		require.NoError(t, th.Server.Store().User().UpdateMfaSecret(created.Id, secret.Secret))
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(created.Id, 0))
		created, appErr = th.App.GetUser(created.Id)
		require.Nil(t, appErr)
		created.AuthData = &userAuthData
		return created, &userAuthData
	}

	t.Run("first-time LDAP user with wrong password increments counter", func(t *testing.T) {
		// DoLogin in production creates the row before reporting a bad
		// password; we pre-create it here so GetUserByAuth can resolve it.
		firstAuthData := model.NewRandomString(32)
		preCreated, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:         "ldapuser-first-bad-pwd@mattermost-customer.com",
			Username:      "ldapuser-first-bad-pwd",
			AuthService:   model.UserAuthServiceLdap,
			AuthData:      &firstAuthData,
			EmailVerified: true,
		})
		require.Nil(t, appErr)
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(preCreated.Id, 0))

		freshMock := &mocks.LdapInterface{}
		th.App.Channels().Ldap = freshMock
		t.Cleanup(func() { th.App.Channels().Ldap = mockLdap })
		freshMock.Mock.On("DoLogin", th.Context, firstAuthData, wrongPassword).Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"})

		_, appErr = th.App.checkLdapUserPasswordAndAllCriteria(th.Context, &model.User{
			AuthService: model.UserAuthServiceLdap,
			AuthData:    &firstAuthData,
		}, wrongPassword, "")
		require.NotNil(t, appErr)
		require.Equal(t, "ent.ldap.do_login.invalid_password.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(preCreated.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, updatedUser.FailedAttempts, "first-time LDAP wrong password must be counted")
	})

	t.Run("first-time LDAP user with wrong MFA token increments counter", func(t *testing.T) {
		// DoLogin returns the freshly created user struct; the function
		// then calls CheckUserMfa, which fails on a wrong non-empty token.
		preCreated, authDataPtr := createLdapUserWithMFA(t, "ldapuser-first-bad-mfa")

		freshMock := &mocks.LdapInterface{}
		th.App.Channels().Ldap = freshMock
		t.Cleanup(func() { th.App.Channels().Ldap = mockLdap })
		freshMock.Mock.On("DoLogin", th.Context, *authDataPtr, validPassword).Return(preCreated, nil)

		_, appErr := th.App.checkLdapUserPasswordAndAllCriteria(th.Context, &model.User{
			AuthService: model.UserAuthServiceLdap,
			AuthData:    authDataPtr,
		}, validPassword, "123456")
		require.NotNil(t, appErr)
		require.Equal(t, "api.user.check_user_mfa.bad_code.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(preCreated.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, updatedUser.FailedAttempts, "first-time LDAP wrong MFA must be counted")
	})

	t.Run("existing LDAP user with LDAP backend error refunds the slot", func(t *testing.T) {
		// A non-credential LDAP error (server unreachable, transient
		// failure) on an existing user must not consume the pre-claimed
		// slot, or an LDAP outage could lock out everyone.
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0))

		freshMock := &mocks.LdapInterface{}
		th.App.Channels().Ldap = freshMock
		t.Cleanup(func() { th.App.Channels().Ldap = mockLdap })
		freshMock.Mock.On("DoLogin", th.Context, authData, wrongPassword).Return(nil, &model.AppError{Id: "ent.ldap.do_login.unable_to_connect.app_error"})

		_, appErr := th.App.checkLdapUserPasswordAndAllCriteria(th.Context, user, wrongPassword, "")
		require.NotNil(t, appErr)
		require.Equal(t, "ent.ldap.do_login.unable_to_connect.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(user.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "LDAP backend error must refund the slot")
	})

	t.Run("existing LDAP user MFA pre-flight probe refunds the slot", func(t *testing.T) {
		// Empty mfaToken on an MFA-enabled LDAP user is a probe; the slot
		// the pre-claim consumed is refunded.
		preCreated, authDataPtr := createLdapUserWithMFA(t, "ldapuser-existing-mfa-probe")

		freshMock := &mocks.LdapInterface{}
		th.App.Channels().Ldap = freshMock
		t.Cleanup(func() { th.App.Channels().Ldap = mockLdap })
		freshMock.Mock.On("DoLogin", th.Context, *authDataPtr, validPassword).Return(preCreated, nil)

		_, appErr := th.App.checkLdapUserPasswordAndAllCriteria(th.Context, preCreated, validPassword, "")
		require.NotNil(t, appErr)
		require.Equal(t, "mfa.validate_token.authenticate.app_error", appErr.Id)

		updatedUser, appErr := th.App.GetUser(preCreated.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, updatedUser.FailedAttempts, "MFA probe on existing LDAP user must not consume a slot")
	})

	t.Run("concurrent first-time LDAP wrong password caps at maxAttempts", func(t *testing.T) {
		// A first-time LDAP user has no local row yet, so the slot is
		// not pre-claimed. The fallback counter bump must use the atomic
		// TryIncrement primitive: a previous implementation used an
		// absolute UPDATE Users SET FailedAttempts = ldapUser.FailedAttempts + 1
		// based on an in-memory snapshot, which lost increments when
		// concurrent first-attempt requests all read FailedAttempts = 0
		// and all wrote 1. Under the atomic primitive the counter caps
		// at maxFailedLoginAttempts regardless of contention.
		concurrentAuthData := model.NewRandomString(32)
		preCreated, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:         "ldapuser-first-bad-pwd-conc@mattermost-customer.com",
			Username:      "ldapuser-first-bad-pwd-conc",
			AuthService:   model.UserAuthServiceLdap,
			AuthData:      &concurrentAuthData,
			EmailVerified: true,
		})
		require.Nil(t, appErr)
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(preCreated.Id, 0))

		freshMock := &mocks.LdapInterface{}
		th.App.Channels().Ldap = freshMock
		t.Cleanup(func() { th.App.Channels().Ldap = mockLdap })
		freshMock.Mock.On("DoLogin", th.Context, concurrentAuthData, wrongPassword).Return(nil, &model.AppError{Id: "ent.ldap.do_login.invalid_password.app_error"})

		const goroutines = maxFailedLoginAttempts * 3
		var g errgroup.Group
		start := make(chan struct{})
		for range goroutines {
			g.Go(func() error {
				<-start
				_, _ = th.App.checkLdapUserPasswordAndAllCriteria(th.Context, &model.User{
					AuthService: model.UserAuthServiceLdap,
					AuthData:    &concurrentAuthData,
				}, wrongPassword, "")
				return nil
			})
		}
		close(start)
		require.NoError(t, g.Wait())

		updatedUser, appErr := th.App.GetUser(preCreated.Id)
		require.Nil(t, appErr)
		require.Equal(t, maxFailedLoginAttempts, updatedUser.FailedAttempts, "concurrent first-time attempts must not lose increments and must cap at maxAttempts")
	})
}

func TestCheckLdapUserPasswordConcurrency(t *testing.T) {
	th := SetupEnterprise(t).InitBasic(t)

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

	wrongPassword := model.NewTestPassword()
	validPassword := model.NewTestPassword()

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
				password:             wrongPassword,
				mfaToken:             "",
				doLoginExpectedErrID: "ent.ldap.do_login.invalid_password.app_error",
				expectedErrID:        "ent.ldap.do_login.invalid_password.app_error",
			},
			{
				name:                 "should not breach max. login attempts when MFA is wrong",
				password:             validPassword,
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

				for i := range concurrentAttempts {
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
				for i := range concurrentAttempts {
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

func TestCheckUserPassword(t *testing.T) {
	th := Setup(t).InitBasic(t)

	pwd := model.NewTestPassword()
	pwdBcryptBytes, err := bcrypt.GenerateFromPassword([]byte(pwd), 10)
	require.NoError(t, err)
	pwdBcrypt := string(pwdBcryptBytes)
	pwdPBKDF2, err := hashers.Hash(pwd)
	require.NoError(t, err)

	createUserWithHash := func(hash string) *model.User {
		t.Helper()

		user := th.CreateUser(t)

		// Update the hash directly in the store (otherwise the app hashes it)
		err := th.Server.Store().User().UpdatePassword(user.Id, hash)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		updatedUser, appErr := th.App.GetUser(user.Id)
		require.Nil(t, appErr)
		require.Equal(t, hash, updatedUser.Password)

		return updatedUser
	}

	t.Run("valid password with current hashing", func(t *testing.T) {
		user := createUserWithHash(pwdPBKDF2)
		err := th.App.checkUserPassword(user, pwd)
		require.Nil(t, err)
	})

	wrongPassword := model.NewTestPassword()

	t.Run("invalid password", func(t *testing.T) {
		user := createUserWithHash(pwdPBKDF2)

		err := th.App.checkUserPassword(user, wrongPassword)
		require.NotNil(t, err)
		require.Equal(t, "api.user.check_user_password.invalid.app_error", err.Id)
	})

	t.Run("password migration from outdated hash", func(t *testing.T) {
		user := createUserWithHash(pwdBcrypt)
		require.Contains(t, user.Password, "$2a$10")
		require.NotContains(t, user.Password, "pbkdf2")

		err := th.App.checkUserPassword(user, pwd)
		require.Nil(t, err)

		updatedUser, err := th.App.GetUser(user.Id)
		require.Nil(t, err)
		require.NotEqual(t, pwdBcrypt, updatedUser.Password)
		require.Contains(t, updatedUser.Password, "$pbkdf2")

		// Re-check with updated password
		err = th.App.checkUserPassword(updatedUser, pwd)
		require.Nil(t, err)
	})

	t.Run("password migration fails with invalid password", func(t *testing.T) {
		user := createUserWithHash(pwdBcrypt)

		err := th.App.checkUserPassword(user, wrongPassword)
		require.NotNil(t, err)
		require.Equal(t, "api.user.check_user_password.invalid.app_error", err.Id)
	})

	t.Run("empty password", func(t *testing.T) {
		user := createUserWithHash(pwdPBKDF2)

		user, err := th.App.GetUser(user.Id)
		require.Nil(t, err)

		err = th.App.checkUserPassword(user, "")
		require.NotNil(t, err)
		require.Equal(t, "api.user.check_user_password.invalid.app_error", err.Id)
	})

	t.Run("user with empty password hash", func(t *testing.T) {
		user := createUserWithHash("")

		user, err := th.App.GetUser(user.Id)
		require.Nil(t, err)

		err = th.App.checkUserPassword(user, pwd)
		require.NotNil(t, err)
		require.Equal(t, "api.user.check_user_password.invalid.app_error", err.Id)
	})

	t.Run("successful migration from PBKDF2 with old parameter to new parameter", func(t *testing.T) {
		// Create a PBKDF2 hasher with work factor = 10000 instead of the default
		oldParamPBKDF2, err := hashers.NewPBKDF2(10000, 32)
		require.NoError(t, err)

		pwdOldParamPBKDF2, err := oldParamPBKDF2.Hash(pwd)
		require.NoError(t, err)

		user := createUserWithHash(pwdOldParamPBKDF2)
		require.Contains(t, user.Password, "$pbkdf2")
		// The user hash contains the old parameter
		require.Contains(t, user.Password, "w=10000")

		appErr := th.App.checkUserPassword(user, pwd)
		require.Nil(t, appErr)

		updatedUser, appErr := th.App.GetUser(user.Id)
		require.Nil(t, appErr)
		require.NotEqual(t, pwdBcrypt, updatedUser.Password)
		require.Contains(t, updatedUser.Password, "$pbkdf2")
		// The new user hash should NOT contain the old parameter
		require.NotContains(t, updatedUser.Password, "w=10000")

		// Re-check with updated password
		appErr = th.App.checkUserPassword(updatedUser, pwd)
		require.Nil(t, appErr)
	})
}

func TestMigratePassword(t *testing.T) {
	th := Setup(t).InitBasic(t)

	pwd := model.NewTestPassword()
	pwdBcryptBytes, err := bcrypt.GenerateFromPassword([]byte(pwd), 10)
	require.NoError(t, err)
	pwdBcrypt := string(pwdBcryptBytes)

	createUserWithHash := func(hash string) *model.User {
		t.Helper()

		user := th.CreateUser(t)

		// Update the hash directly in the store (otherwise the app hashes it)
		err := th.Server.Store().User().UpdatePassword(user.Id, hash)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		updatedUser, appErr := th.App.GetUser(user.Id)
		require.Nil(t, appErr)
		require.Equal(t, hash, updatedUser.Password)

		return updatedUser
	}

	t.Run("successful migration from BCrypt to PBKDF2", func(t *testing.T) {
		user := createUserWithHash(pwdBcrypt)

		err := th.App.migratePassword(user, pwd)
		require.Nil(t, err)

		updatedUser, err := th.App.GetUser(user.Id)
		require.Nil(t, err)
		require.NotEqual(t, pwdBcrypt, updatedUser.Password)
		require.Contains(t, updatedUser.Password, "$pbkdf2")

		// Re-check with updated password
		err = th.App.checkUserPassword(updatedUser, pwd)
		require.Nil(t, err)
	})
}
