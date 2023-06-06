// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/sqlstore/migrationstests"
	"github.com/mgdelacroix/foundation"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetBlocksWithSameID(t *testing.T) {
	t.Skip("we need to setup a test with the database migrated up to version 14 and then run these tests")

	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		container1 := "1"
		container2 := "2"
		container3 := "3"

		block1 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block2 := &model.Block{ID: "block-id-2", BoardID: "board-id-2"}
		block3 := &model.Block{ID: "block-id-3", BoardID: "board-id-3"}

		block4 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block5 := &model.Block{ID: "block-id-2", BoardID: "board-id-2"}

		block6 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block7 := &model.Block{ID: "block-id-7", BoardID: "board-id-7"}
		block8 := &model.Block{ID: "block-id-8", BoardID: "board-id-8"}

		for _, block := range []*model.Block{block1, block2, block3} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container1, block, "user-id")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		for _, block := range []*model.Block{block4, block5} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container2, block, "user-id")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		for _, block := range []*model.Block{block6, block7, block8} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container3, block, "user-id")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		blocksWithDuplicatedID := []*model.Block{block1, block2, block4, block5, block6}

		blocks, err := sqlStore.getBlocksWithSameID(sqlStore.db)
		require.NoError(t, err)

		// we process the found blocks to remove extra information and be
		// able to compare both expected and found sets
		foundBlocks := []*model.Block{}
		for _, foundBlock := range blocks {
			foundBlocks = append(foundBlocks, &model.Block{ID: foundBlock.ID, BoardID: foundBlock.BoardID})
		}

		require.ElementsMatch(t, blocksWithDuplicatedID, foundBlocks)
	})
}

func TestReplaceBlockID(t *testing.T) {
	t.Skip("we need to setup a test with the database migrated up to version 14 and then run these tests")

	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		container1 := "1"
		container2 := "2"

		// blocks from team1
		block1 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block2 := &model.Block{ID: "block-id-2", BoardID: "board-id-2", ParentID: "block-id-1"}
		block3 := &model.Block{ID: "block-id-3", BoardID: "block-id-1"}
		block4 := &model.Block{ID: "block-id-4", BoardID: "block-id-2"}
		block5 := &model.Block{ID: "block-id-5", BoardID: "block-id-1", ParentID: "block-id-1"}
		block8 := &model.Block{
			ID: "block-id-8", BoardID: "board-id-2", Type: model.TypeCard,
			Fields: map[string]interface{}{"contentOrder": []string{"block-id-1", "block-id-2"}},
		}

		// blocks from team2. They're identical to blocks 1 and 2,
		// but they shouldn't change
		block6 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block7 := &model.Block{ID: "block-id-2", BoardID: "board-id-2", ParentID: "block-id-1"}
		block9 := &model.Block{
			ID: "block-id-8", BoardID: "board-id-2", Type: model.TypeCard,
			Fields: map[string]interface{}{"contentOrder": []string{"block-id-1", "block-id-2"}},
		}

		for _, block := range []*model.Block{block1, block2, block3, block4, block5, block8} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container1, block, "user-id")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		for _, block := range []*model.Block{block6, block7, block9} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container2, block, "user-id")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		currentID := "block-id-1"
		newID := "new-id-1"
		err := sqlStore.replaceBlockID(sqlStore.db, currentID, newID, "1")
		require.NoError(t, err)

		newBlock1, err := sqlStore.getLegacyBlock(sqlStore.db, container1, newID)
		require.NoError(t, err)
		newBlock2, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block2.ID)
		require.NoError(t, err)
		newBlock3, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block3.ID)
		require.NoError(t, err)
		newBlock5, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block5.ID)
		require.NoError(t, err)
		newBlock6, err := sqlStore.getLegacyBlock(sqlStore.db, container2, block6.ID)
		require.NoError(t, err)
		newBlock7, err := sqlStore.getLegacyBlock(sqlStore.db, container2, block7.ID)
		require.NoError(t, err)
		newBlock8, err := sqlStore.GetBlock(block8.ID)
		require.NoError(t, err)
		newBlock9, err := sqlStore.GetBlock(block9.ID)
		require.NoError(t, err)

		require.Equal(t, newID, newBlock1.ID)
		require.Equal(t, newID, newBlock2.ParentID)
		require.Equal(t, newID, newBlock3.BoardID)
		require.Equal(t, newID, newBlock5.BoardID)
		require.Equal(t, newID, newBlock5.ParentID)
		require.Equal(t, newBlock8.Fields["contentOrder"].([]interface{})[0], newID)
		require.Equal(t, newBlock8.Fields["contentOrder"].([]interface{})[1], "block-id-2")

		require.Equal(t, currentID, newBlock6.ID)
		require.Equal(t, currentID, newBlock7.ParentID)
		require.Equal(t, newBlock9.Fields["contentOrder"].([]interface{})[0], "block-id-1")
		require.Equal(t, newBlock9.Fields["contentOrder"].([]interface{})[1], "block-id-2")
	})
}

func TestRunUniqueIDsMigration(t *testing.T) {
	t.Skip("we need to setup a test with the database migrated up to version 14 and then run these tests")

	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		// we need to mark the migration as not done so we can run it
		// again with the test data
		keyErr := sqlStore.SetSystemSetting(UniqueIDsMigrationKey, "false")
		require.NoError(t, keyErr)

		container1 := "1"
		container2 := "2"
		container3 := "3"

		// blocks from workspace1. They shouldn't change, as the first
		// duplicated ID is preserved
		block1 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block2 := &model.Block{ID: "block-id-2", BoardID: "board-id-2", ParentID: "block-id-1"}
		block3 := &model.Block{ID: "block-id-3", BoardID: "block-id-1"}

		// blocks from workspace2. They're identical to blocks 1, 2 and 3,
		// and they should change
		block4 := &model.Block{ID: "block-id-1", BoardID: "board-id-1"}
		block5 := &model.Block{ID: "block-id-2", BoardID: "board-id-2", ParentID: "block-id-1"}
		block6 := &model.Block{ID: "block-id-6", BoardID: "block-id-1", ParentID: "block-id-2"}

		// block from workspace3. It should change as well
		block7 := &model.Block{ID: "block-id-2", BoardID: "board-id-2"}

		for _, block := range []*model.Block{block1, block2, block3} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container1, block, "user-id-2")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		for _, block := range []*model.Block{block4, block5, block6} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container2, block, "user-id-2")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		for _, block := range []*model.Block{block7} {
			err := sqlStore.insertLegacyBlock(sqlStore.db, container3, block, "user-id-2")
			require.NoError(t, err)
			time.Sleep(100 * time.Millisecond)
		}

		err := sqlStore.RunUniqueIDsMigration()
		require.NoError(t, err)

		// blocks from workspace 1 haven't changed, so we can simply fetch them
		newBlock1, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block1.ID)
		require.NoError(t, err)
		require.NotNil(t, newBlock1)
		newBlock2, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block2.ID)
		require.NoError(t, err)
		require.NotNil(t, newBlock2)
		newBlock3, err := sqlStore.getLegacyBlock(sqlStore.db, container1, block3.ID)
		require.NoError(t, err)
		require.NotNil(t, newBlock3)

		// first two blocks from workspace 2 have changed, so we fetch
		// them through the third one, which points to the new IDs
		newBlock6, err := sqlStore.getLegacyBlock(sqlStore.db, container2, block6.ID)
		require.NoError(t, err)
		require.NotNil(t, newBlock6)
		newBlock4, err := sqlStore.getLegacyBlock(sqlStore.db, container2, newBlock6.BoardID)
		require.NoError(t, err)
		require.NotNil(t, newBlock4)
		newBlock5, err := sqlStore.getLegacyBlock(sqlStore.db, container2, newBlock6.ParentID)
		require.NoError(t, err)
		require.NotNil(t, newBlock5)

		// block from workspace 3 changed as well, so we shouldn't be able
		// to fetch it
		newBlock7, err := sqlStore.getLegacyBlock(sqlStore.db, container3, block7.ID)
		require.NoError(t, err)
		require.Nil(t, newBlock7)

		// workspace 1 block links are maintained
		require.Equal(t, newBlock1.ID, newBlock2.ParentID)
		require.Equal(t, newBlock1.ID, newBlock3.BoardID)

		// workspace 2 first two block IDs have changed
		require.NotEqual(t, block4.ID, newBlock4.BoardID)
		require.NotEqual(t, block5.ID, newBlock5.ParentID)
	})
}

func TestCheckForMismatchedCollation(t *testing.T) {
	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		if sqlStore.dbType != model.MysqlDBType {
			return
		}

		// make sure all collations are consistent.
		tableNames, err := sqlStore.getFocalBoardTableNames()
		require.NoError(t, err)

		sqlCollation := "SELECT table_collation FROM information_schema.tables WHERE table_name=? and table_schema=(SELECT DATABASE())"
		stmtCollation, err := sqlStore.db.Prepare(sqlCollation)
		require.NoError(t, err)
		defer stmtCollation.Close()

		var collation string

		// make sure the correct charset is applied to each table.
		for i, name := range tableNames {
			row := stmtCollation.QueryRow(name)

			var actualCollation string
			err = row.Scan(&actualCollation)
			require.NoError(t, err)

			if collation == "" {
				collation = actualCollation
			}

			assert.Equalf(t, collation, actualCollation, "for table_name='%s', index=%d", name, i)
		}
	})
}

func TestRunDeDuplicateCategoryBoardsMigration(t *testing.T) {
	RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		th, tearDown := migrationstests.SetupTestHelper(t, f)
		defer tearDown()

		th.F().MigrateToStepSkippingLastInterceptor(35).
			ExecFile("./fixtures/testDeDuplicateCategoryBoardsMigration.sql")

		th.F().RunInterceptor(35)

		// verifying count of rows
		var count int
		countQuery := "SELECT COUNT(*) FROM focalboard_category_boards"
		row := th.F().DB().QueryRow(countQuery)
		err := row.Scan(&count)
		assert.NoError(t, err)
		assert.Equal(t, 4, count)
	})
}
