// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"strconv"
	"strings"
)

const (
	defaultExtraMemberLimit = 100
)

func InitChannel(r *mux.Router) {
	l4g.Debug(utils.T("api.channel.init.debug"))

	sr := r.PathPrefix("/channels").Subrouter()
	sr.Handle("/", ApiUserRequiredActivity(getChannels, false)).Methods("GET")
	sr.Handle("/more", ApiUserRequired(getMoreChannels)).Methods("GET")
	sr.Handle("/counts", ApiUserRequiredActivity(getChannelCounts, false)).Methods("GET")
	sr.Handle("/create", ApiUserRequired(createChannel)).Methods("POST")
	sr.Handle("/create_direct", ApiUserRequired(createDirectChannel)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateChannel)).Methods("POST")
	sr.Handle("/update_header", ApiUserRequired(updateChannelHeader)).Methods("POST")
	sr.Handle("/update_purpose", ApiUserRequired(updateChannelPurpose)).Methods("POST")
	sr.Handle("/update_notify_props", ApiUserRequired(updateNotifyProps)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/", ApiUserRequiredActivity(getChannel, false)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/extra_info", ApiUserRequired(getChannelExtraInfo)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/extra_info/{member_limit:-?[0-9]+}", ApiUserRequired(getChannelExtraInfo)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/join", ApiUserRequired(join)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/leave", ApiUserRequired(leave)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/delete", ApiUserRequired(deleteChannel)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/add", ApiUserRequired(addMember)).Methods("POST")
	sr.Handle("/{id:[A-Za-z0-9]+}/remove", ApiUserRequired(removeMember)).Methods("POST")
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
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.direct_channel.app_error", nil, "")
		return
	}

	if strings.Index(channel.Name, "__") > 0 {
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.invalid_character.app_error", nil, "")
		return
	}

	channel.CreatorId = c.Session.UserId

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
				Roles: model.CHANNEL_ROLE_ADMIN, NotifyProps: model.GetDefaultChannelNotifyProps()}

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
		return nil, model.NewLocAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId)
	}

	uc := Srv.Store.User().Get(otherUserId)

	channel := new(model.Channel)

	channel.DisplayName = ""
	channel.Name = model.GetDMNameFromIds(otherUserId, c.Session.UserId)

	channel.TeamId = c.Session.TeamId
	channel.Header = ""
	channel.Type = model.CHANNEL_DIRECT

	if uresult := <-uc; uresult.Err != nil {
		return nil, model.NewLocAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId)
	}

	cm1 := &model.ChannelMember{
		UserId:      c.Session.UserId,
		Roles:       model.CHANNEL_ROLE_ADMIN,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	cm2 := &model.ChannelMember{
		UserId:      otherUserId,
		Roles:       "",
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	if result := <-Srv.Store.Channel().SaveDirectChannel(channel, cm1, cm2); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func CreateDefaultChannels(c *Context, teamId string) ([]*model.Channel, *model.AppError) {
	townSquare := &model.Channel{DisplayName: c.T("api.channel.create_default_channels.town_square"), Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := CreateChannel(c, townSquare, false); err != nil {
		return nil, err
	}

	offTopic := &model.Channel{DisplayName: c.T("api.channel.create_default_channels.off_topic"), Name: "off-topic", Type: model.CHANNEL_OPEN, TeamId: teamId}

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
		channelMember := cmcresult.Data.(model.ChannelMember)
		if !c.HasPermissionsToTeam(oldChannel.TeamId, "updateChannel") {
			return
		}

		if !strings.Contains(channelMember.Roles, model.CHANNEL_ROLE_ADMIN) && !strings.Contains(c.Session.Roles, model.ROLE_TEAM_ADMIN) {
			c.Err = model.NewLocAppError("updateChannel", "api.channel.update_channel.permission.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldChannel.DeleteAt > 0 {
			c.Err = model.NewLocAppError("updateChannel", "api.channel.update_channel.deleted.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oldChannel.Name == model.DEFAULT_CHANNEL {
			if (len(channel.Name) > 0 && channel.Name != oldChannel.Name) || (len(channel.Type) > 0 && channel.Type != oldChannel.Type) {
				c.Err = model.NewLocAppError("updateChannel", "api.channel.update_channel.tried.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
				c.Err.StatusCode = http.StatusForbidden
				return
			}
		}

		oldChannel.Header = channel.Header
		oldChannel.Purpose = channel.Purpose

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

func updateChannelHeader(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)
	channelId := props["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateChannelHeader", "channel_id")
		return
	}

	channelHeader := props["channel_header"]
	if len(channelHeader) > 1024 {
		c.SetInvalidParam("updateChannelHeader", "channel_header")
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

		if !c.HasPermissionsToTeam(channel.TeamId, "updateChannelHeader") {
			return
		}
		oldChannelHeader := channel.Header
		channel.Header = channelHeader

		if ucresult := <-Srv.Store.Channel().Update(channel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			PostUpdateChannelHeaderMessageAndForget(c, channel.Id, oldChannelHeader, channelHeader)
			c.LogAudit("name=" + channel.Name)
			w.Write([]byte(channel.ToJson()))
		}
	}
}

func PostUpdateChannelHeaderMessageAndForget(c *Context, channelId string, oldChannelHeader, newChannelHeader string) {
	go func() {
		uc := Srv.Store.User().Get(c.Session.UserId)

		if uresult := <-uc; uresult.Err != nil {
			l4g.Error(utils.T("api.channel.post_update_channel_header_message_and_forget.retrieve_user.error"), uresult.Err)
			return
		} else {
			user := uresult.Data.(*model.User)

			var message string
			if oldChannelHeader == "" {
				message = fmt.Sprintf(c.T("api.channel.post_update_channel_header_message_and_forget.updated_to"), user.Username, newChannelHeader)
			} else if newChannelHeader == "" {
				message = fmt.Sprintf(c.T("api.channel.post_update_channel_header_message_and_forget.removed"), user.Username, oldChannelHeader)
			} else {
				message = fmt.Sprintf(c.T("api.channel.post_update_channel_header_message_and_forget.updated_from"), user.Username, oldChannelHeader, newChannelHeader)
			}

			post := &model.Post{
				ChannelId: channelId,
				Message:   message,
				Type:      model.POST_HEADER_CHANGE,
			}
			if _, err := CreatePost(c, post, false); err != nil {
				l4g.Error(utils.T("api.channel.post_update_channel_header_message_and_forget.join_leave.error"), err)
			}
		}
	}()
}

func updateChannelPurpose(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	channelId := props["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateChannelPurpose", "channel_id")
		return
	}

	channelPurpose := props["channel_purpose"]
	if len(channelPurpose) > 1024 {
		c.SetInvalidParam("updateChannelPurpose", "channel_purpose")
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

		if !c.HasPermissionsToTeam(channel.TeamId, "updateChannelPurpose") {
			return
		}

		channel.Purpose = channelPurpose

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

	// user is already in the team

	if result := <-Srv.Store.Channel().GetChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		if result.Err.Message == "No channels were found" { // store translation dependant
			// lets make sure the user is valid
			if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
				c.Err = result.Err
				c.RemoveSessionCookie(w, r)
				l4g.Error(utils.T("api.channel.get_channels.error"), c.Session.UserId)
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

	// user is already in the team

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

func getChannelCounts(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team

	if result := <-Srv.Store.Channel().GetChannelCounts(c.Session.TeamId, c.Session.UserId); result.Err != nil {
		c.Err = model.NewLocAppError("getChannelCounts", "api.channel.get_channel_counts.app_error", nil, result.Err.Message)
		return
	} else if HandleEtag(result.Data.(*model.ChannelCounts).Etag(), w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelCounts)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func join(c *Context, w http.ResponseWriter, r *http.Request) {

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

		if !c.HasPermissionsToTeam(channel.TeamId, "join") {
			return
		}

		if channel.Type == model.CHANNEL_OPEN {
			if _, err := AddUserToChannel(user, channel); err != nil {
				c.Err = err
				return
			}
			PostUserAddRemoveMessageAndForget(c, channel.Id, fmt.Sprintf(c.T("api.channel.join_channel.post_and_forget"), user.Username))
		} else {
			c.Err = model.NewLocAppError("join", "api.channel.join_channel.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}
}

func PostUserAddRemoveMessageAndForget(c *Context, channelId string, message string) {
	go func() {
		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_JOIN_LEAVE,
		}
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
		}
	}()
}

func AddUserToChannel(user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	if channel.DeleteAt > 0 {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.deleted.app_error", nil, "")
	}

	if channel.Type != model.CHANNEL_OPEN && channel.Type != model.CHANNEL_PRIVATE {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "")
	}

	newMember := &model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, NotifyProps: model.GetDefaultChannelNotifyProps()}
	if cmresult := <-Srv.Store.Channel().SaveMember(newMember); cmresult.Err != nil {
		l4g.Error("Failed to add member user_id=%v channel_id=%v err=%v", user.Id, channel.Id, cmresult.Err)
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.app_error", nil, "")
	}

	go func() {
		UpdateChannelAccessCache(channel.TeamId, user.Id, channel.Id)

		message := model.NewMessage(channel.TeamId, channel.Id, user.Id, model.ACTION_USER_ADDED)
		PublishAndForget(message)
	}()

	return newMember, nil
}

func JoinDefaultChannels(user *model.User, channelRole string) *model.AppError {
	// We don't call JoinChannel here since c.Session is not populated on user creation

	var err *model.AppError = nil

	if result := <-Srv.Store.Channel().GetByName(user.TeamId, "town-square"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
	}

	if result := <-Srv.Store.Channel().GetByName(user.TeamId, "off-topic"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
	}

	return err
}

func leave(c *Context, w http.ResponseWriter, r *http.Request) {

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

		if !c.HasPermissionsToTeam(channel.TeamId, "leave") {
			return
		}

		if channel.Type == model.CHANNEL_DIRECT {
			c.Err = model.NewLocAppError("leave", "api.channel.leave.direct.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewLocAppError("leave", "api.channel.leave.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if cmresult := <-Srv.Store.Channel().RemoveMember(channel.Id, c.Session.UserId); cmresult.Err != nil {
			c.Err = cmresult.Err
			return
		}

		RemoveUserFromChannel(c.Session.UserId, c.Session.UserId, channel)

		PostUserAddRemoveMessageAndForget(c, channel.Id, fmt.Sprintf(c.T("api.channel.leave.left"), user.Username))

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
	ihc := Srv.Store.Webhook().GetIncomingByChannel(id)
	ohc := Srv.Store.Webhook().GetOutgoingByChannel(id)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if scmresult := <-scm; scmresult.Err != nil {
		c.Err = scmresult.Err
		return
	} else if ihcresult := <-ihc; ihcresult.Err != nil {
		c.Err = ihcresult.Err
		return
	} else if ohcresult := <-ohc; ohcresult.Err != nil {
		c.Err = ohcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)
		channelMember := scmresult.Data.(model.ChannelMember)
		incomingHooks := ihcresult.Data.([]*model.IncomingWebhook)
		outgoingHooks := ohcresult.Data.([]*model.OutgoingWebhook)

		if !c.HasPermissionsToTeam(channel.TeamId, "deleteChannel") {
			return
		}

		if !strings.Contains(channelMember.Roles, model.CHANNEL_ROLE_ADMIN) && !strings.Contains(c.Session.Roles, model.ROLE_TEAM_ADMIN) {
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.deleted.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.cannot.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		now := model.GetMillis()
		for _, hook := range incomingHooks {
			go func() {
				if result := <-Srv.Store.Webhook().DeleteIncoming(hook.Id, now); result.Err != nil {
					l4g.Error(utils.T("api.channel.delete_channel.incoming_webhook.error"), hook.Id)
				}
			}()
		}

		for _, hook := range outgoingHooks {
			go func() {
				if result := <-Srv.Store.Webhook().DeleteOutgoing(hook.Id, now); result.Err != nil {
					l4g.Error(utils.T("api.channel.delete_channel.outgoing_webhook.error"), hook.Id)
				}
			}()
		}

		if dresult := <-Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}

		c.LogAudit("name=" + channel.Name)

		post := &model.Post{ChannelId: channel.Id, Message: fmt.Sprintf(
			c.T("api.channel.delete_channel.archived"),
			user.Username)}
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error(utils.T("api.channel.delete_channel.failed_post.error"), err)
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.failed_send.app_error", nil, "")
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

	preference := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_LAST,
		Name:     model.PREFERENCE_NAME_LAST_CHANNEL,
		Value:    id,
	}

	Srv.Store.Preference().Save(&model.Preferences{preference})

	message := model.NewMessage(c.Session.TeamId, id, c.Session.UserId, model.ACTION_CHANNEL_VIEWED)
	message.Add("channel_id", id)

	PublishAndForget(message)

	result := make(map[string]string)
	result["id"] = id
	w.Write([]byte(model.MapToJson(result)))
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	//pchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	cchan := Srv.Store.Channel().Get(id)
	cmchan := Srv.Store.Channel().GetMember(id, c.Session.UserId)

	if cresult := <-cchan; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmresult := <-cmchan; cmresult.Err != nil {
		c.Err = cmresult.Err
		return
	} else {
		data := &model.ChannelData{}
		data.Channel = cresult.Data.(*model.Channel)
		member := cmresult.Data.(model.ChannelMember)
		data.Member = &member

		if HandleEtag(data.Etag(), w, r) {
			return
		} else {
			w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
			w.Header().Set("Expires", "-1")
			w.Write([]byte(data.ToJson()))
		}
	}

}

func getChannelExtraInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var memberLimit int
	if memberLimitString, ok := params["member_limit"]; !ok {
		memberLimit = defaultExtraMemberLimit
	} else if memberLimitInt64, err := strconv.ParseInt(memberLimitString, 10, 0); err != nil {
		c.Err = model.NewLocAppError("getChannelExtraInfo", "api.channel.get_channel_extra_info.member_limit.app_error", nil, err.Error())
		return
	} else {
		memberLimit = int(memberLimitInt64)
	}

	sc := Srv.Store.Channel().Get(id)
	var channel *model.Channel
	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else {
		channel = cresult.Data.(*model.Channel)
	}

	extraEtag := channel.ExtraEtag(memberLimit)
	if HandleEtag(extraEtag, w, r) {
		return
	}

	scm := Srv.Store.Channel().GetMember(id, c.Session.UserId)
	ecm := Srv.Store.Channel().GetExtraMembers(id, memberLimit)
	ccm := Srv.Store.Channel().GetMemberCount(id)

	if cmresult := <-scm; cmresult.Err != nil {
		c.Err = cmresult.Err
		return
	} else if ecmresult := <-ecm; ecmresult.Err != nil {
		c.Err = ecmresult.Err
		return
	} else if ccmresult := <-ccm; ccmresult.Err != nil {
		c.Err = ccmresult.Err
		return
	} else {
		member := cmresult.Data.(model.ChannelMember)
		extraMembers := ecmresult.Data.([]model.ExtraMember)
		memberCount := ccmresult.Data.(int64)

		if !c.HasPermissionsToTeam(channel.TeamId, "getChannelExtraInfo") {
			return
		}

		if !c.HasPermissionsToUser(member.UserId, "getChannelExtraInfo") {
			return
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewLocAppError("getChannelExtraInfo", "api.channel.get_channel_extra_info.deleted.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		data := model.ChannelExtra{Id: channel.Id, Members: extraMembers, MemberCount: memberCount}
		w.Header().Set(model.HEADER_ETAG_SERVER, extraEtag)
		w.Header().Set("Expires", "-1")
		w.Write([]byte(data.ToJson()))
	}
}

func addMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	data := model.MapFromJson(r.Body)
	userId := data["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addMember", "user_id")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	sc := Srv.Store.Channel().Get(id)
	ouc := Srv.Store.User().Get(c.Session.UserId)
	nuc := Srv.Store.User().Get(userId)

	// Only need to be a member of the channel to add a new member
	if !c.HasPermissionsToChannel(cchan, "addMember") {
		return
	}

	if nresult := <-nuc; nresult.Err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.find_user.app_error", nil, "")
		return
	} else if cresult := <-sc; cresult.Err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.find_channel.app_error", nil, "")
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		nUser := nresult.Data.(*model.User)

		if oresult := <-ouc; oresult.Err != nil {
			c.Err = model.NewLocAppError("addMember", "api.channel.add_member.user_adding.app_error", nil, "")
			return
		} else {
			oUser := oresult.Data.(*model.User)

			cm, err := AddUserToChannel(nUser, channel)
			if err != nil {
				c.Err = err
				return
			}

			c.LogAudit("name=" + channel.Name + " user_id=" + userId)

			PostUserAddRemoveMessageAndForget(c, channel.Id, fmt.Sprintf(c.T("api.channel.add_member.added"), nUser.Username, oUser.Username))

			<-Srv.Store.Channel().UpdateLastViewedAt(id, oUser.Id)
			w.Write([]byte(cm.ToJson()))
		}
	}
}

func removeMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["id"]

	data := model.MapFromJson(r.Body)
	userIdToRemove := data["user_id"]

	if len(userIdToRemove) != 26 {
		c.SetInvalidParam("removeMember", "user_id")
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
		removerChannelMember := cmcresult.Data.(model.ChannelMember)

		if !c.HasPermissionsToTeam(channel.TeamId, "removeMember") {
			return
		}

		if !strings.Contains(removerChannelMember.Roles, model.CHANNEL_ROLE_ADMIN) && !c.IsTeamAdmin() {
			c.Err = model.NewLocAppError("updateChannel", "api.channel.remove_member.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if err := RemoveUserFromChannel(userIdToRemove, c.Session.UserId, channel); err != nil {
			c.Err = model.NewLocAppError("updateChannel", "api.channel.remove_member.unable.app_error", nil, err.Message)
			return
		}

		c.LogAudit("name=" + channel.Name + " user_id=" + userIdToRemove)

		result := make(map[string]string)
		result["channel_id"] = channel.Id
		result["removed_user_id"] = userIdToRemove
		w.Write([]byte(model.MapToJson(result)))
	}

}

func RemoveUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	if channel.DeleteAt > 0 {
		return model.NewLocAppError("updateChannel", "api.channel.remove_user_from_channel.deleted.app_error", nil, "")
	}

	if cmresult := <-Srv.Store.Channel().RemoveMember(channel.Id, userIdToRemove); cmresult.Err != nil {
		return cmresult.Err
	}

	UpdateChannelAccessCacheAndForget(channel.TeamId, userIdToRemove, channel.Id)

	message := model.NewMessage(channel.TeamId, channel.Id, userIdToRemove, model.ACTION_USER_REMOVED)
	message.Add("remover_id", removerUserId)
	PublishAndForget(message)

	return nil
}

func updateNotifyProps(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateMarkUnreadLevel", "user_id")
		return
	}

	channelId := data["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateMarkUnreadLevel", "channel_id")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

	if !c.HasPermissionsToUser(userId, "updateNotifyLevel") {
		return
	}

	if !c.HasPermissionsToChannel(cchan, "updateNotifyLevel") {
		return
	}

	result := <-Srv.Store.Channel().GetMember(channelId, userId)
	if result.Err != nil {
		c.Err = result.Err
		return
	}

	member := result.Data.(model.ChannelMember)

	// update whichever notify properties have been provided, but don't change the others
	if markUnread, exists := data["mark_unread"]; exists {
		member.NotifyProps["mark_unread"] = markUnread
	}

	if desktop, exists := data["desktop"]; exists {
		member.NotifyProps["desktop"] = desktop
	}

	if result := <-Srv.Store.Channel().UpdateMember(&member); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		// return the updated notify properties including any unchanged ones
		w.Write([]byte(model.MapToJson(member.NotifyProps)))
	}

}
