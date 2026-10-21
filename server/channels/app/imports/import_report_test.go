// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"bytes"
	"encoding/csv"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteUnmatchedUsersCSV_Empty(t *testing.T) {
	var report ImportReport
	var buf bytes.Buffer

	count, err := report.WriteUnmatchedUsersCSV(&buf)
	require.NoError(t, err)
	assert.Equal(t, 0, count)
	// Nothing is written for an empty report, so callers can skip creating a file.
	assert.Empty(t, buf.Bytes())
}

func TestWriteUnmatchedUsersCSV(t *testing.T) {
	var report ImportReport
	report.UnmatchedUsers.Add(UnmatchedUser{
		Username:    "alice",
		AuthService: "saml",
		Reason:      "sso_auth_data_not_found",
		Action:      UnmatchedUserCreatedInactive,
	})
	report.UnmatchedUsers.Add(UnmatchedUser{
		Username: "bob",
		Team:     "engineering",
		Channel:  "off-topic",
		Reason:   "channel_not_found",
		Action:   UnmatchedUserMembershipSkipped,
	})

	var buf bytes.Buffer
	count, err := report.WriteUnmatchedUsersCSV(&buf)
	require.NoError(t, err)
	assert.Equal(t, 2, count)

	rows, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	require.Len(t, rows, 3) // header + 2 rows

	assert.Equal(t, unmatchedUsersCSVHeader, rows[0])
	assert.Equal(t, []string{"alice", "saml", "", "", "sso_auth_data_not_found", "created_inactive"}, rows[1])
	assert.Equal(t, []string{"bob", "", "engineering", "off-topic", "channel_not_found", "membership_skipped"}, rows[2])
}

func TestUnmatchedUsers_ConcurrentAdd(t *testing.T) {
	var report ImportReport
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			report.UnmatchedUsers.Add(UnmatchedUser{Username: "u", Reason: "username_not_found", Action: UnmatchedUserCreatedActive})
		}()
	}
	wg.Wait()
	assert.Len(t, report.UnmatchedUsers.All(), 50)
}
