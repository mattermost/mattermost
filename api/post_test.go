// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"

	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreatePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	team2 := th.CreateTeam(th.BasicClient)
	user3 := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(user3, team2)
	channel1 := th.BasicChannel
	channel2 := th.CreateChannel(Client, team)

	th.InitSystemAdmin()
	AdminClient := th.SystemAdminClient
	adminTeam := th.SystemAdminTeam
	adminUser := th.CreateUser(th.SystemAdminClient)
	th.LinkUserToTeam(adminUser, adminTeam)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag a" + model.NewId() + "a", Props: model.StringInterface{model.PROPS_ADD_CHANNEL_MEMBER: "no good"}}
	rpost1, err := Client.CreatePost(post1)
	if err != nil {
		t.Fatal(err)
	}

	if rpost1.Data.(*model.Post).Message != post1.Message {
		t.Fatal("message didn't match")
	}

	if rpost1.Data.(*model.Post).Hashtags != "#hashtag" {
		t.Fatal("hashtag didn't match")
	}

	if len(rpost1.Data.(*model.Post).FileIds) != 0 {
		t.Fatal("shouldn't have files")
	}

	if rpost1.Data.(*model.Post).EditAt != 0 {
		t.Fatal("Newly craeted post shouldn't have EditAt set")
	}

	if rpost1.Data.(*model.Post).Props[model.PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("newly created post shouldn't have Props['add_channel_member'] set")
	}

	_, err = Client.CreatePost(&model.Post{ChannelId: channel1.Id, Message: "#hashtag a" + model.NewId() + "a", Type: model.POST_SYSTEM_GENERIC})
	if err == nil {
		t.Fatal("should have failed - bad post type")
	}

	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost2, err := Client.CreatePost(post2)
	if err != nil {
		t.Fatal(err)
	}

	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id, ParentId: rpost2.Data.(*model.Post).Id}
	_, err = Client.CreatePost(post3)
	if err != nil {
		t.Fatal(err)
	}

	post4 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: "junk"}
	_, err = Client.CreatePost(post4)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post5 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id, ParentId: "junk"}
	_, err = Client.CreatePost(post5)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post1c2 := &model.Post{ChannelId: channel2.Id, Message: "zz" + model.NewId() + "a"}
	rpost1c2, err := Client.CreatePost(post1c2)

	post2c2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1c2.Data.(*model.Post).Id}
	_, err = Client.CreatePost(post2c2)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post6 := &model.Post{ChannelId: "junk", Message: "zz" + model.NewId() + "a"}
	_, err = Client.CreatePost(post6)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	th.LoginBasic2()

	post7 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	_, err = Client.CreatePost(post7)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	Client.Login(user3.Email, user3.Password)
	Client.SetTeamId(team2.Id)
	channel3 := th.CreateChannel(Client, team2)

	post8 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	_, err = Client.CreatePost(post8)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	if _, err = Client.DoApiPost("/channels/"+channel3.Id+"/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}

	fileIds := make([]string, 4)
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		for i := 0; i < 3; i++ {
			fileIds[i] = Client.MustGeneric(Client.UploadPostAttachment(data, channel3.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		}
	}

	// Make sure duplicated file ids are removed
	fileIds[3] = fileIds[0]

	post9 := &model.Post{
		ChannelId: channel3.Id,
		Message:   "test",
		FileIds:   fileIds,
	}
	if resp, err := Client.CreatePost(post9); err != nil {
		t.Fatal(err)
	} else if rpost9 := resp.Data.(*model.Post); len(rpost9.FileIds) != 3 {
		t.Fatal("post should have 3 files")
	} else {
		infos := store.Must(th.App.Srv.Store.FileInfo().GetForPost(rpost9.Id, true, true)).([]*model.FileInfo)

		if len(infos) != 3 {
			t.Fatal("should've attached all 3 files to post")
		}
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	disableTownSquareReadOnly := th.App.Config().TeamSettings.ExperimentalTownSquareIsReadOnly
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = disableTownSquareReadOnly })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })
	th.App.SetDefaultRolesBasedOnConfig()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	defaultChannel := store.Must(th.App.Srv.Store.Channel().GetByName(team.Id, model.DEFAULT_CHANNEL, true)).(*model.Channel)
	defaultPost := &model.Post{
		ChannelId: defaultChannel.Id,
		Message:   "Default Channel Post",
	}
	if _, err = Client.CreatePost(defaultPost); err == nil {
		t.Fatal("should have failed -- ExperimentalTownSquareIsReadOnly is true and it's a read only channel")
	}

	adminDefaultChannel := store.Must(th.App.Srv.Store.Channel().GetByName(adminTeam.Id, model.DEFAULT_CHANNEL, true)).(*model.Channel)
	adminDefaultPost := &model.Post{
		ChannelId: adminDefaultChannel.Id,
		Message:   "Admin Default Channel Post",
	}
	if _, err = AdminClient.CreatePost(adminDefaultPost); err != nil {
		t.Fatal("should not have failed -- ExperimentalTownSquareIsReadOnly is true and admin can post to channel")
	}
}

func TestCreatePostWithCreateAt(t *testing.T) {

	// An ordinary user cannot use CreateAt

	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	post := &model.Post{
		ChannelId: channel1.Id,
		Message:   "PLT-4349",
		CreateAt:  1234,
	}
	if resp, err := Client.CreatePost(post); err != nil {
		t.Fatal(err)
	} else if rpost := resp.Data.(*model.Post); rpost.CreateAt == post.CreateAt {
		t.Fatal("post should be created with default CreateAt timestamp for ordinary user")
	}

	// But a System Admin user can

	th.InitSystemAdmin()
	SysClient := th.SystemAdminClient

	if resp, err := SysClient.CreatePost(post); err != nil {
		t.Fatal(err)
	} else if rpost := resp.Data.(*model.Post); rpost.CreateAt != post.CreateAt {
		t.Fatal("post should be created with provided CreateAt timestamp for System Admin user")
	}
}

func testCreatePostWithOutgoingHook(
	t *testing.T,
	hookContentType, expectedContentType, message, triggerWord string,
	fileIds []string,
	triggerWhen int,
) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	user := th.SystemAdminUser
	channel := th.CreateChannel(Client, team)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOutgoingWebhooks = true
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
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
				t.Logf("Form values are %q, should be %q", r.Form, expectedFormValues)
				success <- false
				return
			}
		}

		resp := &model.OutgoingWebhookResponse{}
		resp.Text = model.NewString("some test text")
		resp.Username = "testusername"
		resp.IconURL = "http://www.mattermost.org/wp-content/uploads/2016/04/icon.png"
		resp.Props = map[string]interface{}{"someprop": "somevalue"}
		resp.Type = "custom_test"

		w.Write([]byte(resp.ToJson()))

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

	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		hook = result.Data.(*model.OutgoingWebhook)
	}

	// create a post to trigger the webhook
	post = &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		FileIds:   fileIds,
	}

	if result, err := Client.CreatePost(post); err != nil {
		t.Fatal(err)
	} else {
		post = result.Data.(*model.Post)
	}

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
}

func TestCreatePostWithOutgoingHook_form_urlencoded(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded", "", "", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH)
}

func TestCreatePostWithOutgoingHook_json(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_STARTS_WITH)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerword lorem ipsum", "", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "application/json", "application/json", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH)
}

// hooks created before we added the ContentType field should be considered as
// application/x-www-form-urlencoded
func TestCreatePostWithOutgoingHook_no_content_type(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "triggerword", []string{"file_id_1"}, app.TRIGGERWORDS_STARTS_WITH)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerword lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_EXACT_MATCH)
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded", "triggerwordaaazzz lorem ipsum", "", []string{"file_id_1, file_id_2"}, app.TRIGGERWORDS_STARTS_WITH)
}

func TestUpdatePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowEditPost = model.ALLOW_EDIT_POST_ALWAYS })

	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	rpost1, err := Client.CreatePost(post1)
	if err != nil {
		t.Fatal(err)
	}

	if rpost1.Data.(*model.Post).Message != post1.Message {
		t.Fatal("full name didn't match")
	}

	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost2, err := Client.CreatePost(post2)
	if err != nil {
		t.Fatal(err)
	}

	if rpost2.Data.(*model.Post).EditAt != 0 {
		t.Fatal("Newly craeted post shouldn't have EditAt set")
	}

	msg2 := "zz" + model.NewId() + " update post 1"
	rpost2.Data.(*model.Post).Message = msg2
	rpost2.Data.(*model.Post).Props[model.PROPS_ADD_CHANNEL_MEMBER] = "no good"
	if rupost2, err := Client.UpdatePost(rpost2.Data.(*model.Post)); err != nil {
		t.Fatal(err)
	} else {
		if rupost2.Data.(*model.Post).Message != msg2 {
			t.Fatal("failed to updates")
		}
		if rupost2.Data.(*model.Post).EditAt == 0 {
			t.Fatal("EditAt not updated for post")
		}
		if rupost2.Data.(*model.Post).Props[model.PROPS_ADD_CHANNEL_MEMBER] != nil {
			t.Fatal("failed to sanitize Props['add_channel_member'], should be nil")
		}
	}

	msg1 := "#hashtag a" + model.NewId() + " update post 2"
	rpost1.Data.(*model.Post).Message = msg1
	if rupost1, err := Client.UpdatePost(rpost1.Data.(*model.Post)); err != nil {
		t.Fatal(err)
	} else {
		if rupost1.Data.(*model.Post).Message != msg1 && rupost1.Data.(*model.Post).Hashtags != "#hashtag" {
			t.Fatal("failed to updates")
		}
	}

	up12 := &model.Post{Id: rpost1.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: "zz" + model.NewId() + " updaet post 1 update 2"}
	if rup12, err := Client.UpdatePost(up12); err != nil {
		t.Fatal(err)
	} else {
		if rup12.Data.(*model.Post).Message != up12.Message {
			t.Fatal("failed to updates")
		}
	}

	rpost3, err := th.App.CreatePost(&model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", Type: model.POST_JOIN_LEAVE, UserId: th.BasicUser.Id}, channel1, false)
	if err != nil {
		t.Fatal(err)
	}

	up3 := &model.Post{Id: rpost3.Id, ChannelId: channel1.Id, Message: "zz" + model.NewId() + " update post 3"}
	if _, err := Client.UpdatePost(up3); err == nil {
		t.Fatal("shouldn't have been able to update system message")
	}

	// Test licensed policy controls for edit post
	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
	}()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowEditPost = model.ALLOW_EDIT_POST_NEVER })

	post4 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost4, err := Client.CreatePost(post4)
	if err != nil {
		t.Fatal(err)
	}

	up4 := &model.Post{Id: rpost4.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: "zz" + model.NewId() + " update post 4"}
	if _, err := Client.UpdatePost(up4); err == nil {
		t.Fatal("shouldn't have been able to update a message when not allowed")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowEditPost = model.ALLOW_EDIT_POST_TIME_LIMIT })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.PostEditTimeLimit = 1 }) //seconds

	post5 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost5, err := Client.CreatePost(post5)
	if err != nil {
		t.Fatal(err)
	}

	msg5 := "zz" + model.NewId() + " update post 5"
	up5 := &model.Post{Id: rpost5.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: msg5}
	if rup5, err := Client.UpdatePost(up5); err != nil {
		t.Fatal(err)
	} else {
		if rup5.Data.(*model.Post).Message != up5.Message {
			t.Fatal("failed to updates")
		}
	}

	time.Sleep(1000 * time.Millisecond)

	up6 := &model.Post{Id: rpost5.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: "zz" + model.NewId() + " update post 5"}
	if _, err := Client.UpdatePost(up6); err == nil {
		t.Fatal("shouldn't have been able to update a message after time limit")
	}
}

func TestGetPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)

	if r1.Order[0] != post3a1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if len(r1.Posts) != 2 { // 3a1 and 3; 3a1's parent already there
		t.Fatal("wrong size")
	}

	r2 := Client.Must(Client.GetPosts(channel1.Id, 2, 2, "")).Data.(*model.PostList)

	if r2.Order[0] != post2.Id {
		t.Fatal("wrong order")
	}

	if r2.Order[1] != post1a1.Id {
		t.Fatal("wrong order")
	}

	if len(r2.Posts) != 3 { // 2 and 1a1; + 1a1's parent
		t.Log(r2.Posts)
		t.Fatal("wrong size")
	}
}

func TestGetPostsSince(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post0 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post0 = Client.Must(Client.CreatePost(post0)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPostsSince(channel1.Id, post1.CreateAt)).Data.(*model.PostList)

	if r1.Order[0] != post3a1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if len(r1.Posts) != 5 {
		t.Fatal("wrong size")
	}

	now := model.GetMillis()
	r2 := Client.Must(Client.GetPostsSince(channel1.Id, now)).Data.(*model.PostList)

	if len(r2.Posts) != 0 {
		t.Fatal("should have been empty")
	}

	post2.Message = "new message"
	Client.Must(Client.UpdatePost(post2))

	r3 := Client.Must(Client.GetPostsSince(channel1.Id, now)).Data.(*model.PostList)

	if len(r3.Order) != 2 { // 2 because deleted post is returned as well
		t.Fatal("missing post update")
	}
}

func TestGetPostsBeforeAfter(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post0 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post0 = Client.Must(Client.CreatePost(post0)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPostsBefore(channel1.Id, post1a1.Id, 0, 10, "")).Data.(*model.PostList)

	if r1.Order[0] != post1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post0.Id {
		t.Fatal("wrong order")
	}

	// including created post from test helper and system 'joined' message
	if len(r1.Posts) != 4 {
		t.Fatal("wrong size")
	}

	r2 := Client.Must(Client.GetPostsAfter(channel1.Id, post3a1.Id, 0, 3, "")).Data.(*model.PostList)

	if len(r2.Posts) != 0 {
		t.Fatal("should have been empty")
	}

	post2.Message = "new message"
	Client.Must(Client.UpdatePost(post2))

	r3 := Client.Must(Client.GetPostsAfter(channel1.Id, post1a1.Id, 0, 2, "")).Data.(*model.PostList)

	if r3.Order[0] != post3.Id {
		t.Fatal("wrong order")
	}

	if r3.Order[1] != post2.Id {
		t.Fatal("wrong order")
	}

	if len(r3.Order) != 2 {
		t.Fatal("missing post update")
	}
}

func TestSearchPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("search", false)).Data.(*model.PostList)

	if len(r1.Order) != 3 {
		t.Fatal("wrong search")
	}

	r2 := Client.Must(Client.SearchPosts("post2", false)).Data.(*model.PostList)

	if len(r2.Order) != 1 && r2.Order[0] == post2.Id {
		t.Fatal("wrong search")
	}

	r3 := Client.Must(Client.SearchPosts("#hashtag", false)).Data.(*model.PostList)

	if len(r3.Order) != 1 && r3.Order[0] == post3.Id {
		t.Fatal("wrong search")
	}

	if r4 := Client.Must(Client.SearchPosts("*", false)).Data.(*model.PostList); len(r4.Order) != 0 {
		t.Fatal("searching for just * shouldn't return any results")
	}

	r5 := Client.Must(Client.SearchPosts("post1 post2", true)).Data.(*model.PostList)

	if len(r5.Order) != 2 {
		t.Fatal("wrong search results")
	}
}

func TestSearchHashtagPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "no hashtag"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("#sgtitlereview", false)).Data.(*model.PostList)

	if len(r1.Order) != 2 {
		t.Fatal("wrong search")
	}
}

func TestSearchPostsInChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel
	team := th.BasicTeam

	post1 := &model.Post{ChannelId: channel1.Id, Message: "sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	channel2 := &model.Channel{DisplayName: "TestGetPosts", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "TestGetPosts", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	post2 := &model.Post{ChannelId: channel2.Id, Message: "sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel2.Id, Message: "other message with no return"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel3.Id, Message: "other message with no return"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("channel:", false)).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in:", false)).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("ChAnNeL: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview", false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview in: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: "+channel2.Name+" channel: "+channel3.Name, false)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned :) %v :) %v", result.Posts, result.Order)
	}
}

func TestSearchPostsFromUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	channel2 := th.CreateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel1.Id, th.BasicUser2.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser2.Id))
	user3 := th.CreateUser(Client)
	th.LinkUserToTeam(user3, team)
	Client.Must(Client.AddChannelMember(channel1.Id, user3.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, user3.Id))

	post1 := &model.Post{ChannelId: channel1.Id, Message: "sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	th.LoginBasic2()

	post2 := &model.Post{ChannelId: channel2.Id, Message: "sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user1.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" sgtitlereview", false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	post3 := &model.Post{ChannelId: channel1.Id, Message: "hullo"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" in:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	Client.Login(user3.Email, user3.Password)

	// wait for the join/leave messages to be created for user3 since they're done asynchronously
	time.Sleep(100 * time.Millisecond)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username+" in:"+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	post4 := &model.Post{ChannelId: channel2.Id, Message: "coconut"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username+" in:"+channel2.Name+" coconut", false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}
}

func TestGetPostsCache(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	etag := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Etag

	// test etag caching
	if cache_result, err := Client.GetPosts(channel1.Id, 0, 2, etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.PostList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

	etag = Client.Must(Client.GetPost(channel1.Id, post1.Id, "")).Etag

	// test etag caching
	if cache_result, err := Client.GetPost(channel1.Id, post1.Id, etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.PostList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

}

func TestDeletePosts(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel
	team1 := th.BasicTeam

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.RestrictPostDelete = model.PERMISSIONS_DELETE_POST_ALL })
	th.App.SetDefaultRolesBasedOnConfig()

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post1.Id, ParentId: post1a1.Id}
	post1a2 = Client.Must(Client.CreatePost(post1a2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	Client.Must(Client.DeletePost(channel1.Id, post3.Id))

	r2 := Client.Must(Client.GetPosts(channel1.Id, 0, 10, "")).Data.(*model.PostList)

	if post := r2.Posts[post3.Id]; post != nil {
		t.Fatal("should have not returned deleted post")
	}

	time.Sleep(10 * time.Millisecond)
	post4a := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post4a = Client.Must(Client.CreatePost(post4a)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post4b := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post4b = Client.Must(Client.CreatePost(post4b)).Data.(*model.Post)

	SystemAdminClient := th.SystemAdminClient
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	SystemAdminClient.Must(SystemAdminClient.JoinChannel(channel1.Id))

	th.LoginBasic2()
	Client.Must(Client.JoinChannel(channel1.Id))

	if _, err := Client.DeletePost(channel1.Id, post4a.Id); err == nil {
		t.Fatal(err)
	}

	// Test licensed policy controls for delete post
	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
	}()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)

	Client.Logout()
	th.LoginBasic2()
	Client.SetTeamId(team1.Id)

	Client.Must(Client.DeletePost(channel1.Id, post4a.Id))

	SystemAdminClient.Must(SystemAdminClient.DeletePost(channel1.Id, post4b.Id))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.RestrictPostDelete = model.PERMISSIONS_DELETE_POST_TEAM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()

	time.Sleep(10 * time.Millisecond)
	post5a := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post5a = Client.Must(Client.CreatePost(post5a)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post5b := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post5b = Client.Must(Client.CreatePost(post5b)).Data.(*model.Post)

	if _, err := Client.DeletePost(channel1.Id, post5a.Id); err == nil {
		t.Fatal(err)
	}

	th.LoginBasic2()

	Client.Must(Client.DeletePost(channel1.Id, post5a.Id))

	SystemAdminClient.Must(SystemAdminClient.DeletePost(channel1.Id, post5b.Id))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.RestrictPostDelete = model.PERMISSIONS_DELETE_POST_SYSTEM_ADMIN
	})
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()

	time.Sleep(10 * time.Millisecond)
	post6a := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post6a = Client.Must(Client.CreatePost(post6a)).Data.(*model.Post)

	if _, err := Client.DeletePost(channel1.Id, post6a.Id); err == nil {
		t.Fatal(err)
	}

	th.LoginBasic2()

	if _, err := Client.DeletePost(channel1.Id, post6a.Id); err == nil {
		t.Fatal(err)
	}

	// Check that if unlicensed the policy restriction is not enforced.
	utils.SetIsLicensed(false)
	utils.SetLicense(nil)
	th.App.SetDefaultRolesBasedOnConfig()

	time.Sleep(10 * time.Millisecond)
	post7 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post7 = Client.Must(Client.CreatePost(post7)).Data.(*model.Post)

	if _, err := Client.DeletePost(channel1.Id, post7.Id); err != nil {
		t.Fatal(err)
	}

	SystemAdminClient.Must(SystemAdminClient.DeletePost(channel1.Id, post6a.Id))

}

func TestEmailMention(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel
	Client.Must(Client.AddChannelMember(channel1.Id, th.BasicUser2.Id))

	th.LoginBasic2()
	//Set the notification properties
	data := make(map[string]string)
	data["user_id"] = th.BasicUser2.Id
	data["email"] = "true"
	data["desktop"] = "all"
	data["desktop_sound"] = "false"
	data["comments"] = "any"
	Client.Must(Client.UpdateUserNotify(data))

	store.Must(th.App.Srv.Store.Preference().Save(&model.Preferences{{
		UserId:   th.BasicUser2.Id,
		Category: model.PREFERENCE_CATEGORY_NOTIFICATIONS,
		Name:     model.PREFERENCE_NAME_EMAIL_INTERVAL,
		Value:    "0",
	}}))

	//Delete all the messages before create a mention post
	utils.DeleteMailBox(th.BasicUser2.Email)

	//Send a mention message from user1 to user2
	th.LoginBasic()
	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "@" + th.BasicUser2.Username + " this is a test"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	var resultsMailbox utils.JSONMessageHeaderInbucket
	err := utils.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = utils.GetMailBox(th.BasicUser2.Email)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}
	if err == nil && len(resultsMailbox) > 0 {
		if !strings.ContainsAny(resultsMailbox[len(resultsMailbox)-1].To[0], th.BasicUser2.Email) {
			t.Fatal("Wrong To recipient")
		} else {
			for i := 0; i < 30; i++ {
				for j := len(resultsMailbox) - 1; j >= 0; j-- {
					isUser := false
					for _, to := range resultsMailbox[j].To {
						if to == "<"+th.BasicUser2.Email+">" {
							isUser = true
						}
					}
					if !isUser {
						continue
					}
					if resultsEmail, err := utils.GetMessageFromMailbox(th.BasicUser2.Email, resultsMailbox[j].ID); err == nil {
						if strings.Contains(resultsEmail.Body.Text, post1.Message) {
							return
						} else if i == 4 {
							t.Log(resultsEmail.Body.Text)
							t.Fatal("Received wrong Message")
						}
					}
				}
				time.Sleep(100 * time.Millisecond)
			}
			t.Fatal("Didn't receive message")
		}
	}
}

func TestFuzzyPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	for i := 0; i < len(utils.FUZZY_STRINGS_POSTS); i++ {
		post := &model.Post{ChannelId: channel1.Id, Message: utils.FUZZY_STRINGS_POSTS[i]}

		_, err := Client.CreatePost(post)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetFlaggedPosts(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user1 := th.BasicUser
	post1 := th.BasicPost

	preferences := &model.Preferences{
		{
			UserId:   user1.Id,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     post1.Id,
			Value:    "true",
		},
	}
	Client.Must(Client.SetPreferences(preferences))

	r1 := Client.Must(Client.GetFlaggedPosts(0, 2)).Data.(*model.PostList)

	if len(r1.Order) == 0 {
		t.Fatal("should have gotten a flagged post")
	}

	if _, ok := r1.Posts[post1.Id]; !ok {
		t.Fatal("missing flagged post")
	}

	Client.DeletePreferences(preferences)

	r2 := Client.Must(Client.GetFlaggedPosts(0, 2)).Data.(*model.PostList)

	if len(r2.Order) != 0 {
		t.Fatal("should not have gotten a flagged post")
	}

	Client.SetTeamId(model.NewId())
	if _, err := Client.GetFlaggedPosts(0, 2); err == nil {
		t.Fatal("should have failed - bad team id")
	}
}

func TestGetMessageForNotification(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testPng := store.Must(th.App.Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test1.png",
		Name:      "test1.png",
		MimeType:  "image/png",
	})).(*model.FileInfo)

	testJpg1 := store.Must(th.App.Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test2.jpg",
		Name:      "test2.jpg",
		MimeType:  "image/jpeg",
	})).(*model.FileInfo)

	testFile := store.Must(th.App.Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test1.go",
		Name:      "test1.go",
		MimeType:  "text/plain",
	})).(*model.FileInfo)

	testJpg2 := store.Must(th.App.Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test3.jpg",
		Name:      "test3.jpg",
		MimeType:  "image/jpeg",
	})).(*model.FileInfo)

	translateFunc := utils.GetUserTranslations("en")

	post := &model.Post{
		Id:      model.NewId(),
		Message: "test",
	}

	if th.App.GetMessageForNotification(post, translateFunc) != "test" {
		t.Fatal("should've returned message text")
	}

	post.FileIds = model.StringArray{testPng.Id}
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(testPng.Id, post.Id))
	if th.App.GetMessageForNotification(post, translateFunc) != "test" {
		t.Fatal("should've returned message text, even with attachments")
	}

	post.Message = ""
	if message := th.App.GetMessageForNotification(post, translateFunc); message != "1 image sent: test1.png" {
		t.Fatal("should've returned number of images:", message)
	}

	post.FileIds = model.StringArray{testPng.Id, testJpg1.Id}
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(testJpg1.Id, post.Id))
	th.App.Srv.Store.FileInfo().InvalidateFileInfosForPostCache(post.Id)
	if message := th.App.GetMessageForNotification(post, translateFunc); message != "2 images sent: test1.png, test2.jpg" && message != "2 images sent: test2.jpg, test1.png" {
		t.Fatal("should've returned number of images:", message)
	}

	post.Id = model.NewId()
	post.FileIds = model.StringArray{testFile.Id}
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(testFile.Id, post.Id))
	if message := th.App.GetMessageForNotification(post, translateFunc); message != "1 file sent: test1.go" {
		t.Fatal("should've returned number of files:", message)
	}

	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(testJpg2.Id, post.Id))
	th.App.Srv.Store.FileInfo().InvalidateFileInfosForPostCache(post.Id)
	post.FileIds = model.StringArray{testFile.Id, testJpg2.Id}
	if message := th.App.GetMessageForNotification(post, translateFunc); message != "2 files sent: test1.go, test3.jpg" && message != "2 files sent: test3.jpg, test1.go" {
		t.Fatal("should've returned number of mixed files:", message)
	}
}

func TestGetFileInfosForPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	fileIds := make([]string, 3)
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		for i := 0; i < 3; i++ {
			fileIds[i] = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		}
	}

	post1 := Client.Must(Client.CreatePost(&model.Post{
		ChannelId: channel1.Id,
		Message:   "test",
		FileIds:   fileIds,
	})).Data.(*model.Post)

	var etag string
	if infos, err := Client.GetFileInfosForPost(channel1.Id, post1.Id, ""); err != nil {
		t.Fatal(err)
	} else if len(infos) != 3 {
		t.Fatal("should've received 3 files")
	} else if Client.Etag == "" {
		t.Fatal("should've received etag")
	} else {
		etag = Client.Etag
	}

	if infos, err := Client.GetFileInfosForPost(channel1.Id, post1.Id, etag); err != nil {
		t.Fatal(err)
	} else if len(infos) != 0 {
		t.Fatal("should've returned nothing because of etag")
	}
}

func TestGetPostById(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "yommamma" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	if post, respMetadata := Client.GetPostById(post1.Id, ""); respMetadata.Error != nil {
		t.Fatal(respMetadata.Error)
	} else {
		if len(post.Order) != 1 {
			t.Fatal("should be just one post")
		}

		if post.Order[0] != post1.Id {
			t.Fatal("wrong order")
		}

		if post.Posts[post.Order[0]].Message != post1.Message {
			t.Fatal("wrong message from post")
		}
	}

	if _, respMetadata := Client.GetPostById("45345435345345", ""); respMetadata.Error == nil {
		t.Fatal(respMetadata.Error)
	}
}

func TestGetPermalinkTmp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel
	team := th.BasicTeam

	th.LoginBasic()

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "zz" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	etag := Client.Must(Client.GetPost(channel1.Id, post1.Id, "")).Etag

	// test etag caching
	if cache_result, respMetadata := Client.GetPermalink(channel1.Id, post1.Id, etag); respMetadata.Error != nil {
		t.Fatal(respMetadata.Error)
	} else if cache_result != nil {
		t.Log(cache_result)
		t.Fatal("cache should be empty")
	}

	if results, respMetadata := Client.GetPermalink(channel1.Id, post1.Id, ""); respMetadata.Error != nil {
		t.Fatal(respMetadata.Error)
	} else if results == nil {
		t.Fatal("should not be empty")
	}

	// Test permalink to private channels.
	channel2 := &model.Channel{DisplayName: "TestGetPermalinkPriv", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel2.Id, Message: "zz" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	if _, md := Client.GetPermalink(channel2.Id, post3.Id, ""); md.Error != nil {
		t.Fatal(md.Error)
	}

	th.LoginBasic2()

	if _, md := Client.GetPermalink(channel2.Id, post3.Id, ""); md.Error == nil {
		t.Fatal("Expected 403 error")
	}

	// Test direct channels.
	th.LoginBasic()
	channel3 := Client.Must(Client.CreateDirectChannel(th.SystemAdminUser.Id)).Data.(*model.Channel)
	time.Sleep(10 * time.Millisecond)
	post4 := &model.Post{ChannelId: channel3.Id, Message: "zz" + model.NewId() + "a"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	if _, md := Client.GetPermalink(channel3.Id, post4.Id, ""); md.Error != nil {
		t.Fatal(md.Error)
	}

	th.LoginBasic2()

	if _, md := Client.GetPermalink(channel3.Id, post4.Id, ""); md.Error == nil {
		t.Fatal("Expected 403 error")
	}
}

func TestGetOpenGraphMetadata(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableLinkPreviews = true
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	ogDataCacheMissCount := 0

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ogDataCacheMissCount++

		if r.URL.Path == "/og-data/" {
			fmt.Fprintln(w, `
				<html><head><meta property="og:type" content="article" />
		  		<meta property="og:title" content="Test Title" />
		  		<meta property="og:url" content="http://example.com/" />
				</head><body></body></html>
			`)
		} else if r.URL.Path == "/no-og-data/" {
			fmt.Fprintln(w, `<html><head></head><body></body></html>`)
		}
	}))

	for _, data := range [](map[string]interface{}){
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 1},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},

		// Data should be cached for following
		{"path": "/og-data/", "title": "Test Title", "cacheMissCount": 2},
		{"path": "/no-og-data/", "title": "", "cacheMissCount": 2},
	} {
		res, err := Client.DoApiPost(
			"/get_opengraph_metadata",
			fmt.Sprintf("{\"url\":\"%s\"}", ts.URL+data["path"].(string)),
		)
		if err != nil {
			t.Fatal(err)
		}

		ogData := model.StringInterfaceFromJson(res.Body)
		if strings.Compare(ogData["title"].(string), data["title"].(string)) != 0 {
			t.Fatal(fmt.Sprintf(
				"OG data title mismatch for path \"%s\". Expected title: \"%s\". Actual title: \"%s\"",
				data["path"].(string), data["title"].(string), ogData["title"].(string),
			))
		}

		if ogDataCacheMissCount != data["cacheMissCount"].(int) {
			t.Fatal(fmt.Sprintf(
				"Cache miss count didn't match. Expected value %d. Actual value %d.",
				data["cacheMissCount"].(int), ogDataCacheMissCount,
			))
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = false })
	if _, err := Client.DoApiPost("/get_opengraph_metadata", "{\"url\":\"/og-data/\"}"); err == nil || err.StatusCode != http.StatusNotImplemented {
		t.Fatal("should have failed with 501 - disabled link previews")
	}
}

func TestPinPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	post := th.BasicPost
	if rupost1, err := Client.PinPost(post.ChannelId, post.Id); err != nil {
		t.Fatal(err)
	} else {
		if !rupost1.Data.(*model.Post).IsPinned {
			t.Fatal("failed to pin post")
		}
	}

	pinnedPost := th.PinnedPost
	if rupost2, err := Client.PinPost(pinnedPost.ChannelId, pinnedPost.Id); err != nil {
		t.Fatal(err)
	} else {
		if !rupost2.Data.(*model.Post).IsPinned {
			t.Fatal("pinning a post should be idempotent")
		}
	}
}

func TestUnpinPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	pinnedPost := th.PinnedPost
	if rupost1, err := Client.UnpinPost(pinnedPost.ChannelId, pinnedPost.Id); err != nil {
		t.Fatal(err)
	} else {
		if rupost1.Data.(*model.Post).IsPinned {
			t.Fatal("failed to unpin post")
		}
	}

	post := th.BasicPost
	if rupost2, err := Client.UnpinPost(post.ChannelId, post.Id); err != nil {
		t.Fatal(err)
	} else {
		if rupost2.Data.(*model.Post).IsPinned {
			t.Fatal("unpinning a post should be idempotent")
		}
	}
}
