// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestChannelSet(t *testing.T) {
	t.Run("channel sets match by key and by string", func(t *testing.T) {
		// zero decodes to the zero key, which means "use the string", so it must take the string path both ways.
		good, odd, zero := model.NewId(), "l0v2aaaaaaaaaaaaaaaaaaaaaa", strings.Repeat("y", 26)
		s := newChannelSet(map[string]string{good: "", odd: "", zero: ""})
		require.True(t, has(s, good))
		require.True(t, has(s, odd))
		require.True(t, has(s, zero))
		require.Len(t, s.undecodableIDs, 2)
		require.False(t, has(s, model.NewId()))
	})
}

func TestHubConnIndexChannelsThatDoNotDecode(t *testing.T) {
	connIndex := newHubConnectionIndex(inactiveConnReaperInterval, nil, nil, true)
	wc := &WebConn{UserId: model.NewId()}
	wc.SetConnectionID(model.NewId())
	odd := "l0v2aaaaaaaaaaaaaaaaaaaaaa"
	channels := newChannelList(map[string]string{odd: "", model.NewId(): ""})
	connIndex.addToChannels(channels, wc)
	connIndex.byConnection[wc] = channels

	require.Len(t, connIndex.byUndecodableChannelID, 1)
	require.Len(t, connIndex.byChannelKey, 1)
	for c := range forChannel(connIndex, odd) {
		require.Same(t, wc, c)
	}
	connIndex.Remove(wc)
	require.Empty(t, connIndex.byUndecodableChannelID)
	require.Empty(t, connIndex.byChannelKey)
}

func has(s channelSet, channelID string) bool {
	return s.has(channelID, decodeChannelID(channelID))
}
