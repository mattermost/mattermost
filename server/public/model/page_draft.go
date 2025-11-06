// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"sync"
)

type PageDraft struct {
	UserId   string         `json:"user_id"`
	WikiId   string         `json:"wiki_id"`
	DraftId  string         `json:"draft_id"`
	Title    string         `json:"title"`
	Content  TipTapDocument `json:"content"`
	FileIds  StringArray    `json:"file_ids,omitempty"`
	CreateAt int64          `json:"create_at"`
	UpdateAt int64          `json:"update_at"`

	propsMu sync.RWMutex    `db:"-"`
	Props   StringInterface `json:"props"`
}

func (pd *PageDraft) IsValid() *AppError {
	if !IsValidId(pd.UserId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pd.WikiId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	if pd.DraftId == "" {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.draft_id.app_error", nil, "draft_id cannot be empty", http.StatusBadRequest)
	}

	if pd.CreateAt == 0 {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if pd.UpdateAt == 0 {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(pd.Title) > MaxPageTitleLength {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.title_too_long.app_error",
			map[string]any{"Length": len(pd.Title), "MaxLength": MaxPageTitleLength}, "", http.StatusBadRequest)
	}

	contentJSON, err := json.Marshal(pd.Content)
	if err != nil {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.content_invalid.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if len(contentJSON) > PageContentMaxSize {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.content_too_large.app_error",
			map[string]any{"Size": len(contentJSON), "MaxSize": PageContentMaxSize}, "", http.StatusBadRequest)
	}

	if len(ArrayToJSON(pd.FileIds)) > PostFileidsMaxRunes {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.file_ids.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (pd *PageDraft) PreSave() {
	if pd.CreateAt == 0 {
		pd.CreateAt = GetMillis()
		pd.UpdateAt = pd.CreateAt
	} else {
		pd.UpdateAt = GetMillis()
	}

	pd.PreCommit()
}

func (pd *PageDraft) PreCommit() {
	if pd.GetProps() == nil {
		pd.SetProps(make(map[string]any))
	}
}

func (pd *PageDraft) SetProps(props StringInterface) {
	pd.propsMu.Lock()
	defer pd.propsMu.Unlock()
	pd.Props = props
}

func (pd *PageDraft) GetProps() StringInterface {
	pd.propsMu.RLock()
	defer pd.propsMu.RUnlock()
	return pd.Props
}

func (pd *PageDraft) GetPublishedPageId() string {
	props := pd.GetProps()
	if props == nil {
		return ""
	}
	pageId, ok := props["page_id"]
	if !ok {
		return ""
	}
	pageIdStr, ok := pageId.(string)
	if !ok {
		return ""
	}
	return pageIdStr
}

func (pd *PageDraft) IsEditingExistingPage() bool {
	return pd.GetPublishedPageId() != ""
}

func (pd *PageDraft) SetDocumentJSON(contentJSON string) error {
	var doc TipTapDocument
	if err := json.Unmarshal([]byte(contentJSON), &doc); err != nil {
		return err
	}

	sanitizeTipTapDocument(&doc)
	pd.Content = doc
	return nil
}

func (pd *PageDraft) GetDocumentJSON() (string, error) {
	contentJSON, err := json.Marshal(pd.Content)
	if err != nil {
		return "", err
	}
	return string(contentJSON), nil
}

func (pd *PageDraft) IsContentEmpty() bool {
	return len(pd.Content.Content) == 0 && len(pd.FileIds) == 0
}
