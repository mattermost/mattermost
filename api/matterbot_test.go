// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func messageCountFromMatterbot(t *testing.T, c *model.Client, u *model.User, expectValid bool) int {
	const (
		MESSAGES_LIMIT = 10
	)

	// matterbot must exist by now?
	if mresult := <-Srv.Store.User().GetByUsername(matterbotName); mresult.Err == nil {
		c.Login(u.Username, u.Password)
		matterbot := mresult.Data.(*model.User)

		// direct channel with matterbot must exist by now?
		if cresult := <-Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(matterbot.Id, u.Id)); cresult.Err == nil {
			botchannel := cresult.Data.(*model.Channel)

			if presult, err := c.GetPosts(botchannel.Id, 0, MESSAGES_LIMIT, ""); err == nil {
				postList := presult.Data.(*model.PostList)
				return len(postList.Posts)

			} else if expectValid {
				t.Fatal(fmt.Sprintf("Could not retrieve Matterbot messages %v", expectValid))
			}

		} else if expectValid {
			t.Fatal(fmt.Sprintf("Matterbot direct channel was not created %v", expectValid))
		}

	} else if expectValid {
		t.Fatal(fmt.Sprintf("Matterbot was not created %v", expectValid))
	}

	return 0
}

func getMockContext(u *model.User, t *model.Team) *Context {
	mockSession := model.Session{
		UserId:      u.Id,
		TeamMembers: []*model.TeamMember{{TeamId: t.Id, UserId: u.Id}},
		IsOAuth:     false,
	}

	newContext := &Context{
		Session:   mockSession,
		RequestId: model.NewId(),
		IpAddress: "",
		Path:      "fake",
		Err:       nil,
		siteURL:   *utils.Cfg.ServiceSettings.SiteURL,
		TeamId:    t.Id,
	}

	return newContext
}

func TestMatterbotMessageOnUserRemoved(t *testing.T) {
	th := Setup().InitBasic()
	c := th.BasicClient
	team := th.BasicTeam

	basic := th.BasicUser
	UpdateUserToTeamAdmin(basic, team)

	basic2 := th.BasicUser2
	LinkUserToTeam(basic2, team)

	// create channel and add the other user
	th.LoginBasic()
	channel := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = c.Must(c.CreateChannel(channel)).Data.(*model.Channel)
	c.Must(c.AddChannelMember(channel.Id, basic2.Id))

	starting_count := messageCountFromMatterbot(t, c, basic2, false)

	MatterbotPostUserRemovedMessage(getMockContext(basic, team), basic2.Id, basic.Id, channel)

	ending_count := messageCountFromMatterbot(t, c, basic2, true)

	if ending_count != starting_count+1 {
		t.Fatal("Matterbot did not create message")
	}
}

func TestMatterbotMessagesOnChannelArchived(t *testing.T) {
	th := Setup().InitBasic()
	c := th.BasicClient
	team := th.BasicTeam

	basic := th.BasicUser
	UpdateUserToTeamAdmin(basic, team)

	user1 := th.CreateUser(c)
	user2 := th.CreateUser(c)
	LinkUserToTeam(user1, team)
	LinkUserToTeam(user2, team)

	// create channel and add the other users
	th.LoginBasic()
	channel := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = c.Must(c.CreateChannel(channel)).Data.(*model.Channel)
	c.Must(c.AddChannelMember(channel.Id, user1.Id))
	c.Must(c.AddChannelMember(channel.Id, user2.Id))

	starting_count1 := messageCountFromMatterbot(t, c, user1, false)
	starting_count2 := messageCountFromMatterbot(t, c, user2, false)

	MatterbotPostChannelDeletedMessage(getMockContext(basic, team), channel, basic)

	ending_count1 := messageCountFromMatterbot(t, c, user1, true)
	ending_count2 := messageCountFromMatterbot(t, c, user2, true)

	if ending_count1 != starting_count1+1 || ending_count2 != starting_count2+1 {
		t.Fatal("Matterbot did not create message")
	}
}
