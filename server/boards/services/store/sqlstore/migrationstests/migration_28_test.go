// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/sqlstore"
	"github.com/mgdelacroix/foundation"
	"github.com/stretchr/testify/require"
)

func Test28RemoveTemplateChannelLink(t *testing.T) {
	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("should correctly remove the channel link from templates", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(27).
				ExecFile("./fixtures/test28RemoveTemplateChannelLink.sql")

			// first we check that the data has the expected shape
			board := struct {
				ID          string
				Is_template bool
				Channel_id  string
			}{}

			template := struct {
				ID          string
				Is_template bool
				Channel_id  string
			}{}

			bErr := th.f.DB().Get(&board, "SELECT id, is_template, channel_id FROM focalboard_boards WHERE id = 'board-id'")
			require.NoError(t, bErr)
			require.False(t, board.Is_template)
			require.Equal(t, "linked-channel", board.Channel_id)

			tErr := th.f.DB().Get(&template, "SELECT id, is_template, channel_id FROM focalboard_boards WHERE id = 'template-id'")
			require.NoError(t, tErr)
			require.True(t, template.Is_template)
			require.Equal(t, "linked-channel", template.Channel_id)

			// we apply the migration
			th.f.MigrateToStep(28)

			// then we reuse the structs to load again the data and check
			// that the changes were correctly applied
			bErr = th.f.DB().Get(&board, "SELECT id, is_template, channel_id FROM focalboard_boards WHERE id = 'board-id'")
			require.NoError(t, bErr)
			require.False(t, board.Is_template)
			require.Equal(t, "linked-channel", board.Channel_id)

			tErr = th.f.DB().Get(&template, "SELECT id, is_template, channel_id FROM focalboard_boards WHERE id = 'template-id'")
			require.NoError(t, tErr)
			require.True(t, template.Is_template)
			require.Empty(t, template.Channel_id)
		})
	})
}
