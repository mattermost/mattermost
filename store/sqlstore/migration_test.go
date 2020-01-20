// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"
)

func MigrationTest(t *testing.T, fn func(*testing.T, *MigrationRunner, *SqlSupplier)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		t.Run(st.Name, func(t *testing.T) {
			opt := MigrationOptions{
				LockTimeout: 1,
				BackoffTime: 1,
				NumRetries:  2,
			}
			runner := NewMigrationRunner(st.SqlSupplier, opt)
			fn(t, runner, st.SqlSupplier)
		})
	}
}

func TestAsyncMigrations(t *testing.T) {
	t.Run("CreateIndex", func(t *testing.T) { MigrationTest(t, createIndexTest) })
	t.Run("CreateIndexTableLocked", func(t *testing.T) { MigrationTest(t, createIndexTestTableLocked) })
	t.Run("DropIndex", func(t *testing.T) { MigrationTest(t, dropIndexTest) })
	t.Run("DropIndexTableLocked", func(t *testing.T) { MigrationTest(t, dropIndexTestTableLocked) })
}
