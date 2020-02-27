// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func createIndexTest(t *testing.T, r *MigrationRunner, ss *SqlSupplier) {
	idxName := "idx_posts_root_id_delete_at"
	defer ss.RemoveIndexIfExists(idxName, "Posts")
	createIndex := NewCreateIndex(ss, idxName, "Posts", []string{"RootId", "DeleteAt"}, INDEX_TYPE_DEFAULT, false)
	err := r.Add(createIndex)
	assert.Nil(t, err, "should have added migration")

	r.Run()
	r.Wait()

	// check if the index was added
	// TODO: use some faster way?
	res := ss.CreateCompositeIndexIfNotExists(idxName, "Posts", []string{"RootId", "DeleteAt"})
	assert.False(t, res, "index should already exist")
}

func createIndexTestTableLocked(t *testing.T, r *MigrationRunner, ss *SqlSupplier) {
	idxName := "idx_posts_root_id_delete_at2"
	defer ss.RemoveIndexIfExists(idxName, "Posts")

	// use the table in a transaction so it can't be locked
	tx, err := ss.GetMaster().Begin()
	assert.Nil(t, err, "transaction error")
	tx.SelectStr("SELECT '1' FROM Posts LIMIT 1")
	defer tx.Rollback()

	createIndex := NewCreateIndex(ss, idxName, "Posts", []string{"RootId", "DeleteAt"}, INDEX_TYPE_DEFAULT, false)
	err = r.Add(createIndex)
	assert.Nil(t, err, "should have added migration")

	r.Run()
	r.Wait()
	tx.Rollback()

	// check if the index was added
	// postgresql allows adding new index even if there are locks
	// TODO: use some faster way?
	res := ss.CreateCompositeIndexIfNotExists(idxName, "Posts", []string{"RootId", "DeleteAt"})
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		assert.False(t, res, "index should already exist")
	} else {
		assert.True(t, res, "index should not exist")
	}
}
