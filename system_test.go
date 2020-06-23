package pluginapi_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
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

		dir, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		tmpfn := filepath.Join(dir, "plugin.json")
		//nolint:gosec //only used in tests
		err = ioutil.WriteFile(tmpfn, content, 0666)
		require.NoError(t, err)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)
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
		client := pluginapi.NewClient(api)
		m, err := client.System.GetManifest()
		require.Error(t, err)
		require.Nil(t, m)
	})

	t.Run("No manifest found", func(t *testing.T) {
		dir, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)
		m, err := client.System.GetManifest()
		require.Error(t, err)
		require.Nil(t, m)
	})
}
