// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// TestSchemeStoreErrorClassification covers the store-error branches in the scheme
// helpers: a store *AppError is returned as-is, ErrInvalidInput and ErrNotFound map
// to their specific app errors, and any other error falls through to the generic one.
func TestSchemeStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)

	system := &storemocks.SystemStore{}
	system.On("GetByName", model.MigrationKeyAdvancedPermissionsPhase2).Return(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"}, nil)
	mockStore.On("System").Return(system)

	var schemeBinding *mock.Call
	bindScheme := func(schemeStore *storemocks.SchemeStore) {
		t.Helper()
		if schemeBinding != nil {
			schemeBinding.Unset()
		}
		schemeBinding = mockStore.On("Scheme").Return(schemeStore)
	}

	// Wrap ErrInvalidInput so a swapped branch would classify this as invalid input
	// instead of returning the store's AppError.
	storeAppErr := func() *model.AppError {
		return model.NewAppError("store", "custom.scheme.app_error", nil, "", http.StatusTeapot).Wrap(store.NewErrInvalidInput("Scheme", "Name", "preset"))
	}
	invalidInput := func() error {
		return store.NewErrInvalidInput("Scheme", "Name", "preset")
	}
	notFound := func() error {
		return fmt.Errorf("query: %w", store.NewErrNotFound("Scheme", model.NewId()))
	}
	plain := func() error {
		return errors.New("db down")
	}

	requireMapped := func(t *testing.T, got *model.AppError, id string, status int, cause error) {
		t.Helper()
		require.NotNil(t, got)
		assert.Equal(t, id, got.Id)
		assert.Equal(t, status, got.StatusCode)
		assert.ErrorIs(t, got, cause)
	}

	newScheme := func() *model.Scheme {
		return &model.Scheme{
			Name:        "test-scheme",
			DisplayName: "Test Scheme",
			Scope:       model.SchemeScopeTeam,
		}
	}

	t.Run("GetScheme", func(t *testing.T) {
		cause := notFound()
		schemeStore := &storemocks.SchemeStore{}
		schemeStore.On("Get", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got := th.App.GetScheme(model.NewId())
		requireMapped(t, got, "app.scheme.get.app_error", http.StatusNotFound, cause)

		cause = plain()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Get", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.GetScheme(model.NewId())
		requireMapped(t, got, "app.scheme.get.app_error", http.StatusInternalServerError, cause)
	})

	t.Run("GetSchemeByName", func(t *testing.T) {
		cause := notFound()
		schemeStore := &storemocks.SchemeStore{}
		schemeStore.On("GetByName", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got := th.App.GetSchemeByName("test-scheme")
		requireMapped(t, got, "app.scheme.get.app_error", http.StatusNotFound, cause)

		cause = plain()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("GetByName", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.GetSchemeByName("test-scheme")
		requireMapped(t, got, "app.scheme.get.app_error", http.StatusInternalServerError, cause)
	})

	t.Run("CreateScheme", func(t *testing.T) {
		sent := storeAppErr()
		schemeStore := &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), sent).Once()
		bindScheme(schemeStore)
		_, got := th.App.CreateScheme(newScheme())
		require.Same(t, sent, got)

		cause := invalidInput()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.CreateScheme(newScheme())
		requireMapped(t, got, "app.scheme.save.invalid_scheme.app_error", http.StatusBadRequest, cause)

		cause = plain()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.CreateScheme(newScheme())
		requireMapped(t, got, "app.scheme.save.app_error", http.StatusInternalServerError, cause)
	})

	t.Run("UpdateScheme", func(t *testing.T) {
		sent := storeAppErr()
		schemeStore := &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), sent).Once()
		bindScheme(schemeStore)
		_, got := th.App.UpdateScheme(newScheme())
		require.Same(t, sent, got)

		cause := invalidInput()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.UpdateScheme(newScheme())
		requireMapped(t, got, "app.scheme.save.invalid_scheme.app_error", http.StatusBadRequest, cause)

		cause = plain()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Save", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.UpdateScheme(newScheme())
		requireMapped(t, got, "app.scheme.save.app_error", http.StatusInternalServerError, cause)
	})

	t.Run("DeleteScheme", func(t *testing.T) {
		cause := notFound()
		schemeStore := &storemocks.SchemeStore{}
		schemeStore.On("Delete", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got := th.App.DeleteScheme(model.NewId())
		requireMapped(t, got, "app.scheme.get.app_error", http.StatusNotFound, cause)

		cause = plain()
		schemeStore = &storemocks.SchemeStore{}
		schemeStore.On("Delete", mock.Anything).Return((*model.Scheme)(nil), cause).Once()
		bindScheme(schemeStore)
		_, got = th.App.DeleteScheme(model.NewId())
		requireMapped(t, got, "app.scheme.delete.app_error", http.StatusInternalServerError, cause)
	})
}
