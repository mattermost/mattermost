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
)

func TestDraftJobStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)

	notFound := fmt.Errorf("wrap: %w", store.NewErrNotFound("Thing", model.NewId()))
	plain := errors.New("db down")

	t.Run("GetDraft", func(t *testing.T) {
		draftMock := &storemocks.DraftStore{}
		mockStore.On("Draft").Return(draftMock)
		for _, tc := range []struct {
			err    error
			status int
		}{
			{notFound, http.StatusNotFound},
			{plain, http.StatusInternalServerError},
		} {
			draftMock.On("Get", mock.Anything, mock.Anything, mock.Anything, false).Return(nil, tc.err).Once()
			_, appErr := th.App.GetDraft(model.NewId(), model.NewId(), "")
			require.NotNil(t, appErr)
			assert.Equal(t, "app.draft.get.app_error", appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
			assert.ErrorIs(t, appErr, tc.err)
		}
	})

	t.Run("GetJob", func(t *testing.T) {
		jobMock := &storemocks.JobStore{}
		mockStore.On("Job").Return(jobMock)
		for _, tc := range []struct {
			err    error
			status int
		}{
			{notFound, http.StatusNotFound},
			{plain, http.StatusInternalServerError},
		} {
			jobMock.On("Get", mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.GetJob(th.Context, model.NewId())
			require.NotNil(t, appErr)
			assert.Equal(t, "app.job.get.app_error", appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
			assert.ErrorIs(t, appErr, tc.err)
		}
	})

	t.Run("SaveAdminNotifyData", func(t *testing.T) {
		notifyMock := &storemocks.NotifyAdminStore{}
		mockStore.On("NotifyAdmin").Return(notifyMock)
		for _, tc := range []struct {
			err    error
			status int
		}{
			{notFound, http.StatusNotFound},
			{plain, http.StatusInternalServerError},
		} {
			notifyMock.On("Save", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{})
			require.NotNil(t, appErr)
			assert.Equal(t, "app.notify_admin.save.app_error", appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})
}

func TestPreferenceReportingStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	plain := errors.New("db down")

	t.Run("UpdatePreferences", func(t *testing.T) {
		preferenceMock := &storemocks.PreferenceStore{}
		mockStore.On("Preference").Return(preferenceMock)
		inner := model.NewAppError("Save", "app.custom.error", nil, "", http.StatusTeapot)
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{fmt.Errorf("wrap: %w", inner), "app.custom.error", http.StatusTeapot},
			{plain, "app.preference.save.updating.app_error", http.StatusBadRequest},
		} {
			preferenceMock.On("Save", mock.Anything).Return(tc.err).Once()
			appErr := th.App.UpdatePreferences(th.Context, "user1", model.Preferences{{UserId: "user1", Category: "c", Name: "n", Value: "v"}})
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("GetPostsForReporting", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		postMock := &storemocks.PostStore{}
		mockStore.On("Post").Return(postMock)
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{fmt.Errorf("wrap: %w", store.NewErrInvalidInput("Post", "id", "x")), "app.post.get_posts_for_reporting.invalid_input_error", http.StatusBadRequest},
			{plain, "app.post.get_posts_for_reporting.app_error", http.StatusInternalServerError},
		} {
			postMock.On("GetPostsForReporting", mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.GetPostsForReporting(th.Context, model.ReportPostQueryParams{}, false)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
			assert.ErrorIs(t, appErr, tc.err)
		}
	})
}
