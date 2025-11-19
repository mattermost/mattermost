// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "encoding/json"

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
