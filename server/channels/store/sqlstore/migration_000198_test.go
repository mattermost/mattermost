// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestMigration000198 exercises the select→rank conversion for the built-in
// classification fields: the type flip, the position-derived (1-based) rank
// backfill, the empty/absent-options guards, and the down round-trip. It also
// verifies that fields which merely share a name — wrong object type, wrong
// group, or an unrelated name — are left untouched, since the migration matches
// each (Name, ObjectType) pair explicitly within the access_control group.
func TestMigration000198(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000198_convert_classification_fields_to_rank.up.sql")
	downSQL := readMigrationSQL(t, "000198_convert_classification_fields_to_rank.down.sql")

	// The migration resolves the group by name, so the field rows must hang off
	// an 'access_control' group.
	groupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", groupID, "access_control")
	require.NoError(t, err)

	// A second, unrelated group used to prove the migration is group-scoped.
	otherGroupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", otherGroupID, "other_group_"+model.NewId())
	require.NoError(t, err)

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyFields WHERE GroupID IN (?, ?)", groupID, otherGroupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyGroups WHERE ID IN (?, ?)", groupID, otherGroupID)      //nolint:errcheck
	})

	now := model.GetMillis()

	insertField := func(id, grpID, name, objectType, attrs string) {
		t.Helper()
		_, insErr := master.Exec(
			`INSERT INTO PropertyFields
				(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, Protected)
			VALUES (?, ?, ?, 'select', ?::jsonb, '', '', ?, ?, ?, 0, false)`,
			id, grpID, name, attrs, objectType, now, now,
		)
		require.NoError(t, insErr, "inserting field %s", name)
	}

	type option struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Rank *int   `json:"rank"`
	}
	readField := func(id string) (string, []option) {
		t.Helper()
		var row struct {
			Type  string `db:"type"`
			Attrs []byte `db:"attrs"`
		}
		require.NoError(t, master.Get(&row, "SELECT Type, Attrs FROM PropertyFields WHERE ID = ?", id))
		var parsed struct {
			Options []option `json:"options"`
		}
		require.NoError(t, json.Unmarshal(row.Attrs, &parsed))
		return row.Type, parsed.Options
	}

	var (
		fieldTemplate     = model.NewId() // classification/template: full happy path
		fieldSystemEmpty  = model.NewId() // system_classification/system: options=[] guard
		fieldChannelNone  = model.NewId() // channel_classification/channel: no options key
		fieldWrongName    = model.NewId() // access_control group, but unrelated name
		fieldWrongObjType = model.NewId() // right name, wrong object type
		fieldOtherGroup   = model.NewId() // right name+object type, wrong group
	)

	insertField(fieldTemplate, groupID, "classification", "template",
		`{"options":[{"id":"o1","name":"Public"},{"id":"o2","name":"Confidential"},{"id":"o3","name":"Secret"}]}`)
	insertField(fieldSystemEmpty, groupID, "system_classification", "system", `{"options":[]}`)
	insertField(fieldChannelNone, groupID, "channel_classification", "channel", `{"sort_order":7}`)
	insertField(fieldWrongName, groupID, "not_classification", "template",
		`{"options":[{"id":"x1","name":"A"}]}`)
	insertField(fieldWrongObjType, groupID, "classification", "channel",
		`{"options":[{"id":"y1","name":"B"}]}`)
	insertField(fieldOtherGroup, otherGroupID, "classification", "template",
		`{"options":[{"id":"z1","name":"C"}]}`)

	// ---- UP ----
	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should succeed")

	t.Run("up converts the template field and backfills 1-based ranks in order", func(t *testing.T) {
		ftype, opts := readField(fieldTemplate)
		assert.Equal(t, "rank", ftype)
		require.Len(t, opts, 3)
		assert.Equal(t, "Public", opts[0].Name)
		assert.Equal(t, "Confidential", opts[1].Name)
		assert.Equal(t, "Secret", opts[2].Name)
		require.NotNil(t, opts[0].Rank)
		require.NotNil(t, opts[1].Rank)
		require.NotNil(t, opts[2].Rank)
		assert.Equal(t, 1, *opts[0].Rank)
		assert.Equal(t, 2, *opts[1].Rank)
		assert.Equal(t, 3, *opts[2].Rank)
	})

	t.Run("up flips an empty-options field without fabricating options", func(t *testing.T) {
		ftype, opts := readField(fieldSystemEmpty)
		assert.Equal(t, "rank", ftype)
		assert.Empty(t, opts)
	})

	t.Run("up flips an options-less field without adding an options array", func(t *testing.T) {
		ftype, opts := readField(fieldChannelNone)
		assert.Equal(t, "rank", ftype)
		assert.Empty(t, opts)
	})

	t.Run("up leaves name/object-type/group mismatches as select", func(t *testing.T) {
		for _, id := range []string{fieldWrongName, fieldWrongObjType, fieldOtherGroup} {
			ftype, _ := readField(id)
			assert.Equal(t, "select", ftype)
		}
	})

	// ---- DOWN ----
	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")

	t.Run("down reverts the template field to select and strips the ranks", func(t *testing.T) {
		ftype, opts := readField(fieldTemplate)
		assert.Equal(t, "select", ftype)
		require.Len(t, opts, 3)
		assert.Equal(t, "Public", opts[0].Name)
		assert.Equal(t, "Confidential", opts[1].Name)
		assert.Equal(t, "Secret", opts[2].Name)
		assert.Nil(t, opts[0].Rank)
		assert.Nil(t, opts[1].Rank)
		assert.Nil(t, opts[2].Rank)
	})

	t.Run("down reverts the guarded fields to select", func(t *testing.T) {
		ftype, opts := readField(fieldSystemEmpty)
		assert.Equal(t, "select", ftype)
		assert.Empty(t, opts)

		ftype, opts = readField(fieldChannelNone)
		assert.Equal(t, "select", ftype)
		assert.Empty(t, opts)
	})
}
