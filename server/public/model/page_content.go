// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/pkg/errors"
)

const (
	PageContentMaxSize = 10 * 1024 * 1024 // 10MB for TipTap JSON document
)

type PageContent struct {
	PageId       string         `json:"page_id"`
	UserId       string         `json:"user_id"`                 // Empty string for published, user_id for drafts
	WikiId       string         `json:"wiki_id,omitempty"`       // Wiki context (required for drafts)
	Title        string         `json:"title,omitempty"`         // Page title
	Content      TipTapDocument `json:"content"`                 // TipTap document
	SearchText   string         `json:"search_text,omitempty"`   // Extracted text for search
	BaseUpdateAt int64          `json:"base_updateat,omitempty"` // For conflict detection when editing published pages
	CreateAt     int64          `json:"create_at"`
	UpdateAt     int64          `json:"update_at"`
	DeleteAt     int64          `json:"delete_at"`

	// Computed field - indicates whether a published version exists for this page (not stored in DB)
	HasPublishedVersion bool `json:"has_published_version,omitempty"`
}

type TipTapDocument struct {
	Type    string           `json:"type"`
	Content []map[string]any `json:"content"`
}

// Scan implements the sql.Scanner interface for TipTapDocument
func (td *TipTapDocument) Scan(value any) error {
	if value == nil {
		*td = TipTapDocument{Type: "doc", Content: []map[string]any{}}
		return nil
	}

	buf, ok := value.([]byte)
	if ok {
		return json.Unmarshal(buf, td)
	}

	str, ok := value.(string)
	if ok {
		return json.Unmarshal([]byte(str), td)
	}

	return errors.New("received value is neither a byte slice nor string")
}

// Value implements the driver.Valuer interface for TipTapDocument
func (td TipTapDocument) Value() (driver.Value, error) {
	j, err := json.Marshal(td)
	if err != nil {
		return nil, err
	}
	return j, nil
}

func (pc *PageContent) IsValid() *AppError {
	if !IsValidId(pc.PageId) {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.page_id.app_error", nil, "", http.StatusBadRequest)
	}

	// UserId can be empty string (for published) or valid ID (for draft)
	// Status is derived from UserId: non-empty = draft, empty = published
	if pc.UserId != "" && !IsValidId(pc.UserId) {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	// WikiId is required for drafts (UserId != "" means draft)
	if pc.UserId != "" && !IsValidId(pc.WikiId) {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	if pc.CreateAt == 0 {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if pc.UpdateAt == 0 {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(pc.Title) > MaxPageTitleLength {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.title_too_long.app_error",
			map[string]any{"Length": len(pc.Title), "MaxLength": MaxPageTitleLength}, "", http.StatusBadRequest)
	}

	contentJSON, err := json.Marshal(pc.Content)
	if err != nil {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.content_invalid.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if len(contentJSON) > PageContentMaxSize {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.content_too_large.app_error",
			map[string]any{"Size": len(contentJSON), "MaxSize": PageContentMaxSize}, "", http.StatusBadRequest)
	}

	return nil
}

// IsDraft returns true if this is a draft (has a user owner).
// Status is derived from UserId: non-empty UserId = draft, empty UserId = published.
func (pc *PageContent) IsDraft() bool {
	return pc.UserId != ""
}

// IsPublished returns true if this is published content (no user owner).
// Status is derived from UserId: non-empty UserId = draft, empty UserId = published.
func (pc *PageContent) IsPublished() bool {
	return pc.UserId == ""
}

func (pc *PageContent) PreSave() {
	pc.Title = SanitizeUnicode(pc.Title)

	if pc.CreateAt == 0 {
		pc.CreateAt = GetMillis()
		pc.UpdateAt = pc.CreateAt
	} else {
		pc.UpdateAt = GetMillis()
	}

	pc.SearchText = pc.buildSearchText()
}

func (pc *PageContent) buildSearchText() string {
	titleText := cleanText(pc.Title)
	contentText := extractSimpleText(pc.Content)

	if titleText != "" && contentText != "" {
		return titleText + " " + contentText
	} else if titleText != "" {
		return titleText
	}
	return contentText
}

func (pc *PageContent) SetDocumentJSON(contentJSON string) error {
	if contentJSON == "" {
		pc.Content = TipTapDocument{
			Type:    "doc",
			Content: []map[string]any{},
		}
		return nil
	}

	var doc TipTapDocument
	if err := json.Unmarshal([]byte(contentJSON), &doc); err != nil {
		return err
	}

	sanitizeTipTapDocument(&doc)
	pc.Content = doc
	return nil
}

func (pc *PageContent) GetDocumentJSON() (string, error) {
	contentJSON, err := json.Marshal(pc.Content)
	if err != nil {
		return "", err
	}
	return string(contentJSON), nil
}

func extractSimpleText(doc TipTapDocument) string {
	var textParts []string

	for _, node := range doc.Content {
		text := extractTextFromNode(node)
		if text != "" {
			textParts = append(textParts, text)
		}
	}

	fullText := strings.Join(textParts, " ")
	fullText = cleanText(fullText)

	// No truncation - return full text for complete search coverage
	return fullText
}

func extractTextFromNode(node map[string]any) string {
	var parts []string

	if textVal, ok := node["text"]; ok {
		if text, ok := textVal.(string); ok {
			parts = append(parts, text)
		}
	}

	// Handle TipTap mention nodes (user mentions and channel mentions)
	// Mentions are stored as {type: "mention", attrs: {id: "...", label: "username"}}
	// The label contains the username which should be searchable
	if nodeType, ok := node["type"].(string); ok && (nodeType == "mention" || nodeType == "channelMention") {
		if attrs, ok := node["attrs"].(map[string]any); ok {
			// Extract label (username) for search - this allows @mentions to be found in search
			if label, ok := attrs["label"].(string); ok && label != "" {
				// Add with @ prefix to make mentions searchable (e.g., "@john")
				parts = append(parts, "@"+label)
			} else if id, ok := attrs["id"].(string); ok && id != "" {
				// Fall back to id if label is not set
				parts = append(parts, "@"+id)
			}
		}
	}

	if contentVal, ok := node["content"]; ok {
		var childNodes []map[string]any

		switch v := contentVal.(type) {
		case []any:
			for _, child := range v {
				if childNode, ok := child.(map[string]any); ok {
					childNodes = append(childNodes, childNode)
				}
			}
		case []map[string]any:
			childNodes = v
		}

		for _, childNode := range childNodes {
			childText := extractTextFromNode(childNode)
			if childText != "" {
				parts = append(parts, childText)
			}
		}
	}

	return strings.Join(parts, " ")
}

func cleanText(text string) string {
	re := regexp.MustCompile(`\s+`)
	text = re.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func sanitizeTipTapDocument(doc *TipTapDocument) {
	if doc == nil {
		return
	}

	for i := range doc.Content {
		sanitizeTipTapNode(doc.Content[i])
	}
}

func sanitizeTipTapNode(node map[string]any) {
	if node == nil {
		return
	}

	// Text nodes in TipTap JSON are plain text - TipTap handles DOM escaping during render
	// No need to HTML-escape here as it would cause double-escaping

	if attrs, ok := node["attrs"].(map[string]any); ok {
		if href, ok := attrs["href"].(string); ok {
			attrs["href"] = sanitizeURL(href)
		}
		if src, ok := attrs["src"].(string); ok {
			attrs["src"] = sanitizeURL(src)
		}
	}

	if marksVal, ok := node["marks"]; ok {
		if marksArray, ok := marksVal.([]any); ok {
			for _, mark := range marksArray {
				if markNode, ok := mark.(map[string]any); ok {
					if attrs, ok := markNode["attrs"].(map[string]any); ok {
						if href, ok := attrs["href"].(string); ok {
							attrs["href"] = sanitizeURL(href)
						}
						if src, ok := attrs["src"].(string); ok {
							attrs["src"] = sanitizeURL(src)
						}
					}
				}
			}
		}
	}

	if contentVal, ok := node["content"]; ok {
		if contentArray, ok := contentVal.([]any); ok {
			for _, child := range contentArray {
				if childNode, ok := child.(map[string]any); ok {
					sanitizeTipTapNode(childNode)
				}
			}
		}
	}
}

func sanitizeURL(url string) string {
	lower := strings.ToLower(strings.TrimSpace(url))
	if strings.HasPrefix(lower, "javascript:") || strings.HasPrefix(lower, "vbscript:") {
		return ""
	}
	// Block dangerous data URIs but allow safe raster image data URIs
	// SVG is explicitly excluded because it can contain embedded JavaScript
	if strings.HasPrefix(lower, "data:") {
		safeImagePrefixes := []string{
			"data:image/png",
			"data:image/jpeg",
			"data:image/jpg",
			"data:image/gif",
			"data:image/webp",
			"data:image/bmp",
		}
		for _, prefix := range safeImagePrefixes {
			if strings.HasPrefix(lower, prefix) {
				return url
			}
		}
		return "" // Block all other data: URIs including SVG and text/html
	}
	return url
}

// ValidateTipTapDocument validates that content is valid TipTap JSON format.
// Returns nil if valid, error describing the validation failure otherwise.
func ValidateTipTapDocument(contentJSON string) error {
	if contentJSON == "" {
		return nil
	}

	trimmed := strings.TrimSpace(contentJSON)
	if !strings.HasPrefix(trimmed, "{") {
		return errors.New("content must be valid JSON starting with {")
	}

	var doc map[string]any
	if err := json.Unmarshal([]byte(contentJSON), &doc); err != nil {
		return errors.Wrap(err, "content must be valid JSON")
	}

	docType, ok := doc["type"].(string)
	if !ok || docType != "doc" {
		return errors.New("content must be valid TipTap JSON with type: doc")
	}

	return nil
}

// CreatePageDraftRequest is the request body for creating a new page draft
type CreatePageDraftRequest struct {
	Title    string `json:"title"`
	ParentId string `json:"parent_id,omitempty"`
}

// SavePageDraftRequest is the request body for saving/autosaving a page draft
type SavePageDraftRequest struct {
	Content      string `json:"content"`       // TipTap JSON document as string
	Title        string `json:"title"`         // Page title
	LastUpdateAt int64  `json:"last_updateat"` // For optimistic locking
}

// PageDraftResponse is the response for page draft operations
type PageDraftResponse struct {
	PageId       string `json:"page_id"`
	WikiId       string `json:"wiki_id"`
	Title        string `json:"title"`
	Content      string `json:"content,omitempty"`       // TipTap JSON document as string
	BaseUpdateAt int64  `json:"base_updateat,omitempty"` // For conflict detection
	CreateAt     int64  `json:"create_at"`
	UpdateAt     int64  `json:"update_at"`
}

// ToResponse converts a PageContent to a PageDraftResponse
func (pc *PageContent) ToResponse() (*PageDraftResponse, error) {
	contentJSON, err := pc.GetDocumentJSON()
	if err != nil {
		return nil, err
	}

	return &PageDraftResponse{
		PageId:       pc.PageId,
		WikiId:       pc.WikiId,
		Title:        pc.Title,
		Content:      contentJSON,
		BaseUpdateAt: pc.BaseUpdateAt,
		CreateAt:     pc.CreateAt,
		UpdateAt:     pc.UpdateAt,
	}, nil
}
