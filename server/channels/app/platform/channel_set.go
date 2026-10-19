// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import "github.com/mattermost/mattermost/server/public/model"

// undecodableChannelKey is the key of an ID that does not decode; callers then use the ID string. NewId never
// produces it, and the one string that decodes to it, all 'y', simply takes the string path everywhere.
var undecodableChannelKey [16]byte

// decodeChannelID returns the channel ID's key, or undecodableChannelKey when the ID does not decode.
func decodeChannelID(channelID string) [16]byte {
	channelKey, _ := model.DecodeId(channelID)
	return channelKey
}

// channelSet is a set of channels: decoded keys, plus the IDs that do not decode.
type channelSet struct {
	keys           map[[16]byte]struct{}
	undecodableIDs map[string]struct{}
}

func newChannelSet(channelIDs map[string]string) channelSet {
	s := channelSet{keys: make(map[[16]byte]struct{}, len(channelIDs))}
	for channelID := range channelIDs {
		if channelKey := decodeChannelID(channelID); channelKey != undecodableChannelKey {
			s.keys[channelKey] = struct{}{}
		} else {
			if s.undecodableIDs == nil {
				s.undecodableIDs = make(map[string]struct{})
			}
			s.undecodableIDs[channelID] = struct{}{}
		}
	}
	return s
}

// has reports whether the set holds channelID, whose key is channelKey.
func (s channelSet) has(channelID string, channelKey [16]byte) bool {
	if channelKey != undecodableChannelKey {
		_, ok := s.keys[channelKey]
		return ok
	}
	_, ok := s.undecodableIDs[channelID]
	return ok
}
