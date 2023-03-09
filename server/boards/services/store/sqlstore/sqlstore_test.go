// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/services/store/storetests"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

func TestSQLStore(t *testing.T) {
	t.Run("BlocksStore", func(t *testing.T) { storetests.StoreTestBlocksStore(t, SetupTests) })
	t.Run("SharingStore", func(t *testing.T) { storetests.StoreTestSharingStore(t, SetupTests) })
	t.Run("SystemStore", func(t *testing.T) { storetests.StoreTestSystemStore(t, SetupTests) })
	t.Run("UserStore", func(t *testing.T) { storetests.StoreTestUserStore(t, SetupTests) })
	t.Run("SessionStore", func(t *testing.T) { storetests.StoreTestSessionStore(t, SetupTests) })
	t.Run("TeamStore", func(t *testing.T) { storetests.StoreTestTeamStore(t, SetupTests) })
	t.Run("BoardStore", func(t *testing.T) { storetests.StoreTestBoardStore(t, SetupTests) })
	t.Run("BoardsAndBlocksStore", func(t *testing.T) { storetests.StoreTestBoardsAndBlocksStore(t, SetupTests) })
	t.Run("SubscriptionStore", func(t *testing.T) { storetests.StoreTestSubscriptionsStore(t, SetupTests) })
	t.Run("NotificationHintStore", func(t *testing.T) { storetests.StoreTestNotificationHintsStore(t, SetupTests) })
	t.Run("DataRetention", func(t *testing.T) { storetests.StoreTestDataRetention(t, SetupTests) })
	t.Run("CloudStore", func(t *testing.T) { storetests.StoreTestCloudStore(t, SetupTests) })
	t.Run("StoreTestFileStore", func(t *testing.T) { storetests.StoreTestFileStore(t, SetupTests) })
	t.Run("StoreTestCategoryStore", func(t *testing.T) { storetests.StoreTestCategoryStore(t, SetupTests) })
	t.Run("StoreTestCategoryBoardsStore", func(t *testing.T) { storetests.StoreTestCategoryBoardsStore(t, SetupTests) })
	t.Run("BoardsInsightsStore", func(t *testing.T) { storetests.StoreTestBoardsInsightsStore(t, SetupTests) })
	t.Run("ComplianceHistoryStore", func(t *testing.T) { storetests.StoreTestComplianceHistoryStore(t, SetupTests) })
}

//  tests for  utility functions inside sqlstore.go

func TestConcatenationSelector(t *testing.T) {
	store, tearDown := SetupTests(t)
	sqlStore := store.(*SQLStore)
	defer tearDown()

	concatenationString := sqlStore.concatenationSelector("a", ",")
	switch sqlStore.dbType {
	case model.MysqlDBType:
		require.Equal(t, concatenationString, "GROUP_CONCAT(a SEPARATOR ',')")
	case model.PostgresDBType:
		require.Equal(t, concatenationString, "string_agg(a, ',')")
	}
}

func TestElementInColumn(t *testing.T) {
	store, tearDown := SetupTests(t)
	sqlStore := store.(*SQLStore)
	defer tearDown()

	inLiteral := sqlStore.elementInColumn("test_column")
	switch sqlStore.dbType {
	case model.MysqlDBType:
		require.Equal(t, inLiteral, "instr(test_column, ?) > 0")
	case model.PostgresDBType:
		require.Equal(t, inLiteral, "position(? in test_column) > 0")
	}
}
