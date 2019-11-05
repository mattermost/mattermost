// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/testutils"
)

func TestCreatePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a", Props: model.StringInterface{model.PROPS_ADD_CHANNEL_MEMBER: "no good"}}
	rpost, resp := Client.CreatePost(post)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	if rpost.Message != post.Message {
		t.Fatal("message didn't match")
	}

	if rpost.Hashtags != "#hashtag" {
		t.Fatal("hashtag didn't match")
	}

	if len(rpost.FileIds) != 0 {
		t.Fatal("shouldn't have files")
	}

	if rpost.EditAt != 0 {
		t.Fatal("newly created post shouldn't have EditAt set")
	}

	if rpost.Props[model.PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("newly created post shouldn't have Props['add_channel_member'] set")
	}

	post.RootId = rpost.Id
	post.ParentId = rpost.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.RootId = "junk"
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post.RootId = rpost.Id
	post.ParentId = "junk"
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post2 := &model.Post{ChannelId: th.BasicChannel2.Id, Message: "zz" + model.NewId() + "a", CreateAt: 123}
	rpost2, _ := Client.CreatePost(post2)

	if rpost2.CreateAt == post2.CreateAt {
		t.Fatal("create at should not match")
	}

	t.Run("with file uploaded by same user", func(t *testing.T) {
		fileResp, subResponse := Client.UploadFile([]byte("data"), th.BasicChannel.Id, "test")
		CheckNoError(t, subResponse)
		fileId := fileResp.FileInfos[0].Id

		postWithFiles, subResponse := Client.CreatePost(&model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		CheckNoError(t, subResponse)
		assert.Equal(t, model.StringArray{fileId}, postWithFiles.FileIds)

		actualPostWithFiles, subResponse := Client.GetPost(postWithFiles.Id, "")
		CheckNoError(t, subResponse)
		assert.Equal(t, model.StringArray{fileId}, actualPostWithFiles.FileIds)
	})

	t.Run("with file uploaded by different user", func(t *testing.T) {
		fileResp, subResponse := th.SystemAdminClient.UploadFile([]byte("data"), th.BasicChannel.Id, "test")
		CheckNoError(t, subResponse)
		fileId := fileResp.FileInfos[0].Id

		postWithFiles, subResponse := Client.CreatePost(&model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		CheckNoError(t, subResponse)
		assert.Empty(t, postWithFiles.FileIds)

		actualPostWithFiles, subResponse := Client.GetPost(postWithFiles.Id, "")
		CheckNoError(t, subResponse)
		assert.Empty(t, actualPostWithFiles.FileIds)
	})

	t.Run("with file uploaded by nouser", func(t *testing.T) {
		fileInfo, err := th.App.UploadFile([]byte("data"), th.BasicChannel.Id, "test")
		require.Nil(t, err)
		fileId := fileInfo.Id

		postWithFiles, subResponse := Client.CreatePost(&model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "with files",
			FileIds:   model.StringArray{fileId},
		})
		CheckNoError(t, subResponse)
		assert.Equal(t, model.StringArray{fileId}, postWithFiles.FileIds)

		actualPostWithFiles, subResponse := Client.GetPost(postWithFiles.Id, "")
		CheckNoError(t, subResponse)
		assert.Equal(t, model.StringArray{fileId}, actualPostWithFiles.FileIds)
	})

	post.RootId = ""
	post.ParentId = ""
	post.Type = model.POST_SYSTEM_GENERIC
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post.Type = ""
	post.RootId = rpost2.Id
	post.ParentId = rpost2.Id
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post.RootId = ""
	post.ParentId = ""
	post.ChannelId = "junk"
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	post.ChannelId = model.NewId()
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPost("/posts", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.CreatePost(post)
	CheckUnauthorizedStatus(t, resp)

	post.ChannelId = th.BasicChannel.Id
	post.CreateAt = 123
	rpost, resp = th.SystemAdminClient.CreatePost(post)
	CheckNoError(t, resp)

	if rpost.CreateAt != post.CreateAt {
		t.Fatal("create at should match")
	}
}

func TestCreatePostEphemeral(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.SystemAdminClient

	ephemeralPost := &model.PostEphemeral{
		UserID: th.BasicUser2.Id,
		Post:   &model.Post{ChannelId: th.BasicChannel.Id, Message: "a" + model.NewId() + "a", Props: model.StringInterface{model.PROPS_ADD_CHANNEL_MEMBER: "no good"}},
	}

	rpost, resp := Client.CreatePostEphemeral(ephemeralPost)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	if rpost.Message != ephemeralPost.Post.Message {
		t.Fatal("message didn't match")
	}

	if rpost.EditAt != 0 {
		t.Fatal("newly created ephemeral post shouldn't have EditAt set")
	}

	if r, err := Client.DoApiPost("/posts/ephemeral", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.CreatePostEphemeral(ephemeralPost)
	CheckUnauthorizedStatus(t, resp)

	Client = th.Client
	_, resp = Client.CreatePostEphemeral(ephemeralPost)
	CheckForbiddenStatus(t, resp)
}

func testCreatePostWithOutgoingHook(
	t *testing.T,
	hookContentType, expectedContentType, message, triggerWord string,
	fileIds []string,
	triggerWhen int,
	commentPostType bool,
) {
	th := Setup().InitBasic()
	defer th.TearDown()
	user := th.SystemAdminUser
	team := th.BasicTeam
	channel := th.BasicChannel

	enableOutgoingWebhooks := *th.App.Config().ServiceSettings.EnableOutgoingWebhooks
	allowedUntrustedInternalConnections := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingWebhooks })
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = allowedUntrustedInternalConnections
		})
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	var hook *model.OutgoingWebhook
	var post *model.Post

	// Create a test server that is the target of the outgoing webhook. It will
	// validate the webhook body fields and write to the success channel on
	// success/failure.
	success := make(chan bool)
	wait := make(chan bool, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-wait

		requestContentType := r.Header.Get("Content-Type")
		if requestContentType != expectedContentType {
			t.Logf("Content-Type is %s, should be %s", requestContentType, expectedContentType)
			success <- false
			return
		}

		expectedPayload := &model.OutgoingWebhookPayload{
			Token:       hook.Token,
			TeamId:      hook.TeamId,
			TeamDomain:  team.Name,
			ChannelId:   post.ChannelId,
			ChannelName: channel.Name,
			Timestamp:   post.CreateAt,
			UserId:      post.UserId,
			UserName:    user.Username,
			PostId:      post.Id,
			Text:        post.Message,
			TriggerWord: triggerWord,
			FileIds:     strings.Join(post.FileIds, ","),
		}

		// depending on the Content-Type, we expect to find a JSON or form encoded payload
		if requestContentType == "application/json" {
			decoder := json.NewDecoder(r.Body)
			o := &model.OutgoingWebhookPayload{}
			decoder.Decode(&o)

			if !reflect.DeepEqual(expectedPayload, o) {
				t.Logf("JSON payload is %+v, should be %+v", o, expectedPayload)
				success <- false
				return
			}
		} else {
			err := r.ParseForm()
			if err != nil {
				t.Logf("Error parsing form: %q", err)
				success <- false
				return
			}

			expectedFormValues, _ := url.ParseQuery(expectedPayload.ToFormValues())

			if !reflect.DeepEqual(expectedFormValues, r.Form) {
				t.Logf("Form values are: %q\n, should be: %q\n", r.Form, expectedFormValues)
				success <- false
				return
			}
		}

		respPostType := "" //if is empty or post will do a normal post.
		if commentPostType {
			respPostType = model.OUTGOING_HOOK_RESPONSE_TYPE_COMMENT
		}

		outGoingHookResponse := &model.OutgoingWebhookResponse{
			Text:         model.NewString("some test text"),
			Username:     "TestCommandServer",
			IconURL:      "https://www.mattermost.org/wp-content/uploads/2016/04/icon.png",
			Type:         "custom_as",
			ResponseType: respPostType,
		}

		fmt.Fprintf(w, outGoingHookResponse.ToJson())
		success <- true
	}))
	defer ts.Close()

	// create an outgoing webhook, passing it the test server URL
	var triggerWords []string
	if triggerWord != "" {
		triggerWords = []string{triggerWord}
	}

	hook = &model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       team.Id,
		ContentType:  hookContentType,
		TriggerWords: triggerWords,
		TriggerWhen:  triggerWhen,
		CallbackURLs: []string{ts.URL},
	}

	hook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	// create a post to trigger the webhook
	post = &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		FileIds:   fileIds,
	}

	post, resp = th.SystemAdminClient.CreatePost(post)
	CheckNoError(t, resp)

	wait <- true

	// We wait for the test server to write to the success channel and we make
	// the test fail if that doesn't happen before the timeout.
	select {
	case ok := <-success:
		if !ok {
			t.Fatal("Test server did send an invalid webhook.")
		}
	case <-time.After(time.Second):
		t.Fatal("Timeout, test server did not send the webhook.")
	}

	if commentPostType {
		time.Sleep(time.Millisecond * 100)
		postList, resp := th.SystemAdminClient.GetPostThread(post.Id, "")
		CheckNoError(t, resp)
		if postList.Order[0] != post.Id {
			t.Fatal("wrong order")
		}

		if _, ok := postList.Posts[post.Id]; !ok {
			t.Fatal("should have had post")
		}

		if len(postList.Posts) != 2 {
			t.Fatal("should have 2 posts")
		}

	}
}

func TestCreatePostWithOutgoingHook_form_urlencoded(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, true)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, true)
}

func TestCreatePostWithOutgoingHook_json(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH, true)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, true)
}

// hooks created before we added the ContentType field should be considered as
// application/x-www-form-urlencoded
func TestCreatePostWithOutgoingHook_no_content_type(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH, false)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_STARTS_WITH, false)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH, true)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH, true)
}

func TestCreatePostPublic(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a"}

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Joram Wilander", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_USER_ROLE_ID}

	ruser, resp := Client.CreateUser(&user)
	CheckNoError(t, resp)

	Client.Login(user.Email, user.Password)

	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateUserRoles(ruser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_POST_ALL_PUBLIC_ROLE_ID, false)
	th.App.InvalidateAllCaches()

	Client.Login(user.Email, user.Password)

	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateUserRoles(ruser.Id, model.SYSTEM_USER_ROLE_ID, false)
	th.App.JoinUserToTeam(th.BasicTeam, ruser, "")
	th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, model.TEAM_USER_ROLE_ID+" "+model.TEAM_POST_ALL_PUBLIC_ROLE_ID)
	th.App.InvalidateAllCaches()

	Client.Login(user.Email, user.Password)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	post.ChannelId = th.BasicChannel.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)
}

func TestCreatePostAll(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a"}

	user := model.User{Email: th.GenerateTestEmail(), Nickname: "Joram Wilander", Password: "hello1", Username: GenerateTestUsername(), Roles: model.SYSTEM_USER_ROLE_ID}

	directChannel, _ := th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)

	ruser, resp := Client.CreateUser(&user)
	CheckNoError(t, resp)

	Client.Login(user.Email, user.Password)

	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateUserRoles(ruser.Id, model.SYSTEM_USER_ROLE_ID+" "+model.SYSTEM_POST_ALL_ROLE_ID, false)
	th.App.InvalidateAllCaches()

	Client.Login(user.Email, user.Password)

	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.ChannelId = directChannel.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	th.App.UpdateUserRoles(ruser.Id, model.SYSTEM_USER_ROLE_ID, false)
	th.App.JoinUserToTeam(th.BasicTeam, ruser, "")
	th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, model.TEAM_USER_ROLE_ID+" "+model.TEAM_POST_ALL_ROLE_ID)
	th.App.InvalidateAllCaches()

	Client.Login(user.Email, user.Password)

	post.ChannelId = th.BasicPrivateChannel.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.ChannelId = th.BasicChannel.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.ChannelId = directChannel.Id
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)
}

func TestCreatePostSendOutOfChannelMentions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	WebSocketClient.Listen()

	inChannelUser := th.CreateUser()
	th.LinkUserToTeam(inChannelUser, th.BasicTeam)
	th.App.AddUserToChannel(inChannelUser, th.BasicChannel)

	post1 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "@" + inChannelUser.Username}
	_, resp := Client.CreatePost(post1)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	timeout := time.After(300 * time.Millisecond)
	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.Event == model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE {
				t.Fatal("should not have ephemeral message event")
			}

		case <-timeout:
			waiting = false
		}
	}

	outOfChannelUser := th.CreateUser()
	th.LinkUserToTeam(outOfChannelUser, th.BasicTeam)

	post2 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "@" + outOfChannelUser.Username}
	_, resp = Client.CreatePost(post2)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	timeout = time.After(300 * time.Millisecond)
	waiting = true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.Event != model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE {
				// Ignore any other events
				continue
			}

			wpost := model.PostFromJson(strings.NewReader(event.Data["post"].(string)))
			if acm, ok := wpost.Props[model.PROPS_ADD_CHANNEL_MEMBER].(map[string]interface{}); !ok {
				t.Fatal("should have received ephemeral post with 'add_channel_member' in props")
			} else {
				if acm["post_id"] == nil || acm["user_ids"] == nil || acm["usernames"] == nil {
					t.Fatal("should not be nil")
				}
			}
			waiting = false
		case <-timeout:
			t.Fatal("timed out waiting for ephemeral message event")
		}
	}
}

func TestUpdatePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	th.App.SetLicense(model.NewTestLicense())

	fileIds := make([]string, 3)
	data, err := testutils.ReadTestFile("test.png")
	require.Nil(t, err)
	for i := 0; i < len(fileIds); i++ {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)
		fileIds[i] = fileResp.FileInfos[0].Id
	}

	rpost, err := th.App.CreatePost(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "zz" + model.NewId() + "a",
		FileIds:   fileIds,
	}, channel, false)
	require.Nil(t, err)

	assert.Equal(t, rpost.Message, rpost.Message, "full name didn't match")
	assert.EqualValues(t, 0, rpost.EditAt, "Newly created post shouldn't have EditAt set")
	assert.Equal(t, model.StringArray(fileIds), rpost.FileIds, "FileIds should have been set")

	t.Run("same message, fewer files", func(t *testing.T) {
		msg := "zz" + model.NewId() + " update post"
		rpost.Message = msg
		rpost.UserId = ""

		rupost, resp := Client.UpdatePost(rpost.Id, &model.Post{
			Id:      rpost.Id,
			Message: rpost.Message,
			FileIds: fileIds[0:2], // one fewer file id
		})
		CheckNoError(t, resp)

		assert.Equal(t, rupost.Message, msg, "failed to updates")
		assert.NotEqual(t, 0, rupost.EditAt, "EditAt not updated for post")
		assert.Equal(t, model.StringArray(fileIds), rupost.FileIds, "FileIds should have not have been updated")

		actual, resp := Client.GetPost(rpost.Id, "")
		CheckNoError(t, resp)

		assert.Equal(t, actual.Message, msg, "failed to updates")
		assert.NotEqual(t, 0, actual.EditAt, "EditAt not updated for post")
		assert.Equal(t, model.StringArray(fileIds), actual.FileIds, "FileIds should have not have been updated")
	})

	t.Run("new message, invalid props", func(t *testing.T) {
		msg1 := "#hashtag a" + model.NewId() + " update post again"
		rpost.Message = msg1
		rpost.Props[model.PROPS_ADD_CHANNEL_MEMBER] = "no good"
		rrupost, resp := Client.UpdatePost(rpost.Id, rpost)
		CheckNoError(t, resp)

		assert.Equal(t, msg1, rrupost.Message, "failed to update message")
		assert.Equal(t, "#hashtag", rrupost.Hashtags, "failed to update hashtags")
		assert.Nil(t, rrupost.Props[model.PROPS_ADD_CHANNEL_MEMBER], "failed to sanitize Props['add_channel_member'], should be nil")

		actual, resp := Client.GetPost(rpost.Id, "")
		CheckNoError(t, resp)

		assert.Equal(t, msg1, actual.Message, "failed to update message")
		assert.Equal(t, "#hashtag", actual.Hashtags, "failed to update hashtags")
		assert.Nil(t, actual.Props[model.PROPS_ADD_CHANNEL_MEMBER], "failed to sanitize Props['add_channel_member'], should be nil")
	})

	t.Run("join/leave post", func(t *testing.T) {
		rpost2, err := th.App.CreatePost(&model.Post{
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + "a",
			Type:      model.POST_JOIN_LEAVE,
			UserId:    th.BasicUser.Id,
		}, channel, false)
		require.Nil(t, err)

		up2 := &model.Post{
			Id:        rpost2.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 2",
		}
		_, resp := Client.UpdatePost(rpost2.Id, up2)
		CheckBadRequestStatus(t, resp)
	})

	rpost3, err := th.App.CreatePost(&model.Post{
		ChannelId: channel.Id,
		Message:   "zz" + model.NewId() + "a",
		UserId:    th.BasicUser.Id,
	}, channel, false)
	require.Nil(t, err)

	t.Run("new message, add files", func(t *testing.T) {
		up3 := &model.Post{
			Id:        rpost3.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 3",
			FileIds:   fileIds[0:2],
		}
		rrupost3, resp := Client.UpdatePost(rpost3.Id, up3)
		CheckNoError(t, resp)
		assert.Empty(t, rrupost3.FileIds)

		actual, resp := Client.GetPost(rpost.Id, "")
		CheckNoError(t, resp)
		assert.Equal(t, model.StringArray(fileIds), actual.FileIds)
	})

	t.Run("add slack attachments", func(t *testing.T) {
		up4 := &model.Post{
			Id:        rpost3.Id,
			ChannelId: channel.Id,
			Message:   "zz" + model.NewId() + " update post 3",
		}
		up4.AddProp("attachments", []model.SlackAttachment{
			{
				Text: "Hello World",
			},
		})
		rrupost3, resp := Client.UpdatePost(rpost3.Id, up4)
		CheckNoError(t, resp)
		assert.NotEqual(t, rpost3.EditAt, rrupost3.EditAt)
		assert.NotEqual(t, rpost3.Attachments(), rrupost3.Attachments())
	})

	t.Run("logged out", func(t *testing.T) {
		Client.Logout()
		_, resp := Client.UpdatePost(rpost.Id, rpost)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("different user", func(t *testing.T) {
		th.LoginBasic2()
		_, resp := Client.UpdatePost(rpost.Id, rpost)
		CheckForbiddenStatus(t, resp)

		Client.Logout()
	})

	t.Run("different user, but team admin", func(t *testing.T) {
		th.LoginTeamAdmin()
		_, resp := Client.UpdatePost(rpost.Id, rpost)
		CheckForbiddenStatus(t, resp)

		Client.Logout()
	})

	t.Run("different user, but system admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.UpdatePost(rpost.Id, rpost)
		CheckNoError(t, resp)
	})
}

func TestUpdateOthersPostInDirectMessageChannel(t *testing.T) {
	// This test checks that a sysadmin with the "EDIT_OTHERS_POSTS" permission can edit someone else's post in a
	// channel without a team (DM/GM). This indirectly checks for the proper cascading all the way to system-wide roles
	// on the user object of permissions based on a post in a channel with no team ID.
	th := Setup().InitBasic()
	defer th.TearDown()

	dmChannel := th.CreateDmChannel(th.SystemAdminUser)

	post := &model.Post{
		Message:       "asd",
		ChannelId:     dmChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		CreateAt:      0,
	}

	post, resp := th.Client.CreatePost(post)
	CheckNoError(t, resp)

	post.Message = "changed"
	post, resp = th.SystemAdminClient.UpdatePost(post.Id, post)
	CheckNoError(t, resp)
}

func TestPatchPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	th.App.SetLicense(model.NewTestLicense())

	fileIds := make([]string, 3)
	data, err := testutils.ReadTestFile("test.png")
	require.Nil(t, err)
	for i := 0; i < len(fileIds); i++ {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)
		fileIds[i] = fileResp.FileInfos[0].Id
	}

	post := &model.Post{
		ChannelId:    channel.Id,
		IsPinned:     true,
		Message:      "#hashtag a message",
		Props:        model.StringInterface{"channel_header": "old_header"},
		FileIds:      fileIds[0:2],
		HasReactions: true,
	}
	post, _ = Client.CreatePost(post)

	var rpost *model.Post
	t.Run("new message, props, files, HasReactions bit", func(t *testing.T) {
		patch := &model.PostPatch{}

		patch.IsPinned = model.NewBool(false)
		patch.Message = model.NewString("#otherhashtag other message")
		patch.Props = &model.StringInterface{"channel_header": "new_header"}
		patchFileIds := model.StringArray(fileIds) // one extra file
		patch.FileIds = &patchFileIds
		patch.HasReactions = model.NewBool(false)

		var resp *model.Response
		rpost, resp = Client.PatchPost(post.Id, patch)
		CheckNoError(t, resp)

		assert.False(t, rpost.IsPinned, "IsPinned did not update properly")
		assert.Equal(t, "#otherhashtag other message", rpost.Message, "Message did not update properly")
		assert.Equal(t, *patch.Props, rpost.Props, "Props did not update properly")
		assert.Equal(t, "#otherhashtag", rpost.Hashtags, "Message did not update properly")
		assert.Equal(t, model.StringArray(fileIds[0:2]), rpost.FileIds, "FileIds should not update")
		assert.False(t, rpost.HasReactions, "HasReactions did not update properly")
	})

	t.Run("add slack attachments", func(t *testing.T) {
		patch2 := &model.PostPatch{}
		attachments := []model.SlackAttachment{
			{
				Text: "Hello World",
			},
		}
		patch2.Props = &model.StringInterface{"attachments": attachments}

		rpost2, resp := Client.PatchPost(post.Id, patch2)
		CheckNoError(t, resp)
		assert.NotEmpty(t, rpost2.Props["attachments"])
		assert.NotEqual(t, rpost.EditAt, rpost2.EditAt)
	})

	t.Run("invalid requests", func(t *testing.T) {
		r, err := Client.DoApiPut("/posts/"+post.Id+"/patch", "garbage")
		require.EqualError(t, err, ": Invalid or missing post in request body, ")
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "wrong status code")

		patch := &model.PostPatch{}
		_, resp := Client.PatchPost("junk", patch)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unknown post", func(t *testing.T) {
		patch := &model.PostPatch{}
		_, resp := Client.PatchPost(GenerateTestId(), patch)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("logged out", func(t *testing.T) {
		Client.Logout()
		patch := &model.PostPatch{}
		_, resp := Client.PatchPost(post.Id, patch)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("different user", func(t *testing.T) {
		th.LoginBasic2()
		patch := &model.PostPatch{}
		_, resp := Client.PatchPost(post.Id, patch)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("different user, but team admin", func(t *testing.T) {
		th.LoginTeamAdmin()
		patch := &model.PostPatch{}
		_, resp := Client.PatchPost(post.Id, patch)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("different user, but system admin", func(t *testing.T) {
		patch := &model.PostPatch{}
		_, resp := th.SystemAdminClient.PatchPost(post.Id, patch)
		CheckNoError(t, resp)
	})
}

func TestPinPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post := th.BasicPost
	pass, resp := Client.PinPost(post.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	if rpost, err := th.App.GetSinglePost(post.Id); err != nil && !rpost.IsPinned {
		t.Fatal("failed to pin post")
	}

	pass, resp = Client.PinPost("junk")
	CheckBadRequestStatus(t, resp)

	if pass {
		t.Fatal("should have failed")
	}

	_, resp = Client.PinPost(GenerateTestId())
	CheckForbiddenStatus(t, resp)

	t.Run("unable-to-pin-post-in-read-only-town-square", func(t *testing.T) {
		townSquareIsReadOnly := *th.App.Config().TeamSettings.ExperimentalTownSquareIsReadOnly
		th.App.SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		defer th.App.RemoveLicense()
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = townSquareIsReadOnly })

		channel, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, true)
		assert.Nil(t, err)
		adminPost := th.CreatePostWithClient(th.SystemAdminClient, channel)

		_, resp = Client.PinPost(adminPost.Id)
		CheckForbiddenStatus(t, resp)
	})

	Client.Logout()
	_, resp = Client.PinPost(post.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.PinPost(post.Id)
	CheckNoError(t, resp)
}

func TestUnpinPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	pinnedPost := th.CreatePinnedPost()
	pass, resp := Client.UnpinPost(pinnedPost.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	if rpost, err := th.App.GetSinglePost(pinnedPost.Id); err != nil && rpost.IsPinned {
		t.Fatal("failed to pin post")
	}

	pass, resp = Client.UnpinPost("junk")
	CheckBadRequestStatus(t, resp)

	if pass {
		t.Fatal("should have failed")
	}

	_, resp = Client.UnpinPost(GenerateTestId())
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UnpinPost(pinnedPost.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.UnpinPost(pinnedPost.Id)
	CheckNoError(t, resp)
}

func TestGetPostsForChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post3, _ = Client.CreatePost(post3)

	time.Sleep(300 * time.Millisecond)
	since := model.GetMillis()
	time.Sleep(300 * time.Millisecond)

	post4 := th.CreatePost()

	posts, resp := Client.GetPostsForChannel(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)

	if posts.Order[0] != post4.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[2] != post2.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[3] != post1.Id {
		t.Fatal("wrong order")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 3, resp.Etag)
	CheckEtag(t, posts, resp)

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 3, "")
	CheckNoError(t, resp)

	if len(posts.Order) != 3 {
		t.Fatal("wrong number returned")
	}

	if _, ok := posts.Posts[post3.Id]; !ok {
		t.Fatal("missing comment")
	}

	if _, ok := posts.Posts[post1.Id]; !ok {
		t.Fatal("missing root post")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 1, 1, "")
	CheckNoError(t, resp)

	if posts.Order[0] != post3.Id {
		t.Fatal("wrong order")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 10000, 10000, "")
	CheckNoError(t, resp)

	if len(posts.Order) != 0 {
		t.Fatal("should be no posts")
	}

	post5 := th.CreatePost()

	posts, resp = Client.GetPostsSince(th.BasicChannel.Id, since)
	CheckNoError(t, resp)

	if len(posts.Posts) != 2 {
		t.Log(posts.Posts)
		t.Fatal("should return 2 posts")
	}
	// "since" query to return empty NextPostId and PrevPostId
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	found := make([]bool, 2)
	for _, p := range posts.Posts {
		if p.CreateAt < since {
			t.Fatal("bad create at for post returned")
		}
		if p.Id == post4.Id {
			found[0] = true
		} else if p.Id == post5.Id {
			found[1] = true
		}
	}

	for _, f := range found {
		if !f {
			t.Fatal("missing post")
		}
	}

	_, resp = Client.GetPostsForChannel("", 0, 60, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPostsForChannel("junk", 0, 60, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPostsForChannel(model.NewId(), 0, 60, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPostsForChannel(model.NewId(), 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetPostsForChannel(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	th.CreatePost() // post6
	post7 := th.CreatePost()
	post8 := th.CreatePost()
	th.CreatePost() // post9
	post10 := th.CreatePost()

	// get the system post IDs posted before the created posts above
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post1.Id, 0, 2, "")
	systemPostId1 := posts.Order[1]

	// similar to '/posts'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 12 || posts.Order[0] != post10.Id || posts.Order[11] != systemPostId1 {
		t.Fatal("should return 12 posts and match order")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?per_page=3'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post10.Id || posts.Order[2] != post8.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != post7.Id {
		t.Fatal("should return post7.Id as PrevPostId")
	}

	// similar to '/posts?per_page=3&page=1'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 1, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post7.Id || posts.Order[2] != post5.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post8.Id {
		t.Fatal("should return post8.Id as NextPostId")
	}
	if posts.PrevPostId != post4.Id {
		t.Fatal("should return post4.Id as PrevPostId")
	}

	// similar to '/posts?per_page=3&page=2'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 2, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post4.Id || posts.Order[2] != post2.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post5.Id {
		t.Fatal("should return post5.Id as NextPostId")
	}
	if posts.PrevPostId != post1.Id {
		t.Fatal("should return post1.Id as PrevPostId")
	}

	// similar to '/posts?per_page=3&page=3'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 3, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post1.Id || posts.Order[2] != systemPostId1 {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post2.Id {
		t.Fatal("should return post2.Id as NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?per_page=3&page=4'
	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 4, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}
}

func TestGetFlaggedPostsForUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser
	team1 := th.BasicTeam
	channel1 := th.BasicChannel
	post1 := th.CreatePost()
	channel2 := th.CreatePublicChannel()
	post2 := th.CreatePostWithClient(Client, channel2)

	preference := model.Preference{
		UserId:   user.Id,
		Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
		Name:     post1.Id,
		Value:    "true",
	}
	_, resp := Client.UpdatePreferences(user.Id, &model.Preferences{preference})
	CheckNoError(t, resp)
	preference.Name = post2.Id
	_, resp = Client.UpdatePreferences(user.Id, &model.Preferences{preference})
	CheckNoError(t, resp)

	opl := model.NewPostList()
	opl.AddPost(post1)
	opl.AddOrder(post1.Id)

	rpl, resp := Client.GetFlaggedPostsForUserInChannel(user.Id, channel1.Id, 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 1 {
		t.Fatal("should have returned 1 post")
	}

	if !reflect.DeepEqual(rpl.Posts, opl.Posts) {
		t.Fatal("posts should have matched")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInChannel(user.Id, channel1.Id, 0, 1)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 1 {
		t.Fatal("should have returned 1 post")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInChannel(user.Id, channel1.Id, 1, 1)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 0 {
		t.Fatal("should be empty")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInChannel(user.Id, GenerateTestId(), 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 0 {
		t.Fatal("should be empty")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInChannel(user.Id, "junk", 0, 10)
	CheckBadRequestStatus(t, resp)

	if rpl != nil {
		t.Fatal("should be nil")
	}

	opl.AddPost(post2)
	opl.AddOrder(post2.Id)

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 2 {
		t.Fatal("should have returned 2 posts")
	}

	if !reflect.DeepEqual(rpl.Posts, opl.Posts) {
		t.Fatal("posts should have matched")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 0, 1)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 1 {
		t.Fatal("should have returned 1 post")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 1, 1)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 1 {
		t.Fatal("should have returned 1 post")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 1000, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 0 {
		t.Fatal("should be empty")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, GenerateTestId(), 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 0 {
		t.Fatal("should be empty")
	}

	rpl, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, "junk", 0, 10)
	CheckBadRequestStatus(t, resp)

	if rpl != nil {
		t.Fatal("should be nil")
	}

	channel3 := th.CreatePrivateChannel()
	post4 := th.CreatePostWithClient(Client, channel3)

	preference.Name = post4.Id
	Client.UpdatePreferences(user.Id, &model.Preferences{preference})

	opl.AddPost(post4)
	opl.AddOrder(post4.Id)

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 3 {
		t.Fatal("should have returned 3 posts")
	}

	if !reflect.DeepEqual(rpl.Posts, opl.Posts) {
		t.Fatal("posts should have matched")
	}

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 2)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 2 {
		t.Fatal("should have returned 2 posts")
	}

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 2, 2)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 1 {
		t.Fatal("should have returned 1 post")
	}

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 1000, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 0 {
		t.Fatal("should be empty")
	}

	channel4 := th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)
	post5 := th.CreatePostWithClient(th.SystemAdminClient, channel4)

	preference.Name = post5.Id
	_, resp = Client.UpdatePreferences(user.Id, &model.Preferences{preference})
	CheckForbiddenStatus(t, resp)

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckNoError(t, resp)

	if len(rpl.Posts) != 3 {
		t.Fatal("should have returned 3 posts")
	}

	if !reflect.DeepEqual(rpl.Posts, opl.Posts) {
		t.Fatal("posts should have matched")
	}

	th.AddUserToChannel(user, channel4)
	_, resp = Client.UpdatePreferences(user.Id, &model.Preferences{preference})
	CheckNoError(t, resp)

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckNoError(t, resp)

	opl.AddPost(post5)
	opl.AddOrder(post5.Id)

	if len(rpl.Posts) != 4 {
		t.Fatal("should have returned 4 posts")
	}

	if !reflect.DeepEqual(rpl.Posts, opl.Posts) {
		t.Fatal("posts should have matched")
	}

	err := th.App.RemoveUserFromChannel(user.Id, "", channel4)
	if err != nil {
		t.Error("Unable to remove user from channel")
	}

	rpl, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckNoError(t, resp)

	opl2 := model.NewPostList()
	opl2.AddPost(post1)
	opl2.AddOrder(post1.Id)
	opl2.AddPost(post2)
	opl2.AddOrder(post2.Id)
	opl2.AddPost(post4)
	opl2.AddOrder(post4.Id)

	if len(rpl.Posts) != 3 {
		t.Fatal("should have returned 3 posts")
	}

	if !reflect.DeepEqual(rpl.Posts, opl2.Posts) {
		t.Fatal("posts should have matched")
	}

	_, resp = Client.GetFlaggedPostsForUser("junk", 0, 10)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFlaggedPostsForUser(GenerateTestId(), 0, 10)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetFlaggedPostsForUserInChannel(user.Id, channel1.Id, 0, 10)
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 0, 10)
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetFlaggedPostsForUserInChannel(user.Id, channel1.Id, 0, 10)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetFlaggedPostsForUserInTeam(user.Id, team1.Id, 0, 10)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetFlaggedPostsForUser(user.Id, 0, 10)
	CheckNoError(t, resp)
}

func TestGetPostsBefore(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()

	posts, resp := Client.GetPostsBefore(th.BasicChannel.Id, post3.Id, 0, 100, "")
	CheckNoError(t, resp)

	found := make([]bool, 2)
	for _, p := range posts.Posts {
		if p.Id == post1.Id {
			found[0] = true
		} else if p.Id == post2.Id {
			found[1] = true
		}

		if p.Id == post4.Id || p.Id == post5.Id {
			t.Fatal("returned posts after")
		}
	}

	for _, f := range found {
		if !f {
			t.Fatal("missing post")
		}
	}

	if posts.NextPostId != post3.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should match empty PrevPostId")
	}

	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post4.Id, 1, 1, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 1 {
		t.Fatal("too many posts returned")
	}
	if posts.Order[0] != post2.Id {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != post3.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != post1.Id {
		t.Fatal("should match PrevPostId")
	}

	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, "junk", 1, 1, "")
	CheckBadRequestStatus(t, resp)

	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post5.Id, 0, 3, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 3 {
		t.Fatal("should match length of posts returned")
	}
	if posts.Order[0] != post4.Id {
		t.Fatal("should match returned post")
	}
	if posts.Order[2] != post2.Id {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != post5.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != post1.Id {
		t.Fatal("should match PrevPostId")
	}

	// get the system post IDs posted before the created posts above
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post1.Id, 0, 2, "")
	CheckNoError(t, resp)
	systemPostId2 := posts.Order[0]
	systemPostId1 := posts.Order[1]

	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post5.Id, 1, 3, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 3 {
		t.Fatal("should match length of posts returned")
	}
	if posts.Order[0] != post1.Id {
		t.Fatal("should match returned post")
	}
	if posts.Order[1] != systemPostId2 {
		t.Fatal("should match returned post")
	}
	if posts.Order[2] != systemPostId1 {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != post2.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return empty PrevPostId")
	}

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	post6 := th.CreatePost()
	th.CreatePost() // post7
	post8 := th.CreatePost()
	post9 := th.CreatePost()
	th.CreatePost() // post10

	// similar to '/posts?before=post9'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post9.Id, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 10 || posts.Order[0] != post8.Id || posts.Order[9] != systemPostId1 {
		t.Fatal("should return 10 posts and match order")
	}
	if posts.NextPostId != post9.Id {
		t.Fatal("should return post9.Id as NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?before=post9&per_page=3'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post9.Id, 0, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post8.Id || posts.Order[2] != post6.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post9.Id {
		t.Fatal("should return post9.Id as NextPostId")
	}
	if posts.PrevPostId != post5.Id {
		t.Fatal("should return post5.Id as PrevPostId")
	}

	// similar to '/posts?before=post9&per_page=3&page=1'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post9.Id, 1, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post5.Id || posts.Order[2] != post3.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post6.Id {
		t.Fatal("should return post6.Id as NextPostId")
	}
	if posts.PrevPostId != post2.Id {
		t.Fatal("should return post2.Id as PrevPostId")
	}

	// similar to '/posts?before=post9&per_page=3&page=2'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post9.Id, 2, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post2.Id || posts.Order[2] != systemPostId2 {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post3.Id {
		t.Fatal("should return post3.Id as NextPostId")
	}
	if posts.PrevPostId != systemPostId1 {
		t.Fatal("should return systemPostId1 as PrevPostId")
	}

	// similar to '/posts?before=post1&per_page=3'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post1.Id, 0, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 2 || posts.Order[0] != systemPostId2 || posts.Order[1] != systemPostId1 {
		t.Fatal("should return 2 posts and match order")
	}
	if posts.NextPostId != post1.Id {
		t.Fatal("should return post1.Id as NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?before=systemPostId1'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, systemPostId1, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != systemPostId1 {
		t.Fatal("should return systemPostId1 as NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?before=systemPostId1&per_page=60&page=1'
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, systemPostId1, 1, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?before=non-existent-post'
	nonExistentPostId := model.NewId()
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, nonExistentPostId, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != nonExistentPostId {
		t.Fatal("should return nonExistentPostId as NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}
}

func TestGetPostsAfter(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()

	posts, resp := Client.GetPostsAfter(th.BasicChannel.Id, post3.Id, 0, 100, "")
	CheckNoError(t, resp)

	found := make([]bool, 2)
	for _, p := range posts.Posts {
		if p.Id == post4.Id {
			found[0] = true
		} else if p.Id == post5.Id {
			found[1] = true
		}

		if p.Id == post1.Id || p.Id == post2.Id {
			t.Fatal("returned posts before")
		}
	}

	for _, f := range found {
		if !f {
			t.Fatal("missing post")
		}
	}

	if posts.NextPostId != "" {
		t.Fatal("should match empty NextPostId")
	}
	if posts.PrevPostId != post3.Id {
		t.Fatal("should match PrevPostId")
	}

	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post2.Id, 1, 1, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 1 {
		t.Fatal("too many posts returned")
	}
	if posts.Order[0] != post4.Id {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != post5.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != post3.Id {
		t.Fatal("should match PrevPostId")
	}

	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, "junk", 1, 1, "")
	CheckBadRequestStatus(t, resp)

	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post1.Id, 0, 3, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 3 {
		t.Fatal("should match length of posts returned")
	}
	if posts.Order[0] != post4.Id {
		t.Fatal("should match returned post")
	}
	if posts.Order[2] != post2.Id {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != post5.Id {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != post1.Id {
		t.Fatal("should match PrevPostId")
	}

	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post1.Id, 1, 3, "")
	CheckNoError(t, resp)

	if len(posts.Posts) != 1 {
		t.Fatal("should match length of posts returned")
	}
	if posts.Order[0] != post5.Id {
		t.Fatal("should match returned post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should match NextPostId")
	}
	if posts.PrevPostId != post4.Id {
		t.Fatal("should match PrevPostId")
	}

	// more tests for next_post_id, prev_post_id, and order
	// There are 12 posts composed of first 2 system messages and 10 created posts
	post6 := th.CreatePost()
	th.CreatePost() // post7
	post8 := th.CreatePost()
	post9 := th.CreatePost()
	post10 := th.CreatePost()

	// similar to '/posts?after=post2'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post2.Id, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 8 || posts.Order[0] != post10.Id || posts.Order[7] != post3.Id {
		t.Fatal("should return 8 posts and match order")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != post2.Id {
		t.Fatal("should return post2.Id as PrevPostId")
	}

	// similar to '/posts?after=post2&per_page=3'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post2.Id, 0, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post5.Id || posts.Order[2] != post3.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post6.Id {
		t.Fatal("should return post6.Id as NextPostId")
	}
	if posts.PrevPostId != post2.Id {
		t.Fatal("should return post2.Id as PrevPostId")
	}

	// similar to '/posts?after=post2&per_page=3&page=1'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post2.Id, 1, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 3 || posts.Order[0] != post8.Id || posts.Order[2] != post6.Id {
		t.Fatal("should return 3 posts and match order")
	}
	if posts.NextPostId != post9.Id {
		t.Fatal("should return post9.Id as NextPostId")
	}
	if posts.PrevPostId != post5.Id {
		t.Fatal("should return post5.Id as PrevPostId")
	}

	// similar to '/posts?after=post2&per_page=3&page=2'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post2.Id, 2, 3, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 2 || posts.Order[0] != post10.Id || posts.Order[1] != post9.Id {
		t.Fatal("should return 2 posts and match order")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != post8.Id {
		t.Fatal("should return post8.Id as PrevPostId")
	}

	// similar to '/posts?after=post10'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post10.Id, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != post10.Id {
		t.Fatal("should return post10.Id as PrevPostId")
	}

	// similar to '/posts?after=post10&page=1'
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, post10.Id, 1, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != "" {
		t.Fatal("should return an empty PrevPostId")
	}

	// similar to '/posts?after=non-existent-post'
	nonExistentPostId := model.NewId()
	posts, resp = Client.GetPostsAfter(th.BasicChannel.Id, nonExistentPostId, 0, 60, "")
	CheckNoError(t, resp)
	if len(posts.Order) != 0 {
		t.Fatal("should return 0 post")
	}
	if posts.NextPostId != "" {
		t.Fatal("should return an empty NextPostId")
	}
	if posts.PrevPostId != nonExistentPostId {
		t.Fatal("should return nonExistentPostId as PrevPostId")
	}
}

func TestGetPostsForChannelAroundLastUnread(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	channelId := th.BasicChannel.Id

	// 12 posts = 2 systems posts + 10 created posts below
	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := th.CreatePost()
	post5 := th.CreatePost()
	replyPost := &model.Post{ChannelId: channelId, Message: model.NewId(), RootId: post4.Id, ParentId: post4.Id}
	post6, resp := Client.CreatePost(replyPost)
	CheckNoError(t, resp)
	post7, resp := Client.CreatePost(replyPost)
	CheckNoError(t, resp)
	post8, resp := Client.CreatePost(replyPost)
	CheckNoError(t, resp)
	post9, resp := Client.CreatePost(replyPost)
	CheckNoError(t, resp)
	post10, resp := Client.CreatePost(replyPost)
	CheckNoError(t, resp)

	postIdNames := map[string]string{
		post1.Id:  "post1",
		post2.Id:  "post2",
		post3.Id:  "post3",
		post4.Id:  "post4",
		post5.Id:  "post5",
		post6.Id:  "post6 (reply to post4)",
		post7.Id:  "post7 (reply to post4)",
		post8.Id:  "post8 (reply to post4)",
		post9.Id:  "post9 (reply to post4)",
		post10.Id: "post10 (reply to post4)",
	}

	namePost := func(postId string) string {
		name, ok := postIdNames[postId]
		if ok {
			return name
		}

		return fmt.Sprintf("unknown (%s)", postId)
	}

	namePosts := func(postIds []string) []string {
		namedPostIds := make([]string, 0, len(postIds))
		for _, postId := range postIds {
			namedPostIds = append(namedPostIds, namePost(postId))
		}

		return namedPostIds
	}

	namePostsMap := func(posts map[string]*model.Post) []string {
		namedPostIds := make([]string, 0, len(posts))
		for postId := range posts {
			namedPostIds = append(namedPostIds, namePost(postId))
		}
		sort.Strings(namedPostIds)

		return namedPostIds
	}

	assertPostList := func(t *testing.T, expected, actual *model.PostList) {
		t.Helper()

		require.Equal(t, namePosts(expected.Order), namePosts(actual.Order), "unexpected post order")
		require.Equal(t, namePostsMap(expected.Posts), namePostsMap(actual.Posts), "unexpected posts")
		require.Equal(t, namePost(expected.NextPostId), namePost(actual.NextPostId), "unexpected next post id")
		require.Equal(t, namePost(expected.PrevPostId), namePost(actual.PrevPostId), "unexpected prev post id")
	}

	// All returned posts are all read by the user, since it's created by the user itself.
	posts, resp := Client.GetPostsAroundLastUnread(userId, channelId, 20, 20)
	CheckNoError(t, resp)
	require.Len(t, posts.Order, 12, "Should return 12 posts only since there's no unread post")

	// Set channel member's last viewed to 0.
	// All returned posts are latest posts as if all previous posts were already read by the user.
	channelMember, err := th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = 0
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 20, 20)
	CheckNoError(t, resp)

	require.Len(t, posts.Order, 12, "Should return 12 posts only since there's no unread post")

	// get the first system post generated before the created posts above
	posts, resp = Client.GetPostsBefore(th.BasicChannel.Id, post1.Id, 0, 2, "")
	CheckNoError(t, resp)
	systemPost0 := posts.Posts[posts.Order[0]]
	postIdNames[systemPost0.Id] = "system post 0"
	systemPost1 := posts.Posts[posts.Order[1]]
	postIdNames[systemPost1.Id] = "system post 1"

	// Set channel member's last viewed before post1.
	channelMember, err = th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = post1.CreateAt - 1
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 3, 3)
	CheckNoError(t, resp)

	assertPostList(t, &model.PostList{
		Order: []string{post3.Id, post2.Id, post1.Id, systemPost0.Id, systemPost1.Id},
		Posts: map[string]*model.Post{
			systemPost0.Id: systemPost0,
			systemPost1.Id: systemPost1,
			post1.Id:       post1,
			post2.Id:       post2,
			post3.Id:       post3,
		},
		NextPostId: post4.Id,
		PrevPostId: "",
	}, posts)

	// Set channel member's last viewed before post6.
	channelMember, err = th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = post6.CreateAt - 1
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 3, 3)
	CheckNoError(t, resp)

	assertPostList(t, &model.PostList{
		Order: []string{post8.Id, post7.Id, post6.Id, post5.Id, post4.Id, post3.Id},
		Posts: map[string]*model.Post{
			post3.Id:  post3,
			post4.Id:  post4,
			post5.Id:  post5,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: post9.Id,
		PrevPostId: post2.Id,
	}, posts)

	// Set channel member's last viewed before post10.
	channelMember, err = th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = post10.CreateAt - 1
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 3, 3)
	CheckNoError(t, resp)

	assertPostList(t, &model.PostList{
		Order: []string{post10.Id, post9.Id, post8.Id, post7.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: "",
		PrevPostId: post6.Id,
	}, posts)

	// Set channel member's last viewed equal to post10.
	channelMember, err = th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = post10.CreateAt
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 3, 3)
	CheckNoError(t, resp)

	assertPostList(t, &model.PostList{
		Order: []string{post10.Id, post9.Id, post8.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
		},
		NextPostId: "",
		PrevPostId: post7.Id,
	}, posts)

	// Set channel member's last viewed to just before a new reply to a previous thread, not
	// otherwise in the requested window.
	post11 := th.CreatePost()
	post12, resp := Client.CreatePost(&model.Post{
		ChannelId: channelId,
		Message:   model.NewId(),
		RootId:    post4.Id,
		ParentId:  post4.Id,
	})
	CheckNoError(t, resp)
	post13 := th.CreatePost()

	postIdNames[post11.Id] = "post11"
	postIdNames[post12.Id] = "post12 (reply to post4)"
	postIdNames[post13.Id] = "post13"

	channelMember, err = th.App.Srv.Store.Channel().GetMember(channelId, userId)
	require.Nil(t, err)
	channelMember.LastViewedAt = post12.CreateAt - 1
	_, err = th.App.Srv.Store.Channel().UpdateMember(channelMember)
	require.Nil(t, err)
	th.App.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)

	posts, resp = Client.GetPostsAroundLastUnread(userId, channelId, 1, 2)
	CheckNoError(t, resp)

	assertPostList(t, &model.PostList{
		Order: []string{post13.Id, post12.Id, post11.Id},
		Posts: map[string]*model.Post{
			post4.Id:  post4,
			post6.Id:  post6,
			post7.Id:  post7,
			post8.Id:  post8,
			post9.Id:  post9,
			post10.Id: post10,
			post11.Id: post11,
			post12.Id: post12,
			post13.Id: post13,
		},
		NextPostId: "",
		PrevPostId: post10.Id,
	}, posts)
}

func TestGetPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post, resp := Client.GetPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	if post.Id != th.BasicPost.Id {
		t.Fatal("post ids don't match")
	}

	post, resp = Client.GetPost(th.BasicPost.Id, resp.Etag)
	CheckEtag(t, post, resp)

	_, resp = Client.GetPost("", "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetPost("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPost(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser.Id)

	// Channel is public, should be able to read post
	_, resp = Client.GetPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	privatePost := th.CreatePostWithClient(Client, th.BasicPrivateChannel)

	_, resp = Client.GetPost(privatePost.Id, "")
	CheckNoError(t, resp)

	Client.RemoveUserFromChannel(th.BasicPrivateChannel.Id, th.BasicUser.Id)

	// Channel is private, should not be able to read post
	_, resp = Client.GetPost(privatePost.Id, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPost(model.NewId(), "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)
}

func TestDeletePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.DeletePost("")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.DeletePost("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.DeletePost(th.BasicPost.Id)
	CheckForbiddenStatus(t, resp)

	Client.Login(th.TeamAdminUser.Email, th.TeamAdminUser.Password)
	_, resp = Client.DeletePost(th.BasicPost.Id)
	CheckNoError(t, resp)

	post := th.CreatePost()
	user := th.CreateUser()

	Client.Logout()
	Client.Login(user.Email, user.Password)

	_, resp = Client.DeletePost(post.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeletePost(model.NewId())
	CheckUnauthorizedStatus(t, resp)

	status, resp := th.SystemAdminClient.DeletePost(post.Id)
	if !status {
		t.Fatal("post should return status OK")
	}
	CheckNoError(t, resp)
}

func TestGetPostThread(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", RootId: th.BasicPost.Id}
	post, _ = Client.CreatePost(post)

	list, resp := Client.GetPostThread(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	var list2 *model.PostList
	list2, resp = Client.GetPostThread(th.BasicPost.Id, resp.Etag)
	CheckEtag(t, list2, resp)

	if list.Order[0] != th.BasicPost.Id {
		t.Fatal("wrong order")
	}

	if _, ok := list.Posts[th.BasicPost.Id]; !ok {
		t.Fatal("should have had post")
	}

	if _, ok := list.Posts[post.Id]; !ok {
		t.Fatal("should have had post")
	}

	_, resp = Client.GetPostThread("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPostThread(model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser.Id)

	// Channel is public, should be able to read post
	_, resp = Client.GetPostThread(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	privatePost := th.CreatePostWithClient(Client, th.BasicPrivateChannel)

	_, resp = Client.GetPostThread(privatePost.Id, "")
	CheckNoError(t, resp)

	Client.RemoveUserFromChannel(th.BasicPrivateChannel.Id, th.BasicUser.Id)

	// Channel is private, should not be able to read post
	_, resp = Client.GetPostThread(privatePost.Id, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPostThread(model.NewId(), "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetPostThread(th.BasicPost.Id, "")
	CheckNoError(t, resp)
}

func TestSearchPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.ExperimentalViewArchivedChannels = &experimentalViewArchivedChannels
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = true
	})

	th.LoginBasic()
	Client := th.Client

	message := "search for post1"
	_ = th.CreateMessagePost(message)

	message = "search for post2"
	post2 := th.CreateMessagePost(message)

	message = "#hashtag search for post3"
	post3 := th.CreateMessagePost(message)

	message = "hashtag for post4"
	_ = th.CreateMessagePost(message)

	archivedChannel := th.CreatePublicChannel()
	_ = th.CreateMessagePostWithClient(th.Client, archivedChannel, "#hashtag for post3")
	th.Client.DeleteChannel(archivedChannel.Id)

	terms := "search"
	isOrSearch := false
	timezoneOffset := 5
	searchParams := model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
	}
	posts, resp := Client.SearchPostsWithParams(th.BasicTeam.Id, &searchParams)
	CheckNoError(t, resp)
	if len(posts.Order) != 3 {
		t.Fatal("wrong search")
	}

	terms = "search"
	page := 0
	perPage := 2
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	posts2, resp := Client.SearchPostsWithParams(th.BasicTeam.Id, &searchParams)
	CheckNoError(t, resp)
	if len(posts2.Order) != 3 { // We don't support paging for DB search yet, modify this when we do.
		t.Fatal("Wrong number of posts", len(posts2.Order))
	}
	assert.Equal(t, posts.Order[0], posts2.Order[0])
	assert.Equal(t, posts.Order[1], posts2.Order[1])

	page = 1
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	posts2, resp = Client.SearchPostsWithParams(th.BasicTeam.Id, &searchParams)
	CheckNoError(t, resp)
	if len(posts2.Order) != 0 { // We don't support paging for DB search yet, modify this when we do.
		t.Fatal("Wrong number of posts", len(posts2.Order))
	}

	posts, resp = Client.SearchPosts(th.BasicTeam.Id, "search", false)
	CheckNoError(t, resp)
	if len(posts.Order) != 3 {
		t.Fatal("wrong search")
	}

	posts, resp = Client.SearchPosts(th.BasicTeam.Id, "post2", false)
	CheckNoError(t, resp)
	if len(posts.Order) != 1 && posts.Order[0] == post2.Id {
		t.Fatal("wrong search")
	}

	posts, resp = Client.SearchPosts(th.BasicTeam.Id, "#hashtag", false)
	CheckNoError(t, resp)
	if len(posts.Order) != 1 && posts.Order[0] == post3.Id {
		t.Fatal("wrong search")
	}

	terms = "#hashtag"
	includeDeletedChannels := true
	searchParams = model.SearchParameter{
		Terms:                  &terms,
		IsOrSearch:             &isOrSearch,
		TimeZoneOffset:         &timezoneOffset,
		IncludeDeletedChannels: &includeDeletedChannels,
	}
	posts, resp = Client.SearchPostsWithParams(th.BasicTeam.Id, &searchParams)
	CheckNoError(t, resp)
	if len(posts.Order) != 2 {
		t.Fatal("wrong search")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = false
	})

	posts, resp = Client.SearchPostsWithParams(th.BasicTeam.Id, &searchParams)
	CheckNoError(t, resp)
	if len(posts.Order) != 1 {
		t.Fatal("wrong search")
	}

	if posts, _ = Client.SearchPosts(th.BasicTeam.Id, "*", false); len(posts.Order) != 0 {
		t.Fatal("searching for just * shouldn't return any results")
	}

	posts, resp = Client.SearchPosts(th.BasicTeam.Id, "post1 post2", true)
	CheckNoError(t, resp)

	if len(posts.Order) != 2 {
		t.Fatal("wrong search results")
	}

	_, resp = Client.SearchPosts("junk", "#sgtitlereview", false)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.SearchPosts(model.NewId(), "#sgtitlereview", false)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.SearchPosts(th.BasicTeam.Id, "", false)
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	_, resp = Client.SearchPosts(th.BasicTeam.Id, "#sgtitlereview", false)
	CheckUnauthorizedStatus(t, resp)
}

func TestSearchHashtagPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	Client := th.Client

	message := "#sgtitlereview with space"
	assert.NotNil(t, th.CreateMessagePost(message))

	message = "#sgtitlereview\n with return"
	assert.NotNil(t, th.CreateMessagePost(message))

	message = "no hashtag"
	assert.NotNil(t, th.CreateMessagePost(message))

	posts, resp := Client.SearchPosts(th.BasicTeam.Id, "#sgtitlereview", false)
	CheckNoError(t, resp)
	if len(posts.Order) != 2 {
		t.Fatal("wrong search results")
	}

	Client.Logout()
	_, resp = Client.SearchPosts(th.BasicTeam.Id, "#sgtitlereview", false)
	CheckUnauthorizedStatus(t, resp)
}

func TestSearchPostsInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	Client := th.Client

	channel := th.CreatePublicChannel()

	message := "sgtitlereview with space"
	_ = th.CreateMessagePost(message)

	message = "sgtitlereview\n with return"
	_ = th.CreateMessagePostWithClient(Client, th.BasicChannel2, message)

	message = "other message with no return"
	_ = th.CreateMessagePostWithClient(Client, th.BasicChannel2, message)

	message = "other message with no return"
	_ = th.CreateMessagePostWithClient(Client, channel, message)

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "channel:", false); len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "in:", false); len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "channel:"+th.BasicChannel.Name, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "in:"+th.BasicChannel2.Name, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "channel:"+th.BasicChannel2.Name, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "ChAnNeL:"+th.BasicChannel2.Name, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "sgtitlereview", false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "sgtitlereview channel:"+th.BasicChannel.Name, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "sgtitlereview in: "+th.BasicChannel2.Name, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "sgtitlereview channel: "+th.BasicChannel2.Name, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "channel: "+th.BasicChannel2.Name+" channel: "+channel.Name, false); len(posts.Order) != 3 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

}

func TestSearchPostsFromUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.LoginTeamAdmin()
	user := th.CreateUser()
	th.LinkUserToTeam(user, th.BasicTeam)
	th.App.AddUserToChannel(user, th.BasicChannel)
	th.App.AddUserToChannel(user, th.BasicChannel2)

	message := "sgtitlereview with space"
	_ = th.CreateMessagePost(message)

	Client.Logout()
	th.LoginBasic2()

	message = "sgtitlereview\n with return"
	_ = th.CreateMessagePostWithClient(Client, th.BasicChannel2, message)

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.TeamAdminUser.Username, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" sgtitlereview", false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	message = "hullo"
	_ = th.CreateMessagePost(message)

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" in:"+th.BasicChannel.Name, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	Client.Login(user.Email, user.Password)

	// wait for the join/leave messages to be created for user3 since they're done asynchronously
	time.Sleep(100 * time.Millisecond)

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username, false); len(posts.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username+" in:"+th.BasicChannel2.Name, false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	message = "coconut"
	_ = th.CreateMessagePostWithClient(Client, th.BasicChannel2, message)

	if posts, _ := Client.SearchPosts(th.BasicTeam.Id, "from: "+th.BasicUser2.Username+" from: "+user.Username+" in:"+th.BasicChannel2.Name+" coconut", false); len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}
}

func TestSearchPostsWithDateFlags(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.LoginBasic()
	Client := th.Client

	message := "sgtitlereview\n with return"
	createDate := time.Date(2018, 8, 1, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	message = "other message with no return"
	createDate = time.Date(2018, 8, 2, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	message = "other message with no return"
	createDate = time.Date(2018, 8, 3, 5, 0, 0, 0, time.UTC)
	_ = th.CreateMessagePostNoClient(th.BasicChannel, message, utils.MillisFromTime(createDate))

	posts, _ := Client.SearchPosts(th.BasicTeam.Id, "return", false)
	if len(posts.Order) != 3 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "on:", false)
	if len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "after:", false)
	if len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "before:", false)
	if len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "on:2018-08-01", false)
	if len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "after:2018-08-01", false)
	resultCount := 0
	for _, post := range posts.Posts {
		if post.UserId == th.BasicUser.Id {
			resultCount = resultCount + 1
		}
	}
	if resultCount != 2 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "before:2018-08-02", false)
	if len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "before:2018-08-03 after:2018-08-02", false)
	if len(posts.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}

	posts, _ = Client.SearchPosts(th.BasicTeam.Id, "before:2018-08-03 after:2018-08-01", false)
	if len(posts.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(posts.Order))
	}
}

func TestGetFileInfosForPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	fileIds := make([]string, 3)
	if data, err := testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		for i := 0; i < 3; i++ {
			fileResp, _ := Client.UploadFile(data, th.BasicChannel.Id, "test.png")
			fileIds[i] = fileResp.FileInfos[0].Id
		}
	}

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a", FileIds: fileIds}
	post, _ = Client.CreatePost(post)

	infos, resp := Client.GetFileInfosForPost(post.Id, "")
	CheckNoError(t, resp)

	if len(infos) != 3 {
		t.Fatal("missing file infos")
	}

	found := false
	for _, info := range infos {
		if info.Id == fileIds[0] {
			found = true
		}
	}

	if !found {
		t.Fatal("missing file info")
	}

	infos, resp = Client.GetFileInfosForPost(post.Id, resp.Etag)
	CheckEtag(t, infos, resp)

	infos, resp = Client.GetFileInfosForPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	if len(infos) != 0 {
		t.Fatal("should have no file infos")
	}

	_, resp = Client.GetFileInfosForPost("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileInfosForPost(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileInfosForPost(model.NewId(), "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetFileInfosForPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)
}
