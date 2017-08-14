package pluginenv

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/rpcplugin"
)

func TestDefaultSupervisorProvider(t *testing.T) {
	_, err := DefaultSupervisorProvider(&plugin.BundleInfo{})
	assert.Error(t, err)

	_, err = DefaultSupervisorProvider(&plugin.BundleInfo{
		Manifest: &plugin.Manifest{},
	})
	assert.Error(t, err)

	supervisor, err := DefaultSupervisorProvider(&plugin.BundleInfo{
		Manifest: &plugin.Manifest{
			Backend: &plugin.ManifestBackend{
				Executable: "foo",
			},
		},
	})
	require.NoError(t, err)
	_, ok := supervisor.(*rpcplugin.Supervisor)
	assert.True(t, ok)
}
