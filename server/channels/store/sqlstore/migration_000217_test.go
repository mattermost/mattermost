// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestMigration000217(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000217_resize_message_columns.up.sql")
	downSQL := readMigrationSQL(t, "000217_resize_message_columns.down.sql")
	recreateIndexSQL := readMigrationSQL(t, "000233_recreate_posts_message_txt_index.up.sql")

	type tableCol struct {
		table  string
		column string
	}
	targets := []tableCol{
		{"posts", "message"},
		{"drafts", "message"},
		{"scheduledposts", "message"},
		{"temporaryposts", "message"},
	}

	colLength := func(t *testing.T, table, column string) int {
		t.Helper()
		var length int
		require.NoError(t, master.Get(&length, fmt.Sprintf(`
			SELECT COALESCE(character_maximum_length, 0)
			FROM information_schema.columns
			WHERE table_name = '%s' AND column_name = '%s'
		`, table, column)))
		return length
	}

	setColLength := func(t *testing.T, table, column string, size int) {
		t.Helper()
		_, alterErr := master.ExecNoTimeout(fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s TYPE VARCHAR(%d)", table, column, size))
		require.NoError(t, alterErr)
	}

	hasMessageIndex := func(t *testing.T) bool {
		t.Helper()
		var count int
		require.NoError(t, master.Get(&count, "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'idx_posts_message_txt'"))
		return count == 1
	}

	restoreTo := func(t *testing.T, size int) {
		t.Helper()
		for _, tc := range targets {
			_, alterErr := master.ExecNoTimeout(fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s TYPE VARCHAR(%d)", tc.table, tc.column, size))
			require.NoError(t, alterErr)
		}
		_, indexErr := master.ExecNoTimeout(recreateIndexSQL)
		require.NoError(t, indexErr)
	}

	t.Run("NormalUpThenDown", func(t *testing.T) {
		t.Cleanup(func() { restoreTo(t, 1048576) })

		for _, tc := range targets {
			setColLength(t, tc.table, tc.column, 65535)
		}

		require.True(t, hasMessageIndex(t), "idx_posts_message_txt should exist before up migration")

		_, err := master.ExecNoTimeout(upSQL)
		require.NoError(t, err, "up migration should succeed")

		for _, tc := range targets {
			assert.Equal(t, 1048576, colLength(t, tc.table, tc.column), "%s.%s after up migration", tc.table, tc.column)
		}
		assert.False(t, hasMessageIndex(t), "up migration should drop idx_posts_message_txt to avoid rebuilding it under lock")

		_, err = master.ExecNoTimeout(recreateIndexSQL)
		require.NoError(t, err, "index recreation migration should succeed")
		assert.True(t, hasMessageIndex(t), "idx_posts_message_txt should be recreated")

		_, err = master.ExecNoTimeout(downSQL)
		require.NoError(t, err, "down migration should succeed")

		for _, tc := range targets {
			assert.Equal(t, 65535, colLength(t, tc.table, tc.column), "%s.%s after down migration", tc.table, tc.column)
		}
	})

	t.Run("UpSkipsWhenAlreadyLarger", func(t *testing.T) {
		t.Cleanup(func() { restoreTo(t, 1048576) })

		for _, tc := range targets {
			setColLength(t, tc.table, tc.column, 2097152)
		}

		_, err := master.ExecNoTimeout(upSQL)
		require.NoError(t, err, "up migration should succeed even when columns are already larger")
		assert.True(t, hasMessageIndex(t), "idx_posts_message_txt should be kept when posts.message is not altered")

		for _, tc := range targets {
			assert.Equal(t, 2097152, colLength(t, tc.table, tc.column), "%s.%s should be unchanged by up migration", tc.table, tc.column)
		}
	})

	t.Run("DownSkipsWhenLargerThanTarget", func(t *testing.T) {
		t.Cleanup(func() { restoreTo(t, 1048576) })

		for _, tc := range targets {
			setColLength(t, tc.table, tc.column, 2097152)
		}

		_, err := master.ExecNoTimeout(downSQL)
		require.NoError(t, err, "down migration should succeed even when columns exceed the target size")

		for _, tc := range targets {
			assert.Equal(t, 2097152, colLength(t, tc.table, tc.column), "%s.%s should be unchanged by down migration", tc.table, tc.column)
		}
	})
}
