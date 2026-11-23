// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func savePasskey(t *testing.T, th *TestHelper, userID, name string, createAt int64) *model.Passkey {
	t.Helper()

	saved, err := th.App.Srv().Store().Passkey().SaveIfUnderLimit(&model.Passkey{
		UserId:       userID,
		Name:         name,
		CreateAt:     createAt,
		UserHandle:   []byte("handle-" + userID),
		CredentialId: []byte("cred-" + model.NewId()),
		PublicKey:    []byte("key"),
		AAGUID:       []byte{},
	}, model.PasskeyMaxPerUser)
	require.NoError(t, err)
	return saved
}

func TestGetPasskeysForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("no passkeys gives an empty non-nil slice", func(t *testing.T) {
		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, passkeys)
		require.Empty(t, passkeys)
	})

	t.Run("returns only the user's passkeys, oldest first", func(t *testing.T) {
		now := model.GetMillis()
		newer := savePasskey(t, th, th.BasicUser2.Id, "newer", now)
		older := savePasskey(t, th, th.BasicUser2.Id, "older", now-1000)
		savePasskey(t, th, th.BasicUser.Id, "someone else's", now)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Len(t, passkeys, 2)
		require.Equal(t, older.Id, passkeys[0].Id)
		require.Equal(t, newer.Id, passkeys[1].Id)
	})
}

func TestDeletePasskey(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("deletes the user's own passkey", func(t *testing.T) {
		passkey := savePasskey(t, th, th.BasicUser.Id, "mine", model.GetMillis())

		require.Nil(t, th.App.DeletePasskey(th.BasicUser.Id, passkey.Id))

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Empty(t, passkeys)
	})

	t.Run("another user's passkey is a 404 and survives", func(t *testing.T) {
		passkey := savePasskey(t, th, th.BasicUser2.Id, "theirs", model.GetMillis())

		appErr := th.App.DeletePasskey(th.BasicUser.Id, passkey.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
		require.Equal(t, "app.passkey.not_found.app_error", appErr.Id)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Len(t, passkeys, 1)
	})

	t.Run("unknown id is a 404", func(t *testing.T) {
		appErr := th.App.DeletePasskey(th.BasicUser.Id, model.NewId())
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
		require.Equal(t, "app.passkey.not_found.app_error", appErr.Id)
	})
}
