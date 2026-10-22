// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestChannelSet(t *testing.T) {
	good, odd := model.NewId(), "l0v2aaaaaaaaaaaaaaaaaaaaaa"
	s := newChannelSet(map[string]string{good: "", odd: ""})
	require.Len(t, s, 1)
	require.True(t, s.has(decodeChannelID(good)))
	require.False(t, s.has(decodeChannelID(odd)), "an ID that does not decode is not a member")
	require.False(t, s.has(decodeChannelID(model.NewId())))
}

func TestHubConnIndexSkipsChannelsThatDoNotDecode(t *testing.T) {
	connIndex := newHubConnectionIndex(inactiveConnReaperInterval, nil, nil, true)
	wc := &WebConn{UserId: model.NewId()}
	wc.SetConnectionID(model.NewId())
	good, odd := model.NewId(), "l0v2aaaaaaaaaaaaaaaaaaaaaa"
	channels := newChannelList(map[string]string{odd: "", good: ""})
	connIndex.addToChannels(channels, wc)
	connIndex.byConnection[wc] = channels

	require.Len(t, connIndex.byChannelKey, 1)
	require.Empty(t, slices.Collect(forChannel(connIndex, odd)))
	require.Equal(t, []*WebConn{wc}, slices.Collect(forChannel(connIndex, good)))
	connIndex.Remove(wc)
	require.Empty(t, connIndex.byChannelKey)
}

// decodeChannelID returns the key of channelID the way the hub does, for tests that call the keyed paths directly.
func decodeChannelID(channelID string) [16]byte {
	channelKey, _ := model.DecodeId(channelID)
	return channelKey
}
