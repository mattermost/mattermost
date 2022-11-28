// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"sync"
	"unicode/utf8"
)

type Draft struct {
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	UserId    string `json:"user_id"`
	ChannelId string `json:"channel_id"`
	RootId    string `json:"root_id"`

	Message string `json:"message"`

	propsMu  sync.RWMutex    `db:"-"`       // Unexported mutex used to guard Draft.Props.
	Props    StringInterface `json:"props"` // Deprecated: use GetProps()
	FileIds  StringArray     `json:"file_ids,omitempty"`
	Metadata *PostMetadata   `json:"metadata,omitempty"`
	Priority StringInterface `json:"priority,omitempty"`
}

func (o *Draft) IsValid(maxDraftSize int) *AppError {
	if o.CreateAt == 0 {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.create_at.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.update_at.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !(IsValidId(o.RootId) || o.RootId == "") {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.root_id.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Message) > maxDraftSize {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.msg.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(ArrayToJSON(o.FileIds)) > PostFileidsMaxRunes {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.file_ids.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(StringInterfaceToJSON(o.GetProps())) > PostPropsMaxRunes {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.props.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	return nil
}

func (o *Draft) SetProps(props StringInterface) {
	o.propsMu.Lock()
	defer o.propsMu.Unlock()
	o.Props = props
}

func (o *Draft) GetProps() StringInterface {
	o.propsMu.RLock()
	defer o.propsMu.RUnlock()
	return o.Props
}

func (o *Draft) PreSave() {
	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}

	o.UpdateAt = o.CreateAt
	o.PreCommit()
}

func (o *Draft) PreCommit() {
	if o.GetProps() == nil {
		o.SetProps(make(map[string]interface{}))
	}

	if o.FileIds == nil {
		o.FileIds = []string{}
	}

	// There's a rare bug where the client sends up duplicate FileIds so protect against that
	o.FileIds = RemoveDuplicateStrings(o.FileIds)
}

func (o *Draft) PreUpdate() {
	o.UpdateAt = GetMillis()
	o.PreCommit()
}
