// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestPropertyGroupStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("RegisterAndGetPropertyGroup", func(t *testing.T) { testRegisterAndGetPropertyGroup(t, rctx, ss) })
}

func testRegisterAndGetPropertyGroup(t *testing.T, _ request.CTX, ss store.Store) {
	groupName := "samplename"
	var id string

	t.Run("should be able to register a new group", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(groupName)
		require.NoError(t, err)
		require.NotZero(t, group.ID)
		require.Equal(t, groupName, group.Name)
		id = group.ID
	})

	t.Run("should be able to retrieve an existing group", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(groupName)
		require.NoError(t, err)
		require.Equal(t, groupName, group.Name)
		require.Equal(t, id, group.ID)
	})
}
