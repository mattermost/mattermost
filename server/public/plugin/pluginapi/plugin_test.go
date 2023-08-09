package pluginapi_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestInstallPluginFromURL(t *testing.T) {
	replace := true

	t.Run("incompatible server version", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.1.0")
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		_, err := client.Plugin.InstallPluginFromURL("", true)

		assert.Error(t, err)
		assert.Equal(t, "incompatible server version for plugin, minimum required version: 5.18.0, current version: 5.1.0", err.Error())
	})

	t.Run("error while parsing the download url", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.19.0")
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		_, err := client.Plugin.InstallPluginFromURL("http://%41:8080/", replace)

		assert.Error(t, err)
		assert.Equal(t, "error while parsing url: parse \"http://%41:8080/\": invalid URL escape \"%41\"", err.Error())
	})

	t.Run("errors out while downloading file", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.19.0")
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusInternalServerError)
		}))
		defer testServer.Close()
		url := testServer.URL

		_, err := client.Plugin.InstallPluginFromURL(url, replace)

		assert.Error(t, err)
		assert.Equal(t, "received 500 status code while downloading plugin from server", err.Error())
	})

	t.Run("downloads the file successfully", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.19.0")
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		tarData, err := os.ReadFile(filepath.Join("tests", "testplugin.tar.gz"))
		require.NoError(t, err)
		expectedManifest := &model.Manifest{Id: "testplugin"}
		api.On("InstallPlugin", mock.Anything, false).Return(expectedManifest, nil)

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			_, _ = res.Write(tarData)
		}))
		defer testServer.Close()
		url := testServer.URL

		manifest, err := client.Plugin.InstallPluginFromURL(url, false)

		assert.NoError(t, err)
		assert.Equal(t, "testplugin", manifest.Id)
	})

	t.Run("the url pointing to server is incorrect", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.19.0")
		client := pluginapi.NewClient(api, &plugintest.Driver{})
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusNotFound)
		}))
		defer testServer.Close()
		url := testServer.URL

		_, err := client.Plugin.InstallPluginFromURL(url, false)

		assert.Error(t, err)
		assert.Equal(t, "received 404 status code while downloading plugin from server", err.Error())
	})
}

func TestGetPluginAssetURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"
	api := &plugintest.API{}
	api.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})

	client := pluginapi.NewClient(api, &plugintest.Driver{})

	t.Run("Valid asset directory was provided", func(t *testing.T) {
		pluginID := "mattermost-1234"
		dir := "assets"
		wantedURL := "https://mattermost.example.com/mattermost-1234/assets"
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dir)

		assert.Equalf(t, wantedURL, gotURL, "GetPluginAssetURL(%q, %q) got=%q; want=%v", pluginID, dir, gotURL, wantedURL)
		assert.NoError(t, err)
	})

	t.Run("Valid asset directory path was provided", func(t *testing.T) {
		pluginID := "mattermost-1234"
		dirPath := "/mattermost/assets"
		wantedURL := "https://mattermost.example.com/mattermost-1234/mattermost/assets"
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dirPath)

		assert.Equalf(t, wantedURL, gotURL, "GetPluginAssetURL(%q, %q) got=%q; want=%q", pluginID, dirPath, gotURL, wantedURL)
		assert.NoError(t, err)
	})

	t.Run("Valid pluginID was provided", func(t *testing.T) {
		pluginID := "mattermost-1234"
		dir := "assets"
		wantedURL := "https://mattermost.example.com/mattermost-1234/assets"
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dir)

		assert.Equalf(t, wantedURL, gotURL, "GetPluginAssetURL(%q, %q) got=%q; want=%q", pluginID, dir, gotURL, wantedURL)
		assert.NoError(t, err)
	})

	t.Run("Invalid asset directory name was provided", func(t *testing.T) {
		pluginID := "mattermost-1234"
		dir := ""
		want := ""
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dir)

		assert.Emptyf(t, gotURL, "GetPluginAssetURL(%q, %q) got=%s; want=%q", pluginID, dir, gotURL, want)
		assert.Error(t, err)
	})

	t.Run("Invalid pluginID was provided", func(t *testing.T) {
		pluginID := ""
		dir := "assets"
		want := ""
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dir)

		assert.Emptyf(t, gotURL, "GetPluginAssetURL(%q, %q) got=%q; want=%q", pluginID, dir, gotURL, want)
		assert.Error(t, err)
	})

	siteURL = ""
	api.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})

	t.Run("Empty SiteURL was configured", func(t *testing.T) {
		pluginID := "mattermost-1234"
		dir := "assets"
		want := ""
		gotURL, err := client.System.GetPluginAssetURL(pluginID, dir)

		assert.Emptyf(t, gotURL, "GetPluginAssetURL(%q, %q) got=%q; want=%q", pluginID, dir, gotURL, want)
		assert.Error(t, err)
	})
}
