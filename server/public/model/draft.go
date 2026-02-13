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
	DeleteAt  int64  `json:"delete_at"` // Deprecated, we now just hard delete the rows
	UserId    string `json:"user_id"`
	ChannelId string `json:"channel_id"`
	RootId    string `json:"root_id"`

	Message string `json:"message"`

	Type     string          `json:"type"`
	propsMu  sync.RWMutex    `db:"-"`       // Unexported mutex used to guard Draft.Props.
	Props    StringInterface `json:"props"` // Deprecated: use GetProps()
	FileIds  StringArray     `json:"file_ids,omitempty"`
	Metadata *PostMetadata   `json:"metadata,omitempty"`
	Priority StringInterface `json:"priority,omitempty"`
}

func (o *Draft) IsValid(maxDraftSize int) *AppError {
	// Page drafts store content in PageContents table (status='draft'), so Message should be empty
	if o.IsPageDraft() {
		if o.Message != "" {
			return NewAppError("Drafts.IsValid", "model.draft.is_valid.page_draft_message.app_error",
				nil, "page drafts should not have Message content", http.StatusBadRequest)
		}
	} else {
		// Channel drafts store content in Message field
		if utf8.RuneCountInString(o.Message) > maxDraftSize {
			return NewAppError("Drafts.IsValid", "model.draft.is_valid.message_length.app_error",
				map[string]any{"Length": utf8.RuneCountInString(o.Message), "MaxLength": maxDraftSize}, "channelid="+o.ChannelId, http.StatusBadRequest)
		}
	}

	return o.BaseIsValid()
}

func (o *Draft) BaseIsValid() *AppError {
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

	if !o.IsPageDraft() {
		if !(IsValidId(o.RootId) || o.RootId == "") {
			return NewAppError("Drafts.IsValid", "model.draft.is_valid.root_id.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if utf8.RuneCountInString(ArrayToJSON(o.FileIds)) > PostFileidsMaxRunes {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.file_ids.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(StringInterfaceToJSON(o.GetProps())) > PostPropsMaxRunes {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.props.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(StringInterfaceToJSON(o.Priority)) > PostPropsMaxRunes {
		return NewAppError("Drafts.IsValid", "model.draft.is_valid.priority.app_error", nil, "channelid="+o.ChannelId, http.StatusBadRequest)
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
		o.UpdateAt = o.CreateAt
	} else {
		o.UpdateAt = GetMillis()
	}

	o.DeleteAt = 0
	o.PreCommit()
}

func (o *Draft) PreCommit() {
	if o.GetProps() == nil {
		o.SetProps(make(map[string]any))
	}

	if o.FileIds == nil {
		o.FileIds = []string{}
	}

	// There's a rare bug where the client sends up duplicate FileIds so protect against that
	o.FileIds = RemoveDuplicateStrings(o.FileIds)
}

// IsPageDraft determines if a draft is for a wiki page (vs a channel post/thread).
// Detection is based on Props containing page-specific metadata (title or page_id).
func (o *Draft) IsPageDraft() bool {
	props := o.GetProps()
	if props == nil {
		return false
	}
	_, hasTitle := props["title"]
	_, hasPageId := props[PagePropsPageID]
	return hasTitle || hasPageId
}

// IsEditingExistingPage determines if a draft is editing an existing published page
// (vs creating a new page). When editing an existing page, the draft stores the
// published page_id in props.
func (o *Draft) IsEditingExistingPage() bool {
	props := o.GetProps()
	if props == nil {
		return false
	}
	pageId, hasPageId := props[PagePropsPageID]
	if !hasPageId {
		return false
	}
	pageIdStr, ok := pageId.(string)
	return ok && pageIdStr != ""
}

// GetPublishedPageId returns the published page ID if this draft is editing an
// existing page. Returns empty string if this is a new page draft.
func (o *Draft) GetPublishedPageId() string {
	props := o.GetProps()
	if props == nil {
		return ""
	}
	pageId, ok := props[PagePropsPageID]
	if !ok {
		return ""
	}
	pageIdStr, ok := pageId.(string)
	if !ok {
		return ""
	}
	return pageIdStr
}
