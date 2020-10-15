// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type nilReadSeeker struct {
}

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

type byBundleInfoId []*model.BundleInfo

func (b byBundleInfoId) Len() int           { return len(b) }
func (b byBundleInfoId) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byBundleInfoId) Less(i, j int) bool { return b[i].Manifest.Id < b[j].Manifest.Id }

func TestInstallPluginLocally(t *testing.T) {
	t.Run("invalid tar", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		actualManifest, appErr := th.App.installPluginLocally(&nilReadSeeker{}, nil, installPluginLocallyOnlyIfNew)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.extract.app_error", appErr.Id, appErr.Error())
		require.Nil(t, actualManifest)
	})

	t.Run("missing manifest", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		reader := makeInMemoryGzipTarFile(t, []testFile{
			{"test", "test file"},
		})

		actualManifest, appErr := th.App.installPluginLocally(reader, nil, installPluginLocallyOnlyIfNew)
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
		reader := makeInMemoryGzipTarFile(t, []testFile{
			{"plugin.json", manifest.ToJson()},
		})

		actualManifest, appError := th.App.installPluginLocally(reader, nil, installationStrategy)
		if actualManifest != nil {
			require.Equal(t, manifest, actualManifest)
		}

		return actualManifest, appError
	}

	t.Run("invalid plugin id", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

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
		require.Nil(t, err)

		for _, bundleInfo := range bundleInfos {
			err := th.App.removePluginLocally(bundleInfo.Manifest.Id)
			require.Nilf(t, err, "failed to remove existing plugin %s", bundleInfo.Manifest.Id)
		}
	}

	assertBundleInfoManifests := func(t *testing.T, th *TestHelper, manifests []*model.Manifest) {
		pluginsEnvironment := th.App.GetPluginsEnvironment()
		require.NotNil(t, pluginsEnvironment)
		bundleInfos, err := pluginsEnvironment.Available()
		require.Nil(t, err)

		sort.Sort(byBundleInfoId(bundleInfos))

		actualManifests := make([]*model.Manifest, 0, len(bundleInfos))
		for _, bundleInfo := range bundleInfos {
			actualManifests = append(actualManifests, bundleInfo.Manifest)
		}

		require.Equal(t, manifests, actualManifests)
	}

	t.Run("no plugins already installed", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
		cleanExistingBundles(t, th)

		manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNew)
		require.Nil(t, appErr)
		require.NotNil(t, manifest)

		assertBundleInfoManifests(t, th, []*model.Manifest{manifest})
	})

	t.Run("different plugin already installed", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
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
			defer th.TearDown()
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
			defer th.TearDown()
			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			manifest, appErr := installPlugin(t, th, "valid", "0.0.1", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.Nil(t, manifest)

			assertBundleInfoManifests(t, th, []*model.Manifest{existingManifest})
		})

		t.Run("install if upgrade, but same version", func(t *testing.T) {
			th := Setup(t)
			defer th.TearDown()
			cleanExistingBundles(t, th)

			existingManifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.NotNil(t, existingManifest)

			manifest, appErr := installPlugin(t, th, "valid", "0.0.2", installPluginLocallyOnlyIfNewOrUpgrade)
			require.Nil(t, appErr)
			require.Nil(t, manifest)

			assertBundleInfoManifests(t, th, []*model.Manifest{existingManifest})
		})

		t.Run("install if upgrade, newer version", func(t *testing.T) {
			th := Setup(t)
			defer th.TearDown()
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
			defer th.TearDown()
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
}

func TestInstallPluginAlreadyActive(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

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
	require.Nil(t, err)
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

package main

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
	"golang.org/x/sync/errgroup"
)

func TestRunWithCCReader(t *testing.T) {
	defer goleak.VerifyNone(t)
	var in io.Reader = bytes.NewReader([]byte("TEST"))

	g := &errgroup.Group{}


	


	in, pipeIn1 := CC(in)
	sig, pipeSig1 := CC(sig)

	g.Go(func() error {
		return Match(pipeIn1, pipeSig1)
		// err := Consume(pipeIn1)
		// fmt.Printf("test 1: %v\n", err)
		// if err != nil {
		// 	return err
		// }
		// err = Consume(pipeSig1)
		// fmt.Printf("test 2: %v\n", err)
		// if err != nil {
		// 	return err
		// }
		// return nil
	})

	err := Consume(in)
	require.NoError(t, err)
	pipeIn1.Close()

	err = Consume(sig)
	require.NoError(t, err)
	pipeSig1.Close()

	err = g.Wait()
	require.NoError(t, err)
}

// func TestMain(t *testing.T) {
// 	var in io.Reader = bytes.NewReader([]byte("TEST"))
// 	var sig io.Reader = bytes.NewReader([]byte("NON-TEST"))

// 	g := &errgroup.Group{}
// 	in, sig, cleanup := CC2(in, sig, g, Match)

// 	err := Consume(in)
// 	require.NoError(t, err)

// 	err = Consume(sig)
// 	require.NoError(t, err)

// 	cleanup()

// 	g.Wait()
// }

func Match(in, sig io.Reader) error {
	data, err := ioutil.ReadAll(in)
	fmt.Printf("Match 1: %v\n", err)
	if err != nil {
		return err
	}

	sigData, err := ioutil.ReadAll(sig)
	fmt.Printf("Match 2: %v\n", err)
	if err != nil {
		return err
	}

	fmt.Printf("Match 3: %q %q\n", string(data), string(sigData))
	if string(data) != string(sigData) {
		return errors.New("no match")
	}
	return nil
}

func Consume(in io.Reader) error {
	bb, err := ioutil.ReadAll(in)
	if err != nil {
		return err
	}
	fmt.Printf("Consume 1: %q\n", string(bb))
	return nil
}

func ConsumeAndFail(in io.Reader) error {
	bb, err := ioutil.ReadAll(in)
	if err != nil {
		return err
	}
	return errors.Errorf("failed after consuming %v bytes", len(bb))
}

func ConsumeOneAndFail(in io.Reader) error {
	data := make([]byte, 1)
	_, err := in.Read(data)
	if err != nil {
		return err
	}
	return errors.New("failed after 1 byte")
}
