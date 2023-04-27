// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func TestLoggingBeforeInitialized(t *testing.T) {
	require.NotPanics(t, func() {
		// None of these should segfault before mlog is globally configured
		mlog.Info("info log")
		mlog.Debug("debug log")
		mlog.Warn("warning log")
		mlog.Error("error log")
	})
}

func TestLoggingAfterInitialized(t *testing.T) {
	testCases := []struct {
		description  string
		cfg          mlog.TargetCfg
		expectedLogs []string
	}{
		{
			"file logging, json, debug",
			mlog.TargetCfg{
				Type:          "file",
				Format:        "json",
				FormatOptions: json.RawMessage(`{"enable_caller":true}`),
				Levels:        []mlog.Level{mlog.LvlError, mlog.LvlWarn, mlog.LvlInfo, mlog.LvlDebug},
			},
			[]string{
				`{"timestamp":0,"level":"debug","msg":"real debug log","caller":"mlog/global_test.go:0"}`,
				`{"timestamp":0,"level":"info","msg":"real info log","caller":"mlog/global_test.go:0"}`,
				`{"timestamp":0,"level":"warn","msg":"real warning log","caller":"mlog/global_test.go:0"}`,
				`{"timestamp":0,"level":"error","msg":"real error log","caller":"mlog/global_test.go:0"}`,
			},
		},
		{
			"file logging, json, error",
			mlog.TargetCfg{
				Type:          "file",
				Format:        "json",
				FormatOptions: json.RawMessage(`{"enable_caller":true}`),
				Levels:        []mlog.Level{mlog.LvlError},
			},
			[]string{
				`{"timestamp":0,"level":"error","msg":"real error log","caller":"mlog/global_test.go:0"}`,
			},
		},
		{
			"file logging, non-json, debug",
			mlog.TargetCfg{
				Type:          "file",
				Format:        "plain",
				FormatOptions: json.RawMessage(`{"delim":" | ", "enable_caller":true}`),
				Levels:        []mlog.Level{mlog.LvlError, mlog.LvlWarn, mlog.LvlInfo, mlog.LvlDebug},
			},
			[]string{
				`debug | TIME | real debug log | caller="mlog/global_test.go:0"`,
				`info | TIME | real info log | caller="mlog/global_test.go:0"`,
				`warn | TIME | real warning log | caller="mlog/global_test.go:0"`,
				`error | TIME | real error log | caller="mlog/global_test.go:0"`,
			},
		},
		{
			"file logging, non-json, error",
			mlog.TargetCfg{
				Type:          "file",
				Format:        "plain",
				FormatOptions: json.RawMessage(`{"delim":" | ", "enable_caller":true}`),
				Levels:        []mlog.Level{mlog.LvlError},
			},
			[]string{
				`error | TIME | real error log | caller="mlog/global_test.go:0"`,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			var filePath string
			if testCase.cfg.Type == "file" {
				tempDir, err := os.MkdirTemp(os.TempDir(), "TestLoggingAfterInitialized")
				require.NoError(t, err)
				defer os.Remove(tempDir)

				filePath = filepath.Join(tempDir, "file.log")
				testCase.cfg.Options = json.RawMessage(fmt.Sprintf(`{"filename": "%s"}`, filePath))
			}

			logger, _ := mlog.NewLogger()
			err := logger.ConfigureTargets(map[string]mlog.TargetCfg{testCase.description: testCase.cfg}, nil)
			require.NoError(t, err)

			mlog.InitGlobalLogger(logger)

			mlog.Debug("real debug log")
			mlog.Info("real info log")
			mlog.Warn("real warning log")
			mlog.Error("real error log")

			logger.Shutdown()

			if testCase.cfg.Type == "file" {
				logs, err := os.ReadFile(filePath)
				require.NoError(t, err)

				actual := strings.TrimSpace(string(logs))

				if testCase.cfg.Format == "json" {
					reTs := regexp.MustCompile(`"timestamp":"[0-9\.\-\+\:\sZ]+"`)
					reCaller := regexp.MustCompile(`"caller":"([^"]+):[0-9\.]+"`)
					actual = reTs.ReplaceAllString(actual, `"timestamp":0`)
					actual = reCaller.ReplaceAllString(actual, `"caller":"$1:0"`)
				} else {
					reTs := regexp.MustCompile(`\[\d\d\d\d-\d\d-\d\d\s[0-9\:\.\s\-\+Z]+\]`)
					reCaller := regexp.MustCompile(`caller="([^"]+):[0-9\.]+"`)
					actual = reTs.ReplaceAllString(actual, "TIME")
					actual = reCaller.ReplaceAllString(actual, `caller="$1:0"`)
				}
				require.ElementsMatch(t, testCase.expectedLogs, strings.Split(actual, "\n"))
			}
		})
	}
}
