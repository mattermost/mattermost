package migrationstests

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test38RemoveHiddenBoardIDsFromPreferences(t *testing.T) {
	t.Run("standalone - no data exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(38)
	})

	t.Run("plugin - no data exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(38)
	})

	t.Run("standalone - some data exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(37).
			ExecFile("./fixtures/test38_add_standalone_preferences.sql")

		// verify existing data count
		var count int
		countQuery := "SELECT COUNT(*) FROM focalboard_preferences"
		err := th.f.DB().Get(&count, countQuery)
		require.NoError(t, err)
		require.Equal(t, 4, count)

		th.f.MigrateToStep(38)

		// now the count should be 0
		err = th.f.DB().Get(&count, countQuery)
		require.NoError(t, err)
		require.Equal(t, 2, count)
	})

	t.Run("plugin - some data exist", func(t *testing.T) {
		th, tearDown := SetupPluginTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(37).
			ExecFile("./fixtures/test38_add_plugin_preferences.sql")

		// verify existing data count
		var count int
		countQuery := "SELECT COUNT(*) FROM Preferences"
		err := th.f.DB().Get(&count, countQuery)
		require.NoError(t, err)
		require.Equal(t, 4, count)

		th.f.MigrateToStep(38)

		// now the count should be 0
		err = th.f.DB().Get(&count, countQuery)
		require.NoError(t, err)
		require.Equal(t, 2, count)
	})
}
