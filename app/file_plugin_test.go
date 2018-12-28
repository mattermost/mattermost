// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	_ "fmt"
	"testing"
	_ "time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/plugin/plugintest/mock"
	_ "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUploadFilePlugins(t *testing.T) {
	var large = []byte("0123456789ABCDEF__XYZ")

	th := Setup().InitBasic()
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.FileSettings.MaxFileSize = 1024
		*cfg.FileSettings.MaxMemoryBuffer = 4
	})

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"io"
			"fmt"
			"io/ioutil"
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
			data, err := ioutil.ReadAll(file)
			return nil, fmt.Sprintf("%v-%v", string(data), err)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	t.Run("happy", func(t *testing.T) {
		_, err := th.App.UploadFileX(th.BasicChannel.Id,
			"testhook.txt",
			bytes.NewReader(large),
			UploadFileSetTeamId("noteam"),
			UploadFileSetUserId(th.BasicUser.Id),
		)

		require.NotNil(t, err)
		require.Equal(t, "Unable to upload file(s). Error reading or processing request data.", err.Message)
		require.Equal(t, "File rejected by plugin. 0123456789ABCDEF__XYZ-<nil>", err.DetailedError)

	})
}
