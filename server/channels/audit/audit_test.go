// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

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

func TestAudit_IsActive(t *testing.T) {
	fileTarget := func(path string, levels ...mlog.Level) mlog.TargetCfg {
		return mlog.TargetCfg{
			Type:    "file",
			Format:  "json",
			Levels:  levels,
			Options: json.RawMessage(fmt.Sprintf(`{"filename": %q}`, path)),
		}
	}

	// A syslog target dials its server when added, so a closed port makes it fail to start.
	unreachableSyslogTarget := func(t *testing.T) mlog.TargetCfg {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, err)
		port := listener.Addr().(*net.TCPAddr).Port
		require.NoError(t, listener.Close())

		return mlog.TargetCfg{
			Type:    "syslog",
			Format:  "json",
			Levels:  []mlog.Level{mlog.LvlAuditAPI},
			Options: json.RawMessage(fmt.Sprintf(`{"host": "127.0.0.1", "port": %d, "tag": "audit"}`, port)),
		}
	}

	newAudit := func(t *testing.T) *Audit {
		adt := &Audit{}
		adt.Init(DefMaxQueueSize)
		t.Cleanup(func() { _ = adt.Shutdown() })
		return adt
	}

	// wroteRecord logs an audit-api record and reports whether it reached the file at path.
	wroteRecord := func(t *testing.T, adt *Audit, path string) bool {
		adt.LogRecord(mlog.LvlAuditAPI, model.AuditRecord{EventName: "probe"})
		require.NoError(t, adt.Flush())
		data, err := os.ReadFile(path)
		if os.IsNotExist(err) {
			return false
		}
		require.NoError(t, err)
		return strings.Contains(string(data), `"event_name":"probe"`)
	}

	t.Run("no targets", func(t *testing.T) {
		adt := newAudit(t)
		require.NoError(t, adt.Configure(mlog.LoggerConfiguration{}))

		require.False(t, adt.IsActive())
		for _, level := range mlog.MLvlAuditAll {
			require.False(t, adt.IsLevelEnabled(level), level.Name)
		}
	})

	for _, level := range []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI} {
		t.Run("target bound to "+level.Name, func(t *testing.T) {
			adt := newAudit(t)
			path := filepath.Join(t.TempDir(), "audit.log")
			require.NoError(t, adt.Configure(mlog.LoggerConfiguration{"audit": fileTarget(path, level)}))

			require.True(t, adt.IsActive())
			require.True(t, adt.IsLevelEnabled(level))
		})
	}

	t.Run("target bound only to audit-delivery", func(t *testing.T) {
		adt := newAudit(t)
		path := filepath.Join(t.TempDir(), "audit.log")
		require.NoError(t, adt.Configure(mlog.LoggerConfiguration{"delivery": fileTarget(path, mlog.LvlAuditDelivery)}))

		require.False(t, adt.IsActive())
		require.True(t, adt.IsLevelEnabled(mlog.LvlAuditDelivery))
		require.False(t, adt.IsLevelEnabled(mlog.LvlAuditAPI))
	})

	t.Run("target bound to a non-audit level", func(t *testing.T) {
		adt := newAudit(t)
		path := filepath.Join(t.TempDir(), "audit.log")
		require.NoError(t, adt.Configure(mlog.LoggerConfiguration{"errors": fileTarget(path, mlog.LvlError)}))

		require.False(t, adt.IsActive())
	})

	t.Run("target that fails to connect", func(t *testing.T) {
		adt := newAudit(t)
		require.Error(t, adt.Configure(mlog.LoggerConfiguration{"syslog": unreachableSyslogTarget(t)}))

		require.False(t, adt.IsActive())
		require.False(t, adt.IsLevelEnabled(mlog.LvlAuditAPI))
	})

	// ConfigureTargets adds targets in map order and stops at the first failure, so whether
	// the valid target is live varies between runs. IsActive must match what is written.
	t.Run("partial configuration matches records written", func(t *testing.T) {
		for range 10 {
			adt := newAudit(t)
			path := filepath.Join(t.TempDir(), "audit.log")
			require.Error(t, adt.Configure(mlog.LoggerConfiguration{
				"file":   fileTarget(path, mlog.LvlAuditAPI),
				"syslog": unreachableSyslogTarget(t),
			}))

			require.Equal(t, wroteRecord(t, adt, path), adt.IsActive())
		}
	})

	t.Run("reconfiguring updates the answer", func(t *testing.T) {
		adt := newAudit(t)
		path := filepath.Join(t.TempDir(), "audit.log")
		require.NoError(t, adt.Configure(mlog.LoggerConfiguration{"audit": fileTarget(path, mlog.LvlAuditAPI)}))
		require.True(t, adt.IsActive())
		require.True(t, wroteRecord(t, adt, path))

		require.NoError(t, adt.Configure(mlog.LoggerConfiguration{}))
		require.False(t, adt.IsActive())
	})
}
