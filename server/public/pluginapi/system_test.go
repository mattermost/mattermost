package pluginapi_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestGetManifest(t *testing.T) {
	t.Run("valid manifest", func(t *testing.T) {
		expectedManifest := &model.Manifest{
			Id:      "some.id",
			Name:    "Some Name",
			Version: "1.0.0",
		}

		dir := generateManifest(t)

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

func TestGenerateCustomerPacketMetadata(t *testing.T) {
	licenseID := model.NewId()
	customerID := model.NewId()
	telemetryID := model.NewId()
	t.Run("happy path", func(t *testing.T) {
		api := plugintest.NewAPI(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		dir := generateManifest(t)
		api.On("GetBundlePath").Return(dir, nil)
		api.On("GetLicense").Return(&model.License{
			Id: licenseID,
			Customer: &model.Customer{
				Id: customerID,
			},
		})
		api.On("GetTelemetryId").Return(telemetryID)

		path := os.TempDir()
		filePath, err := client.System.GeneratePacketMetadata(path, nil)
		require.NoError(t, err)

		f, err := os.Open(filePath)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, f.Close())
		})

		var md model.PacketMetadata
		err = yaml.NewDecoder(f).Decode(&md)
		require.NoError(t, err)

		require.Equal(t, model.CurrentMetadataVersion, md.Version)
		require.Equal(t, model.PluginPacketType, md.Type)
		require.NotZero(t, md.GeneratedAt)
		require.Equal(t, model.CurrentVersion, md.ServerVersion)
		require.Equal(t, telemetryID, md.ServerID)
		require.Equal(t, licenseID, md.LicenseID)
		require.Equal(t, customerID, md.CustomerID)
		require.Equal(t, "some.id", md.Extras["plugin_id"])
		require.Equal(t, "1.0.0", md.Extras["plugin_version"])
	})
}

func generateManifest(t *testing.T) string {
	manifest := &model.Manifest{
		Id:      "some.id",
		Name:    "Some Name",
		Version: "1.0.0",
	}

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(dir))
	})

	tmpfn := filepath.Join(dir, "plugin.json")
	f, err := os.Create(tmpfn)
	require.NoError(t, err)
	err = json.NewEncoder(f).Encode(manifest)
	require.NoError(t, err)

	return dir
}
