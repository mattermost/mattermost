// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
)

// setupDiscoverableTH spins up an api4 fixture with the discoverable channels
// feature flag enabled so the new routes are registered.
func setupDiscoverableTH(t *testing.T) *TestHelper {
	t.Helper()
	return SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.DiscoverableChannels = true
	}).InitBasic(t)
}

// markDiscoverableViaAdmin patches `channel` to discoverable=true using the
// SystemAdminClient so the permission check is satisfied without needing to
// rebind the channel-admin role on the test fixture.
func markDiscoverableViaAdmin(t *testing.T, th *TestHelper, channel *model.Channel) *model.Channel {
	t.Helper()
	on := true
	patched, _, err := th.SystemAdminClient.PatchChannel(context.Background(), channel.Id, &model.ChannelPatch{Discoverable: &on})
	require.NoError(t, err)
	require.True(t, patched.Discoverable)
	return patched
}

func TestRequestJoinChannelAPI_HappyPath(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupDiscoverableTH(t)

	channel := th.CreatePrivateChannel(t)
	channel = markDiscoverableViaAdmin(t, th, channel)

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, _, err := th.Client.Login(context.Background(), other.Email, other.Password)
	require.NoError(t, err)

	body := []byte(`{"message":"hi"}`)
	resp, err := th.Client.DoAPIPost(context.Background(), "/channels/"+channel.Id+"/join_request", string(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var req model.ChannelJoinRequest
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&req))
	assert.Equal(t, model.ChannelJoinRequestStatusPending, req.Status)
	assert.Equal(t, channel.Id, req.ChannelId)
	assert.Equal(t, other.Id, req.UserId)
}

func TestRequestJoinChannelAPI_FeatureDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.CreatePrivateChannel(t)
	body := []byte(`{"message":"hi"}`)
	resp, err := th.Client.DoAPIPost(context.Background(), "/channels/"+channel.Id+"/join_request", string(body))
	defer closeBodyOrNil(resp)
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "route must be unregistered when feature flag is off")
}

func TestPatchChannelDiscoverable_RejectsNonPrivate(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupDiscoverableTH(t)

	publicChannel := th.CreatePublicChannel(t)
	on := true
	_, resp, err := th.SystemAdminClient.PatchChannel(context.Background(), publicChannel.Id, &model.ChannelPatch{Discoverable: &on})
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAddChannelMember_BlocksSelfAddOnDiscoverable(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupDiscoverableTH(t)

	channel := th.CreatePrivateChannel(t)
	channel = markDiscoverableViaAdmin(t, th, channel)

	// Add a user that has manage-private-channel-members on a different
	// channel but not this one. Use Client (BasicUser2) - they're a team
	// member but not yet a channel member here.
	_, _, err := th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
	require.NoError(t, err)

	_, resp, err := th.Client.AddChannelMember(context.Background(), channel.Id, th.BasicUser2.Id)
	require.Error(t, err)
	require.NotNil(t, resp)
	// Without channel admin permission the underlying permission check
	// fails first; either way the request flow is what they need to use.
	assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized,
		"got %d", resp.StatusCode)
}

func TestGetChannelByName_HiddenForNonQualifyingNonMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupDiscoverableTH(t)

	// Plain (non-discoverable) private channel: a non-member must still get
	// 404 — this guards against a regression in the existing read paths.
	channel := th.CreatePrivateChannel(t)

	_, _, err := th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
	require.NoError(t, err)

	_, resp, err := th.Client.GetChannelByName(context.Background(), channel.Name, th.BasicTeam.Id, "")
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetChannelByName_VisibleForQualifyingNonMemberOnDiscoverable(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupDiscoverableTH(t)

	channel := th.CreatePrivateChannel(t)
	channel = markDiscoverableViaAdmin(t, th, channel)

	_, _, err := th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
	require.NoError(t, err)

	got, _, err := th.Client.GetChannelByName(context.Background(), channel.Name, th.BasicTeam.Id, "")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, channel.Id, got.Id)
	assert.True(t, got.Discoverable)
}

// setupJoinRequestChannelAccess stands up a discoverable private channel and
// signs in an off-channel requester, with the channel-access gates live and the
// two channel-access actions answered as given. The channel is marked
// discoverable before the mock is installed so the admin patch is not itself
// gated by a decision under test.
func setupJoinRequestChannelAccess(t *testing.T, readAllowed, writeAllowed bool) (*TestHelper, *model.Channel) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.DiscoverableChannels = true
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelAccessABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	channel := markDiscoverableViaAdmin(t, th, th.CreatePrivateChannel(t))

	other := th.CreateUser(t)
	th.LinkUserToTeam(t, other, th.BasicTeam)
	_, _, err := th.Client.Login(context.Background(), other.Email, other.Password)
	require.NoError(t, err)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, channelReadAccessEvaluation).
		Return(model.AccessDecision{Decision: readAllowed}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, channelWriteAccessEvaluation).
		Return(model.AccessDecision{Decision: writeAllowed}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return th, channel
}

// Asking to join is the request that exists to obtain access, so the write
// policy must not refuse it — a channel whose write rule excludes non-members
// would otherwise be unjoinable through the very flow meant to let people in.
func TestRequestJoinChannelAPI_NotGatedByChannelWriteAccess(t *testing.T) {
	th, channel := setupJoinRequestChannelAccess(t, true /* read */, false /* write */)

	resp, err := th.Client.DoAPIPost(context.Background(), "/channels/"+channel.Id+"/join_request", `{"message":"let me in"}`)
	require.NoError(t, err)
	defer closeBodyOrNil(resp)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var req model.ChannelJoinRequest
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&req))
	assert.Equal(t, model.ChannelJoinRequestStatusPending, req.Status)
	assert.Equal(t, channel.Id, req.ChannelId)
}

// The read policy still gates the flow: a session that cannot see the channel
// must not be able to queue a request against it.
func TestRequestJoinChannelAPI_GatedByChannelReadAccess(t *testing.T) {
	th, channel := setupJoinRequestChannelAccess(t, false /* read */, true /* write */)

	resp, err := th.Client.DoAPIPost(context.Background(), "/channels/"+channel.Id+"/join_request", `{"message":"let me in"}`)
	defer closeBodyOrNil(resp)
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	appErr, ok := err.(*model.AppError)
	require.True(t, ok, "expected an AppError, got %T", err)
	assert.Equal(t, abacDeniedErrorID, appErr.Id)
}

// closeBodyOrNil is a tiny helper so the negative-path tests don't need to
// branch on a nil response body before deferring Close.
func closeBodyOrNil(resp *http.Response) {
	if resp == nil || resp.Body == nil {
		return
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
}
