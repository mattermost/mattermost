// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strings"
)

// PageDraft is a composite model for page drafts.
// All data is stored in the Drafts table: metadata in Props, content in Message (TipTap JSON).
// With the unified page ID model, PageId is server-generated and remains
// the same throughout the draft -> publish lifecycle.
// Used for API responses and app layer operations.
type PageDraft struct {
	// From Drafts table
	UserId    string          `json:"user_id"`
	WikiId    string          `json:"wiki_id"`
	ChannelId string          `json:"channel_id"`
	PageId    string          `json:"page_id"` // Unified page ID (server-generated)
	FileIds   StringArray     `json:"file_ids,omitempty"`
	Props     StringInterface `json:"props"`
	CreateAt  int64           `json:"create_at"`
	UpdateAt  int64           `json:"update_at"`

	// Title comes from Draft.Props["title"]
	Title        string         `json:"title"`
	Content      TipTapDocument `json:"content"`                 // Parsed from Draft.Message
	BaseUpdateAt int64          `json:"base_updateat,omitempty"` // Read from Draft.Props["base_update_at"]

	// Computed field - indicates whether a published version exists for this page
	HasPublishedVersion bool `json:"has_published_version"`
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
	WikiId     string `json:"wiki_id"`
	PageId     string `json:"page_id"` // Unified page ID (same for draft and published)
	ParentId   string `json:"page_parent_id,omitempty"`
	Title      string `json:"title"`
	SearchText string `json:"search_text,omitempty"`
	Content    string `json:"content,omitempty"`
	PageStatus string `json:"page_status,omitempty"`
	BaseEditAt int64  `json:"base_edit_at,omitempty"`
	Force      bool   `json:"force,omitempty"`
}

// IsValid validates the PublishPageDraftOptions struct.
func (opts *PublishPageDraftOptions) IsValid() *AppError {
	if !IsValidId(opts.WikiId) {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !IsValidId(opts.PageId) {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.page_id.app_error", nil, "", http.StatusBadRequest)
	}
	opts.Title = strings.TrimSpace(opts.Title)
	if opts.Title == "" {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.empty_title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(opts.Title) > MaxPageTitleLength {
		return NewAppError("PublishPageDraftOptions.IsValid", "model.page_draft.publish_options.title_too_long.app_error",
			map[string]any{"Length": len(opts.Title), "MaxLength": MaxPageTitleLength}, "", http.StatusBadRequest)
	}
	return nil
}

// Auditable returns the auditable representation of the PageDraft.
func (pd *PageDraft) Auditable() map[string]any {
	return map[string]any{
		"user_id":    pd.UserId,
		"wiki_id":    pd.WikiId,
		"channel_id": pd.ChannelId,
		"page_id":    pd.PageId,
		"title":      pd.Title,
		"create_at":  pd.CreateAt,
		"update_at":  pd.UpdateAt,
	}
}

// ValidateContent validates the Draft.Message as valid TipTap JSON content.
func (pd *PageDraft) ValidateContent(message string) *AppError {
	if message == "" {
		return nil
	}

	if len(message) > PageContentMaxSize {
		return NewAppError("PageDraft.ValidateContent", "model.page_draft.validate_content.too_large.app_error",
			map[string]any{"Size": len(message), "MaxSize": PageContentMaxSize}, "", http.StatusBadRequest)
	}

	if err := ValidateTipTapDocument(message); err != nil {
		return NewAppError("PageDraft.ValidateContent", "model.page_draft.validate_content.invalid.app_error",
			nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

// PageDraftFromDraft builds a PageDraft from a Draft.
// Content is parsed from Draft.Message (TipTap JSON).
// BaseUpdateAt is read from Draft.Props["base_update_at"].
func PageDraftFromDraft(draft *Draft) (*PageDraft, error) {
	props := draft.GetProps()

	var title string
	if t, ok := props["title"].(string); ok {
		title = t
	}

	var content TipTapDocument
	if draft.Message != "" {
		var err error
		content, err = ParseTipTapDocument(draft.Message)
		if err != nil {
			return nil, err
		}
	}

	var baseUpdateAt int64
	if v, ok := props["base_update_at"]; ok {
		switch val := v.(type) {
		case float64:
			baseUpdateAt = int64(val)
		case int64:
			baseUpdateAt = val
		case json.Number:
			if i, err := val.Int64(); err == nil {
				baseUpdateAt = i
			}
		}
	}

	pd := &PageDraft{
		UserId:       draft.UserId,
		WikiId:       draft.ChannelId,
		ChannelId:    draft.ChannelId,
		PageId:       draft.RootId,
		FileIds:      draft.FileIds,
		Props:        props,
		CreateAt:     draft.CreateAt,
		UpdateAt:     draft.UpdateAt,
		Title:        title,
		Content:      content,
		BaseUpdateAt: baseUpdateAt,
	}

	if v, ok := props["has_published_version"]; ok {
		switch val := v.(type) {
		case bool:
			pd.HasPublishedVersion = val
		case string:
			pd.HasPublishedVersion = val == "true"
		}
	}

	return pd, nil
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

	if !IsValidId(pd.PageId) {
		return NewAppError("PageDraft.IsValid", "model.page_draft.is_valid.page_id.app_error", nil, "page_id must be a valid ID", http.StatusBadRequest)
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
