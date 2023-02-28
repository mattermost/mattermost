package app

import (
	"database/sql"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

func TestGetSharing(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("should get a sharing successfully", func(t *testing.T) {
		want := &model.Sharing{
			ID:         utils.NewID(utils.IDTypeBlock),
			Enabled:    true,
			Token:      "token",
			ModifiedBy: "otherid",
			UpdateAt:   utils.GetMillis(),
		}
		th.Store.EXPECT().GetSharing("test-id").Return(want, nil)

		result, err := th.App.GetSharing("test-id")
		require.NoError(t, err)

		require.Equal(t, result, want)
		require.NotNil(t, th.App)
	})

	t.Run("should fail to get a sharing", func(t *testing.T) {
		th.Store.EXPECT().GetSharing("test-id").Return(
			nil,
			errors.New("sharing not found"),
		)
		result, err := th.App.GetSharing("test-id")

		require.Nil(t, result)
		require.Error(t, err)
		require.Equal(t, "sharing not found", err.Error())
	})

	t.Run("should return a not found error", func(t *testing.T) {
		th.Store.EXPECT().GetSharing("test-id").Return(
			nil,
			sql.ErrNoRows,
		)
		result, err := th.App.GetSharing("test-id")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, result)
	})
}

func TestUpsertSharing(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	sharing := model.Sharing{
		ID:         utils.NewID(utils.IDTypeBlock),
		Enabled:    true,
		Token:      "token",
		ModifiedBy: "otherid",
		UpdateAt:   utils.GetMillis(),
	}

	t.Run("should success to upsert sharing", func(t *testing.T) {
		th.Store.EXPECT().UpsertSharing(sharing).Return(nil)
		err := th.App.UpsertSharing(sharing)

		require.NoError(t, err)
	})

	t.Run("should fail to upsert a sharing", func(t *testing.T) {
		th.Store.EXPECT().UpsertSharing(sharing).Return(errors.New("sharing not found"))
		err := th.App.UpsertSharing(sharing)

		require.Error(t, err)
		require.Equal(t, "sharing not found", err.Error())
	})
}
