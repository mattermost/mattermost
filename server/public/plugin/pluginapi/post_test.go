package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"
)

func TestCreatePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		id := model.NewId()
		in := &model.Post{
			Id: "postID",
		}
		out := in.Clone()
		out.Id = id
		api.On("CreatePost", in).Return(out, nil)

		err := client.Post.CreatePost(in)
		require.NoError(t, err)
		assert.Equal(t, out, in)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		in := &model.Post{
			Id: "postID",
		}
		out := in.Clone()
		api.On("CreatePost", in).Return(nil, newAppError())

		err := client.Post.CreatePost(in)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Equal(t, out, in)
	})
}

func TestGetPost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		postID := "postID"
		api.On("GetPost", postID).Return(nil, newAppError())

		actualPost, err := client.Post.GetPost(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPost)
	})
}

func TestUpdatePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		now := model.GetMillis()
		in := &model.Post{
			Id: "postID",
		}
		out := in.Clone()
		out.UpdateAt = now
		api.On("UpdatePost", in).Return(out, nil)

		err := client.Post.UpdatePost(in)
		require.NoError(t, err)
		require.Equal(t, out, in)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		in := &model.Post{
			Id: "postID",
		}
		out := in.Clone()
		api.On("UpdatePost", in).Return(nil, newAppError())

		err := client.Post.UpdatePost(in)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Equal(t, out, in)
	})
}

func TestDeletePost(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		postID := "postID"

		api.On("DeletePost", postID).Return(nil)

		err := client.Post.DeletePost(postID)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		postID := "postID"
		api.On("DeletePost", postID).Return(newAppError())

		err := client.Post.DeletePost(postID)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestSendEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	userID := "userID"
	expectedPost := &model.Post{
		Id: "postID",
	}
	api.On("SendEphemeralPost", userID, expectedPost).Return(expectedPost, nil)

	client.Post.SendEphemeralPost(userID, expectedPost)
}

func TestUpdateEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	now := model.GetMillis()
	userID := "userID"
	in := &model.Post{
		Id: "postID",
	}
	out := in.Clone()
	out.UpdateAt = now
	api.On("UpdateEphemeralPost", userID, in).Return(out, nil)

	client.Post.UpdateEphemeralPost(userID, in)
	assert.Equal(t, out, in)
}

func TestDeleteEphemeralPost(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	userID := "userID"
	postID := "postID"
	api.On("DeleteEphemeralPost", userID, postID).Return()

	client.Post.DeleteEphemeralPost(userID, postID)
}

func TestGetPostThread(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		postID := "postID"
		api.On("GetPostThread", postID).Return(nil, newAppError())

		actualPostList, err := client.Post.GetPostThread(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsSince(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		channelID := "channelID"
		time := int64(0)
		api.On("GetPostsSince", channelID, time).Return(nil, newAppError())

		actualPostList, err := client.Post.GetPostsSince(channelID, time)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsAfter(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		channelID := "channelID"
		postID := "postID"
		api.On("GetPostsAfter", channelID, postID, 0, 0).Return(nil, newAppError())

		actualPostList, err := client.Post.GetPostsAfter(channelID, postID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsBefore(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		channelID := "channelID"
		postID := "postID"
		api.On("GetPostsBefore", channelID, postID, 0, 0).Return(nil, newAppError())

		actualPostList, err := client.Post.GetPostsBefore(channelID, postID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestGetPostsForChannel(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		channelID := "channelID"
		api.On("GetPostsForChannel", channelID, 0, 0).Return(nil, newAppError())

		actualPostList, err := client.Post.GetPostsForChannel(channelID, 0, 0)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestSearchPostsInTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		teamID := "teamID"
		searchParams := []*model.SearchParams{{InChannels: []string{"channelID"}}}
		api.On("SearchPostsInTeam", teamID, searchParams).Return(nil, newAppError())

		actualPostList, err := client.Post.SearchPostsInTeam(teamID, searchParams)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualPostList)
	})
}

func TestAddReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		in := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", in).Return(in, nil)

		err := client.Post.AddReaction(in)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		in := &model.Reaction{
			PostId: "postId",
		}
		api.On("AddReaction", in).Return(nil, newAppError())

		err := client.Post.AddReaction(in)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestGetReactions(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		postID := "postID"
		api.On("GetReactions", postID).Return(nil, newAppError())

		actualReactions, err := client.Post.GetReactions(postID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualReactions)
	})
}

func TestDeleteReaction(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

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
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		reaction := &model.Reaction{
			PostId: "postId",
		}
		api.On("RemoveReaction", reaction).Return(newAppError())

		err := client.Post.RemoveReaction(reaction)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestSearchTeamPosts(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("SearchPostsInTeam", "1", []*model.SearchParams{{Terms: "2"}, {Terms: "3"}}).
			Return([]*model.Post{{Id: "3"}, {Id: "4"}}, nil)

		posts, err := client.Post.SearchPostsInTeam("1", []*model.SearchParams{{Terms: "2"}, {Terms: "3"}})
		require.NoError(t, err)
		require.Equal(t, []*model.Post{{Id: "3"}, {Id: "4"}}, posts)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("SearchPostsInTeam", "1", []*model.SearchParams{{Terms: "2"}, {Terms: "3"}}).
			Return(nil, appErr)

		posts, err := client.Post.SearchPostsInTeam("1", []*model.SearchParams{{Terms: "2"}, {Terms: "3"}})
		require.Equal(t, appErr, err)
		require.Len(t, posts, 0)
	})
}

func TestShouldProcessMessage(t *testing.T) {
	expectedBotID := model.NewId()

	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	t.Run("should not respond to itself", func(t *testing.T) {
		api := setupAPI()
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{Type: model.PostTypeHeaderChange, UserId: expectedBotID},
			pluginapi.AllowSystemMessages(),
			pluginapi.AllowBots(),
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should not process as the post is generated by system", func(t *testing.T) {
		api := setupAPI()
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{Type: model.PostTypeHeaderChange},
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should not process as the post is sent to another channel", func(t *testing.T) {
		channelID := "channel-id"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID}, pluginapi.AllowSystemMessages(),
			pluginapi.AllowBots(),
			pluginapi.FilterChannelIDs([]string{"another-channel-id"}),
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should not process as the post is created by bot", func(t *testing.T) {
		userID := "user-id"
		channelID := "1"
		api := setupAPI()
		api.On("GetUser", userID).Return(&model.User{IsBot: true}, nil)
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{UserId: userID, ChannelId: channelID},
			pluginapi.AllowSystemMessages(),
			pluginapi.FilterUserIDs([]string{"another-user-id"}),
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should not process the message as the post is not in bot dm channel", func(t *testing.T) {
		userID := "user-id"
		channelID := "1"
		channel := model.Channel{
			Name: "user1__" + expectedBotID,
			Type: model.ChannelTypeOpen,
		}
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&channel, nil)
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{UserId: userID, ChannelId: channelID},
			pluginapi.AllowSystemMessages(),
			pluginapi.AllowBots(),
			pluginapi.OnlyBotDMs(),
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should process the message", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{UserId: "1", Type: model.PostTypeHeaderChange, ChannelId: channelID},
			pluginapi.AllowSystemMessages(),
			pluginapi.FilterChannelIDs([]string{channelID}),
			pluginapi.AllowBots(),
			pluginapi.FilterUserIDs([]string{"1"}),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should process the message for plugin without a bot", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("KVGet", plugin.BotUserKey).Return(nil, nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{UserId: "1", Type: model.PostTypeHeaderChange, ChannelId: channelID},
			pluginapi.AllowSystemMessages(),
			pluginapi.FilterChannelIDs([]string{channelID}),
			pluginapi.AllowBots(),
			pluginapi.FilterUserIDs([]string{"1"}),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should process the message when filter channel and filter users list is empty", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		channel := model.Channel{
			Name: "user1__" + expectedBotID,
			Type: model.ChannelTypeDirect,
		}
		api.On("GetChannel", channelID).Return(&channel, nil)
		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{UserId: "1", Type: model.PostTypeHeaderChange, ChannelId: channelID},
			pluginapi.AllowSystemMessages(),
			pluginapi.AllowBots(),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should not process the message which have from_webhook", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)

		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)

		client := pluginapi.NewClient(api, &plugintest.Driver{})
		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID, Props: model.StringInterface{"from_webhook": "true"}},
			pluginapi.AllowBots(),
		)

		assert.NoError(t, err)
		assert.False(t, shouldProcessMessage)
	})

	t.Run("should process the message which have from_webhook with allow webhook plugin", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)

		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID, Props: model.StringInterface{"from_webhook": "true"}},
			pluginapi.AllowBots(),
			pluginapi.AllowWebhook(),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should process the message where from_webhook is not set", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)

		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID},
			pluginapi.AllowBots(),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should process the message which have from_webhook false", func(t *testing.T) {
		channelID := "1"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)

		api.On("KVGet", plugin.BotUserKey).Return([]byte(expectedBotID), nil)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID, Props: model.StringInterface{"from_webhook": "false"}},
			pluginapi.AllowBots(),
		)

		assert.NoError(t, err)
		assert.True(t, shouldProcessMessage)
	})

	t.Run("should process the message when we pass the botId as input", func(t *testing.T) {
		userID := "user-id"
		channelID := "1"
		api := setupAPI()
		api.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Type: model.ChannelTypeGroup}, nil)

		api.On("GetUser", userID).Return(&model.User{IsBot: false}, nil)

		client := pluginapi.NewClient(api, &plugintest.Driver{})

		shouldProcessMessage, err := client.Post.ShouldProcessMessage(
			&model.Post{ChannelId: channelID, UserId: userID},
			pluginapi.BotID(expectedBotID),
		)
		assert.NoError(t, err)

		assert.True(t, shouldProcessMessage)
	})
}
