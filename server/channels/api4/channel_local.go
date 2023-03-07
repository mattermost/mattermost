// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/audit"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func (api *API) InitChannelLocal() {
	api.BaseRoutes.Channels.Handle("", api.APILocal(getAllChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("", api.APILocal(localCreateChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("", api.APILocal(getChannel)).Methods("GET")
	api.BaseRoutes.ChannelByName.Handle("", api.APILocal(getChannelByName)).Methods("GET")
	api.BaseRoutes.Channel.Handle("", api.APILocal(localDeleteChannel)).Methods("DELETE")
	api.BaseRoutes.Channel.Handle("/patch", api.APILocal(localPatchChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/move", api.APILocal(localMoveChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("/privacy", api.APILocal(localUpdateChannelPrivacy)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/restore", api.APILocal(localRestoreChannel)).Methods("POST")

	api.BaseRoutes.ChannelMember.Handle("", api.APILocal(localRemoveChannelMember)).Methods("DELETE")
	api.BaseRoutes.ChannelMember.Handle("", api.APILocal(getChannelMember)).Methods("GET")
	api.BaseRoutes.ChannelMembers.Handle("", api.APILocal(localAddChannelMember)).Methods("POST")
	api.BaseRoutes.ChannelMembers.Handle("", api.APILocal(getChannelMembers)).Methods("GET")

	api.BaseRoutes.ChannelsForTeam.Handle("", api.APILocal(getPublicChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/deleted", api.APILocal(getDeletedChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/private", api.APILocal(getPrivateChannelsForTeam)).Methods("GET")

	api.BaseRoutes.ChannelByName.Handle("", api.APILocal(getChannelByName)).Methods("GET")
	api.BaseRoutes.ChannelByNameForTeamName.Handle("", api.APILocal(getChannelByNameForTeamName)).Methods("GET")
}

func localCreateChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	var channel *model.Channel
	err := json.NewDecoder(r.Body).Decode(&channel)
	if err != nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	auditRec := c.MakeAuditRecord("localCreateChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel", channel)

	sc, appErr := c.App.CreateChannel(c.AppContext, channel, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(sc)
	auditRec.AddEventObjectType("channel")
	c.LogAudit("name=" + channel.Name)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localUpdateChannelPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok || (model.ChannelType(privacy) != model.ChannelTypeOpen && model.ChannelType(privacy) != model.ChannelTypePrivate) {
		c.SetInvalidParam("privacy")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localUpdateChannelPrivacy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)

	if channel.Name == model.DefaultChannelName && model.ChannelType(privacy) == model.ChannelTypePrivate {
		c.Err = model.NewAppError("updateChannelPrivacy", "api.channel.update_channel_privacy.default_channel_error", nil, "", http.StatusBadRequest)
		return
	}
	channel.Type = model.ChannelType(privacy)

	updatedChannel, err := c.App.UpdateChannelPrivacy(c.AppContext, channel, nil)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + updatedChannel.Name)

	if err := json.NewEncoder(w).Encode(updatedChannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localRestoreChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localRestoreChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)

	channel, err = c.App.RestoreChannel(c.AppContext, channel, "")
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + channel.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localAddChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	userId, ok := props["user_id"].(string)
	if !ok || !model.IsValidId(userId) {
		c.SetInvalidParam("user_id")
		return
	}

	member := &model.ChannelMember{
		ChannelId: c.Params.ChannelId,
		UserId:    userId,
	}

	postRootId, ok := props["post_root_id"].(string)
	if ok && postRootId != "" && !model.IsValidId(postRootId) {
		c.SetInvalidParam("post_root_id")
		return
	}

	if ok && len(postRootId) == 26 {
		rootPost, err := c.App.GetSinglePost(postRootId, false)
		if err != nil {
			c.Err = err
			return
		}
		if rootPost.ChannelId != member.ChannelId {
			c.SetInvalidParam("post_root_id")
			return
		}
	}

	channel, err := c.App.GetChannel(c.AppContext, member.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localAddChannelMember", audit.Fail)
	auditRec.AddEventParameter("props", props)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channel", channel)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupChannelMembers([]string{member.UserId}, channel)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_members.error", nil, err.Error(), http.StatusBadRequest)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	cm, err := c.App.AddChannelMember(c.AppContext, member.UserId, channel, app.ChannelMemberOpts{
		PostRootID: postRootId,
	})
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("add_user_id", cm.UserId)
	auditRec.AddEventResultState(cm)
	auditRec.AddEventObjectType("channel_member")
	c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(cm); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localRemoveChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !(channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate) {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_channel_member.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() && !user.IsBot {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("localRemoveChannelMember", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)
	auditRec.AddEventParameter("remove_user_id", c.Params.UserId)

	if err = c.App.RemoveUserFromChannel(c.AppContext, c.Params.UserId, "", channel); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("name=" + channel.Name + " user_id=" + c.Params.UserId)

	ReturnStatusOK(w)
}

func localPatchChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var patch *model.ChannelPatch
	err := json.NewDecoder(r.Body).Decode(&patch)
	if err != nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	originalOldChannel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	channel := originalOldChannel.DeepCopy()

	auditRec := c.MakeAuditRecord("localPatchChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_patch", patch)

	channel.Patch(patch)
	rchannel, appErr := c.App.UpdateChannel(c.AppContext, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = c.App.FillInChannelProps(c.AppContext, rchannel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("")
	auditRec.AddEventResultState(rchannel)
	auditRec.AddEventObjectType("channel")

	if err := json.NewEncoder(w).Encode(rchannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localMoveChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	teamId, ok := props["team_id"].(string)
	if !ok {
		c.SetInvalidParam("team_id")
		return
	}

	force, ok := props["force"].(bool)
	if !ok {
		c.SetInvalidParam("force")
		return
	}

	team, err := c.App.GetTeam(teamId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localMoveChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)

	// TODO do we need these?
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)
	auditRec.AddMeta("team_id", team.Id)
	auditRec.AddMeta("team_name", team.Name)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("moveChannel", "api.channel.move_channel.type.invalid", nil, "", http.StatusForbidden)
		return
	}

	err = c.App.RemoveAllDeactivatedMembersFromChannel(c.AppContext, channel)
	if err != nil {
		c.Err = err
		return
	}

	if force {
		err = c.App.RemoveUsersFromChannelNotMemberOfTeam(c.AppContext, nil, channel, team)
		if err != nil {
			c.Err = err
			return
		}
	}

	err = c.App.MoveChannel(c.AppContext, team, channel, nil)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("channel=" + channel.Name)
	c.LogAudit("team=" + team.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localDeleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localDeleteChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channeld", channel)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("localDeleteChannel", "api.channel.delete_channel.type.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if c.Params.Permanent {
		err = c.App.PermanentDeleteChannel(c.AppContext, channel)
	} else {
		err = c.App.DeleteChannel(c.AppContext, channel, "")
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	c.LogAudit("name=" + channel.Name)

	ReturnStatusOK(w)
}
