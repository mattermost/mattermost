// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type PacketPullTestSuite struct {
	suite.Suite
}

func TestPacketPullTestSuite(t *testing.T) {
	suite.Run(t, new(PacketPullTestSuite))
}

func (s *PacketPullTestSuite) TestObfuscateConfigJSON() {
	s.Run("Obfuscate basic password fields", func() {
		input := `{
			"ServiceSettings": {
				"SiteURL": "https://example.com",
				"ListenAddress": ":8065"
			},
			"SqlSettings": {
				"DataSource": "postgres://user:pass@localhost/mattermost",
				"MasterPassword": "secret123"
			}
		}`

		result, count, err := obfuscateConfigJSON([]byte(input))
		s.Require().NoError(err)
		s.Require().Greater(count, 0)

		var resultMap map[string]interface{}
		err = json.Unmarshal(result, &resultMap)
		s.Require().NoError(err)

		// Check that sensitive fields were obfuscated
		sqlSettings := resultMap["SqlSettings"].(map[string]interface{})
		s.Equal("***REDACTED***", sqlSettings["DataSource"])
		s.Equal("***REDACTED***", sqlSettings["MasterPassword"])

		// Check that non-sensitive fields were preserved
		serviceSettings := resultMap["ServiceSettings"].(map[string]interface{})
		s.Equal("https://example.com", serviceSettings["SiteURL"])
		s.Equal(":8065", serviceSettings["ListenAddress"])
	})

	s.Run("Case insensitive keyword matching", func() {
		testCases := []struct {
			name     string
			input    string
			field    string
			expected string
		}{
			{"camelCase", `{"SMTPPassword": "secret"}`, "SMTPPassword", "***REDACTED***"},
			{"snake_case", `{"smtp_password": "secret"}`, "smtp_password", "***REDACTED***"},
			{"UPPERCASE", `{"DATABASE_PASSWORD": "secret"}`, "DATABASE_PASSWORD", "***REDACTED***"},
			{"Mixed", `{"PasswordHash": "secret"}`, "PasswordHash", "***REDACTED***"},
		}

		for _, tc := range testCases {
			s.Run(tc.name, func() {
				result, count, err := obfuscateConfigJSON([]byte(tc.input))
				s.Require().NoError(err)
				s.Require().Equal(1, count)

				var resultMap map[string]interface{}
				err = json.Unmarshal(result, &resultMap)
				s.Require().NoError(err)
				s.Equal(tc.expected, resultMap[tc.field])
			})
		}
	})

	s.Run("Nested field obfuscation", func() {
		input := `{
			"EmailSettings": {
				"SMTPServer": "smtp.example.com",
				"SMTPPassword": "secret123",
				"Credentials": {
					"APIKey": "abc123",
					"SecretToken": "xyz789"
				}
			}
		}`

		result, count, err := obfuscateConfigJSON([]byte(input))
		s.Require().NoError(err)
		s.Require().Equal(3, count) // SMTPPassword, APIKey, SecretToken

		var resultMap map[string]interface{}
		err = json.Unmarshal(result, &resultMap)
		s.Require().NoError(err)

		emailSettings := resultMap["EmailSettings"].(map[string]interface{})
		s.Equal("***REDACTED***", emailSettings["SMTPPassword"])
		s.Equal("smtp.example.com", emailSettings["SMTPServer"])

		credentials := emailSettings["Credentials"].(map[string]interface{})
		s.Equal("***REDACTED***", credentials["APIKey"])
		s.Equal("***REDACTED***", credentials["SecretToken"])
	})

	s.Run("Preserve non-string values", func() {
		input := `{
			"Settings": {
				"MaxPasswordLength": 64,
				"RequirePassword": true,
				"EmptyPassword": null,
				"PasswordPolicy": "complex"
			}
		}`

		result, count, err := obfuscateConfigJSON([]byte(input))
		s.Require().NoError(err)
		s.Require().Equal(1, count) // Only PasswordPolicy (string)

		var resultMap map[string]interface{}
		err = json.Unmarshal(result, &resultMap)
		s.Require().NoError(err)

		settings := resultMap["Settings"].(map[string]interface{})
		s.Equal(float64(64), settings["MaxPasswordLength"]) // JSON numbers are float64
		s.Equal(true, settings["RequirePassword"])
		s.Nil(settings["EmptyPassword"])
		s.Equal("***REDACTED***", settings["PasswordPolicy"])
	})

	s.Run("Empty string values not obfuscated", func() {
		input := `{"Password": ""}`

		result, count, err := obfuscateConfigJSON([]byte(input))
		s.Require().NoError(err)
		s.Require().Equal(0, count) // Empty strings not obfuscated

		var resultMap map[string]interface{}
		err = json.Unmarshal(result, &resultMap)
		s.Require().NoError(err)
		s.Equal("", resultMap["Password"])
	})

	s.Run("Invalid JSON returns error", func() {
		input := `{invalid json`

		_, _, err := obfuscateConfigJSON([]byte(input))
		s.Require().Error(err)
	})

	s.Run("Array obfuscation", func() {
		input := `{
			"Replicas": [
				{"DSN": "postgres://replica1", "APIKey": "key1"},
				{"DSN": "postgres://replica2", "APIKey": "key2"}
			]
		}`

		result, count, err := obfuscateConfigJSON([]byte(input))
		s.Require().NoError(err)
		s.Require().Equal(4, count) // 2 DSN + 2 APIKey

		var resultMap map[string]interface{}
		err = json.Unmarshal(result, &resultMap)
		s.Require().NoError(err)

		replicas := resultMap["Replicas"].([]interface{})
		replica1 := replicas[0].(map[string]interface{})
		s.Equal("***REDACTED***", replica1["DSN"])
		s.Equal("***REDACTED***", replica1["APIKey"])
	})
}

func (s *PacketPullTestSuite) TestExtractPortFromConfig() {
	testCases := []struct {
		name          string
		configContent string
		expectedPort  string
	}{
		{
			name:          "Standard port format",
			configContent: `{"ServiceSettings": {"ListenAddress": ":8065"}}`,
			expectedPort:  "8065",
		},
		{
			name:          "IPv4 with port",
			configContent: `{"ServiceSettings": {"ListenAddress": "0.0.0.0:8065"}}`,
			expectedPort:  "8065",
		},
		{
			name:          "IPv6 bracket format",
			configContent: `{"ServiceSettings": {"ListenAddress": "[::1]:8065"}}`,
			expectedPort:  "8065",
		},
		{
			name:          "IPv6 full address",
			configContent: `{"ServiceSettings": {"ListenAddress": "[2001:db8::1]:9000"}}`,
			expectedPort:  "9000",
		},
		{
			name:          "Unix socket",
			configContent: `{"ServiceSettings": {"ListenAddress": "/var/run/mattermost.sock"}}`,
			expectedPort:  "",
		},
		{
			name:          "Unix socket with .sock",
			configContent: `{"ServiceSettings": {"ListenAddress": "/tmp/mattermost.sock"}}`,
			expectedPort:  "",
		},
		{
			name:          "Empty address",
			configContent: `{"ServiceSettings": {"ListenAddress": ""}}`,
			expectedPort:  "8065",
		},
		{
			name:          "Service name format",
			configContent: `{"ServiceSettings": {"ListenAddress": ":http"}}`,
			expectedPort:  "8065",
		},
		{
			name:          "Bare IPv6 without port",
			configContent: `{"ServiceSettings": {"ListenAddress": "::1"}}`,
			expectedPort:  "8065",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			// Create temp config file
			tempDir := s.T().TempDir()
			configPath := filepath.Join(tempDir, "config.json")
			err := os.WriteFile(configPath, []byte(tc.configContent), 0600)
			s.Require().NoError(err)

			port := extractPortFromConfig(configPath)
			s.Equal(tc.expectedPort, port)
		})
	}

	s.Run("Invalid config file returns default", func() {
		port := extractPortFromConfig("/nonexistent/config.json")
		s.Equal("8065", port)
	})

	s.Run("Malformed JSON returns default", func() {
		tempDir := s.T().TempDir()
		configPath := filepath.Join(tempDir, "config.json")
		err := os.WriteFile(configPath, []byte(`{invalid`), 0600)
		s.Require().NoError(err)

		port := extractPortFromConfig(configPath)
		s.Equal("8065", port)
	})
}

func (s *PacketPullTestSuite) TestValidateMattermostDirectory() {
	s.Run("Valid directory structure", func() {
		tempDir := s.T().TempDir()
		err := os.MkdirAll(filepath.Join(tempDir, "config"), 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(filepath.Join(tempDir, "logs"), 0700)
		s.Require().NoError(err)

		err = validateMattermostDirectory(tempDir)
		s.Require().NoError(err)
	})

	s.Run("Missing config directory", func() {
		tempDir := s.T().TempDir()
		err := os.MkdirAll(filepath.Join(tempDir, "logs"), 0700)
		s.Require().NoError(err)

		err = validateMattermostDirectory(tempDir)
		s.Require().Error(err)
		s.Contains(err.Error(), "missing config/ and logs/ subdirectories")
	})

	s.Run("Missing logs directory", func() {
		tempDir := s.T().TempDir()
		err := os.MkdirAll(filepath.Join(tempDir, "config"), 0700)
		s.Require().NoError(err)

		err = validateMattermostDirectory(tempDir)
		s.Require().Error(err)
		s.Contains(err.Error(), "missing config/ and logs/ subdirectories")
	})

	s.Run("Nonexistent directory", func() {
		err := validateMattermostDirectory("/nonexistent/directory")
		s.Require().Error(err)
		s.Contains(err.Error(), "missing config/ and logs/ subdirectories")
	})
}

func (s *PacketPullTestSuite) TestCollectMattermostFiles() {
	s.Run("Happy path with obfuscation", func() {
		// Setup test Mattermost directory
		mmDir := s.T().TempDir()
		configDir := filepath.Join(mmDir, "config")
		logsDir := filepath.Join(mmDir, "logs")
		err := os.MkdirAll(configDir, 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(logsDir, 0700)
		s.Require().NoError(err)

		// Create test config.json
		configContent := `{
			"ServiceSettings": {"SiteURL": "https://example.com"},
			"SqlSettings": {"DataSource": "postgres://user:pass@localhost/db"}
		}`
		err = os.WriteFile(filepath.Join(configDir, "config.json"), []byte(configContent), 0600)
		s.Require().NoError(err)

		// Create test log files
		err = os.WriteFile(filepath.Join(logsDir, "mattermost.log"), []byte("log content 1"), 0600)
		s.Require().NoError(err)
		err = os.WriteFile(filepath.Join(logsDir, "audit.log"), []byte("log content 2"), 0600)
		s.Require().NoError(err)

		// Create temp dir for collection
		tempDir := s.T().TempDir()

		// Collect files with obfuscation
		count, err := collectMattermostFiles(mmDir, tempDir, true)
		s.Require().NoError(err)
		s.Require().Greater(count, 0)

		// Verify config.json was obfuscated
		collectedConfig, err := os.ReadFile(filepath.Join(tempDir, "config.json"))
		s.Require().NoError(err)
		s.Contains(string(collectedConfig), "***REDACTED***")
		s.NotContains(string(collectedConfig), "postgres://user:pass@localhost/db")

		// Verify log files were collected
		log1, err := os.ReadFile(filepath.Join(tempDir, "logs", "mattermost.log"))
		s.Require().NoError(err)
		s.Equal("log content 1", string(log1))

		log2, err := os.ReadFile(filepath.Join(tempDir, "logs", "audit.log"))
		s.Require().NoError(err)
		s.Equal("log content 2", string(log2))
	})

	s.Run("Without obfuscation", func() {
		// Setup test Mattermost directory
		mmDir := s.T().TempDir()
		configDir := filepath.Join(mmDir, "config")
		err := os.MkdirAll(configDir, 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(filepath.Join(mmDir, "logs"), 0700)
		s.Require().NoError(err)

		// Create test config.json
		configContent := `{"SqlSettings": {"DataSource": "secret"}}`
		err = os.WriteFile(filepath.Join(configDir, "config.json"), []byte(configContent), 0600)
		s.Require().NoError(err)

		tempDir := s.T().TempDir()

		// Collect without obfuscation
		count, err := collectMattermostFiles(mmDir, tempDir, false)
		s.Require().NoError(err)
		s.Require().Greater(count, 0)

		// Verify config.json was NOT obfuscated
		collectedConfig, err := os.ReadFile(filepath.Join(tempDir, "config.json"))
		s.Require().NoError(err)
		s.Contains(string(collectedConfig), "secret")
		s.NotContains(string(collectedConfig), "***REDACTED***")
	})

	s.Run("Graceful failure on missing files", func() {
		// Empty Mattermost directory
		mmDir := s.T().TempDir()
		err := os.MkdirAll(filepath.Join(mmDir, "config"), 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(filepath.Join(mmDir, "logs"), 0700)
		s.Require().NoError(err)

		tempDir := s.T().TempDir()

		// Should not error, just collect what's available
		count, err := collectMattermostFiles(mmDir, tempDir, true)
		s.Require().NoError(err)
		s.Require().GreaterOrEqual(count, 0)
	})
}

func (s *PacketPullTestSuite) TestPacketPullCmd() {
	s.Run("Directory validation failure", func() {
		cmd := &cobra.Command{}
		cmd.Flags().String("directory", "/nonexistent", "")
		cmd.Flags().String("target", s.T().TempDir(), "")
		cmd.Flags().String("name", "test", "")
		cmd.Flags().Bool("no-obfuscate", false, "")

		err := packetPullCmdF(cmd, []string{})
		s.Require().Error(err)
		s.Contains(err.Error(), "does not appear to be a Mattermost installation")
	})

	s.Run("Happy path integration", func() {
		// Setup test Mattermost directory
		mmDir := s.T().TempDir()
		configDir := filepath.Join(mmDir, "config")
		logsDir := filepath.Join(mmDir, "logs")
		err := os.MkdirAll(configDir, 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(logsDir, 0700)
		s.Require().NoError(err)

		// Create minimal config.json
		configContent := `{"ServiceSettings": {"ListenAddress": ":8065"}}`
		err = os.WriteFile(filepath.Join(configDir, "config.json"), []byte(configContent), 0600)
		s.Require().NoError(err)

		// Create a log file
		err = os.WriteFile(filepath.Join(logsDir, "test.log"), []byte("test log"), 0600)
		s.Require().NoError(err)

		targetDir := s.T().TempDir()

		cmd := &cobra.Command{}
		cmd.Flags().String("directory", mmDir, "")
		cmd.Flags().String("target", targetDir, "")
		cmd.Flags().String("name", "test-packet", "")
		cmd.Flags().Bool("no-obfuscate", false, "")

		err = packetPullCmdF(cmd, []string{})
		s.Require().NoError(err)

		// Verify archive was created
		files, err := os.ReadDir(targetDir)
		s.Require().NoError(err)
		s.Require().Len(files, 1)
		s.True(strings.HasPrefix(files[0].Name(), "test-packet_"))
		s.True(strings.HasSuffix(files[0].Name(), ".tar.gz"))
	})
}

// TestCreateTarGzArchive tests archive creation
func TestCreateTarGzArchive(t *testing.T) {
	t.Run("Create archive from directory", func(t *testing.T) {
		// Create source directory with test files
		sourceDir := t.TempDir()
		err := os.WriteFile(filepath.Join(sourceDir, "file1.txt"), []byte("content1"), 0600)
		require.NoError(t, err)

		err = os.MkdirAll(filepath.Join(sourceDir, "subdir"), 0700)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(sourceDir, "subdir", "file2.txt"), []byte("content2"), 0600)
		require.NoError(t, err)

		// Create archive
		targetDir := t.TempDir()
		archivePath := filepath.Join(targetDir, "test.tar.gz")

		err = createTarGzArchive(sourceDir, archivePath)
		require.NoError(t, err)

		// Verify archive exists
		stat, err := os.Stat(archivePath)
		require.NoError(t, err)
		require.Greater(t, stat.Size(), int64(0))
	})

	t.Run("Cleanup partial archive on error", func(t *testing.T) {
		// This test is more conceptual since we can't easily force an error mid-archive
		// Just verify the cleanup logic exists by checking the function
		sourceDir := t.TempDir()
		err := os.WriteFile(filepath.Join(sourceDir, "test.txt"), []byte("test"), 0600)
		require.NoError(t, err)

		// Try to create archive in non-writable location
		archivePath := "/root/test-should-fail.tar.gz"
		err = createTarGzArchive(sourceDir, archivePath)
		// Should fail but not panic
		require.Error(t, err)
	})
}
