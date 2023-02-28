// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/channels/config"
	"github.com/mattermost/mattermost-server/v6/channels/product"
	storeMocks "github.com/mattermost/mattermost-server/v6/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/platform/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/platform/services/telemetry/mocks"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
)

type FakeConfigService struct {
	cfg *model.Config
}

type testTelemetryPayload struct {
	MessageId string
	SentAt    time.Time
	Batch     []struct {
		MessageId  string
		UserId     string
		Event      string
		Timestamp  time.Time
		Properties map[string]any
	}
	Context struct {
		Library struct {
			Name    string
			Version string
		}
	}
}

type testBatch struct {
	MessageId  string
	UserId     string
	Event      string
	Timestamp  time.Time
	Properties map[string]any
}

func assertPayload(t *testing.T, actual testTelemetryPayload, event string, properties map[string]any) {
	t.Helper()
	assert.NotEmpty(t, actual.MessageId)
	assert.False(t, actual.SentAt.IsZero())
	if assert.Len(t, actual.Batch, 1) {
		assert.NotEmpty(t, actual.Batch[0].MessageId, "message id should not be empty")
		assert.Equal(t, testTelemetryID, actual.Batch[0].UserId)
		if event != "" {
			assert.Equal(t, event, actual.Batch[0].Event)
		}
		assert.False(t, actual.Batch[0].Timestamp.IsZero(), "batch timestamp should not be the zero value")
		if properties != nil {
			assert.Equal(t, properties, actual.Batch[0].Properties)
		}
	}
	assert.Equal(t, "analytics-go", actual.Context.Library.Name)
	assert.Equal(t, "3.3.0", actual.Context.Library.Version)
}

func collectBatches(t *testing.T, info *[]testBatch, pchan chan testTelemetryPayload) {
	t.Helper()
	for {
		select {
		case result := <-pchan:
			assertPayload(t, result, "", nil)
			*info = append(*info, result.Batch[0])
		case <-time.After(time.Second * 1):
			return
		}
	}
}

func makeTelemetryServiceAndReceiver(t *testing.T, cloudLicense bool) (*TelemetryService, chan testTelemetryPayload, *model.Config, func()) {

	cfg := &model.Config{}
	cfg.SetDefaults()
	serverIfaceMock, storeMock, deferredAssertions, cleanUp := initializeMocks(cfg, cloudLicense)

	testLogger, _ := mlog.NewLogger()
	logCfg, _ := config.MloggerConfigFromLoggerConfig(&cfg.LogSettings, nil, config.GetLogFileLocation)
	if errCfg := testLogger.ConfigureTargets(logCfg, nil); errCfg != nil {
		panic("failed to configure test logger: " + errCfg.Error())
	}

	pchan := make(chan testTelemetryPayload, 100)
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var p testTelemetryPayload
		err = json.Unmarshal(body, &p)
		require.NoError(t, err)

		pchan <- p
	}))

	service := New(serverIfaceMock, storeMock, searchengine.NewBroker(cfg), testLogger, false)
	service.TelemetryID = testTelemetryID
	service.rudderClient = nil
	service.initRudder(receiver.URL, RudderKey)

	// initializing rudder send a client identify message
	select {
	case identifyMessage := <-pchan:
		assertPayload(t, identifyMessage, "", nil)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive ID message")
	}

	return service, pchan, cfg, func() {
		receiver.Close()
		testLogger.Shutdown()
		cleanUp()
		deferredAssertions(t)
	}
}

const testTelemetryID = "test-telemetry-id-12345"

func (fcs *FakeConfigService) Config() *model.Config                                       { return fcs.cfg }
func (fcs *FakeConfigService) AddConfigListener(f func(old, current *model.Config)) string { return "" }
func (fcs *FakeConfigService) RemoveConfigListener(key string)                             {}
func (fcs *FakeConfigService) AsymmetricSigningKey() *ecdsa.PrivateKey                     { return nil }

func initializeMocks(cfg *model.Config, cloudLicense bool) (*mocks.ServerIface, *storeMocks.Store, func(t *testing.T), func()) {
	serverIfaceMock := &mocks.ServerIface{}
	logger, _ := mlog.NewLogger()

	configService := &FakeConfigService{cfg}
	serverIfaceMock.On("Config").Return(cfg)
	serverIfaceMock.On("IsLeader").Return(true)

	pluginDir, _ := os.MkdirTemp("", "")
	webappPluginDir, _ := os.MkdirTemp("", "")
	cleanUp := func() {
		os.RemoveAll(pluginDir)
		os.RemoveAll(webappPluginDir)
	}
	pluginsAPIMock := &plugintest.API{}
	pluginEnv, _ := plugin.NewEnvironment(
		func(m *model.Manifest) plugin.API { return pluginsAPIMock },
		nil,
		pluginDir, webappPluginDir,
		false,
		logger,
		nil)
	serverIfaceMock.On("GetPluginsEnvironment").Return(pluginEnv, nil)

	if cloudLicense {
		serverIfaceMock.On("License").Return(model.NewTestLicense("cloud"), nil)
	} else {
		serverIfaceMock.On("License").Return(model.NewTestLicense(), nil)
	}
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_admin").Return(&model.Role{Permissions: []string{"sa-test1", "sa-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_user").Return(&model.Role{Permissions: []string{"su-test1", "su-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_user_manager").Return(&model.Role{Permissions: []string{"sum-test1", "sum-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_manager").Return(&model.Role{Permissions: []string{"sm-test1", "sm-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_read_only_admin").Return(&model.Role{Permissions: []string{"sra-test1", "sra-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "system_custom_group_admin").Return(&model.Role{Permissions: []string{"scga-test1", "scga-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "team_admin").Return(&model.Role{Permissions: []string{"ta-test1", "ta-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "team_user").Return(&model.Role{Permissions: []string{"tu-test1", "tu-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "team_guest").Return(&model.Role{Permissions: []string{"tg-test1", "tg-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "channel_admin").Return(&model.Role{Permissions: []string{"ca-test1", "ca-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "channel_user").Return(&model.Role{Permissions: []string{"cu-test1", "cu-test2"}}, nil)
	serverIfaceMock.On("GetRoleByName", context.Background(), "channel_guest").Return(&model.Role{Permissions: []string{"cg-test1", "cg-test2"}}, nil)
	serverIfaceMock.On("GetSchemes", "team", 0, 100).Return([]*model.Scheme{}, nil)
	serverIfaceMock.On("HTTPService").Return(httpservice.MakeHTTPService(configService))
	serverIfaceMock.On("HooksManager").Return(product.NewHooksManager(nil))

	storeMock := &storeMocks.Store{}
	storeMock.On("GetDbVersion", false).Return("5.24.0", nil)

	systemStore := storeMocks.SystemStore{}
	systemStore.On("Get").Return(make(model.StringMap), nil)
	systemID := &model.System{Name: model.SystemTelemetryId, Value: "test"}
	systemStore.On("InsertIfExists", mock.Anything).Return(systemID, nil)
	systemStore.On("GetByName", model.AdvancedPermissionsMigrationKey).Return(nil, nil)
	systemStore.On("GetByName", model.MigrationKeyAdvancedPermissionsPhase2).Return(nil, nil)

	userStore := storeMocks.UserStore{}
	userStore.On("Count", model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: true, ExcludeRegularUsers: false, TeamId: "", ViewRestrictions: nil}).Return(int64(10), nil)
	userStore.On("Count", model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: false, ExcludeRegularUsers: true, TeamId: "", ViewRestrictions: nil}).Return(int64(100), nil)
	userStore.On("Count", model.UserCountOptions{Roles: []string{model.SystemManagerRoleId}}).Return(int64(5), nil)
	userStore.On("Count", model.UserCountOptions{Roles: []string{model.SystemUserManagerRoleId}}).Return(int64(10), nil)
	userStore.On("Count", model.UserCountOptions{Roles: []string{model.SystemReadOnlyAdminRoleId}}).Return(int64(15), nil)
	userStore.On("Count", model.UserCountOptions{Roles: []string{model.SystemCustomGroupAdminRoleId}}).Return(int64(15), nil)
	userStore.On("AnalyticsGetGuestCount").Return(int64(11), nil)
	userStore.On("AnalyticsActiveCount", mock.Anything, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false, ExcludeRegularUsers: false, TeamId: "", ViewRestrictions: nil}).Return(int64(5), nil)
	userStore.On("AnalyticsGetInactiveUsersCount").Return(int64(8), nil)
	userStore.On("AnalyticsGetSystemAdminCount").Return(int64(9), nil)

	teamStore := storeMocks.TeamStore{}
	teamStore.On("AnalyticsTeamCount", (*model.TeamSearch)(nil)).Return(int64(3), nil)
	teamStore.On("GroupSyncedTeamCount").Return(int64(16), nil)

	channelStore := storeMocks.ChannelStore{}
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeOpen).Return(int64(25), nil)
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypePrivate).Return(int64(26), nil)
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeDirect).Return(int64(27), nil)
	channelStore.On("AnalyticsDeletedTypeCount", "", model.ChannelTypeOpen).Return(int64(22), nil)
	channelStore.On("AnalyticsDeletedTypeCount", "", model.ChannelTypePrivate).Return(int64(23), nil)
	channelStore.On("GroupSyncedChannelCount").Return(int64(17), nil)

	postStore := storeMocks.PostStore{}
	postStore.On("AnalyticsPostCount", &model.PostCountOptions{}).Return(int64(1000), nil)
	postStore.On("AnalyticsPostCountsByDay", &model.AnalyticsPostCountsOptions{TeamId: "", BotsOnly: false, YesterdayOnly: true}).Return(model.AnalyticsRows{}, nil)
	postStore.On("AnalyticsPostCountsByDay", &model.AnalyticsPostCountsOptions{TeamId: "", BotsOnly: true, YesterdayOnly: true}).Return(model.AnalyticsRows{}, nil)

	commandStore := storeMocks.CommandStore{}
	commandStore.On("AnalyticsCommandCount", "").Return(int64(15), nil)

	webhookStore := storeMocks.WebhookStore{}
	webhookStore.On("AnalyticsIncomingCount", "").Return(int64(16), nil)
	webhookStore.On("AnalyticsOutgoingCount", "").Return(int64(17), nil)

	groupStore := storeMocks.GroupStore{}
	groupStore.On("GroupCount").Return(int64(25), nil)
	groupStore.On("GroupTeamCount").Return(int64(26), nil)
	groupStore.On("GroupChannelCount").Return(int64(27), nil)
	groupStore.On("GroupMemberCount").Return(int64(32), nil)
	groupStore.On("DistinctGroupMemberCount").Return(int64(22), nil)
	groupStore.On("GroupCountWithAllowReference").Return(int64(13), nil)
	groupStore.On("GroupCountBySource", model.GroupSourceCustom).Return(int64(10), nil)
	groupStore.On("GroupCountBySource", model.GroupSourceLdap).Return(int64(2), nil)
	groupStore.On("DistinctGroupMemberCountForSource", mock.AnythingOfType("model.GroupSource")).Return(int64(1), nil)

	schemeStore := storeMocks.SchemeStore{}
	schemeStore.On("CountByScope", "channel").Return(int64(8), nil)
	schemeStore.On("CountByScope", "team").Return(int64(7), nil)
	schemeStore.On("CountWithoutPermission", "channel", "create_post", model.RoleScopeChannel, model.RoleTypeUser).Return(int64(6), nil)
	schemeStore.On("CountWithoutPermission", "channel", "create_post", model.RoleScopeChannel, model.RoleTypeGuest).Return(int64(7), nil)
	schemeStore.On("CountWithoutPermission", "channel", "add_reaction", model.RoleScopeChannel, model.RoleTypeUser).Return(int64(8), nil)
	schemeStore.On("CountWithoutPermission", "channel", "add_reaction", model.RoleScopeChannel, model.RoleTypeGuest).Return(int64(9), nil)
	schemeStore.On("CountWithoutPermission", "channel", "manage_public_channel_members", model.RoleScopeChannel, model.RoleTypeUser).Return(int64(10), nil)
	schemeStore.On("CountWithoutPermission", "channel", "use_channel_mentions", model.RoleScopeChannel, model.RoleTypeUser).Return(int64(11), nil)
	schemeStore.On("CountWithoutPermission", "channel", "use_channel_mentions", model.RoleScopeChannel, model.RoleTypeGuest).Return(int64(12), nil)

	storeMock.On("System").Return(&systemStore)
	storeMock.On("User").Return(&userStore)
	storeMock.On("Team").Return(&teamStore)
	storeMock.On("Channel").Return(&channelStore)
	storeMock.On("Post").Return(&postStore)
	storeMock.On("Command").Return(&commandStore)
	storeMock.On("Webhook").Return(&webhookStore)
	storeMock.On("Group").Return(&groupStore)
	storeMock.On("Scheme").Return(&schemeStore)

	return serverIfaceMock, storeMock, func(t *testing.T) {
		serverIfaceMock.AssertExpectations(t)
		storeMock.AssertExpectations(t)
		systemStore.AssertExpectations(t)
		pluginsAPIMock.AssertExpectations(t)
	}, cleanUp
}

func TestEnsureTelemetryID(t *testing.T) {
	t.Run("test ID in database and does not run twice", func(t *testing.T) {
		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}
		returnValue := &model.System{
			Name:  model.SystemTelemetryId,
			Value: "test",
		}
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(returnValue, nil).Once()

		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}
		cfg := &model.Config{}
		cfg.SetDefaults()

		testLogger, _ := mlog.NewLogger()

		telemetryService := New(serverIfaceMock, storeMock, searchengine.NewBroker(cfg), testLogger, false)
		assert.Equal(t, "test", telemetryService.TelemetryID)

		telemetryService.ensureTelemetryID()
		assert.Equal(t, "test", telemetryService.TelemetryID)

		// No more calls to the store if we try to ensure it again
		telemetryService.ensureTelemetryID()
		assert.Equal(t, "test", telemetryService.TelemetryID)
	})

	t.Run("new test ID created", func(t *testing.T) {
		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}
		returnValue := &model.System{
			Name: model.SystemTelemetryId,
		}

		var generatedID string
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(returnValue, nil).Once().Run(func(args mock.Arguments) {
			s := args.Get(0).(*model.System)
			returnValue.Value = s.Value
			generatedID = s.Value
		})
		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}
		cfg := &model.Config{}
		cfg.SetDefaults()

		testLogger, _ := mlog.NewLogger()

		telemetryService := New(serverIfaceMock, storeMock, searchengine.NewBroker(cfg), testLogger, false)
		assert.Equal(t, generatedID, telemetryService.TelemetryID)
	})

	t.Run("fail to save test ID", func(t *testing.T) {
		storeMock := &storeMocks.Store{}

		systemStore := storeMocks.SystemStore{}

		insertError := errors.New("insert error")
		systemStore.On("InsertIfExists", mock.AnythingOfType("*model.System")).Return(nil, insertError).Once()

		storeMock.On("System").Return(&systemStore)

		serverIfaceMock := &mocks.ServerIface{}
		cfg := &model.Config{}
		cfg.SetDefaults()

		testLogger, _ := mlog.NewLogger()

		telemetryService := New(serverIfaceMock, storeMock, searchengine.NewBroker(cfg), testLogger, false)
		assert.Equal(t, "", telemetryService.TelemetryID)
	})
}

func TestPluginSetting(t *testing.T) {
	settings := &model.PluginSettings{
		Plugins: map[string]map[string]any{
			"test": {
				"foo": "bar",
			},
		},
	}
	assert.Equal(t, "bar", pluginSetting(settings, "test", "foo", "asd"))
	assert.Equal(t, "asd", pluginSetting(settings, "test", "qwe", "asd"))
}

func TestPluginActivated(t *testing.T) {
	states := map[string]*model.PluginState{
		"foo": {
			Enable: true,
		},
		"bar": {
			Enable: false,
		},
	}
	assert.True(t, pluginActivated(states, "foo"))
	assert.False(t, pluginActivated(states, "bar"))
	assert.False(t, pluginActivated(states, "none"))
}

const keyStorageBytes = "storage_bytes"

func TestPluginVersion(t *testing.T) {
	plugins := []*model.BundleInfo{
		{
			Manifest: &model.Manifest{
				Id:      "test.plugin",
				Version: "1.2.3",
			},
		},
		{
			Manifest: &model.Manifest{
				Id:      "test.plugin2",
				Version: "4.5.6",
			},
		},
	}
	assert.Equal(t, "1.2.3", pluginVersion(plugins, "test.plugin"))
	assert.Equal(t, "4.5.6", pluginVersion(plugins, "test.plugin2"))
	assert.Empty(t, pluginVersion(plugins, "unknown.plugin"))
}

func TestRudderTelemetry(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	service, pchan, cfg, teardown := makeTelemetryServiceAndReceiver(t, false)
	defer teardown()

	marketplaceServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		json, err := json.Marshal([]*model.MarketplacePlugin{{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest: &model.Manifest{
					Id: "testplugin",
				},
			},
		}})
		require.NoError(t, err)
		res.Write(json)
	}))

	defer marketplaceServer.Close()

	collectInfo := func(info *[]string) {
		t.Helper()
		for {
			select {
			case result := <-pchan:
				assertPayload(t, result, "", nil)
				*info = append(*info, result.Batch[0].Event)
			case <-time.After(time.Second * 1):
				return
			}
		}
	}

	t.Run("Send", func(t *testing.T) {
		testValue := "test-send-value-6789"
		service.SendTelemetry("Testing Telemetry", map[string]any{
			"hey": testValue,
		})
		select {
		case result := <-pchan:
			assertPayload(t, result, "Testing Telemetry", map[string]any{
				"hey": testValue,
			})
		case <-time.After(time.Second * 1):
			require.Fail(t, "Did not receive telemetry")
		}
	})

	// Plugins remain disabled at this point
	t.Run("SendDailyTelemetryPluginsDisabled", func(t *testing.T) {
		service.sendDailyTelemetry(true)

		var info []string
		// Collect the info sent.
		collectInfo(&info)

		for _, item := range []string{
			TrackConfigService,
			TrackConfigTeam,
			TrackConfigSQL,
			TrackConfigLog,
			TrackConfigNotificationLog,
			TrackConfigFile,
			TrackConfigRate,
			TrackConfigEmail,
			TrackConfigPrivacy,
			TrackConfigOAuth,
			TrackConfigLDAP,
			TrackConfigCompliance,
			TrackConfigLocalization,
			TrackConfigSAML,
			TrackConfigPassword,
			TrackConfigCluster,
			TrackConfigMetrics,
			TrackConfigSupport,
			TrackConfigNativeApp,
			TrackConfigExperimental,
			TrackConfigAnalytics,
			TrackConfigPlugin,
			TrackFeatureFlags,
			TrackActivity,
			TrackServer,
			TrackConfigMessageExport,
			TrackPlugins,
		} {
			require.Contains(t, info, item)
		}
	})

	// Enable plugins for the remainder of the tests.
	// th.Server.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

	t.Run("SendDailyTelemetry", func(t *testing.T) {
		service.sendDailyTelemetry(true)

		var info []string
		// Collect the info sent.
		collectInfo(&info)

		for _, item := range []string{
			TrackConfigService,
			TrackConfigTeam,
			TrackConfigSQL,
			TrackConfigLog,
			TrackConfigNotificationLog,
			TrackConfigFile,
			TrackConfigRate,
			TrackConfigEmail,
			TrackConfigPrivacy,
			TrackConfigOAuth,
			TrackConfigLDAP,
			TrackConfigCompliance,
			TrackConfigLocalization,
			TrackConfigSAML,
			TrackConfigPassword,
			TrackConfigCluster,
			TrackConfigMetrics,
			TrackConfigSupport,
			TrackConfigNativeApp,
			TrackConfigExperimental,
			TrackConfigAnalytics,
			TrackConfigPlugin,
			TrackFeatureFlags,
			TrackActivity,
			TrackServer,
			TrackConfigMessageExport,
			TrackPlugins,
		} {
			require.Contains(t, info, item)
		}
	})
	t.Run("Telemetry for Marketplace plugins is returned", func(t *testing.T) {
		service.trackPluginConfig(service.srv.Config(), marketplaceServer.URL)

		var batches []testBatch
		collectBatches(t, &batches, pchan)

		for _, b := range batches {
			if b.Event == TrackConfigPlugin {
				assert.Contains(t, b.Properties, "enable_testplugin")
				assert.Contains(t, b.Properties, "version_testplugin")

				// Confirm known plugins are not present
				assert.NotContains(t, b.Properties, "enable_jira")
				assert.NotContains(t, b.Properties, "version_jira")
			}
		}
	})

	t.Run("Telemetry for known plugins is returned, if request to Marketplace fails", func(t *testing.T) {
		service.trackPluginConfig(service.srv.Config(), "http://some.random.invalid.url")

		var batches []testBatch
		collectBatches(t, &batches, pchan)

		for _, b := range batches {
			if b.Event == TrackConfigPlugin {
				assert.NotContains(t, b.Properties, "enable_testplugin")
				assert.NotContains(t, b.Properties, "version_testplugin")

				// Confirm known plugins are present
				assert.Contains(t, b.Properties, "enable_jira")
				assert.Contains(t, b.Properties, "version_jira")
			}
		}
	})

	t.Run("SendDailyTelemetryNoRudderKey", func(t *testing.T) {
		if !strings.Contains(RudderKey, "placeholder") {
			t.Skipf("Skipping telemetry on production builds")
		}
		service.sendDailyTelemetry(false)

		select {
		case <-pchan:
			require.Fail(t, "Should not send telemetry when the rudder key is not set")
		case <-time.After(time.Second * 1):
			// Did not receive telemetry
		}
	})

	t.Run("SendDailyTelemetryNonCloud", func(t *testing.T) {
		if !strings.Contains(RudderKey, "placeholder") {
			t.Skipf("Skipping telemetry on production builds")
		}
		service.sendDailyTelemetry(true)

		var batches []testBatch
		collectBatches(t, &batches, pchan)

		var activityEvent testBatch
		var found bool
		for _, testBatch := range batches {
			if testBatch.Event == TrackActivity {
				activityEvent = testBatch
				found = true
				break
			}
		}
		require.True(t, found, fmt.Sprintf("Expected to receive %q event, but received %q", TrackActivity, activityEvent.Event))

		_, ok := activityEvent.Properties[keyStorageBytes]

		require.False(t, ok, fmt.Sprintf("Expected non-cloud payload not to contain %q, got %+v", keyStorageBytes, activityEvent.Properties))
	})

	t.Run("SendDailyTelemetryDisabled", func(t *testing.T) {
		if !strings.Contains(RudderKey, "placeholder") {
			t.Skipf("Skipping telemetry on production builds")
		}
		*cfg.LogSettings.EnableDiagnostics = false
		defer func() {
			*cfg.LogSettings.EnableDiagnostics = true
		}()

		service.sendDailyTelemetry(true)

		select {
		case <-pchan:
			require.Fail(t, "Should not send telemetry when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not receive telemetry
		}
	})

	t.Run("TestInstallationType", func(t *testing.T) {
		os.Unsetenv(EnvVarInstallType)
		service.sendDailyTelemetry(true)

		var batches []testBatch
		collectBatches(t, &batches, pchan)

		for _, b := range batches {
			if b.Event == TrackServer {
				assert.Equal(t, b.Properties["installation_type"], "")
			}
		}

		os.Setenv(EnvVarInstallType, "docker")
		defer os.Unsetenv(EnvVarInstallType)

		batches = []testBatch{}
		collectBatches(t, &batches, pchan)

		for _, b := range batches {
			if b.Event == TrackServer {
				assert.Equal(t, b.Properties["installation_type"], "docker")
			}
		}
	})

	t.Run("RudderConfigUsesConfigForValues", func(t *testing.T) {
		if !strings.Contains(RudderKey, "placeholder") {
			t.Skipf("Skipping telemetry on production builds")
		}
		os.Setenv("RudderKey", "abc123")
		os.Setenv("RudderDataplaneURL", "arudderstackplace")
		defer os.Unsetenv("RudderKey")
		defer os.Unsetenv("RudderDataplaneURL")

		config := service.getRudderConfig()

		assert.Equal(t, "arudderstackplace", config.DataplaneURL)
		assert.Equal(t, "abc123", config.RudderKey)
	})
}

func TestRudderTelemetryCloud(t *testing.T) {
	if !strings.Contains(RudderKey, "placeholder") {
		t.Skipf("Skipping telemetry on production builds")
	}
	if testing.Short() {
		t.SkipNow()
	}

	service, pchan, _, teardown := makeTelemetryServiceAndReceiver(t, true)
	defer teardown()

	fileInfoStore := storeMocks.FileInfoStore{}
	mockBytes := int64(1000000000)
	fileInfoStore.On("GetStorageUsage", true, false).Return(mockBytes, nil)
	defer fileInfoStore.AssertExpectations(t)

	service.dbStore.(*storeMocks.Store).On("FileInfo").Return(&fileInfoStore)
	service.sendDailyTelemetry(true)

	var batches []testBatch
	collectBatches(t, &batches, pchan)

	var activityEvent testBatch
	var found bool
	for _, batch := range batches {
		if batch.Event == TrackActivity {
			activityEvent = batch
			found = true
			break
		}
	}
	require.True(t, found, fmt.Sprintf("Expected to receive %q event, but received %q: %+v", TrackActivity, activityEvent.Event, activityEvent))

	storageBytes, ok := activityEvent.Properties[keyStorageBytes]

	require.True(t, ok, fmt.Sprintf("Expected payload to contain %q", keyStorageBytes))
	require.Equal(t, mockBytes, int64(storageBytes.(float64)), fmt.Sprintf("Expected storage usage of %d bytes", mockBytes))
}

func TestIsDefaultArray(t *testing.T) {
	assert.True(t, isDefaultArray([]string{"one", "two"}, []string{"one", "two"}))
	assert.False(t, isDefaultArray([]string{"one", "two"}, []string{"one", "two", "three"}))
	assert.False(t, isDefaultArray([]string{"one", "two"}, []string{"one", "three"}))
}
