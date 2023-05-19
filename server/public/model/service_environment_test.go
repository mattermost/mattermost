package model_test

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/stretchr/testify/require"
)

const (
	ServiceEnvironmentEnterprise = ""
	ServiceEnvironmentCloud      = "cloud"
	ServiceEnvironmentTest       = "test"
)

// TestGetServiceEnvironment verifies the semantics of the MM_SERVICEENVIRONMENT environment
// variable when explicitly configured as well as when left undefined or empty.
//
// To guard against accidental use of production keys (especially telemetry), all development and
// testing defaults to the dev service environment, making it impossible to test the production
// semantics at the unit test level. Validating the default, enterprise service environment is left
// to smoketests before releasing.
func TestGetServiceEnvironment(t *testing.T) {
	t.Run("no env defaults to dev (without production tag)", func(t *testing.T) {
		require.Equal(t, model.ServiceEnvironmentDev, model.GetServiceEnvironment())
	})
	t.Run("empty string defaults to dev (without production tag)", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentDev, model.GetServiceEnvironment())
	})
	t.Run("enterprise", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "enterprise")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentEnterprise, model.GetServiceEnvironment())
	})
	t.Run("cloud", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "cloud")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentCloud, model.GetServiceEnvironment())
	})
	t.Run("test", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "test")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentTest, model.GetServiceEnvironment())
	})
	t.Run("dev", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "dev")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentDev, model.GetServiceEnvironment())
	})
	t.Run("whitespace and case insensitive", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "   Cloud  ")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentCloud, model.GetServiceEnvironment())
	})
}
