// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

// PageDraft is a composite model combining metadata from Drafts table
// and content from PageDraftContents table. This mirrors the Posts/PageContents pattern.
// Used for API responses and app layer operations.
type PageDraft struct {
	// From Drafts table (metadata)
	UserId    string          `json:"user_id"`
	WikiId    string          `json:"wiki_id"`
	ChannelId string          `json:"channel_id"`
	DraftId   string          `json:"draft_id"`
	FileIds   StringArray     `json:"file_ids,omitempty"`
	Props     StringInterface `json:"props"`
	CreateAt  int64           `json:"create_at"`
	UpdateAt  int64           `json:"update_at"`

	// From PageDraftContents table (content)
	Title   string         `json:"title"`
	Content TipTapDocument `json:"content"`
}

// GetPublishedPageId returns the published page ID if this draft is editing an
// existing page. Returns empty string if this is a new page draft.
func (pd *PageDraft) GetPublishedPageId() string {
	if pd.Props == nil {
		return ""
	}
	pageId, ok := pd.Props["page_id"]
	if !ok {
		return ""
	}
	pageIdStr, ok := pageId.(string)
	if !ok {
		return ""
	}
	return pageIdStr
}

// IsEditingExistingPage determines if this draft is editing an existing published page.
func (pd *PageDraft) IsEditingExistingPage() bool {
	return pd.GetPublishedPageId() != ""
}

// SetDocumentJSON sets the content from JSON string.
func (pd *PageDraft) SetDocumentJSON(contentJSON string) error {
	var doc TipTapDocument
	if err := json.Unmarshal([]byte(contentJSON), &doc); err != nil {
		return err
	}
	sanitizeTipTapDocument(&doc)
	pd.Content = doc
	return nil
}

// GetDocumentJSON returns the content as JSON string.
func (pd *PageDraft) GetDocumentJSON() (string, error) {
	contentJSON, err := json.Marshal(pd.Content)
	if err != nil {
		return "", err
	}
	return string(contentJSON), nil
}

// IsContentEmpty checks if the draft has no content.
func (pd *PageDraft) IsContentEmpty() bool {
	return len(pd.Content.Content) == 0 && len(pd.FileIds) == 0
}

// PublishPageDraftOptions contains options for publishing a page draft.
// This consolidates the many parameters into a structured options object.
type PublishPageDraftOptions struct {
	WikiId       string `json:"wiki_id"`
	DraftId      string `json:"draft_id"`
	ParentId     string `json:"page_parent_id,omitempty"`
	Title        string `json:"title"`
	SearchText   string `json:"search_text,omitempty"`
	Content      string `json:"content,omitempty"`
	PageStatus   string `json:"page_status,omitempty"`
	BaseUpdateAt int64  `json:"base_update_at,omitempty"`
	Force        bool   `json:"force,omitempty"`
}

// IsValid validates the PublishPageDraftOptions struct.
func (opts *PublishPageDraftOptions) IsValid() *AppError {
	if !IsValidId(opts.WikiId) {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	if opts.DraftId == "" {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.draft_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(opts.Title) > MaxPageTitleLength {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.title_too_long.app_error",
			map[string]any{"Length": len(opts.Title), "MaxLength": MaxPageTitleLength}, "", http.StatusBadRequest)
	}
	return nil
}

// IsValid validates the PageDraft composite struct.
func (pd *PageDraft) IsValid() *AppError {
	if !IsValidId(pd.UserId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pd.WikiId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(pd.ChannelId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if pd.DraftId == "" {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.draft_id.app_error", nil, "draft_id cannot be empty", http.StatusBadRequest)
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

	return nil
}
