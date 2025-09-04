// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestMloggerConfigFromAuditConfig(t *testing.T) {
	auditSettings := model.ExperimentalAuditSettings{
		FileEnabled:      model.NewPointer(true),
		FileName:         model.NewPointer("audit.log"),
		FileMaxSizeMB:    model.NewPointer(20),
		FileMaxAgeDays:   model.NewPointer(1),
		FileMaxBackups:   model.NewPointer(5),
		FileCompress:     model.NewPointer(true),
		FileMaxQueueSize: model.NewPointer(5000),
	}

	t.Run("validate default audit settings", func(t *testing.T) {
		cfg, err := MloggerConfigFromAuditConfig(auditSettings, nil)
		require.NoError(t, err, "audit config should not error")
		require.Len(t, cfg, 1, "default audit config should have one target")

		targetCfg := cfg["_defAudit"]

		// check general
		assert.Equal(t, targetCfg.Type, "file")
		assert.Equal(t, targetCfg.Format, "json")
		assert.ElementsMatch(t, targetCfg.Levels, []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI})

		// check format options
		optionsExpected := map[string]any{
			"disable_timestamp":  false,
			"disable_msg":        true,
			"disable_stacktrace": true,
			"disable_level":      true,
			"use_utc":            true,
		}
		var optionsReceived map[string]any
		err = json.Unmarshal(targetCfg.FormatOptions, &optionsReceived)
		require.NoError(t, err, "unmarshal should not fail")
		assert.Equal(t, optionsExpected, optionsReceived)
	})
}

func TestMakeJSONFormatOptions(t *testing.T) {
	opts := makeJSONFormatOptions()

	var optionsReceived map[string]any
	err := json.Unmarshal(opts, &optionsReceived)
	require.NoError(t, err, "unmarshal should not fail")

	optionsExpected := map[string]any{
		"enable_caller": true,
		"use_utc":       true,
	}

	assert.Equal(t, optionsExpected, optionsReceived)
}

func TestMakePlainFormatOptions(t *testing.T) {
	t.Run("with color enabled", func(t *testing.T) {
		opts := makePlainFormatOptions(true)

		var optionsReceived map[string]any
		err := json.Unmarshal(opts, &optionsReceived)
		require.NoError(t, err, "unmarshal should not fail")

		optionsExpected := map[string]any{
			"delim":         " ",
			"min_level_len": float64(5), // JSON unmarshals numbers as float64
			"min_msg_len":   float64(45),
			"enable_color":  true,
			"enable_caller": true,
			"use_utc":       true,
		}

		assert.Equal(t, optionsExpected, optionsReceived)
	})

	t.Run("with color disabled", func(t *testing.T) {
		opts := makePlainFormatOptions(false)

		var optionsReceived map[string]any
		err := json.Unmarshal(opts, &optionsReceived)
		require.NoError(t, err, "unmarshal should not fail")

		optionsExpected := map[string]any{
			"delim":         " ",
			"min_level_len": float64(5),
			"min_msg_len":   float64(45),
			"enable_color":  false,
			"enable_caller": true,
			"use_utc":       true,
		}

		assert.Equal(t, optionsExpected, optionsReceived)
	})
}

func TestMloggerConfigFromLoggerConfig(t *testing.T) {
	logSettings := &model.LogSettings{
		EnableConsole: model.NewPointer(true),
		ConsoleLevel:  model.NewPointer("INFO"),
		ConsoleJson:   model.NewPointer(true),
		EnableColor:   model.NewPointer(true),
		EnableFile:    model.NewPointer(true),
		FileLocation:  model.NewPointer("./logs/test.log"),
		FileLevel:     model.NewPointer("DEBUG"),
		FileJson:      model.NewPointer(false),
	}

	getFileFunc := func(path string) string {
		return path
	}

	t.Run("validate console and file targets have UTC enabled", func(t *testing.T) {
		cfg, err := MloggerConfigFromLoggerConfig(logSettings, nil, getFileFunc)
		require.NoError(t, err, "logger config should not error")
		require.Len(t, cfg, 2, "should have console and file targets")

		// Check console target
		consoleTarget := cfg["_defConsole"]
		assert.Equal(t, "console", consoleTarget.Type)
		assert.Equal(t, "json", consoleTarget.Format)

		var consoleOptions map[string]any
		err = json.Unmarshal(consoleTarget.FormatOptions, &consoleOptions)
		require.NoError(t, err, "unmarshal console options should not fail")
		assert.True(t, consoleOptions["use_utc"].(bool), "console target should have use_utc enabled")
		assert.Nil(t, consoleOptions["enable_color"], "JSON console target should never have color enabled")

		// Check file target
		fileTarget := cfg["_defFile"]
		assert.Equal(t, "file", fileTarget.Type)
		assert.Equal(t, "plain", fileTarget.Format)

		var fileOptions map[string]any
		err = json.Unmarshal(fileTarget.FormatOptions, &fileOptions)
		require.NoError(t, err, "unmarshal file options should not fail")
		assert.True(t, fileOptions["use_utc"].(bool), "file target should have use_utc enabled")
		assert.Nil(t, consoleOptions["enable_color"], "file target should never have color enabled")
	})
}

func TestLoggerOutputWithUTC(t *testing.T) {
	t.Run("JSON format outputs UTC timestamps", func(t *testing.T) {
		// Create temporary directory for test files
		tempDir := t.TempDir()
		logFile := filepath.Join(tempDir, "test.log")

		// Create a logger with JSON format and UTC enabled
		logger, err := mlog.NewLogger()
		require.NoError(t, err)

		// Configure with JSON format using our makeJSONFormatOptions function
		cfg := mlog.LoggerConfiguration{
			"test": mlog.TargetCfg{
				Type:          "file",
				Format:        "json",
				FormatOptions: makeJSONFormatOptions(),
				Levels:        []mlog.Level{mlog.LvlInfo},
				Options:       json.RawMessage(`{"filename": "` + logFile + `"}`),
			},
		}

		// Configure the logger
		err = logger.ConfigureTargets(cfg, nil)
		require.NoError(t, err)

		// Record time before logging
		beforeLog := time.Now()

		// Log a test message
		logger.Info("test message")

		// Record time after logging
		afterLog := time.Now()

		// Flush and shutdown to ensure the log is written
		err = logger.Shutdown()
		require.NoError(t, err)

		// Read the log file
		logBytes, err := os.ReadFile(logFile)
		require.NoError(t, err, "Should be able to read log file")

		// Parse the JSON log output
		var logEntry map[string]any
		err = json.Unmarshal(logBytes, &logEntry)
		require.NoError(t, err, "Should be able to parse JSON log output")

		// Extract timestamp
		timestampStr, ok := logEntry["timestamp"].(string)
		require.True(t, ok, "Timestamp should be a string")
		require.NotEmpty(t, timestampStr, "Timestamp should not be empty")

		// Parse the timestamp using UTC format (no timezone)
		loggedTime, err := time.Parse("2006-01-02 15:04:05.000", timestampStr)
		require.NoErrorf(t, err, "Could not parse timestamp %s: %v", timestampStr, err)

		// Verify timestamp format - should be exactly 23 characters without timezone
		assert.Len(t, timestampStr, 23, "UTC timestamp should be exactly 23 characters: 'YYYY-MM-DD HH:MM:SS.mmm'")
		assert.NotRegexp(t, `[+-]\d{2}:\d{2}$`, timestampStr, "UTC timestamp should not end with timezone offset")
		assert.False(t, strings.HasSuffix(timestampStr, "Z"), "UTC timestamp should not end with Z suffix")

		// Verify the logged time is within reasonable bounds (allowing 2 second buffer for test execution)
		beforeLogUTC := beforeLog.UTC()
		afterLogUTC := afterLog.UTC()
		assert.True(t,
			loggedTime.After(beforeLogUTC.Add(-2*time.Second)) && loggedTime.Before(afterLogUTC.Add(2*time.Second)),
			"Logged time %v should be between %v and %v", loggedTime, beforeLogUTC, afterLogUTC)
	})

	t.Run("Plain format outputs UTC timestamps", func(t *testing.T) {
		// Create temporary directory for test files
		tempDir := t.TempDir()
		logFile := filepath.Join(tempDir, "test.log")

		// Create a logger with plain format and UTC enabled
		logger, err := mlog.NewLogger()
		require.NoError(t, err)

		// Configure with plain format using our makePlainFormatOptions function
		cfg := mlog.LoggerConfiguration{
			"test": mlog.TargetCfg{
				Type:          "file",
				Format:        "plain",
				FormatOptions: makePlainFormatOptions(false),
				Levels:        []mlog.Level{mlog.LvlInfo},
				Options:       json.RawMessage(`{"filename": "` + logFile + `"}`),
			},
		}

		// Configure the logger
		err = logger.ConfigureTargets(cfg, nil)
		require.NoError(t, err)

		// Record time before logging
		beforeLog := time.Now()

		// Log a test message
		logger.Info("test message")

		// Record time after logging
		afterLog := time.Now()

		// Flush and shutdown to ensure the log is written
		err = logger.Shutdown()
		require.NoError(t, err)

		// Read the log file
		logBytes, err := os.ReadFile(logFile)
		require.NoError(t, err, "Should be able to read log file")

		logOutput := string(logBytes)
		require.NotEmpty(t, logOutput, "Log output should not be empty")

		// Extract timestamp from plain format log
		// Format: "info  [2025-09-04 09:34:53.675] test message caller=\"...\""

		// Use regex to extract the timestamp from within square brackets
		timestampRegex := `\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]`
		matches := regexp.MustCompile(timestampRegex).FindStringSubmatch(logOutput)
		require.Len(t, matches, 2, "Should find timestamp in brackets in log output: %q", logOutput)

		timestampStr := matches[1] // Extract the timestamp without brackets
		require.NotEmpty(t, timestampStr, "Timestamp should not be empty")

		// Parse the timestamp using UTC format (no timezone)
		loggedTime, err := time.Parse("2006-01-02 15:04:05.000", timestampStr)
		require.NoErrorf(t, err, "Could not parse timestamp %s: %v", timestampStr, err)

		// Verify timestamp format - should be exactly 23 characters without timezone
		assert.Len(t, timestampStr, 23, "UTC timestamp should be exactly 23 characters: 'YYYY-MM-DD HH:MM:SS.mmm'")
		assert.NotRegexp(t, `[+-]\d{2}:\d{2}$`, timestampStr, "UTC timestamp should not end with timezone offset")
		assert.False(t, strings.HasSuffix(timestampStr, "Z"), "UTC timestamp should not end with Z suffix")

		// Verify the logged time is within reasonable bounds
		beforeLogUTC := beforeLog.UTC()
		afterLogUTC := afterLog.UTC()
		assert.True(t,
			loggedTime.After(beforeLogUTC.Add(-2*time.Second)) && loggedTime.Before(afterLogUTC.Add(2*time.Second)),
			"Logged time %v should be between %v and %v", loggedTime, beforeLogUTC, afterLogUTC)
	})

	t.Run("Audit logger outputs UTC timestamps", func(t *testing.T) {
		// Create temporary directory for test files
		tempDir := t.TempDir()
		auditFile := filepath.Join(tempDir, "audit.log")

		// Test audit logger configuration using MloggerConfigFromAuditConfig
		auditSettings := model.ExperimentalAuditSettings{
			FileEnabled:      model.NewPointer(true),
			FileName:         model.NewPointer(auditFile),
			FileMaxSizeMB:    model.NewPointer(20),
			FileMaxAgeDays:   model.NewPointer(1),
			FileMaxBackups:   model.NewPointer(5),
			FileCompress:     model.NewPointer(true),
			FileMaxQueueSize: model.NewPointer(5000),
		}

		cfg, err := MloggerConfigFromAuditConfig(auditSettings, nil)
		require.NoError(t, err, "audit config should not error")
		require.Len(t, cfg, 1, "audit config should have one target")

		// Create a logger with the audit configuration
		logger, err := mlog.NewLogger()
		require.NoError(t, err)

		// Configure the logger
		err = logger.ConfigureTargets(cfg, nil)
		require.NoError(t, err)

		// Record time before logging
		beforeLog := time.Now()

		// Log an audit message (audit logs typically use structured logging)
		logger.Log(mlog.LvlAuditAPI, "", mlog.String("event", "test_audit_event"))

		// Record time after logging
		afterLog := time.Now()

		// Flush and shutdown to ensure the log is written
		err = logger.Shutdown()
		require.NoError(t, err)

		// Read the audit log file
		logBytes, err := os.ReadFile(auditFile)
		require.NoError(t, err, "Should be able to read audit log file")

		// Parse the JSON audit log output
		var logEntry map[string]any
		err = json.Unmarshal(logBytes, &logEntry)
		require.NoError(t, err, "Should be able to parse JSON audit log output")

		// Extract timestamp
		timestampStr, ok := logEntry["timestamp"].(string)
		require.True(t, ok, "Timestamp should be a string")
		require.NotEmpty(t, timestampStr, "Timestamp should not be empty")

		// Parse the timestamp using UTC format (no timezone)
		loggedTime, err := time.Parse("2006-01-02 15:04:05.000", timestampStr)
		require.NoErrorf(t, err, "Could not parse audit timestamp %s: %v", timestampStr, err)

		// Verify timestamp format - should be exactly 23 characters without timezone
		assert.Len(t, timestampStr, 23, "UTC audit timestamp should be exactly 23 characters: 'YYYY-MM-DD HH:MM:SS.mmm'")
		assert.NotRegexp(t, `[+-]\d{2}:\d{2}$`, timestampStr, "UTC audit timestamp should not end with timezone offset")
		assert.False(t, strings.HasSuffix(timestampStr, "Z"), "UTC audit timestamp should not end with Z suffix")

		// Verify the logged time is within reasonable bounds
		beforeLogUTC := beforeLog.UTC()
		afterLogUTC := afterLog.UTC()
		assert.True(t,
			loggedTime.After(beforeLogUTC.Add(-2*time.Second)) && loggedTime.Before(afterLogUTC.Add(2*time.Second)),
			"Logged audit time %v should be between %v and %v", loggedTime, beforeLogUTC, afterLogUTC)
	})
}
