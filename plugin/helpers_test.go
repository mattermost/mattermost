package plugin_test

import (
	"bytes"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/services/httpservice/mocks"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestInstallPluginFromUrl(t *testing.T) {
	replace := true
	h := &plugin.HelpersImpl{}
	api := &plugintest.API{}
	httpService := &mocks.HTTPService{}
	config := &model.Config{}
	api.On("GetConfig").Return(config)
	h.API = api
	h.HTTPService = httpService

	t.Run("downloading from insecure url is not allowed", func(t *testing.T) {
		config.PluginSettings.AllowInsecureDownloadUrl = model.NewBool(false)
		url := "http://example.com/path"

		manifest, appError := h.InstallPluginFromUrl(url, replace)

		assert.Nil(t, manifest)
		assert.NotNil(t, appError)
	})

	t.Run("downloads the file successfully", func(t *testing.T) {
		config.PluginSettings.AllowInsecureDownloadUrl = model.NewBool(true)
		path, _ := fileutils.FindDir("tests")
		tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		expectedManifest := &model.Manifest{Id: "testplugin"}
		api.On("InstallPlugin", bytes.NewReader(tarData), true).Return(expectedManifest, nil)
		httpService.On("MakeClient", true).Return(http.DefaultClient)
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			res.Write(tarData)
		}))
		defer func() { testServer.Close() }()
		url := testServer.URL

		manifest, appError := h.InstallPluginFromUrl(url, replace)

		assert.Equal(t, "testplugin", manifest.Id)
		assert.Nil(t, appError)
	})

	t.Run("errors out while downloading file", func(t *testing.T) {
		config.PluginSettings.AllowInsecureDownloadUrl = model.NewBool(true)
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			panic("something went wrong with server")
		}))
		defer func() { testServer.Close() }()
		url := testServer.URL

		_, appError := h.InstallPluginFromUrl(url, replace)

		assert.NotNil(t, appError)
	})
}
