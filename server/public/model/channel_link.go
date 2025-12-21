// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	ChannelLinkSourceTypeChannel = "channel"
	ChannelLinkSourceTypeGroup   = "group"
)

type ChannelLink struct {
	SourceID      string `json:"source_id"`
	SourceType    string `json:"source_type"`
	DestinationID string `json:"destination_id"`
	CreateAt      int64  `json:"create_at"`
}

func (cl *ChannelLink) IsValid() *AppError {
	if !IsValidId(cl.SourceID) {
		return NewAppError("ChannelLink.IsValid", "model.channel_link.source_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(cl.DestinationID) {
		return NewAppError("ChannelLink.IsValid", "model.channel_link.destination_id.app_error", nil, "", http.StatusBadRequest)
	}

	if cl.SourceID == cl.DestinationID {
		return NewAppError("ChannelLink.IsValid", "model.channel_link.self_link.app_error", nil, "cannot link channel to itself", http.StatusBadRequest)
	}

	if cl.SourceType != ChannelLinkSourceTypeChannel && cl.SourceType != ChannelLinkSourceTypeGroup {
		return NewAppError("ChannelLink.IsValid", "model.channel_link.source_type.app_error", nil, "source_type must be 'channel' or 'group'", http.StatusBadRequest)
	}

	if cl.CreateAt == 0 {
		return NewAppError("ChannelLink.IsValid", "model.channel_link.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (cl *ChannelLink) PreSave() {
	if cl.CreateAt == 0 {
		cl.CreateAt = GetMillis()
	}
}
