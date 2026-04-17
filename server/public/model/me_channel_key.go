// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type MEChannelKey struct {
	ChannelID  string `db:"channelid"  json:"channel_id"`
	WrappedDEK []byte `db:"wrappeddek" json:"-"`
	KeyID      string `db:"keyid"      json:"key_id"`
	CreateAt   int64  `db:"createat"   json:"create_at"`
	UpdateAt   int64  `db:"updateat"   json:"update_at"`
}

// PreSave populates CreateAt/UpdateAt for a new row. It mutates the receiver:
// callers that retain a reference will observe the populated timestamps.
func (k *MEChannelKey) PreSave() {
	if k.CreateAt == 0 {
		k.CreateAt = GetMillis()
	}
	if k.UpdateAt == 0 {
		k.UpdateAt = k.CreateAt
	}
}

// PreUpdate refreshes UpdateAt. It mutates the receiver: callers that retain a
// reference will observe the new timestamp even if the subsequent write fails.
func (k *MEChannelKey) PreUpdate() {
	k.UpdateAt = GetMillis()
}
