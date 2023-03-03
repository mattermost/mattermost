// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/morph/models"
	"github.com/stretchr/testify/require"
)

func TestGetEmbeddedMigrations(t *testing.T) {
	t.Run("should find migrations on the embedded assets", func(t *testing.T) {
		migrations, err := getEmbeddedMigrations()
		require.NoError(t, err)
		require.NotEmpty(t, migrations)
	})
}

func TestFilterMigrations(t *testing.T) {
	migrations := []*models.Migration{
		{Direction: models.Up, Version: 1},
		{Direction: models.Down, Version: 1},
		{Direction: models.Up, Version: 2},
		{Direction: models.Down, Version: 2},
		{Direction: models.Up, Version: 3},
		{Direction: models.Down, Version: 3},
		{Direction: models.Up, Version: 4},
		{Direction: models.Down, Version: 4},
	}

	t.Run("only up migrations should be included", func(t *testing.T) {
		filteredMigrations := filterMigrations(migrations, 4)
		require.Len(t, filteredMigrations, 4)
		for _, migration := range filteredMigrations {
			require.Equal(t, models.Up, migration.Direction)
		}
	})

	t.Run("only migrations below or equal to the legacy schema version should be included", func(t *testing.T) {
		testCases := []struct {
			Name             string
			LegacyVersion    uint32
			ExpectedVersions []uint32
		}{
			{"All should be included", 4, []uint32{1, 2, 3, 4}},
			{"Only half should be included", 2, []uint32{1, 2}},
			{"Three including the third should be included", 3, []uint32{1, 2, 3}},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				filteredMigrations := filterMigrations(migrations, tc.LegacyVersion)
				require.Len(t, filteredMigrations, int(tc.LegacyVersion))

				versions := make([]uint32, len(filteredMigrations))
				for i, migration := range filteredMigrations {
					versions[i] = migration.Version
				}

				require.ElementsMatch(t, versions, tc.ExpectedVersions)
			})
		}
	})

	t.Run("migrations should be included even if they're not sorted", func(t *testing.T) {
		unsortedMigrations := []*models.Migration{
			{Direction: models.Up, Version: 4},
			{Direction: models.Down, Version: 4},
			{Direction: models.Up, Version: 1},
			{Direction: models.Down, Version: 2},
			{Direction: models.Down, Version: 1},
			{Direction: models.Up, Version: 3},
			{Direction: models.Down, Version: 3},
			{Direction: models.Up, Version: 2},
		}

		testCases := []struct {
			Name             string
			LegacyVersion    uint32
			ExpectedVersions []uint32
		}{
			{"All should be included", 4, []uint32{1, 2, 3, 4}},
			{"Only half should be included", 2, []uint32{1, 2}},
			{"Three including the third should be included", 3, []uint32{1, 2, 3}},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				filteredMigrations := filterMigrations(unsortedMigrations, tc.LegacyVersion)
				require.Len(t, filteredMigrations, int(tc.LegacyVersion))

				versions := make([]uint32, len(filteredMigrations))
				for i, migration := range filteredMigrations {
					versions[i] = migration.Version
				}

				require.ElementsMatch(t, versions, tc.ExpectedVersions)
			})
		}
	})
}
