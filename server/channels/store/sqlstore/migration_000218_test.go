// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func propertyFieldTypeHasValue(t *testing.T, s *SqlStore, label string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count, `
		SELECT COUNT(*)
		FROM pg_enum e
		JOIN pg_type ty ON ty.oid = e.enumtypid
		WHERE ty.typname = 'property_field_type' AND e.enumlabel = $1`, label)
	require.NoError(t, err)
	return count > 0
}

// TestMigration000218 verifies that 'graph' is a usable property_field_type
// value, and that the deliberately empty down migration leaves it in place —
// which is the documented behaviour, not an oversight: Postgres cannot remove a
// value from an enum type without rebuilding it.
func TestMigration000218(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000218 is already in effect.
	require.True(t, propertyFieldTypeHasValue(t, store, "graph"))

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)

	t.Run("a field row can hold the graph type", func(t *testing.T) {
		field, cErr := store.PropertyField().Create(&model.PropertyField{
			GroupID:    group.ID,
			Name:       "programs",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program"},
				},
			},
		})
		require.NoError(t, cErr)

		read, gErr := store.PropertyField().Get(t.Context(), group.ID, field.ID)
		require.NoError(t, gErr)
		assert.Equal(t, model.PropertyFieldTypeGraph, read.Type)

		// The options of a graph field are rows like any other option-bearing
		// type's, so they come back hydrated.
		options, ok := read.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok, "expected an inline option list, got %#v", read.Attrs[model.PropertyFieldAttributeOptions])
		assert.Len(t, options, 2)
	})

	t.Run("the down migration keeps the enum value", func(t *testing.T) {
		_, dErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000218_add_graph_to_property_field_type.down.sql"))
		require.NoError(t, dErr, "down migration should succeed")
		assert.True(t, propertyFieldTypeHasValue(t, store, "graph"),
			"the down migration is a no-op, so 'graph' must survive it")

		// And re-applying the up migration on top is harmless.
		_, uErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000218_add_graph_to_property_field_type.up.sql"))
		require.NoError(t, uErr, "up migration should be re-appliable")
		assert.True(t, propertyFieldTypeHasValue(t, store, "graph"))
	})
}
