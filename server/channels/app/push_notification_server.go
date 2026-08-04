// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// syncPushNotificationServerWithLicense switches EmailSettings.PushNotificationServer to the
// hosted push notification service (MHPNS) endpoint when the license grants MHPNS access, and
// back to the test (TPNS) endpoint when it no longer does. It runs on license changes, on
// server start, and when this node becomes the cluster leader.
//
// The mapping is self-inverse — promote only from exact TPNS, revert only from exact
// MHPNSGlobal — so no persistent state is needed to know whether a value was auto-selected.
// Custom, regional, and legacy endpoints are never touched.
func (s *Server) syncPushNotificationServerWithLicense() {
	if !s.IsLeader() {
		return
	}

	license := s.License()
	// Cloud config is centrally managed; never rewrite it here.
	if license.IsCloud() {
		return
	}

	if s.platform.IsConfigReadOnly() {
		return
	}

	// Respect an environment-variable override on the setting. The config store re-applies env
	// overrides on save anyway, so without this guard a save would be futile and only produce
	// spurious audit records, logs, and cluster config traffic on every license event.
	if emailOverrides, ok := s.platform.GetEnvironmentOverrides()["EmailSettings"].(map[string]any); ok {
		if _, overridden := emailOverrides["PushNotificationServer"]; overridden {
			return
		}
	}

	entitled := license != nil && license.Features != nil && license.Features.MHPNS != nil && *license.Features.MHPNS
	current := *s.platform.Config().EmailSettings.PushNotificationServer

	var target string
	switch {
	case entitled && current == model.GenericNotificationServer:
		target = model.MHPNSGlobal
	case !entitled && current == model.MHPNSGlobal:
		target = model.GenericNotificationServer
	default:
		return
	}

	cfg := s.platform.Config().Clone()
	cfg.EmailSettings.PushNotificationServer = model.NewPointer(target)
	if _, _, appErr := s.platform.SaveConfig(cfg, true); appErr != nil {
		mlog.Warn("Failed to switch push notification server for license entitlement",
			mlog.String("old", current), mlog.String("new", target), mlog.Err(appErr))
		return
	}
	mlog.Info("Automatically switched push notification server based on license entitlement",
		mlog.String("old", current), mlog.String("new", target))

	rctx := request.EmptyContext(s.Log())
	appInstance := New(ServerConnector(s.Channels()))
	rec := appInstance.MakeAuditRecord(rctx, model.AuditEventAutoSelectPushNotificationServer, model.AuditStatusSuccess)
	model.AddEventParameterToAuditRec(rec, "old_push_notification_server", current)
	model.AddEventParameterToAuditRec(rec, "new_push_notification_server", target)
	appInstance.LogAuditRec(rctx, rec, nil)
}
