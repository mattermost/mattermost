// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDiscoverableVisibilityInvariant_NonGuestSeesNoPolicy verifies that a
// discoverable + no-policy private channel is returned through the
// non-member autocomplete path for a non-guest user.
//
// The complementary policy-enforced + non-qualifying user case is covered
// by TestFilterDiscoverableChannelsByPolicy_PolicyEnforcedFailSecure (which
// checks the fail-secure path) and the dedicated guest case is in
// TestFilterDiscoverableChannelsByPolicy_GuestHidden.
func TestDiscoverableVisibilityInvariant_NonGuestSeesNoPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	// BasicUser2 is a member of the team but NOT of `channel`. The
	// autocomplete query must still surface the channel because of the
	// discoverable OR-branch (post-query ABAC filter is a no-op since the
	// channel has no policy).
	results, appErr := th.App.AutocompleteChannelsForTeam(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, channel.Name)
	require.Nil(t, appErr)

	found := false
	for _, c := range results {
		if c.Id == channel.Id {
			found = true
			break
		}
	}
	assert.True(t, found, "discoverable + no-policy private channel must appear in autocomplete for a non-member non-guest")
}

// TestDiscoverableVisibilityInvariant_NonDiscoverableHidden ensures that the
// store-level OR-branch we added does not inadvertently leak private
// channels with discoverable=false to non-members. The new OR clause must be
// gated on `Discoverable=true`.
func TestDiscoverableVisibilityInvariant_NonDiscoverableHidden(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	plain := th.CreatePrivateChannel(t, th.BasicTeam)

	results, appErr := th.App.AutocompleteChannelsForTeam(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, plain.Name)
	require.Nil(t, appErr)

	for _, c := range results {
		assert.NotEqual(t, plain.Id, c.Id, "non-discoverable private channel must remain hidden from non-members")
	}
}

// TestDiscoverableVisibilityInvariant_GuestHidden re-verifies the guest path
// at the autocomplete level (the unit-level guest case lives in
// TestFilterDiscoverableChannelsByPolicy_GuestHidden, but this test exercises
// the full app+store integration so we don't accidentally rely on the
// in-memory filter alone).
func TestDiscoverableVisibilityInvariant_GuestHidden(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	withDiscoverableChannelsFlag(t, th, true)

	channel := markDiscoverable(t, th, th.CreatePrivateChannel(t, th.BasicTeam))

	guest := th.CreateGuest(t)
	th.LinkUserToTeam(t, guest, th.BasicTeam)

	results, appErr := th.App.AutocompleteChannelsForTeam(th.Context, th.BasicTeam.Id, guest.Id, channel.Name)
	require.Nil(t, appErr)

	for _, c := range results {
		assert.NotEqual(t, channel.Id, c.Id, "guests must never see discoverable private channels in autocomplete")
	}
}
