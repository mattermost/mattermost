package model_test

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/stretchr/testify/require"
)

const (
	ServiceEnvironmentDefault = ""
	ServiceEnvironmentCloud   = "cloud"
	ServiceEnvironmentTest    = "test"
)

func TestGetServiceEnvironment(t *testing.T) {
	t.Run("no env", func(t *testing.T) {
		require.Equal(t, model.ServiceEnvironmentDefault, model.GetServiceEnvironment())
	})
	t.Run("empty string", func(t *testing.T) {
		os.Setenv("MM_SERVICEENVIRONMENT", "")
		defer os.Unsetenv("MM_SERVICEENVIRONMENT")
		require.Equal(t, model.ServiceEnvironmentDefault, model.GetServiceEnvironment())
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
