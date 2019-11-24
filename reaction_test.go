package pluginapi

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedReaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", expectedReaction).Return(expectedReaction, nil)

		actualReaction, err := client.Reaction.AddReaction(expectedReaction)
		require.NoError(t, err)
		assert.Equal(t, expectedReaction, actualReaction)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedReaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", expectedReaction).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.Reaction.AddReaction(expectedReaction)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetReactions(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		postID := "postID"
		expectedReactions := []*model.Reaction{
			{PostId: postID, UserId: "user1"},
			{PostId: postID, UserId: "user2"},
		}
		api.On("GetReactions", postID).Return(expectedReactions, nil)

		actualReactions, err := client.Reaction.GetReactions(postID)
		require.NoError(t, err)
		assert.Equal(t, expectedReactions, actualReactions)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		postID := "postID"
		api.On("GetReactions", postID).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualReactions, err := client.Reaction.GetReactions(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualReactions)
	})
}

func TestDeleteReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		reaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("RemoveReaction", reaction).Return(nil)

		err := client.Reaction.RemoveReaction(reaction)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		reaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("RemoveReaction", reaction).Return(model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		err := client.Reaction.RemoveReaction(reaction)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}
