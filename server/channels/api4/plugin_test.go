// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	svg "github.com/h2non/go-is-svg"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestPlugin(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		statesJson, err := json.Marshal(th.App.Config().PluginSettings.PluginStates)
		require.NoError(t, err)
		states := map[string]*model.PluginState{}
		json.Unmarshal(statesJson, &states)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.AllowInsecureDownloadURL = true
		})

		path, _ := fileutils.FindDir("tests")
		tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		// Install from URL
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			res.Write(tarData)
		}))
		defer func() { testServer.Close() }()

		url := testServer.URL

		manifest, _, err := client.InstallPluginFromURL(context.Background(), url, false)
		require.NoError(t, err)
		assert.Equal(t, "testplugin", manifest.Id)

		_, resp, err := client.InstallPluginFromURL(context.Background(), url, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		manifest, _, err = client.InstallPluginFromURL(context.Background(), url, true)
		require.NoError(t, err)
		assert.Equal(t, "testplugin", manifest.Id)

		// Stored in File Store: Install Plugin from URL case
		pluginStored, appErr := th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz")
		assert.Nil(t, appErr)
		assert.True(t, pluginStored)

		_, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		th.App.Channels().RemovePlugin(manifest.Id)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

		_, resp, err = client.InstallPluginFromURL(context.Background(), url, false)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		_, resp, err = th.Client.InstallPluginFromURL(context.Background(), url, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client.InstallPluginFromURL(context.Background(), "http://nodata", false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.AllowInsecureDownloadURL = false })

		_, resp, err = client.InstallPluginFromURL(context.Background(), url, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Successful upload
		manifest, _, err = client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)
		assert.Equal(t, "testplugin", manifest.Id)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.EnableUploads = true })

		manifest, _, err = client.UploadPluginForced(context.Background(), bytes.NewReader(tarData))
		defer os.RemoveAll("plugins/testplugin")
		require.NoError(t, err)

		assert.Equal(t, "testplugin", manifest.Id)

		// Stored in File Store: Upload Plugin case
		pluginStored, appErr = th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz")
		assert.Nil(t, appErr)
		assert.True(t, pluginStored)

		// Upload error cases
		_, resp, err = client.UploadPlugin(context.Background(), bytes.NewReader([]byte("badfile")))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
		_, resp, err = client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = false
		})
		_, resp, err = client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		_, resp, err = client.InstallPluginFromURL(context.Background(), url, false)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.EnableUploads = true })
		_, resp, err = th.Client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Successful gets
		pluginsResp, _, err := client.GetPlugins(context.Background())
		require.NoError(t, err)

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
		_, err = client.EnablePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		pluginsResp, _, err = client.GetPlugins(context.Background())
		require.NoError(t, err)

		found = false
		for _, m := range pluginsResp.Active {
			if m.Id == manifest.Id {
				found = true
			}
		}

		assert.True(t, found)

		// Activate error case
		resp, err = client.EnablePlugin(context.Background(), "junk")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = client.EnablePlugin(context.Background(), "JUNK")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Successful deactivate
		_, err = client.DisablePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		pluginsResp, _, err = client.GetPlugins(context.Background())
		require.NoError(t, err)

		found = false
		for _, m := range pluginsResp.Inactive {
			if m.Id == manifest.Id {
				found = true
			}
		}

		assert.True(t, found)

		// Deactivate error case
		resp, err = client.DisablePlugin(context.Background(), "junk")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Get error cases
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
		_, resp, err = client.GetPlugins(context.Background())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
		_, resp, err = th.Client.GetPlugins(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Successful webapp get
		_, err = client.EnablePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		manifests, _, err := th.Client.GetWebappPlugins(context.Background())
		require.NoError(t, err)

		found = false
		for _, m := range manifests {
			if m.Id == manifest.Id {
				found = true
			}
		}

		assert.True(t, found)

		// Successful remove
		_, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		// Remove error cases
		resp, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
		resp, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
		resp, err = th.Client.RemovePlugin(context.Background(), manifest.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = client.RemovePlugin(context.Background(), "bad.id")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestNotifyClusterPluginEvent(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testCluster := &testlib.FakeClusterInterface{}
	th.Server.Platform().SetCluster(testCluster)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	testCluster.ClearMessages()

	// Successful upload
	manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
	require.NoError(t, err)
	require.Equal(t, "testplugin", manifest.Id)

	// Stored in File Store: Upload Plugin case
	expectedPath := filepath.Join("./plugins", manifest.Id) + ".tar.gz"
	pluginStored, appErr := th.App.FileExists(expectedPath)
	require.Nil(t, appErr)
	require.True(t, pluginStored)

	messages := testCluster.GetMessages()
	expectedPluginData := model.PluginEventData{
		Id: manifest.Id,
	}

	buf, _ := json.Marshal(expectedPluginData)
	expectedInstallMessage := &model.ClusterMessage{
		Event:            model.ClusterEventInstallPlugin,
		SendType:         model.ClusterSendReliable,
		WaitForAllToSend: true,
		Data:             buf,
	}
	actualMessages := findClusterMessages(model.ClusterEventInstallPlugin, messages)
	require.Equal(t, []*model.ClusterMessage{expectedInstallMessage}, actualMessages)

	// Upgrade
	testCluster.ClearMessages()
	manifest, _, err = th.SystemAdminClient.UploadPluginForced(context.Background(), bytes.NewReader(tarData))
	require.NoError(t, err)
	require.Equal(t, "testplugin", manifest.Id)

	// Successful remove
	webSocketClient, err := th.CreateWebSocketSystemAdminClient()
	require.NoError(t, err)
	webSocketClient.Listen()
	defer webSocketClient.Close()
	done := make(chan bool)
	go func() {
		for {
			select {
			case resp := <-webSocketClient.EventChannel:
				if resp.EventType() == model.WebsocketEventPluginStatusesChanged && len(resp.GetData()["plugin_statuses"].([]any)) == 0 {
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
	_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
	require.NoError(t, err)

	result := <-done
	require.True(t, result, "plugin_statuses_changed websocket event was not received")

	messages = testCluster.GetMessages()

	expectedRemoveMessage := &model.ClusterMessage{
		Event:            model.ClusterEventRemovePlugin,
		SendType:         model.ClusterSendReliable,
		WaitForAllToSend: true,
		Data:             buf,
	}
	actualMessages = findClusterMessages(model.ClusterEventRemovePlugin, messages)
	require.Equal(t, []*model.ClusterMessage{expectedRemoveMessage}, actualMessages)

	pluginStored, appErr = th.App.FileExists(expectedPath)
	require.Nil(t, appErr)
	require.False(t, pluginStored)
}

func TestDisableOnRemove(t *testing.T) {
	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
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

	th := Setup(t).InitBasic()
	defer th.TearDown()

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.Enable = true
					*cfg.PluginSettings.EnableUploads = true
				})

				// Upload
				manifest, _, err := client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
				require.NoError(t, err)
				require.Equal(t, "testplugin", manifest.Id)

				// Check initial status
				pluginsResp, _, err := client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Empty(t, pluginsResp.Active)
				require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
					Manifest: *manifest,
				}})

				// Enable plugin
				_, err = client.EnablePlugin(context.Background(), manifest.Id)
				require.NoError(t, err)

				// Confirm enabled status
				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Empty(t, pluginsResp.Inactive)
				require.Equal(t, pluginsResp.Active, []*model.PluginInfo{{
					Manifest: *manifest,
				}})

				if tc.Upgrade {
					// Upgrade
					manifest, _, err = client.UploadPluginForced(context.Background(), bytes.NewReader(tarData))
					require.NoError(t, err)
					require.Equal(t, "testplugin", manifest.Id)

					// Plugin should remain active
					pluginsResp, _, err = client.GetPlugins(context.Background())
					require.NoError(t, err)
					require.Empty(t, pluginsResp.Inactive)
					require.Equal(t, pluginsResp.Active, []*model.PluginInfo{{
						Manifest: *manifest,
					}})
				}

				// Remove plugin
				_, err = client.RemovePlugin(context.Background(), manifest.Id)
				require.NoError(t, err)

				// Plugin should have no status
				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Empty(t, pluginsResp.Inactive)
				require.Empty(t, pluginsResp.Active)

				// Upload same plugin
				manifest, _, err = client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
				require.NoError(t, err)
				require.Equal(t, "testplugin", manifest.Id)

				// Plugin should be inactive
				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Empty(t, pluginsResp.Active)
				require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
					Manifest: *manifest,
				}})

				// Clean up
				_, err = client.RemovePlugin(context.Background(), manifest.Id)
				require.NoError(t, err)
			})
		})
	}
}

func TestGetMarketplacePlugins(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.EnableMarketplace = false
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = false
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})

		plugins, resp, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, plugins)
	}, "marketplace disabled")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})

		plugins, resp, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugins)
	}, "no server")

	t.Run("no permission", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})

		plugins, resp, err := th.Client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, plugins)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "empty response from server")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
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
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify server version is passed through")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "false", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify EnterprisePlugins is false for TE")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "false", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		l := model.NewTestLicense()
		// model.NewTestLicense generates a E20 license
		*l.Features.EnterprisePlugins = false
		th.App.Srv().SetLicense(l)

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify EnterprisePlugins is false for E10")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "true", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		th.App.Srv().SetLicense(model.NewTestLicense("enterprise_plugins"))

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify EnterprisePlugins is true for E20")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			cloud, ok := req.URL.Query()["cloud"]
			require.True(t, ok)
			require.Len(t, cloud, 1)
			require.Equal(t, "false", cloud[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify EnterprisePlugins is false if there is no license")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			cloud, ok := req.URL.Query()["cloud"]
			require.True(t, ok)
			require.Len(t, cloud, 1)
			require.Equal(t, "true", cloud[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		plugins, _, err := client.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Empty(t, plugins)
	}, "verify Cloud is true for cloud license")
}

func TestGetInstalledMarketplacePlugins(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
				IconData:    "https://example.com/icon.svg",
				DownloadURL: "https://example.com/mattermost/mattermost-plugin-nps/releases/download/v1.0.4/com.mattermost.nps-1.0.4.tar.gz",
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
					Version:          "1.0.4",
					MinServerVersion: "5.14.0",
				},
			},
			InstalledVersion: "",
		},
	}

	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	t.Run("marketplace client returns not-installed plugin", func(t *testing.T) {
		th := Setup(t)
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
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, samplePlugins, plugins)

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

		testIcon, err := os.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		expectedPlugins := append(samplePlugins, &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL:     "https://example.com/homepage",
				IconData:        testIconData,
				DownloadURL:     "",
				ReleaseNotesURL: "https://example.com/releases/v0.0.1",
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

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, expectedPlugins, plugins)

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, samplePlugins, plugins)
	})

	t.Run("marketplace client returns installed plugin", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.EnableMarketplace = true
		})

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

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
			var out []byte
			out, err = json.Marshal([]*model.MarketplacePlugin{samplePlugins[0], newPlugin})
			require.NoError(t, err)
			res.Write(out)
		}))
		defer func() { testServer.Close() }()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, expectedPlugins, plugins)

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		newPlugin.InstalledVersion = ""
		require.Equal(t, expectedPlugins, plugins)
	})
}

func TestSearchGetMarketplacePlugins(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	samplePlugins := []*model.MarketplacePlugin{
		{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: "example.com/mattermost/mattermost-plugin-nps",
				IconData:    "Cjxzdmcgdmlld0JveD0nMCAwIDEwNSA5MycgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz4KPHBhdGggZD0nTTY2LDBoMzl2OTN6TTM4LDBoLTM4djkzek01MiwzNWwyNSw1OGgtMTZsLTgtMThoLTE4eicgZmlsbD0nI0VEMUMyNCcvPgo8L3N2Zz4K",
				DownloadURL: "example.com/mattermost/mattermost-plugin-nps/releases/download/v1.0.4/com.mattermost.nps-1.0.4.tar.gz",
				Manifest: &model.Manifest{
					Id:               "com.mattermost.nps",
					Name:             "User Satisfaction Surveys",
					Description:      "This plugin sends quarterly user satisfaction surveys to gather feedback and help improve Mattermost.",
					Version:          "1.0.4",
					MinServerVersion: "5.14.0",
				},
			},
			InstalledVersion: "",
		},
	}

	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	tarDataV2, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
	require.NoError(t, err)

	testIcon, err := os.ReadFile(filepath.Join(path, "test.svg"))
	require.NoError(t, err)
	require.True(t, svg.Is(testIcon))
	testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

	t.Run("search installed plugin", func(t *testing.T) {
		th := Setup(t).InitBasic()
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
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, samplePlugins, plugins)

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

		plugin1 := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL:     "https://example.com/homepage",
				IconData:        testIconData,
				DownloadURL:     "",
				ReleaseNotesURL: "https://example.com/releases/v0.0.1",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
				Manifest: manifest,
			},
			InstalledVersion: manifest.Version,
		}
		expectedPlugins := append(samplePlugins, plugin1)

		manifest, _, err = th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarDataV2))
		require.NoError(t, err)

		plugin2 := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				IconData:        testIconData,
				HomepageURL:     "https://example.com/homepage",
				DownloadURL:     "",
				ReleaseNotesURL: "https://example.com/releases/v1.2.3",
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

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)
		require.Equal(t, expectedPlugins, plugins)

		// Search for plugins from the server
		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Filter: "testplugin2"})
		require.NoError(t, err)
		require.Equal(t, []*model.MarketplacePlugin{plugin2}, plugins)

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Filter: "a second plugin"})
		require.NoError(t, err)
		require.Equal(t, []*model.MarketplacePlugin{plugin2}, plugins)

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Filter: "User Satisfaction Surveys"})
		require.NoError(t, err)
		require.Equal(t, samplePlugins, plugins)

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Filter: "NOFILTER"})
		require.NoError(t, err)
		require.Nil(t, plugins)

		// cleanup
		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), plugin1.Manifest.Id)
		require.NoError(t, err)

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), plugin2.Manifest.Id)
		require.NoError(t, err)
	})
}

func TestGetLocalPluginInMarketplace(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	th := Setup(t)
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
		*cfg.PluginSettings.MarketplaceURL = testServer.URL
	})

	t.Run("Get plugins with EnableRemoteMarketplace enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
		})

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

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
		tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

		require.Len(t, plugins, 2)

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)
	})

	t.Run("EnableRemoteMarketplace disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = false
			*cfg.PluginSettings.EnableUploads = true
		})

		// No marketplace plugins returned
		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

		require.Len(t, plugins, 0)

		// Upload one local plugin
		path, _ := fileutils.FindDir("tests")
		tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

		testIcon, err := os.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		newPlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				IconData:        testIconData,
				HomepageURL:     "https://example.com/homepage",
				ReleaseNotesURL: "https://example.com/releases/v0.0.1",
				Manifest:        manifest,
			},
			InstalledVersion: manifest.Version,
		}

		plugins, _, err = th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

		// Only get the local plugins
		require.Len(t, plugins, 1)
		require.Equal(t, newPlugin, plugins[0])

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)
	})

	t.Run("local_only true", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		// Upload one local plugin
		path, _ := fileutils.FindDir("tests")
		tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)

		manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)

		testIcon, err := os.ReadFile(filepath.Join(path, "test.svg"))
		require.NoError(t, err)
		require.True(t, svg.Is(testIcon))
		testIconData := fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(testIcon))

		newPlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest:        manifest,
				IconData:        testIconData,
				HomepageURL:     "https://example.com/homepage",
				ReleaseNotesURL: "https://example.com/releases/v0.0.1",
				Labels: []model.MarketplaceLabel{{
					Name:        "Local",
					Description: "This plugin is not listed in the marketplace",
				}},
			},
			InstalledVersion: manifest.Version,
		}

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{LocalOnly: true})
		require.NoError(t, err)

		require.Len(t, plugins, 1)
		require.Equal(t, newPlugin, plugins[0])

		_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)
	})
}

func TestGetRemotePluginInMarketplace(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	th := Setup(t)
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
		*cfg.PluginSettings.EnableRemoteMarketplace = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.MarketplaceURL = testServer.URL
	})

	// Upload one local plugin
	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	manifest, _, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
	require.NoError(t, err)

	plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{RemoteOnly: true})
	require.NoError(t, err)

	require.Len(t, plugins, 1)
	require.Equal(t, samplePlugins[0], plugins[0])

	_, err = th.SystemAdminClient.RemovePlugin(context.Background(), manifest.Id)
	require.NoError(t, err)
}

func TestGetPrepackagedPluginInMarketplace(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	th := Setup(t)
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
		*cfg.PluginSettings.MarketplaceURL = testServer.URL
	})

	prepackagePlugin := &plugin.PrepackagedPlugin{
		Manifest: &model.Manifest{
			Version: "0.0.1",
			Id:      "prepackaged.test",
		},
	}

	env := th.App.GetPluginsEnvironment()
	env.SetPrepackagedPlugins([]*plugin.PrepackagedPlugin{prepackagePlugin}, nil)

	t.Run("get remote and prepackaged plugins", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

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
		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

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
		env.SetPrepackagedPlugins([]*plugin.PrepackagedPlugin{newerPrepackagePlugin}, nil)

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

		require.Len(t, plugins, 1)
		require.Equal(t, newerPrepackagePlugin.Manifest, plugins[0].Manifest)
	})

	t.Run("prepackaged plugins are not shown in Cloud", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.EnableUploads = true
		})

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		plugins, _, err := th.SystemAdminClient.GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{})
		require.NoError(t, err)

		require.ElementsMatch(t, marketplacePlugins, plugins)
		require.Len(t, plugins, 1)
	})
}

func TestInstallMarketplacePlugin(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.EnableMarketplace = false
	})

	path, _ := fileutils.FindDir("tests")
	signatureFilename := "testplugin2.tar.gz.sig"
	signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
	require.NoError(t, err)
	sigFile, err := io.ReadAll(signatureFileReader)
	require.NoError(t, err)
	pluginSignature := base64.StdEncoding.EncodeToString(sigFile)

	tarData, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
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

	request := &model.InstallMarketplacePluginRequest{Id: ""}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = false
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})
		plugin, resp, err := client.InstallMarketplacePlugin(context.Background(), request)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, plugin)
	}, "marketplace disabled")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.RequirePluginSignature = true
		})
		manifest, resp, err := client.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, manifest)

		manifest, resp, err = client.InstallPluginFromURL(context.Background(), "some_url", true)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		require.Nil(t, manifest)
	}, "RequirePluginSignature enabled")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})

		plugin, resp, err := client.InstallMarketplacePlugin(context.Background(), request)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	}, "no server")

	t.Run("no permission", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = "invalid.com"
		})

		plugin, resp, err := th.Client.InstallMarketplacePlugin(context.Background(), request)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Nil(t, plugin)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})
		pRequest := &model.InstallMarketplacePluginRequest{Id: "some_plugin_id"}
		plugin, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	}, "plugin not found on the server")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[0]})
			require.NoError(t, err)
			res.Write(json)
		}))
		defer testServer.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
			*cfg.PluginSettings.AllowInsecureDownloadURL = true
		})
		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2"}
		plugin, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, plugin)
	}, "plugin not verified")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
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
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
		require.NoError(t, err)
		appErr := th.App.AddPublicKey("pub_key", key)
		require.Nil(t, appErr)

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2"}
		manifest, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.NoError(t, err)
		require.NotNil(t, manifest)
		require.Equal(t, "testplugin2", manifest.Id)
		require.Equal(t, "1.2.3", manifest.Version)

		filePath := filepath.Join("plugins", "testplugin2.tar.gz.sig")
		savedSigFile, appErr := th.App.ReadFile(filePath)
		require.Nil(t, appErr)
		require.EqualValues(t, sigFile, savedSigFile)

		_, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)
		exists, appErr := th.App.FileExists(filePath)
		require.Nil(t, appErr)
		require.False(t, exists)

		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	}, "verify, install and remove plugin")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
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
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
		require.NoError(t, err)
		appErr := th.App.AddPublicKey("pub_key", key)
		require.Nil(t, appErr)

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2", Version: "9.9.9"}
		manifest, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.NoError(t, err)
		require.NotNil(t, manifest)
		require.Equal(t, "testplugin2", manifest.Id)
		require.Equal(t, "1.2.3", manifest.Version)

		filePath := filepath.Join("plugins", "testplugin2.tar.gz.sig")
		savedSigFile, appErr := th.App.ReadFile(filePath)
		require.Nil(t, appErr)
		require.EqualValues(t, sigFile, savedSigFile)

		_, err = client.RemovePlugin(context.Background(), manifest.Id)
		require.NoError(t, err)
		exists, appErr := th.App.FileExists(filePath)
		require.Nil(t, appErr)
		require.False(t, exists)

		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	}, "ignore version in Marketplace request")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		requestHandled := false

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "false", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{samplePlugins[0]})
			require.NoError(t, err)
			_, err = res.Write(json)
			require.NoError(t, err)

			requestHandled = true
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
		manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)
		assert.True(t, requestHandled)
	}, "verify EnterprisePlugins is false for TE")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		requestHandled := false

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "false", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			_, err = res.Write(json)
			require.NoError(t, err)

			requestHandled = true
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.EnableRemoteMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		l := model.NewTestLicense()
		// model.NewTestLicense generates a E20 license
		*l.Features.EnterprisePlugins = false
		th.App.Srv().SetLicense(l)

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
		manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)
		assert.True(t, requestHandled)
	}, "verify EnterprisePlugins is false for E10")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		requestHandled := false

		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			licenseType, ok := req.URL.Query()["enterprise_plugins"]
			require.True(t, ok)
			require.Len(t, licenseType, 1)
			require.Equal(t, "true", licenseType[0])

			res.WriteHeader(http.StatusOK)
			json, err := json.Marshal([]*model.MarketplacePlugin{})
			require.NoError(t, err)
			_, err = res.Write(json)
			require.NoError(t, err)

			requestHandled = true
		}))
		defer func() { testServer.Close() }()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableMarketplace = true
			*cfg.PluginSettings.MarketplaceURL = testServer.URL
		})

		th.App.Srv().SetLicense(model.NewTestLicense("enterprise_plugins"))

		pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
		manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
		require.Nil(t, manifest)
		assert.True(t, requestHandled)
	}, "verify EnterprisePlugins is true for E20")
}

func TestInstallMarketplacePluginPrepackagedDisabled(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_STREAMLINEDMARKETPLACE")

	path, _ := fileutils.FindDir("tests")

	signatureFilename := "testplugin2.tar.gz.sig"
	signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
	require.NoError(t, err)
	sigFile, err := io.ReadAll(signatureFileReader)
	require.NoError(t, err)
	pluginSignature := base64.StdEncoding.EncodeToString(sigFile)

	tarData, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
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

	t.Run("install prepackaged and remote plugins through marketplace", func(t *testing.T) {
		prepackagedPluginsDir := "prepackaged_plugins"

		os.RemoveAll(prepackagedPluginsDir)
		err := os.Mkdir(prepackagedPluginsDir, os.ModePerm)
		require.NoError(t, err)
		defer os.RemoveAll(prepackagedPluginsDir)

		prepackagedPluginsDir, found := fileutils.FindDir(prepackagedPluginsDir)
		require.True(t, found, "failed to find prepackaged plugins directory")

		err = testlib.CopyFile(filepath.Join(path, "testplugin.tar.gz"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz"))
		require.NoError(t, err)
		err = testlib.CopyFile(filepath.Join(path, "testplugin.tar.gz.asc"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz.sig"))
		require.NoError(t, err)

		th := SetupConfig(t, func(cfg *model.Config) {
			// Disable auto-installing prepackaged plugins
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
		}).InitBasic()
		defer th.TearDown()

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			pluginSignatureFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz.asc"))
			require.NoError(t, err)
			pluginSignatureData, err := io.ReadAll(pluginSignatureFile)
			require.NoError(t, err)

			key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
			require.NoError(t, err)
			appErr := th.App.AddPublicKey("pub_key", key)
			require.Nil(t, appErr)

			t.Cleanup(func() {
				appErr = th.App.DeletePublicKey("pub_key")
				require.Nil(t, appErr)
			})

			testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
				serverVersion := req.URL.Query().Get("server_version")
				require.NotEmpty(t, serverVersion)
				require.Equal(t, model.CurrentVersion, serverVersion)
				res.WriteHeader(http.StatusOK)

				var out []byte

				// Return something if testplugin2 or no specific plugin is requested
				pluginID := req.URL.Query().Get("plugin_id")
				if pluginID == "" || pluginID == samplePlugins[1].Manifest.Id {
					out, err = json.Marshal([]*model.MarketplacePlugin{samplePlugins[1]})
					require.NoError(t, err)
				}

				res.Write(out)
			}))
			defer testServer.Close()

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.EnableMarketplace = true
				*cfg.PluginSettings.EnableRemoteMarketplace = false
				*cfg.PluginSettings.MarketplaceURL = testServer.URL
				*cfg.PluginSettings.AllowInsecureDownloadURL = false
			})

			env := th.App.GetPluginsEnvironment()

			pluginsResp, _, err := client.GetPlugins(context.Background())
			require.NoError(t, err)
			require.Len(t, pluginsResp.Active, 0)
			require.Len(t, pluginsResp.Inactive, 0)

			t.Run("Should fail to install unknown prepackaged plugin", func(t *testing.T) {
				pRequest := &model.InstallMarketplacePluginRequest{Id: "testpluginXX"}
				manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.Error(t, err)
				CheckInternalErrorStatus(t, resp)
				require.Nil(t, manifest)

				plugins := env.PrepackagedPlugins()
				require.Len(t, plugins, 1)
				require.Equal(t, "testplugin", plugins[0].Manifest.Id)
				require.Equal(t, pluginSignatureData, plugins[0].Signature)

				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Len(t, pluginsResp.Active, 0)
				require.Len(t, pluginsResp.Inactive, 0)
			})

			t.Run("Install prepackaged plugin with Marketplace disabled", func(t *testing.T) {
				pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
				manifest, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.NoError(t, err)
				require.NotNil(t, manifest)
				require.Equal(t, "testplugin", manifest.Id)
				require.Equal(t, "0.0.1", manifest.Version)

				t.Cleanup(func() {
					_, err = client.RemovePlugin(context.Background(), manifest.Id)
					require.NoError(t, err)
				})

				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Len(t, pluginsResp.Active, 0)
				require.Equal(t, pluginsResp.Inactive, []*model.PluginInfo{{
					Manifest: *manifest,
				}})
			})

			t.Run("Try to install remote marketplace plugin while Marketplace is disabled", func(t *testing.T) {
				pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin2"}
				manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.Error(t, err)
				CheckInternalErrorStatus(t, resp)
				require.Nil(t, manifest)
			})

			// Enable remote marketplace
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.EnableMarketplace = true
				*cfg.PluginSettings.EnableRemoteMarketplace = true
				*cfg.PluginSettings.MarketplaceURL = testServer.URL
				*cfg.PluginSettings.AllowInsecureDownloadURL = true
			})

			t.Run("Install prepackaged, not listed plugin with Marketplace enabled", func(t *testing.T) {
				pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
				manifest, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.NoError(t, err)

				t.Cleanup(func() {
					_, err = client.RemovePlugin(context.Background(), manifest.Id)
					require.NoError(t, err)
				})

				require.NotNil(t, manifest)
				assert.Equal(t, "testplugin", manifest.Id)
				assert.Equal(t, "0.0.1", manifest.Version)
			})

			t.Run("Install both a prepacked and a Marketplace plugin", func(t *testing.T) {
				pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
				manifest1, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.NoError(t, err)
				require.NotNil(t, manifest1)
				assert.Equal(t, "testplugin", manifest1.Id)
				assert.Equal(t, "0.0.1", manifest1.Version)

				t.Cleanup(func() {
					_, err = client.RemovePlugin(context.Background(), manifest1.Id)
					require.NoError(t, err)
				})

				pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin2"}
				manifest2, _, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
				require.NoError(t, err)
				require.NotNil(t, manifest2)
				require.Equal(t, "testplugin2", manifest2.Id)
				require.Equal(t, "1.2.3", manifest2.Version)

				t.Cleanup(func() {
					_, err = client.RemovePlugin(context.Background(), manifest2.Id)
					require.NoError(t, err)
				})

				pluginsResp, _, err = client.GetPlugins(context.Background())
				require.NoError(t, err)
				require.Len(t, pluginsResp.Active, 0)
				require.ElementsMatch(t, pluginsResp.Inactive, []*model.PluginInfo{
					{
						Manifest: *manifest1,
					},
					{
						Manifest: *manifest2,
					},
				})
			})

			appErr = th.App.DeletePublicKey("pub_key")
			require.Nil(t, appErr)
		})
	})

	t.Run("missing prepackaged and remote plugin signatures", func(t *testing.T) {
		prepackagedPluginsDir := "prepackaged_plugins"

		os.RemoveAll(prepackagedPluginsDir)
		err := os.Mkdir(prepackagedPluginsDir, os.ModePerm)
		require.NoError(t, err)
		defer os.RemoveAll(prepackagedPluginsDir)

		prepackagedPluginsDir, found := fileutils.FindDir(prepackagedPluginsDir)
		require.True(t, found, "failed to find prepackaged plugins directory")

		err = testlib.CopyFile(filepath.Join(path, "testplugin.tar.gz"), filepath.Join(prepackagedPluginsDir, "testplugin.tar.gz"))
		require.NoError(t, err)

		th := SetupConfig(t, func(cfg *model.Config) {
			// Disable auto-installing prepackaged plugins
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
		}).InitBasic()
		defer th.TearDown()

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
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
				var out []byte
				out, err = json.Marshal(mPlugins)
				require.NoError(t, err)
				res.Write(out)
			}))
			defer testServer.Close()

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.EnableMarketplace = true
				*cfg.PluginSettings.EnableRemoteMarketplace = true
				*cfg.PluginSettings.MarketplaceURL = testServer.URL
				*cfg.PluginSettings.AllowInsecureDownloadURL = true
			})

			env := th.App.GetPluginsEnvironment()
			plugins := env.PrepackagedPlugins()
			require.Len(t, plugins, 1)
			require.Equal(t, "testplugin", plugins[0].Manifest.Id)
			require.Empty(t, plugins[0].Signature)

			pluginsResp, _, err := client.GetPlugins(context.Background())
			require.NoError(t, err)
			require.Len(t, pluginsResp.Active, 0)
			require.Len(t, pluginsResp.Inactive, 0)

			pRequest := &model.InstallMarketplacePluginRequest{Id: "testplugin"}
			manifest, resp, err := client.InstallMarketplacePlugin(context.Background(), pRequest)
			require.Error(t, err)
			CheckInternalErrorStatus(t, resp)
			require.Nil(t, manifest)

			pluginsResp, _, err = client.GetPlugins(context.Background())
			require.NoError(t, err)
			require.Len(t, pluginsResp.Active, 0)
			require.Len(t, pluginsResp.Inactive, 0)

			pRequest = &model.InstallMarketplacePluginRequest{Id: "testplugin2"}
			manifest, resp, err = client.InstallMarketplacePlugin(context.Background(), pRequest)
			require.Error(t, err)
			CheckInternalErrorStatus(t, resp)
			require.Nil(t, manifest)

			pluginsResp, _, err = client.GetPlugins(context.Background())
			require.NoError(t, err)
			require.Len(t, pluginsResp.Active, 0)
			require.Len(t, pluginsResp.Inactive, 0)

			// Clean up
			appErr = th.App.DeletePublicKey("pub_key")
			require.Nil(t, appErr)
		})
	})
}

func findClusterMessages(event model.ClusterEvent, msgs []*model.ClusterMessage) []*model.ClusterMessage {
	var result []*model.ClusterMessage
	for _, msg := range msgs {
		if msg.Event == event {
			result = append(result, msg)
		}
	}
	return result
}
