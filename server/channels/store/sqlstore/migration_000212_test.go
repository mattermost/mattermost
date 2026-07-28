// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// matviewExists reports whether a materialized view of the given name exists.
func matviewExists(t *testing.T, s *SqlStore, name string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count,
		"SELECT COUNT(*) FROM pg_matviews WHERE lower(matviewname) = lower($1)", name)
	require.NoError(t, err)
	return count > 0
}

// TestMigration000212 verifies the split of AttributeView into per-object-type
// views: after the migration both UserAttributeView and ChannelAttributeView
// exist (and the combined AttributeView is gone), each filtering to its own
// ObjectType. The down migration restores the single combined view.
func TestMigration000212(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000212 is already in effect.
	require.True(t, matviewExists(t, store, "UserAttributeView"), "UserAttributeView should exist after migration")
	require.True(t, matviewExists(t, store, "ChannelAttributeView"), "ChannelAttributeView should exist after migration")
	require.False(t, matviewExists(t, store, "AttributeView"), "combined AttributeView should be gone after migration")

	// Seed one user-scoped and one channel-scoped attribute in the same group.
	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	userField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "user_prop",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)
	channelField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "channel_prop",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)

	userTarget := model.NewId()
	channelTarget := model.NewId()
	userVal, err := store.PropertyValue().Create(&model.PropertyValue{
		TargetID: userTarget, TargetType: model.PropertyValueTargetTypeUser,
		GroupID: groupID, FieldID: userField.ID, Value: []byte(`"u"`),
	})
	require.NoError(t, err)
	channelVal, err := store.PropertyValue().Create(&model.PropertyValue{
		TargetID: channelTarget, TargetType: model.PropertyValueTargetTypeChannel,
		GroupID: groupID, FieldID: channelField.ID, Value: []byte(`"c"`),
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		store.PropertyValue().Delete(groupID, userVal.ID)      //nolint:errcheck
		store.PropertyValue().Delete(groupID, channelVal.ID)   //nolint:errcheck
		store.PropertyField().Delete(groupID, userField.ID)    //nolint:errcheck
		store.PropertyField().Delete(groupID, channelField.ID) //nolint:errcheck
	})

	require.NoError(t, store.Attributes().RefreshAttributes())

	countInView := func(view, targetID string) int {
		var c int
		gErr := store.GetMaster().Get(&c, "SELECT COUNT(*) FROM "+view+" WHERE TargetID = $1", targetID)
		require.NoError(t, gErr)
		return c
	}

	require.Equal(t, 1, countInView("UserAttributeView", userTarget), "user row should be in UserAttributeView")
	require.Equal(t, 0, countInView("UserAttributeView", channelTarget), "channel row should not be in UserAttributeView")
	require.Equal(t, 1, countInView("ChannelAttributeView", channelTarget), "channel row should be in ChannelAttributeView")
	require.Equal(t, 0, countInView("ChannelAttributeView", userTarget), "user row should not be in ChannelAttributeView")

	// Down then up round-trips the view topology.
	downSQL := readMigrationSQL(t, "000212_split_attribute_view_by_object_type.down.sql")
	upSQL := readMigrationSQL(t, "000212_split_attribute_view_by_object_type.up.sql")

	_, err = store.GetMaster().Exec(downSQL)
	require.NoError(t, err)
	require.True(t, matviewExists(t, store, "AttributeView"), "down should recreate AttributeView")
	require.False(t, matviewExists(t, store, "UserAttributeView"), "down should drop UserAttributeView")
	require.False(t, matviewExists(t, store, "ChannelAttributeView"), "down should drop ChannelAttributeView")

	_, err = store.GetMaster().Exec(upSQL)
	require.NoError(t, err)
	require.True(t, matviewExists(t, store, "UserAttributeView"), "up should recreate UserAttributeView")
	require.True(t, matviewExists(t, store, "ChannelAttributeView"), "up should recreate ChannelAttributeView")
	require.False(t, matviewExists(t, store, "AttributeView"), "up should drop AttributeView")
}
