package migrationstests

import "testing"

func Test35AddHIddenColumnToCategoryBoards(t *testing.T) {
	t.Run("base case - column doesn't already exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(35)
	})

	t.Run("column already exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.f.MigrateToStep(34).
			ExecFile("./fixtures/test35_add_hidden_column.sql")

		th.f.MigrateToStep(35)
	})
}
