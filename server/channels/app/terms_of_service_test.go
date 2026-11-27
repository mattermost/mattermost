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

func TestTermsOfServiceStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	mockStore := &storemocks.Store{}
	tosMock := &storemocks.TermsOfServiceStore{}
	userTosMock := &storemocks.UserTermsOfServiceStore{}
	mockStore.On("Close").Return(nil)
	mockStore.On("TermsOfService").Return(tosMock)
	mockStore.On("UserTermsOfService").Return(userTosMock)
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	userID := th.BasicUser.Id

	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("TermsOfService", model.NewId()))
	invalid := fmt.Errorf("query: %w", store.NewErrInvalidInput("TermsOfService", "Id", "x"))
	plain := errors.New("db down")
	wrapped := model.NewAppError("Save", "app.custom.error", nil, "", http.StatusTeapot)

	t.Run("CreateTermsOfService", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{invalid, "app.terms_of_service.create.existing.app_error", http.StatusBadRequest},
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.terms_of_service.create.app_error", http.StatusInternalServerError},
		} {
			tosMock.On("Save", mock.Anything).Return(&model.TermsOfService{Id: model.NewId()}, tc.err).Once()
			_, appErr := th.App.CreateTermsOfService(th.Context, "text", userID)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("GetLatestTermsOfService and GetTermsOfService", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.terms_of_service.get.no_rows.app_error", http.StatusNotFound},
			{plain, "app.terms_of_service.get.app_error", http.StatusInternalServerError},
		} {
			tosMock.On("GetLatest", true).Return(nil, tc.err).Once()
			_, appErr := th.App.GetLatestTermsOfService()
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)

			tosMock.On("Get", mock.Anything, true).Return(nil, tc.err).Once()
			_, appErr = th.App.GetTermsOfService(model.NewId())
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("GetUserTermsOfService", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.user_terms_of_service.get_by_user.no_rows.app_error", http.StatusNotFound},
			{plain, "app.user_terms_of_service.get_by_user.app_error", http.StatusInternalServerError},
		} {
			userTosMock.On("GetByUser", userID).Return(nil, tc.err).Once()
			_, appErr := th.App.GetUserTermsOfService(userID)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("SaveUserTermsOfService", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.user_terms_of_service.save.app_error", http.StatusInternalServerError},
		} {
			userTosMock.On("Save", mock.Anything).Return(nil, tc.err).Once()
			appErr := th.App.SaveUserTermsOfService(userID, model.NewId(), true)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})
}
