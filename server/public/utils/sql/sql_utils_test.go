/*
 * // Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
 * // See LICENSE.txt for license information.
 */

package sql

import (
	"testing"

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
