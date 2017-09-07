package pluginenv

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

func TestDefaultSupervisorProvider(t *testing.T) {
	_, err := DefaultSupervisorProvider(&model.BundleInfo{})
	assert.Error(t, err)

	_, err = DefaultSupervisorProvider(&model.BundleInfo{
		Manifest: &model.Manifest{},
	})
	assert.Error(t, err)

	supervisor, err := DefaultSupervisorProvider(&model.BundleInfo{
		Manifest: &model.Manifest{
			Backend: &model.ManifestBackend{
				Executable: "foo",
			},
		},
	})
	require.NoError(t, err)
	_, ok := supervisor.(*rpcplugin.Supervisor)
	assert.True(t, ok)
}
