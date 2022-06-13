package audit

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/stretchr/testify/require"
)

func TestAudit_LogRecord(t *testing.T) {
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
				usr.Id = "fasd21321sdasd12"
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
				`{"timestamp":0,"level":"audit-api","msg":"","event_name":"User.Update","status":"success","actor":{"user_id":"","session_id":"","client":"","ip_address":""},"event":{"parameters":null,"prior_state":{"id":"fasd21321sdasd12","username":"TestABC"},"resulting_state":{"id":"fasd21321sdasd12","username":"TestDEF"},"object_type":"user"},"meta":null,"error":{}}`,
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
			tempDir, err := ioutil.TempDir(os.TempDir(), "TestAudit_LogRecord")
			require.NoError(t, err)
			defer os.Remove(tempDir)

			var filePath string
			filePath = filepath.Join(tempDir, "audit.log")
			cfg.Options = json.RawMessage(fmt.Sprintf(`{"filename": "%s"}`, filePath))
			logger, _ := mlog.NewLogger()
			err = logger.ConfigureTargets(map[string]mlog.TargetCfg{testCase.description: cfg}, nil)
			require.NoError(t, err)
			mlog.InitGlobalLogger(logger)

			audit := Audit{}
			audit.logger = logger
			testCase.auditLogFunc(audit)

			err = logger.Shutdown()
			require.NoError(t, err)

			logs, err := ioutil.ReadFile(filePath)
			require.NoError(t, err)

			actual := strings.TrimSpace(string(logs))
			actual = reTs.ReplaceAllString(actual, `"timestamp":0`)
			require.ElementsMatch(t, testCase.expectedLogs, strings.Split(actual, "\n"))
		})
	}
}
