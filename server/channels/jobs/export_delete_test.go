// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExportDelete(t *testing.T) {
	// Create a temporary export directory
	fileSettingsDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	relExportDir := "./export"
	exportDir := filepath.Join(fileSettingsDir, relExportDir)

	t.Cleanup(func() {
		err = os.RemoveAll(fileSettingsDir)
		assert.NoError(t, err)
	})

	retentionDays := 1

	updateConfig := func(cfg *model.Config) {
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = fileSettingsDir
		*cfg.ExportSettings.Directory = relExportDir
		*cfg.ExportSettings.RetentionDays = retentionDays
	}

	th := SetupWithUpdateCfg(t, updateConfig)

	// Create test files with different timestamps
	files := []string{
		"old_export.zip",
		"recent_export.zip",
		"normal.txt",
		"test_export.zip",
		"data.json",
	}

	// Create directories that should not be deleted
	dirs := []string{
		"data",
		"data/subfolder",
	}

	for _, dir := range dirs {
		err = os.MkdirAll(filepath.Join(exportDir, dir), 0755)
		require.NoError(t, err)
		// Add a file in each directory that should not be deleted
		err = os.WriteFile(filepath.Join(exportDir, dir, "file.txt"), []byte("test"), 0644)
		require.NoError(t, err)
	}

	for _, file := range files {
		err = os.WriteFile(filepath.Join(exportDir, file), []byte("test"), 0644)
		require.NoError(t, err)
	}

	// Set old timestamps for files that should be deleted
	oldTime := time.Now().Add(-(time.Duration(retentionDays) * 24 * time.Hour) - 1*time.Hour)
	err = os.Chtimes(filepath.Join(exportDir, "old_export.zip"), oldTime, oldTime)
	require.NoError(t, err)
	err = os.Chtimes(filepath.Join(exportDir, "test_export.zip"), oldTime, oldTime)
	require.NoError(t, err)

	// Start the workers
	th.SetupWorkers(t)

	// Run the export delete job
	th.RunJob(t, model.JobTypeExportDelete, nil)

	// Verify files that should still exist
	for _, name := range []string{
		"recent_export.zip",
		"normal.txt",
		"data.json",
		"data/file.txt",
		"data/subfolder/file.txt",
	} {
		_, err := os.Stat(filepath.Join(exportDir, name))
		require.NoError(t, err, "Expected file/directory to exist: %s", name)
	}

	// Verify files that should be deleted
	for _, name := range []string{
		"old_export.zip",
		"test_export.zip",
	} {
		_, err := os.Stat(filepath.Join(exportDir, name))
		require.True(t, os.IsNotExist(err), "Expected file to be deleted: %s", name)
	}
}
