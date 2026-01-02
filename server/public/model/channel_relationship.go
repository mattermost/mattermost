// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

// ChannelRelationType represents the type of relationship between two channels.
type ChannelRelationType string

const (
	// ChannelRelationBookmark indicates the target channel is bookmarked in the source channel.
	ChannelRelationBookmark ChannelRelationType = "bookmark"
	// ChannelRelationMention indicates the target channel was mentioned in the source channel.
	ChannelRelationMention ChannelRelationType = "mention"
	// ChannelRelationLink indicates a link to the target channel exists in the source channel.
	ChannelRelationLink ChannelRelationType = "link"
)

// ChannelRelationship represents a relationship between two channels.
type ChannelRelationship struct {
	Id               string              `json:"id"`
	SourceChannelId  string              `json:"source_channel_id"`
	TargetChannelId  string              `json:"target_channel_id"`
	RelationshipType ChannelRelationType `json:"relationship_type"`
	CreatedAt        int64               `json:"created_at"`
	Metadata         StringInterface     `json:"metadata,omitempty"`
}

// Auditable returns a map of auditable fields for the channel relationship.
func (o *ChannelRelationship) Auditable() map[string]any {
	return map[string]any{
		"id":                o.Id,
		"source_channel_id": o.SourceChannelId,
		"target_channel_id": o.TargetChannelId,
		"relationship_type": o.RelationshipType,
		"created_at":        o.CreatedAt,
	}
}

// Clone returns a shallow copy of the channel relationship.
func (o *ChannelRelationship) Clone() *ChannelRelationship {
	copy := *o
	if o.Metadata != nil {
		copy.Metadata = make(StringInterface, len(o.Metadata))
		for k, v := range o.Metadata {
			copy.Metadata[k] = v
		}
	}
	return &copy
}

// IsValid validates the channel relationship fields.
func (o *ChannelRelationship) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.SourceChannelId) {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.source_channel_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidId(o.TargetChannelId) {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.target_channel_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.SourceChannelId == o.TargetChannelId {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.self_reference.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !o.RelationshipType.IsValid() {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.relationship_type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.CreatedAt == 0 {
		return NewAppError("ChannelRelationship.IsValid", "model.channel_relationship.is_valid.created_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

// IsValid checks if the relationship type is one of the allowed values.
func (t ChannelRelationType) IsValid() bool {
	switch t {
	case ChannelRelationBookmark, ChannelRelationMention, ChannelRelationLink:
		return true
	default:
		return false
	}
}

// PreSave prepares the channel relationship for saving to the database.
func (o *ChannelRelationship) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreatedAt == 0 {
		o.CreatedAt = GetMillis()
	}
}

// ChannelRelationshipList is a slice of channel relationships.
type ChannelRelationshipList []*ChannelRelationship

// ChannelRelationshipWithChannel includes the related channel information.
type ChannelRelationshipWithChannel struct {
	*ChannelRelationship
	Channel *Channel `json:"channel,omitempty"`
}

// ChannelRelationshipWithChannelList is a slice of channel relationships with channel info.
type ChannelRelationshipWithChannelList []*ChannelRelationshipWithChannel

// GetRelatedChannelsResponse is the response for getting related channels.
type GetRelatedChannelsResponse struct {
	Relationships ChannelRelationshipWithChannelList `json:"relationships"`
	TotalCount    int64                              `json:"total_count"`
}
