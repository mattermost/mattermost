// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type MockAppIface struct {
	mock.Mock
}

func (m *MockAppIface) ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError) {
	args := m.Called(rctx, recapID, channelID, userID, agentID)
	if args.Get(0) == nil {
		return nil, args.Get(1).(*model.AppError)
	}
	return args.Get(0).(*model.RecapChannelResult), nil
}

func (m *MockAppIface) Publish(message *model.WebSocketEvent) {
	m.Called(message)
}

func TestProcessRecapJob(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{
		Data: map[string]string{
			"recap_id":    "recap1",
			"user_id":     "user1",
			"channel_ids": "channel1,channel2",
			"agent_id":    "agent1",
		},
	}

	t.Run("successful processing", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		// Setup expectations
		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()

		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel1", "user1", "agent1").Return(&model.RecapChannelResult{
			ChannelID:    "channel1",
			Success:      true,
			MessageCount: 10,
		}, nil)

		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel2", "user1", "agent1").Return(&model.RecapChannelResult{
			ChannelID:    "channel2",
			Success:      true,
			MessageCount: 5,
		}, nil)

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 15 && r.Status == model.RecapStatusCompleted
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, nil)
		require.NoError(t, err)
	})

	t.Run("partial failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()

		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel1", "user1", "agent1").Return(&model.RecapChannelResult{
			ChannelID:    "channel1",
			Success:      true,
			MessageCount: 10,
		}, nil)

		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel2", "user1", "agent1").Return(nil, model.NewAppError("fail", "fail", nil, "", 500))

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 10 && r.Status == model.RecapStatusCompleted
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, nil)
		require.NoError(t, err)
	})

	t.Run("complete failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()

		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel1", "user1", "agent1").Return(nil, model.NewAppError("fail", "fail", nil, "", 500))
		mockApp.On("ProcessRecapChannel", mock.Anything, "recap1", "channel2", "user1", "agent1").Return(nil, model.NewAppError("fail", "fail", nil, "", 500))

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 0 && r.Status == model.RecapStatusFailed
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, nil)
		require.Error(t, err)
		require.Equal(t, "all channels failed to process", err.Error())
	})
}
