// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"html"
	"net/http"
	"regexp"
	"strings"
)

const (
	PageContentMaxSize = 10 * 1024 * 1024 // 10MB for TipTap JSON document
)

type PageContent struct {
	PageId     string         `json:"page_id"`
	Content    TipTapDocument `json:"content"`
	SearchText string         `json:"search_text,omitempty"`
	CreateAt   int64          `json:"create_at"`
	UpdateAt   int64          `json:"update_at"`
}

type TipTapDocument struct {
	Type    string           `json:"type"`
	Content []map[string]any `json:"content,omitempty"`
}

func (pc *PageContent) IsValid() *AppError {
	if !IsValidId(pc.PageId) {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.page_id.app_error", nil, "", http.StatusBadRequest)
	}

	if pc.CreateAt == 0 {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if pc.UpdateAt == 0 {
		return NewAppError("PageContent.IsValid", "model.page_content.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
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

func (pc *PageContent) PreSave() {
	if pc.CreateAt == 0 {
		pc.CreateAt = GetMillis()
		pc.UpdateAt = pc.CreateAt
	} else {
		pc.UpdateAt = GetMillis()
	}

	pc.SearchText = extractSimpleText(pc.Content)
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

	if contentVal, ok := node["content"]; ok {
		if contentArray, ok := contentVal.([]any); ok {
			for _, child := range contentArray {
				if childNode, ok := child.(map[string]any); ok {
					childText := extractTextFromNode(childNode)
					if childText != "" {
						parts = append(parts, childText)
					}
				}
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

	if textVal, ok := node["text"]; ok {
		if text, ok := textVal.(string); ok {
			node["text"] = html.EscapeString(text)
		}
	}

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
	if strings.HasPrefix(lower, "javascript:") || strings.HasPrefix(lower, "data:") || strings.HasPrefix(lower, "vbscript:") {
		return ""
	}
	return url
}
