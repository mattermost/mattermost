// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestPropertyGroupStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("RegisterAndGetPropertyGroup", func(t *testing.T) { testRegisterAndGetPropertyGroup(t, rctx, ss) })
}

func testRegisterAndGetPropertyGroup(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should be able to register a new group", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "samplename",
			Version: model.PropertyGroupVersionV1,
		})
		require.NoError(t, err)
		require.NotZero(t, group.ID)
		require.Equal(t, "samplename", group.Name)
		require.Equal(t, model.PropertyGroupVersionV1, group.Version)
	})

	t.Run("should be able to retrieve an existing group by re-registering", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "samplename",
			Version: model.PropertyGroupVersionV1,
		})
		require.NoError(t, err)
		require.NotZero(t, group.ID)
		require.Equal(t, "samplename", group.Name)
		require.Equal(t, model.PropertyGroupVersionV1, group.Version)
	})

	t.Run("should be able to register and retrieve a v2 group", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "v2_group_test",
			Version: model.PropertyGroupVersionV2,
		})
		require.NoError(t, err)
		require.NotZero(t, group.ID)
		require.Equal(t, "v2_group_test", group.Name)
		require.Equal(t, model.PropertyGroupVersionV2, group.Version)

		group, err = ss.PropertyGroup().Get("v2_group_test")
		require.NoError(t, err)
		require.Equal(t, "v2_group_test", group.Name)
		require.Equal(t, model.PropertyGroupVersionV2, group.Version)
	})

	t.Run("should not update version when re-registering an existing group", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "version_immutable_test",
			Version: model.PropertyGroupVersionV1,
		})
		require.NoError(t, err)
		require.Equal(t, model.PropertyGroupVersionV1, group.Version)
		originalID := group.ID

		group, err = ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "version_immutable_test",
			Version: model.PropertyGroupVersionV2,
		})
		require.NoError(t, err)
		require.Equal(t, model.PropertyGroupVersionV1, group.Version)
		require.Equal(t, originalID, group.ID)

		group, err = ss.PropertyGroup().Get("version_immutable_test")
		require.NoError(t, err)
		require.Equal(t, model.PropertyGroupVersionV1, group.Version)
		require.Equal(t, originalID, group.ID)
	})

	t.Run("should fail to register a group with empty name", func(t *testing.T) {
		_, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "",
			Version: model.PropertyGroupVersionV1,
		})
		require.Error(t, err)
	})

	t.Run("should fail to register a nil group", func(t *testing.T) {
		_, err := ss.PropertyGroup().Register(nil)
		require.Error(t, err)
	})

	t.Run("should fail to register a group with invalid version", func(t *testing.T) {
		_, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "invalid_version_group",
			Version: 99,
		})
		require.Error(t, err)
	})

	t.Run("should retrieve a group by its ID", func(t *testing.T) {
		group, err := ss.PropertyGroup().Register(&model.PropertyGroup{
			Name:    "getbyid_test_group",
			Version: model.PropertyGroupVersionV2,
		})
		require.NoError(t, err)
		require.NotZero(t, group.ID)

		fetched, err := ss.PropertyGroup().GetByID(group.ID)
		require.NoError(t, err)
		require.Equal(t, group.ID, fetched.ID)
		require.Equal(t, "getbyid_test_group", fetched.Name)
		require.Equal(t, model.PropertyGroupVersionV2, fetched.Version)
	})

	t.Run("should return error for non-existent ID", func(t *testing.T) {
		_, err := ss.PropertyGroup().GetByID(model.NewId())
		require.Error(t, err)
	})
}
