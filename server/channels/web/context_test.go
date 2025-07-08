// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

func TestTermsOfServiceExemption(t *testing.T) {
	// Create a minimal context just for path checking - this should work without any setup
	// since the method returns early for ToS endpoints
	c := &Context{}

	// Test various ToS endpoint paths - these should be exempt regardless of other settings
	paths := []string{
		"/api/v4/terms_of_service",
		"/api/v4/users/12345/terms_of_service",
	}

	for _, path := range paths {
		req, _ := http.NewRequest("GET", path, nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err, "ToS endpoint %s should be exempt", path)
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

		mockTermsOfServiceStore.On("GetLatest", true).Return(nil, model.NewAppError("GetLatest", "app.terms_of_service.get.app_error", nil, "", http.StatusNotFound))

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
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
		}

		req, _ := http.NewRequest("GET", "/api/v4/users", nil)
		err := c.TermsOfServiceRequired(req)
		assert.Nil(t, err)
	})
}
