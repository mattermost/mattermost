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

func TestBuildSearchText(t *testing.T) {
	t.Run("extracts search text from content", func(t *testing.T) {
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
		}

		text := BuildSearchText(doc)
		require.NotEmpty(t, text)
		require.Contains(t, text, "My Heading")
		require.Contains(t, text, "First paragraph")
		require.Contains(t, text, "bold text")
		require.Contains(t, text, "Second paragraph")
	})

	t.Run("handles content-only pages", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Page content without title",
						},
					},
				},
			},
		}

		text := BuildSearchText(doc)
		require.Equal(t, "Page content without title", text)
	})
}

func TestParseTipTapDocument(t *testing.T) {
	t.Run("parses valid JSON", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)
		require.Equal(t, "doc", doc.Type)
		require.Len(t, doc.Content, 1)
	})

	t.Run("handles empty JSON string", func(t *testing.T) {
		doc, err := ParseTipTapDocument("")
		require.NoError(t, err)
		require.Equal(t, "doc", doc.Type)
		require.Empty(t, doc.Content)
	})

	t.Run("returns error for invalid JSON", func(t *testing.T) {
		_, err := ParseTipTapDocument("invalid json")
		require.Error(t, err)
	})

	t.Run("sanitizes javascript URLs", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Click me","marks":[{"type":"link","attrs":{"href":"javascript:alert('xss')"}}]}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		textNode := doc.Content[0]["content"].([]any)[0].(map[string]any)
		marks := textNode["marks"].([]any)
		mark := marks[0].(map[string]any)
		attrs := mark["attrs"].(map[string]any)
		require.Empty(t, attrs["href"])
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

	t.Run("does not truncate text for complete search coverage", func(t *testing.T) {
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
		require.Equal(t, 6000, len(text))
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

	t.Run("extracts text from user mention node with label", func(t *testing.T) {
		node := map[string]any{
			"type": "mention",
			"attrs": map[string]any{
				"id":    "user123",
				"label": "john.doe",
			},
		}

		text := extractTextFromNode(node)
		require.Equal(t, "@john.doe", text)
	})

	t.Run("extracts text from user mention node with id fallback", func(t *testing.T) {
		node := map[string]any{
			"type": "mention",
			"attrs": map[string]any{
				"id": "user123",
			},
		}

		text := extractTextFromNode(node)
		require.Equal(t, "@user123", text)
	})

	t.Run("extracts text from channel mention node", func(t *testing.T) {
		node := map[string]any{
			"type": "channelMention",
			"attrs": map[string]any{
				"id":              "channel123",
				"label":           "general",
				"data-channel-id": "channel123",
			},
		}

		text := extractTextFromNode(node)
		require.Equal(t, "@general", text)
	})
}

func TestExtractSimpleTextWithMentions(t *testing.T) {
	t.Run("extracts mentions from document with mixed content", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Hello ",
						},
						map[string]any{
							"type": "mention",
							"attrs": map[string]any{
								"id":    "user123",
								"label": "john",
							},
						},
						map[string]any{
							"type": "text",
							"text": " how are you?",
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Contains(t, text, "Hello")
		require.Contains(t, text, "@john")
		require.Contains(t, text, "how are you?")
	})

	t.Run("extracts multiple mentions from document", func(t *testing.T) {
		doc := TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "CC ",
						},
						map[string]any{
							"type": "mention",
							"attrs": map[string]any{
								"id":    "user1",
								"label": "alice",
							},
						},
						map[string]any{
							"type": "text",
							"text": " and ",
						},
						map[string]any{
							"type": "mention",
							"attrs": map[string]any{
								"id":    "user2",
								"label": "bob",
							},
						},
					},
				},
			},
		}

		text := extractSimpleText(doc)
		require.Contains(t, text, "@alice")
		require.Contains(t, text, "@bob")
	})
}

func TestSanitizeTipTapDocument(t *testing.T) {
	t.Run("preserves text content without HTML escaping", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test & verify <tags>"}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		textNode := doc.Content[0]["content"].([]any)[0].(map[string]any)
		text := textNode["text"].(string)
		require.Equal(t, "Test & verify <tags>", text)
	})

	t.Run("removes javascript URLs from href attributes", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Click me","marks":[{"type":"link","attrs":{"href":"javascript:alert('xss')"}}]}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		textNode := doc.Content[0]["content"].([]any)[0].(map[string]any)
		marks := textNode["marks"].([]any)
		mark := marks[0].(map[string]any)
		attrs := mark["attrs"].(map[string]any)
		require.Empty(t, attrs["href"])
	})

	t.Run("removes data URLs from src attributes", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"image","attrs":{"src":"data:text/html,<script>alert('xss')</script>"}}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		imageNode := doc.Content[0]
		attrs := imageNode["attrs"].(map[string]any)
		require.Empty(t, attrs["src"])
	})

	t.Run("allows safe URLs", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Click me","marks":[{"type":"link","attrs":{"href":"https://example.com"}}]}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		textNode := doc.Content[0]["content"].([]any)[0].(map[string]any)
		marks := textNode["marks"].([]any)
		mark := marks[0].(map[string]any)
		attrs := mark["attrs"].(map[string]any)
		require.Equal(t, "https://example.com", attrs["href"])
	})

	t.Run("preserves text in nested content", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item with & symbol"}]}]}]}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		listNode := doc.Content[0]
		listItemNode := listNode["content"].([]any)[0].(map[string]any)
		paragraphNode := listItemNode["content"].([]any)[0].(map[string]any)
		textNode := paragraphNode["content"].([]any)[0].(map[string]any)
		text := textNode["text"].(string)
		require.Equal(t, "Item with & symbol", text)
	})

	t.Run("blocks SVG data URIs to prevent XSS", func(t *testing.T) {
		jsonStr := `{"type":"doc","content":[{"type":"image","attrs":{"src":"data:image/svg+xml,<svg onload='alert(1)'></svg>"}}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		imageNode := doc.Content[0]
		attrs := imageNode["attrs"].(map[string]any)
		require.Empty(t, attrs["src"], "SVG data URIs should be blocked")
	})

	t.Run("allows safe raster image data URIs", func(t *testing.T) {
		pngDataURI := "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
		jsonStr := `{"type":"doc","content":[{"type":"image","attrs":{"src":"` + pngDataURI + `"}}]}`
		doc, err := ParseTipTapDocument(jsonStr)
		require.NoError(t, err)

		imageNode := doc.Content[0]
		attrs := imageNode["attrs"].(map[string]any)
		require.Equal(t, pngDataURI, attrs["src"], "PNG data URIs should be allowed")
	})
}

func TestValidateTipTapDocument(t *testing.T) {
	t.Run("valid document", func(t *testing.T) {
		err := ValidateTipTapDocument(`{"type":"doc","content":[]}`)
		require.NoError(t, err)
	})

	t.Run("empty string is valid", func(t *testing.T) {
		err := ValidateTipTapDocument("")
		require.NoError(t, err)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		err := ValidateTipTapDocument("not json")
		require.Error(t, err)
	})

	t.Run("wrong type field", func(t *testing.T) {
		err := ValidateTipTapDocument(`{"type":"paragraph","content":[]}`)
		require.Error(t, err)
	})
}

func TestTipTapDocumentScanValue(t *testing.T) {
	t.Run("scan from bytes", func(t *testing.T) {
		var doc TipTapDocument
		jsonBytes := []byte(`{"type":"doc","content":[{"type":"paragraph"}]}`)
		err := doc.Scan(jsonBytes)
		require.NoError(t, err)
		require.Equal(t, "doc", doc.Type)
		require.Len(t, doc.Content, 1)
	})

	t.Run("scan from nil", func(t *testing.T) {
		var doc TipTapDocument
		err := doc.Scan(nil)
		require.NoError(t, err)
		require.Equal(t, TipTapDocType, doc.Type)
		require.Empty(t, doc.Content)
	})

	t.Run("value roundtrip", func(t *testing.T) {
		doc := TipTapDocument{
			Type:    "doc",
			Content: []map[string]any{{"type": "paragraph"}},
		}
		val, err := doc.Value()
		require.NoError(t, err)

		var doc2 TipTapDocument
		err = json.Unmarshal(val.([]byte), &doc2)
		require.NoError(t, err)
		require.Equal(t, doc.Type, doc2.Type)
	})
}
