// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"regexp"

	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

var matterbotUser *model.User

const (
	matterbotName  = "Matterbot"
	matterbotEmail = "matterbot@mattermost.com"
)

func InitMatterbot() {
	// Find an existing matterbot or create a new matterbot user
	if matterbotUser == nil {
		matterbotUser = makeMatterbotUserIfNeeded()
	}
}

func makeMatterbotUserIfNeeded() *model.User {
	// Try to find an existing matterbot user
	if result := <-Srv.Store.User().GetByUsername(matterbotName); result.Err == nil {
		existingUser := result.Data.(*model.User)
		if existingUser.Email != matterbotEmail || !existingUser.EmailVerified {
			l4g.Error(utils.T("api.matterbot.init_matterbot.create_user.error"))
			return nil
		}
		return existingUser
	}
	// Create a new matterbot user
	newUser := &model.User{
		Email:         matterbotEmail,
		Username:      matterbotName,
		Nickname:      matterbotName,
		Password:      model.NewRandomString(16),
		EmailVerified: true,
	}

	// matterbot is always online
	SetStatusOnline(newUser.Id, "", true)

	if u, err := CreateUser(newUser); err != nil {
		l4g.Error(utils.T("api.matterbot.init_matterbot.create_user.error"), err)
		return nil
	} else {
		return u
	}
}

func SendMatterbotMessage(c *Context, userId string, message string) {
	if matterbotUser == nil || userId == matterbotUser.Id {
		return
	}

	// Try to get an existing direct channel
	var botchannel *model.Channel
	if result := <-Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(userId, matterbotUser.Id)); result.Err != nil {
		// Create a direct channel
		if sc, err := CreateDirectChannel(matterbotUser.Id, userId); err != nil {
			l4g.Error(utils.T("api.matterbot.send_message.create_direct_channel.error"), err)
			return
		} else {
			botchannel = sc
		}
	} else {
		botchannel = result.Data.(*model.Channel)
	}

	// Create the post
	if botchannel != nil {
		post := &model.Post{
			ChannelId: botchannel.Id,
			Message:   message,
			Type:      model.POST_DEFAULT,
			UserId:    matterbotUser.Id,
		}

		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error(utils.T("api.matterbot.send_message.create_post.error"), err)
			return
		}
	}
}

func MatterbotPostUserRemovedMessage(c *Context, removedUserId string, otherUserId string, channel *model.Channel) {
	if matterbotUser == nil {
		return
	}

	// Get the user that removed the removed user
	if oresult := <-Srv.Store.User().Get(otherUserId); oresult.Err != nil {
		l4g.Error(utils.T("api.matterbot.channel.remove_member.error"), oresult.Err)
		return
	} else {
		otherUser := oresult.Data.(*model.User)
		message := fmt.Sprintf(utils.T("api.matterbot.channel.remove_member.removed"), channel.DisplayName, otherUser.Username)

		go SendMatterbotMessage(c, removedUserId, message)
	}
}

func MatterbotPostChannelDeletedMessage(c *Context, channel *model.Channel, user *model.User) {
	var members []model.ChannelMember

	if result := <-Srv.Store.Channel().GetMembers(channel.Id); result.Err != nil {
		l4g.Error(utils.T("api.matterbot.channel.retrieve_members.error"), result.Err)
		return
	} else {
		members = result.Data.([]model.ChannelMember)

		for _, channelMember := range members {
			if channelMember.UserId != user.Id {
				message := fmt.Sprintf(utils.T("api.matterbot.channel.delete_channel.archived"), user.Username, channel.DisplayName)
				go SendMatterbotMessage(c, channelMember.UserId, message)
			}
		}
	}
}

func MatterbotProcessPost(c *Context, post *model.Post) {
	if matterbotUser == nil || matterbotUser.Id == post.UserId {
		return
	}

	// Check if the post was sent to matterbot
	if cresult := <-Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(post.UserId, matterbotUser.Id)); cresult.Err != nil {
		// No direct message channel between sender and matterbot
		return
	} else if cresult.Data.(*model.Channel).Id != post.ChannelId {
		// The message is not meant for matterbot
		return
	}

	// Get the sending user to retrieve personal information
	var sender *model.User
	if uresult := <-Srv.Store.User().Get(post.UserId); uresult.Err != nil {
		// No user for the post
		return
	} else {
		sender = uresult.Data.(*model.User)
	}

	msg := strings.ToLower(post.Message)

	// Respond to a greeting
	if matched, _ := regexp.MatchString(`(?:^|\W)(?:hi|hello|hey)(?: matterbot)?!*(?:$|\W)`, msg); matched {
		SendMatterbotMessage(c, sender.Id, "Hey "+sender.GetDisplayName()+"!")
	}

	// Respond to gratitude
	if matched, _ := regexp.MatchString(`(?:^|\W)(?:thanks|thank you)(?: matterbot)?!*(?:$|\W)`, msg); matched {
		SendMatterbotMessage(c, sender.Id, "No problem "+sender.GetDisplayName()+"!")
	}
}
