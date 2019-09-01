// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
)

func TestEnsureChannel(t *testing.T) {
	setupAPI := func() *plugintest.API {
		return &plugintest.API{}
	}

	testChannel := &model.Channel{
		Id:          model.NewId(),
		TeamId:      model.NewId(),
		Type:        "public",
		Name:        "test_channel",
		DisplayName: "Test Channel",
		Purpose:     "Testing EnsureChannel",
		Header:      "Testing EnsureChannel",
	}

	t.Run("bad parameters", func(t *testing.T) {
		t.Run("no channel", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			channelId, err := p.EnsureChannel(nil)
			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("empty name", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			channelId, err := p.EnsureChannel(&model.Channel{
				Name: "",
			})
			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("name without teamId", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			channelId, err := p.EnsureChannel(&model.Channel{
				Name: "test_channel",
			})
			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("teamId without name", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			channelId, err := p.EnsureChannel(&model.Channel{
				TeamId: model.NewId(),
			})
			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("teamId with empty name", func(t *testing.T) {
			p := &plugin.HelpersImpl{}
			channelId, err := p.EnsureChannel(&model.Channel{
				TeamId: model.NewId(),
			})
			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
	})

	t.Run("if channel already exists in Key Value store", func(t *testing.T) {
		t.Run("should return an error if unable to get channel id", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return an error if unable to get channel", func(t *testing.T) {
			expectedChannelId := model.NewId()

			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return([]byte(expectedChannelId), nil)
			api.On("GetChannel", expectedChannelId).Return(nil, &model.AppError{})

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return an error if unable to update channel", func(t *testing.T) {
			expectedChannelId := model.NewId()

			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return([]byte(expectedChannelId), nil)
			api.On("GetChannel", expectedChannelId).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return the Id of existing channel if metadata is same", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return([]byte(testChannel.Id), nil)
			api.On("GetChannel", testChannel.Id).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(testChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, testChannel.Id, channelId)
			assert.Nil(t, err)
		})
		t.Run("should return error if channel type is different from existing one", func(t *testing.T) {
			privChannel := &model.Channel{
				Id:     model.NewId(),
				Type:   "private",
				TeamId: testChannel.TeamId,
				Name:   testChannel.Name,
			}
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return([]byte(testChannel.Id), nil)
			api.On("GetChannel", testChannel.Id).Return(privChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return the Id of updated channel if metadata is different", func(t *testing.T) {
			updatedChannel := &model.Channel{
				Id:     model.NewId(),
				TeamId: testChannel.TeamId,
				Name:   testChannel.Name,
			}
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return([]byte(testChannel.Id), nil)
			api.On("GetChannel", testChannel.Id).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(updatedChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, updatedChannel.Id, channelId)
			assert.Nil(t, err)
		})
	})

	t.Run("if channel is not in Key Value store but already exists", func(t *testing.T) {
		t.Run("should return an error if unable to get channel", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return the Id of existing channel if metadata is same", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(testChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, testChannel.Id, channelId)
			assert.Nil(t, err)
		})
		t.Run("should return error if failed to update the channel", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should return the Id of updated channel if metadata is different", func(t *testing.T) {
			updatedChannel := &model.Channel{
				Id:     model.NewId(),
				TeamId: testChannel.TeamId,
				Name:   testChannel.Name,
			}
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(testChannel, nil)
			api.On("UpdateChannel", testChannel).Return(updatedChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, updatedChannel.Id, channelId)
			assert.Nil(t, err)
		})
		t.Run("should return error if channel type is different from existing one", func(t *testing.T) {
			privChannel := &model.Channel{
				Id:     model.NewId(),
				Type:   "private",
				TeamId: testChannel.TeamId,
				Name:   testChannel.Name,
			}
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(privChannel, nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
	})

	t.Run("if channel does not exist", func(t *testing.T) {
		t.Run("should create new channel and return the Id", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(nil, nil)
			api.On("CreateChannel", testChannel).Return(testChannel, nil)
			api.On("KVSet", plugin.CHANNEL_KEY, []byte(testChannel.Id)).Return(nil)
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, testChannel.Id, channelId)
			assert.Nil(t, err)
		})
		t.Run("should return error if unable to create new channel", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(nil, nil)
			api.On("CreateChannel", testChannel).Return(nil, &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, "", channelId)
			assert.NotNil(t, err)
		})
		t.Run("should log and return id if unable to write to Key Value store", func(t *testing.T) {
			api := setupAPI()
			api.On("KVGet", plugin.CHANNEL_KEY).Return(nil, nil)
			api.On("GetChannelByName", testChannel.TeamId, testChannel.Name, false).Return(nil, nil)
			api.On("CreateChannel", testChannel).Return(testChannel, nil)
			api.On("KVSet", plugin.CHANNEL_KEY, []byte(testChannel.Id)).Return(&model.AppError{})
			api.On("LogWarn", "Failed to set created channel id.", "channelid", testChannel.Id, "err", &model.AppError{})
			defer api.AssertExpectations(t)

			p := &plugin.HelpersImpl{API: api}

			channelId, err := p.EnsureChannel(testChannel)

			assert.Equal(t, testChannel.Id, channelId)
			assert.Nil(t, err)
		})
	})
}
