// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/model"
)

func handleNotifyAdmin(c *Context, w http.ResponseWriter, r *http.Request) {
	mlog.Info("enter handleNotifyAdmin")
	var notifyAdminRequest *model.NotifyAdminToUpgradeRequest
	err := json.NewDecoder(r.Body).Decode(&notifyAdminRequest)
	if err != nil {
		c.SetInvalidParamWithErr("notifyAdminRequest", err)
		return
	}

	userId := c.AppContext.Session().UserId
	appErr := c.App.SaveAdminNotification(userId, notifyAdminRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}
	mlog.Info("exit handleNotifyAdmin")

	ReturnStatusOK(w)
}

func handleTriggerNotifyAdminPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	mlog.Info("enter handleTriggerNotifyAdminPosts")

	if !*c.App.Config().ServiceSettings.EnableAPITriggerAdminNotifications {
		c.Err = model.NewAppError("Api4.handleTriggerNotifyAdminPosts", "api.cloud.app_error", nil, "Manual triggering of notifications not allowed", http.StatusForbidden)
		return
	}

	var notifyAdminRequest *model.NotifyAdminToUpgradeRequest
	err := json.NewDecoder(r.Body).Decode(&notifyAdminRequest)
	if err != nil {
		c.SetInvalidParamWithErr("notifyAdminRequest", err)
		return
	}

	// only system admins can manually trigger these notifications
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	appErr := c.App.SendNotifyAdminPosts(c.AppContext, "", "", notifyAdminRequest.TrialNotification)
	if appErr != nil {
		c.Err = appErr
		return
	}

	mlog.Info("exit handleTriggerNotifyAdminPosts")

	ReturnStatusOK(w)
}
