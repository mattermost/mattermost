// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils"
)

func TestAsymmetricSigningKey(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()
	assert.NotNil(t, th.App.AsymmetricSigningKey())
	assert.NotEmpty(t, th.App.ClientConfig()["AsymmetricSigningPublicKey"])
}

func TestPostActionCookieSecret(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()
	assert.Equal(t, 32, len(th.App.PostActionCookieSecret()))
}

func TestClientConfigWithComputed(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	config := th.App.Srv().Platform().ClientConfigWithComputed()
	_, ok := config["NoAccounts"]
	assert.True(t, ok, "expected NoAccounts in returned config")
	_, ok = config["MaxPostSize"]
	assert.True(t, ok, "expected MaxPostSize in returned config")
	v, ok := config["SchemaVersion"]
	assert.True(t, ok, "expected SchemaVersion in returned config")
	assert.Equal(t, "1", v)
}

func TestEnsureInstallationDate(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	tt := []struct {
		Name                     string
		PrevInstallationDate     *int64
		UsersCreationDates       []int64
		ExpectedInstallationDate *int64
	}{
		{
			Name:                     "New installation: no users, no installation date",
			PrevInstallationDate:     nil,
			UsersCreationDates:       nil,
			ExpectedInstallationDate: model.NewInt64(utils.MillisFromTime(time.Now())),
		},
		{
			Name:                     "Old installation: users, no installation date",
			PrevInstallationDate:     nil,
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: model.NewInt64(10000000000),
		},
		{
			Name:                     "New installation, second run: no users, installation date",
			PrevInstallationDate:     model.NewInt64(80000000000),
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: model.NewInt64(80000000000),
		},
		{
			Name:                     "Old installation already updated: users, installation date",
			PrevInstallationDate:     model.NewInt64(90000000000),
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: model.NewInt64(90000000000),
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			sqlStore := th.GetSqlStore()
			sqlStore.GetMasterX().Exec("DELETE FROM Users")

			for _, createAt := range tc.UsersCreationDates {
				user := th.CreateUser()
				user.CreateAt = createAt
				sqlStore.GetMasterX().Exec("UPDATE Users SET CreateAt = ? WHERE Id = ?", createAt, user.Id)
			}

			if tc.PrevInstallationDate == nil {
				th.App.Srv().Store().System().PermanentDeleteByName(model.SystemInstallationDateKey)
			} else {
				th.App.Srv().Store().System().SaveOrUpdate(&model.System{
					Name:  model.SystemInstallationDateKey,
					Value: strconv.FormatInt(*tc.PrevInstallationDate, 10),
				})
			}

			err := th.App.Srv().ensureInstallationDate()

			if tc.ExpectedInstallationDate == nil {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				data, err := th.App.Srv().Store().System().GetByName(model.SystemInstallationDateKey)
				assert.NoError(t, err)
				value, _ := strconv.ParseInt(data.Value, 10, 64)
				assert.True(t, *tc.ExpectedInstallationDate <= value && *tc.ExpectedInstallationDate+1000 >= value)
			}

			sqlStore.GetMasterX().Exec("DELETE FROM Users")
		})
	}
}
