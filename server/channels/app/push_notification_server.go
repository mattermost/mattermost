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
// The contract: promote only from exact TPNS to the Global endpoint; on entitlement loss,
// revert any Mattermost-hosted production endpoint (global, regional, or legacy) to TPNS, so
// a lapsed license never leaves push pointing at an endpoint that refuses to send. Custom
// endpoints and env-managed values are never touched. The sync stays stateless because both
// directions derive entirely from the current config value and the license.
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

	entitled := license.HasMHPNS()

	// Decide and mutate on the same snapshot so a concurrent config write between the
	// decision and the save can't be stomped with a stale value. The residual race between
	// Clone and Set is inherent to every SaveConfig caller.
	cfg := s.platform.Config().Clone()
	current := *cfg.EmailSettings.PushNotificationServer

	var target string
	switch {
	case entitled && current == model.GenericNotificationServer:
		target = model.MHPNSGlobal
	case !entitled && model.IsMHPNSEndpoint(current):
		target = model.GenericNotificationServer
	default:
		return
	}

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
