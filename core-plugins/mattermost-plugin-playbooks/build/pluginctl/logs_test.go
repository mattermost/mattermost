// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"testing"
	"time"
)

func TestCheckOldestEntry(t *testing.T) {
	for name, tc := range map[string]struct {
		logs           []string
		oldest         string
		expectedLogs   []string
		expectedOldest string
		expectedAllNew bool
	}{
		"nil logs": {
			logs:           nil,
			oldest:         "oldest",
			expectedLogs:   nil,
			expectedOldest: "oldest",
			expectedAllNew: false,
		},
		"empty logs": {
			logs:           []string{},
			oldest:         "oldest",
			expectedLogs:   nil,
			expectedOldest: "oldest",
			expectedAllNew: false,
		},
		"no new entries, one old entry": {
			logs:           []string{"old"},
			oldest:         "old",
			expectedLogs:   []string{},
			expectedOldest: "old",
			expectedAllNew: false,
		},
		"no new entries, multipile old entries": {
			logs:           []string{"old1", "old2", "old3"},
			oldest:         "old3",
			expectedLogs:   []string{},
			expectedOldest: "old3",
			expectedAllNew: false,
		},
		"one new entry, no old entry": {
			logs:           []string{"new"},
			oldest:         "old",
			expectedLogs:   []string{"new"},
			expectedOldest: "new",
			expectedAllNew: true,
		},
		"multipile new entries, no old entry": {
			logs:           []string{"new1", "new2", "new3"},
			oldest:         "old",
			expectedLogs:   []string{"new1", "new2", "new3"},
			expectedOldest: "new3",
			expectedAllNew: true,
		},
		"one new entry, one old entry": {
			logs:           []string{"old", "new"},
			oldest:         "old",
			expectedLogs:   []string{"new"},
			expectedOldest: "new",
			expectedAllNew: false,
		},
		"one new entry, multipile old entries": {
			logs:           []string{"old1", "old2", "old3", "new"},
			oldest:         "old3",
			expectedLogs:   []string{"new"},
			expectedOldest: "new",
			expectedAllNew: false,
		},
		"multipile new entries, ultipile old entries": {
			logs:           []string{"old1", "old2", "old3", "new1", "new2", "new3"},
			oldest:         "old3",
			expectedLogs:   []string{"new1", "new2", "new3"},
			expectedOldest: "new3",
			expectedAllNew: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			logs, oldest, allNew := checkOldestEntry(tc.logs, tc.oldest)

			if allNew != tc.expectedAllNew {
				t.Logf("expected allNew: %v, got %v", tc.expectedAllNew, allNew)
				t.Fail()
			}
			if oldest != tc.expectedOldest {
				t.Logf("expected oldest: %v, got %v", tc.expectedOldest, oldest)
				t.Fail()
			}

			compareSlice(t, tc.expectedLogs, logs)
		})
	}
}

func TestFilterLogEntries(t *testing.T) {
	now := time.Now()

	for name, tc := range map[string]struct {
		logs         []string
		pluginID     string
		since        time.Time
		expectedLogs []string
		expectedErr  bool
	}{
		"nil slice": {
			logs:         nil,
			expectedLogs: nil,
			expectedErr:  false,
		},
		"empty slice": {
			logs:         []string{},
			expectedLogs: nil,
			expectedErr:  false,
		},
		"no JSON": {
			logs: []string{
				`{"foo"`,
			},
			expectedLogs: nil,
			expectedErr:  true,
		},
		"unknown time format": {
			logs: []string{
				`{"message":"foo", "plugin_id": "some.plugin.id", "timestamp": "2023-12-18 10:58:53"}`,
			},
			pluginID:     "some.plugin.id",
			expectedLogs: nil,
			expectedErr:  true,
		},
		"one matching entry": {
			logs: []string{
				`{"message":"foo", "plugin_id": "some.plugin.id", "timestamp": "2023-12-18 10:58:53.091 +01:00"}`,
			},
			pluginID: "some.plugin.id",
			expectedLogs: []string{
				`{"message":"foo", "plugin_id": "some.plugin.id", "timestamp": "2023-12-18 10:58:53.091 +01:00"}`,
			},
			expectedErr: false,
		},
		"filter out non plugin entries": {
			logs: []string{
				`{"message":"bar1", "timestamp": "2023-12-18 10:58:52.091 +01:00"}`,
				`{"message":"foo", "plugin_id": "some.plugin.id", "timestamp": "2023-12-18 10:58:53.091 +01:00"}`,
				`{"message":"bar2", "timestamp": "2023-12-18 10:58:54.091 +01:00"}`,
			},
			pluginID: "some.plugin.id",
			expectedLogs: []string{
				`{"message":"foo", "plugin_id": "some.plugin.id", "timestamp": "2023-12-18 10:58:53.091 +01:00"}`,
			},
			expectedErr: false,
		},
		"filter out old entries": {
			logs: []string{
				fmt.Sprintf(`{"message":"old2", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(-2*time.Second).Format(timeStampFormat)),
				fmt.Sprintf(`{"message":"old1", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(-1*time.Second).Format(timeStampFormat)),
				fmt.Sprintf(`{"message":"now", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Format(timeStampFormat)),
				fmt.Sprintf(`{"message":"new1", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(1*time.Second).Format(timeStampFormat)),
				fmt.Sprintf(`{"message":"new2", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(2*time.Second).Format(timeStampFormat)),
			},
			pluginID: "some.plugin.id",
			since:    now,
			expectedLogs: []string{
				fmt.Sprintf(`{"message":"new1", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(1*time.Second).Format(timeStampFormat)),
				fmt.Sprintf(`{"message":"new2", "plugin_id": "some.plugin.id", "timestamp": "%s"}`, now.Add(2*time.Second).Format(timeStampFormat)),
			},
			expectedErr: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			logs, err := filterLogEntries(tc.logs, tc.pluginID, tc.since)
			if tc.expectedErr {
				if err == nil {
					t.Logf("expected error, got nil")
					t.Fail()
				}
			} else {
				if err != nil {
					t.Logf("expected no error, got %v", err)
					t.Fail()
				}
			}
			compareSlice(t, tc.expectedLogs, logs)
		})
	}
}

func compareSlice[S ~[]E, E comparable](t *testing.T, expected, got S) {
	if len(expected) != len(got) {
		t.Logf("expected len: %v, got %v", len(expected), len(got))
		t.FailNow()
	}

	for i := 0; i < len(expected); i++ {
		if expected[i] != got[i] {
			t.Logf("expected [%d]: %v, got %v", i, expected[i], got[i])
			t.Fail()
		}
	}
}
