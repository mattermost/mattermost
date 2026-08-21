package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

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

func TestSchemeCreate(t *testing.T) {
	in := &model.Scheme{DisplayName: "Engineering", Scope: model.SchemeScopeChannel}

	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		out := &model.Scheme{
			Id:                     "1",
			DisplayName:            "Engineering",
			Scope:                  model.SchemeScopeChannel,
			DefaultChannelUserRole: "u",
		}
		api.On("CreateScheme", in).Return(out, nil)

		created, err := client.Scheme.Create(in)
		require.NoError(t, err)
		require.Equal(t, out, created)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusBadRequest)
		api.On("CreateScheme", in).Return(nil, appErr)

		created, err := client.Scheme.Create(in)
		require.Equal(t, appErr, err)
		require.Zero(t, created)
	})
}

func TestSchemeDelete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("DeleteScheme", "1").Return(&model.Scheme{Id: "1"}, nil)

		deleted, err := client.Scheme.Delete("1")
		require.NoError(t, err)
		require.Equal(t, "1", deleted.Id)
	})

	// A server-side refusal (for example, a scheme a space still references) is
	// surfaced to the plugin unchanged.
	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusBadRequest)
		api.On("DeleteScheme", "1").Return(nil, appErr)

		deleted, err := client.Scheme.Delete("1")
		require.Equal(t, appErr, err)
		require.Zero(t, deleted)
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
