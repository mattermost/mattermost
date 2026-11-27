// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

// The redact hook's counterpart of channel_read_access_hook_governance_test.go: the publisher
// of channel_access_control_updated passes governed and by_channel_policy, so the hook skips
// the channel load and governance check, and an ungoverned channel needs no lookups at all.

// redact runs the redact hook for each connection in order and returns the channel each one
// is sent.
func redact(t *testing.T, event *model.WebSocketEvent, args map[string]any, conns ...*platform.WebConn) []any {
	t.Helper()
	channels := make([]any, len(conns))
	for i, wc := range conns {
		hooked := platform.MakeHookedWebSocketEvent(event)
		require.NoError(t, (&channelReadAccessRedactBroadcastHook{}).Process(hooked, wc, args))
		require.False(t, hooked.Event().IsRejected(), "the redact hook never drops the event")
		channels[i] = hooked.Get("channel")
	}
	return channels
}

func redactEvent(channelID string) *model.WebSocketEvent {
	event := model.NewWebSocketEvent(model.WebsocketEventChannelAccessControlUpdated, "", channelID, "", nil, "")
	event.Add("channel", "secret")
	return event
}

// redactHookArgs returns the args a publisher attaches to the redact hook for channelID.
func redactHookArgs(channelID string, governance *channelGovernance) map[string]any {
	event := redactEvent(channelID)
	useChannelReadAccessRedactHook(event, channelID, governance)
	return event.GetBroadcast().BroadcastHookArgs[0]
}

func TestChannelReadAccessRedactHookGovernanceArgs(t *testing.T) {
	t.Run("an ungoverned channel stays in for everyone, with no lookups", func(t *testing.T) {
		h := setupHookGovernanceTest(t)
		h.allow = func(model.Subject) bool { return false }
		conns := []*platform.WebConn{
			h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id)),
			h.conn(h.th.BasicUser2.Id, nil),
		}
		h.resetCounts()

		args := redactHookArgs(h.th.BasicChannel.Id, &channelGovernance{governed: false})
		require.Equal(t, []any{"secret", "secret"}, redact(t, redactEvent(h.th.BasicChannel.Id), args, conns...))
		require.Zero(t, h.evaluations.Load())
		require.Zero(t, h.governanceChecks.Load())
		require.Zero(t, h.store.channels.gets.Load())
	})

	t.Run("a governed channel is stripped for denied recipients and kept for allowed ones", func(t *testing.T) {
		h := setupHookGovernanceTest(t)
		h.allow = subjectIs(h.th.BasicUser.Id)
		allowed := h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id))
		denied := h.conn(h.th.BasicUser2.Id, h.session(t, h.th.BasicUser2.Id))

		for _, byChannelPolicy := range []bool{false, true} {
			clearAccessDecisionCache(h.th)
			args := redactHookArgs(h.th.BasicChannel.Id, &channelGovernance{governed: true, byChannelPolicy: byChannelPolicy})
			event := redactEvent(h.th.BasicChannel.Id)
			require.Equal(t, []any{"secret", ""}, redact(t, event, args, allowed, denied), "by_channel_policy=%v", byChannelPolicy)
			require.Equal(t, []any{"", "secret"}, redact(t, event, args, denied, allowed), "by_channel_policy=%v", byChannelPolicy)
		}
	})

	t.Run("a governed channel is stripped for a connection without a session", func(t *testing.T) {
		h := setupHookGovernanceTest(t)
		h.resetCounts()
		args := redactHookArgs(h.th.BasicChannel.Id, &channelGovernance{governed: true})
		require.Equal(t, []any{""}, redact(t, redactEvent(h.th.BasicChannel.Id), args, h.conn(h.th.BasicUser.Id, nil)))
		require.Zero(t, h.evaluations.Load())
	})
}

func TestChannelReadAccessRedactHookLoadsNoChannelWithGovernanceArgs(t *testing.T) {
	setup := setupHookStoreCountingTest

	t.Run("with the args", func(t *testing.T) {
		h, channel, conns := setup(t)
		args := redactHookArgs(channel.Id, &channelGovernance{governed: true})
		require.Equal(t, []any{"secret", ""}, redact(t, redactEvent(channel.Id), args, conns...))
		require.Zero(t, h.store.channels.gets.Load(), "no channel load")
		require.Zero(t, h.store.policies.actionLookups.Load(), "no policy action lookup")
		require.Zero(t, h.governanceChecks.Load(), "no governance check")
	})

	t.Run("without the args it falls back to loading the channel", func(t *testing.T) {
		h, channel, conns := setup(t)
		require.Equal(t, []any{"secret", ""}, redact(t, redactEvent(channel.Id), redactHookArgs(channel.Id, nil), conns...))
		require.Positive(t, h.store.channels.gets.Load(), "the fallback loads the channel")
		require.Positive(t, h.governanceChecks.Load(), "the fallback decides governance")
		require.Zero(t, h.store.policies.actionLookups.Load())
	})
}

func TestChannelReadAccessRedactHookArgsSurviveTheCluster(t *testing.T) {
	h := setupHookGovernanceTest(t)

	// A peer node receives the event as JSON, so the args arrive decoded with no type
	// information.
	event := redactEvent(h.th.BasicChannel.Id)
	useChannelReadAccessRedactHook(event, h.th.BasicChannel.Id, &channelGovernance{governed: true})
	data, err := event.ToJSON()
	require.NoError(t, err)
	received, err := model.WebSocketEventFromJSON(bytes.NewReader(data))
	require.NoError(t, err)
	args := received.GetBroadcast().BroadcastHookArgs[0]
	require.Contains(t, args, channelReadAccessArgGoverned)
	require.Contains(t, args, channelReadAccessArgByChannelPolicy)

	conn := h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id))
	h.resetCounts()
	require.Equal(t, []any{"secret"}, redact(t, received, args, conn))
	require.Zero(t, h.store.channels.gets.Load(), "the governed path, not the fallback")
	require.Zero(t, h.governanceChecks.Load())
	require.Equal(t, int64(1), h.evaluations.Load())
}
