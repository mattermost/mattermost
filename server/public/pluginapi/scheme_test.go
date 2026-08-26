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

	t.Run("unsupported server", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetOrCreatePluginChannelScheme", []string(nil), []string(nil), []string(nil)).Return(nil, (*model.AppError)(nil))

		scheme, err := client.Scheme.GetOrCreateChannelScheme(nil, nil, nil)
		require.ErrorIs(t, err, pluginapi.ErrNotSupported)
		require.Nil(t, scheme)
	})
}

func TestSchemeGetByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetSchemeByName", "example_scheme").Return(&model.Scheme{Id: "1", Name: "example_scheme"}, nil)

		scheme, err := client.Scheme.GetByName("example_scheme")
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

	t.Run("unsupported server", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetSchemeByName", "example_scheme").Return(nil, (*model.AppError)(nil))

		scheme, err := client.Scheme.GetByName("example_scheme")
		require.ErrorIs(t, err, pluginapi.ErrNotSupported)
		require.Nil(t, scheme)
	})
}

func TestSchemeGetForChannel(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		scheme := &model.Scheme{Id: "scheme"}
		guest := &model.Role{Name: "guest"}
		user := &model.Role{Name: "user"}
		admin := &model.Role{Name: "admin"}
		api.On("GetSchemeForChannel", "chan").Return(scheme, guest, user, admin, (*model.AppError)(nil))

		got, err := client.Scheme.GetForChannel("chan")
		require.NoError(t, err)
		require.Equal(t, scheme, got.Scheme)
		require.Equal(t, guest, got.GuestRole)
		require.Equal(t, user, got.UserRole)
		require.Equal(t, admin, got.AdminRole)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusInternalServerError)
		api.On("GetSchemeForChannel", "chan").Return(nil, nil, nil, nil, appErr)

		got, err := client.Scheme.GetForChannel("chan")
		require.Equal(t, appErr, err)
		require.Nil(t, got)
	})

	t.Run("unsupported server", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetSchemeForChannel", "chan").Return(nil, nil, nil, nil, (*model.AppError)(nil))

		got, err := client.Scheme.GetForChannel("chan")
		require.ErrorIs(t, err, pluginapi.ErrNotSupported)
		require.Nil(t, got)
	})
}
