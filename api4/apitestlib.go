// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"reflect"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/wsapi"

	s3 "github.com/minio/minio-go"
	"github.com/minio/minio-go/pkg/credentials"
)

type TestHelper struct {
	App            *app.App
	originalConfig *model.Config

	Client              *model.Client4
	BasicUser           *model.User
	BasicUser2          *model.User
	TeamAdminUser       *model.User
	BasicTeam           *model.Team
	BasicChannel        *model.Channel
	BasicPrivateChannel *model.Channel
	BasicChannel2       *model.Channel
	BasicPost           *model.Post

	SystemAdminClient *model.Client4
	SystemAdminUser   *model.User
}

type persistentTestStore struct {
	store.Store
}

func (*persistentTestStore) Close() {}

var testStoreContainer *storetest.RunningContainer
var testStore *persistentTestStore

// UseTestStore sets the container and corresponding settings to use for tests. Once the tests are
// complete (e.g. at the end of your TestMain implementation), you should call StopTestStore.
func UseTestStore(container *storetest.RunningContainer, settings *model.SqlSettings) {
	testStoreContainer = container
	testStore = &persistentTestStore{store.NewLayeredStore(sqlstore.NewSqlSupplier(*settings, nil), nil, nil)}
}

func StopTestStore() {
	if testStoreContainer != nil {
		testStoreContainer.Stop()
		testStoreContainer = nil
	}
}

func setupTestHelper(enterprise bool) *TestHelper {
	var options []app.Option
	if testStore != nil {
		options = append(options, app.StoreOverride(testStore))
	}

	th := &TestHelper{
		App: app.New(options...),
	}
	th.originalConfig = th.App.Config().Clone()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.MaxUsersPerTeam = 50
		*cfg.RateLimitSettings.Enable = false
		cfg.EmailSettings.SendEmailNotifications = true
	})
	prevListenAddress := *th.App.Config().ServiceSettings.ListenAddress
	if testStore != nil {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	}
	th.App.StartServer()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = prevListenAddress })
	Init(th.App, th.App.Srv.Router, true)
	wsapi.Init(th.App, th.App.Srv.WebSocketRouter)
	th.App.Srv.Store.MarkSystemRanUnitTests()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })

	utils.SetIsLicensed(enterprise)
	if enterprise {
		utils.License().Features.SetDefaults()
	}

	th.Client = th.CreateClient()
	th.SystemAdminClient = th.CreateClient()
	return th
}

func SetupEnterprise() *TestHelper {
	return setupTestHelper(true)
}

func Setup() *TestHelper {
	return setupTestHelper(false)
}

func (me *TestHelper) TearDown() {
	utils.DisableDebugLogForTest()

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		options := map[string]bool{}
		options[store.USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME] = true
		if result := <-me.App.Srv.Store.User().Search("", "fakeuser", options); result.Err != nil {
			l4g.Error("Error tearing down test users")
		} else {
			users := result.Data.([]*model.User)

			for _, u := range users {
				if err := me.App.PermanentDeleteUser(u); err != nil {
					l4g.Error(err.Error())
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		if result := <-me.App.Srv.Store.Team().SearchByName("faketeam"); result.Err != nil {
			l4g.Error("Error tearing down test teams")
		} else {
			teams := result.Data.([]*model.Team)

			for _, t := range teams {
				if err := me.App.PermanentDeleteTeam(t); err != nil {
					l4g.Error(err.Error())
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		if result := <-me.App.Srv.Store.OAuth().GetApps(0, 1000); result.Err != nil {
			l4g.Error("Error tearing down test oauth apps")
		} else {
			apps := result.Data.([]*model.OAuthApp)

			for _, a := range apps {
				if strings.HasPrefix(a.Name, "fakeoauthapp") {
					<-me.App.Srv.Store.OAuth().DeleteApp(a.Id)
				}
			}
		}
	}()

	wg.Wait()

	me.App.UpdateConfig(func(cfg *model.Config) {
		*cfg = *me.originalConfig
	})

	me.App.Shutdown()

	utils.EnableDebugLogForTest()

	if err := recover(); err != nil {
		StopTestStore()
		panic(err)
	}
}

func (me *TestHelper) InitBasic() *TestHelper {
	me.waitForConnectivity()

	me.TeamAdminUser = me.CreateUser()
	me.App.UpdateUserRoles(me.TeamAdminUser.Id, model.SYSTEM_USER_ROLE_ID, false)
	me.LoginTeamAdmin()
	me.BasicTeam = me.CreateTeam()
	me.BasicChannel = me.CreatePublicChannel()
	me.BasicPrivateChannel = me.CreatePrivateChannel()
	me.BasicChannel2 = me.CreatePublicChannel()
	me.BasicPost = me.CreatePost()
	me.BasicUser = me.CreateUser()
	me.LinkUserToTeam(me.BasicUser, me.BasicTeam)
	me.BasicUser2 = me.CreateUser()
	me.LinkUserToTeam(me.BasicUser2, me.BasicTeam)
	me.App.AddUserToChannel(me.BasicUser, me.BasicChannel)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicChannel)
	me.App.AddUserToChannel(me.BasicUser, me.BasicChannel2)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicChannel2)
	me.App.AddUserToChannel(me.BasicUser, me.BasicPrivateChannel)
	me.App.AddUserToChannel(me.BasicUser2, me.BasicPrivateChannel)
	me.App.UpdateUserRoles(me.BasicUser.Id, model.SYSTEM_USER_ROLE_ID, false)
	me.LoginBasic()

	return me
}

func (me *TestHelper) InitSystemAdmin() *TestHelper {
	me.waitForConnectivity()

	me.SystemAdminUser = me.CreateUser()
	me.App.UpdateUserRoles(me.SystemAdminUser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_ADMIN_ROLE_ID, false)
	me.LoginSystemAdmin()

	return me
}

func (me *TestHelper) waitForConnectivity() {
	for i := 0; i < 1000; i++ {
		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%v", me.App.Srv.ListenAddr.Port))
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(time.Millisecond * 20)
	}
	panic("unable to connect")
}

func (me *TestHelper) CreateClient() *model.Client4 {
	return model.NewAPIv4Client(fmt.Sprintf("http://localhost:%v", me.App.Srv.ListenAddr.Port))
}

func (me *TestHelper) CreateWebSocketClient() (*model.WebSocketClient, *model.AppError) {
	return model.NewWebSocketClient4(fmt.Sprintf("ws://localhost:%v", me.App.Srv.ListenAddr.Port), me.Client.AuthToken)
}

func (me *TestHelper) CreateUser() *model.User {
	return me.CreateUserWithClient(me.Client)
}

func (me *TestHelper) CreateTeam() *model.Team {
	return me.CreateTeamWithClient(me.Client)
}

func (me *TestHelper) CreateTeamWithClient(client *model.Client4) *model.Team {
	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        GenerateTestTeamName(),
		Email:       GenerateTestEmail(),
		Type:        model.TEAM_OPEN,
	}

	utils.DisableDebugLogForTest()
	rteam, _ := client.CreateTeam(team)
	utils.EnableDebugLogForTest()
	return rteam
}

func (me *TestHelper) CreateUserWithClient(client *model.Client4) *model.User {
	id := model.NewId()

	user := &model.User{
		Email:     GenerateTestEmail(),
		Username:  GenerateTestUsername(),
		Nickname:  "nn_" + id,
		FirstName: "f_" + id,
		LastName:  "l_" + id,
		Password:  "Password1",
	}

	utils.DisableDebugLogForTest()
	ruser, r := client.CreateUser(user)
	fmt.Println(r)
	ruser.Password = "Password1"
	store.Must(me.App.Srv.Store.User().VerifyEmail(ruser.Id))
	utils.EnableDebugLogForTest()
	return ruser
}

func (me *TestHelper) CreatePublicChannel() *model.Channel {
	return me.CreateChannelWithClient(me.Client, model.CHANNEL_OPEN)
}

func (me *TestHelper) CreatePrivateChannel() *model.Channel {
	return me.CreateChannelWithClient(me.Client, model.CHANNEL_PRIVATE)
}

func (me *TestHelper) CreateChannelWithClient(client *model.Client4, channelType string) *model.Channel {
	return me.CreateChannelWithClientAndTeam(client, channelType, me.BasicTeam.Id)
}

func (me *TestHelper) CreateChannelWithClientAndTeam(client *model.Client4, channelType string, teamId string) *model.Channel {
	id := model.NewId()

	channel := &model.Channel{
		DisplayName: "dn_" + id,
		Name:        GenerateTestChannelName(),
		Type:        channelType,
		TeamId:      teamId,
	}

	utils.DisableDebugLogForTest()
	rchannel, _ := client.CreateChannel(channel)
	utils.EnableDebugLogForTest()
	return rchannel
}

func (me *TestHelper) CreatePost() *model.Post {
	return me.CreatePostWithClient(me.Client, me.BasicChannel)
}

func (me *TestHelper) CreatePinnedPost() *model.Post {
	return me.CreatePinnedPostWithClient(me.Client, me.BasicChannel)
}

func (me *TestHelper) CreateMessagePost(message string) *model.Post {
	return me.CreateMessagePostWithClient(me.Client, me.BasicChannel, message)
}

func (me *TestHelper) CreatePostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) CreatePinnedPostWithClient(client *model.Client4, channel *model.Channel) *model.Post {
	id := model.NewId()

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   "message_" + id,
		IsPinned:  true,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) CreateMessagePostWithClient(client *model.Client4, channel *model.Channel, message string) *model.Post {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
	}

	utils.DisableDebugLogForTest()
	rpost, resp := client.CreatePost(post)
	if resp.Error != nil {
		panic(resp.Error)
	}
	utils.EnableDebugLogForTest()
	return rpost
}

func (me *TestHelper) LoginBasic() {
	me.LoginBasicWithClient(me.Client)
}

func (me *TestHelper) LoginBasic2() {
	me.LoginBasic2WithClient(me.Client)
}

func (me *TestHelper) LoginTeamAdmin() {
	me.LoginTeamAdminWithClient(me.Client)
}

func (me *TestHelper) LoginSystemAdmin() {
	me.LoginSystemAdminWithClient(me.SystemAdminClient)
}

func (me *TestHelper) LoginBasicWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	client.Login(me.BasicUser.Email, me.BasicUser.Password)
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginBasic2WithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	client.Login(me.BasicUser2.Email, me.BasicUser2.Password)
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginTeamAdminWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	client.Login(me.TeamAdminUser.Email, me.TeamAdminUser.Password)
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LoginSystemAdminWithClient(client *model.Client4) {
	utils.DisableDebugLogForTest()
	client.Login(me.SystemAdminUser.Email, me.SystemAdminUser.Password)
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateActiveUser(user *model.User, active bool) {
	utils.DisableDebugLogForTest()

	_, err := me.App.UpdateActive(user, active)
	if err != nil {
		l4g.Error(err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) LinkUserToTeam(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	err := me.App.JoinUserToTeam(team, user, "")
	if err != nil {
		l4g.Error(err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	utils.EnableDebugLogForTest()
}

func GenerateTestEmail() string {
	if utils.Cfg.EmailSettings.SMTPServer != "dockerhost" && os.Getenv("CI_INBUCKET_PORT") == "" {
		return strings.ToLower("success+" + model.NewId() + "@simulator.amazonses.com")
	}
	return strings.ToLower(model.NewId() + "@dockerhost")
}

func GenerateTestUsername() string {
	return "fakeuser" + model.NewRandomString(10)
}

func GenerateTestTeamName() string {
	return "faketeam" + model.NewRandomString(6)
}

func GenerateTestChannelName() string {
	return "fakechannel" + model.NewRandomString(10)
}

func GenerateTestAppName() string {
	return "fakeoauthapp" + model.NewRandomString(10)
}

func GenerateTestId() string {
	return model.NewId()
}

func CheckUserSanitization(t *testing.T, user *model.User) {
	if user.Password != "" {
		t.Fatal("password wasn't blank")
	}

	if user.AuthData != nil && *user.AuthData != "" {
		t.Fatal("auth data wasn't blank")
	}

	if user.MfaSecret != "" {
		t.Fatal("mfa secret wasn't blank")
	}
}

func CheckTeamSanitization(t *testing.T, team *model.Team) {
	if team.Email != "" {
		t.Fatal("email wasn't blank")
	}

	if team.AllowedDomains != "" {
		t.Fatal("'allowed domains' wasn't blank")
	}
}

func CheckEtag(t *testing.T, data interface{}, resp *model.Response) {
	if !reflect.ValueOf(data).IsNil() {
		debug.PrintStack()
		t.Fatal("etag data was not nil")
	}

	if resp.StatusCode != http.StatusNotModified {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusNotModified))
		t.Fatal("wrong status code for etag")
	}
}

func CheckNoError(t *testing.T, resp *model.Response) {
	if resp.Error != nil {
		debug.PrintStack()
		t.Fatal("Expected no error, got " + resp.Error.Error())
	}
}

func CheckCreatedStatus(t *testing.T, resp *model.Response) {
	if resp.StatusCode != http.StatusCreated {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusCreated))
		t.Fatal("wrong status code")
	}
}

func CheckForbiddenStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusForbidden))
		return
	}

	if resp.StatusCode != http.StatusForbidden {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusForbidden))
		t.Fatal("wrong status code")
	}
}

func CheckUnauthorizedStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusUnauthorized))
		return
	}

	if resp.StatusCode != http.StatusUnauthorized {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusUnauthorized))
		t.Fatal("wrong status code")
	}
}

func CheckNotFoundStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusNotFound))
		return
	}

	if resp.StatusCode != http.StatusNotFound {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusNotFound))
		t.Fatal("wrong status code")
	}
}

func CheckBadRequestStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusBadRequest))
		return
	}

	if resp.StatusCode != http.StatusBadRequest {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
		t.Fatal("wrong status code")
	}
}

func CheckNotImplementedStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusNotImplemented))
		return
	}

	if resp.StatusCode != http.StatusNotImplemented {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusNotImplemented))
		t.Fatal("wrong status code")
	}
}

func CheckOKStatus(t *testing.T, resp *model.Response) {
	CheckNoError(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("wrong status code. expected %d got %d", http.StatusOK, resp.StatusCode)
	}
}

func CheckErrorMessage(t *testing.T, resp *model.Response, errorId string) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with message:" + errorId)
		return
	}

	if resp.Error.Id != errorId {
		debug.PrintStack()
		t.Log("actual: " + resp.Error.Id)
		t.Log("expected: " + errorId)
		t.Fatal("incorrect error message")
	}
}

func CheckInternalErrorStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusInternalServerError))
		return
	}

	if resp.StatusCode != http.StatusInternalServerError {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusInternalServerError))
		t.Fatal("wrong status code")
	}
}

func CheckPayLoadTooLargeStatus(t *testing.T, resp *model.Response) {
	if resp.Error == nil {
		debug.PrintStack()
		t.Fatal("should have errored with status:" + strconv.Itoa(http.StatusRequestEntityTooLarge))
		return
	}

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		debug.PrintStack()
		t.Log("actual: " + strconv.Itoa(resp.StatusCode))
		t.Log("expected: " + strconv.Itoa(http.StatusRequestEntityTooLarge))
		t.Fatal("wrong status code")
	}
}

func readTestFile(name string) ([]byte, error) {
	path, _ := utils.FindDir("tests")
	file, err := os.Open(path + "/" + name)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &bytes.Buffer{}
	if _, err := io.Copy(data, file); err != nil {
		return nil, err
	} else {
		return data.Bytes(), nil
	}
}

// Similar to s3.New() but allows initialization of signature v2 or signature v4 client.
// If signV2 input is false, function always returns signature v4.
//
// Additionally this function also takes a user defined region, if set
// disables automatic region lookup.
func s3New(endpoint, accessKey, secretKey string, secure bool, signV2 bool, region string) (*s3.Client, error) {
	var creds *credentials.Credentials
	if signV2 {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV2)
	} else {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV4)
	}
	return s3.NewWithCredentials(endpoint, creds, secure, region)
}

func (me *TestHelper) cleanupTestFile(info *model.FileInfo) error {
	cfg := me.App.Config()
	if *cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := cfg.FileSettings.AmazonS3Endpoint
		accessKey := cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *cfg.FileSettings.AmazonS3SSL
		signV2 := *cfg.FileSettings.AmazonS3SignV2
		region := cfg.FileSettings.AmazonS3Region
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return err
		}
		bucket := cfg.FileSettings.AmazonS3Bucket
		if err := s3Clnt.RemoveObject(bucket, info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := s3Clnt.RemoveObject(bucket, info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := s3Clnt.RemoveObject(bucket, info.PreviewPath); err != nil {
				return err
			}
		}
	} else if *cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.Remove(cfg.FileSettings.Directory + info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := os.Remove(cfg.FileSettings.Directory + info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := os.Remove(cfg.FileSettings.Directory + info.PreviewPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func (me *TestHelper) MakeUserChannelAdmin(user *model.User, channel *model.Channel) {
	utils.DisableDebugLogForTest()

	if cmr := <-me.App.Srv.Store.Channel().GetMember(channel.Id, user.Id); cmr.Err == nil {
		cm := cmr.Data.(*model.ChannelMember)
		cm.Roles = "channel_admin channel_user"
		if sr := <-me.App.Srv.Store.Channel().UpdateMember(cm); sr.Err != nil {
			utils.EnableDebugLogForTest()
			panic(sr.Err)
		}
	} else {
		utils.EnableDebugLogForTest()
		panic(cmr.Err)
	}

	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateUserToTeamAdmin(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	tm := &model.TeamMember{TeamId: team.Id, UserId: user.Id, Roles: model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID}
	if tmr := <-me.App.Srv.Store.Team().UpdateMember(tm); tmr.Err != nil {
		utils.EnableDebugLogForTest()
		l4g.Error(tmr.Err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(tmr.Err)
	}
	utils.EnableDebugLogForTest()
}

func (me *TestHelper) UpdateUserToNonTeamAdmin(user *model.User, team *model.Team) {
	utils.DisableDebugLogForTest()

	tm := &model.TeamMember{TeamId: team.Id, UserId: user.Id, Roles: model.TEAM_USER_ROLE_ID}
	if tmr := <-me.App.Srv.Store.Team().UpdateMember(tm); tmr.Err != nil {
		utils.EnableDebugLogForTest()
		l4g.Error(tmr.Err.Error())
		l4g.Close()
		time.Sleep(time.Second)
		panic(tmr.Err)
	}
	utils.EnableDebugLogForTest()
}
