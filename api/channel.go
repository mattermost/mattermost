// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func InitChannel() {
	l4g.Debug(utils.T("api.channel.init.debug"))

	BaseRoutes.Channels.Handle("/", ApiUserRequired(getChannels)).Methods("GET")
	BaseRoutes.Channels.Handle("/more/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getMoreChannelsPage)).Methods("GET")
	BaseRoutes.Channels.Handle("/more/search", ApiUserRequired(searchMoreChannels)).Methods("POST")
	BaseRoutes.Channels.Handle("/counts", ApiUserRequired(getChannelCounts)).Methods("GET")
	BaseRoutes.Channels.Handle("/members", ApiUserRequired(getMyChannelMembers)).Methods("GET")
	BaseRoutes.Channels.Handle("/create", ApiUserRequired(createChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/view", ApiUserRequired(viewChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/create_direct", ApiUserRequired(createDirectChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/update", ApiUserRequired(updateChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_header", ApiUserRequired(updateChannelHeader)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_purpose", ApiUserRequired(updateChannelPurpose)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_notify_props", ApiUserRequired(updateNotifyProps)).Methods("POST")
	BaseRoutes.Channels.Handle("/autocomplete", ApiUserRequired(autocompleteChannels)).Methods("GET")
	BaseRoutes.Channels.Handle("/name/{channel_name:[A-Za-z0-9_-]+}", ApiUserRequired(getChannelByName)).Methods("GET")

	BaseRoutes.NeedChannelName.Handle("/join", ApiUserRequired(join)).Methods("POST")

	BaseRoutes.NeedChannel.Handle("/", ApiUserRequired(getChannel)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/stats", ApiUserRequired(getChannelStats)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/members/{user_id:[A-Za-z0-9]+}", ApiUserRequired(getChannelMember)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/members/ids", ApiUserRequired(getChannelMembersByIds)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/join", ApiUserRequired(join)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/leave", ApiUserRequired(leave)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/delete", ApiUserRequired(deleteChannel)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/add", ApiUserRequired(addMember)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/remove", ApiUserRequired(removeMember)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/update_member_roles", ApiUserRequired(updateChannelMemberRoles)).Methods("POST")
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("createChannel", "channel")
		return
	}

	if len(channel.TeamId) == 0 {
		channel.TeamId = c.TeamId
	}

	if channel.Type == model.CHANNEL_DIRECT {
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.direct_channel.app_error", nil, "")
		return
	}

	if strings.Index(channel.Name, "__") > 0 {
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.invalid_character.app_error", nil, "")
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !HasPermissionToTeamContext(c, channel.TeamId, model.PERMISSION_CREATE_PUBLIC_CHANNEL) {
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !HasPermissionToTeamContext(c, channel.TeamId, model.PERMISSION_CREATE_PRIVATE_CHANNEL) {
		return
	}

	if channel.TeamId == c.TeamId {

		// Get total number of channels on current team
		if result := <-app.Srv.Store.Channel().GetTeamChannels(channel.TeamId); result.Err != nil {
			c.Err = model.NewLocAppError("createChannel", "api.channel.get_channels.error", nil, result.Err.Message)
			return
		} else {
			data := result.Data.(*model.ChannelList)
			if int64(len(*data)+1) > *utils.Cfg.TeamSettings.MaxChannelsPerTeam {
				c.Err = model.NewLocAppError("createChannel", "api.channel.create_channel.max_channel_limit.app_error", map[string]interface{}{"MaxChannelsPerTeam": *utils.Cfg.TeamSettings.MaxChannelsPerTeam}, "")
				return
			}
		}
	}

	channel.CreatorId = c.Session.UserId

	if sc, err := app.CreateChannel(channel, true); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(sc.ToJson()))
	}
}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if !HasPermissionToContext(c, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		return
	}

	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("createDirectChannel", "user_id")
		return
	}

	if sc, err := CreateDirectChannel(c.Session.UserId, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
}

func CreateDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	uc := app.Srv.Store.User().Get(otherUserId)

	if uresult := <-uc; uresult.Err != nil {
		return nil, model.NewLocAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId)
	}

	if result := <-app.Srv.Store.Channel().CreateDirectChannel(userId, otherUserId); result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), nil
		} else {
			return nil, result.Err
		}
	} else {
		channel := result.Data.(*model.Channel)

		app.InvalidateCacheForUser(userId)
		app.InvalidateCacheForUser(otherUserId)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_DIRECT_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_id", otherUserId)
		go app.Publish(message)

		return channel, nil
	}
}

func CanManageChannel(c *Context, channel *model.Channel) bool {
	if channel.Type == model.CHANNEL_OPEN && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		return false
	}

	if channel.Type == model.CHANNEL_PRIVATE && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		return false
	}

	return true
}

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("updateChannel", "channel")
		return
	}

	sc := app.Srv.Store.Channel().Get(channel.Id, true)
	cmc := app.Srv.Store.Channel().GetMember(channel.Id, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		oldChannel := cresult.Data.(*model.Channel)
		// Don't need to do anything with channel member, just wanted to confirm it exists

		if !CanManageChannel(c, channel) {
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
				c.Err.StatusCode = http.StatusBadRequest
				return
			}
		}

		oldChannel.Header = channel.Header
		oldChannel.Purpose = channel.Purpose

		oldChannelDisplayName := oldChannel.DisplayName

		if len(channel.DisplayName) > 0 {
			oldChannel.DisplayName = channel.DisplayName
		}

		if len(channel.Name) > 0 {
			oldChannel.Name = channel.Name
		}

		if len(channel.Type) > 0 {
			oldChannel.Type = channel.Type
		}

		app.InvalidateCacheForChannel(oldChannel.Id)
		if ucresult := <-app.Srv.Store.Channel().Update(oldChannel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			if oldChannelDisplayName != channel.DisplayName {
				go PostUpdateChannelDisplayNameMessage(c, channel.Id, oldChannelDisplayName, channel.DisplayName)
			}
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

	sc := app.Srv.Store.Channel().Get(channelId, true)
	cmc := app.Srv.Store.Channel().GetMember(channelId, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		// Don't need to do anything with channel member, just wanted to confirm it exists

		if !CanManageChannel(c, channel) {
			return
		}

		oldChannelHeader := channel.Header
		channel.Header = channelHeader

		app.InvalidateCacheForChannel(channel.Id)
		if ucresult := <-app.Srv.Store.Channel().Update(channel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			go PostUpdateChannelHeaderMessage(c, channel.Id, oldChannelHeader, channelHeader)
			c.LogAudit("name=" + channel.Name)
			w.Write([]byte(channel.ToJson()))
		}
	}
}

func PostUpdateChannelHeaderMessage(c *Context, channelId string, oldChannelHeader, newChannelHeader string) {
	uc := app.Srv.Store.User().Get(c.Session.UserId)

	if uresult := <-uc; uresult.Err != nil {
		l4g.Error(utils.T("api.channel.post_update_channel_header_message_and_forget.retrieve_user.error"), uresult.Err)
		return
	} else {
		user := uresult.Data.(*model.User)

		var message string
		if oldChannelHeader == "" {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.updated_to"), user.Username, newChannelHeader)
		} else if newChannelHeader == "" {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.removed"), user.Username, oldChannelHeader)
		} else {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.updated_from"), user.Username, oldChannelHeader, newChannelHeader)
		}

		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_HEADER_CHANGE,
			UserId:    c.Session.UserId,
			Props: model.StringInterface{
				"old_header": oldChannelHeader,
				"new_header": newChannelHeader,
			},
		}

		if _, err := app.CreatePost(post, c.TeamId, false); err != nil {
			l4g.Error(utils.T("api.channel.post_update_channel_header_message_and_forget.join_leave.error"), err)
		}
	}
}

func PostUpdateChannelDisplayNameMessage(c *Context, channelId string, oldChannelDisplayName, newChannelDisplayName string) {
	uc := app.Srv.Store.User().Get(c.Session.UserId)

	if uresult := <-uc; uresult.Err != nil {
		l4g.Error(utils.T("api.channel.post_update_channel_displayname_message_and_forget.retrieve_user.error"), uresult.Err)
		return
	} else {
		user := uresult.Data.(*model.User)

		message := fmt.Sprintf(utils.T("api.channel.post_update_channel_displayname_message_and_forget.updated_from"), user.Username, oldChannelDisplayName, newChannelDisplayName)

		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_DISPLAYNAME_CHANGE,
			UserId:    c.Session.UserId,
			Props: model.StringInterface{
				"old_displayname": oldChannelDisplayName,
				"new_displayname": newChannelDisplayName,
			},
		}

		if _, err := app.CreatePost(post, c.TeamId, false); err != nil {
			l4g.Error(utils.T("api.channel.post_update_channel_displayname_message_and_forget.create_post.error"), err)
		}
	}
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

	sc := app.Srv.Store.Channel().Get(channelId, true)
	cmc := app.Srv.Store.Channel().GetMember(channelId, c.Session.UserId)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		// Don't need to do anything with channel member, just wanted to confirm it exists

		if !CanManageChannel(c, channel) {
			return
		}

		channel.Purpose = channelPurpose

		app.InvalidateCacheForChannel(channel.Id)
		if ucresult := <-app.Srv.Store.Channel().Update(channel); ucresult.Err != nil {
			c.Err = ucresult.Err
			return
		} else {
			c.LogAudit("name=" + channel.Name)
			w.Write([]byte(channel.ToJson()))
		}
	}
}

func getChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.TeamId == "" {
		c.Err = model.NewLocAppError("", "api.context.missing_teamid.app_error", nil, "TeamIdRequired")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}
	// user is already in the team
	// Get's all channels the user is a member of

	if result := <-app.Srv.Store.Channel().GetChannels(c.TeamId, c.Session.UserId); result.Err != nil {
		if result.Err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			// lets make sure the user is valid
			if result := <-app.Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
				c.Err = result.Err
				c.RemoveSessionCookie(w, r)
				l4g.Error(utils.T("api.channel.get_channels.error"), c.Session.UserId)
				return
			}
		}
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.ChannelList).Etag(), "Get Channels", w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func getMoreChannelsPage(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getProfiles", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getProfiles", "limit")
		return
	}

	// user is already in the team
	if !HasPermissionToTeamContext(c, c.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return
	}

	if result := <-app.Srv.Store.Channel().GetMoreChannels(c.TeamId, c.Session.UserId, offset, limit); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func getChannelCounts(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team

	if result := <-app.Srv.Store.Channel().GetChannelCounts(c.TeamId, c.Session.UserId); result.Err != nil {
		c.Err = model.NewLocAppError("getChannelCounts", "api.channel.get_channel_counts.app_error", nil, result.Err.Message)
		return
	} else if HandleEtag(result.Data.(*model.ChannelCounts).Etag(), "Get Channel Counts", w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelCounts)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func join(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	channelId := params["channel_id"]
	channelName := params["channel_name"]

	var outChannel *model.Channel = nil
	if channelId != "" {
		if err, channel := JoinChannelById(c, c.Session.UserId, channelId); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusForbidden
			return
		} else {
			outChannel = channel
		}
	} else if channelName != "" {
		if err, channel := JoinChannelByName(c, c.Session.UserId, c.TeamId, channelName); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusForbidden
			return
		} else {
			outChannel = channel
		}
	} else {
		c.SetInvalidParam("join", "channel_id, channel_name")
		return
	}
	w.Write([]byte(outChannel.ToJson()))
}

func JoinChannelByName(c *Context, userId string, teamId string, channelName string) (*model.AppError, *model.Channel) {
	channelChannel := app.Srv.Store.Channel().GetByName(teamId, channelName)
	userChannel := app.Srv.Store.User().Get(userId)

	return joinChannel(c, channelChannel, userChannel)
}

func JoinChannelById(c *Context, userId string, channelId string) (*model.AppError, *model.Channel) {
	channelChannel := app.Srv.Store.Channel().Get(channelId, true)
	userChannel := app.Srv.Store.User().Get(userId)

	return joinChannel(c, channelChannel, userChannel)
}

func joinChannel(c *Context, channelChannel store.StoreChannel, userChannel store.StoreChannel) (*model.AppError, *model.Channel) {
	if cresult := <-channelChannel; cresult.Err != nil {
		return cresult.Err, nil
	} else if uresult := <-userChannel; uresult.Err != nil {
		return uresult.Err, nil
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)

		if mresult := <-app.Srv.Store.Channel().GetMember(channel.Id, user.Id); mresult.Err == nil && mresult.Data != nil {
			// the user is already in the channel so just return successful
			return nil, channel
		}

		if !HasPermissionToTeamContext(c, channel.TeamId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			return c.Err, nil
		}

		if channel.Type == model.CHANNEL_OPEN {
			if _, err := app.AddUserToChannel(user, channel); err != nil {
				return err, nil
			}
			go PostUserAddRemoveMessage(c, channel.Id, fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username), model.POST_JOIN_LEAVE)
		} else {
			return model.NewLocAppError("join", "api.channel.join_channel.permissions.app_error", nil, ""), nil
		}
		return nil, channel
	}
}

func PostUserAddRemoveMessage(c *Context, channelId string, message, postType string) {
	post := &model.Post{
		ChannelId: channelId,
		Message:   message,
		Type:      postType,
		UserId:    c.Session.UserId,
	}
	if _, err := app.CreatePost(post, c.TeamId, false); err != nil {
		l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
	}
}

func leave(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["channel_id"]

	sc := app.Srv.Store.Channel().Get(id, true)
	uc := app.Srv.Store.User().Get(c.Session.UserId)
	ccm := app.Srv.Store.Channel().GetMemberCount(id, false)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if ccmresult := <-ccm; ccmresult.Err != nil {
		c.Err = ccmresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)
		membersCount := ccmresult.Data.(int64)

		if channel.Type == model.CHANNEL_DIRECT {
			c.Err = model.NewLocAppError("leave", "api.channel.leave.direct.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && membersCount == 1 {
			c.Err = model.NewLocAppError("leave", "api.channel.leave.last_member.app_error", nil, "userId="+user.Id)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewLocAppError("leave", "api.channel.leave.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if cmresult := <-app.Srv.Store.Channel().RemoveMember(channel.Id, c.Session.UserId); cmresult.Err != nil {
			c.Err = cmresult.Err
			return
		}

		RemoveUserFromChannel(c.Session.UserId, c.Session.UserId, channel)

		go PostUserAddRemoveMessage(c, channel.Id, fmt.Sprintf(utils.T("api.channel.leave.left"), user.Username), model.POST_JOIN_LEAVE)

		result := make(map[string]string)
		result["id"] = channel.Id
		w.Write([]byte(model.MapToJson(result)))
	}
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["channel_id"]

	sc := app.Srv.Store.Channel().Get(id, true)
	scm := app.Srv.Store.Channel().GetMember(id, c.Session.UserId)
	cmc := app.Srv.Store.Channel().GetMemberCount(id, false)
	uc := app.Srv.Store.User().Get(c.Session.UserId)
	ihc := app.Srv.Store.Webhook().GetIncomingByChannel(id)
	ohc := app.Srv.Store.Webhook().GetOutgoingByChannel(id)

	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if uresult := <-uc; uresult.Err != nil {
		c.Err = cresult.Err
		return
	} else if scmresult := <-scm; scmresult.Err != nil {
		c.Err = scmresult.Err
		return
	} else if cmcresult := <-cmc; cmcresult.Err != nil {
		c.Err = cmcresult.Err
		return
	} else if ihcresult := <-ihc; ihcresult.Err != nil {
		c.Err = ihcresult.Err
		return
	} else if ohcresult := <-ohc; ohcresult.Err != nil {
		c.Err = ohcresult.Err
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		memberCount := cmcresult.Data.(int64)
		user := uresult.Data.(*model.User)
		incomingHooks := ihcresult.Data.([]*model.IncomingWebhook)
		outgoingHooks := ohcresult.Data.([]*model.OutgoingWebhook)
		// Don't need to do anything with channel member, just wanted to confirm it exists

		// Allow delete if user is the only member left in channel
		if memberCount > 1 {
			if channel.Type == model.CHANNEL_OPEN && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_DELETE_PUBLIC_CHANNEL) {
				return
			}

			if channel.Type == model.CHANNEL_PRIVATE && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_DELETE_PRIVATE_CHANNEL) {
				return
			}
		}

		if channel.DeleteAt > 0 {
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.deleted.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			c.Err = model.NewLocAppError("deleteChannel", "api.channel.delete_channel.cannot.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   fmt.Sprintf(c.T("api.channel.delete_channel.archived"), user.Username),
			Type:      model.POST_CHANNEL_DELETED,
			UserId:    c.Session.UserId,
		}

		if _, err := app.CreatePost(post, c.TeamId, false); err != nil {
			l4g.Error(utils.T("api.channel.delete_channel.failed_post.error"), err)
		}

		now := model.GetMillis()
		for _, hook := range incomingHooks {
			if result := <-app.Srv.Store.Webhook().DeleteIncoming(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.incoming_webhook.error"), hook.Id)
			}
		}

		for _, hook := range outgoingHooks {
			if result := <-app.Srv.Store.Webhook().DeleteOutgoing(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.outgoing_webhook.error"), hook.Id)
			}
		}

		if dresult := <-app.Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}
		app.InvalidateCacheForChannel(channel.Id)

		c.LogAudit("name=" + channel.Name)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_DELETED, c.TeamId, "", "", nil)
		message.Add("channel_id", channel.Id)

		app.Publish(message)

		result := make(map[string]string)
		result["id"] = channel.Id
		w.Write([]byte(model.MapToJson(result)))
	}
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	cchan := app.Srv.Store.Channel().Get(id, true)
	cmchan := app.Srv.Store.Channel().GetMember(id, c.Session.UserId)

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

		if data.Channel.TeamId != c.TeamId && data.Channel.Type != model.CHANNEL_DIRECT {
			c.Err = model.NewLocAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelId": id, "TeamId": c.TeamId}, "")
			return
		}

		if HandleEtag(data.Etag(), "Get Channel", w, r) {
			return
		} else {
			w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
			w.Write([]byte(data.ToJson()))
		}
	}
}

func SetActiveChannel(userId string, channelId string) *model.AppError {
	status, err := app.GetStatus(userId)
	if err != nil {
		status = &model.Status{userId, model.STATUS_ONLINE, false, model.GetMillis(), channelId}
	} else {
		status.ActiveChannel = channelId
		if !status.Manual {
			status.Status = model.STATUS_ONLINE
		}
		status.LastActivityAt = model.GetMillis()
	}

	app.AddStatusCache(status)

	return nil
}

func getChannelByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelName := params["channel_name"]

	cchan := app.Srv.Store.Channel().GetByName(c.TeamId, channelName)

	if cresult := <-cchan; cresult.Err != nil {
		c.Err = cresult.Err
		return
	} else {
		data := cresult.Data.(*model.Channel)

		if !HasPermissionToChannelContext(c, data.Id, model.PERMISSION_READ_CHANNEL) {
			return
		}

		if data.TeamId != c.TeamId && data.Type != model.CHANNEL_DIRECT {
			c.Err = model.NewLocAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelName": channelName, "TeamId": c.TeamId}, "")
			return
		}

		if HandleEtag(data.Etag(), "Get Channel By Name", w, r) {
			return
		} else {
			w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
			w.Write([]byte(data.ToJson()))
		}
	}
}

func getChannelStats(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	sc := app.Srv.Store.Channel().Get(id, true)
	var channel *model.Channel
	if result := <-sc; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	if result := <-app.Srv.Store.Channel().GetMemberCount(id, true); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		memberCount := result.Data.(int64)

		if channel.DeleteAt > 0 {
			c.Err = model.NewLocAppError("getChannelStats", "api.channel.get_channel_extra_info.deleted.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_READ_CHANNEL) {
			return
		}

		data := model.ChannelStats{ChannelId: channel.Id, MemberCount: memberCount}
		w.Write([]byte(data.ToJson()))
	}
}

func getChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]
	userId := params["user_id"]

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_READ_CHANNEL) {
		return
	}

	if result := <-app.Srv.Store.Channel().GetMember(channelId, userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		member := result.Data.(model.ChannelMember)
		w.Write([]byte(member.ToJson()))
	}
}

func getMyChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	if result := <-app.Srv.Store.Channel().GetMembersForUser(c.TeamId, c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		data := result.Data.(*model.ChannelMembers)
		w.Write([]byte(data.ToJson()))
	}
}

func addMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	data := model.MapFromJson(r.Body)
	userId := data["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addMember", "user_id")
		return
	}

	sc := app.Srv.Store.Channel().Get(id, true)
	ouc := app.Srv.Store.User().Get(c.Session.UserId)
	nuc := app.Srv.Store.User().Get(userId)
	if nresult := <-nuc; nresult.Err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.find_user.app_error", nil, "")
		return
	} else if cresult := <-sc; cresult.Err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.find_channel.app_error", nil, "")
		return
	} else {
		channel := cresult.Data.(*model.Channel)
		nUser := nresult.Data.(*model.User)

		if channel.Type == model.CHANNEL_OPEN && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			return
		}

		if oresult := <-ouc; oresult.Err != nil {
			c.Err = model.NewLocAppError("addMember", "api.channel.add_member.user_adding.app_error", nil, "")
			return
		} else {
			oUser := oresult.Data.(*model.User)

			cm, err := app.AddUserToChannel(nUser, channel)
			if err != nil {
				c.Err = err
				return
			}

			c.LogAudit("name=" + channel.Name + " user_id=" + userId)

			go PostUserAddRemoveMessage(c, channel.Id, fmt.Sprintf(utils.T("api.channel.add_member.added"), nUser.Username, oUser.Username), model.POST_ADD_REMOVE)

			<-app.Srv.Store.Channel().UpdateLastViewedAt([]string{id}, oUser.Id)
			w.Write([]byte(cm.ToJson()))
		}
	}
}

func removeMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	data := model.MapFromJson(r.Body)
	userIdToRemove := data["user_id"]

	if len(userIdToRemove) != 26 {
		c.SetInvalidParam("removeMember", "user_id")
		return
	}

	sc := app.Srv.Store.Channel().Get(channelId, true)
	cmc := app.Srv.Store.Channel().GetMember(channelId, c.Session.UserId)
	ouc := app.Srv.Store.User().Get(userIdToRemove)

	if oresult := <-ouc; oresult.Err != nil {
		c.Err = model.NewLocAppError("removeMember", "api.channel.remove_member.user.app_error", nil, "")
		return
	} else {
		oUser := oresult.Data.(*model.User)

		if cresult := <-sc; cresult.Err != nil {
			c.Err = cresult.Err
			return
		} else if cmcresult := <-cmc; cmcresult.Err != nil {
			c.Err = cmcresult.Err
			return
		} else {
			channel := cresult.Data.(*model.Channel)

			if channel.Type == model.CHANNEL_OPEN && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
				return
			}

			if channel.Type == model.CHANNEL_PRIVATE && !HasPermissionToChannelContext(c, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
				return
			}

			if err := RemoveUserFromChannel(userIdToRemove, c.Session.UserId, channel); err != nil {
				c.Err = model.NewLocAppError("updateChannel", "api.channel.remove_member.unable.app_error", nil, err.Message)
				return
			}

			c.LogAudit("name=" + channel.Name + " user_id=" + userIdToRemove)

			go PostUserAddRemoveMessage(c, channel.Id, fmt.Sprintf(utils.T("api.channel.remove_member.removed"), oUser.Username), model.POST_ADD_REMOVE)

			result := make(map[string]string)
			result["channel_id"] = channel.Id
			result["removed_user_id"] = userIdToRemove
			w.Write([]byte(model.MapToJson(result)))
		}
	}
}

func RemoveUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	if channel.DeleteAt > 0 {
		return model.NewLocAppError("RemoveUserFromChannel", "api.channel.remove_user_from_channel.deleted.app_error", nil, "")
	}

	if channel.Name == model.DEFAULT_CHANNEL {
		return model.NewLocAppError("RemoveUserFromChannel", "api.channel.remove.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
	}

	if cmresult := <-app.Srv.Store.Channel().RemoveMember(channel.Id, userIdToRemove); cmresult.Err != nil {
		return cmresult.Err
	}

	app.InvalidateCacheForUser(userIdToRemove)
	app.InvalidateCacheForChannel(channel.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", channel.Id, "", nil)
	message.Add("user_id", userIdToRemove)
	message.Add("remover_id", removerUserId)
	go app.Publish(message)

	// because the removed user no longer belongs to the channel we need to send a separate websocket event
	userMsg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", "", userIdToRemove, nil)
	userMsg.Add("channel_id", channel.Id)
	userMsg.Add("remover_id", removerUserId)
	go app.Publish(userMsg)

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

	if !HasPermissionToUser(c, userId) {
		return
	}

	result := <-app.Srv.Store.Channel().GetMember(channelId, userId)
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

	if result := <-app.Srv.Store.Channel().UpdateMember(&member); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app.InvalidateCacheForUser(userId)

		// return the updated notify properties including any unchanged ones
		w.Write([]byte(model.MapToJson(member.NotifyProps)))
	}

}

func searchMoreChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("searchMoreChannels", "")
		return
	}

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("searchMoreChannels", "term")
		return
	}

	if result := <-app.Srv.Store.Channel().SearchMore(c.Session.UserId, c.TeamId, props.Term); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channels := result.Data.(*model.ChannelList)
		w.Write([]byte(channels.ToJson()))
	}
}

func autocompleteChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	var channels *model.ChannelList

	if result := <-app.Srv.Store.Channel().SearchInTeam(c.TeamId, term); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channels = result.Data.(*model.ChannelList)
	}

	w.Write([]byte(channels.ToJson()))
}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	view := model.ChannelViewFromJson(r.Body)

	if err := SetActiveChannel(c.Session.UserId, view.ChannelId); err != nil {
		c.Err = err
		return
	}

	if len(view.ChannelId) == 0 {
		ReturnStatusOK(w)
		return
	}

	channelIds := []string{view.ChannelId}

	var pchan store.StoreChannel
	if len(view.PrevChannelId) > 0 {
		channelIds = append(channelIds, view.PrevChannelId)

		if *utils.Cfg.EmailSettings.SendPushNotifications && !c.Session.IsMobileApp() {
			pchan = app.Srv.Store.User().GetUnreadCountForChannel(c.Session.UserId, view.ChannelId)
		}
	}

	uchan := app.Srv.Store.Channel().UpdateLastViewedAt(channelIds, c.Session.UserId)

	if pchan != nil {
		if result := <-pchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			if result.Data.(int64) > 0 {
				app.ClearPushNotification(c.Session.UserId, view.ChannelId)
			}
		}
	}

	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, c.TeamId, "", c.Session.UserId, nil)
	message.Add("channel_id", view.ChannelId)
	go app.Publish(message)

	ReturnStatusOK(w)
}

func getChannelMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("getChannelMembersByIds", "user_ids")
		return
	}

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_READ_CHANNEL) {
		return
	}

	if result := <-app.Srv.Store.Channel().GetMembersByIds(channelId, userIds); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		members := result.Data.(model.ChannelMembers)
		w.Write([]byte(members.ToJson()))
		return
	}
}

func updateChannelMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateChannelMemberRoles", "user_id")
		return
	}

	mchan := app.Srv.Store.Channel().GetMember(channelId, userId)

	newRoles := props["new_roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("updateChannelMemberRoles", "new_roles")
		return
	}

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		return
	}

	var member model.ChannelMember
	if result := <-mchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		member = result.Data.(model.ChannelMember)
	}

	member.Roles = newRoles

	if result := <-app.Srv.Store.Channel().UpdateMember(&member); result.Err != nil {
		c.Err = result.Err
		return
	}

	app.InvalidateCacheForUser(userId)

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
