package pluginapi_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestGetManifest(t *testing.T) {
	t.Run("valid manifest", func(t *testing.T) {
		content := []byte(`
		{
			"id": "some.id",
			"name": "Some Name"
		}
		`)
		expectedManifest := &model.Manifest{
			Id:   "some.id",
			Name: "Some Name",
		}

		dir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		tmpfn := filepath.Join(dir, "plugin.json")
		//nolint:gosec //only used in tests
		err = os.WriteFile(tmpfn, content, 0o666)
		require.NoError(t, err)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})
		m, err := client.System.GetManifest()
		require.NoError(t, err)
		require.Equal(t, expectedManifest, m)

		// Altering the pointer doesn't alter the result
		m.Id = "new.id"

		m2, err := client.System.GetManifest()
		require.NoError(t, err)
		require.Equal(t, expectedManifest, m2)
	})

	t.Run("GetBundlePath fails", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetBundlePath").Return("", errors.New(""))
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})
		m, err := client.System.GetManifest()
		require.Error(t, err)
		require.Nil(t, m)
	})

	t.Run("No manifest found", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})
		m, err := client.System.GetManifest()
		require.Error(t, err)
		require.Nil(t, m)
	})
}

func TestRequestTrialLicense(t *testing.T) {
	t.Run("Server version incompatible", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetServerVersion").Return("5.35.0")
		err := client.System.RequestTrialLicense("requesterID", 10, true, true)

		require.Error(t, err)
		require.Equal(t, "current server version is lower than 5.36", err.Error())
	})

	t.Run("Server version compatible", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetServerVersion").Return("5.36.0")
		api.On("RequestTrialLicense", "requesterID", 10, true, true).Return(nil)

		err := client.System.RequestTrialLicense("requesterID", 10, true, true)

		require.NoError(t, err)
	})
}
