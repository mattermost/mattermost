// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestPolicyRuleActions(t *testing.T) {
	previous := &model.AccessControlPolicy{Rules: []model.AccessControlPolicyRule{
		{Actions: []string{model.AccessControlPolicyActionChannelReadAccess}, Expression: "true"},
	}}
	updated := &model.AccessControlPolicy{Rules: []model.AccessControlPolicyRule{
		{Actions: []string{model.AccessControlPolicyActionUploadFileAttachment}, Expression: "true"},
		{Actions: []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment}, Expression: "true"},
	}}

	t.Run("a save reports the actions it removed as well as those it kept", func(t *testing.T) {
		require.ElementsMatch(t, []string{
			model.AccessControlPolicyActionChannelReadAccess,
			model.AccessControlPolicyActionUploadFileAttachment,
			model.AccessControlPolicyActionDownloadFileAttachment,
		}, policyRuleActions(previous, updated))
	})

	t.Run("a new policy has no previous version", func(t *testing.T) {
		require.ElementsMatch(t, []string{
			model.AccessControlPolicyActionUploadFileAttachment,
			model.AccessControlPolicyActionDownloadFileAttachment,
		}, policyRuleActions(nil, updated))
	})

	t.Run("is an empty list, not nil, when nothing is declared", func(t *testing.T) {
		actions := policyRuleActions(nil)
		require.NotNil(t, actions)
		require.Empty(t, actions)
	})
}

func TestPublishPermissionPolicyUpdateCarriesActions(t *testing.T) {
	th := Setup(t)

	publish := func(t *testing.T, actions []string) *model.WebSocketEvent {
		t.Helper()

		cluster := &testlib.FakeClusterInterface{}
		th.Server.Platform().SetCluster(cluster)
		th.App.publishPermissionPolicyUpdate(th.Context, actions)

		// The server publishes other events of its own, so pick this one out.
		var published []*model.WebSocketEvent
		for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventPublish
		}) {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			require.NoError(t, err)
			if event.EventType() == model.WebsocketEventPermissionPolicyUpdated {
				published = append(published, event)
			}
		}
		require.Len(t, published, 1)
		return published[0]
	}

	t.Run("lists the actions the change touched", func(t *testing.T) {
		event := publish(t, []string{model.AccessControlPolicyActionChannelReadAccess})
		require.Equal(t, []any{model.AccessControlPolicyActionChannelReadAccess}, event.GetData()["actions"])
	})

	// Clients read a missing list as "anything may have changed" and refetch every channel.
	t.Run("sends an empty list rather than none", func(t *testing.T) {
		event := publish(t, nil)
		require.Equal(t, []any{}, event.GetData()["actions"])
	})
}
