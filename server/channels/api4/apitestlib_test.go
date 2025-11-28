// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
)

func TestEnvironmentVariableHandling(t *testing.T) {
	// TestEnvironmentVariableHandling should NEVER be run with t.Parallel()

	originalConsoleLevel := os.Getenv("MM_LOGSETTINGS_CONSOLELEVEL")
	defer func() {
		// Restore original environment variables
		if originalConsoleLevel != "" {
			os.Setenv("MM_LOGSETTINGS_CONSOLELEVEL", originalConsoleLevel)
		} else {
			os.Unsetenv("MM_LOGSETTINGS_CONSOLELEVEL")
		}
	}()

	t.Run("MM_LOGSETTINGS_CONSOLELEVEL should be respected when set", func(t *testing.T) {
		// never run with t.Parallel()

		// Set the console level environment variable
		os.Setenv("MM_LOGSETTINGS_CONSOLELEVEL", "ERROR")
		defer os.Unsetenv("MM_LOGSETTINGS_CONSOLELEVEL")

		th := SetupEnterprise(t)

		// Verify the console level was set from the environment variable
		config := th.App.Config()
		assert.Equal(t, "ERROR", *config.LogSettings.ConsoleLevel)
	})

	t.Run("Only MM_LOGSETTINGS_CONSOLELEVEL is manually processed", func(t *testing.T) {
		// never run with t.Parallel()

		// This test verifies that we haven't accidentally enabled general environment
		// variable processing - we only manually handle MM_LOGSETTINGS_CONSOLELEVEL

		// First, test without MM_LOGSETTINGS_CONSOLELEVEL set
		os.Unsetenv("MM_LOGSETTINGS_CONSOLELEVEL")

		th1 := SetupEnterprise(t)
		config1 := th1.App.Config()
		defaultConsoleLevel := *config1.LogSettings.ConsoleLevel

		// Now test with MM_LOGSETTINGS_CONSOLELEVEL set
		os.Setenv("MM_LOGSETTINGS_CONSOLELEVEL", "DEBUG")
		defer os.Unsetenv("MM_LOGSETTINGS_CONSOLELEVEL")

		th2 := SetupEnterprise(t)
		config2 := th2.App.Config()
		customConsoleLevel := *config2.LogSettings.ConsoleLevel

		// Verify our manual implementation works
		assert.Equal(t, mlog.LvlStdLog.Name, defaultConsoleLevel, "Default should be stdlog")
		assert.Equal(t, "DEBUG", customConsoleLevel, "Environment variable should be respected")
		assert.NotEqual(t, defaultConsoleLevel, customConsoleLevel, "Values should be different")
	})
}
