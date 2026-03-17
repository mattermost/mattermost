// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPluginID(t *testing.T) {
	t.Run("valid JSON with ID", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{"id": "com.example.my-plugin", "name": "My Plugin"}`)

		id, err := getPluginID(dir)
		require.NoError(t, err)
		assert.Equal(t, "com.example.my-plugin", id)
	})

	t.Run("extra fields are ignored", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{
			"id": "com.example.test",
			"name": "Test",
			"version": "1.0.0",
			"settings_schema": {}
		}`)

		id, err := getPluginID(dir)
		require.NoError(t, err)
		assert.Equal(t, "com.example.test", id)
	})

	t.Run("file does not exist", func(t *testing.T) {
		dir := t.TempDir()

		_, err := getPluginID(dir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "read plugin.json")
	})

	t.Run("invalid JSON", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{not valid json`)

		_, err := getPluginID(dir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse plugin.json")
	})

	t.Run("empty ID", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{"id": ""}`)

		_, err := getPluginID(dir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "plugin ID is empty")
	})

	t.Run("missing ID key", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{"name": "No ID Plugin"}`)

		_, err := getPluginID(dir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "plugin ID is empty")
	})
}

func TestFindRepoRoot(t *testing.T) {
	t.Run("plugin.json in current directory", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, dir, "plugin.json", `{"id": "test"}`)
		t.Chdir(dir)

		root, err := findRepoRoot()
		require.NoError(t, err)
		assert.Equal(t, dir, root)
	})

	t.Run("plugin.json in parent directory", func(t *testing.T) {
		parent := t.TempDir()
		writeFile(t, parent, "plugin.json", `{"id": "test"}`)
		child := filepath.Join(parent, "server")
		require.NoError(t, os.Mkdir(child, 0o750))
		t.Chdir(child)

		root, err := findRepoRoot()
		require.NoError(t, err)
		assert.Equal(t, parent, root)
	})

	t.Run("plugin.json in grandparent directory", func(t *testing.T) {
		grandparent := t.TempDir()
		writeFile(t, grandparent, "plugin.json", `{"id": "test"}`)
		parent := filepath.Join(grandparent, "server")
		require.NoError(t, os.Mkdir(parent, 0o750))
		child := filepath.Join(parent, "testhelper")
		require.NoError(t, os.Mkdir(child, 0o750))
		t.Chdir(child)

		root, err := findRepoRoot()
		require.NoError(t, err)
		assert.Equal(t, grandparent, root)
	})

	t.Run("plugin.json not found", func(t *testing.T) {
		dir := t.TempDir()
		t.Chdir(dir)

		_, err := findRepoRoot()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "could not find plugin.json")
	})
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600))
}
