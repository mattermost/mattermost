package model_test

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/stretchr/testify/require"
)

const (
	ExternalServiceEnvironmentDefault = ""
	ExternalServiceEnvironmentCloud   = "cloud"
	ExternalServiceEnvironmentTest    = "test"
)

func TestGetExternalServiceEnvironment(t *testing.T) {
	t.Run("no env", func(t *testing.T) {
		require.Equal(t, model.ExternalServiceEnvironmentDefault, model.GetExternalServiceEnvironment())
	})
	t.Run("empty string", func(t *testing.T) {
		os.Setenv("MM_EXTERNALSERVICEENVIRONMENT", "")
		defer os.Unsetenv("MM_EXTERNALSERVICEENVIRONMENT")
		require.Equal(t, model.ExternalServiceEnvironmentDefault, model.GetExternalServiceEnvironment())
	})
	t.Run("cloud", func(t *testing.T) {
		os.Setenv("MM_EXTERNALSERVICEENVIRONMENT", "cloud")
		defer os.Unsetenv("MM_EXTERNALSERVICEENVIRONMENT")
		require.Equal(t, model.ExternalServiceEnvironmentCloud, model.GetExternalServiceEnvironment())
	})
	t.Run("test", func(t *testing.T) {
		os.Setenv("MM_EXTERNALSERVICEENVIRONMENT", "test")
		defer os.Unsetenv("MM_EXTERNALSERVICEENVIRONMENT")
		require.Equal(t, model.ExternalServiceEnvironmentTest, model.GetExternalServiceEnvironment())
	})
	t.Run("dev", func(t *testing.T) {
		os.Setenv("MM_EXTERNALSERVICEENVIRONMENT", "dev")
		defer os.Unsetenv("MM_EXTERNALSERVICEENVIRONMENT")
		require.Equal(t, model.ExternalServiceEnvironmentDev, model.GetExternalServiceEnvironment())
	})
	t.Run("whitespace and case insensitive", func(t *testing.T) {
		os.Setenv("MM_EXTERNALSERVICEENVIRONMENT", "   Cloud  ")
		defer os.Unsetenv("MM_EXTERNALSERVICEENVIRONMENT")
		require.Equal(t, model.ExternalServiceEnvironmentCloud, model.GetExternalServiceEnvironment())
	})
}
