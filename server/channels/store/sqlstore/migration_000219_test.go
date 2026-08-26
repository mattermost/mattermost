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

// TestMigration000219 pins the shape of PropertyOptionEdges. Both of its keys
// lead with FieldID, which is what makes an edge belong to one field's option
// hierarchy and nothing else, and what lets a walk in either direction stay
// inside that field.
func TestMigration000219(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	indexDefs := func(t *testing.T) map[string]string {
		t.Helper()
		type index struct {
			Indexname string
			Indexdef  string
		}
		rows := []*index{}
		require.NoError(t, store.GetMaster().Select(&rows,
			"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'propertyoptionedges'"))

		defs := make(map[string]string, len(rows))
		for _, row := range rows {
			defs[row.Indexname] = row.Indexdef
		}
		return defs
	}

	// New() applies all migrations, so 000219 is already in effect.
	defs := indexDefs(t)
	require.Len(t, defs, 2, "the table carries its primary key and one secondary index: %v", defs)

	// The upward walk, and the identity of an edge.
	assert.Contains(t, defs["propertyoptionedges_pkey"], "(fieldid, childoptionid, parentoptionid)")
	// The downward walk, and the check for an option's children.
	assert.Contains(t, defs["idx_propertyoptionedges_fieldid_parent_child"], "(fieldid, parentoptionid, childoptionid)")

	fieldID := model.NewId()
	childID := model.NewId()
	parentID := model.NewId()

	insertEdge := func(t *testing.T, fieldID, childID, parentID string) error {
		t.Helper()
		_, iErr := store.GetMaster().Exec(
			"INSERT INTO PropertyOptionEdges (FieldID, ChildOptionID, ParentOptionID, CreateAt) VALUES (?, ?, ?, ?)",
			fieldID, childID, parentID, model.GetMillis())
		return iErr
	}

	t.Run("an edge is identified by its field and both endpoints", func(t *testing.T) {
		require.NoError(t, insertEdge(t, fieldID, childID, parentID))
		require.Error(t, insertEdge(t, fieldID, childID, parentID), "the same edge twice on one field is one edge")

		// The same pair of identifiers on another field is a different edge, not a
		// duplicate: option IDs are unique within a field, not across fields.
		require.NoError(t, insertEdge(t, model.NewId(), childID, parentID))

		// And an option may have more than one parent, which is the whole point of
		// a hierarchy that is not a tree.
		require.NoError(t, insertEdge(t, fieldID, childID, model.NewId()))
	})

	t.Run("the down migration drops the table", func(t *testing.T) {
		_, dErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000219_create_property_option_edges.down.sql"))
		require.NoError(t, dErr)
		require.Empty(t, indexDefs(t))

		_, uErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000219_create_property_option_edges.up.sql"))
		require.NoError(t, uErr)
		// The secondary index lives in 000223 so CREATE INDEX CONCURRENTLY is
		// its own non-transactional migration.
		_, iErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000223_create_property_option_edges_parent_child_index.up.sql"))
		require.NoError(t, iErr)
		require.Len(t, indexDefs(t), 2)

		var count int
		require.NoError(t, store.GetMaster().Get(&count, "SELECT COUNT(*) FROM PropertyOptionEdges"))
		assert.Zero(t, count, "the recreated table starts empty")
	})
}
