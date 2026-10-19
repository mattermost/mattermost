// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"errors"
	"testing"

	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// TestMigration000237 verifies the guard against option edits made the
// pre-000223 way. Every write a server from before 000223 can make is issued
// here as raw SQL, because that is all such a server is to this schema: an
// insert or update of PropertyFields carrying Attrs->'options'. The writes the
// store makes stand in for upgraded servers, which must never trip it.
func TestMigration000237(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyOptions WHERE GroupID = ?", groupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyFields WHERE GroupID = ?", groupID)  //nolint:errcheck
	})

	const blob = `{"options": [{"id": "opt1", "name": "Option 1", "color": ""}], "visibility": "when_set"}`

	insertField := func(fieldType, attrs string) (string, error) {
		id := model.NewId()
		now := model.GetMillis()
		_, iErr := master.Exec(
			`INSERT INTO PropertyFields
				(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, Protected)
			VALUES (?, ?, ?, ?, ?::jsonb, '', 'system', 'user', ?, ?, 0, false)`,
			id, groupID, "field_"+id, fieldType, attrs, now, now,
		)
		return id, iErr
	}

	// A field as the upgrade leaves it: its options copied into PropertyOptions
	// by 000223, and the blob they came from still in Attrs. The guard has to be
	// lifted to stage one, which is itself the first thing to check: a server
	// from before 000223 cannot create such a field any more.
	blobbedField := func(t *testing.T) string {
		t.Helper()
		restore := withoutLegacyCompat(t, store)
		id, iErr := insertField("select", blob)
		restore()
		require.NoError(t, iErr)
		return id
	}

	attrsOf := func(t *testing.T, id string) string {
		t.Helper()
		var attrs string
		require.NoError(t, master.Get(&attrs, "SELECT Attrs::text FROM PropertyFields WHERE ID = ?", id))
		return attrs
	}

	requireRefused := func(t *testing.T, err error, msg string) {
		t.Helper()
		require.Error(t, err, msg)
		var pqErr *pq.Error
		require.True(t, errors.As(err, &pqErr), "%s: expected a database error, got %v", msg, err)
		assert.Equal(t, "MM001", string(pqErr.Code), msg)
		assert.Contains(t, pqErr.Message, "older than v12.0", msg)
	}

	t.Run("an older server cannot create a field with options", func(t *testing.T) {
		for _, fieldType := range []string{"select", "multiselect", "rank", "graph"} {
			_, iErr := insertField(fieldType, blob)
			requireRefused(t, iErr, fieldType)
		}

		// An empty list is still a list of options an upgraded server would
		// never see, so it is refused like any other.
		_, iErr := insertField("select", `{"options": []}`)
		requireRefused(t, iErr, "an empty option list")
	})

	t.Run("fields without options are not guarded", func(t *testing.T) {
		_, iErr := insertField("select", `{"visibility": "when_set"}`)
		require.NoError(t, iErr, "an option-bearing field written without options")

		// Only option-bearing types have the key stripped by upgraded code, so
		// only they are checked.
		_, iErr = insertField("text", blob)
		require.NoError(t, iErr, "a text field carrying an options key")
	})

	t.Run("an older server cannot change options", func(t *testing.T) {
		id := blobbedField(t)

		_, uErr := master.Exec(
			`UPDATE PropertyFields SET Attrs = jsonb_set(Attrs, '{options,0,name}', '"Renamed"') WHERE ID = ?`, id)
		requireRefused(t, uErr, "renaming an option")

		_, uErr = master.Exec(
			`UPDATE PropertyFields SET Attrs = jsonb_set(Attrs, '{options}', (Attrs->'options') || '[{"id": "opt2", "name": "Option 2", "color": ""}]') WHERE ID = ?`, id)
		requireRefused(t, uErr, "adding an option")

		_, uErr = master.Exec(`UPDATE PropertyFields SET Attrs = jsonb_set(Attrs, '{options}', '[]') WHERE ID = ?`, id)
		requireRefused(t, uErr, "removing every option")

		// A field upgraded code has written no longer carries a blob, and
		// giving it one is as invisible as changing one.
		bareID, iErr := insertField("select", `{"visibility": "when_set"}`)
		require.NoError(t, iErr)
		_, uErr = master.Exec(`UPDATE PropertyFields SET Attrs = ?::jsonb WHERE ID = ?`, blob, bareID)
		requireRefused(t, uErr, "adding a blob to a field without one")

		textID, iErr := insertField("text", `{}`)
		require.NoError(t, iErr)
		_, uErr = master.Exec(`UPDATE PropertyFields SET Type = 'select', Attrs = ?::jsonb WHERE ID = ?`, blob, textID)
		requireRefused(t, uErr, "converting a field to an option-bearing type with options")

		assert.JSONEq(t, blob, attrsOf(t, id), "a refused write must leave the field as it was")
	})

	t.Run("an older server can still edit a field without touching its options", func(t *testing.T) {
		id := blobbedField(t)

		// The whole Attrs column rewritten, as an older server does on every
		// field update, with the options the same but the keys in another order.
		_, uErr := master.Exec(
			`UPDATE PropertyFields SET Name = ?, Attrs = ?::jsonb WHERE ID = ?`,
			"renamed_"+id, `{"visibility": "always", "options": [{"color": "", "name": "Option 1", "id": "opt1"}]}`, id)
		require.NoError(t, uErr, "an unchanged option list must be allowed through")

		_, uErr = master.Exec(`UPDATE PropertyFields SET DeleteAt = ? WHERE ID = ?`, model.GetMillis(), id)
		require.NoError(t, uErr, "a delete must be allowed through")
	})

	t.Run("dropping the blob is allowed", func(t *testing.T) {
		id := blobbedField(t)

		_, uErr := master.Exec(`UPDATE PropertyFields SET Attrs = Attrs - 'options' WHERE ID = ?`, id)
		require.NoError(t, uErr, "stripping the blob must be allowed through")
		assert.JSONEq(t, `{"visibility": "when_set"}`, attrsOf(t, id))
	})

	t.Run("upgraded servers are unaffected", func(t *testing.T) {
		rctx := request.TestContext(t)

		field, cErr := store.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "store_select",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				"options": []any{map[string]any{"id": model.NewId(), "name": "First"}},
			},
		})
		require.NoError(t, cErr, "creating a field with options")

		field.Attrs["options"] = []any{
			map[string]any{"id": model.NewId(), "name": "Second"},
			map[string]any{"id": model.NewId(), "name": "Third"},
		}
		_, uErr := store.PropertyField().Update(groupID, []*model.PropertyField{field}, nil)
		require.NoError(t, uErr, "changing a field's options")

		read, gErr := store.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, gErr)
		options, ok := read.Attrs["options"].([]any)
		require.True(t, ok, "expected hydrated options, got %#v", read.Attrs["options"])
		assert.Len(t, options, 2)

		// Upgraded code's first write to a field the upgrade left a blob on is
		// the write that erases it.
		id := blobbedField(t)
		blobbed, gErr := store.PropertyField().Get(rctx, groupID, id)
		require.NoError(t, gErr)
		blobbed.Name = "store_renamed_" + id
		_, uErr = store.PropertyField().Update(groupID, []*model.PropertyField{blobbed}, nil)
		require.NoError(t, uErr, "updating a field the upgrade left a blob on")
		assert.NotContains(t, attrsOf(t, id), `"options"`, "the store must have erased the blob")
	})

	t.Run("the down migration removes the guard", func(t *testing.T) {
		_, dErr := master.ExecNoTimeout(readMigrationSQL(t, "000237_create_legacy_option_write_guard.down.sql"))
		require.NoError(t, dErr, "down migration should succeed")

		var count int
		require.NoError(t, master.Get(&count,
			"SELECT COUNT(*) FROM pg_proc WHERE proname = 'reject_legacy_property_option_write'"))
		assert.Zero(t, count, "down should drop the function")

		_, iErr := insertField("select", blob)
		require.NoError(t, iErr, "without the guard, an option blob is written as before")

		upSQL := readMigrationSQL(t, "000237_create_legacy_option_write_guard.up.sql")
		_, uErr := master.ExecNoTimeout(upSQL)
		require.NoError(t, uErr, "up migration should be re-appliable")
		_, uErr = master.ExecNoTimeout(upSQL)
		require.NoError(t, uErr, "re-executing the up migration must not fail")

		_, iErr = insertField("select", blob)
		requireRefused(t, iErr, "after up migration")
	})
}
