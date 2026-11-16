// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestBookmarkStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	bookmarkMock := &storemocks.ChannelBookmarkStore{}
	mockStore.On("ChannelBookmark").Return(bookmarkMock)

	for _, tc := range []struct {
		err    error
		id     string
		status int
	}{
		{fmt.Errorf("query: %w", store.NewErrInvalidInput("ChannelBookmark", "id", "x")), "app.channel.bookmark.update_sort.invalid_input.app_error", http.StatusBadRequest},
		{fmt.Errorf("query: %w", store.NewErrNotFound("ChannelBookmark", model.NewId())), "app.channel.bookmark.update_sort.missing_bookmark.app_error", http.StatusNotFound},
		{errors.New("db down"), "app.channel.bookmark.update_sort.app_error", http.StatusInternalServerError},
	} {
		bookmarkMock.On("UpdateSortOrder", mock.Anything, mock.Anything, mock.Anything).Return(nil, tc.err).Once()
		_, appErr := th.App.UpdateChannelBookmarkSortOrder(model.NewId(), model.NewId(), 0, "")
		require.NotNil(t, appErr)
		assert.Equal(t, tc.id, appErr.Id)
		assert.Equal(t, tc.status, appErr.StatusCode)
		assert.ErrorIs(t, appErr, tc.err)
	}
}

func TestComplianceStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
		*cfg.ComplianceSettings.Enable = true
	})
	license := model.NewTestLicense()
	*license.Features.Compliance = true
	th.App.Srv().SetLicense(license)
	th.App.Channels().Compliance = &einterfacesmocks.ComplianceInterface{}

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	complianceMock := &storemocks.ComplianceStore{}
	mockStore.On("Compliance").Return(complianceMock)

	plain := errors.New("db down")
	wrapped := model.NewAppError("Save", "app.custom.error", nil, "", http.StatusTeapot)

	t.Run("SaveComplianceReport", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.compliance.save.saving.app_error", http.StatusInternalServerError},
		} {
			complianceMock.On("Save", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.SaveComplianceReport(th.Context, &model.Compliance{})
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("GetComplianceReport", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			status int
		}{
			{fmt.Errorf("query: %w", store.NewErrNotFound("Compliance", model.NewId())), http.StatusNotFound},
			{plain, http.StatusInternalServerError},
		} {
			complianceMock.On("Get", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.GetComplianceReport(model.NewId())
			require.NotNil(t, appErr)
			assert.Equal(t, "app.compliance.get.finding.app_error", appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})
}

func TestGetUploadSessionStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	uploadMock := &storemocks.UploadSessionStore{}
	mockStore.On("UploadSession").Return(uploadMock)

	for _, tc := range []struct {
		err    error
		status int
	}{
		{fmt.Errorf("query: %w", store.NewErrNotFound("UploadSession", model.NewId())), http.StatusNotFound},
		{errors.New("db down"), http.StatusInternalServerError},
	} {
		uploadMock.On("Get", mock.Anything, mock.Anything).Return(nil, tc.err).Once()
		_, appErr := th.App.GetUploadSession(th.Context, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.upload.get.app_error", appErr.Id)
		assert.Equal(t, tc.status, appErr.StatusCode)
	}
}

func TestIsPasswordValidErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
		*cfg.PasswordSettings.MinimumLength = 10
	})

	appErr := th.App.IsPasswordValid(th.Context, "short")
	require.NotNil(t, appErr)
	assert.Equal(t, "model.user.is_valid.pwd_min_length.app_error", appErr.Id)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

	assert.Nil(t, th.App.IsPasswordValid(th.Context, "a-long-enough-password-1A"))
}

func TestCheckPasswordAndAllCriteriaRefundsBackendErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const maxAttempts = 5
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.MaximumLoginAttempts = maxAttempts
	})

	password := model.NewTestPassword()
	require.Nil(t, th.App.UpdatePassword(th.Context, th.BasicUser, password))

	failedAttempts := func(userID string) int {
		t.Helper()
		user, appErr := th.App.GetUser(th.Context, userID)
		require.Nil(t, appErr)
		return user.FailedAttempts
	}

	t.Run("credential mismatch keeps the slot", func(t *testing.T) {
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(th.BasicUser.Id, 0))
		th.App.InvalidateCacheForUser(th.BasicUser.Id)

		appErr := th.App.CheckPasswordAndAllCriteria(th.Context, th.BasicUser.Id, "wrong-"+password, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.user.check_user_password.invalid.app_error", appErr.Id)
		assert.Equal(t, 1, failedAttempts(th.BasicUser.Id))
	})

	t.Run("backend error refunds the slot", func(t *testing.T) {
		badHashUser := th.CreateUser(t)
		require.NoError(t, th.Server.Store().User().UpdatePassword(badHashUser.Id, "$pbkdf2$bogus"))
		th.App.InvalidateCacheForUser(badHashUser.Id)
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(badHashUser.Id, 0))

		appErr := th.App.CheckPasswordAndAllCriteria(th.Context, badHashUser.Id, "any-password", "")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.user.check_user_password.invalid_hash.app_error", appErr.Id)
		assert.Equal(t, 0, failedAttempts(badHashUser.Id))
	})
}
