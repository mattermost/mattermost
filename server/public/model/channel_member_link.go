// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	// MaxLinkedWikisPerChannel caps the number of wiki links a single source channel
	// can have. Used for both enforcement (app layer) and query limits (store layer).
	MaxLinkedWikisPerChannel = 50

	// MaxLinkedSourcesPerDestination caps how many source channels a destination
	// wiki can be linked from. Enforced at write time in SaveAndPropagateMembers
	// and used as a defensive bound on GetByDestination result sets.
	MaxLinkedSourcesPerDestination = 200
)

type ChannelMemberLink struct {
	SourceId      string `json:"source_id"`
	DestinationId string `json:"-"`
	WikiId        string `json:"wiki_id"`
	CreateAt      int64  `json:"create_at"`
	CreatorId     string `json:"creator_id,omitempty"`
}

func (l *ChannelMemberLink) PreSave() {
	if l.CreateAt == 0 {
		l.CreateAt = GetMillis()
	}
}

func (l *ChannelMemberLink) Auditable() map[string]any {
	return map[string]any{
		"source_id":      l.SourceId,
		"destination_id": l.DestinationId,
		"wiki_id":        l.WikiId,
		"create_at":      l.CreateAt,
		"creator_id":     l.CreatorId,
	}
}

func (l *ChannelMemberLink) IsValid() *AppError {
	if !IsValidId(l.SourceId) {
		return NewAppError("ChannelMemberLink.IsValid", "model.wiki_link.is_valid.source_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(l.DestinationId) {
		return NewAppError("ChannelMemberLink.IsValid", "model.wiki_link.is_valid.destination_id.app_error", nil, "", http.StatusBadRequest)
	}

	if l.CreatorId != "" && !IsValidId(l.CreatorId) {
		return NewAppError("ChannelMemberLink.IsValid", "model.wiki_link.is_valid.creator_id.app_error", nil, "", http.StatusBadRequest)
	}

	if l.SourceId == l.DestinationId {
		return NewAppError("ChannelMemberLink.IsValid", "model.wiki_link.is_valid.self_link.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
