// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package integrationtests

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/boards/client"
	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/server"
	"github.com/mattermost/mattermost/server/v8/boards/services/auth"
	"github.com/mattermost/mattermost/server/v8/boards/services/config"
	"github.com/mattermost/mattermost/server/v8/boards/services/permissions/localpermissions"
	"github.com/mattermost/mattermost/server/v8/boards/services/permissions/mmpermissions"
	"github.com/mattermost/mattermost/server/v8/boards/services/store"
	"github.com/mattermost/mattermost/server/v8/boards/services/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/boards/utils"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/stretchr/testify/require"
)

const (
	user1Username = "user1"
	user2Username = "user2"
	password      = "Pa$$word"
	testTeamID    = "team-id"
)

const (
	userAnon         string = "anon"
	userNoTeamMember string = "no-team-member"
	userTeamMember   string = "team-member"
	userViewer       string = "viewer"
	userCommenter    string = "commenter"
	userEditor       string = "editor"
	userAdmin        string = "admin"
	userGuest        string = "guest"
)

var (
	userAnonID         = userAnon
	userNoTeamMemberID = userNoTeamMember
	userTeamMemberID   = userTeamMember
	userViewerID       = userViewer
	userCommenterID    = userCommenter
	userEditorID       = userEditor
	userAdminID        = userAdmin
	userGuestID        = userGuest
)

type LicenseType int

const (
	LicenseNone         LicenseType = iota // 0
	LicenseProfessional                    // 1
	LicenseEnterprise                      // 2
)

type TestHelper struct {
	T       *testing.T
	Server  *server.Server
	Client  *client.Client
	Client2 *client.Client

	origEnvUnitTesting string
}

type FakePermissionPluginAPI struct{}

func (*FakePermissionPluginAPI) HasPermissionTo(userID string, permission *mm_model.Permission) bool {
	return userID == userAdmin
}

func (*FakePermissionPluginAPI) HasPermissionToTeam(userID string, teamID string, permission *mm_model.Permission) bool {
	if permission.Id == model.PermissionManageTeam.Id {
		return false
	}
	if userID == userNoTeamMember {
		return false
	}
	if teamID == "empty-team" {
		return false
	}
	return true
}

func (*FakePermissionPluginAPI) HasPermissionToChannel(userID string, channelID string, permission *mm_model.Permission) bool {
	return channelID == "valid-channel-id" || channelID == "valid-channel-id-2"
}

func GetTestConfig(t *testing.T) *config.Configuration {
	driver := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driver == "" {
		driver = model.PostgresDBType
	}

	storeType := sqlstore.NewStoreType(driver, driver, true)
	storeType.Store.Shutdown()
	storeType.Logger.Shutdown()

	logging := `
	{
		"testing": {
			"type": "console",
			"options": {
				"out": "stdout"
			},
			"format": "plain",
			"format_options": {
				"delim": "  "
			},
			"levels": [
				{"id": 5, "name": "debug"},
				{"id": 4, "name": "info"},
				{"id": 3, "name": "warn"},
				{"id": 2, "name": "error", "stacktrace": true},
				{"id": 1, "name": "fatal", "stacktrace": true},
				{"id": 0, "name": "panic", "stacktrace": true}
			]
		}
	}`

	return &config.Configuration{
		ServerRoot:        "http://localhost:8888",
		Port:              8888,
		DBType:            driver,
		DBConfigString:    storeType.ConnString,
		DBTablePrefix:     "test_",
		WebPath:           "./pack",
		FilesDriver:       "local",
		FilesPath:         "./files",
		LoggingCfgJSON:    logging,
		SessionExpireTime: int64(30 * time.Second),
		AuthMode:          "native",
	}
}

func newTestServer(t *testing.T, singleUserToken string) *server.Server {
	return newTestServerWithLicense(t, singleUserToken, LicenseNone)
}

func newTestServerWithLicense(t *testing.T, singleUserToken string, licenseType LicenseType) *server.Server {
	cfg := GetTestConfig(t)

	logger, _ := mlog.NewLogger()
	err := logger.Configure("", cfg.LoggingCfgJSON, nil)
	require.NoError(t, err)

	singleUser := singleUserToken != ""
	innerStore, err := server.NewStore(cfg, singleUser, logger)
	require.NoError(t, err)

	var db store.Store

	switch licenseType {
	case LicenseProfessional:
		db = NewTestProfessionalStore(innerStore)
	case LicenseEnterprise:
		db = NewTestEnterpriseStore(innerStore)
	case LicenseNone:
		fallthrough
	default:
		db = innerStore
	}

	permissionsService := localpermissions.New(db, logger)

	params := server.Params{
		Cfg:                cfg,
		SingleUserToken:    singleUserToken,
		DBStore:            db,
		Logger:             logger,
		PermissionsService: permissionsService,
	}

	srv, err := server.New(params)
	require.NoError(t, err)

	return srv
}

func NewTestServerPluginMode(t *testing.T) *server.Server {
	cfg := GetTestConfig(t)

	cfg.AuthMode = "mattermost"
	cfg.EnablePublicSharedBoards = true

	logger, _ := mlog.NewLogger()
	if err := logger.Configure("", cfg.LoggingCfgJSON, nil); err != nil {
		panic(err)
	}
	innerStore, err := server.NewStore(cfg, false, logger)
	if err != nil {
		panic(err)
	}

	db := NewPluginTestStore(innerStore)

	permissionsService := mmpermissions.New(db, &FakePermissionPluginAPI{}, logger)

	params := server.Params{
		Cfg:                cfg,
		DBStore:            db,
		Logger:             logger,
		PermissionsService: permissionsService,
	}

	srv, err := server.New(params)
	if err != nil {
		panic(err)
	}

	return srv
}

func newTestServerLocalMode(t *testing.T) *server.Server {
	cfg := GetTestConfig(t)
	cfg.EnablePublicSharedBoards = true

	logger, _ := mlog.NewLogger()
	err := logger.Configure("", cfg.LoggingCfgJSON, nil)
	require.NoError(t, err)

	db, err := server.NewStore(cfg, false, logger)
	require.NoError(t, err)

	permissionsService := localpermissions.New(db, logger)

	params := server.Params{
		Cfg:                cfg,
		DBStore:            db,
		Logger:             logger,
		PermissionsService: permissionsService,
	}

	srv, err := server.New(params)
	require.NoError(t, err)

	// Reduce password has strength for unit tests to dramatically speed up account creation and login
	auth.PasswordHashStrength = 4

	return srv
}

func SetupTestHelperWithToken(t *testing.T) *TestHelper {
	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	sessionToken := "TESTTOKEN"

	th := &TestHelper{
		T:                  t,
		origEnvUnitTesting: origUnitTesting,
	}

	th.Server = newTestServer(t, sessionToken)
	th.Client = client.NewClient(th.Server.Config().ServerRoot, sessionToken)
	th.Client2 = client.NewClient(th.Server.Config().ServerRoot, sessionToken)
	return th
}

func SetupTestHelper(t *testing.T) *TestHelper {
	return SetupTestHelperWithLicense(t, LicenseNone)
}

func SetupTestHelperPluginMode(t *testing.T) *TestHelper {
	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	th := &TestHelper{
		T:                  t,
		origEnvUnitTesting: origUnitTesting,
	}

	th.Server = NewTestServerPluginMode(t)
	th.Start()
	return th
}

func SetupTestHelperLocalMode(t *testing.T) *TestHelper {
	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	th := &TestHelper{
		T:                  t,
		origEnvUnitTesting: origUnitTesting,
	}

	th.Server = newTestServerLocalMode(t)
	th.Start()
	return th
}

func SetupTestHelperWithLicense(t *testing.T, licenseType LicenseType) *TestHelper {
	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	th := &TestHelper{
		T:                  t,
		origEnvUnitTesting: origUnitTesting,
	}

	th.Server = newTestServerWithLicense(t, "", licenseType)
	th.Client = client.NewClient(th.Server.Config().ServerRoot, "")
	th.Client2 = client.NewClient(th.Server.Config().ServerRoot, "")
	return th
}

// Start starts the test server and ensures that it's correctly
// responding to requests before returning.
func (th *TestHelper) Start() *TestHelper {
	go func() {
		if err := th.Server.Start(); err != nil {
			panic(err)
		}
	}()

	for {
		URL := th.Server.Config().ServerRoot
		th.Server.Logger().Info("Polling server", mlog.String("url", URL))
		resp, err := http.Get(URL) //nolint:gosec
		if err != nil {
			th.Server.Logger().Error("Polling failed", mlog.Err(err))
			time.Sleep(100 * time.Millisecond)
			continue
		}
		resp.Body.Close()

		// Currently returns 404
		// if resp.StatusCode != http.StatusOK {
		// 	th.Server.Logger().Error("Not OK", mlog.Int("statusCode", resp.StatusCode))
		// 	continue
		// }

		// Reached this point: server is up and running!
		th.Server.Logger().Info("Server ping OK", mlog.Int("statusCode", resp.StatusCode))

		break
	}

	return th
}

// InitBasic starts the test server and initializes the clients of the
// helper, registering them and logging them into the system.
func (th *TestHelper) InitBasic() *TestHelper {
	// Reduce password has strength for unit tests to dramatically speed up account creation and login
	auth.PasswordHashStrength = 4

	th.Start()

	// user1
	th.RegisterAndLogin(th.Client, user1Username, "user1@sample.com", password, "")

	// get token
	team, resp := th.Client.GetTeam(model.GlobalTeamID)
	th.CheckOK(resp)
	require.NotNil(th.T, team)
	require.NotNil(th.T, team.SignupToken)

	// user2
	th.RegisterAndLogin(th.Client2, user2Username, "user2@sample.com", password, team.SignupToken)

	return th
}

var ErrRegisterFail = errors.New("register failed")

func (th *TestHelper) TearDown() {
	os.Setenv("FOCALBOARD_UNIT_TESTING", th.origEnvUnitTesting)

	logger := th.Server.Logger()

	if l, ok := logger.(*mlog.Logger); ok {
		defer func() { _ = l.Shutdown() }()
	}

	err := th.Server.Shutdown()
	if err != nil {
		panic(err)
	}

	err = th.Server.Store().Shutdown()
	if err != nil {
		panic(err)
	}

	os.RemoveAll(th.Server.Config().FilesPath)

	if err := os.Remove(th.Server.Config().DBConfigString); err == nil {
		logger.Debug("Removed test database", mlog.String("file", th.Server.Config().DBConfigString))
	}
}

func (th *TestHelper) RegisterAndLogin(client *client.Client, username, email, password, token string) {
	req := &model.RegisterRequest{
		Username: username,
		Email:    email,
		Password: password,
		Token:    token,
	}

	success, resp := th.Client.Register(req)
	th.CheckOK(resp)
	require.True(th.T, success)

	th.Login(client, username, password)
}

func (th *TestHelper) Login(client *client.Client, username, password string) {
	req := &model.LoginRequest{
		Type:     "normal",
		Username: username,
		Password: password,
	}
	data, resp := client.Login(req)
	th.CheckOK(resp)
	require.NotNil(th.T, data)
}

func (th *TestHelper) Login1() {
	th.Login(th.Client, user1Username, password)
}

func (th *TestHelper) Login2() {
	th.Login(th.Client2, user2Username, password)
}

func (th *TestHelper) Logout(client *client.Client) {
	client.Token = ""
}

func (th *TestHelper) Me(client *client.Client) *model.User {
	user, resp := client.GetMe()
	th.CheckOK(resp)
	require.NotNil(th.T, user)
	return user
}

func (th *TestHelper) CreateBoard(teamID string, boardType model.BoardType) *model.Board {
	newBoard := &model.Board{
		TeamID: teamID,
		Type:   boardType,
	}
	board, resp := th.Client.CreateBoard(newBoard)
	th.CheckOK(resp)
	return board
}

func (th *TestHelper) CreateBoards(teamID string, boardType model.BoardType, count int) []*model.Board {
	boards := make([]*model.Board, 0, count)

	for i := 0; i < count; i++ {
		board := th.CreateBoard(teamID, boardType)
		boards = append(boards, board)
	}
	return boards
}

func (th *TestHelper) CreateCategory(category model.Category) *model.Category {
	cat, resp := th.Client.CreateCategory(category)
	th.CheckOK(resp)
	return cat
}

func (th *TestHelper) UpdateCategoryBoard(teamID, categoryID, boardID string) {
	response := th.Client.UpdateCategoryBoard(teamID, categoryID, boardID)
	th.CheckOK(response)
}

func (th *TestHelper) CreateBoardAndCards(teamdID string, boardType model.BoardType, numCards int) (*model.Board, []*model.Card) {
	board := th.CreateBoard(teamdID, boardType)
	cards := make([]*model.Card, 0, numCards)
	for i := 0; i < numCards; i++ {
		card := &model.Card{
			Title:        fmt.Sprintf("test card %d", i+1),
			ContentOrder: []string{utils.NewID(utils.IDTypeBlock), utils.NewID(utils.IDTypeBlock), utils.NewID(utils.IDTypeBlock)},
			Icon:         "😱",
			Properties:   th.MakeCardProps(5),
		}
		newCard, resp := th.Client.CreateCard(board.ID, card, true)
		th.CheckOK(resp)
		cards = append(cards, newCard)
	}
	return board, cards
}

func (th *TestHelper) MakeCardProps(count int) map[string]any {
	props := make(map[string]any)
	for i := 0; i < count; i++ {
		props[utils.NewID(utils.IDTypeBlock)] = utils.NewID(utils.IDTypeBlock)
	}
	return props
}

func (th *TestHelper) GetUserCategoryBoards(teamID string) []model.CategoryBoards {
	categoryBoards, response := th.Client.GetUserCategoryBoards(teamID)
	th.CheckOK(response)
	return categoryBoards
}

func (th *TestHelper) DeleteCategory(teamID, categoryID string) {
	response := th.Client.DeleteCategory(teamID, categoryID)
	th.CheckOK(response)
}

func (th *TestHelper) GetUser1() *model.User {
	return th.Me(th.Client)
}

func (th *TestHelper) GetUser2() *model.User {
	return th.Me(th.Client2)
}

func (th *TestHelper) CheckOK(r *client.Response) {
	require.Equal(th.T, http.StatusOK, r.StatusCode)
	require.NoError(th.T, r.Error)
}

func (th *TestHelper) CheckBadRequest(r *client.Response) {
	require.Equal(th.T, http.StatusBadRequest, r.StatusCode)
	require.Error(th.T, r.Error)
}

func (th *TestHelper) CheckNotFound(r *client.Response) {
	require.Equal(th.T, http.StatusNotFound, r.StatusCode)
	require.Error(th.T, r.Error)
}

func (th *TestHelper) CheckUnauthorized(r *client.Response) {
	require.Equal(th.T, http.StatusUnauthorized, r.StatusCode)
	require.Error(th.T, r.Error)
}

func (th *TestHelper) CheckForbidden(r *client.Response) {
	require.Equal(th.T, http.StatusForbidden, r.StatusCode)
	require.Error(th.T, r.Error)
}

func (th *TestHelper) CheckRequestEntityTooLarge(r *client.Response) {
	require.Equal(th.T, http.StatusRequestEntityTooLarge, r.StatusCode)
	require.Error(th.T, r.Error)
}

func (th *TestHelper) CheckNotImplemented(r *client.Response) {
	require.Equal(th.T, http.StatusNotImplemented, r.StatusCode)
	require.Error(th.T, r.Error)
}
