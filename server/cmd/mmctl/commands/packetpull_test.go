// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

type PacketPullTestSuite struct {
	suite.Suite
}

func TestPacketPullTestSuite(t *testing.T) {
	suite.Run(t, new(PacketPullTestSuite))
}

func (s *PacketPullTestSuite) TestSanitizeConfigJSON() {
	s.Run("Sanitizes known sensitive fields", func() {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.SqlSettings.DataSource = model.NewPointer("postgres://user:pass@localhost/mattermost")
		cfg.EmailSettings.SMTPPassword = model.NewPointer("secret123")
		cfg.FileSettings.AmazonS3SecretAccessKey = model.NewPointer("s3secret")
		cfg.ServiceSettings.SiteURL = model.NewPointer("https://example.com")

		input, err := json.Marshal(cfg)
		s.Require().NoError(err)

		result, err := sanitizeConfigJSON(input)
		s.Require().NoError(err)

		var sanitized model.Config
		err = json.Unmarshal(result, &sanitized)
		s.Require().NoError(err)

		// Sensitive fields should be sanitized
		s.NotEqual("postgres://user:pass@localhost/mattermost", *sanitized.SqlSettings.DataSource)
		s.Equal(model.FakeSetting, *sanitized.EmailSettings.SMTPPassword)
		s.Equal(model.FakeSetting, *sanitized.FileSettings.AmazonS3SecretAccessKey)

		// Non-sensitive fields preserved
		s.Equal("https://example.com", *sanitized.ServiceSettings.SiteURL)
	})

	s.Run("Partially redacts data sources", func() {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.SqlSettings.DriverName = model.NewPointer("postgres")
		cfg.SqlSettings.DataSource = model.NewPointer("postgres://user:pass@dbhost:5432/mattermost")

		input, err := json.Marshal(cfg)
		s.Require().NoError(err)

		result, err := sanitizeConfigJSON(input)
		s.Require().NoError(err)

		var sanitized model.Config
		err = json.Unmarshal(result, &sanitized)
		s.Require().NoError(err)

		// Data source should be partially redacted (host preserved, creds replaced)
		ds := *sanitized.SqlSettings.DataSource
		s.Contains(ds, "dbhost")
		s.NotContains(ds, "pass")
	})

	s.Run("Invalid JSON returns error", func() {
		_, err := sanitizeConfigJSON([]byte(`{invalid json`))
		s.Require().Error(err)
	})

	s.Run("Empty config still works", func() {
		cfg := &model.Config{}
		cfg.SetDefaults()

		input, err := json.Marshal(cfg)
		s.Require().NoError(err)

		result, err := sanitizeConfigJSON(input)
		s.Require().NoError(err)
		s.NotEmpty(result)
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
	s.Run("Happy path with sanitization", func() {
		printer.Clean()
		// Setup test Mattermost directory
		mmDir := s.T().TempDir()
		configDir := filepath.Join(mmDir, "config")
		logsDir := filepath.Join(mmDir, "logs")
		err := os.MkdirAll(configDir, 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(logsDir, 0700)
		s.Require().NoError(err)

		// Create a real model.Config so sanitization works
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.SqlSettings.DataSource = model.NewPointer("postgres://user:pass@localhost/db")
		configContent, err := json.Marshal(cfg)
		s.Require().NoError(err)
		err = os.WriteFile(filepath.Join(configDir, "config.json"), configContent, 0600)
		s.Require().NoError(err)

		// Create test log files
		err = os.WriteFile(filepath.Join(logsDir, "mattermost.log"), []byte("log content 1"), 0600)
		s.Require().NoError(err)
		err = os.WriteFile(filepath.Join(logsDir, "audit.log"), []byte("log content 2"), 0600)
		s.Require().NoError(err)

		// Create temp dir for collection
		tempDir := s.T().TempDir()

		// Collect files with sanitization
		count, err := collectMattermostFiles(mmDir, tempDir, true)
		s.Require().NoError(err)
		s.Require().Greater(count, 0)

		// Verify config.json was sanitized
		collectedConfig, err := os.ReadFile(filepath.Join(tempDir, "config.json"))
		s.Require().NoError(err)
		s.NotContains(string(collectedConfig), "postgres://user:pass@localhost/db")

		// Verify log files were collected
		log1, err := os.ReadFile(filepath.Join(tempDir, "logs", "mattermost.log"))
		s.Require().NoError(err)
		s.Equal("log content 1", string(log1))

		log2, err := os.ReadFile(filepath.Join(tempDir, "logs", "audit.log"))
		s.Require().NoError(err)
		s.Equal("log content 2", string(log2))
	})

	s.Run("Without sanitization", func() {
		printer.Clean()
		// Setup test Mattermost directory
		mmDir := s.T().TempDir()
		configDir := filepath.Join(mmDir, "config")
		err := os.MkdirAll(configDir, 0700)
		s.Require().NoError(err)
		err = os.MkdirAll(filepath.Join(mmDir, "logs"), 0700)
		s.Require().NoError(err)

		// Create test config.json with a known sensitive value
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.SqlSettings.DataSource = model.NewPointer("postgres://user:secret@localhost/db")
		configContent, err := json.Marshal(cfg)
		s.Require().NoError(err)
		err = os.WriteFile(filepath.Join(configDir, "config.json"), configContent, 0600)
		s.Require().NoError(err)

		tempDir := s.T().TempDir()

		// Collect without sanitization
		count, err := collectMattermostFiles(mmDir, tempDir, false)
		s.Require().NoError(err)
		s.Require().Greater(count, 0)

		// Verify config.json was NOT sanitized
		collectedConfig, err := os.ReadFile(filepath.Join(tempDir, "config.json"))
		s.Require().NoError(err)
		s.Contains(string(collectedConfig), "secret")
	})

	s.Run("Graceful failure on missing files", func() {
		printer.Clean()
		defer printer.Clean()
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
		sourceDir := t.TempDir()
		err := os.WriteFile(filepath.Join(sourceDir, "test.txt"), []byte("test"), 0600)
		require.NoError(t, err)

		// Create a read-only directory so file creation fails regardless of user
		readOnlyDir := t.TempDir()
		require.NoError(t, os.Chmod(readOnlyDir, 0555))
		t.Cleanup(func() { os.Chmod(readOnlyDir, 0755) })

		archivePath := filepath.Join(readOnlyDir, "test-should-fail.tar.gz")
		err = createTarGzArchive(sourceDir, archivePath)
		require.Error(t, err)
	})
}
