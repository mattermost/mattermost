// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"os"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions/localpermissions"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/mockstore"

	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

type TestHelperMockStore struct {
	Server *Server
	Store  *mockstore.MockStore
}

func SetupTestHelperMockStore(t *testing.T) (*TestHelperMockStore, func()) {
	th := &TestHelperMockStore{}

	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	ctrl := gomock.NewController(t)
	mockStore := mockstore.NewMockStore(ctrl)

	tearDown := func() {
		defer ctrl.Finish()
		os.Setenv("FOCALBOARD_UNIT_TESTING", origUnitTesting)
	}

	th.Server = newTestServerMock(mockStore)
	th.Store = mockStore

	return th, tearDown
}

func newTestServerMock(mockStore *mockstore.MockStore) *Server {
	config := &config.Configuration{
		EnableDataRetention: false,
		DataRetentionDays:   10,
		FilesDriver:         "local",
		FilesPath:           "./files",
		WebPath:             "/",
	}

	logger := mlog.CreateConsoleTestLogger(true, mlog.LvlDebug)

	mockStore.EXPECT().GetTeam(gomock.Any()).Return(nil, nil).AnyTimes()
	mockStore.EXPECT().UpsertTeamSignupToken(gomock.Any()).AnyTimes()
	mockStore.EXPECT().GetSystemSettings().AnyTimes()
	mockStore.EXPECT().SetSystemSetting(gomock.Any(), gomock.Any()).AnyTimes()

	permissionsService := localpermissions.New(mockStore, logger)

	srv, err := New(Params{
		Cfg:                config,
		DBStore:            mockStore,
		Logger:             logger,
		PermissionsService: permissionsService,
	})
	if err != nil {
		panic(err)
	}

	return srv
}

func TestRunDataRetention(t *testing.T) {
	th, tearDown := SetupTestHelperMockStore(t)
	defer tearDown()

	b := &BoardsService{
		server: th.Server,
		logger: mlog.CreateConsoleTestLogger(true, mlog.LvlError),
	}

	now := time.Now().UnixNano()

	t.Run("test null license", func(t *testing.T) {
		th.Store.EXPECT().GetLicense().Return(nil)
		_, err := b.RunDataRetention(now, 10)
		assert.Error(t, err)
		assert.Equal(t, ErrInsufficientLicense, err)
	})

	t.Run("test invalid license", func(t *testing.T) {
		falseValue := false

		th.Store.EXPECT().GetLicense().Return(
			&model.License{
				Features: &model.Features{
					DataRetention: &falseValue,
				},
			},
		)
		_, err := b.RunDataRetention(now, 10)
		assert.Error(t, err)
		assert.Equal(t, ErrInsufficientLicense, err)
	})

	t.Run("test valid license, invalid config", func(t *testing.T) {
		trueValue := true
		th.Store.EXPECT().GetLicense().Return(
			&model.License{
				Features: &model.Features{
					DataRetention: &trueValue,
				},
			})

		count, err := b.RunDataRetention(now, 10)
		assert.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("test valid license, valid config", func(t *testing.T) {
		trueValue := true
		th.Store.EXPECT().GetLicense().Return(
			&model.License{
				Features: &model.Features{
					DataRetention: &trueValue,
				},
			})

		th.Store.EXPECT().RunDataRetention(gomock.Any(), int64(10)).Return(int64(100), nil)
		b.server.Config().EnableDataRetention = true

		count, err := b.RunDataRetention(now, 10)

		assert.NoError(t, err)
		assert.Equal(t, int64(100), count)
	})
}
