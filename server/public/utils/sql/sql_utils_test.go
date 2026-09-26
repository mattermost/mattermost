// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sql

import (
	"testing"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestSetupConnectionDataSourceLogField covers the "dataSource" field that
// SetupConnection attaches to its logger. Only URL-form connection strings are
// partially redacted and logged as such; any other form is logged as the fully
// redacted setting, so nothing of it reaches the log records.
func TestSetupConnectionDataSourceLogField(t *testing.T) {
	fullyRedacted := `"dataSource":"` + model.FakeSetting + `"`

	testCases := []struct {
		name string
		// dataSource points at a port nothing listens on, so every ping fails
		// immediately and SetupConnection emits its retry record.
		dataSource string
		credential string
		// wantLogField is the exact log field expected for the connection
		// string.
		wantLogField string
	}{
		{
			name:         "URL",
			dataSource:   "postgres://mmuser:sentinel_pw_alpha@127.0.0.1:1/mattermost?sslmode=disable",
			credential:   "sentinel_pw_alpha",
			wantLogField: `"dataSource":"postgres://` + model.SanitizedPassword + `:` + model.SanitizedPassword + `@127.0.0.1:1/mattermost?sslmode=disable"`,
		},
		{
			name:         "URL with credentials in the query string",
			dataSource:   "postgres://127.0.0.1:1/mattermost?user=mmuser&password=sentinel_pw_bravo&sslmode=disable",
			credential:   "sentinel_pw_bravo",
			wantLogField: `"dataSource":"postgres://` + model.SanitizedPassword + `:` + model.SanitizedPassword + `@127.0.0.1:1/mattermost?sslmode=disable"`,
		},
		{
			name:         "keyword/value",
			dataSource:   "user=mmuser password=sentinel_pw_charlie host=127.0.0.1 port=1 dbname=mattermost sslmode=disable",
			credential:   "sentinel_pw_charlie",
			wantLogField: fullyRedacted,
		},
		{
			name:         "keyword/value with a quoted value",
			dataSource:   "host=127.0.0.1 port=1 user=mmuser password='sentinel_pw_delta with space' dbname=mattermost sslmode=disable",
			credential:   "sentinel_pw_delta",
			wantLogField: fullyRedacted,
		},
		{
			name:         "keyword/value naming a scheme away from the start",
			dataSource:   "options=postgres:// user=mmuser password=sentinel_pw_echo host=127.0.0.1 port=1 sslmode=disable",
			credential:   "sentinel_pw_echo",
			wantLogField: fullyRedacted,
		},
	}

	driverName := model.DatabaseDriverPostgres
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			settings := &model.SqlSettings{DriverName: &driverName}
			settings.SetDefaults(false)

			logger, err := mlog.NewLogger()
			require.NoError(t, err)
			t.Cleanup(func() {
				require.NoError(t, logger.Shutdown())
			})

			var buf mlog.Buffer
			require.NoError(t, mlog.AddWriterTarget(logger, &buf, true, mlog.StdAll...))

			// Two attempts, so that the record carrying the connection fields is
			// emitted before the last attempt gives up.
			_, err = SetupConnection(logger, "master", tc.dataSource, settings, 2)
			require.Error(t, err)
			require.NoError(t, logger.Flush())

			require.NotEmpty(t, buf.String())
			assert.NotContains(t, buf.String(), tc.credential)
			assert.Contains(t, buf.String(), tc.wantLogField)
		})
	}
}
