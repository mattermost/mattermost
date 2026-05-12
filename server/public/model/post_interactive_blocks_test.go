// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPost_InteractiveBlocksImageURLs(t *testing.T) {
	post := &Post{
		Props: StringInterface{
			PostPropsMmBlocks: []any{
				map[string]any{
					"type": "text",
					"text": "x ![a](https://example.com/md.png)",
				},
				map[string]any{
					"type": "image",
					"url":  "https://example.com/mm_direct1.png",
				},
				map[string]any{
					"type": "image",
					"url":  "https://example.com/mm_direct2.png",
				},
				map[string]any{
					"type": "container",
					"content": []any{
						map[string]any{
							"type": "image",
							"url":  "https://example.com/mm_nested.png",
						},
						map[string]any{
							"type": "image",
							"url":  "https://example.com/mm_nested2.png",
						},
					},
				},
			},
			PostPropsBlockKitBlocks: []any{
				map[string]any{
					"type":      "image",
					"image_url": "https://example.com/bk_top1.png",
				},
				map[string]any{
					"type":      "image",
					"image_url": "https://example.com/bk_top2.png",
				},
				map[string]any{
					"type": "section",
					"text": map[string]any{
						"type": "plain_text",
						"text": "caption",
					},
					"accessory": map[string]any{
						"type":      "image",
						"image_url": "https://example.com/bk_accessory.png",
					},
				},
			},
			PostPropsAdaptiveCards: []any{
				map[string]any{
					"type": "AdaptiveCard",
					"body": []any{
						map[string]any{
							"type": "Image",
							"url":  "https://example.com/ac_card1_a.png",
						},
						map[string]any{
							"type": "Image",
							"url":  "https://example.com/ac_card1_b.png",
						},
					},
				},
				map[string]any{
					"type": "AdaptiveCard",
					"body": []any{
						map[string]any{
							"type": "Image",
							"url":  "https://example.com/ac_card2.png",
						},
					},
				},
			},
		},
	}

	urls := post.InteractiveBlocksImageURLs()

	// Markdown images inside text blocks are not returned here; they are gathered with Post.AllStrings in getEmbedsAndImages.
	assert.ElementsMatch(t, []string{
		"https://example.com/mm_direct1.png",
		"https://example.com/mm_direct2.png",
		"https://example.com/mm_nested.png",
		"https://example.com/mm_nested2.png",
		"https://example.com/bk_top1.png",
		"https://example.com/bk_top2.png",
		"https://example.com/bk_accessory.png",
		"https://example.com/ac_card1_a.png",
		"https://example.com/ac_card1_b.png",
		"https://example.com/ac_card2.png",
	}, urls)
}
