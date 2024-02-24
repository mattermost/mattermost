package combine_desktop_mobile_user_threads_setting

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobMetadata(t *testing.T) {
	t.Run("data is nil", func(t *testing.T) {
		var data model.StringMap
		userID, createAt, err := parseJobMetadata(data)

		require.NoError(t, err)
		assert.Empty(t, userID)
		assert.Empty(t, createAt)
	})

	t.Run("data is empty", func(t *testing.T) {
		data := model.StringMap{}
		userID, createAt, err := parseJobMetadata(data)

		require.NoError(t, err)
		assert.Empty(t, userID)
		assert.Empty(t, createAt)
	})

	t.Run("data is missing create_at", func(t *testing.T) {
		data := model.StringMap{
			"user_id": "user_id",
		}
		userID, createAt, err := parseJobMetadata(data)

		require.NoError(t, err)
		assert.Equal(t, "user_id", userID)
		assert.Empty(t, createAt)
	})

	t.Run("data is missing user_id", func(t *testing.T) {
		data := model.StringMap{
			"create_at": "123",
		}
		userID, createAt, err := parseJobMetadata(data)

		require.NoError(t, err)
		assert.Empty(t, userID)
		assert.Equal(t, int64(123), createAt)
	})

	t.Run("data is valid", func(t *testing.T) {
		data := model.StringMap{
			"user_id":   "user_id",
			"create_at": "123",
		}
		userID, createAt, err := parseJobMetadata(data)

		require.NoError(t, err)
		assert.Equal(t, "user_id", userID)
		assert.Equal(t, int64(123), createAt)
	})
}
