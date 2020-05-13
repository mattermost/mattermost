// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitChannelLocal() {
	api.BaseRoutes.Channels.Handle("", api.ApiLocal(getAllChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("", api.ApiLocal(localCreateChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("", api.ApiLocal(deleteChannel)).Methods("DELETE")
}

func localCreateChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channel := model.ChannelFromJson(r.Body)
	if channel == nil {
		c.SetInvalidParam("channel")
		return
	}

	auditRec := c.MakeAuditRecord("localCreateChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channel", channel)

	sc, err := c.App.CreateChannel(channel, false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("channel", sc) // overwrite meta
	c.LogAudit("name=" + channel.Name)

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(sc.ToJson()))
}
