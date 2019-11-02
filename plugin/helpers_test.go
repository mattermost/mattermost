package plugin_test

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestInstallPluginFromUrl(t *testing.T) {
	replace := true
	h := &plugin.HelpersImpl{}
	api := &plugintest.API{}
	config := &model.Config{}
	config.PluginSettings.AllowInsecureDownloadUrl = model.NewBool(false)
	api.On("GetConfig").Return(config)
	h.API = api

	t.Run("downloading from insecure url is not allowed", func(t *testing.T) {
		url := "http://example.com/path"

		manifest, appError := h.InstallPluginFromUrl(url, replace)

		assert.Nil(t, manifest)
		assert.NotNil(t, appError)
	})

	t.Run("downloading from secure download url is allowed", func(t *testing.T) {
		url := "https://example.com/path"

		manifest, appError := h.InstallPluginFromUrl(url, replace)

		assert.Nil(t, manifest)
		assert.Nil(t, appError)
	})
}
