// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func TestAsymmetricSigningKey(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	assert.NotNil(t, th.App.AsymmetricSigningKey())
	assert.NotEmpty(t, th.App.ClientConfig()["AsymmetricSigningPublicKey"])
}

func TestPostActionCookieSecret(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	assert.Equal(t, 32, len(th.App.PostActionCookieSecret()))
}

func TestClientConfigWithComputed(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(model.PostMessageMaxBytesV2, nil)
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
	mainHelper.Parallel(t)
	th := Setup(t)

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
			ExpectedInstallationDate: new(utils.MillisFromTime(time.Now())),
		},
		{
			Name:                     "Old installation: users, no installation date",
			PrevInstallationDate:     nil,
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: new(int64(10000000000)),
		},
		{
			Name:                     "New installation, second run: no users, installation date",
			PrevInstallationDate:     new(int64(80000000000)),
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: new(int64(80000000000)),
		},
		{
			Name:                     "Old installation already updated: users, installation date",
			PrevInstallationDate:     new(int64(90000000000)),
			UsersCreationDates:       []int64{10000000000, 30000000000, 20000000000},
			ExpectedInstallationDate: new(int64(90000000000)),
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			sqlStore := th.GetSqlStore()
			_, err := sqlStore.GetMaster().Exec("DELETE FROM Users")
			assert.NoError(t, err)

			for _, createAt := range tc.UsersCreationDates {
				user := th.CreateUser(t)
				user.CreateAt = createAt
				_, err = sqlStore.GetMaster().Exec("UPDATE Users SET CreateAt = ? WHERE Id = ?", createAt, user.Id)
				assert.NoError(t, err)
			}

			if tc.PrevInstallationDate == nil {
				_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.SystemInstallationDateKey)
				assert.NoError(t, err)
			} else {
				err = th.App.Srv().Store().System().SaveOrUpdate(&model.System{
					Name:  model.SystemInstallationDateKey,
					Value: strconv.FormatInt(*tc.PrevInstallationDate, 10),
				})
				assert.NoError(t, err)
			}

			err = th.App.Srv().ensureInstallationDate()

			if tc.ExpectedInstallationDate == nil {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				var data *model.System
				data, err = th.App.Srv().Store().System().GetByName(model.SystemInstallationDateKey)
				assert.NoError(t, err)
				var value int64
				value, err = strconv.ParseInt(data.Value, 10, 64)
				require.NoError(t, err)
				assert.True(t, *tc.ExpectedInstallationDate <= value && *tc.ExpectedInstallationDate+1000 >= value)
			}

			_, err = sqlStore.GetMaster().Exec("DELETE FROM Users")
			assert.NoError(t, err)
		})
	}
}

func TestAuditLoggingActiveClientConfig(t *testing.T) {
	mainHelper.Parallel(t)

	auditLoggingActive := func(th *TestHelper) string {
		return th.App.Srv().Platform().ClientConfig()["AuditLoggingActive"]
	}
	enableFileAudit := func(t *testing.T) func(cfg *model.Config) {
		auditFile := filepath.Join(t.TempDir(), "audit.log")
		return func(cfg *model.Config) {
			cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
			cfg.ExperimentalAuditSettings.FileName = model.NewPointer(auditFile)
		}
	}
	auditFileTarget := func(t *testing.T, level mlog.Level) mlog.TargetCfg {
		return mlog.TargetCfg{
			Type:    "file",
			Format:  "json",
			Levels:  []mlog.Level{level},
			Options: json.RawMessage(fmt.Sprintf(`{"filename": %q}`, filepath.Join(t.TempDir(), "audit.log"))),
		}
	}
	// Any config change regenerates the client config.
	touchConfig := func(th *TestHelper) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam++ })
	}

	t.Run("file auditing enabled at startup is active", func(t *testing.T) {
		th := SetupConfig(t, enableFileAudit(t))
		require.Equal(t, "true", auditLoggingActive(th))
	})

	t.Run("file auditing enabled after startup is not active until the audit logger applies it", func(t *testing.T) {
		th := Setup(t)
		require.Equal(t, "false", auditLoggingActive(th))

		th.App.UpdateConfig(enableFileAudit(t))
		require.Equal(t, "false", auditLoggingActive(th))
	})

	t.Run("file auditing disabled after startup stays active while the audit logger still writes", func(t *testing.T) {
		th := SetupConfig(t, enableFileAudit(t))

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(false) })
		require.Equal(t, "true", auditLoggingActive(th))
	})

	t.Run("follows the audit logger's targets rather than config", func(t *testing.T) {
		th := SetupConfig(t, enableFileAudit(t))

		require.NoError(t, th.App.Srv().Audit.Configure(mlog.LoggerConfiguration{}))
		touchConfig(th)
		require.Equal(t, "false", auditLoggingActive(th))

		require.NoError(t, th.App.Srv().Audit.Configure(mlog.LoggerConfiguration{"delivery": auditFileTarget(t, mlog.LvlAuditDelivery)}))
		touchConfig(th)
		require.Equal(t, "false", auditLoggingActive(th), "a target bound only to audit-delivery is not general audit logging")

		require.NoError(t, th.App.Srv().Audit.Configure(mlog.LoggerConfiguration{"api": auditFileTarget(t, mlog.LvlAuditAPI)}))
		touchConfig(th)
		require.Equal(t, "true", auditLoggingActive(th))
	})
}

func TestAccessControlAuditTargetMissingWarning(t *testing.T) {
	mainHelper.Parallel(t)

	enableAccessControlAuditLogging := func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAccessControlAuditLogging = model.NewPointer(true)
	}

	t.Run("stays quiet when access control audit logging is off", func(t *testing.T) {
		th := Setup(t)

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlWarn.Name, accessControlAuditTargetMissingWarning)
	})

	t.Run("warns when no audit target is live", func(t *testing.T) {
		th := SetupConfig(t, enableAccessControlAuditLogging)

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, accessControlAuditTargetMissingWarning)
	})

	t.Run("stays quiet when an audit target is live", func(t *testing.T) {
		auditFile := filepath.Join(t.TempDir(), "audit.log")
		th := SetupConfig(t, func(cfg *model.Config) {
			enableAccessControlAuditLogging(cfg)
			cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
			cfg.ExperimentalAuditSettings.FileName = model.NewPointer(auditFile)
		})

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlWarn.Name, accessControlAuditTargetMissingWarning)
	})
}
