// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

type nilReadSeeker struct{}

func (r *nilReadSeeker) Read(p []byte) (int, error) {
	return 0, io.EOF
}

func (r *nilReadSeeker) Seek(offset int64, whence int) (int64, error) {
	return 0, nil
}

type testFile struct {
	Name, Body string
}

func makeInMemoryGzipTarFile(t *testing.T, files []testFile) *bytes.Reader {
	var buf bytes.Buffer
	gzWriter := gzip.NewWriter(&buf)

	tgz := tar.NewWriter(gzWriter)

	for _, file := range files {
		hdr := &tar.Header{
			Name: file.Name,
			Mode: 0600,
			Size: int64(len(file.Body)),
		}
		err := tgz.WriteHeader(hdr)
		require.NoError(t, err, "failed to write %s to in-memory tar file", file.Name)
		_, err = tgz.Write([]byte(file.Body))
		require.NoError(t, err, "failed to write body of %s to in-memory tar file", file.Name)
	}
	err := tgz.Close()
	require.NoError(t, err, "failed to close in-memory tar file")

	err = gzWriter.Close()
	require.NoError(t, err, "failed to close in-memory tar.gz file")

	return bytes.NewReader(buf.Bytes())
}

func TestInstallPluginLocally(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("invalid tar", func(t *testing.T) {
		th := Setup(t)

		actualManifest, appErr := th.App.ch.installPluginLocally(&nilReadSeeker{}, installPluginLocallyOnlyIfNew)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.extract.app_error", appErr.Id, appErr.Error())
		require.Nil(t, actualManifest)
	})

	t.Run("missing manifest", func(t *testing.T) {
		th := Setup(t)

		reader := makeInMemoryGzipTarFile(t, []testFile{
			{"test", "test file"},
		})

		actualManifest, appErr := th.App.ch.installPluginLocally(reader, installPluginLocallyOnlyIfNew)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.manifest.app_error", appErr.Id, appErr.Error())
		require.Nil(t, actualManifest)
	})

	installPlugin := func(t *testing.T, th *TestHelper, id, version string, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
		t.Helper()

		manifest := &model.Manifest{
			Id:      id,
			Version: version,
		}
		manifestJSON, jsonErr := json.Marshal(manifest)
		require.NoError(t, jsonErr)
		reader := makeInMemoryGzipTarFile(t, []testFile{
			{"plugin.json", string(manifestJSON)},
		})

		actualManifest, appError := th.App.ch.installPluginLocally(reader, installationStrategy)
		if actualManifest != nil {
			require.Equal(t, manifest, actualManifest)
		}

		return actualManifest, appError
	}

	t.Run("invalid plugin id", func(t *testing.T) {
		th := Setup(t)

		actualManifest, appErr := installPlugin(t, th, "invalid#plugin#id", "version", installPluginLocallyOnlyIfNew)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.invalid_id.app_error", appErr.Id, appErr.Error())
		require.Nil(t, actualManifest)
	})

	// The following tests fail mysteriously on CI due to an unexpected bundle being present.
	// This exists to clean up manually until we figure out what test isn't cleaning up after
	// itself.
	cleanExistingBundles := func(t *testing.T, th *TestHelper) {
		pluginsEnvironment := th.App.GetPluginsEnvironment()
		require.NotNil(t, pluginsEnvironment)
		bundleInfos, err := pluginsEnvironment.Available()
		require.NoError(t, err)

		for _, bundleInfo := range bundleInfos {
			err := th.App.ch.removePluginLocally(bundleInfo.Manifest.Id)
			require.Nilf(t, err, "failed to remove existing plugin %s", bundleInfo.Manifest.Id)
		}
	}

	assertBundleInfoManifests := func(t *testing.T, th *TestHelper, manifests []*model.Manifest) {
		pluginsEnvironment := th.App.GetPluginsEnvironment()
		require.NotNil(t, pluginsEnvironment)
		bundleInfos, err := pluginsEnvironment.Available()
		require.NoError(t, err)

		actualManifests := make([]*model.Manifest, 0, len(bundleInfos))
		for _, bundleInfo := range bundleInfos {
			actualManifests = append(actualManifests, bundleInfo.Manifest)
		}

		require.ElementsMatch(t, manifests, actualManifests)
	}

	t.Run("no plugins already installed", func(t *testing.T) {
		th := Setup(t)

		cleanExistingBundles(t, th)

		manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNew)
		require.Nil(t, appErr)
		require.NotNil(t, manifest)

		assertBundleInfoManifests(t, th, []*model.Manifest{manifest})
	})

	t.Run("different plugin already installed", func(t *testing.T) {
		th := Setup(t)

		cleanExistingBundles(t, th)

		otherManifest, appErr := installPlugin(t, th, "other", "0.0.1", installPluginLocallyOnlyIfNew)
		require.Nil(t, appErr)
		require.NotNil(t, otherManifest)

		manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNew)
		require.Nil(t, appErr)
		require.NotNil(t, manifest)

		assertBundleInfoManifests(t, th, []*model.Manifest{otherManifest, manifest})
	})

	t.Run("same plugin already installed", func(t *testing.T) {
		t.Run("install only if new", func(t *testing.T) {
			th := Setup(t)

			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNew)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNew)
			require.NotNil(t, appErr)
			require.Equal(t, "app.plugin.install_id.app_error", appErr.Id, appErr.Error())
			require.Nil(t, manifest)

			assertBundleInfoManifests(t, th, []*model.Manifest{existingManifest})
		})

		t.Run("install if upgrade, but older", func(t *testing.T) {
			th := Setup(t)

			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			_, appErr = installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNewOrUpgrade)
			require.NotNil(t, appErr)
			require.Equal(t, "app.plugin.skip_installation.app_error", appErr.Id)

			assertBundleInfoManifests(t, th, []*model.Manifest{existingManifest})
		})

		t.Run("install if upgrade, but same version", func(t *testing.T) {
			th := Setup(t)

			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			_, appErr = installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.NotNil(t, appErr)
			require.Equal(t, "app.plugin.skip_installation.app_error", appErr.Id)

			assertBundleInfoManifests(t, th, []*model.Manifest{existingManifest})
		})

		t.Run("install if upgrade, newer version", func(t *testing.T) {
			th := Setup(t)

			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			manifest, appErr := installPlugin(t, th, "valid", "0.0.3", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, manifest)

			assertBundleInfoManifests(t, th, []*model.Manifest{manifest})
		})

		t.Run("install always, old version", func(t *testing.T) {
			th := Setup(t)

			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyAlways)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyAlways)
			require.Nil(t, appErr)
			require.NotNil(t, manifest)

			assertBundleInfoManifests(t, th, []*model.Manifest{manifest})
		})
	})

	installPluginUpdateConfig := func(t *testing.T, th *TestHelper, id, version string, installationStrategy pluginInstallationStrategy) (*model.Manifest, map[string]any, *model.AppError) {
		t.Helper()
		var mp map[string]any

		manifest := &model.Manifest{
			Id:      id,
			Version: version,
		}
		manifestJSON, jsonErr := json.Marshal(manifest)
		require.NoError(t, jsonErr)
		reader := makeInMemoryGzipTarFile(t, []testFile{
			{"plugin.json", string(manifestJSON)},
		})

		actualManifest, appError := th.App.ch.installPluginLocally(reader, installationStrategy)
		if actualManifest != nil {
			mp = th.App.Config().PluginSettings.Plugins[actualManifest.Id]
		}
		return actualManifest, mp, appError
	}

	t.Run("Config updates because manifest ID does not exist in map", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
		cleanExistingBundles(t, th)
		expectedMap := make(map[string]any)
		expectedMap["id"] = "valid"
		expectedMap["version"] = "0.0.2"

		expectedManifest := &model.Manifest{
			Id:      "valid",
			Version: "0.0.2",
		}

		actualManifest, returnedMap, appErr := installPluginUpdateConfig(t, th, "valid", "0.0.2", installPluginLocallyAlways)
		require.Nil(t, appErr)
		require.Equal(t, expectedManifest, actualManifest)

		//will probably have to make a separte pluginSetting struct with dummy vals to check against return plugin settign vals
		for k, v := range returnedMap {
			require.Equal(t, expectedMap[k], v)
		}
	})

	t.Run("Config does not update because manifest ID already exist in map", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
		cleanExistingBundles(t, th)

		//create Plugin: `myplugin`
		setupPluginAPITest(t, ` 
		package main 
 
		import ( 
			"net/http" 
			"encoding/json" 
 
			"github.com/mattermost/mattermost/server/public/plugin" 
			"github.com/mattermost/mattermost/server/public/model" 
		) 
 
		type MyPlugin struct {
			plugin.MattermostPlugin
			enableUpload  bool
			hasRootAccess bool
			likesPie      bool
			version       string
			id            string
		} 
 
		func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) { 
			errReply := "some error" 
			 if r.URL.Query().Get("abc") == "xyz" { 
				errReply = "some other error" 
			} 
			response := &model.SubmitDialogResponse{ 
				Errors: map[string]string{"name1": errReply}, 
			} 
			w.WriteHeader(http.StatusOK) 
			responseJSON, _ := json.Marshal(response) 
			_, _ = w.Write(responseJSON) 
		} 
 
		func main() { 
			myPlug := &MyPlugin{
				enableUpload: true, 
				hasRootAccess: false, 
				likesPie: true, 
				version: "0.0.2", 
				id: "myplugin",
			}
			plugin.ClientMain(myPlug) 
		} 
		`, `{"id": "myplugin", "server": {"executable": "backend.exe"}}`, "myplugin", th.App, th.Context)

		expectedManifest, err2 := th.App.GetPluginsEnvironment().GetManifest("myplugin")
		require.NoError(t, err2)
		require.NotNil(t, expectedManifest)

		//try to reinstall `myplugin`
		//Since plugin is already installed there is no need to return a new/actual manifest or a map containing those values
		actualManifest, returnedMap, appErr := installPluginUpdateConfig(t, th, "myplugin", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
		require.NotNil(t, appErr)
		require.Nil(t, actualManifest)
		require.Empty(t, returnedMap)
	})
}

func TestInstallPluginAlreadyActive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	path, _ := fileutils.FindDir("tests")
	reader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)

	actualManifest, appError := th.App.InstallPlugin(reader, true)
	require.NotNil(t, actualManifest)
	require.Nil(t, appError)
	appError = th.App.EnablePlugin(actualManifest.Id)
	require.Nil(t, appError)

	pluginsEnvironment := th.App.GetPluginsEnvironment()
	require.NotNil(t, pluginsEnvironment)
	bundleInfos, err := pluginsEnvironment.Available()
	require.NoError(t, err)
	require.NotEmpty(t, bundleInfos)
	for _, bundleInfo := range bundleInfos {
		if bundleInfo.Manifest.Id == actualManifest.Id {
			err := os.RemoveAll(bundleInfo.Path)
			require.NoError(t, err)
		}
	}

	actualManifest, appError = th.App.InstallPlugin(reader, true)
	require.NotNil(t, appError)
	require.Nil(t, actualManifest)
	require.Equal(t, "app.plugin.restart.app_error", appError.Id)
}
