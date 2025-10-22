// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPageContentIsValid(t *testing.T) {
	t.Run("valid page content", func(t *testing.T) {
		pc := &PageContent{
			PageId:   NewId(),
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Hello world",
							},
						},
					},
				},
			},
		}

		err := pc.IsValid()
		require.Nil(t, err)
	})

	t.Run("invalid PageId", func(t *testing.T) {
		pc := &PageContent{
			PageId:   "invalid",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pc.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_content.is_valid.page_id.app_error", err.Id)
	})

	t.Run("missing CreateAt", func(t *testing.T) {
		pc := &PageContent{
			PageId:   NewId(),
			CreateAt: 0,
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pc.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_content.is_valid.create_at.app_error", err.Id)
	})

	t.Run("missing UpdateAt", func(t *testing.T) {
		pc := &PageContent{
			PageId:   NewId(),
			CreateAt: GetMillis(),
			UpdateAt: 0,
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pc.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_content.is_valid.update_at.app_error", err.Id)
	})

	t.Run("content exceeds max size", func(t *testing.T) {
		largeText := strings.Repeat("a", PageContentMaxSize+1)
		pc := &PageContent{
			PageId:   NewId(),
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": largeText,
							},
						},
					},
				},
			},
		}

		err := pc.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_content.is_valid.content_too_large.app_error", err.Id)
	})
}

func TestPageContentPreSave(t *testing.T) {
	t.Run("sets CreateAt and UpdateAt on new content", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
			Content: TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Test content",
							},
						},
					},
				},
			},
		}

		pc.PreSave()

		require.Greater(t, pc.CreateAt, int64(0))
		require.Equal(t, pc.CreateAt, pc.UpdateAt)
		require.NotEmpty(t, pc.SearchText)
		require.Contains(t, pc.SearchText, "Test content")
	})

	t.Run("updates UpdateAt on existing content", func(t *testing.T) {
		originalCreateAt := GetMillis()
		pc := &PageContent{
			PageId:   NewId(),
			CreateAt: originalCreateAt,
			UpdateAt: originalCreateAt,
			Content: TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Updated content",
							},
						},
					},
				},
			},
		}

		pc.PreSave()

		require.Equal(t, originalCreateAt, pc.CreateAt)
		require.GreaterOrEqual(t, pc.UpdateAt, originalCreateAt)
	})

	t.Run("extracts search text from content", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
			Content: TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "heading",
						"attrs": map[string]any{
							"level": 1,
						},
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "My Heading",
							},
						},
					},
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "First paragraph with ",
							},
							map[string]any{
								"type": "text",
								"text": "bold text",
								"marks": []any{
									map[string]any{
										"type": "bold",
									},
								},
							},
						},
					},
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Second paragraph",
							},
						},
					},
				},
			},
		}

		pc.PreSave()

		require.NotEmpty(t, pc.SearchText)
		require.Contains(t, pc.SearchText, "My Heading")
		require.Contains(t, pc.SearchText, "First paragraph")
		require.Contains(t, pc.SearchText, "bold text")
		require.Contains(t, pc.SearchText, "Second paragraph")
	})
}

func TestPageContentSetGetDocumentJSON(t *testing.T) {
	t.Run("sets and gets valid JSON", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		require.Equal(t, "doc", pc.Content.Type)
		require.Len(t, pc.Content.Content, 1)

		retrievedJSON, err := pc.GetDocumentJSON()
		require.NoError(t, err)
		require.NotEmpty(t, retrievedJSON)

		var doc TipTapDocument
		err = json.Unmarshal([]byte(retrievedJSON), &doc)
		require.NoError(t, err)
		require.Equal(t, "doc", doc.Type)
	})

	t.Run("handles empty JSON string", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		err := pc.SetDocumentJSON("")
		require.NoError(t, err)

		require.Equal(t, "doc", pc.Content.Type)
		require.Empty(t, pc.Content.Content)
	})

	t.Run("returns error for invalid JSON", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		err := pc.SetDocumentJSON("invalid json")
		require.Error(t, err)
	})
}

func TestExtractSimpleText(t *testing.T) {
	t.Run("extracts text from simple paragraph", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Simple text",
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Equal(t, "Simple text", text)
	})

	t.Run("extracts text from nested structures", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "bulletList",
					"content": []any{
						map[string]any{
							"type": "listItem",
							"content": []any{
								map[string]any{
									"type": "paragraph",
									"content": []any{
										map[string]any{
											"type": "text",
											"text": "Item 1",
										},
									},
								},
							},
						},
						map[string]any{
							"type": "listItem",
							"content": []any{
								map[string]any{
									"type": "paragraph",
									"content": []any{
										map[string]any{
											"type": "text",
											"text": "Item 2",
										},
									},
								},
							},
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Contains(t, text, "Item 1")
		require.Contains(t, text, "Item 2")
	})

	t.Run("limits text to 5000 characters", func(t *testing.T) {
		longText := strings.Repeat("a", 6000)
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": longText,
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Equal(t, 5000, len(text))
	})

	t.Run("cleans whitespace", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Text   with    extra     spaces",
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Equal(t, "Text with extra spaces", text)
	})

	t.Run("handles empty content", func(t *testing.T) {
		doc := TipTapDocument{
			Type:    "doc",
			Content: []map[string]any{},
		}

		text := extractSimpleText(doc)
		require.Empty(t, text)
	})

	t.Run("handles mixed content types", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "heading",
					"attrs": map[string]any{
						"level": 1,
					},
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Heading",
						},
					},
				},
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Paragraph text",
						},
					},
				},
				{
					"type": "codeBlock",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "code content",
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Contains(t, text, "Heading")
		require.Contains(t, text, "Paragraph text")
		require.Contains(t, text, "code content")
	})
}

func TestCleanText(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "removes extra spaces",
			input:    "text   with    spaces",
			expected: "text with spaces",
		},
		{
			name:     "removes tabs",
			input:    "text\twith\ttabs",
			expected: "text with tabs",
		},
		{
			name:     "removes newlines",
			input:    "text\nwith\nnewlines",
			expected: "text with newlines",
		},
		{
			name:     "trims leading and trailing whitespace",
			input:    "  text  ",
			expected: "text",
		},
		{
			name:     "handles mixed whitespace",
			input:    "  text  \n\t  with   \t\n mixed \n\n whitespace  ",
			expected: "text with mixed whitespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cleanText(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExtractTextFromNode(t *testing.T) {
	t.Run("extracts text from text node", func(t *testing.T) {
		node := map[string]any{
			"type": "text",
			"text": "Hello world",
		}

		text := extractTextFromNode(node)
		require.Equal(t, "Hello world", text)
	})

	t.Run("extracts text from node with children", func(t *testing.T) {
		node := map[string]any{
			"type": "paragraph",
			"content": []any{
				map[string]any{
					"type": "text",
					"text": "First ",
				},
				map[string]any{
					"type": "text",
					"text": "Second",
				},
			},
		}

		text := extractTextFromNode(node)
		require.Contains(t, text, "First")
		require.Contains(t, text, "Second")
	})

	t.Run("handles deeply nested nodes", func(t *testing.T) {
		node := map[string]any{
			"type": "listItem",
			"content": []any{
				map[string]any{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Nested text",
						},
					},
				},
			},
		}

		text := extractTextFromNode(node)
		require.Contains(t, text, "Nested text")
	})

	t.Run("handles node without text or content", func(t *testing.T) {
		node := map[string]any{
			"type": "hardBreak",
		}

		text := extractTextFromNode(node)
		require.Empty(t, text)
	})
}

func TestSanitizeTipTapDocument(t *testing.T) {
	t.Run("escapes HTML in text content", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"<script>alert('xss')</script>"}]}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		textNode := pc.Content.Content[0]["content"].([]any)[0].(map[string]any)
		sanitizedText := textNode["text"].(string)
		require.Contains(t, sanitizedText, "&lt;script&gt;")
		require.Contains(t, sanitizedText, "&lt;/script&gt;")
		require.NotContains(t, sanitizedText, "<script>")
	})

	t.Run("removes javascript URLs from href attributes", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Click me","marks":[{"type":"link","attrs":{"href":"javascript:alert('xss')"}}]}]}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		textNode := pc.Content.Content[0]["content"].([]any)[0].(map[string]any)
		marks := textNode["marks"].([]any)
		mark := marks[0].(map[string]any)
		attrs := mark["attrs"].(map[string]any)
		require.Empty(t, attrs["href"])
	})

	t.Run("removes data URLs from src attributes", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"image","attrs":{"src":"data:text/html,<script>alert('xss')</script>"}}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		imageNode := pc.Content.Content[0]
		attrs := imageNode["attrs"].(map[string]any)
		require.Empty(t, attrs["src"])
	})

	t.Run("allows safe URLs", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Click me","marks":[{"type":"link","attrs":{"href":"https://example.com"}}]}]}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		textNode := pc.Content.Content[0]["content"].([]any)[0].(map[string]any)
		marks := textNode["marks"].([]any)
		mark := marks[0].(map[string]any)
		attrs := mark["attrs"].(map[string]any)
		require.Equal(t, "https://example.com", attrs["href"])
	})

	t.Run("sanitizes nested content", func(t *testing.T) {
		pc := &PageContent{
			PageId: NewId(),
		}

		jsonStr := `{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"<img src=x onerror=alert('xss')>"}]}]}]}]}`
		err := pc.SetDocumentJSON(jsonStr)
		require.NoError(t, err)

		listNode := pc.Content.Content[0]
		listItemNode := listNode["content"].([]any)[0].(map[string]any)
		paragraphNode := listItemNode["content"].([]any)[0].(map[string]any)
		textNode := paragraphNode["content"].([]any)[0].(map[string]any)
		sanitizedText := textNode["text"].(string)
		require.Contains(t, sanitizedText, "&lt;img")
		require.NotContains(t, sanitizedText, "<img")
	})
}
