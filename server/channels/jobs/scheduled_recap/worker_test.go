// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduled_recap

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockScheduledRecapApp struct {
	mock.Mock
}

func (m *mockScheduledRecapApp) CreateRecapFromSchedule(rctx request.CTX, scheduledRecap *model.ScheduledRecap) (*model.Recap, *model.AppError) {
	args := m.Called(rctx, scheduledRecap)
	if args.Get(0) == nil {
		return nil, args.Get(1).(*model.AppError)
	}
	return args.Get(0).(*model.Recap), nil
}

func TestProcessScheduledRecapJobReturnsPersistenceErrors(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("mark executed failure", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(true)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(errors.New("mark failed"))

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(&model.Recap{Id: model.NewId()}, nil)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to mark scheduled recap as executed")
		mockScheduledStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})

	t.Run("non recurring disable failure", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(false)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockScheduledStore.On("SetEnabled", scheduledRecap.Id, false).Return(errors.New("disable failed"))

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(&model.Recap{Id: model.NewId()}, nil)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to disable non-recurring scheduled recap")
		mockScheduledStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})
}

func TestProcessScheduledRecapJobDailyLimitSkip(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	limitErr := model.NewAppError("CreateRecapFromSchedule", "app.recap.max_recaps_reached.app_error", nil, "", 429)

	t.Run("recurring schedule advances but stays enabled", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(true)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockStore.On("Recap").Return(mockRecapStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockRecapStore.On("SaveRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.Status == model.RecapStatusSkipped && r.ScheduledRecapId == scheduledRecap.Id
		})).Return(&model.Recap{}, nil)

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(nil, limitErr)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.NoError(t, err)
		mockScheduledStore.AssertExpectations(t)
		mockRecapStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
		// A recurring schedule must not be disabled on the skip path.
		mockScheduledStore.AssertNotCalled(t, "SetEnabled", mock.Anything, mock.Anything)
	})

	t.Run("non recurring schedule is disabled on skip", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(false)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockStore.On("Recap").Return(mockRecapStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockScheduledStore.On("SetEnabled", scheduledRecap.Id, false).Return(nil)
		mockRecapStore.On("SaveRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.Status == model.RecapStatusSkipped && r.ScheduledRecapId == scheduledRecap.Id
		})).Return(&model.Recap{}, nil)

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(nil, limitErr)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.NoError(t, err)
		mockScheduledStore.AssertExpectations(t)
		mockRecapStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})
}

func testScheduledRecap(isRecurring bool) *model.ScheduledRecap {
	return &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      model.NewId(),
		Title:       "Scheduled Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		Timezone:    "America/New_York",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{model.NewId()},
		AgentId:     "test-agent",
		IsRecurring: isRecurring,
		Enabled:     true,
	}
}
