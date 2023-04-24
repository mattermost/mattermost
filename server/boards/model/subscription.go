// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SubTypeUser    = "user"
	SubTypeChannel = "channel"
)

type SubscriberType string

func (st SubscriberType) IsValid() bool {
	switch st {
	case SubTypeUser, SubTypeChannel:
		return true
	}
	return false
}

// Subscription is a subscription to a board, card, etc, for a user or channel.
// swagger:model
type Subscription struct {
	// BlockType is the block type of the entity (e.g. board, card) subscribed to
	// required: true
	BlockType BlockType `json:"blockType"`

	// BlockID is id of the entity being subscribed to
	// required: true
	BlockID string `json:"blockId"`

	// SubscriberType is the type of the entity (e.g. user, channel) that is subscribing
	// required: true
	SubscriberType SubscriberType `json:"subscriberType"`

	// SubscriberID is the id of the entity that is subscribing
	// required: true
	SubscriberID string `json:"subscriberId"`

	// NotifiedAt is the timestamp of the last notification sent for this subscription
	// required: true
	NotifiedAt int64 `json:"notifiedAt,omitempty"`

	// CreatedAt is the timestamp this subscription was created in miliseconds since the current epoch
	// required: true
	CreateAt int64 `json:"createAt"`

	// DeleteAt is the timestamp this subscription was deleted in miliseconds since the current epoch, or zero if not deleted
	// required: true
	DeleteAt int64 `json:"deleteAt"`
}

func (s *Subscription) IsValid() error {
	if s == nil {
		return ErrInvalidSubscription{"cannot be nil"}
	}
	if s.BlockID == "" {
		return ErrInvalidSubscription{"missing block id"}
	}
	if s.BlockType == "" {
		return ErrInvalidSubscription{"missing block type"}
	}
	if s.SubscriberID == "" {
		return ErrInvalidSubscription{"missing subscriber id"}
	}
	if !s.SubscriberType.IsValid() {
		return ErrInvalidSubscription{"invalid subscriber type"}
	}
	return nil
}

func SubscriptionFromJSON(data io.Reader) (*Subscription, error) {
	var subscription Subscription
	if err := json.NewDecoder(data).Decode(&subscription); err != nil {
		return nil, err
	}
	return &subscription, nil
}

type ErrInvalidSubscription struct {
	msg string
}

func (e ErrInvalidSubscription) Error() string {
	return e.msg
}

// Subscriber is an entity (e.g. user, channel) that can subscribe to events from boards, cards, etc
// swagger:model
type Subscriber struct {
	// SubscriberType is the type of the entity (e.g. user, channel) that is subscribing
	// required: true
	SubscriberType SubscriberType `json:"subscriber_type"`

	// SubscriberID is the id of the entity that is subscribing
	// required: true
	SubscriberID string `json:"subscriber_id"`

	// NotifiedAt is the timestamp this subscriber was last notified
	NotifiedAt int64 `json:"notified_at"`
}
