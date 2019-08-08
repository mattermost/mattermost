// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/testlib"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlugin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	statesJson, _ := json.Marshal(th.App.Config().PluginSettings.PluginStates)
	states := map[string]*model.PluginState{}
	json.Unmarshal(statesJson, &states)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.AllowInsecureDownloadUrl = true
	})

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}

	// Install from URL
	testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		res.Write(tarData)
	}))
	defer func() { testServer.Close() }()

	url := testServer.URL

	manifest, resp := th.SystemAdminClient.InstallPluginFromUrl(url, false)
	CheckNoError(t, resp)
	assert.Equal(t, "testplugin", manifest.Id)

	_, resp = th.SystemAdminClient.InstallPluginFromUrl(url, false)
	CheckBadRequestStatus(t, resp)

	manifest, resp = th.SystemAdminClient.InstallPluginFromUrl(url, true)
	CheckNoError(t, resp)
	assert.Equal(t, "testplugin", manifest.Id)

	// Stored in File Store: Install Plugin from URL case
	pluginStored, err := th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz")
	assert.Nil(t, err)
	assert.True(t, pluginStored)

	th.App.RemovePlugin(manifest.Id)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

	_, resp = th.SystemAdminClient.InstallPluginFromUrl(url, false)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

	_, resp = th.Client.InstallPluginFromUrl(url, false)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.InstallPluginFromUrl("http://nodata", false)
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.AllowInsecureDownloadUrl = false })

	_, resp = th.SystemAdminClient.InstallPluginFromUrl(url, false)
	CheckBadRequestStatus(t, resp)

	// Successful upload
	manifest, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.EnableUploads = true })

	manifest, resp = th.SystemAdminClient.UploadPluginForced(bytes.NewReader(tarData))
	defer os.RemoveAll("plugins/testplugin")
	CheckNoError(t, resp)

	assert.Equal(t, "testplugin", manifest.Id)

	// Stored in File Store: Upload Plugin case
	pluginStored, err = th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz")
	assert.Nil(t, err)
	assert.True(t, pluginStored)

	// Upload error cases
	_, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader([]byte("badfile")))
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
	_, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = false
	})
	_, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.EnableUploads = true })
	_, resp = th.Client.UploadPlugin(bytes.NewReader(tarData))
	CheckForbiddenStatus(t, resp)

	// Successful gets
	pluginsResp, resp := th.SystemAdminClient.GetPlugins()
	CheckNoError(t, resp)

	found := false
	for _, m := range pluginsResp.Inactive {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)

	found = false
	for _, m := range pluginsResp.Active {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.False(t, found)

	// Successful activate
	ok, resp := th.SystemAdminClient.EnablePlugin(manifest.Id)
	CheckNoError(t, resp)
	assert.True(t, ok)

	pluginsResp, resp = th.SystemAdminClient.GetPlugins()
	CheckNoError(t, resp)

	found = false
	for _, m := range pluginsResp.Active {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)

	// Activate error case
	ok, resp = th.SystemAdminClient.EnablePlugin("junk")
	CheckBadRequestStatus(t, resp)
	assert.False(t, ok)

	ok, resp = th.SystemAdminClient.EnablePlugin("JUNK")
	CheckBadRequestStatus(t, resp)
	assert.False(t, ok)

	// Successful deactivate
	ok, resp = th.SystemAdminClient.DisablePlugin(manifest.Id)
	CheckNoError(t, resp)
	assert.True(t, ok)

	pluginsResp, resp = th.SystemAdminClient.GetPlugins()
	CheckNoError(t, resp)

	found = false
	for _, m := range pluginsResp.Inactive {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)

	// Deactivate error case
	ok, resp = th.SystemAdminClient.DisablePlugin("junk")
	CheckBadRequestStatus(t, resp)
	assert.False(t, ok)

	// Get error cases
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
	_, resp = th.SystemAdminClient.GetPlugins()
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
	_, resp = th.Client.GetPlugins()
	CheckForbiddenStatus(t, resp)

	// Successful webapp get
	_, resp = th.SystemAdminClient.EnablePlugin(manifest.Id)
	CheckNoError(t, resp)

	manifests, resp := th.Client.GetWebappPlugins()
	CheckNoError(t, resp)

	found = false
	for _, m := range manifests {
		if m.Id == manifest.Id {
			found = true
		}
	}

	assert.True(t, found)

	// Successful remove
	ok, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNoError(t, resp)
	assert.True(t, ok)

	// Remove error cases
	ok, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckBadRequestStatus(t, resp)
	assert.False(t, ok)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
	_, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
	_, resp = th.Client.RemovePlugin(manifest.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.RemovePlugin("bad.id")
	CheckBadRequestStatus(t, resp)
}

func TestNotifyClusterPluginEvent(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testCluster := &testlib.FakeClusterInterface{}
	th.Server.Cluster = testCluster

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}

	testCluster.ClearMessages()

	// Successful upload
	manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
	CheckNoError(t, resp)
	require.Equal(t, "testplugin", manifest.Id)

	// Stored in File Store: Upload Plugin case
	expectedPath := filepath.Join("./plugins", manifest.Id) + ".tar.gz"
	pluginStored, err := th.App.FileExists(expectedPath)
	require.Nil(t, err)
	require.True(t, pluginStored)

	messages := testCluster.GetMessages()
	expectedPluginData := model.PluginEventData{
		Id: manifest.Id,
	}
	expectedInstallMessage := &model.ClusterMessage{
		Event:            model.CLUSTER_EVENT_INSTALL_PLUGIN,
		SendType:         model.CLUSTER_SEND_RELIABLE,
		WaitForAllToSend: true,
		Data:             expectedPluginData.ToJson(),
	}
	actualMessages := findClusterMessages(model.CLUSTER_EVENT_INSTALL_PLUGIN, messages)
	require.Equal(t, []*model.ClusterMessage{expectedInstallMessage}, actualMessages)

	// Upgrade
	testCluster.ClearMessages()
	manifest, resp = th.SystemAdminClient.UploadPluginForced(bytes.NewReader(tarData))
	CheckNoError(t, resp)
	require.Equal(t, "testplugin", manifest.Id)

	// Successful remove
	testCluster.ClearMessages()
	ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNoError(t, resp)
	require.True(t, ok)

	messages = testCluster.GetMessages()

	expectedRemoveMessage := &model.ClusterMessage{
		Event:            model.CLUSTER_EVENT_REMOVE_PLUGIN,
		SendType:         model.CLUSTER_SEND_RELIABLE,
		WaitForAllToSend: true,
		Data:             expectedPluginData.ToJson(),
	}
	actualMessages = findClusterMessages(model.CLUSTER_EVENT_REMOVE_PLUGIN, messages)
	require.Equal(t, []*model.ClusterMessage{expectedRemoveMessage}, actualMessages)

	pluginStored, err = th.App.FileExists(expectedPath)
	require.Nil(t, err)
	require.False(t, pluginStored)
}

func TestDisableOnRemove(t *testing.T) {
	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}

	testCases := []struct {
		Description string
		Upgrade     bool
	}{
		{
			"Remove without upgrading",
			false,
		},
		{
			"Remove after upgrading",
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			th := Setup().InitBasic()
			defer th.TearDown()

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = true
				*cfg.PluginSettings.EnableUploads = true
			})

			// Upload
			manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
			CheckNoError(t, resp)
			require.Equal(t, "testplugin", manifest.Id)

			// Check initial status
			pluginsResp, resp := th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Len(t, pluginsResp.Active, 0)
			require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{&model.PluginInfo{
				Manifest: *manifest,
			}})

			// Enable plugin
			ok, resp := th.SystemAdminClient.EnablePlugin(manifest.Id)
			CheckNoError(t, resp)
			require.True(t, ok)

			// Confirm enabled status
			pluginsResp, resp = th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Len(t, pluginsResp.Inactive, 0)
			require.Equal(t, pluginsResp.Active, []*model.PluginInfo{&model.PluginInfo{
				Manifest: *manifest,
			}})

			if tc.Upgrade {
				// Upgrade
				manifest, resp = th.SystemAdminClient.UploadPluginForced(bytes.NewReader(tarData))
				CheckNoError(t, resp)
				require.Equal(t, "testplugin", manifest.Id)

				// Plugin should remain active
				pluginsResp, resp = th.SystemAdminClient.GetPlugins()
				CheckNoError(t, resp)
				require.Len(t, pluginsResp.Inactive, 0)
				require.Equal(t, pluginsResp.Active, []*model.PluginInfo{&model.PluginInfo{
					Manifest: *manifest,
				}})
			}

			// Remove plugin
			ok, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
			CheckNoError(t, resp)
			require.True(t, ok)

			// Plugin should have no status
			pluginsResp, resp = th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Len(t, pluginsResp.Inactive, 0)
			require.Len(t, pluginsResp.Active, 0)

			// Upload same plugin
			manifest, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
			CheckNoError(t, resp)
			require.Equal(t, "testplugin", manifest.Id)

			// Plugin should be inactive
			pluginsResp, resp = th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Len(t, pluginsResp.Active, 0)
			require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{&model.PluginInfo{
				Manifest: *manifest,
			}})

			// Clean up
			ok, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
			CheckNoError(t, resp)
			require.True(t, ok)
		})
	}
}

func findClusterMessages(event string, msgs []*model.ClusterMessage) []*model.ClusterMessage {
	var result []*model.ClusterMessage
	for _, msg := range msgs {
		if msg.Event == event {
			result = append(result, msg)
		}
	}
	return result
}
