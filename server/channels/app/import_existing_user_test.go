// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func userPasswordHash(t *testing.T, th *TestHelper, username string) string {
	t.Helper()
	var h string
	require.NoError(t, th.GetSqlStore().GetMaster().Get(&h,
		"SELECT Password FROM Users WHERE Username=$1", username))
	return h
}

// TestScopedImportPreservesExistingUserPassword guards against a scoped import
// resetting the password of a pre-existing destination account that merely shares
// a username with someone in the export. Exports carry no password, so importUser
// would otherwise generate a random one and call UpdatePassword on the existing
// account, locking out the real user.
func TestScopedImportPreservesExistingUserPassword(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const teamName, chanName = "pwd-team", "pwd-chan"
	const username = "devon.pwd"

	// Pre-existing destination account with a real password.
	createUserInDB(t, th, username)
	hashBefore := userPasswordHash(t, th, username)
	require.NotEmpty(t, hashBefore)

	// Scoped import that includes the same username (no password in the export)
	// and a post authored by them.
	reader := channelScopedJSONL(t, teamName, chanName, []string{username}, []string{username})
	_, appErr := scopedBulkImport(t, th.App, th.Context, reader, model.ImportedUsersInactive)
	require.Nil(t, appErr)

	hashAfter := userPasswordHash(t, th, username)
	require.Equal(t, hashBefore, hashAfter,
		"a pre-existing destination user's password must not be reset by a scoped import sharing their username")
}
