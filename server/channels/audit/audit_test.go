// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestAudit_LogAuditRecord(t *testing.T) {
	userId := model.NewId()
	testCases := []struct {
		description  string
		auditLogFunc func(audit Audit)
		expectedLogs []string
	}{
		{
			"empty record",
			func(audit Audit) {
				rec := model.AuditRecord{}
				audit.LogRecord(mlog.LvlAuditAPI, rec)
			},
			[]string{
				`{"timestamp":0,"level":"audit-api","msg":"","event_name":"","status":"","actor":{"user_id":"","session_id":"","client":"","ip_address":"","x_forwarded_for":""},"event":{"parameters":null,"prior_state":null,"resulting_state":null,"object_type":""},"meta":null,"error":{}}`,
			},
		},
		{
			"update user record, no error",
			func(audit Audit) {
				usr := &model.User{}
				usr.Id = userId
				usr.Username = "TestABC"
				usr.Password = "hello_world"

				rec := model.AuditRecord{}
				rec.AddEventObjectType("user")
				rec.EventName = "User.Update"
				rec.AddEventPriorState(usr)

				usr.Username = "TestDEF"
				rec.AddEventResultState(usr)
				rec.Success()

				audit.LogRecord(mlog.LvlAuditAPI, rec)
			},
			[]string{
				strings.Replace(`{"timestamp":0,"level":"audit-api","msg":"","event_name":"User.Update","status":"success","actor":{"user_id":"","session_id":"","client":"","ip_address":"","x_forwarded_for":""},"event":{"parameters":null,"prior_state":{"allow_marketing":false,"auth_service":"","bot_description":"","bot_last_icon_update":0,"create_at":0,"delete_at":0,"disable_welcome_email":false,"email":"","email_verified":false,"failed_attempts":0,"id":"_____USERID_____","is_bot":false,"last_activity_at":0,"last_password_update":0,"last_picture_update":0,"locale":"","mfa_active":false,"notify_props":null,"position":"","props":null,"remote_id":"","roles":"","terms_of_service_create_at":0,"terms_of_service_id":"","timezone":null,"update_at":0,"username":"TestABC"},"resulting_state":{"allow_marketing":false,"auth_service":"","bot_description":"","bot_last_icon_update":0,"create_at":0,"delete_at":0,"disable_welcome_email":false,"email":"","email_verified":false,"failed_attempts":0,"id":"_____USERID_____","is_bot":false,"last_activity_at":0,"last_password_update":0,"last_picture_update":0,"locale":"","mfa_active":false,"notify_props":null,"position":"","props":null,"remote_id":"","roles":"","terms_of_service_create_at":0,"terms_of_service_id":"","timezone":null,"update_at":0,"username":"TestDEF"},"object_type":"user"},"meta":null,"error":{}}`, "_____USERID_____", userId, -1),
			},
		},
	}

	cfg := mlog.TargetCfg{
		Type:          "file",
		Format:        "json",
		FormatOptions: nil,
		Levels:        []mlog.Level{mlog.LvlAuditCLI, mlog.LvlAuditAPI, mlog.LvlAuditPerms, mlog.LvlAuditContent},
	}

	reTs := regexp.MustCompile(`"timestamp":"[0-9\.\-\+\:\sZ]+"`)

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			tempDir, err := os.MkdirTemp(os.TempDir(), "TestAudit_LogRecord")
			require.NoError(t, err)
			defer os.Remove(tempDir)

			filePath := filepath.Join(tempDir, "audit.log")
			cfg.Options = json.RawMessage(fmt.Sprintf(`{"filename": "%s"}`, filePath))
			logger, err := mlog.NewLogger()
			require.NoError(t, err)

			err = logger.ConfigureTargets(map[string]mlog.TargetCfg{testCase.description: cfg}, nil)
			require.NoError(t, err)
			mlog.InitGlobalLogger(logger)

			audit := Audit{}
			audit.logger = logger
			testCase.auditLogFunc(audit)

			err = logger.Shutdown()
			require.NoError(t, err)

			logs, err := os.ReadFile(filePath)
			require.NoError(t, err)

			actual := strings.TrimSpace(string(logs))
			actual = reTs.ReplaceAllString(actual, `"timestamp":0`)
			require.ElementsMatch(t, testCase.expectedLogs, strings.Split(actual, "\n"))
		})
	}
}

func TestAudit_LogRecord_SyncHandlerBypassesQueue(t *testing.T) {
	var captured model.AuditRecord
	a := Audit{
		SyncHandlers: map[string]SyncHandler{
			"my_event": func(rec model.AuditRecord) error {
				captured = rec
				return nil
			},
		},
	}

	rec := model.AuditRecord{
		EventName: "my_event",
		Status:    model.AuditStatusSuccess,
		Meta:      map[string]any{"k": "v"},
	}
	// a.logger is nil; if LogRecord falls through to the queued path
	// it will nil-deref. Reaching the assertions below proves the sync
	// handler short-circuited.
	a.LogRecord(mlog.LvlAuditAPI, rec)

	assert.Equal(t, "my_event", captured.EventName)
	assert.Equal(t, model.AuditStatusSuccess, captured.Status)
	assert.Equal(t, map[string]any{"k": "v"}, captured.Meta)
}

func TestAudit_LogRecord_SyncHandlerErrorRoutesThroughOnError(t *testing.T) {
	var seen error
	a := Audit{
		SyncHandlers: map[string]SyncHandler{
			"my_event": func(_ model.AuditRecord) error {
				return errors.New("boom")
			},
		},
		OnError: func(err error) { seen = err },
	}

	a.LogRecord(mlog.LvlAuditAPI, model.AuditRecord{EventName: "my_event"})

	require.Error(t, seen)
	assert.Contains(t, seen.Error(), "boom")
}

func TestAudit_LogRecord_NoSyncHandlerForEventNameTakesQueuedPath(t *testing.T) {
	called := false
	a := Audit{
		SyncHandlers: map[string]SyncHandler{
			"other_event": func(_ model.AuditRecord) error {
				called = true
				return nil
			},
		},
	}

	tempDir, err := os.MkdirTemp(os.TempDir(), "TestAudit_SyncBypass")
	require.NoError(t, err)
	defer os.Remove(tempDir)
	filePath := filepath.Join(tempDir, "audit.log")

	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	cfg := mlog.TargetCfg{
		Type:    "file",
		Format:  "json",
		Levels:  []mlog.Level{mlog.LvlAuditAPI},
		Options: json.RawMessage(fmt.Sprintf(`{"filename": "%s"}`, filePath)),
	}
	require.NoError(t, logger.ConfigureTargets(map[string]mlog.TargetCfg{"f": cfg}, nil))
	a.logger = logger

	a.LogRecord(mlog.LvlAuditAPI, model.AuditRecord{EventName: "unmatched_event"})

	require.NoError(t, logger.Shutdown())
	logs, err := os.ReadFile(filePath)
	require.NoError(t, err)

	assert.False(t, called, "sync handler for a different event must not fire")
	assert.Contains(t, string(logs), `"event_name":"unmatched_event"`)
}
