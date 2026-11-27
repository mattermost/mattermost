// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestAttributesStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestAttributesStore)
}

// TestAttributeLiveViewSubjectLookupUsesIndex checks that GetSubject's read of a live view is
// a lookup on idx_propertyvalues_targetid_groupid, not a scan of PropertyValues. The live view
// recomputes the subject on every read, so without the index each access check would read
// every attribute value. The transaction seeds one group with many targets and analyzes the
// table, so the group isn't selective and the target is, as on a real server; on a nearly empty
// table any index looks as cheap as any other. Sequential scans are disabled so the assertion is
// about whether the planner can use the index.
func TestAttributeLiveViewSubjectLookupUsesIndex(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	attributes, ok := store.Attributes().(*SqlAttributesStore)
	require.True(t, ok)

	for _, objectType := range []string{model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypeChannel} {
		t.Run(objectType, func(t *testing.T) {
			// enable_seqscan is a session setting, so it and the EXPLAIN share a transaction;
			// the seeded rows and SET LOCAL are undone by the rollback.
			tx, txErr := store.GetMaster().Begin()
			require.NoError(t, txErr)
			defer tx.Rollback() //nolint:errcheck

			groupID, fieldID := model.NewId(), model.NewId()
			_, txErr = tx.Exec(`INSERT INTO PropertyValues (ID, TargetID, TargetType, GroupID, FieldID, Value, CreateAt, UpdateAt, DeleteAt)
				SELECT substr(md5('id' || i), 1, 26), substr(md5('target' || i), 1, 26), $1, $2, $3, '"value"'::jsonb, 1, 1, 0
				FROM generate_series(1, 5000) AS i`, objectType, groupID, fieldID)
			require.NoError(t, txErr)
			_, txErr = tx.Exec("ANALYZE PropertyValues")
			require.NoError(t, txErr)

			_, txErr = tx.Exec("SET LOCAL enable_seqscan = off")
			require.NoError(t, txErr)

			// Rendered by the same helper GetSubject uses, so the plan asserted is the one the
			// store gets.
			var targetID string
			require.NoError(t, tx.Get(&targetID, "SELECT substr(md5('target' || 42), 1, 26)"))
			query, args, qErr := attributes.subjectQuery(targetID, groupID, objectType)
			require.NoError(t, qErr)

			var lines []string
			require.NoError(t, tx.Select(&lines, "EXPLAIN "+query, args...))
			plan := strings.Join(lines, "\n")
			require.Contains(t, plan, "idx_propertyvalues_targetid_groupid", "the live view lookup must use the index, plan was:\n%s", plan)
		})
	}
}
