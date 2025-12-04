// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

// PageDraftContent stores the content for page drafts (mirrors PageContents pattern).
// Metadata (FileIds, Props, etc.) is stored in the Drafts table with WikiId set.
type PageDraftContent struct {
	UserId   string         `json:"user_id"`
	WikiId   string         `json:"wiki_id"`
	DraftId  string         `json:"draft_id"`
	Title    string         `json:"title"`
	Content  TipTapDocument `json:"content"`
	CreateAt int64          `json:"create_at"`
	UpdateAt int64          `json:"update_at"`
}

func (pd *PageDraftContent) IsValid() *AppError {
	if !IsValidId(pd.UserId) {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pd.WikiId) {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	if pd.DraftId == "" {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.draft_id.app_error", nil, "draft_id cannot be empty", http.StatusBadRequest)
	}

	if pd.CreateAt == 0 {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if pd.UpdateAt == 0 {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(pd.Title) > MaxPageTitleLength {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.title_too_long.app_error",
			map[string]any{"Length": len(pd.Title), "MaxLength": MaxPageTitleLength}, "", http.StatusBadRequest)
	}

	contentJSON, err := json.Marshal(pd.Content)
	if err != nil {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.content_invalid.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if len(contentJSON) > PageContentMaxSize {
		return NewAppError("PageDraftContent.IsValid", "model.page_draft_content.is_valid.content_too_large.app_error",
			map[string]any{"Size": len(contentJSON), "MaxSize": PageContentMaxSize}, "", http.StatusBadRequest)
	}

	return nil
}

func (pd *PageDraftContent) PreSave() {
	pd.Title = SanitizeUnicode(pd.Title)

	if pd.CreateAt == 0 {
		pd.CreateAt = GetMillis()
		pd.UpdateAt = pd.CreateAt
	} else {
		pd.UpdateAt = GetMillis()
	}
}

func (pd *PageDraftContent) SetDocumentJSON(contentJSON string) error {
	var doc TipTapDocument
	if err := json.Unmarshal([]byte(contentJSON), &doc); err != nil {
		return err
	}

	sanitizeTipTapDocument(&doc)
	pd.Content = doc
	return nil
}

func (pd *PageDraftContent) GetDocumentJSON() (string, error) {
	contentJSON, err := json.Marshal(pd.Content)
	if err != nil {
		return "", err
	}
	return string(contentJSON), nil
}

func (pd *PageDraftContent) IsContentEmpty() bool {
	return len(pd.Content.Content) == 0
}
