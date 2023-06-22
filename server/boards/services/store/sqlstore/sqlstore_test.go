// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/boards/services/store/storetests"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/boards/model"
)

func TestSQLStore(t *testing.T) {
	t.Run("BlocksStore", func(t *testing.T) { storetests.StoreTestBlocksStore(t, RunStoreTests) })
	t.Run("SharingStore", func(t *testing.T) { storetests.StoreTestSharingStore(t, RunStoreTests) })
	t.Run("SystemStore", func(t *testing.T) { storetests.StoreTestSystemStore(t, RunStoreTests) })
	t.Run("UserStore", func(t *testing.T) { storetests.StoreTestUserStore(t, RunStoreTests) })
	t.Run("SessionStore", func(t *testing.T) { storetests.StoreTestSessionStore(t, RunStoreTests) })
	t.Run("TeamStore", func(t *testing.T) { storetests.StoreTestTeamStore(t, RunStoreTests) })
	t.Run("BoardStore", func(t *testing.T) { storetests.StoreTestBoardStore(t, RunStoreTests) })
	t.Run("BoardsAndBlocksStore", func(t *testing.T) { storetests.StoreTestBoardsAndBlocksStore(t, RunStoreTests) })
	t.Run("SubscriptionStore", func(t *testing.T) { storetests.StoreTestSubscriptionsStore(t, RunStoreTests) })
	t.Run("NotificationHintStore", func(t *testing.T) { storetests.StoreTestNotificationHintsStore(t, RunStoreTests) })
	t.Run("DataRetention", func(t *testing.T) { storetests.StoreTestDataRetention(t, RunStoreTests) })
	t.Run("CloudStore", func(t *testing.T) { storetests.StoreTestCloudStore(t, RunStoreTests) })
	t.Run("StoreTestFileStore", func(t *testing.T) { storetests.StoreTestFileStore(t, RunStoreTests) })
	t.Run("StoreTestCategoryStore", func(t *testing.T) { storetests.StoreTestCategoryStore(t, RunStoreTests) })
	t.Run("StoreTestCategoryBoardsStore", func(t *testing.T) { storetests.StoreTestCategoryBoardsStore(t, RunStoreTests) })
	t.Run("BoardsInsightsStore", func(t *testing.T) { storetests.StoreTestBoardsInsightsStore(t, RunStoreTests) })
	t.Run("ComplianceHistoryStore", func(t *testing.T) { storetests.StoreTestComplianceHistoryStore(t, RunStoreTests) })
}

//  tests for  utility functions inside sqlstore.go

func TestConcatenationSelector(t *testing.T) {
	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		concatenationString := sqlStore.concatenationSelector("a", ",")
		switch sqlStore.dbType {
		case model.MysqlDBType:
			require.Equal(t, concatenationString, "GROUP_CONCAT(a SEPARATOR ',')")
		case model.PostgresDBType:
			require.Equal(t, concatenationString, "string_agg(a, ',')")
		}
	})
}

func TestElementInColumn(t *testing.T) {
	RunStoreTestsWithSqlStore(t, func(t *testing.T, sqlStore *SQLStore) {
		inLiteral := sqlStore.elementInColumn("test_column")
		switch sqlStore.dbType {
		case model.MysqlDBType:
			require.Equal(t, inLiteral, "instr(test_column, ?) > 0")
		case model.PostgresDBType:
			require.Equal(t, inLiteral, "position(? in test_column) > 0")
		}
	})
}
