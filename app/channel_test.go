package app

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup().InitBasic()

	incomingWasEnabled := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	outgoingWasEnabled := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = incomingWasEnabled
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = outgoingWasEnabled
	}()

	channel, err := th.App.CreateChannel(&model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		th.App.PermanentDeleteChannel(channel)
	}()

	incoming, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteIncomingWebhook(incoming.Id)

	if incoming, err = th.App.GetIncomingWebhook(incoming.Id); incoming == nil || err != nil {
		t.Fatal("unable to get new incoming webhook")
	}

	outgoing, err := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"http://foo"},
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteOutgoingWebhook(outgoing.Id)

	if outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id); outgoing == nil || err != nil {
		t.Fatal("unable to get new outgoing webhook")
	}

	if err := th.App.PermanentDeleteChannel(channel); err != nil {
		t.Fatal(err.Error())
	}

	if incoming, err = th.App.GetIncomingWebhook(incoming.Id); incoming != nil || err == nil {
		t.Error("incoming webhook wasn't deleted")
	}

	if outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id); outgoing != nil || err == nil {
		t.Error("outgoing webhook wasn't deleted")
	}
}

func TestMoveChannel(t *testing.T) {
	th := Setup().InitBasic()

	sourceTeam := th.CreateTeam()
	targetTeam := th.CreateTeam()
	channel1 := th.CreateChannel(sourceTeam)
	defer func() {
		th.App.PermanentDeleteChannel(channel1)
		th.App.PermanentDeleteTeam(sourceTeam)
		th.App.PermanentDeleteTeam(targetTeam)
	}()

	if _, err := th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser.Id, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser2.Id, ""); err != nil {
		t.Fatal(err)
	}

	if _, err := th.App.AddUserToTeam(targetTeam.Id, th.BasicUser.Id, ""); err != nil {
		t.Fatal(err)
	}

	if _, err := th.App.AddUserToChannel(th.BasicUser, channel1); err != nil {
		t.Fatal(err)
	}
	if _, err := th.App.AddUserToChannel(th.BasicUser2, channel1); err != nil {
		t.Fatal(err)
	}

	if err := th.App.MoveChannel(targetTeam, channel1); err == nil {
		t.Fatal("Should have failed due to mismatched members.")
	}

	if _, err := th.App.AddUserToTeam(targetTeam.Id, th.BasicUser2.Id, ""); err != nil {
		t.Fatal(err)
	}

	if err := th.App.MoveChannel(targetTeam, channel1); err != nil {
		t.Fatal(err)
	}
}

func TestPostAddToChannelMessage(t *testing.T) {
	th := Setup().InitBasic()
	team := th.CreateTeam()
	channel := th.CreateChannel(team)
	user := th.BasicUser

	enableEmailBatching := *utils.Cfg.EmailSettings.EnableEmailBatching
	sendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	defer func() {
		*utils.Cfg.EmailSettings.EnableEmailBatching = enableEmailBatching
		utils.Cfg.EmailSettings.SendEmailNotifications = sendEmailNotifications
	}()
	*utils.Cfg.EmailSettings.EnableEmailBatching = false
	utils.Cfg.EmailSettings.SendEmailNotifications = false

	// test for one user added to channel

	addedUser1 := th.CreateUser()
	if _, err := th.App.AddUserToTeam(team.Id, addedUser1.Id, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := th.App.AddChannelMember(addedUser1.Id, channel, user.Id); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)

	expectedMessage := fmt.Sprintf(utils.T("api.channel.add_member.added"), user.Username, addedUser1.Username)

	rpost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if rpost.Props["username"] != user.Username || rpost.Props["addedUsername"] != addedUser1.Username && rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test for multiple users added to channel

	addedUser2 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, addedUser2.Id, "")
	th.App.AddChannelMember(addedUser2.Id, channel, user.Id)
	time.Sleep(100 * time.Millisecond)

	rpost = (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if rpost.Props[model.POST_PROPS_USER_ACTIVITIES] == nil {
		t.Fatal("should not be nil")
	}

	userActivities := []interface{}{
		map[string]interface{}{"type": model.POST_ADD_TO_CHANNEL, "username": user.Username, "addedUsername": addedUser1.Username},
		map[string]interface{}{"type": model.POST_ADD_TO_CHANNEL, "username": user.Username, "addedUsername": addedUser2.Username},
	}

	expectedMessage += " " + fmt.Sprintf(utils.T("api.channel.add_member.added"), user.Username, addedUser2.Username)

	if !reflect.DeepEqual(rpost.Props[model.POST_PROPS_USER_ACTIVITIES].([]interface{}), userActivities) && rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test for multiple users added to channel, with new post when exceeded POST_PROPS_USER_ACTIVITIES_MAX of 50

	for i := len(userActivities); i < model.POST_PROPS_USER_ACTIVITIES_MAX; i++ {
		userActivities = append(userActivities, map[string]interface{}{"type": model.POST_ADD_TO_CHANNEL, "username": user.Username, "addedUsername": "user" + strconv.Itoa(i)})
	}

	rpost.Props[model.POST_PROPS_USER_ACTIVITIES] = userActivities

	rpost, err := th.App.UpdatePost(rpost, false)
	if err != nil {
		t.Fatal(err)
	}

	addedUser3 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, addedUser3.Id, "")
	th.App.AddChannelMember(addedUser3.Id, channel, user.Id)
	time.Sleep(100 * time.Millisecond)

	newPost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if newPost.Id == rpost.Id {
		t.Fatal("should create new post after reaching max user_activities props")
	}
	if newPost.Props[model.POST_PROPS_USER_ACTIVITIES] != nil {
		t.Fatal("should be nil")
	}
	if newPost.Props["username"] != user.Username || newPost.Props["addedUsername"] != addedUser3.Username {
		t.Fatal("should be equal")
	}
}

func TestPostRemoveChannelMessage(t *testing.T) {
	th := Setup().InitBasic()
	team := th.CreateTeam()
	channel := th.CreateChannel(team)
	user := th.BasicUser

	enableEmailBatching := *utils.Cfg.EmailSettings.EnableEmailBatching
	sendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	defer func() {
		*utils.Cfg.EmailSettings.EnableEmailBatching = enableEmailBatching
		utils.Cfg.EmailSettings.SendEmailNotifications = sendEmailNotifications
	}()
	*utils.Cfg.EmailSettings.EnableEmailBatching = false
	utils.Cfg.EmailSettings.SendEmailNotifications = false

	userToRemove1 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToRemove1.Id, "")
	userToRemove2 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToRemove2.Id, "")
	userToRemove3 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToRemove3.Id, "")

	th.App.AddChannelMember(userToRemove1.Id, channel, user.Id)
	th.App.AddChannelMember(userToRemove2.Id, channel, user.Id)
	th.App.AddChannelMember(userToRemove3.Id, channel, user.Id)

	// create dummy post as separator
	th.CreatePost(channel)
	time.Sleep(100 * time.Millisecond)

	// test for one user removed from channel

	if err := th.App.RemoveUserFromChannel(userToRemove1.Id, user.Id, channel); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)

	expectedMessage := fmt.Sprintf(utils.T("api.channel.remove_member.removed"), userToRemove1.Username)
	rpost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)

	if rpost.Props["removedUsername"] != userToRemove1.Username || rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test for multiple users removed from channel

	th.App.RemoveUserFromChannel(userToRemove2.Id, user.Id, channel)
	time.Sleep(100 * time.Millisecond)

	rpost = (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if rpost.Props[model.POST_PROPS_USER_ACTIVITIES] == nil {
		t.Fatal("should not be nil")
	}

	userActivities := []interface{}{
		map[string]interface{}{"type": model.POST_REMOVE_FROM_CHANNEL, "removedUsername": userToRemove1.Username},
		map[string]interface{}{"type": model.POST_REMOVE_FROM_CHANNEL, "removedUsername": userToRemove2.Username},
	}

	expectedMessage += " " + fmt.Sprintf(utils.T("api.channel.remove_member.removed"), userToRemove2.Username)

	if !reflect.DeepEqual(rpost.Props[model.POST_PROPS_USER_ACTIVITIES].([]interface{}), userActivities) && rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test of multiple users removed from channel, with new post when exceeded POST_PROPS_USER_ACTIVITIES_MAX of 50

	for i := len(userActivities); i < model.POST_PROPS_USER_ACTIVITIES_MAX; i++ {
		userActivities = append(userActivities, map[string]interface{}{"type": model.POST_REMOVE_FROM_CHANNEL, "removedUsername": "user" + strconv.Itoa(i)})
	}

	rpost.Props[model.POST_PROPS_USER_ACTIVITIES] = userActivities

	rpost, err := th.App.UpdatePost(rpost, false)
	if err != nil {
		t.Fatal(err)
	}

	th.App.RemoveUserFromChannel(userToRemove3.Id, user.Id, channel)
	time.Sleep(100 * time.Millisecond)

	newPost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if newPost.Id == rpost.Id {
		t.Fatal("should create new post after reaching max user_activities props")
	}
	if newPost.Props[model.POST_PROPS_USER_ACTIVITIES] != nil {
		t.Fatal("should be nil")
	}
	if newPost.Props["removedUsername"] != userToRemove3.Username {
		t.Fatal("should be equal")
	}
}

func TestPostLeaveChannelMessage(t *testing.T) {
	th := Setup().InitBasic()
	team := th.CreateTeam()
	channel := th.CreateChannel(team)
	user := th.BasicUser

	enableEmailBatching := *utils.Cfg.EmailSettings.EnableEmailBatching
	sendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	defer func() {
		*utils.Cfg.EmailSettings.EnableEmailBatching = enableEmailBatching
		utils.Cfg.EmailSettings.SendEmailNotifications = sendEmailNotifications
	}()
	*utils.Cfg.EmailSettings.EnableEmailBatching = false
	utils.Cfg.EmailSettings.SendEmailNotifications = false

	userToLeave1 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToLeave1.Id, "")
	userToLeave2 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToLeave2.Id, "")
	userToLeave3 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToLeave3.Id, "")

	th.App.AddChannelMember(userToLeave1.Id, channel, user.Id)
	th.App.AddChannelMember(userToLeave2.Id, channel, user.Id)
	th.App.AddChannelMember(userToLeave3.Id, channel, user.Id)

	// create dummy post as separator
	th.CreatePost(channel)
	time.Sleep(100 * time.Millisecond)

	// test for one user left the channel

	if err := th.App.LeaveChannel(channel.Id, userToLeave1.Id); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)

	expectedMessage := fmt.Sprintf(utils.T("api.channel.leave.left"), userToLeave1.Username)
	rpost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)

	if rpost.Props["username"] != userToLeave1.Username || rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test for multiple users left the channel

	th.App.LeaveChannel(channel.Id, userToLeave2.Id)
	time.Sleep(100 * time.Millisecond)

	rpost = (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if rpost.Props[model.POST_PROPS_USER_ACTIVITIES] == nil {
		t.Fatal("should not be nil")
	}

	userActivities := []interface{}{
		map[string]interface{}{"type": model.POST_LEAVE_CHANNEL, "username": userToLeave1.Username},
		map[string]interface{}{"type": model.POST_LEAVE_CHANNEL, "username": userToLeave2.Username},
	}

	expectedMessage += " " + fmt.Sprintf(utils.T("api.channel.remove_member.removed"), userToLeave2.Username)

	if !reflect.DeepEqual(rpost.Props[model.POST_PROPS_USER_ACTIVITIES].([]interface{}), userActivities) && rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test of multiple users left the channel, with new post when exceeded POST_PROPS_USER_ACTIVITIES_MAX of 50

	for i := len(userActivities); i < model.POST_PROPS_USER_ACTIVITIES_MAX; i++ {
		userActivities = append(userActivities, map[string]interface{}{"type": model.POST_LEAVE_CHANNEL, "username": "user" + strconv.Itoa(i)})
	}

	rpost.Props[model.POST_PROPS_USER_ACTIVITIES] = userActivities

	rpost, err := th.App.UpdatePost(rpost, false)
	if err != nil {
		t.Fatal(err)
	}

	th.App.LeaveChannel(channel.Id, userToLeave3.Id)
	time.Sleep(100 * time.Millisecond)

	newPost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if newPost.Id == rpost.Id {
		t.Fatal("should create new post after reaching max user_activities props")
	}
	if newPost.Props[model.POST_PROPS_USER_ACTIVITIES] != nil {
		t.Fatal("should be nil")
	}
	if newPost.Props["username"] != userToLeave3.Username {
		t.Fatal("should be equal")
	}
}

func TestPostJoinChannelMessage(t *testing.T) {
	th := Setup().InitBasic()
	team := th.CreateTeam()
	channel := th.CreateChannel(team)

	enableEmailBatching := *utils.Cfg.EmailSettings.EnableEmailBatching
	sendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	defer func() {
		*utils.Cfg.EmailSettings.EnableEmailBatching = enableEmailBatching
		utils.Cfg.EmailSettings.SendEmailNotifications = sendEmailNotifications
	}()
	*utils.Cfg.EmailSettings.EnableEmailBatching = false
	utils.Cfg.EmailSettings.SendEmailNotifications = false

	userToJoin1 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToJoin1.Id, "")
	userToJoin2 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToJoin2.Id, "")
	userToJoin3 := th.CreateUser()
	th.App.AddUserToTeam(team.Id, userToJoin3.Id, "")

	// create dummy post as separator
	th.CreatePost(channel)
	time.Sleep(100 * time.Millisecond)

	// test for one user joined the channel

	if err := th.App.JoinChannel(channel, userToJoin1.Id); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)

	expectedMessage := fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), userToJoin1.Username)
	rpost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)

	if rpost.Props["username"] != userToJoin1.Username || rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test for multiple users joined the channel

	th.App.JoinChannel(channel, userToJoin2.Id)
	time.Sleep(100 * time.Millisecond)

	rpost = (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if rpost.Props[model.POST_PROPS_USER_ACTIVITIES] == nil {
		t.Fatal("should not be nil")
	}

	userActivities := []interface{}{
		map[string]interface{}{"type": model.POST_JOIN_CHANNEL, "username": userToJoin1.Username},
		map[string]interface{}{"type": model.POST_JOIN_CHANNEL, "username": userToJoin2.Username},
	}

	expectedMessage += " " + fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), userToJoin2.Username)

	if !reflect.DeepEqual(rpost.Props[model.POST_PROPS_USER_ACTIVITIES].([]interface{}), userActivities) && rpost.Message != expectedMessage {
		t.Fatal("should be equal")
	}

	// test of multiple users left joined channel, with new post when exceeded POST_PROPS_USER_ACTIVITIES_MAX of 50

	for i := len(userActivities); i < model.POST_PROPS_USER_ACTIVITIES_MAX; i++ {
		userActivities = append(userActivities, map[string]interface{}{"type": model.POST_JOIN_CHANNEL, "username": "user" + strconv.Itoa(i)})
	}

	rpost.Props[model.POST_PROPS_USER_ACTIVITIES] = userActivities

	rpost, err := th.App.UpdatePost(rpost, false)
	if err != nil {
		t.Fatal(err)
	}

	th.App.JoinChannel(channel, userToJoin3.Id)
	time.Sleep(100 * time.Millisecond)

	newPost := (<-th.App.Srv.Store.Post().GetLastPostForChannel(channel.Id)).Data.(*model.Post)
	if newPost.Id == rpost.Id {
		t.Fatal("should create new post after reaching max user_activities props")
	}
	if newPost.Props[model.POST_PROPS_USER_ACTIVITIES] != nil {
		t.Fatal("should be nil")
	}
	if newPost.Props["username"] != userToJoin3.Username {
		t.Fatal("should be equal")
	}
}

func TestGetLastPostForChannel(t *testing.T) {
	th := Setup().InitBasic()
	user := th.BasicUser

	enableEmailBatching := *utils.Cfg.EmailSettings.EnableEmailBatching
	sendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	defer func() {
		*utils.Cfg.EmailSettings.EnableEmailBatching = enableEmailBatching
		utils.Cfg.EmailSettings.SendEmailNotifications = sendEmailNotifications
	}()
	*utils.Cfg.EmailSettings.EnableEmailBatching = false
	utils.Cfg.EmailSettings.SendEmailNotifications = false

	post1 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    user.Id,
		Message:   "message 1",
	}
	post1 = (<-th.App.Srv.Store.Post().Save(post1)).Data.(*model.Post)

	rpost1, err := th.App.GetLastPostForChannel(th.BasicChannel.Id)
	if err != nil {
		t.Fatal("should return last post")
	}

	if post1.Message != rpost1.Message {
		t.Fatal("should match last post message")
	}

	post2 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    user.Id,
		Message:   "message 2",
	}
	post2 = (<-th.App.Srv.Store.Post().Save(post2)).Data.(*model.Post)

	rpost2, err := th.App.GetLastPostForChannel(th.BasicChannel.Id)
	if err != nil {
		t.Fatal("should return last post")
	}

	if post2.Message != rpost2.Message {
		t.Fatal("should match last post message")
	}

	_, err = th.App.GetLastPostForChannel(model.NewId())
	if err != nil {
		t.Fatal("should not return an error")
	}
}
