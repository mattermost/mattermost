// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func viewExists(t *testing.T, s *SqlStore, name string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count,
		"SELECT COUNT(*) FROM pg_views WHERE schemaname = current_schema() AND lower(viewname) = lower($1)", name)
	require.NoError(t, err)
	return count > 0
}

func uniqueIndexExists(t *testing.T, s *SqlStore, name string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count,
		"SELECT COUNT(*) FROM pg_indexes WHERE lower(indexname) = lower($1) AND indexdef ILIKE 'CREATE UNIQUE INDEX%'", name)
	require.NoError(t, err)
	return count > 0
}

func matviewReadsLiveView(t *testing.T, s *SqlStore, matview, liveView string) bool {
	t.Helper()
	var definition string
	err := s.GetMaster().Get(&definition,
		"SELECT definition FROM pg_matviews WHERE lower(matviewname) = lower($1)", matview)
	require.NoError(t, err)
	var reads bool
	err = s.GetMaster().Get(&reads, "SELECT position(lower($1) IN lower($2)) > 0", liveView, definition)
	require.NoError(t, err)
	return reads
}

// TestMigration000236 verifies that the attribute query moves into the live
// views without changing what the materialized views hold: after up, both
// materialized views read their live view and hold exactly its rows; down
// restores the self-contained 000223 bodies with the same rows and drops the
// live views; and up again brings the live views back. It also covers the
// unique indexes 000237 and 000238 add for REFRESH ... CONCURRENTLY, and the
// plain-refresh fallback for a view that has lost its index.
func TestMigration000236(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	views := []struct{ matview, liveView, index, indexUp, objectType, targetType string }{
		{
			"UserAttributeView", "UserAttributeLiveView",
			"idx_userattributeview_target", "000237_create_userattributeview_target_index.up.sql",
			model.PropertyFieldObjectTypeUser, model.PropertyValueTargetTypeUser,
		},
		{
			"ChannelAttributeView", "ChannelAttributeLiveView",
			"idx_channelattributeview_target", "000238_create_channelattributeview_target_index.up.sql",
			model.PropertyFieldObjectTypeChannel, model.PropertyValueTargetTypeChannel,
		},
	}

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	optionID := model.NewId()
	for _, v := range views {
		textField, fErr := store.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       v.objectType + "_text",
			Type:       model.PropertyFieldTypeText,
			ObjectType: v.objectType,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, fErr)
		selectField, fErr := store.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       v.objectType + "_select",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: v.objectType,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": []any{map[string]any{"id": optionID, "name": "Chosen"}}},
		})
		require.NoError(t, fErr)

		for range 3 {
			targetID := model.NewId()
			text, mErr := json.Marshal("value-" + targetID)
			require.NoError(t, mErr)
			chosen, mErr := json.Marshal(optionID)
			require.NoError(t, mErr)
			for fieldID, value := range map[string][]byte{textField.ID: text, selectField.ID: chosen} {
				_, vErr := store.PropertyValue().Create(&model.PropertyValue{
					TargetID:   targetID,
					TargetType: v.targetType,
					GroupID:    groupID,
					FieldID:    fieldID,
					Value:      value,
				})
				require.NoError(t, vErr)
			}
		}
	}

	// rowsFingerprint hashes a view's rows for the seeded group, so two views
	// (or one view across a migration) can be required to hold the same rows.
	rowsFingerprint := func(t *testing.T, view string) string {
		t.Helper()
		var hash string
		require.NoError(t, store.GetMaster().Get(&hash,
			"SELECT COALESCE(md5(string_agg(TargetID || TargetType || Attributes::text, '|' ORDER BY TargetID)), '') FROM "+view+" WHERE GroupID = $1",
			groupID))
		require.NotEmpty(t, hash, "%s should hold the seeded rows", view)
		return hash
	}

	// New() applies all migrations, so 000236 is already in effect.
	require.NoError(t, store.Attributes().RefreshAttributes())
	before := map[string]string{}
	for _, v := range views {
		require.True(t, viewExists(t, store, v.liveView), "%s should exist after migration", v.liveView)
		require.True(t, matviewExists(t, store, v.matview), "%s should exist after migration", v.matview)
		require.True(t, matviewReadsLiveView(t, store, v.matview, v.liveView), "%s should be built on %s", v.matview, v.liveView)
		require.True(t, uniqueIndexExists(t, store, v.index), "%s should have its unique index", v.matview)
		before[v.matview] = rowsFingerprint(t, v.matview)
		require.Equal(t, before[v.matview], rowsFingerprint(t, v.liveView), "%s should hold exactly the live view's rows", v.matview)
	}

	// Down recreates the materialized views, which drops their indexes, so the
	// refresh after it can only succeed through the plain-refresh fallback.
	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000236_attribute_live_views.down.sql"))
	require.NoError(t, err)
	for _, v := range views {
		require.False(t, uniqueIndexExists(t, store, v.index), "recreating %s should drop its index", v.matview)
	}
	require.NoError(t, store.Attributes().RefreshAttributes(), "a view without its unique index must still refresh")
	for _, v := range views {
		require.False(t, viewExists(t, store, v.liveView), "down should drop %s", v.liveView)
		require.True(t, matviewExists(t, store, v.matview), "down should keep %s", v.matview)
		require.Equal(t, before[v.matview], rowsFingerprint(t, v.matview), "down should leave %s's rows unchanged", v.matview)
	}

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000236_attribute_live_views.up.sql"))
	require.NoError(t, err)
	for _, v := range views {
		_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, v.indexUp))
		require.NoError(t, err, "applying %s", v.indexUp)
		require.True(t, uniqueIndexExists(t, store, v.index), "%s should restore the unique index", v.indexUp)
	}
	require.NoError(t, store.Attributes().RefreshAttributes(), "the concurrent refresh should succeed with the indexes back")
	for _, v := range views {
		require.True(t, viewExists(t, store, v.liveView), "up should recreate %s", v.liveView)
		require.True(t, matviewReadsLiveView(t, store, v.matview, v.liveView), "up should rebuild %s on %s", v.matview, v.liveView)
		require.Equal(t, before[v.matview], rowsFingerprint(t, v.matview), "up should leave %s's rows unchanged", v.matview)
	}
}
