package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pluginapi"
)

func TestCreatePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedPost := &model.Post{
			Id: "postID",
		}
		api.On("CreatePost", expectedPost).Return(expectedPost, nil)

		actualPost, err := client.Post.CreatePost(expectedPost)
		require.NoError(t, err)
		assert.Equal(t, expectedPost, actualPost)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedPost := &model.Post{
			Id: "postID",
		}
		api.On("CreatePost", expectedPost).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPost, err := client.Post.CreatePost(expectedPost)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPost)
	})
}

func TestGetPost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		expectedPost := &model.Post{
			Id: postID,
		}
		api.On("GetPost", postID).Return(expectedPost, nil)

		actualPost, err := client.Post.GetPost(postID)
		require.NoError(t, err)
		assert.Equal(t, expectedPost, actualPost)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		api.On("GetPost", postID).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPost, err := client.Post.GetPost(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPost)
	})
}

func TestUpdatePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedPost := &model.Post{
			Id: "postID",
		}
		api.On("UpdatePost", expectedPost).Return(expectedPost, nil)

		actualPost, err := client.Post.UpdatePost(expectedPost)
		require.NoError(t, err)
		assert.Equal(t, expectedPost, actualPost)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedPost := &model.Post{
			Id: "postID",
		}
		api.On("UpdatePost", expectedPost).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPost, err := client.Post.UpdatePost(expectedPost)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPost)
	})
}

func TestDeletePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"

		api.On("DeletePost", postID).Return(nil)

		err := client.Post.DeletePost(postID)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		api.On("DeletePost", postID).Return(model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		err := client.Post.DeletePost(postID)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestSendEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api)

	userID := "userID"
	expectedPost := &model.Post{
		Id: "postID",
	}
	api.On("SendEphemeralPost", userID, expectedPost).Return(expectedPost, nil)

	actualPost := client.Post.SendEphemeralPost(userID, expectedPost)
	assert.Equal(t, expectedPost, actualPost)
}

func TestUpdateEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api)

	userID := "userID"
	expectedPost := &model.Post{
		Id: "postID",
	}
	api.On("UpdateEphemeralPost", userID, expectedPost).Return(expectedPost, nil)

	actualPost := client.Post.UpdateEphemeralPost(userID, expectedPost)
	assert.Equal(t, expectedPost, actualPost)
}

func TestDeleteEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api)

	userID := "userID"
	postID := "postID"
	api.On("DeleteEphemeralPost", userID, postID).Return()

	client.Post.DeleteEphemeralPost(userID, postID)
}

func TestGetPostThread(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		expectedPostList := model.NewPostList()
		expectedPostList.AddPost(&model.Post{Id: postID})

		api.On("GetPostThread", postID).Return(expectedPostList, nil)

		actualPostList, err := client.Post.GetPostThread(postID)
		require.NoError(t, err)
		assert.Equal(t, expectedPostList, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		api.On("GetPostThread", postID).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.GetPostThread(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsSince(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		time := int64(0)
		expectedPostList := model.NewPostList()
		expectedPostList.AddPost(&model.Post{ChannelId: channelID})

		api.On("GetPostsSince", channelID, time).Return(expectedPostList, nil)

		actualPostList, err := client.Post.GetPostsSince(channelID, time)
		require.NoError(t, err)
		assert.Equal(t, expectedPostList, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		time := int64(0)
		api.On("GetPostsSince", channelID, time).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.GetPostsSince(channelID, time)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsAfter(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		postID := "postID"
		expectedPostList := model.NewPostList()
		expectedPostList.AddPost(&model.Post{ChannelId: channelID})

		api.On("GetPostsAfter", channelID, postID, 0, 0).Return(expectedPostList, nil)

		actualPostList, err := client.Post.GetPostsAfter(channelID, postID, 0, 0)
		require.NoError(t, err)
		assert.Equal(t, expectedPostList, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		postID := "postID"
		api.On("GetPostsAfter", channelID, postID, 0, 0).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.GetPostsAfter(channelID, postID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsBefore(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		postID := "postID"
		expectedPostList := model.NewPostList()
		expectedPostList.AddPost(&model.Post{ChannelId: channelID})

		api.On("GetPostsBefore", channelID, postID, 0, 0).Return(expectedPostList, nil)

		actualPostList, err := client.Post.GetPostsBefore(channelID, postID, 0, 0)
		require.NoError(t, err)
		assert.Equal(t, expectedPostList, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		postID := "postID"
		api.On("GetPostsBefore", channelID, postID, 0, 0).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.GetPostsBefore(channelID, postID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsForChannel(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		expectedPostList := model.NewPostList()
		expectedPostList.AddPost(&model.Post{ChannelId: channelID})

		api.On("GetPostsForChannel", channelID, 0, 0).Return(expectedPostList, nil)

		actualPostList, err := client.Post.GetPostsForChannel(channelID, 0, 0)
		require.NoError(t, err)
		assert.Equal(t, expectedPostList, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		channelID := "channelID"
		api.On("GetPostsForChannel", channelID, 0, 0).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.GetPostsForChannel(channelID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestSearchPostsInTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		teamID := "teamID"
		searchParams := []*model.SearchParams{{InChannels: []string{"channelID"}}}
		expectedPosts := []*model.Post{{ChannelId: "channelID"}}
		api.On("SearchPostsInTeam", teamID, searchParams).Return(expectedPosts, nil)

		actualPostList, err := client.Post.SearchPostsInTeam(teamID, searchParams)
		require.NoError(t, err)
		assert.Equal(t, expectedPosts, actualPostList)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		teamID := "teamID"
		searchParams := []*model.SearchParams{{InChannels: []string{"channelID"}}}
		api.On("SearchPostsInTeam", teamID, searchParams).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualPostList, err := client.Post.SearchPostsInTeam(teamID, searchParams)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestAddReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedReaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", expectedReaction).Return(expectedReaction, nil)

		actualReaction, err := client.Post.AddReaction(expectedReaction)
		require.NoError(t, err)
		assert.Equal(t, expectedReaction, actualReaction)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		expectedReaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", expectedReaction).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.Post.AddReaction(expectedReaction)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetReactions(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		expectedReactions := []*model.Reaction{
			{PostId: postID, UserId: "user1"},
			{PostId: postID, UserId: "user2"},
		}
		api.On("GetReactions", postID).Return(expectedReactions, nil)

		actualReactions, err := client.Post.GetReactions(postID)
		require.NoError(t, err)
		assert.Equal(t, expectedReactions, actualReactions)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		postID := "postID"
		api.On("GetReactions", postID).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualReactions, err := client.Post.GetReactions(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualReactions)
	})
}

func TestDeleteReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		reaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("RemoveReaction", reaction).Return(nil)

		err := client.Post.RemoveReaction(reaction)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		reaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("RemoveReaction", reaction).Return(model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		err := client.Post.RemoveReaction(reaction)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}
