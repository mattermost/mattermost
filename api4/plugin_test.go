// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"

	svg "github.com/h2non/go-is-svg"
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
	require.NoError(t, err)

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

	ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNoError(t, resp)
	require.True(t, ok)

	t.Run("install plugin from URL with slow response time", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping test to install plugin from a slow response server")
		}

		// Install from URL - slow server to simulate longer bundle download times
		slowTestServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			time.Sleep(60 * time.Second) // Wait longer than the previous default 30 seconds timeout
			res.WriteHeader(http.StatusOK)
			res.Write(tarData)
		}))
		defer func() { slowTestServer.Close() }()

		manifest, resp = th.SystemAdminClient.InstallPluginFromUrl(slowTestServer.URL, true)
		CheckNoError(t, resp)
		assert.Equal(t, "testplugin", manifest.Id)
	})

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
	ok, resp = th.SystemAdminClient.EnablePlugin(manifest.Id)
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
	CheckNotFoundStatus(t, resp)
	assert.False(t, ok)

	ok, resp = th.SystemAdminClient.EnablePlugin("JUNK")
	CheckNotFoundStatus(t, resp)
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
	CheckNotFoundStatus(t, resp)
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
	CheckNotFoundStatus(t, resp)
	assert.False(t, ok)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
	_, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
	_, resp = th.Client.RemovePlugin(manifest.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.RemovePlugin("bad.id")
	CheckNotFoundStatus(t, resp)
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
	require.NoError(t, err)

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
	webSocketClient, err := th.CreateWebSocketSystemAdminClient()
	require.Nil(t, err)
	webSocketClient.Listen()
	defer webSocketClient.Close()
	done := make(chan bool)
	go func() {
		for {
			select {
			case resp := <-webSocketClient.EventChannel:
				if resp.EventType() == model.WEBSOCKET_EVENT_PLUGIN_STATUSES_CHANGED && len(resp.GetData()["plugin_statuses"].([]interface{})) == 0 {
					done <- true
					return
				}
			case <-time.After(5 * time.Second):
				done <- false
				return
			}
		}
	}()

	testCluster.ClearMessages()
	ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
	CheckNoError(t, resp)
	require.True(t, ok)

	result := <-done
	require.True(t, result, "plugin_statuses_changed websocket event was not received")

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
	require.NoError(t, err)

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
			require.Empty(t, pluginsResp.Active)
			require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
				Manifest: *manifest,
			}})

			// Enable plugin
			ok, resp := th.SystemAdminClient.EnablePlugin(manifest.Id)
			CheckNoError(t, resp)
			require.True(t, ok)

			// Confirm enabled status
			pluginsResp, resp = th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Empty(t, pluginsResp.Inactive)
			require.Equal(t, pluginsResp.Active, []*model.PluginInfo{{
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
				require.Empty(t, pluginsResp.Inactive)
				require.Equal(t, pluginsResp.Active, []*model.PluginInfo{{
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
			require.Empty(t, pluginsResp.Inactive)
			require.Empty(t, pluginsResp.Active)

			// Upload same plugin
			manifest, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
			CheckNoError(t, resp)
			require.Equal(t, "testplugin", manifest.Id)

			// Plugin should be inactive
			pluginsResp, resp = th.SystemAdminClient.GetPlugins()
			CheckNoError(t, resp)
			require.Empty(t, pluginsResp.Active)
			require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
				Manifest: *manifest,
			}})

			// Clean up
			ok, resp = th.SystemAdminClient.RemovePlugin(manifest.Id)
			CheckNoError(t, resp)
			require.True(t, ok)
		})
	}
}

func TestGetMarketplacePlugins(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.EnableMarketplace = false
	})

	t.Run("marketplace disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = false
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, plugins)
	})

	t.Run("no server", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugins)
	})

	t.Run("no permission", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})

		plugins, resp := th.Client.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckForbiddenStatus(t, resp)
		require.Nil(t, plugins)
	})

	t.Run("empty response from server", func(t *testing.T) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Empty(t, plugins)
	})

	t.Run("verify server version is passed through", func(t *testing.T) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			serverVersion, ok := req.URL.Query()["server_version"]
			require.True(t, ok)
			require.Len(t, serverVersion, 1)
			require.Equal(t, model.CurrentVersion, serverVersion[0])
			require.NotEqual(t, 0, len(serverVersion[0]))

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Empty(t, plugins)
	})
}

func TestGetInstalledMarketplacePlugins(t *testing.T) {
	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: "https://example.com/mattermost/mattermost-plugin-nps/releases/download/v1.0.3/com.mattermost.nps-1.0.3.tar.gz",
				Labels: []model.MarketplaceLabel{
					{
						Name:        "someName",
						Description: "some Description",
					},
				},
				Manifest: &model.Manifest{
					Id:               "com.mattermost.nps",
					Name:             "User Satisfaction Surveys",
					Description:      "This plugin sends quarterly user satisfaction surveys to gather feedback and help improve Mattermost.",
					Version:          "1.0.3",
					MinServerVersion: "5.14.0",
				},
			},
			InstalledVersion: "",
		},
	}

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	t.Run("marketplace client returns not-installed plugin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal(samplePlugins)
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, samplePlugins, plugins)

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		testIcon, err := ioutil.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		expectedPlugins := append(samplePlugins, &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/homepage",
				IconData:    testIconData,
				DownloadURL: "",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
				Manifest: manifest,
			},
			InstalledVersion: manifest.Version,
		})
		sort.SliceStable(expectedPlugins, func(i, j int) bool {
			return strings.ToLower(expectedPlugins[i].Manifest.Name) < strings.ToLower(expectedPlugins[j].Manifest.Name)
		})

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, expectedPlugins, plugins)

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, samplePlugins, plugins)
	})

	t.Run("marketplace client returns installed plugin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.EnableMarketplace = true
		})

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		newPlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "HomepageURL",
				IconData:    "IconData",
				DownloadURL: "DownloadURL",
				Manifest:    manifest,
			},
			InstalledVersion: manifest.Version,
		}
		expectedPlugins := append(samplePlugins, newPlugin)
		sort.SliceStable(expectedPlugins, func(i, j int) bool {
			return strings.ToLower(expectedPlugins[i].Manifest.Name) < strings.ToLower(expectedPlugins[j].Manifest.Name)
		})

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[0], newPlugin})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, expectedPlugins, plugins)

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		newPlugin.InstalledVersion = ""
		require.Equal(t, expectedPlugins, plugins)
	})
}

func TestSearchGetMarketplacePlugins(t *testing.T) {
	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "example.com/mattermost/mattermost-plugin-nps",
				IconData:    "Cjxzdmcgdmlld0JveD0nMCAwIDEwNSA5MycgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz4KPHBhdGggZD0nTTY2LDBoMzl2OTN6TTM4LDBoLTM4djkzek01MiwzNWwyNSw1OGgtMTZsLTgtMThoLTE4eicgZmlsbD0nI0VEMUMyNCcvPgo8L3N2Zz4K",
				DownloadURL: "example.com/mattermost/mattermost-plugin-nps/releases/download/v1.0.3/com.mattermost.nps-1.0.3.tar.gz",
				Manifest: &model.Manifest{
					Id:               "com.mattermost.nps",
					Name:             "User Satisfaction Surveys",
					Description:      "This plugin sends quarterly user satisfaction surveys to gather feedback and help improve Mattermost.",
					Version:          "1.0.3",
					MinServerVersion: "5.14.0",
				},
			},
			InstalledVersion: "",
		},
	}

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	tarDataV2, err := ioutil.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
	require.NoError(t, err)

	testIcon, err := ioutil.ReadFile(filepath.Join(path, "test.svg"))
	require.NoError(t, err)
	require.True(t, svg.Is(testIcon))
	testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

	t.Run("search installed plugin", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal(samplePlugins)
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, samplePlugins, plugins)

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		plugin1 := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/homepage",
				IconData:    testIconData,
				DownloadURL: "",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
				Manifest: manifest,
			},
			InstalledVersion: manifest.Version,
		}
		expectedPlugins := append(samplePlugins, plugin1)

		manifest, resp = th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarDataV2))
		CheckNoError(t, resp)

		plugin2 := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				IconData:    testIconData,
				HomepageURL: "https://example.com/homepage",
				DownloadURL: "",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
				Manifest: manifest,
			},
			InstalledVersion: manifest.Version,
		}
		expectedPlugins = append(expectedPlugins, plugin2)
		sort.SliceStable(expectedPlugins, func(i, j int) bool {
			return strings.ToLower(expectedPlugins[i].Manifest.Name) < strings.ToLower(expectedPlugins[j].Manifest.Name)
		})

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)
		require.Equal(t, expectedPlugins, plugins)

		// Search for plugins from the server
		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{Filter: "testplugin2"})
		CheckNoError(t, resp)
		require.Equal(t, []*model.MarketplacePlugin{plugin2}, plugins)

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{Filter: "a second plugin"})
		CheckNoError(t, resp)
		require.Equal(t, []*model.MarketplacePlugin{plugin2}, plugins)

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{Filter: "User Satisfaction Surveys"})
		CheckNoError(t, resp)
		require.Equal(t, samplePlugins, plugins)

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{Filter: "NOFILTER"})
		CheckNoError(t, resp)
		require.Nil(t, plugins)

		// cleanup
		ok, resp := th.SystemAdminClient.RemovePlugin(plugin1.Manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		ok, resp = th.SystemAdminClient.RemovePlugin(plugin2.Manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
	})
}

func TestGetLocalPluginInMarketplace(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: "www.github.com/example",
				Manifest: &model.Manifest{
					Id:               "testplugin2",
					Name:             "testplugin2",
					Description:      "a second plugin",
					Version:          "1.2.2",
					MinServerVersion: "",
				},
			},
			InstalledVersion: "",
		},
	}

	testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[0]})
		require.NoError(t, err)
		res.Write(json)
	}))
	defer testServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableMarketplace = true
		*cfg.PluginSettings.MarketplaceUrl = testServer.URL
	})

	t.Run("Get plugins with EnableRemoteMarketplace enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		require.Len(t, plugins, len(samplePlugins))
		require.Equal(t, samplePlugins, plugins)
	})

	t.Run("get remote and local plugins", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		// Upload one local plugin
		path, _ := fileutils.FindDir("tests")
		tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		require.Len(t, plugins, 2)

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
	})

	t.Run("EnableRemoteMarketplace disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = false
			*cfg.PluginSettings.EnableUploads = true
		})

		// No marketplace plugins returned
		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		require.Len(t, plugins, 0)

		// Upload one local plugin
		path, _ := fileutils.FindDir("tests")
		tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		testIcon, err := ioutil.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		newPlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				IconData:    testIconData,
				HomepageURL: "https://example.com/homepage",
				Manifest:    manifest,
			},
			InstalledVersion: manifest.Version,
		}

		plugins, resp = th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		// Only get the local plugins
		require.Len(t, plugins, 1)
		require.Equal(t, newPlugin, plugins[0])

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
	})

	t.Run("local_only true", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		// Upload one local plugin
		path, _ := fileutils.FindDir("tests")
		tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNoError(t, resp)

		testIcon, err := ioutil.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		newPlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest:    manifest,
				IconData:    testIconData,
				HomepageURL: "https://example.com/homepage",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
			},
			InstalledVersion: manifest.Version,
		}

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{LocalOnly: true})
		CheckNoError(t, resp)

		require.Len(t, plugins, 1)
		require.Equal(t, newPlugin, plugins[0])

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
	})
}

func TestGetPrepackagedPluginInMarketplace(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	marketplacePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: "www.github.com/example",
				Manifest: &model.Manifest{
					Id:               "marketplace.test",
					Name:             "marketplacetest",
					Description:      "a marketplace plugin",
					Version:          "0.1.2",
					MinServerVersion: "",
				},
			},
			InstalledVersion: "",
		},
	}

	testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		json, err := json.Marshal([]*model.MarketplacePlugin{marketplacePlugins[0]})
		require.NoError(t, err)
		res.Write(json)
	}))
	defer testServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableMarketplace = true
		*cfg.PluginSettings.MarketplaceUrl = testServer.URL
	})

	prepackagePlugin := &plugin.PrepackagedPlugin{
		Manifest: &model.Manifest{
			Version: "0.0.1",
			Id:      "prepackaged.test",
		},
	}

	env := th.App.GetPluginsEnvironment()
	env.SetPrepackagedPlugins([]*plugin.PrepackagedPlugin{prepackagePlugin})

	t.Run("get remote and prepackaged plugins", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		expectedPlugins := marketplacePlugins
		expectedPlugins = append(expectedPlugins, &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest: prepackagePlugin.Manifest,
			},
		})

		require.ElementsMatch(t, expectedPlugins, plugins)
		require.Len(t, plugins, 2)
	})

	t.Run("EnableRemoteMarketplace disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = false
			*cfg.PluginSettings.EnableUploads = true
		})

		// No marketplace plugins returned
		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		// Only returns the prepackaged plugins
		require.Len(t, plugins, 1)
		require.Equal(t, prepackagePlugin.Manifest, plugins[0].Manifest)
	})

	t.Run("get prepackaged plugin if newer", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		manifest := &model.Manifest{
			Version: "1.2.3",
			Id:      "marketplace.test",
		}

		newerPrepackagePlugin := &plugin.PrepackagedPlugin{
			Manifest: manifest,
		}

		env := th.App.GetPluginsEnvironment()
		env.SetPrepackagedPlugins([]*plugin.PrepackagedPlugin{newerPrepackagePlugin})

		plugins, resp := th.SystemAdminClient.GetMarketplacePlugins(&model.MarketplacePluginFilter{})
		CheckNoError(t, resp)

		require.Len(t, plugins, 1)
		require.Equal(t, newerPrepackagePlugin.Manifest, plugins[0].Manifest)
	})
}

func TestInstallMarketplacePlugin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.EnableMarketplace = false
	})

	path, _ := fileutils.FindDir("tests")
	signatureFilename := "testplugin2.tar.gz.sig"
	signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
	require.Nil(t, err)
	sigFile, err := ioutil.ReadAll(signatureFileReader)
	require.Nil(t, err)
	pluginSignature := base64.StdEncoding.EncodeToString(sigFile)

	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
	require.NoError(t, err)
	pluginServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		res.Write(tarData)
	}))
	defer pluginServer.Close()

	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: pluginServer.URL,
				Manifest: &model.Manifest{
					Id:               "testplugin2",
					Name:             "testplugin2",
					Description:      "a second plugin",
					Version:          "1.2.2",
					MinServerVersion: "",
				},
			},
			InstalledVersion: "",
		},
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: pluginServer.URL,
				Manifest: &model.Manifest{
					Id:               "testplugin2",
					Name:             "testplugin2",
					Description:      "a second plugin",
					Version:          "1.2.3",
					MinServerVersion: "",
				},
				Signature: pluginSignature,
			},
			InstalledVersion: "",
		},
	}

	request := &model.InstallMarketplacePluginRequest{Id: "", Version: ""}

	t.Run("marketplace disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = false
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})
		plugin, resp := th.SystemAdminClient.InstallMarketplacePlugin(request)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, plugin)
	})

	t.Run("RequirePluginSignature enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.RequirePluginSignature = true
		})
		manifest, resp := th.SystemAdminClient.UploadPlugin(bytes.NewReader(tarData))
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, manifest)

		manifest, resp = th.SystemAdminClient.InstallPluginFromUrl("some_url", true)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, manifest)
	})

	t.Run("no server", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})

		plugin, resp := th.SystemAdminClient.InstallMarketplacePlugin(request)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	})

	t.Run("no permission", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = "invalid.com"
		})

		plugin, resp := th.Client.InstallMarketplacePlugin(request)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, plugin)
	})

	t.Run("plugin not found on the server", func(t *testing.T) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})
		pRequest := &model.InstallMarketplacePluginRequest{Id: "some_plugin_id", Version: "0.0.1"}
		plugin, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	})

	t.Run("plugin not verified", func(t *testing.T) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[0]})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
			*cfg.PluginSettings.AllowInsecureDownloadUrl = true
		})
		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "1.2.2"}
		plugin, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	})

	t.Run("verify, install and remove plugin", func(t *testing.T) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			serverVersion := req.URL.Query().Get("server_version")
			require.NotEmpty(t, serverVersion)
			require.Equal(t, model.CurrentVersion, serverVersion)
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[1]})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
		})

		key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
		require.NoError(t, err)
		appErr := th.App.AddPublicKey("pub_key", key)
		require.Nil(t, appErr)

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "1.2.3"}
		manifest, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckNoError(t, resp)
		require.NotNil(t, manifest)
		require.Equal(t, "testplugin2", manifest.Id)
		require.Equal(t, "1.2.3", manifest.Version)

		filePath := filepath.Join("plugins", "testplugin2.tar.gz.sig")
		savedSigFile, err := th.App.ReadFile(filePath)
		require.Nil(t, err)
		require.EqualValues(t, sigFile, savedSigFile)

		ok, resp := th.SystemAdminClient.RemovePlugin(manifest.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
		exists, err := th.App.FileExists(filePath)
		require.Nil(t, err)
		require.False(t, exists)

		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	})

	t.Run("install prepackaged and remote plugins through marketplace", func(t *testing.T) {
		prepackagedPluginsDir := "prepackaged_plugins"

		os.RemoveAll(prepackagedPluginsDir)
		err := os.Mkdir(prepackagedPluginsDir, os.ModePerm)
		require.NoError(t, err)
		defer os.RemoveAll(prepackagedPluginsDir)

		prepackagedPluginsDir, found := fileutils.FindDir(prepackagedPluginsDir)
		require.True(t, found, "failed to find prepackaged plugins directory")

		err = utils.CopyFile(filepath.Join(path, "testplugin.tar.gz"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz"))
		require.NoError(t, err)
		err = utils.CopyFile(filepath.Join(path, "testplugin.tar.gz.asc"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz.sig"))
		require.NoError(t, err)

		th := SetupConfig(func(cfg *model.Config) {
			// Disable auto-installing prepackaged plugins
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
		}).InitBasic()
		defer th.TearDown()

		pluginSignatureFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz.asc"))
		require.Nil(t, err)
		pluginSignatureData, err := ioutil.ReadAll(pluginSignatureFile)
		require.Nil(t, err)

		key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
		require.NoError(t, err)
		appErr := th.App.AddPublicKey("pub_key", key)
		require.Nil(t, appErr)

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			serverVersion := req.URL.Query().Get("server_version")
			require.NotEmpty(t, serverVersion)
			require.Equal(t, model.CurrentVersion, serverVersion)
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[1]})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = false
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
			*cfg.PluginSettings.AllowInsecureDownloadUrl = false
		})

		env := th.App.GetPluginsEnvironment()

		pluginsResp, resp := th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Len(t, pluginsResp.Inactive, 0)

		// Should fail to install unknown prepackaged plugin
		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin", Version: "0.0.2"}
		manifest, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)

		plugins := env.PrepackagedPlugins()
		require.Len(t, plugins, 1)
		require.Equal(t, "testplugin", plugins[0].Manifest.Id)
		require.Equal(t, pluginSignatureData, plugins[0].Signature)

		pluginsResp, resp = th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Len(t, pluginsResp.Inactive, 0)

		pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin", Version: "0.0.1"}
		manifest1, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckNoError(t, resp)
		require.NotNil(t, manifest1)
		require.Equal(t, "testplugin", manifest1.Id)
		require.Equal(t, "0.0.1", manifest1.Version)

		pluginsResp, resp = th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
			Manifest: *manifest1,
		}})

		// Try to install remote marketplace plugin
		pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "1.2.3"}
		manifest, resp = th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)

		// Enable remote marketplace
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
			*cfg.PluginSettings.AllowInsecureDownloadUrl = true
		})

		pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "1.2.3"}
		manifest2, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckNoError(t, resp)
		require.NotNil(t, manifest2)
		require.Equal(t, "testplugin2", manifest2.Id)
		require.Equal(t, "1.2.3", manifest2.Version)

		pluginsResp, resp = th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.ElementsMatch(t, pluginsResp.Inactive, []*model.PluginInfo{
			{
				Manifest: *manifest1,
			},
			{
				Manifest: *manifest2,
			},
		})

		// Clean up
		ok, resp := th.SystemAdminClient.RemovePlugin(manifest1.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		ok, resp = th.SystemAdminClient.RemovePlugin(manifest2.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	})

	t.Run("missing prepackaged and remote plugin signatures", func(t *testing.T) {
		prepackagedPluginsDir := "prepackaged_plugins"

		os.RemoveAll(prepackagedPluginsDir)
		err := os.Mkdir(prepackagedPluginsDir, os.ModePerm)
		require.NoError(t, err)
		defer os.RemoveAll(prepackagedPluginsDir)

		prepackagedPluginsDir, found := fileutils.FindDir(prepackagedPluginsDir)
		require.True(t, found, "failed to find prepackaged plugins directory")

		err = utils.CopyFile(filepath.Join(path, "testplugin.tar.gz"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz"))
		require.NoError(t, err)

		th := SetupConfig(func(cfg *model.Config) {
			// Disable auto-installing prepackged plugins
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
		}).InitBasic()
		defer th.TearDown()

		key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
		require.NoError(t, err)
		appErr := th.App.AddPublicKey("pub_key", key)
		require.Nil(t, appErr)

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			serverVersion := req.URL.Query().Get("server_version")
			require.NotEmpty(t, serverVersion)
			require.Equal(t, model.CurrentVersion, serverVersion)

			mPlugins := []*model.MarketplacePlugin{samplePlugins[0]}
			require.Empty(t, mPlugins[0].Signature)
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal(mPlugins)
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.MarketplaceUrl = testServer.URL
			*cfg.PluginSettings.AllowInsecureDownloadUrl = true
		})

		env := th.App.GetPluginsEnvironment()
		plugins := env.PrepackagedPlugins()
		require.Len(t, plugins, 1)
		require.Equal(t, "testplugin", plugins[0].Manifest.Id)
		require.Empty(t, plugins[0].Signature)

		pluginsResp, resp := th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Len(t, pluginsResp.Inactive, 0)

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin", Version: "0.0.1"}
		manifest, resp := th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)

		pluginsResp, resp = th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Len(t, pluginsResp.Inactive, 0)

		pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "1.2.3"}
		manifest, resp = th.SystemAdminClient.InstallMarketplacePlugin(pRequest)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)

		pluginsResp, resp = th.SystemAdminClient.GetPlugins()
		CheckNoError(t, resp)
		require.Len(t, pluginsResp.Active, 0)
		require.Len(t, pluginsResp.Inactive, 0)

		// Clean up
		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	})
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
