// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	storeMocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry/mocks"
)

func TestEnsureServerID(t *testing.T) {
	t.Run("test ID in database and does not run twice", func(t *testing.T) {
		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}
		returnValue := &model.System{
			Name:  model.SystemServerId,
			Value: "test",
		}
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(returnValue, nil).Once()

		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}

		testLogger, _ := mlog.NewLogger()

		telemetryService, err := New(serverIfaceMock, storeMock, testLogger)
		require.NoError(t, err)

		assert.Equal(t, "test", telemetryService.ServerID)

		telemetryService.ensureServerID()
		assert.Equal(t, "test", telemetryService.ServerID)

		// No more calls to the store if we try to ensure it again
		telemetryService.ensureServerID()
		assert.Equal(t, "test", telemetryService.ServerID)
	})

	t.Run("new test ID created", func(t *testing.T) {
		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}
		returnValue := &model.System{
			Name: model.SystemServerId,
		}

		var generatedID string
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(returnValue, nil).Once().Run(func(args mock.Arguments) {
			s := args.Get(0).(*model.System)
			returnValue.Value = s.Value
			generatedID = s.Value
		})
		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}

		testLogger, _ := mlog.NewLogger()

		telemetryService, err := New(serverIfaceMock, storeMock, testLogger)
		require.NoError(t, err)

		assert.Equal(t, generatedID, telemetryService.ServerID)
	})

	t.Run("fail to save test ID", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping test in short mode.")
		}

		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}

		insertError := errors.New("insert error")
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(nil, insertError).Times(DBAccessAttempts)

		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}

		testLogger, _ := mlog.NewLogger()

		_, err := New(serverIfaceMock, storeMock, testLogger)
		require.Error(t, err)
	})
}
