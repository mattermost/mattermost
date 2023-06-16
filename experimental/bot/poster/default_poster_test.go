package poster

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster/mock_import"
)

const (
	botID       = "test-bot-user"
	userID      = "test-user-1"
	dmChannelID = "dm-channel-id"
)

func TestInterface(t *testing.T) {
	t.Run("Plugin API satisfy the interface", func(t *testing.T) {
		api := &plugintest.API{}
		driver := &plugintest.Driver{}
		client := pluginapi.NewClient(api, driver)
		_ = NewPoster(&client.Post, botID)
	})
}

func TestDM(t *testing.T) {
	format := "test format, string: %s int: %d value: %v"
	args := []interface{}{"some string", 5, 8.423}
	expectedMessage := "test format, string: some string int: 5 value: 8.423"

	expectedPostID := "expected-post-id"

	post := &model.Post{
		Message: expectedMessage,
	}

	postWithID := model.Post{
		Id:        expectedPostID,
		UserId:    botID,
		ChannelId: dmChannelID,
		Message:   expectedMessage,
	}

	mockError := errors.New("mock error")

	t.Run("DM Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		//nolint:govet //copy lock, but only used in tests
		postAPI.
			EXPECT().
			DM(botID, userID, post).
			SetArg(2, postWithID).
			Return(nil).
			Times(1)

		postID, err := poster.DM(userID, format, args...)
		assert.Equal(t, expectedPostID, postID)
		assert.NoError(t, err)
	})

	t.Run("DM error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			DM(botID, userID, post).
			Return(mockError).
			Times(1)

		_, err := poster.DM(userID, format, args...)
		assert.Error(t, err)
	})
}

func TestDMWithAttachments(t *testing.T) {
	expectedPostID := "expected-post-id"

	attachments := []*model.SlackAttachment{
		{},
		{},
	}

	post := &model.Post{}

	model.ParseSlackAttachment(post, attachments)

	postWithID := model.Post{
		Id:        expectedPostID,
		UserId:    botID,
		ChannelId: dmChannelID,
		Type:      model.PostTypeSlackAttachment,
		Props: model.StringInterface{
			"attachments": attachments,
		},
	}

	mockError := errors.New("mock error")
	t.Run("DM Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		//nolint:govet //copy lock, but only used in tests
		postAPI.
			EXPECT().
			DM(botID, userID, post).
			SetArg(2, postWithID).
			Return(nil).
			Times(1)

		postID, err := poster.DMWithAttachments(userID, attachments...)
		assert.Equal(t, expectedPostID, postID)
		assert.NoError(t, err)
	})

	t.Run("DM error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			DM(botID, userID, post).
			Return(mockError).
			Times(1)

		_, err := poster.DMWithAttachments(userID, attachments...)
		assert.Error(t, err)
	})
}

func TestEphemeral(t *testing.T) {
	format := "test format, string: %s int: %d value: %v"
	args := []interface{}{"some string", 5, 8.423}
	expectedMessage := "test format, string: some string int: 5 value: 8.423"

	channelID := "some-channel"

	post := &model.Post{
		UserId:    botID,
		ChannelId: channelID,
		Message:   expectedMessage,
	}

	expectedPostID := "some-post-ID"

	postWithID := model.Post{
		Id:        expectedPostID,
		UserId:    botID,
		ChannelId: channelID,
		Message:   expectedMessage,
	}

	t.Run("Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		//nolint:govet //copy lock, but only used in tests
		postAPI.
			EXPECT().
			SendEphemeralPost(userID, post).
			SetArg(1, postWithID).
			Times(1)

		poster.Ephemeral(userID, channelID, format, args...)
	})
}

func TestUpdatePostByID(t *testing.T) {
	format := "test format, string: %s int: %d value: %v"
	args := []interface{}{"some string", 5, 8.423}
	expectedMessage := "test format, string: some string int: 5 value: 8.423"

	postID := "some-post-id"
	originalPost := &model.Post{
		Id:      postID,
		Message: "some message",
	}

	updatedPost := &model.Post{
		Id:      postID,
		Message: expectedMessage,
	}

	mockError := errors.New("mock error")

	t.Run("Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			GetPost(postID).
			Return(originalPost, nil).
			Times(1)

		postAPI.
			EXPECT().
			UpdatePost(updatedPost).
			Return(nil).
			Times(1)

		err := poster.UpdatePostByID(postID, format, args...)
		assert.NoError(t, err)
	})

	t.Run("Error fetching", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			GetPost(postID).
			Return(nil, mockError).
			Times(1)

		err := poster.UpdatePostByID(postID, format, args...)
		assert.Error(t, err)
	})

	t.Run("Error updating", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			GetPost(postID).
			Return(originalPost, nil).
			Times(1)

		postAPI.
			EXPECT().
			UpdatePost(updatedPost).
			Return(mockError).
			Times(1)

		err := poster.UpdatePostByID(postID, format, args...)
		assert.Error(t, err)
	})
}

func TestDeletePost(t *testing.T) {
	postID := "some-post-id"

	mockError := errors.New("mock channel error")
	t.Run("Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			DeletePost(postID).
			Return(nil).
			Times(1)

		err := poster.DeletePost(postID)
		assert.NoError(t, err)
	})

	t.Run("Error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			DeletePost(postID).
			Return(mockError).
			Times(1)

		err := poster.DeletePost(postID)
		assert.Error(t, err)
	})
}

func TestUpdatePost(t *testing.T) {
	post := &model.Post{
		Id:      "some-post-id",
		Message: "some message",
	}

	mockError := errors.New("mock channel error")
	t.Run("Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			UpdatePost(post).
			Return(nil).
			Times(1)

		err := poster.UpdatePost(post)
		assert.NoError(t, err)
	})

	t.Run("Error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		postAPI.
			EXPECT().
			UpdatePost(post).
			Return(mockError).
			Times(1)

		err := poster.UpdatePost(post)
		assert.Error(t, err)
	})
}

func TestUpdatePosterID(t *testing.T) {
	format := "test format, string: %s int: %d value: %v"
	args := []interface{}{"some string", 5, 8.423}
	expectedMessage := "test format, string: some string int: 5 value: 8.423"

	expectedPostID := "expected-post-id"

	post := &model.Post{
		Message: expectedMessage,
	}

	postWithID := model.Post{
		Id:        expectedPostID,
		UserId:    botID,
		ChannelId: dmChannelID,
		Message:   expectedMessage,
	}

	newBotID := "new-bot-id"

	t.Run("Success", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		postAPI := mock_import.NewMockPostAPI(ctrl)

		poster := NewPoster(postAPI, botID)

		//nolint:govet //copy lock, but only used in tests
		postAPI.
			EXPECT().
			DM(botID, userID, post).
			SetArg(2, postWithID).
			Return(nil).
			Times(1)

		_, _ = poster.DM(userID, format, args...)
		poster.UpdatePosterID(newBotID)

		//nolint:govet //copy lock, but only used in tests
		postAPI.
			EXPECT().
			DM(newBotID, userID, post).
			SetArg(2, postWithID).
			Return(nil).
			Times(1)

		_, _ = poster.DM(userID, format, args...)
	})
}
