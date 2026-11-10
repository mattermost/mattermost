// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// withDiscoverableChannelsFlag toggles the FeatureFlag for the duration of a
// test and restores it on cleanup. Feature flags are read-only by default in
// the test config store; flipping SetReadOnlyFF lets the UpdateConfig call
// land. We deliberately do NOT restore SetReadOnlyFF(true) afterward — the
// underlying store is per-test and disposed on cleanup.
func withDiscoverableChannelsFlag(t *testing.T, th *TestHelper, on bool) {
	t.Helper()
	th.ConfigStore.SetReadOnlyFF(false)
	previous := th.App.Config().FeatureFlags.DiscoverableChannels
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.DiscoverableChannels = on })
	t.Cleanup(func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.DiscoverableChannels = previous })
	})
}

// markDiscoverable flips the channel's discoverable flag in the store via
// PatchChannel so the model invariants run alongside the test scenario.
func markDiscoverable(t *testing.T, th *TestHelper, channel *model.Channel) *model.Channel {
	t.Helper()
	on := true
	patched, err := th.App.PatchChannel(th.Context, channel, &model.ChannelPatch{Discoverable: &on}, th.BasicUser.Id)
	require.Nil(t, err)
	require.True(t, patched.Discoverable)
	return patched
}

func TestRequestJoinChannel_RejectsNonDiscoverable(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)

	joined, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "please")
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	assert.Equal(t, "api.channel.discoverable_join_request.not_discoverable.app_error", appErr.Id)
	assert.False(t, joined)
	assert.Nil(t, req)
}

func TestRequestJoinChannel_RejectsExistingMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)
	channel = markDiscoverable(t, th, channel)

	// BasicUser is the channel creator → already a member.
	_, _, appErr := th.App.RequestJoinChannel(th.Context, th.BasicUser.Id, channel.Id, "")
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.Equal(t, "api.channel.discoverable_join_request.already_member.app_error", appErr.Id)
}

func TestRequestJoinChannel_PendingHappyPath(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)
	channel = markDiscoverable(t, th, channel)

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)

	joined, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "let me in")
	require.Nil(t, appErr)
	assert.False(t, joined, "should not auto-join when no policy is enforced")
	require.NotNil(t, req)
	assert.Equal(t, model.ChannelJoinRequestStatusPending, req.Status)
	assert.Equal(t, channel.Id, req.ChannelId)
	assert.Equal(t, other.Id, req.UserId)
	assert.Equal(t, "let me in", req.Message)

	// Submitting again returns the existing pending row (idempotent on
	// partial-unique conflict).
	joined, req2, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "again")
	require.Nil(t, appErr)
	assert.False(t, joined)
	require.NotNil(t, req2)
	assert.Equal(t, req.Id, req2.Id)
}

func TestRequestJoinChannel_RejectsGuest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)
	channel = markDiscoverable(t, th, channel)

	guest := th.CreateGuest(t)
	th.LinkUserToTeam(t, guest, th.BasicTeam)

	_, _, appErr := th.App.RequestJoinChannel(th.Context, guest.Id, channel.Id, "")
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	assert.Equal(t, "api.channel.discoverable_join_request.guest.app_error", appErr.Id)
}

func TestUpdateChannelJoinRequest_ApproveAddsMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)
	channel = markDiscoverable(t, th, channel)

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)

	_, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "")
	require.Nil(t, appErr)
	require.NotNil(t, req)

	patch := &model.ChannelJoinRequestPatch{Status: model.ChannelJoinRequestStatusApproved}
	updated, appErr := th.App.UpdateChannelJoinRequest(th.Context, req.Id, channel.Id, patch, th.BasicUser.Id)
	require.Nil(t, appErr)
	assert.Equal(t, model.ChannelJoinRequestStatusApproved, updated.Status)
	assert.Equal(t, th.BasicUser.Id, updated.ReviewedBy)
	assert.NotZero(t, updated.ReviewedAt)
	assert.Empty(t, updated.Message, "message should be redacted from the response after review")

	member, mErr := th.App.GetChannelMember(th.Context, channel.Id, other.Id)
	require.Nil(t, mErr)
	require.NotNil(t, member)
	assert.Equal(t, other.Id, member.UserId)
}

func TestUpdateChannelJoinRequest_DenyKeepsReason(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := th.CreatePrivateChannel(t, th.BasicTeam)
	channel = markDiscoverable(t, th, channel)

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "please")
	require.Nil(t, appErr)
	require.NotNil(t, req)

	reason := "team-internal channel"
	patch := &model.ChannelJoinRequestPatch{
		Status:       model.ChannelJoinRequestStatusDenied,
		DenialReason: &reason,
	}
	updated, appErr := th.App.UpdateChannelJoinRequest(th.Context, req.Id, channel.Id, patch, th.BasicUser.Id)
	require.Nil(t, appErr)
	assert.Equal(t, model.ChannelJoinRequestStatusDenied, updated.Status)
	assert.Equal(t, reason, updated.DenialReason)

	// Member must NOT have been added.
	_, mErr := th.App.GetChannelMember(th.Context, channel.Id, other.Id)
	require.NotNil(t, mErr)
	assert.Equal(t, MissingChannelMemberError, mErr.Id)
}

func TestUpdateChannelJoinRequest_RejectsCrossChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channelA := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))
	channelB := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channelA.Id, "")
	require.Nil(t, appErr)
	require.NotNil(t, req)

	patch := &model.ChannelJoinRequestPatch{Status: model.ChannelJoinRequestStatusApproved}
	_, appErr = th.App.UpdateChannelJoinRequest(th.Context, req.Id, channelB.Id, patch, th.BasicUser.Id)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
}

func TestWithdrawChannelJoinRequest_OwnerOnly(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "")
	require.Nil(t, appErr)
	require.NotNil(t, req)

	stranger := th.CreateUser(t)
	_, appErr = th.App.WithdrawChannelJoinRequest(th.Context, req.Id, stranger.Id)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

	updated, appErr := th.App.WithdrawChannelJoinRequest(th.Context, req.Id, other.Id)
	require.Nil(t, appErr)
	assert.Equal(t, model.ChannelJoinRequestStatusWithdrawn, updated.Status)

	// A second withdrawal is rejected with 409.
	_, appErr = th.App.WithdrawChannelJoinRequest(th.Context, req.Id, other.Id)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusConflict, appErr.StatusCode)
}

func TestGetMyChannelJoinRequests(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channelA := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))
	channelB := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, _, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channelA.Id, "")
	require.Nil(t, appErr)
	_, _, appErr = th.App.RequestJoinChannel(th.Context, other.Id, channelB.Id, "")
	require.Nil(t, appErr)

	list, appErr := th.App.GetMyChannelJoinRequests(th.Context, other.Id, model.GetChannelJoinRequestsOpts{})
	require.Nil(t, appErr)
	require.NotNil(t, list)
	assert.EqualValues(t, 2, list.TotalCount)
	assert.Len(t, list.Requests, 2)
}

func TestCountPendingChannelJoinRequests(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, _, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "")
	require.Nil(t, appErr)

	count, appErr := th.App.CountPendingChannelJoinRequests(th.Context, channel.Id)
	require.Nil(t, appErr)
	assert.EqualValues(t, 1, count)
}

func TestUpdateChannelPrivacy_CancelsPendingRequestsOnConvertToPublic(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, req, appErr := th.App.RequestJoinChannel(th.Context, other.Id, channel.Id, "")
	require.Nil(t, appErr)
	require.NotNil(t, req)

	channel.Type = model.ChannelTypeOpen
	converted, appErr := th.App.UpdateChannelPrivacy(th.Context, channel, th.BasicUser)
	require.Nil(t, appErr)

	// Discoverable must be reset on convert-to-public — the model invariant
	// (Channel.IsValid) rejects (type=O, discoverable=true), so leaving it
	// true would also break the next channel save.
	assert.False(t, converted.Discoverable, "Discoverable must be reset to false after convert-to-public")
	persisted, getErr := th.App.GetChannel(th.Context, channel.Id)
	require.Nil(t, getErr)
	assert.False(t, persisted.Discoverable, "Discoverable must be persisted as false after convert-to-public")

	// The cancellation side-effect is dispatched on a goroutine; poll for
	// the withdrawn state instead of sleeping.
	require.Eventually(t, func() bool {
		row, err := th.App.Srv().Store().ChannelJoinRequest().Get(req.Id)
		if err != nil {
			return false
		}
		return row.Status == model.ChannelJoinRequestStatusWithdrawn
	}, 2*time.Second, 50*time.Millisecond)
}

func TestIsDiscoverableSelfAddBlocked(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	other := th.CreateUser(t)
	assert.True(t, th.App.IsDiscoverableSelfAddBlocked(th.Context, channel, other.Id, other.Id), "self-add to discoverable + no-policy private must be blocked")
	assert.False(t, th.App.IsDiscoverableSelfAddBlocked(th.Context, channel, th.BasicUser.Id, other.Id), "admin invite must not be blocked")

	// Toggle off the flag → guard is inert.
	withDiscoverableChannelsFlag(t, th, false)
	assert.False(t, th.App.IsDiscoverableSelfAddBlocked(th.Context, channel, other.Id, other.Id))
}

func TestFilterDiscoverableChannelsByPolicy_FlagOff(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	// Flag off → filter is a no-op even when channels look discoverable.

	channel := markDiscoverableInMemory(t, th.CreatePrivateChannel(t, th.BasicTeam))
	channel.PolicyEnforced = true
	out, appErr := th.App.FilterDiscoverableChannelsByPolicy(th.Context, []*model.Channel{channel}, th.BasicUser2.Id)
	require.Nil(t, appErr)
	require.Len(t, out, 1)
}

func TestFilterDiscoverableChannelsByPolicy_NoPolicyPasses(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverableInMemory(t, th.CreatePrivateChannel(t, th.BasicTeam))
	out, appErr := th.App.FilterDiscoverableChannelsByPolicy(th.Context, []*model.Channel{channel}, th.BasicUser2.Id)
	require.Nil(t, appErr)
	require.Len(t, out, 1, "no-policy discoverable channels are visible without ABAC evaluation")
}

func TestFilterDiscoverableChannelsByPolicy_PolicyEnforcedFailSecure(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	// PolicyEnforced + Discoverable + no AccessControl service wired ⇒ hidden.
	channel := markDiscoverableInMemory(t, th.CreatePrivateChannel(t, th.BasicTeam))
	channel.PolicyEnforced = true

	require.Nil(t, th.App.Srv().Channels().AccessControl, "test fixture must not have ABAC wired")

	out, appErr := th.App.FilterDiscoverableChannelsByPolicy(th.Context, []*model.Channel{channel}, th.BasicUser2.Id)
	require.Nil(t, appErr)
	assert.Len(t, out, 0, "fail-secure must hide policy-enforced channels when ABAC is unavailable")
}

func TestFilterDiscoverableChannelsByPolicy_GuestHidden(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverableInMemory(t, th.CreatePrivateChannel(t, th.BasicTeam))
	channel.PolicyEnforced = true

	guest := th.CreateGuest(t)
	out, appErr := th.App.FilterDiscoverableChannelsByPolicy(th.Context, []*model.Channel{channel}, guest.Id)
	require.Nil(t, appErr)
	assert.Empty(t, out, "guests must never see discoverable + policy-enforced channels")
}

// markDiscoverableInMemory is a no-DB helper for visibility filter tests that
// don't care about persistence — they only exercise the in-memory list filter.
func markDiscoverableInMemory(t *testing.T, channel *model.Channel) *model.Channel {
	t.Helper()
	channel.Discoverable = true
	return channel
}
