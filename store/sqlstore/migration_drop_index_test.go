// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func dropIndexTest(t *testing.T, r *MigrationRunner, ss *SqlSupplier) {
	idxName := "idx_posts_channel_id"
	dropIndex := NewDropIndex(ss, idxName, "Posts")
	err := r.Add(dropIndex)
	assert.Nil(t, err, "should have added migration")
	defer ss.System().PermanentDeleteByName("migration_" + dropIndex.Name())

	r.Run()
	r.Wait()

	// recreate the index and check if it was dropped
	res := ss.CreateIndexIfNotExists(idxName, "Posts", "ChannelId")
	assert.True(t, res, "index was not dropped by migration")
}

func dropIndexTestTableLocked(t *testing.T, r *MigrationRunner, ss *SqlSupplier) {
	idxName := "idx_posts_channel_id"

	// use the table in a transaction so it can't be locked
	tx, err := ss.GetMaster().Begin()
	assert.Nil(t, err, "transaction error")
	tx.SelectStr("SELECT '1' FROM Posts LIMIT 1")
	defer tx.Rollback()

	dropIndex := NewDropIndex(ss, idxName, "Posts")
	err = r.Add(dropIndex)
	assert.Nil(t, err, "should have added migration")
	defer ss.System().PermanentDeleteByName("migration_" + dropIndex.Name())

	r.Run()
	r.Wait()
	tx.Rollback()

	// index should still exist so recreating it should return false
	res := ss.CreateIndexIfNotExists(idxName, "Posts", "ChannelId")
	assert.False(t, res, "index should still exist")
}
