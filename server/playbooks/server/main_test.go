// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/api4"
	sapp "github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	"github.com/mattermost/mattermost-server/server/v8/config"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/client"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	_ "github.com/mattermost/mattermost-server/server/v8/playbooks/product"
)

func TestMain(m *testing.M) {
	// This actually runs the tests
	status := m.Run()

	os.Exit(status)
}

type PermissionsHelper interface {
	SaveDefaultRolePermissions() map[string][]string
	RestoreDefaultRolePermissions(data map[string][]string)
	RemovePermissionFromRole(permission string, roleName string)
	AddPermissionToRole(permission string, roleName string)
	SetupChannelScheme() *model.Scheme
}

type serverPermissionsWrapper struct {
	api4.TestHelper
}

type TestEnvironment struct {
	T   testing.TB
	Srv *sapp.Server
	A   *sapp.App

	Permissions PermissionsHelper
	logger      mlog.LoggerIFace

	ServerAdminClient        *model.Client4
	PlaybooksAdminClient     *client.Client
	ServerClient             *model.Client4
	PlaybooksClient          *client.Client
	PlaybooksClient2         *client.Client
	PlaybooksClientNotInTeam *client.Client
	PlaybooksClientGuest     *client.Client

	UnauthenticatedPlaybooksClient *client.Client

	BasicTeam                *model.Team
	BasicTeam2               *model.Team
	BasicPublicChannel       *model.Channel
	BasicPublicChannelPost   *model.Post
	BasicPrivateChannel      *model.Channel
	BasicPrivateChannelPost  *model.Post
	BasicPlaybook            *client.Playbook
	BasicPrivatePlaybook     *client.Playbook
	PrivatePlaybookNoMembers *client.Playbook
	ArchivedPlaybook         *client.Playbook
	BasicRun                 *client.PlaybookRun
	AdminUser                *model.User
	RegularUser              *model.User
	RegularUser2             *model.User
	RegularUserNotInTeam     *model.User
	GuestUser                *model.User
}

func getEnvWithDefault(name, defaultValue string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return defaultValue
}

func Setup(t *testing.T) *TestEnvironment {
	// Ignore any locally defined SiteURL as we intend to host our own.
	os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	os.Unsetenv("MM_SERVICESETTINGS_LISTENADDRESS")

	// Ignore any globally defined datasource if a test dsn defined
	if os.Getenv("TEST_DATABASE_MYSQL_DSN") != "" || os.Getenv("TEST_DATABASE_POSTGRESQL_DSN") != "" {
		t.Log("Unsetting MM_SQLSETTINGS_DATASOURCE since test dsn detected")
		os.Unsetenv("MM_SQLSETTINGS_DATASOURCE")
	}

	// Environment Settings
	driverName := getEnvWithDefault("MM_SQLSETTINGS_DRIVERNAME", "postgres")
	sqlSettings := storetest.MakeSqlSettings(driverName, false)

	// Create a test memory store and modify configuration appropriately
	configStore := config.NewTestMemoryStore()
	config := configStore.Get()
	// Force plugins to be disabled since we are in product mode
	config.PluginSettings.Enable = model.NewBool(false)
	config.ServiceSettings.ListenAddress = model.NewString("localhost:0")
	config.TeamSettings.MaxUsersPerTeam = model.NewInt(10000)
	config.LocalizationSettings.SetDefaults()
	config.SqlSettings = *sqlSettings
	config.ServiceSettings.SiteURL = model.NewString("http://testsiteurlplaybooks.mattermost.com/")
	config.LogSettings.EnableConsole = model.NewBool(true)
	config.LogSettings.EnableFile = model.NewBool(false)
	config.LogSettings.ConsoleLevel = model.NewString("INFO")

	// override config with e2etest.config.json if it exists
	textConfig, err := os.ReadFile("./e2etest.config.json")
	if err == nil {
		err = json.Unmarshal(textConfig, config)
		if err != nil {
			require.NoError(t, err)
		}
	}

	_, _, err = configStore.Set(config)
	require.NoError(t, err)

	// Create a logger to override
	testLogger, err := mlog.NewLogger()
	require.NoError(t, err)
	testLogger.LockConfiguration()

	// Create a server with our specified options
	err = utils.TranslationsPreInit()
	require.NoError(t, err)

	options := []sapp.Option{
		sapp.ConfigStore(configStore),
	}
	server, err := sapp.NewServer(options...)
	require.NoError(t, err)
	_, err = api4.Init(server)
	require.NoError(t, err)
	err = server.Start()
	require.NoError(t, err)

	// Cleanup to run after test is complete
	t.Cleanup(func() {
		server.Shutdown()
	})

	ap := sapp.New(sapp.ServerConnector(server.Channels()))

	return &TestEnvironment{
		T:   t,
		Srv: server,
		A:   ap,
		Permissions: &serverPermissionsWrapper{
			TestHelper: api4.TestHelper{
				Server: server,
				App:    ap,
			},
		},
		logger: testLogger,
	}
}

func (e *TestEnvironment) CreateClients() {
	e.T.Helper()

	userPassword := "Password123!"
	admin, appErr := e.A.CreateUserAsAdmin(request.EmptyContext(e.logger), &model.User{
		Email:    "playbooksadmin@example.com",
		Username: "playbooksadmin",
		Password: userPassword,
	}, "")
	require.Nil(e.T, appErr)
	e.AdminUser = admin

	user, appErr := e.A.CreateUser(request.EmptyContext(e.logger), &model.User{
		Email:     "playbooksuser@example.com",
		Username:  "playbooksuser",
		Password:  userPassword,
		FirstName: "First 1",
		LastName:  "Last 1",
	})
	require.Nil(e.T, appErr)
	e.RegularUser = user

	user2, appErr := e.A.CreateUser(request.EmptyContext(e.logger), &model.User{
		Email:     "playbooksuser2@example.com",
		Username:  "playbooksuser2",
		Password:  userPassword,
		FirstName: "First 2",
		LastName:  "Last 2",
	})
	require.Nil(e.T, appErr)
	e.RegularUser2 = user2

	notInTeam, appErr := e.A.CreateUser(request.EmptyContext(e.logger), &model.User{
		Email:    "playbooksusernotinteam@example.com",
		Username: "playbooksusenotinteam",
		Password: userPassword,
	})
	require.Nil(e.T, appErr)
	e.RegularUserNotInTeam = notInTeam

	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)

	serverAdminClient := model.NewAPIv4Client(siteURL)
	_, _, err := serverAdminClient.Login(context.Background(), admin.Email, userPassword)
	require.NoError(e.T, err)

	playbooksAdminClient, err := client.New(serverAdminClient)
	require.NoError(e.T, err)

	e.ServerAdminClient = serverAdminClient
	e.PlaybooksAdminClient = playbooksAdminClient

	serverClient := model.NewAPIv4Client(siteURL)
	_, _, err = serverClient.Login(context.Background(), user.Email, userPassword)
	require.NoError(e.T, err)

	playbooksClient, err := client.New(serverClient)
	require.NoError(e.T, err)

	unauthServerClient := model.NewAPIv4Client(siteURL)
	unauthClient, err := client.New(unauthServerClient)
	require.NoError(e.T, err)

	serverClient2 := model.NewAPIv4Client(siteURL)
	_, _, err = serverClient2.Login(context.Background(), user2.Email, userPassword)
	require.NoError(e.T, err)

	playbooksClient2, err := client.New(serverClient2)
	require.NoError(e.T, err)

	serverClientNotInTeam := model.NewAPIv4Client(siteURL)
	_, _, err = serverClientNotInTeam.Login(context.Background(), notInTeam.Email, userPassword)
	require.NoError(e.T, err)

	playbooksClientNotInTeam, err := client.New(serverClientNotInTeam)
	require.NoError(e.T, err)

	e.ServerClient = serverClient
	e.PlaybooksClient = playbooksClient
	e.PlaybooksClient2 = playbooksClient2
	e.UnauthenticatedPlaybooksClient = unauthClient
	e.PlaybooksClientNotInTeam = playbooksClientNotInTeam
}

func (e *TestEnvironment) CreateBasicServer() {
	e.T.Helper()

	team, _, err := e.ServerAdminClient.CreateTeam(context.Background(), &model.Team{
		DisplayName: "basic",
		Name:        "basic",
		Email:       "success+playbooks@simulator.amazonses.com",
		Type:        model.TeamOpen,
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team.Id, e.RegularUser.Id)
	require.NoError(e.T, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team.Id, e.RegularUser2.Id)
	require.NoError(e.T, err)

	pubChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "testpublic1",
		Name:        "testpublic1",
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	pubPost, _, err := e.ServerAdminClient.CreatePost(context.Background(), &model.Post{
		UserId:    e.AdminUser.Id,
		ChannelId: pubChannel.Id,
		Message:   "this is a public channel post by a system admin",
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), pubChannel.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "testprivate1",
		Name:        "testprivate1",
		Type:        model.ChannelTypePrivate,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	privatePost, _, err := e.ServerAdminClient.CreatePost(context.Background(), &model.Post{
		UserId:    e.AdminUser.Id,
		ChannelId: privateChannel.Id,
		Message:   "this is a private channel post by a system admin",
	})
	require.NoError(e.T, err)

	e.BasicTeam = team
	e.BasicPublicChannel = pubChannel
	e.BasicPublicChannelPost = pubPost
	e.BasicPrivateChannel = privateChannel
	e.BasicPrivateChannelPost = privatePost

	// Add a second team to test cross-team features
	team2, _, err := e.ServerAdminClient.CreateTeam(context.Background(), &model.Team{
		DisplayName: "second team",
		Name:        "second-team",
		Email:       "success+playbooks@simulator.amazonses.com",
		Type:        model.TeamOpen,
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team2.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	e.BasicTeam2 = team2
}

func (e *TestEnvironment) CreateBasicPlaybook() {
	e.T.Helper()

	e.CreateBasicPublicPlaybook()
	e.CreateBasicPrivatePlaybook()
}

func (e *TestEnvironment) CreateBasicPrivatePlaybook() {
	e.T.Helper()

	privateID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPrivatePlaybook",
		TeamID: e.BasicTeam.Id,
		Public: false,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(e.T, err)

	privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privateID)
	require.NoError(e.T, err)

	e.BasicPrivatePlaybook = privatePlaybook
}

func (e *TestEnvironment) CreateBasicPublicPlaybook() {

	e.T.Helper()
	id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		Metrics: []client.PlaybookMetricConfig{
			{Title: "testmetric", Type: app.MetricTypeDuration, Target: null.IntFrom(0)},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(e.T, err)

	playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
	require.NoError(e.T, err)

	e.BasicPlaybook = playbook
}

func (e *TestEnvironment) CreateBasicRun() {
	e.T.Helper()

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(e.T, err)
	require.NotNil(e.T, run)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(e.T, err)
	require.NotNil(e.T, run)

	e.BasicRun = run
}

func (e *TestEnvironment) CreateAdditionalPlaybooks() {
	e.T.Helper()

	privateID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPrivatePlaybookNoMembers",
		TeamID: e.BasicTeam.Id,
		Public: false,
	})
	require.NoError(e.T, err)

	privatePlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), privateID)
	require.NoError(e.T, err)

	e.PrivatePlaybookNoMembers = privatePlaybook

	archivedID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestArchivedPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
	})
	require.NoError(e.T, err)

	err = e.PlaybooksAdminClient.Playbooks.Archive(context.Background(), archivedID)
	require.NoError(e.T, err)

	archivedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), archivedID)
	require.NoError(e.T, err)

	e.ArchivedPlaybook = archivedPlaybook
}

func (e *TestEnvironment) CreateGuest() {
	cfg := e.Srv.Config()
	cfg.GuestAccountsSettings.Enable = model.NewBool(true)
	_, _, err := e.ServerAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(e.T, err)

	userPassword := "password123!"
	guest, appErr := e.A.CreateGuest(request.EmptyContext(e.logger), &model.User{
		Email:    "playbookguest@example.com",
		Username: "playbookguest",
		Password: userPassword,
	})
	require.Nil(e.T, appErr)
	e.GuestUser = guest

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicPublicChannel.TeamId, e.GuestUser.Id)
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicPublicChannel.Id, e.GuestUser.Id)
	require.NoError(e.T, err)

	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)
	serverClientGuest := model.NewAPIv4Client(siteURL)
	_, _, err = serverClientGuest.Login(context.Background(), e.GuestUser.Email, userPassword)
	require.NoError(e.T, err)

	playbooksClientGuest, err := client.New(serverClientGuest)
	require.NoError(e.T, err)
	e.PlaybooksClientGuest = playbooksClientGuest
}

func (e *TestEnvironment) RemoveLicence() {
	e.Srv.SetLicense(nil)
}

func (e *TestEnvironment) SetE10Licence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuE10
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) SetE20Licence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuE20
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) CreateBasic() {
	e.T.Helper()

	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()
	e.CreateBasicPlaybook()
	e.CreateBasicRun()
	e.CreateAdditionalPlaybooks()
}

// TestTestFramework If this is failing you know the break is not exclusively in your test.
func TestTestFramework(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
}

func requireErrorWithStatusCode(t *testing.T, err error, statusCode int) {
	t.Helper()

	require.Error(t, err)

	var errResponse *client.ErrorResponse
	require.Truef(t, errors.As(err, &errResponse), "err is not an instance of errResponse: %s", err.Error())
	require.Equal(t, statusCode, errResponse.StatusCode)
}
