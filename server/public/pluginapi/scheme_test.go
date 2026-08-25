package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestSchemeGetOrCreateChannelScheme(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		user := []string{model.PermissionReadChannel.Id}
		admin := []string{model.PermissionManageChannelRoles.Id}
		guest := []string{model.PermissionReadChannel.Id}
		api.On("GetOrCreatePluginChannelScheme", user, admin, guest).Return(&model.Scheme{Id: "1"}, nil)

		scheme, err := client.Scheme.GetOrCreateChannelScheme(user, admin, guest)
		require.NoError(t, err)
		require.Equal(t, "1", scheme.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusInternalServerError)
		api.On("GetOrCreatePluginChannelScheme", []string(nil), []string(nil), []string(nil)).Return(nil, appErr)

		scheme, err := client.Scheme.GetOrCreateChannelScheme(nil, nil, nil)
		require.Equal(t, appErr, err)
		require.Zero(t, scheme)
	})
}

func TestSchemeGetByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetSchemeByName", "docs_space_contribute").Return(&model.Scheme{Id: "1", Name: "docs_space_contribute"}, nil)

		scheme, err := client.Scheme.GetByName("docs_space_contribute")
		require.NoError(t, err)
		require.Equal(t, "1", scheme.Id)
	})

	// A not-found AppError is normalized to the package sentinel so plugins can
	// test for it without unwrapping a *model.AppError.
	t.Run("not found", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusNotFound)
		api.On("GetSchemeByName", "unknown").Return(nil, appErr)

		scheme, err := client.Scheme.GetByName("unknown")
		require.ErrorIs(t, err, pluginapi.ErrNotFound)
		require.Zero(t, scheme)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusInternalServerError)
		api.On("GetSchemeByName", "boom").Return(nil, appErr)

		scheme, err := client.Scheme.GetByName("boom")
		require.Equal(t, appErr, err)
		require.Zero(t, scheme)
	})
}

func TestSchemeGetRolesForChannel(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetSchemeRolesForChannel", "chan").Return("guest", "user", "admin", (*model.AppError)(nil))

		guest, user, admin, err := client.Scheme.GetRolesForChannel("chan")
		require.NoError(t, err)
		require.Equal(t, "guest", guest)
		require.Equal(t, "user", user)
		require.Equal(t, "admin", admin)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusInternalServerError)
		api.On("GetSchemeRolesForChannel", "chan").Return("", "", "", appErr)

		guest, user, admin, err := client.Scheme.GetRolesForChannel("chan")
		require.Equal(t, appErr, err)
		require.Empty(t, guest)
		require.Empty(t, user)
		require.Empty(t, admin)
	})
}
