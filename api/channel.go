// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"net/http"
	"strings"
)

func InitChannel(r *mux.Router) {
	l4g.Debug("Initializing channel api routes")

	sr := r.PathPrefix("/channels").Subrouter()
	sr.Handle("/", ApiUserRequiredActivity(getChannels, false)).Methods("GET")
	sr.Handle("/more", ApiUserRequired(getMoreChannels)).Methods("GET")
	sr.Handle("/create", ApiUserRequired(createChannel)).Methods("POST")
	sr.Handle("/create_direct", ApiUserRequired(createDirectChannel)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateChannel)).Methods("POST")
	sr.Handle("/update_desc", ApiUserRequired(updateChannelDesc)).Methods("POST")
	sr.Handle("/update_notify_level", ApiUserRequired(updateNotifyLevel)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/extra_info", ApiUserRequired(getChannelExtraInfo)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/join", ApiUserRequired(joinChannel)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/leave", ApiUserRequired(leaveChannel)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/delete", ApiUserRequired(deleteChannel)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/add", ApiUserRequired(addChannelMember)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/remove", ApiUserRequired(removeChannelMember)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/update_last_viewed_at", ApiUserRequired(updateLastViewedAt)).Methods("POST")

}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("createChannel", "channel")
		return
	}

	if !c.HasPermissionsToTeam(channel.TeamId, "createChannel") {
		return
	}

	if channel.Type == model.CHANNEL_DIRECT {
		c.Err = model.NewAppError("createDirectChannel", "Must use createDirectChannel api service for direct message channel creation", "")
		return
	}

	if strings.Index(channel.Name, "__") > 0 {
		c.Err = model.NewAppError("createDirectChannel", "Invalid character '__' in channel name for non-direct channel", "")
		return
	}

	if sc, err := CreateChannel(c, channel, true); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
}

func CreateChannel(c *Context, channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().Save(channel); result.Err != nil {
		return nil, result.Err
	} else {
		sc := result.Data.(*model.Channel)

		if addMember {
			cm := &model.ChannelMember{ChannelId: sc.Id, UserId: c.Session.UserId,
				Roles: model.CHANNEL_ROLE_ADMIN, NotifyLevel: model.CHANNEL_NOTIFY_ALL}

			if cmresult := <-Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
				return nil, cmresult.Err
			}
		}

		c.LogAudit("name=" + channel.Name)

		return sc, nil
	}
}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("createDirectChannel", "user_id")
		return
	}

	if !c.HasPermissionsToTeam(c.Session.TeamId, "createDirectChannel") {
		return
	}

	if sc, err := CreateDirectChannel(c, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
}

func CreateDirectChannel(c *Context, otherUserId string) (*model.Channel, *model.AppError) {
	if len(otherUserId) != 26 {
		return nil, model.NewAppError("CreateDirectChannel", "Invalid other user id ", otherUserId)
	}

	uc := Srv.Store.User().Get(otherUserId)

	channel := new(model.Channel)

	channel.DisplayName = ""
	if otherUserId > c.Session.UserId {
		channel.Name = c.Session.UserId + "__" + otherUserId
	} else {
		channel.Name = otherUserId + "__" + c.Session.UserId
	}

	channel.TeamId = c.Session.TeamId
	channel.Description = ""
	channel.Type = model.CHANNEL_DIRECT

	if uresult := <-uc; uresult.Err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "Invalid other user id ", otherUserId)
	}

	if sc, err := CreateChannel(c, channel, true); err != nil {
		return nil, err
	} else {
		cm := &model.ChannelMember{ChannelId: sc.Id, UserId: otherUserId,
			Roles: "", NotifyLevel: model.CHANNEL_NOTIFY_ALL}

		if cmresult := <-Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
			return nil, cmresult.Err
		}

		return sc, nil
	}
}

func CreateDefaultChannels(c *Context, teamId string) ([]*model.Channel, *model.AppError) {
	townSquare := &model.Channel{DisplayName: "Town Square", Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := CreateChannel(c, townSquare, false); err != nil {
		return nil, err
	}

	offTopic := &model.Channel{DisplayName: "Off-Topic", Name: "off-topic", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := CreateChannel(c, offTopic, false); err != nil {
		return nil, err
	}

	channels := []*model.Channel{townSquare, offTopic}
	return channels, nil
}

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("updateChannel", "channel")
		return
	}

	sc := Srv.Store.Channel().Get(channel.Id)
	cmc := Srv.Store.Channel().GetMember(channel.Id, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		oldChannel := cresult.Data.(*model.Channel)
		if !c.HasPermissionsToTeam(oldChannel.TeamId, "updateChannel") {
			return
		}

		if oldChannel.DeleteAt > 0 {
			c.Err = model.NewAppError("updateChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oldChannel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewAppError("updateChannel", "Cannot update the default channel "+model.DEFAULT_CHANNEL, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		oldChannel.Description = channel.Description

		if len(channel.DisplayName) > 0 {
			oldChannel.DisplayName = channel.DisplayName
		}

		if len(channel.Name) > 0 {
			oldChannel.Name = channel.Name
		}

		if len(channel.Type) > 0 {
			oldChannel.Type = channel.Type
		}

		if ucresult := <-Srv.Store.Channel().Update(oldChannel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			c.LogAudit("name=" + channel.Name)
			w.Write([]byte(oldChannel.ToJson()))
		}
	}
}

func updateChannelDesc(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)
	channelId := props["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateChannelDesc", "channel_id")
		return
	}

	channelDesc := props["channel_description"]
	if len(channelDesc) > 1024 {
		c.SetInvalidParam("updateChannelDesc", "channel_description")
		return
	}

	sc := Srv.Store.Channel().Get(channelId)
	cmc := Srv.Store.Channel().GetMember(channelId, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		// Don't need to do anything channel member, just wanted to confirm it exists

		if !c.HasPermissionsToTeam(channel.TeamId, "updateChannelDesc") {
			return
		}

		channel.Description = channelDesc

		if ucresult := <-Srv.Store.Channel().Update(channel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			c.LogAudit("name=" + channel.Name)
			w.Write([]byte(channel.ToJson()))
		}
	}
}

func getChannels(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the newtork

	if result := <-Srv.Store.Channel().GetChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		if result.Err.Message == "No channels were found" {
			// lets make sure the user is valid
			if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
				c.Err = result.Err
				c.RemoveSessionCookie(w)
				l4g.Error("Error in getting users profile for id=%v forcing logout", c.Session.UserId)
				return
			}
		}
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.ChannelList).Etag(), w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func getMoreChannels(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the newtork

	if result := <-Srv.Store.Channel().GetMoreChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.ChannelList).Etag(), w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func joinChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	channelId := params["id"]

	JoinChannel(c, channelId, "")

	if c.Err != nil {
		return
	}

	result := make(map[string]string)
	result["id"] = channelId
	w.Write([]byte(model.MapToJson(result)))
}

func JoinChannel(c *Context, channelId string, role string) {

	sc := Srv.Store.Channel().Get(channelId)
	uc := Srv.Store.User().Get(c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = uresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)

		if !c.HasPermissionsToTeam(channel.TeamId, "joinChannel") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("joinChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Type == model.CHANNEL_OPEN {
			cm := &model.ChannelMember{ChannelId: channel.Id, UserId: c.Session.UserId, NotifyLevel: model.CHANNEL_NOTIFY_ALL, Roles: role}

			if cmresult := <-Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
				c.Err = cmresult.Err
				return
			}

			post := &model.Post{ChannelId: channel.Id, Message: fmt.Sprintf(
				`User %v has joined this channel.`,
				user.Username), Type: model.POST_JOIN_LEAVE}
			if _, err := CreatePost(c, post, false); err != nil {
				l4g.Error("Failed to post join message %v", err)
				c.Err = model.NewAppError("joinChannel", "Failed to send join request", "")
				return
			}
		} else {
			c.Err = model.NewAppError("joinChannel", "You do not have the appropriate permissions", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}
}

func JoinDefaultChannels(c *Context, user *model.User, channelRole string) *model.AppError {
	// We don't call JoinChannel here since c.Session is not populated on user creation

	var err *model.AppError = nil

	if result := <-Srv.Store.Channel().GetByName(user.TeamId, "town-square"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id, NotifyLevel: model.CHANNEL_NOTIFY_ALL, Roles: channelRole}
		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
	}

	if result := <-Srv.Store.Channel().GetByName(user.TeamId, "off-topic"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id, NotifyLevel: model.CHANNEL_NOTIFY_ALL, Roles: channelRole}
		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
	}

	return err
}

func leaveChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["id"]

	sc := Srv.Store.Channel().Get(id)
	uc := Srv.Store.User().Get(c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = cresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)

		if !c.HasPermissionsToTeam(channel.TeamId, "leaveChannel") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("leaveChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Type == model.CHANNEL_DIRECT {
			c.Err = model.NewAppError("leaveChannel", "Cannot leave a direct message channel", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewAppError("leaveChannel", "Cannot leave the default channel "+model.DEFAULT_CHANNEL, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if cmresult := <-Srv.Store.Channel().RemoveMember(channel.Id, c.Session.UserId); cmresult.Err != nil {
			c.Err = cmresult.Err
			return
		}

		post := &model.Post{ChannelId: channel.Id, Message: fmt.Sprintf(
			`%v has left the channel.`,
			user.Username), Type: model.POST_JOIN_LEAVE}
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error("Failed to post leave message %v", err)
			c.Err = model.NewAppError("leaveChannel", "Failed to send leave message", "")
			return
		}

		result := make(map[string]string)
		result["id"] = channel.Id
		w.Write([]byte(model.MapToJson(result)))
	}
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["id"]

	sc := Srv.Store.Channel().Get(id)
	scm := Srv.Store.Channel().GetMember(id, c.Session.UserId)
	uc := Srv.Store.User().Get(c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if scmresult := <-scm; scmresult.Err != nil {
		c.Err = scmresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)

		if !c.HasPermissionsToTeam(channel.TeamId, "deleteChannel") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("deleteChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewAppError("deleteChannel", "Cannot delete the default channel "+model.DEFAULT_CHANNEL, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if dresult := <-Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}

		c.LogAudit("name=" + channel.Name)

		post := &model.Post{ChannelId: channel.Id, Message: fmt.Sprintf(
			`%v has archived the channel.`,
			user.Username)}
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error("Failed to post archive message %v", err)
			c.Err = model.NewAppError("deleteChannel", "Failed to send archive message", "")
			return
		}

		result := make(map[string]string)
		result["id"] = channel.Id
		w.Write([]byte(model.MapToJson(result)))
	}
}

func updateLastViewedAt(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	Srv.Store.Channel().UpdateLastViewedAt(id, c.Session.UserId)

	message := model.NewMessage(c.Session.TeamId, id, c.Session.UserId, model.ACTION_VIEWED)
	message.Add("channel_id", id)

	PublishAndForget(message)

	result := make(map[string]string)
	result["id"] = id
	w.Write([]byte(model.MapToJson(result)))
}

func getChannelExtraInfo(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["id"]

	sc := Srv.Store.Channel().Get(id)
	scm := Srv.Store.Channel().GetMember(id, c.Session.UserId)
	ecm := Srv.Store.Channel().GetExtraMembers(id, 20)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmresult := <-scm; cmresult.Err != nil {
		c.Err = cmresult.Err
		return
	} else if ecmresult := <-ecm; ecmresult.Err != nil {
		c.Err = ecmresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		member := cmresult.Data.(model.ChannelMember)
		extraMembers := ecmresult.Data.([]model.ExtraMember)

		if !c.HasPermissionsToTeam(channel.TeamId, "getChannelExtraInfo") {
			return
		}

		if !c.HasPermissionsToUser(member.UserId, "getChannelExtraInfo") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("getChannelExtraInfo", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		data := model.ChannelExtra{Id: channel.Id, Members: extraMembers}
		w.Header().Set("Expires", "-1")
		w.Write([]byte(data.ToJson()))
	}
}

func addChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	data := model.MapFromJson(r.Body)
	userId := data["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addChannelMember", "user_id")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	sc := Srv.Store.Channel().Get(id)
	ouc := Srv.Store.User().Get(c.Session.UserId)
	nuc := Srv.Store.User().Get(userId)

	// Only need to be a member of the channel to add a new member
	if !c.HasPermissionsToChannel(cchan, "addChannelMember") {
		return
	}

	if nresult := <-nuc; nresult.Err != nil {
		c.Err = model.NewAppError("addChannelMember", "Failed to find user to be added", "")
		return
	} else if cresult := <-sc; cresult.Err != nil {
		c.Err = model.NewAppError("addChannelMember", "Failed to find channel", "")
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		nUser := nresult.Data.(*model.User)

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("updateChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oresult := <-ouc; oresult.Err != nil {
			c.Err = model.NewAppError("addChannelMember", "Failed to find user doing the adding", "")
			return
		} else {
			oUser := oresult.Data.(*model.User)

			cm := &model.ChannelMember{ChannelId: channel.Id, UserId: userId, NotifyLevel: model.CHANNEL_NOTIFY_ALL}

			if cmresult := <-Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
				l4g.Error("Failed to add member user_id=%v channel_id=%v err=%v", userId, id, cmresult.Err)
				c.Err = model.NewAppError("addChannelMember", "Failed to add user to channel", "")
				return
			}

			post := &model.Post{ChannelId: id, Message: fmt.Sprintf(
				`%v added to the channel by %v`,
				nUser.Username, oUser.Username), Type: model.POST_JOIN_LEAVE}
			if _, err := CreatePost(c, post, false); err != nil {
				l4g.Error("Failed to post add message %v", err)
				c.Err = model.NewAppError("addChannelMember", "Failed to add member to channel", "")
				return
			}

			c.LogAudit("name=" + channel.Name + " user_id=" + userId)

			message := model.NewMessage(c.Session.TeamId, "", userId, model.ACTION_USER_ADDED)

			PublishAndForget(message)

			<-Srv.Store.Channel().UpdateLastViewedAt(id, oUser.Id)
			w.Write([]byte(cm.ToJson()))
		}
	}
}

func removeChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	data := model.MapFromJson(r.Body)
	userId := data["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addChannelMember", "user_id")
		return
	}

	sc := Srv.Store.Channel().Get(id)
	cmc := Srv.Store.Channel().GetMember(id, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)

		if !c.HasPermissionsToTeam(channel.TeamId, "removeChannelMember") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewAppError("updateChannel", "The channel has been archived or deleted", "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if cmresult := <-Srv.Store.Channel().RemoveMember(id, userId); cmresult.Err != nil {
			c.Err = cmresult.Err
			return
		}

		c.LogAudit("name=" + channel.Name + " user_id=" + userId)

		result := make(map[string]string)
		result["channel_id"] = channel.Id
		result["removed_user_id"] = userId
		w.Write([]byte(model.MapToJson(result)))
	}

}

func updateNotifyLevel(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.MapFromJson(r.Body)
	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateNotifyLevel", "user_id")
		return
	}

	channelId := data["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateNotifyLevel", "channel_id")
		return
	}

	notifyLevel := data["notify_level"]
	if len(notifyLevel) == 0 || !model.IsChannelNotifyLevelValid(notifyLevel) {
		c.SetInvalidParam("updateNotifyLevel", "notify_level")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

	if !c.HasPermissionsToUser(userId, "updateNotifyLevel") {
		return
	}

	if !c.HasPermissionsToChannel(cchan, "updateNotifyLevel") {
		return
	}

	if result := <-Srv.Store.Channel().UpdateNotifyLevel(channelId, userId, notifyLevel); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte(model.MapToJson(data)))
}
