// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestAudit_LogRecord(t *testing.T) {
	userId := model.NewId()
	testCases := []struct {
		description  string
		auditLogFunc func(audit Audit)
		expectedLogs []string
	}{
		{
			"empty record",
			func(audit Audit) {
				rec := Record{}
				audit.LogRecord(mlog.LvlAuditAPI, rec)
			},
			[]string{
				`{"timestamp":0,"level":"audit-api","msg":"","event_name":"","status":"","actor":{"user_id":"","session_id":"","client":"","ip_address":""},"event":{"parameters":null,"prior_state":null,"resulting_state":null,"object_type":""},"meta":null,"error":{}}`,
			},
		},
		{
			"update user record, no error",
			func(audit Audit) {

				usr := &model.User{}
				usr.Id = userId
				usr.Username = "TestABC"
				usr.Password = "hello_world"

				rec := Record{}
				rec.AddEventObjectType("user")
				rec.EventName = "User.Update"
				rec.AddEventPriorState(usr)

				usr.Username = "TestDEF"
				rec.AddEventResultState(usr)
				rec.Success()

				audit.LogRecord(mlog.LvlAuditAPI, rec)
			},
			[]string{
				strings.Replace(`{"timestamp":0,"level":"audit-api","msg":"","event_name":"User.Update","status":"success","actor":{"user_id":"","session_id":"","client":"","ip_address":""},"event":{"parameters":null,"prior_state":{"allow_marketing":false,"auth_service":"","bot_description":"","bot_last_icon_update":0,"create_at":0,"delete_at":0,"disable_welcome_email":false,"email":"","email_verified":false,"failed_attempts":0,"id":"_____USERID_____","is_bot":false,"last_activity_at":0,"last_password_update":0,"last_picture_update":0,"locale":"","mfa_active":false,"notify_props":null,"position":"","props":null,"remote_id":null,"roles":"","terms_of_service_create_at":0,"terms_of_service_id":"","timezone":null,"update_at":0,"username":"TestABC"},"resulting_state":{"allow_marketing":false,"auth_service":"","bot_description":"","bot_last_icon_update":0,"create_at":0,"delete_at":0,"disable_welcome_email":false,"email":"","email_verified":false,"failed_attempts":0,"id":"_____USERID_____","is_bot":false,"last_activity_at":0,"last_password_update":0,"last_picture_update":0,"locale":"","mfa_active":false,"notify_props":null,"position":"","props":null,"remote_id":null,"roles":"","terms_of_service_create_at":0,"terms_of_service_id":"","timezone":null,"update_at":0,"username":"TestDEF"},"object_type":"user"},"meta":null,"error":{}}`, "_____USERID_____", userId, -1),
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
