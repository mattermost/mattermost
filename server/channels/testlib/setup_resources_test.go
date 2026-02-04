package testlib

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupTestResources(t *testing.T) {
	dir, err := SetupTestResources()
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	assert.DirExists(t, dir)
	assert.FileExists(t, filepath.Join(dir, "config", "config.json"))
	assert.DirExists(t, filepath.Join(dir, "mattermost-server"))
	assert.FileExists(t, filepath.Join(dir, "mattermost-server", "go.mod"))
	
	// Check some other resources that should be there
	assert.DirExists(t, filepath.Join(dir, "i18n"))
	assert.FileExists(t, filepath.Join(dir, "go.mod"))
}
