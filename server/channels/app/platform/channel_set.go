// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// channelSet is a set of channels by the key model.DecodeId gives their IDs. Every channel ID the server
// makes decodes: NewId has produced them since the first release, and the store refuses a caller-supplied
// ID unless the channel is shared. An ID that does not decode, which only a shared-channel invite from a
// plugin remote could store, is logged and left out, so its events are delivered to no one.
type channelSet map[[16]byte]struct{}

func newChannelSet(channelIDs map[string]string) channelSet {
	s := make(channelSet, len(channelIDs))
	for channelID := range channelIDs {
		channelKey, ok := model.DecodeId(channelID)
		if !ok {
			mlog.Warn("webhub: channel ID does not decode, its events will not be delivered", mlog.String("channel_id", channelID))
			continue
		}
		s[channelKey] = struct{}{}
	}
	return s
}

func (s channelSet) has(channelKey [16]byte) bool {
	_, ok := s[channelKey]
	return ok
}
