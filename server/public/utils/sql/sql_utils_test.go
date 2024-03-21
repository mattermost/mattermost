// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sql

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendMultipleStatementsFlag(t *testing.T) {
	testCases := []struct {
		Scenario    string
		DSN         string
		ExpectedDSN string
	}{
		{
			"Should append multiStatements param to the DSN path with existing params",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost?writeTimeout=30s",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost?writeTimeout=30s&multiStatements=true",
		},
		{
			"Should append multiStatements param to the DSN path with no existing params",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost?multiStatements=true",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Scenario, func(t *testing.T) {
			res, err := AppendMultipleStatementsFlag(tc.DSN)
			require.NoError(t, err)
			assert.Equal(t, tc.ExpectedDSN, res)
		})
	}
}

func TestResetReadTimeout(t *testing.T) {
	testCases := []struct {
		Scenario    string
		DSN         string
		ExpectedDSN string
	}{
		{
			"Should re move read timeout param from the DSN",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost?readTimeout=30s",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost",
		},
		{
			"Should change nothing as there is no read timeout param specified",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost",
			"user:rand?&ompasswith@character@unix(/var/run/mysqld/mysqld.sock)/mattermost",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Scenario, func(t *testing.T) {
			res, err := ResetReadTimeout(tc.DSN)
			require.NoError(t, err)
			assert.Equal(t, tc.ExpectedDSN, res)
		})
	}
}

func TestSanitizeDataSource(t *testing.T) {
	t.Run(model.DatabaseDriverPostgres, func(t *testing.T) {
		testCases := []struct {
			Original  string
			Sanitized string
		}{
			{
				"postgres://mmuser:mostest@localhost/dummy?sslmode=disable",
				"postgres://%2A%2A%2A%2A:%2A%2A%2A%2A@localhost/dummy?sslmode=disable",
			},
			{
				"postgres://localhost/dummy?sslmode=disable&user=mmuser&password=mostest",
				"postgres://%2A%2A%2A%2A:%2A%2A%2A%2A@localhost/dummy?sslmode=disable",
			},
		}
		driver := model.DatabaseDriverPostgres
		for _, tc := range testCases {
			out, err := SanitizeDataSource(driver, tc.Original)
			require.NoError(t, err)
			assert.Equal(t, tc.Sanitized, out)
		}
	})

	t.Run(model.DatabaseDriverMysql, func(t *testing.T) {
		testCases := []struct {
			Original  string
			Sanitized string
		}{
			{
				"mmuser:mostest@tcp(localhost:3306)/mattermost_test?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s",
				"****:****@tcp(localhost:3306)/mattermost_test?readTimeout=30s&writeTimeout=30s&charset=utf8mb4%2Cutf8",
			},
		}
		driver := model.DatabaseDriverMysql
		for _, tc := range testCases {
			out, err := SanitizeDataSource(driver, tc.Original)
			require.NoError(t, err)
			assert.Equal(t, tc.Sanitized, out)
		}
	})
}
