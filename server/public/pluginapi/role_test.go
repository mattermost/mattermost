package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestRoleGetByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetRoleByName", "space_page_editor").Return(&model.Role{Id: "1", Name: "space_page_editor"}, nil)

		role, err := client.Role.GetByName("space_page_editor")
		require.NoError(t, err)
		require.Equal(t, "space_page_editor", role.Name)
	})

	// A not-found AppError is normalized to the package sentinel so plugins can
	// test for it without unwrapping a *model.AppError.
	t.Run("not found", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusNotFound)
		api.On("GetRoleByName", "unknown").Return(nil, appErr)

		role, err := client.Role.GetByName("unknown")
		require.ErrorIs(t, err, pluginapi.ErrNotFound)
		require.Zero(t, role)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "boom", http.StatusInternalServerError)
		api.On("GetRoleByName", "boom").Return(nil, appErr)

		role, err := client.Role.GetByName("boom")
		require.Equal(t, appErr, err)
		require.Zero(t, role)
	})
}
