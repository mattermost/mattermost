// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func getHashedKey(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func TestPluginKeyValueStore(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	pluginID := "testpluginid"

	defer func() {
		assert.Nil(t, th.App.DeletePluginKey(pluginID, "key"))
		assert.Nil(t, th.App.DeletePluginKey(pluginID, "key2"))
		assert.Nil(t, th.App.DeletePluginKey(pluginID, "key3"))
		assert.Nil(t, th.App.DeletePluginKey(pluginID, "key4"))
	}()

	assert.Nil(t, th.App.SetPluginKey(pluginID, "key", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test inserting over existing entries
	assert.Nil(t, th.App.SetPluginKey(pluginID, "key", []byte("test2")))
	ret, err = th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test2"), ret)

	// Test getting non-existent key
	ret, err = th.App.GetPluginKey(pluginID, "notakey")
	assert.Nil(t, err)
	assert.Nil(t, ret)

	// Test deleting non-existent keys.
	assert.Nil(t, th.App.DeletePluginKey(pluginID, "notrealkey"))

	// Verify behaviour for the old approach that involved storing the hashed keys.
	hashedKey2 := getHashedKey("key2")
	kv := &model.PluginKeyValue{
		PluginId: pluginID,
		Key:      hashedKey2,
		Value:    []byte("test"),
		ExpireAt: 0,
	}

	_, nErr := th.App.Srv().Store().Plugin().SaveOrUpdate(kv)
	assert.NoError(t, nErr)

	// Test fetch by keyname (this key does not exist but hashed key will be used for lookup)
	ret, err = th.App.GetPluginKey(pluginID, "key2")
	assert.Nil(t, err)
	assert.Equal(t, kv.Value, ret)

	// Test fetch by hashed keyname
	ret, err = th.App.GetPluginKey(pluginID, hashedKey2)
	assert.Nil(t, err)
	assert.Equal(t, kv.Value, ret)

	// Test ListKeys
	assert.Nil(t, th.App.SetPluginKey(pluginID, "key3", []byte("test3")))
	assert.Nil(t, th.App.SetPluginKey(pluginID, "key4", []byte("test4")))

	list, err := th.App.ListPluginKeys(pluginID, 0, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key"}, list)

	list, err = th.App.ListPluginKeys(pluginID, 1, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key3"}, list)

	list, err = th.App.ListPluginKeys(pluginID, 0, 4)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginID, 0, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3"}, list)

	list, err = th.App.ListPluginKeys(pluginID, 1, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginID, 2, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{}, list)

	// List Keys bad input
	list, err = th.App.ListPluginKeys(pluginID, 0, 0)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginID, 0, -1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginID, -1, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key"}, list)

	list, err = th.App.ListPluginKeys(pluginID, -1, 0)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)
}

func TestPluginKeyValueStoreCompareAndSet(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	pluginID := "testpluginid"

	defer func() {
		assert.Nil(t, th.App.DeletePluginKey(pluginID, "key"))
	}()

	// Set using Set api for key2
	assert.Nil(t, th.App.SetPluginKey(pluginID, "key2", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginID, "key2")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Attempt to insert value for key2
	updated, err := th.App.CompareAndSetPluginKey(pluginID, "key2", nil, []byte("test2"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginID, "key2")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Insert new value for key
	updated, err = th.App.CompareAndSetPluginKey(pluginID, "key", nil, []byte("test"))
	assert.Nil(t, err)
	assert.True(t, updated)
	ret, err = th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Should fail to insert again
	updated, err = th.App.CompareAndSetPluginKey(pluginID, "key", nil, []byte("test3"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test updating using incorrect old value
	updated, err = th.App.CompareAndSetPluginKey(pluginID, "key", []byte("oldvalue"), []byte("test3"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test updating using correct old value
	updated, err = th.App.CompareAndSetPluginKey(pluginID, "key", []byte("test"), []byte("test2"))
	assert.Nil(t, err)
	assert.True(t, updated)
	ret, err = th.App.GetPluginKey(pluginID, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test2"), ret)
}

func TestPluginKeyValueStoreSetWithOptionsJSON(t *testing.T) {
	mainHelper.Parallel(t)
	pluginID := "testpluginid"

	t.Run("storing a value without providing options works", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		result, err := th.App.SetPluginKeyWithOptions(pluginID, "key", []byte("value-1"), model.PluginKVSetOptions{})
		assert.True(t, result)
		assert.Nil(t, err)

		// and I can get it back!
		ret, err := th.App.GetPluginKey(pluginID, "key")
		assert.Nil(t, err)
		assert.Equal(t, []byte(`value-1`), ret)
	})

	t.Run("test that setting it atomic when it doesn't match doesn't change anything", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		err := th.App.SetPluginKey(pluginID, "key", []byte("value-1"))
		require.Nil(t, err)

		result, err := th.App.SetPluginKeyWithOptions(pluginID, "key", []byte("value-3"), model.PluginKVSetOptions{
			Atomic:   true,
			OldValue: []byte("value-2"),
		})
		assert.False(t, result)
		assert.Nil(t, err)

		// test that the value didn't change
		ret, err := th.App.GetPluginKey(pluginID, "key")
		assert.Nil(t, err)
		assert.Equal(t, []byte(`value-1`), ret)
	})

	t.Run("test the atomic change with the proper old value", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		err := th.App.SetPluginKey(pluginID, "key", []byte("value-2"))
		require.Nil(t, err)

		result, err := th.App.SetPluginKeyWithOptions(pluginID, "key", []byte("value-3"), model.PluginKVSetOptions{
			Atomic:   true,
			OldValue: []byte("value-2"),
		})
		assert.True(t, result)
		assert.Nil(t, err)

		// test that the value did change
		ret, err := th.App.GetPluginKey(pluginID, "key")
		assert.Nil(t, err)
		assert.Equal(t, []byte(`value-3`), ret)
	})

	t.Run("when new value is nil and old value matches with the current, it should delete the currently set value", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// first set a value.
		result, err := th.App.SetPluginKeyWithOptions(pluginID, "nil-test-key-2", []byte("value-1"), model.PluginKVSetOptions{})
		require.Nil(t, err)
		require.True(t, result)

		// now it should delete the set value.
		result, err = th.App.SetPluginKeyWithOptions(pluginID, "nil-test-key-2", nil, model.PluginKVSetOptions{
			Atomic:   true,
			OldValue: []byte("value-1"),
		})
		assert.Nil(t, err)
		assert.True(t, result)

		ret, err := th.App.GetPluginKey(pluginID, "nil-test-key-2")
		assert.Nil(t, err)
		assert.Nil(t, ret)
	})

	t.Run("when new value is nil and there is a value set for the key already, it should delete the currently set value", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// first set a value.
		result, err := th.App.SetPluginKeyWithOptions(pluginID, "nil-test-key-3", []byte("value-1"), model.PluginKVSetOptions{})
		require.Nil(t, err)
		require.True(t, result)

		// now it should delete the set value.
		result, err = th.App.SetPluginKeyWithOptions(pluginID, "nil-test-key-3", nil, model.PluginKVSetOptions{})
		assert.Nil(t, err)
		assert.True(t, result)

		// verify a nil value is returned
		ret, err := th.App.GetPluginKey(pluginID, "nil-test-key-3")
		assert.Nil(t, err)
		assert.Nil(t, ret)

		// verify the row is actually gone
		list, err := th.App.ListPluginKeys(pluginID, 0, 1)
		assert.Nil(t, err)
		assert.Empty(t, list)
	})

	t.Run("when old value is nil and there is no value set for the key before, it should set the new value", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		result, err := th.App.SetPluginKeyWithOptions(pluginID, "nil-test-key-4", []byte("value-1"), model.PluginKVSetOptions{
			Atomic:   true,
			OldValue: nil,
		})
		assert.Nil(t, err)
		assert.True(t, result)

		ret, err := th.App.GetPluginKey(pluginID, "nil-test-key-4")
		assert.Nil(t, err)
		assert.Equal(t, []byte("value-1"), ret)
	})

	t.Run("test that value is set and unset with ExpireInSeconds", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		result, err := th.App.SetPluginKeyWithOptions(pluginID, "key", []byte("value-1"), model.PluginKVSetOptions{
			ExpireInSeconds: 1,
		})
		assert.True(t, result)
		assert.Nil(t, err)

		// test that the value is set
		ret, err := th.App.GetPluginKey(pluginID, "key")
		assert.Nil(t, err)
		assert.Equal(t, []byte(`value-1`), ret)

		// test that the value is not longer
		time.Sleep(1500 * time.Millisecond)

		ret, err = th.App.GetPluginKey(pluginID, "key")
		assert.Nil(t, err)
		assert.Nil(t, ret)
	})
}

func TestGetPluginStatusesDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	_, err := th.App.GetPluginStatuses()
	require.NotNil(t, err)
	require.EqualError(t, err, "GetPluginStatuses: Plugins have been disabled. Please check your logs for details.")
}

func TestGetPluginStatuses(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
	})

	pluginStatuses, err := th.App.GetPluginStatuses()
	require.Nil(t, err)
	require.NotNil(t, pluginStatuses)
}

func TestPluginSync(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.PluginSettings.SignaturePublicKeyFiles = []string{
			filepath.Join(path, "development-private-key.asc"),
		}
	})
	defer th.TearDown()

	testCases := []struct {
		Description string
		ConfigFunc  func(cfg *model.Config)
	}{
		{
			"local",
			func(cfg *model.Config) {
				cfg.FileSettings.DriverName = model.NewPointer(model.ImageDriverLocal)
			},
		},
		{
			"s3",
			func(cfg *model.Config) {
				s3Host := os.Getenv("CI_MINIO_HOST")
				if s3Host == "" {
					s3Host = "localhost"
				}

				s3Port := os.Getenv("CI_MINIO_PORT")
				if s3Port == "" {
					s3Port = "9000"
				}

				s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)
				cfg.FileSettings.DriverName = model.NewPointer(model.ImageDriverS3)
				cfg.FileSettings.AmazonS3AccessKeyId = model.NewPointer(model.MinioAccessKey)
				cfg.FileSettings.AmazonS3SecretAccessKey = model.NewPointer(model.MinioSecretKey)
				cfg.FileSettings.AmazonS3Bucket = model.NewPointer(model.MinioBucket)
				cfg.FileSettings.AmazonS3PathPrefix = model.NewPointer("")
				cfg.FileSettings.AmazonS3Endpoint = model.NewPointer(s3Endpoint)
				cfg.FileSettings.AmazonS3Region = model.NewPointer("")
				cfg.FileSettings.AmazonS3SSL = model.NewPointer(false)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = true
				testCase.ConfigFunc(cfg)
			})

			env := th.App.GetPluginsEnvironment()
			require.NotNil(t, env)

			t.Run("new bundle in the file store", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.RequirePluginSignature = false
				})

				fileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
				require.NoError(t, err)
				defer fileReader.Close()

				_, appErr := th.App.WriteFile(fileReader, getBundleStorePath("testplugin"))
				checkNoError(t, appErr)

				appErr = th.App.SyncPlugins()
				checkNoError(t, appErr)

				// Check if installed
				pluginStatus, err := env.Statuses()
				require.NoError(t, err)
				require.Len(t, pluginStatus, 1)
				require.Equal(t, pluginStatus[0].PluginId, "testplugin")
			})

			t.Run("bundle removed from the file store", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.RequirePluginSignature = false
				})

				appErr := th.App.RemoveFile(getBundleStorePath("testplugin"))
				checkNoError(t, appErr)

				appErr = th.App.SyncPlugins()
				checkNoError(t, appErr)

				// Check if removed
				pluginStatus, err := env.Statuses()
				require.NoError(t, err)
				require.Empty(t, pluginStatus)
			})

			t.Run("plugin signatures required, no signature", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.RequirePluginSignature = true
				})

				pluginFileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
				require.NoError(t, err)
				defer pluginFileReader.Close()
				_, appErr := th.App.WriteFile(pluginFileReader, getBundleStorePath("testplugin"))
				checkNoError(t, appErr)

				appErr = th.App.SyncPlugins()
				checkNoError(t, appErr)
				pluginStatus, err := env.Statuses()
				require.NoError(t, err)
				require.Len(t, pluginStatus, 0)
			})

			t.Run("plugin signatures required, wrong signature", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.RequirePluginSignature = true
				})

				signatureFileReader, err := os.Open(filepath.Join(path, "testplugin2.tar.gz.sig"))
				require.NoError(t, err)
				defer signatureFileReader.Close()
				_, appErr := th.App.WriteFile(signatureFileReader, getSignatureStorePath("testplugin"))
				checkNoError(t, appErr)

				appErr = th.App.SyncPlugins()
				checkNoError(t, appErr)

				pluginStatus, err := env.Statuses()
				require.NoError(t, err)
				require.Len(t, pluginStatus, 0)
			})

			t.Run("plugin signatures required, correct signature", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.PluginSettings.RequirePluginSignature = true
				})

				signatureFileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz.sig"))
				require.NoError(t, err)
				defer signatureFileReader.Close()
				_, appErr := th.App.WriteFile(signatureFileReader, getSignatureStorePath("testplugin"))
				checkNoError(t, appErr)

				appErr = th.App.SyncPlugins()
				checkNoError(t, appErr)

				pluginStatus, err := env.Statuses()
				require.NoError(t, err)
				require.Len(t, pluginStatus, 1)
				require.Equal(t, pluginStatus[0].PluginId, "testplugin")

				appErr = th.App.DeletePublicKey("pub_key")
				checkNoError(t, appErr)

				appErr = th.App.ch.RemovePlugin("testplugin")
				checkNoError(t, appErr)
			})
		})
	}
}

// See https://github.com/mattermost/mattermost-server/issues/19189
func TestChannelsPluginsInit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	runNoPanicTest := func(t *testing.T) {
		path, _ := fileutils.FindDir("tests")

		require.NotPanics(t, func() {
			th.Server.Channels().initPlugins(th.Context, path, path)
		})
	}

	t.Run("no panics when plugins enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		runNoPanicTest(t)
	})

	t.Run("no panics when plugins disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		runNoPanicTest(t)
	})
}

func TestSyncPluginsActiveState(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
	})

	env := th.App.GetPluginsEnvironment()
	require.NotNil(t, env)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.RequirePluginSignature = false
	})

	path, _ := fileutils.FindDir("tests")
	fileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)
	defer fileReader.Close()

	_, appErr := th.App.WriteFile(fileReader, getBundleStorePath("testplugin"))
	checkNoError(t, appErr)

	// Sync with file store so the plugin environment has access to this plugin.
	appErr = th.App.SyncPlugins()
	checkNoError(t, appErr)

	// Verify the plugin was installed and set to deactivated.
	pluginStatus, err := env.Statuses()
	require.NoError(t, err)
	require.Len(t, pluginStatus, 1)
	require.Equal(t, pluginStatus[0].PluginId, "testplugin")
	require.Equal(t, pluginStatus[0].State, model.PluginStateNotRunning)

	// Enable plugin by setting setting config. This implicitly calls SyncPluginsActiveState through a config listener.
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
	})

	// Verify the plugin was activated due to config change.
	pluginStatus, err = env.Statuses()
	require.NoError(t, err)
	require.Len(t, pluginStatus, 1)
	require.Equal(t, pluginStatus[0].PluginId, "testplugin")
	require.Equal(t, pluginStatus[0].State, model.PluginStateRunning)

	// Disable plugin by setting config. This implicitly calls SyncPluginsActiveState through a config listener.
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: false}
	})

	// Verify the plugin was deactivated due to config change.
	pluginStatus, err = env.Statuses()
	require.NoError(t, err)
	require.Len(t, pluginStatus, 1)
	require.Equal(t, pluginStatus[0].PluginId, "testplugin")
	require.Equal(t, pluginStatus[0].State, model.PluginStateNotRunning)
}

func TestPluginPanicLogs(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should panic", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			panic("some text from panic")
			return nil, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
		}, th.App, th.NewPluginAPI)

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		assert.Nil(t, err)

		th.TestLogger.Flush()

		// We shutdown plugins first so that the read on the log buffer is race-free.
		th.App.ch.ShutDownPlugins()
		tearDown()

		testlib.AssertLog(t, th.LogBuffer, mlog.LvlDebug.Name, "panic: some text from panic")
	})
}

func TestPluginStatusActivateError(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should return error from OnActivate in plugin statuses", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		pluginSource := `
		package main

		import (
			"errors"

			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			return errors.New("sample error")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{pluginSource}, th.App, th.NewPluginAPI)
		defer tearDown()

		env := th.App.GetPluginsEnvironment()
		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		require.Equal(t, "sample error", pluginStatus[0].Error)
	})
}

type byID []*plugin.PrepackagedPlugin

func (a byID) Len() int           { return len(a) }
func (a byID) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byID) Less(i, j int) bool { return a[i].Manifest.Id < a[j].Manifest.Id }

type pluginStatusById model.PluginStatuses

func (a pluginStatusById) Len() int           { return len(a) }
func (a pluginStatusById) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a pluginStatusById) Less(i, j int) bool { return a[i].PluginId < a[j].PluginId }

func TestProcessPrepackagedPlugins(t *testing.T) {
	mainHelper.Parallel(t)
	testsPath, found := fileutils.FindDir("tests")
	require.True(t, found, "failed to find tests directory")

	setup := func(t *testing.T) *TestHelper {
		t.Helper()

		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.PluginSettings.SignaturePublicKeyFiles = []string{
				filepath.Join(testsPath, "development-private-key.asc"),
			}
		})
		t.Cleanup(th.TearDown)

		// Make a prepackaged_plugins directory for use with the tests.
		err := os.Mkdir(filepath.Join(th.tempWorkspace, prepackagedPluginsDir), os.ModePerm)
		require.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableRemoteMarketplace = false
		})

		return th
	}

	initPlugins := func(t *testing.T, th *TestHelper) ([]*plugin.PrepackagedPlugin, []*plugin.PrepackagedPlugin) {
		t.Helper()

		appErr := th.App.ch.syncPlugins()
		require.Nil(t, appErr)

		err := th.App.ch.processPrepackagedPlugins(filepath.Join(th.tempWorkspace, prepackagedPluginsDir))
		require.NoError(t, err)

		env := th.App.GetPluginsEnvironment()
		plugins, transitionalPlugins := env.PrepackagedPlugins(), env.TransitionallyPrepackagedPlugins()
		th.App.ch.persistTransitionallyPrepackagedPlugins()

		return plugins, transitionalPlugins
	}

	copyAsPrepackagedPlugin := func(t *testing.T, th *TestHelper, filename string) {
		t.Helper()

		err := testlib.CopyFile(filepath.Join(testsPath, filename), filepath.Join(th.tempWorkspace, prepackagedPluginsDir, filename))
		require.NoError(t, err)

		err = testlib.CopyFile(filepath.Join(testsPath, fmt.Sprintf("%s.sig", filename)), filepath.Join(th.tempWorkspace, prepackagedPluginsDir, fmt.Sprintf("%s.sig", filename)))
		require.NoError(t, err)
	}

	copyAsFilestorePlugin := func(t *testing.T, th *TestHelper, bundleFilename, pluginID string) {
		t.Helper()

		err := testlib.CopyFile(filepath.Join(testsPath, bundleFilename), filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz", pluginID)))
		require.NoError(t, err)
		err = testlib.CopyFile(filepath.Join(testsPath, fmt.Sprintf("%s.sig", bundleFilename)), filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz.sig", pluginID)))
		require.NoError(t, err)
	}

	expectPrepackagedPlugin := func(t *testing.T, pluginID, version string, actual *plugin.PrepackagedPlugin) {
		t.Helper()

		require.Equal(t, pluginID, actual.Manifest.Id)
		require.NotEmpty(t, actual.SignaturePath, "testplugin has no signature")
		require.Equal(t, version, actual.Manifest.Version)
	}

	expectPluginInFilestore := func(t *testing.T, th *TestHelper, pluginID, version string) {
		t.Helper()

		bundlePath := filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz", pluginID))

		require.FileExists(t, bundlePath)
		require.FileExists(t, filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz.sig", pluginID)))

		// Verify the version recorded in the Manifest
		f, err := os.Open(bundlePath)
		require.NoError(t, err)

		uncompressedStream, err := gzip.NewReader(f)
		require.NoError(t, err)

		tarReader := tar.NewReader(uncompressedStream)

		var manifest model.Manifest
		for {
			header, err := tarReader.Next()
			if err == io.EOF {
				break
			}
			require.NoError(t, err)

			t.Log(header.Name)
			if header.Typeflag == tar.TypeReg && filepath.Base(header.Name) == "plugin.json" {
				manifestReader := json.NewDecoder(tarReader)
				err = manifestReader.Decode(&manifest)
				require.NoError(t, err)
				break
			}
		}

		require.Equal(t, pluginID, manifest.Id, "failed to find manifest")
		require.Equal(t, version, manifest.Version)
	}

	expectPluginNotInFilestore := func(t *testing.T, th *TestHelper, pluginID string) {
		t.Helper()

		require.NoFileExists(t, filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz", pluginID)))
		require.NoFileExists(t, filepath.Join(*th.App.Config().FileSettings.Directory, fmt.Sprintf("plugins/%s.tar.gz.sig", pluginID)))
	}

	expectPluginStatus := func(t *testing.T, pluginID, version string, actual *model.PluginStatus) {
		t.Helper()

		require.Equal(t, pluginID, actual.PluginId)
		require.Equal(t, version, actual.Version)
	}

	t.Run("single plugin automatically installed since enabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 1, "expected one prepackaged plugin")
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin", "0.0.1", pluginStatus[0])

		expectPluginNotInFilestore(t, th, "testplugin")
	})

	t.Run("single plugin, not automatically installed since not enabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 1, "expected one prepackaged plugin")
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Empty(t, pluginStatus, 0)

		expectPluginNotInFilestore(t, th, "testplugin")
	})

	t.Run("single plugin, not automatically installed despite enabled since automatic prepackaged plugins disabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 1, "expected one prepackaged plugin")
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Empty(t, pluginStatus, 0)

		expectPluginNotInFilestore(t, th, "testplugin")
	})

	t.Run("multiple plugins, some automatically installed since enabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin2", "1.2.3", pluginStatus[0])

		expectPluginNotInFilestore(t, th, "testplugin")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("multiple plugins, one previously installed, all now installed", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
		})

		copyAsFilestorePlugin(t, th, "testplugin.tar.gz", "testplugin")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)

		sort.Sort(pluginStatusById(pluginStatus))

		require.Len(t, pluginStatus, 2)
		expectPluginStatus(t, "testplugin", "0.0.1", pluginStatus[0])
		expectPluginStatus(t, "testplugin2", "1.2.3", pluginStatus[1])

		expectPluginInFilestore(t, th, "testplugin", "0.0.1")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("multiple plugins, one previously installed and now upgraded, all now installed", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
		})

		copyAsFilestorePlugin(t, th, "testplugin.tar.gz", "testplugin")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin-v0.0.2.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		err := th.App.ch.processPrepackagedPlugins(filepath.Join(th.tempWorkspace, prepackagedPluginsDir))
		require.NoError(t, err)

		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.2", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)

		sort.Sort(pluginStatusById(pluginStatus))

		require.Len(t, pluginStatus, 2)
		expectPluginStatus(t, "testplugin", "0.0.2", pluginStatus[0])
		expectPluginStatus(t, "testplugin2", "1.2.3", pluginStatus[1])

		expectPluginInFilestore(t, th, "testplugin", "0.0.1")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("multiple plugins, one previously installed but prepackaged is older, all now installed", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
		})

		copyAsFilestorePlugin(t, th, "testplugin-v0.0.2.tar.gz", "testplugin")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)

		sort.Sort(pluginStatusById(pluginStatus))

		require.Len(t, pluginStatus, 2)
		expectPluginStatus(t, "testplugin", "0.0.2", pluginStatus[0])
		expectPluginStatus(t, "testplugin2", "1.2.3", pluginStatus[1])

		expectPluginInFilestore(t, th, "testplugin", "0.0.2")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("multiple plugins, not automatically installed despite enabled since automatic prepackaged plugins disabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = false
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 0)

		expectPluginNotInFilestore(t, th, "testplugin")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("removing a prepackaged plugin leaves it disabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
			cfg.PluginSettings.PluginStates["testplugin2"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")
		copyAsPrepackagedPlugin(t, th, "testplugin2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)

		sort.Sort(pluginStatusById(pluginStatus))

		require.Len(t, pluginStatus, 2)
		require.Equal(t, "testplugin", pluginStatus[0].PluginId)
		require.Equal(t, "testplugin2", pluginStatus[1].PluginId)

		appErr := th.App.ch.RemovePlugin("testplugin")
		checkNoError(t, appErr)

		pluginStatus, err = env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		require.Equal(t, "testplugin2", pluginStatus[0].PluginId)

		plugins, transitionalPlugins = initPlugins(t, th)
		require.Len(t, plugins, 2, "expected two prepackaged plugins")
		sort.Sort(byID(plugins))
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", plugins[0])
		expectPrepackagedPlugin(t, "testplugin2", "1.2.3", plugins[1])
		require.Empty(t, transitionalPlugins)

		pluginStatus, err = env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin2", "1.2.3", pluginStatus[0])

		expectPluginNotInFilestore(t, th, "testplugin")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("single transitional plugin automatically installed and persisted since enabled", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		oldTransitionallyPrepackagedPlugins := append([]string{}, transitionallyPrepackagedPlugins...)
		transitionallyPrepackagedPlugins = append(transitionallyPrepackagedPlugins, "testplugin")
		defer func() {
			transitionallyPrepackagedPlugins = oldTransitionallyPrepackagedPlugins
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Empty(t, plugins)
		require.Len(t, transitionalPlugins, 1)
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", transitionalPlugins[0])

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin", "0.0.1", pluginStatus[0])

		expectPluginInFilestore(t, th, "testplugin", "0.0.1")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("single transitional plugin not persisted since already in filestore", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		oldTransitionallyPrepackagedPlugins := append([]string{}, transitionallyPrepackagedPlugins...)
		transitionallyPrepackagedPlugins = append(transitionallyPrepackagedPlugins, "testplugin")
		defer func() {
			transitionallyPrepackagedPlugins = oldTransitionallyPrepackagedPlugins
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsFilestorePlugin(t, th, "testplugin.tar.gz", "testplugin")
		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Empty(t, plugins)
		require.Empty(t, transitionalPlugins)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin", "0.0.1", pluginStatus[0])

		expectPluginInFilestore(t, th, "testplugin", "0.0.1")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("single transitional plugin persisted since newer than filestore", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		oldTransitionallyPrepackagedPlugins := append([]string{}, transitionallyPrepackagedPlugins...)
		transitionallyPrepackagedPlugins = append(transitionallyPrepackagedPlugins, "testplugin")
		defer func() {
			transitionallyPrepackagedPlugins = oldTransitionallyPrepackagedPlugins
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsFilestorePlugin(t, th, "testplugin.tar.gz", "testplugin")
		copyAsPrepackagedPlugin(t, th, "testplugin-v0.0.2.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Empty(t, plugins)
		require.Len(t, transitionalPlugins, 1)
		expectPrepackagedPlugin(t, "testplugin", "0.0.2", transitionalPlugins[0])

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Len(t, pluginStatus, 1)
		expectPluginStatus(t, "testplugin", "0.0.2", pluginStatus[0])

		expectPluginInFilestore(t, th, "testplugin", "0.0.2")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})

	t.Run("transitional plugins persisted only once", func(t *testing.T) {
		th := setup(t)
		env := th.App.GetPluginsEnvironment()

		oldTransitionallyPrepackagedPlugins := append([]string{}, transitionallyPrepackagedPlugins...)
		transitionallyPrepackagedPlugins = append(transitionallyPrepackagedPlugins, "testplugin")
		defer func() {
			transitionallyPrepackagedPlugins = oldTransitionallyPrepackagedPlugins
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.PluginStates["testplugin"] = &model.PluginState{Enable: true}
		})

		copyAsPrepackagedPlugin(t, th, "testplugin.tar.gz")

		plugins, transitionalPlugins := initPlugins(t, th)
		require.Empty(t, plugins)
		require.Len(t, transitionalPlugins, 1)
		expectPrepackagedPlugin(t, "testplugin", "0.0.1", transitionalPlugins[0])

		appErr := th.App.ch.RemovePlugin("testplugin")
		require.Nil(t, appErr)

		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		require.Empty(t, pluginStatus, 0)

		th.App.ch.persistTransitionallyPrepackagedPlugins()

		expectPluginNotInFilestore(t, th, "testplugin")
		expectPluginNotInFilestore(t, th, "testplugin2")
	})
}

func TestGetPluginStateOverride(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	t.Run("no override", func(t *testing.T) {
		overrides, value := th.App.ch.getPluginStateOverride("focalboard")
		require.False(t, overrides)
		require.False(t, value)
	})

	t.Run("apps override", func(t *testing.T) {
		t.Run("without enabled flag", func(t *testing.T) {
			overrides, value := th.App.ch.getPluginStateOverride("com.mattermost.apps")
			require.True(t, overrides)
			require.False(t, value)
		})

		t.Run("with enabled flag set to true", func(t *testing.T) {
			mainHelper.Parallel(t)
			th2 := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.AppsEnabled = true
			})
			defer th2.TearDown()

			overrides, value := th2.App.ch.getPluginStateOverride("com.mattermost.apps")
			require.False(t, overrides)
			require.False(t, value)
		})

		t.Run("with enabled flag set to false", func(t *testing.T) {
			mainHelper.Parallel(t)
			th2 := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.AppsEnabled = false
			})
			defer th2.TearDown()

			overrides, value := th2.App.ch.getPluginStateOverride("com.mattermost.apps")
			require.True(t, overrides)
			require.False(t, value)
		})
	})
}
