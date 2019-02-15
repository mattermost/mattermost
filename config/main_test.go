package config

import (
	"github.com/mattermost/mattermost-server/testlib"
	"io"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelper(false)
	defer mainHelper.Close()

	mainHelper.Main(m)
}

// MarshalConfig exposes the internal marshalConfig to tests only.
func MarshalConfig(cfg *model.Config) ([]byte, error) {
	return marshalConfig(cfg)
}

// UnmarshalConfig exposes the internal unmarshalConfig to tests only.
func UnmarshalConfig(r io.Reader, allowEnvironmentOverrides bool) (*model.Config, map[string]interface{}, error) {
	return unmarshalConfig(r, allowEnvironmentOverrides)
}
