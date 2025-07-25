// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestRequireHookId(t *testing.T) {
	c := &Context{}
	t.Run("WhenHookIdIsValid", func(t *testing.T) {
		c.Params = &Params{HookId: "abcdefghijklmnopqrstuvwxyz"}
		c.RequireHookId()

		require.Nil(t, c.Err, "Hook Id is Valid. Should not have set error in context")
	})

	t.Run("WhenHookIdIsInvalid", func(t *testing.T) {
		c.Params = &Params{HookId: "abc"}
		c.RequireHookId()

		require.NotNil(t, c.Err, "Should have set Error in context")
		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode, "Should have set status as 400")
	})
}

func TestCloudKeyRequired(t *testing.T) {
	th := SetupWithStoreMock(t)

	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

	c := &Context{
		App:        th.App,
		AppContext: th.Context,
	}

	c.CloudKeyRequired()

	assert.Equal(t, c.Err.Id, "api.context.session_expired.app_error")
}

func TestMfaRequired(t *testing.T) {
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("Get", context.Background(), "userid").Return(nil, model.NewAppError("Userstore.Get", "storeerror", nil, "store error", http.StatusInternalServerError))
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.Srv().SetLicense(model.NewTestLicense("mfa"))

	th.Context = th.Context.WithSession(&model.Session{Id: "abc", UserId: "userid"})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AnnouncementSettings.UserNoticesEnabled = false
		*cfg.AnnouncementSettings.AdminNoticesEnabled = false
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
	})

	c := &Context{
		App:        th.App,
		AppContext: th.Context,
	}

	c.MfaRequired()

	assert.Equal(t, c.Err.Id, "api.context.get_user.app_error")
}

func TestIsExactPathMatch(t *testing.T) {
	exemptPaths := []string{
		"/api/v4/terms_of_service",
		"/api/v4/config",
	}

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{"exact match", "/api/v4/terms_of_service", true},
		{"exact match config", "/api/v4/config", true},
		{"no match", "/api/v4/users", false},
		{"partial match", "/api/v4/terms_of_service/extra", false},
		{"prefix match", "prefix/api/v4/terms_of_service", false},
		{"empty path", "", false},
		{"trailing slash cleaned", "/api/v4/terms_of_service/", true},
		{"double slash cleaned", "/api/v4//terms_of_service", true},
		{"current dir cleaned", "/api/v4/./terms_of_service", true},
		{"path traversal cleaned", "/api/v4/../v4/terms_of_service", true},
		{"case sensitive no match", "/api/v4/TERMS_OF_SERVICE", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isExactPathMatch(tt.path, exemptPaths)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMatchesUserToSPattern(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		expectedId string
		expectedOk bool
	}{
		{
			name:       "valid user ToS resource",
			path:       "/api/v4/users/abcdefghijklmnopqrstuvwxyz/terms_of_service",
			expectedId: "abcdefghijklmnopqrstuvwxyz",
			expectedOk: true,
		},
		{
			name:       "valid user ToS with uppercase",
			path:       "/api/v4/users/USER123ABCDEFGHIJKLMNOPQRS/terms_of_service",
			expectedId: "USER123ABCDEFGHIJKLMNOPQRS",
			expectedOk: true,
		},
		{
			name:       "wrong prefix version",
			path:       "/api/v5/users/abcdefghijklmnopqrstuvwxyz/terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "wrong suffix",
			path:       "/api/v4/users/abcdefghijklmnopqrstuvwxyz/preferences",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "extra path segments",
			path:       "/api/v4/users/abcdefghijklmnopqrstuvwxyz/extra/terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "bypass attempt with dots",
			path:       "/api/v4/users/../admin/terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "empty user id",
			path:       "/api/v4/users//terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "invalid user id with special chars",
			path:       "/api/v4/users/user@example.com/terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
		{
			name:       "user id with spaces",
			path:       "/api/v4/users/user with spaces/terms_of_service",
			expectedId: "",
			expectedOk: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userId, ok := matchesUserToSPattern(tt.path)
			assert.Equal(t, tt.expectedOk, ok)
			assert.Equal(t, tt.expectedId, userId)
		})
	}
}

func TestTermsOfServiceExemption(t *testing.T) {
	// Create a minimal context just for path checking
	c := &Context{}

	// Test various ToS endpoint paths - these should be exempt regardless of other settings
	validPaths := []string{
		"/api/v4/terms_of_service",
		"/api/v4/users/abcdefghijklmnopqrstuvwxyz/terms_of_service",
		"/api/v4/users/USER123ABCDEFGHIJKLMNOPQRS/terms_of_service",
	}

	for _, path := range validPaths {
		exempt := c.isTermsOfServiceExemptEndpoint(path)
		assert.True(t, exempt, "ToS endpoint %s should be exempt", path)
	}

	// Test path bypass attempts - these should NOT be exempt
	bypassAttempts := []string{
		"/api/v4/TERMS_OF_SERVICE",                        // case sensitive
		"/api/v4/users//terms_of_service",                 // empty user id
		"/api/v4/users/user@example.com/terms_of_service", // invalid chars in user id
		"/api/v4/users/user with spaces/terms_of_service", // spaces in user id
		"/api/v4/some_terms_of_service_endpoint",          // similar but different path
		"/api/v4/terms_of_service_but_not_really",         // similar but different path
		"/api/v4/users/abc/extra/terms_of_service",        // extra path segments
		"/api/v4/users", // incomplete path
	}

	// Note: Paths like "/api/v4/users/../terms_of_service" and "/api/v4/endpoint/../terms_of_service"
	// are cleaned by filepath.Clean() to "/api/v4/terms_of_service" which correctly matches
	// the exempt path. This is the intended security behavior.

	for _, path := range bypassAttempts {
		exempt := c.isTermsOfServiceExemptEndpoint(path)
		assert.False(t, exempt, "Path %s should NOT be exempt (potential bypass attempt)", path)
	}
}

func TestTermsOfServiceRequired(t *testing.T) {
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockTermsOfServiceStore := mocks.TermsOfServiceStore{}
	mockUserTermsOfServiceStore := mocks.UserTermsOfServiceStore{}
	mockUserStore := mocks.UserStore{}
	mockPostStore := mocks.PostStore{}
	mockSystemStore := mocks.SystemStore{}

	mockUserStore.On("Count", mock.Anything).Return(int64(1), nil)
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	// Default GetLatest mock that returns error (no ToS exists) - will be overridden by individual tests
	mockTermsOfServiceStore.On("GetLatest", mock.Anything).Return(nil, model.NewAppError("", "app.terms_of_service.get_latest.app_error", nil, "", http.StatusNotFound))

	mockStore.On("TermsOfService").Return(&mockTermsOfServiceStore)
	mockStore.On("UserTermsOfService").Return(&mockUserTermsOfServiceStore)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	userId := "testuser123"
	session := &model.Session{Id: "abc", UserId: userId}
	th.Context = th.Context.WithSession(session)

	t.Run("when custom ToS is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = false
		})

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err)
	})

	t.Run("when license feature is not available", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		// Set license without CustomTermsOfService feature
		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(false)
		th.App.Srv().SetLicense(license)

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err)
	})

	t.Run("when no ToS exists", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(true)
		th.App.Srv().SetLicense(license)

		// Clear mock expectations for this test
		mockTermsOfServiceStore.ExpectedCalls = nil
		// Use proper store.ErrNotFound instead of AppError
		notFoundErr := store.NewErrNotFound("terms_of_service", "latest")
		mockTermsOfServiceStore.On("GetLatest", true).Return(nil, notFoundErr)

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err)
	})

	t.Run("when user has not accepted ToS", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(true)
		th.App.Srv().SetLicense(license)

		latestToS := &model.TermsOfService{Id: "latest_tos_id"}
		// Override the default GetLatest mock for this specific test
		mockTermsOfServiceStore.ExpectedCalls = nil
		mockTermsOfServiceStore.On("GetLatest", true).Return(latestToS, nil)
		mockUserTermsOfServiceStore.On("GetByUser", userId).Return(nil, model.NewAppError("GetByUser", "app.user_terms_of_service.get_by_user.app_error", nil, "", http.StatusNotFound))

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.NotNil(t, err)
		assert.Equal(t, "api.context.terms_of_service_required.app_error", err.Id)
		assert.Equal(t, http.StatusForbidden, err.StatusCode)
	})

	t.Run("when user has accepted old ToS version", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(true)
		th.App.Srv().SetLicense(license)

		latestToS := &model.TermsOfService{Id: "latest_tos_id"}
		oldUserToS := &model.UserTermsOfService{UserId: userId, TermsOfServiceId: "old_tos_id"}

		mockTermsOfServiceStore.On("GetLatest", true).Return(latestToS, nil)
		mockUserTermsOfServiceStore.On("GetByUser", userId).Return(oldUserToS, nil)

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.NotNil(t, err)
		assert.Equal(t, "api.context.terms_of_service_required.app_error", err.Id)
		assert.Equal(t, http.StatusForbidden, err.StatusCode)
	})

	t.Run("when user has accepted latest ToS", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(true)
		th.App.Srv().SetLicense(license)

		latestToS := &model.TermsOfService{Id: "latest_tos_id"}
		currentUserToS := &model.UserTermsOfService{UserId: userId, TermsOfServiceId: "latest_tos_id"}

		// Clear mock expectations for this test
		mockTermsOfServiceStore.ExpectedCalls = nil
		mockUserTermsOfServiceStore.ExpectedCalls = nil
		mockTermsOfServiceStore.On("GetLatest", true).Return(latestToS, nil)
		mockUserTermsOfServiceStore.On("GetByUser", userId).Return(currentUserToS, nil)

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err)
	})

	t.Run("when database error occurs (fail-closed security)", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.SupportSettings.CustomTermsOfServiceEnabled = true
		})

		license := model.NewTestLicense()
		license.Features.CustomTermsOfService = model.NewPointer(true)
		th.App.Srv().SetLicense(license)

		// Simulate database error (not NotFound)
		mockTermsOfServiceStore.ExpectedCalls = nil
		dbError := errors.New("database connection failed")
		mockTermsOfServiceStore.On("GetLatest", true).Return(nil, dbError)

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     mlog.CreateConsoleTestLogger(t),
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		// Should fail closed on database error
		assert.NotNil(t, err)
		assert.Equal(t, "api.context.terms_of_service_required.app_error", err.Id)
		assert.Equal(t, http.StatusForbidden, err.StatusCode)
		assert.Equal(t, "", err.DetailedError)
	})
}
