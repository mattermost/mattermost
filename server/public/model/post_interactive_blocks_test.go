// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollectMmBlockActionIDs(t *testing.T) {
	blocks := []any{
		map[string]any{"type": "text", "text": "hi"},
		map[string]any{
			"type": "container",
			"content": []any{
				map[string]any{"type": "button", "text": "A", "action_id": "a1"},
				map[string]any{"type": "static_select", "action_id": "s1", "placeholder": "pick"},
			},
		},
	}
	ids := CollectMmBlockActionIDs(blocks)
	assert.Equal(t, map[string]struct{}{"a1": {}, "s1": {}}, ids)
}

func TestCollectMmBlockActionIDs_columnSet(t *testing.T) {
	blocks := []any{
		map[string]any{
			"type": "column_set",
			"columns": []any{
				map[string]any{
					"type": "column",
					"items": []any{
						map[string]any{"type": "button", "text": "A", "action_id": "inset"},
					},
				},
				map[string]any{
					"type": "text",
					"text": "not a column",
				},
			},
		},
		map[string]any{
			"type": "column",
			"items": []any{
				map[string]any{"type": "button", "text": "B", "action_id": "orphan"},
			},
		},
	}
	ids := CollectMmBlockActionIDs(blocks)
	assert.Equal(t, map[string]struct{}{"inset": {}}, ids)
}

func TestSubsetMmBlocksActions(t *testing.T) {
	all := map[string]any{
		"a1": map[string]any{"type": "external", "url": "http://example.com/a"},
		"b2": map[string]any{"type": "external", "url": "http://example.com/b"},
	}
	subset := SubsetMmBlocksActions(all, map[string]struct{}{"a1": {}})
	require.Len(t, subset, 1)
	assert.Contains(t, subset, "a1")
}

func TestValidateMmBlocksActionsForWebhook(t *testing.T) {
	blocks := []any{
		map[string]any{"type": "button", "text": "Go", "action_id": "act"},
	}
	require.Error(t, ValidateMmBlocksActionsForWebhook(blocks, nil))
	require.Error(t, ValidateMmBlocksActionsForWebhook(nil, map[string]any{"act": map[string]any{}}))
	require.NoError(t, ValidateMmBlocksActionsForWebhook(blocks, map[string]any{
		"act": map[string]any{"type": "external", "url": "http://example.com"},
	}))
}

func TestCollectMmactionIDsFromMmBlockText(t *testing.T) {
	blocks := []any{
		map[string]any{
			"type": "text",
			"text": "Choose [one](mmaction://pick1) or [two](mmaction://pick2)",
		},
	}
	ids := CollectMmBlockActionIDs(blocks)
	assert.Equal(t, map[string]struct{}{"pick1": {}, "pick2": {}}, ids)
}

func TestCollectMmactionIDsFromText_skipsCode(t *testing.T) {
	ids := CollectMmactionIDsFromText("Use [real](mmaction://real1) not `mmaction://inline`")
	assert.Equal(t, map[string]struct{}{"real1": {}}, ids)

	ids = CollectMmactionIDsFromText("```\n[mmaction://fence](mmaction://fence)\n```\n[ok](mmaction://ok1)")
	assert.Equal(t, map[string]struct{}{"ok1": {}}, ids)
}

func TestCollectBlockKitActionIDs(t *testing.T) {
	blocks := []any{
		map[string]any{
			"type": "section",
			"text": map[string]any{"type": "mrkdwn", "text": "[Go](mmaction://md1)"},
			"accessory": map[string]any{
				"type": "button", "text": map[string]any{"type": "plain_text", "text": "Btn"},
				"action_id": "acc1",
			},
		},
		map[string]any{
			"type": "actions",
			"elements": []any{
				map[string]any{
					"type":      "button",
					"text":      map[string]any{"type": "plain_text", "text": "OK"},
					"action_id": "row1",
				},
			},
		},
	}
	ids := CollectBlockKitActionIDs(blocks)
	assert.Equal(t, map[string]struct{}{"md1": {}, "acc1": {}, "row1": {}}, ids)
}

func TestCollectAdaptiveCardActionIDs(t *testing.T) {
	cards := []any{
		map[string]any{
			"type": "AdaptiveCard",
			"body": []any{
				map[string]any{"type": "TextBlock", "text": "See [here](mmaction://cardmd)"},
				map[string]any{
					"type": "ActionSet",
					"actions": []any{
						map[string]any{"type": "Action.Submit", "title": "OK", "id": "submit1"},
					},
				},
			},
			"actions": []any{
				map[string]any{"type": "Action.Submit", "title": "Footer", "id": "footer1"},
			},
		},
	}
	ids := CollectAdaptiveCardActionIDs(cards)
	assert.Equal(t, map[string]struct{}{"cardmd": {}, "submit1": {}, "footer1": {}}, ids)
}

func TestValidateMmBlocksActions_pairing(t *testing.T) {
	post := &Post{
		Props: map[string]any{
			PostPropsMmBlocks: []any{
				map[string]any{"type": "button", "text": "Go", "action_id": "act"},
			},
			PostPropsMmBlocksActions: map[string]any{
				"act": map[string]any{"type": "external", "url": "http://example.com"},
			},
		},
	}
	require.NoError(t, ValidateMmBlocksActions(post))

	extra := post.Clone()
	extraProps := extra.GetProps()
	extraProps[PostPropsMmBlocksActions] = map[string]any{
		"act":   map[string]any{"type": "external", "url": "http://example.com"},
		"extra": map[string]any{"type": "external", "url": "http://example.com/2"},
	}
	extra.SetProps(extraProps)
	require.Error(t, ValidateMmBlocksActions(extra))
}

func TestValidateInteractiveActionsForWebhook_messageMmaction(t *testing.T) {
	post := &Post{
		Message: "Click [go](mmaction://go1)",
		Props: map[string]any{
			PostPropsMmBlocksActions: map[string]any{
				"go1": map[string]any{"type": "external", "url": "http://example.com"},
			},
		},
	}
	require.NoError(t, ValidateInteractiveActionsForWebhook(post))

	postMissing := &Post{Message: "Click [go](mmaction://go1)"}
	require.Error(t, ValidateInteractiveActionsForWebhook(postMissing))
}

func TestPost_InteractiveBlocksImageURLs(t *testing.T) {
	assert.Nil(t, (&Post{}).InteractiveBlocksImageURLs())

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
			PostPropsAttachments: []*MessageAttachment{
				{
					ImageURL:   "https://example.com/attach_main.png",
					ThumbURL:   "https://example.com/attach_thumb.png",
					AuthorIcon: "https://example.com/attach_author.png",
					FooterIcon: "https://example.com/attach_footer.png",
				},
				{ImageURL: "https://example.com/attach_second.png"},
				nil,
				{Text: "no images"},
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
		"https://example.com/attach_main.png",
		"https://example.com/attach_thumb.png",
		"https://example.com/attach_author.png",
		"https://example.com/attach_footer.png",
		"https://example.com/attach_second.png",
	}, urls)
}
