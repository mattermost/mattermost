// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseEmoji(t *testing.T) {
	for name, tc := range map[string]struct {
		Input             string
		Position          int
		ExpectedOk        bool
		ExpectedPosition  int
		ExpectedEmojiName string
	}{
		"just a colon": {
			Input:            ":",
			Position:         0,
			ExpectedOk:       false,
			ExpectedPosition: 0,
		},
		"no closing colon": {
			Input:            ":emoji",
			Position:         0,
			ExpectedOk:       false,
			ExpectedPosition: 0,
		},
		"no closing colon before whitespace": {
			Input:            ":emoji example",
			Position:         0,
			ExpectedOk:       false,
			ExpectedPosition: 0,
		},
		"valid emoji": {
			Input:             ":emoji:",
			Position:          0,
			ExpectedOk:        true,
			ExpectedPosition:  7,
			ExpectedEmojiName: "emoji",
		},
		"valid emoji with punctuation": {
			Input:             ":valid-emoji:",
			Position:          0,
			ExpectedOk:        true,
			ExpectedPosition:  13,
			ExpectedEmojiName: "valid-emoji",
		},
		"valid emoji with text before": {
			Input:             "this is an :emoji:",
			Position:          11,
			ExpectedOk:        true,
			ExpectedPosition:  18,
			ExpectedEmojiName: "emoji",
		},
		"invalid emoji with text before": {
			Input:            "this is not an :emoji",
			Position:         15,
			ExpectedOk:       false,
			ExpectedPosition: 15,
		},
		"valid emoji with text after": {
			Input:             ":emoji: before some text",
			Position:          0,
			ExpectedOk:        true,
			ExpectedPosition:  7,
			ExpectedEmojiName: "emoji",
		},
		"valid emoji with text before and after": {
			Input:             "this is an :emoji: in a sentence",
			Position:          11,
			ExpectedOk:        true,
			ExpectedPosition:  18,
			ExpectedEmojiName: "emoji",
		},
		"multiple emojis 1": {
			Input:             ":multiple: :emojis:",
			Position:          0,
			ExpectedOk:        true,
			ExpectedPosition:  10,
			ExpectedEmojiName: "multiple",
		},
		"multiple emojis 2": {
			Input:             ":multiple: :emojis:",
			Position:          11,
			ExpectedOk:        true,
			ExpectedPosition:  19,
			ExpectedEmojiName: "emojis",
		},
	} {
		t.Run(name, func(t *testing.T) {
			p := newInlineParser(tc.Input, []Range{}, []*ReferenceDefinition{})
			p.raw = tc.Input
			p.position = tc.Position

			ok := p.parseEmoji()

			assert.Equal(t, tc.ExpectedOk, ok)
			assert.Equal(t, tc.ExpectedPosition, p.position)
			if tc.ExpectedOk {
				require.True(t, len(p.inlines) > 0)
				require.IsType(t, &Emoji{}, p.inlines[len(p.inlines)-1])
				assert.Equal(t, tc.ExpectedEmojiName, p.inlines[len(p.inlines)-1].(*Emoji).Name)
			}
		})
	}
}

func TestParseEmojiFull(t *testing.T) {
	// These tests are based on https://github.com/mattermost/commonmark.js/blob/master/test/mattermost.txt

	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		// Valid emojis

		"emoji": {
			Markdown:     "This is an :emoji:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="emoji" data-literal=":emoji:" /></p>`,
		},
		"emoji with underscore": {
			Markdown:     "This is an :emo_ji:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="emo_ji" data-literal=":emo_ji:" /></p>`,
		},
		"emoji with hyphen": {
			Markdown:     "This is an :emo-ji:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="emo-ji" data-literal=":emo-ji:" /></p>`,
		},
		"emoji with numbers": {
			Markdown:     "This is an :emoji123:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="emoji123" data-literal=":emoji123:" /></p>`,
		},
		"emoji in brackets": {
			Markdown:     "This is an (:emoji:)",
			ExpectedHTML: `<p>This is an (<span data-emoji-name="emoji" data-literal=":emoji:" />)</p>`,
		},
		"two emojis without space between": {
			Markdown:     "These are some :emoji1::emoji2:",
			ExpectedHTML: `<p>These are some <span data-emoji-name="emoji1" data-literal=":emoji1:" /><span data-emoji-name="emoji2" data-literal=":emoji2:" /></p>`,
		},
		"two emojis separated by a slash": {
			Markdown:     "These are some :emoji1:/:emoji2:",
			ExpectedHTML: `<p>These are some <span data-emoji-name="emoji1" data-literal=":emoji1:" />/<span data-emoji-name="emoji2" data-literal=":emoji2:" /></p>`,
		},
		"+1 emoji": {
			Markdown:     "This is an :+1:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="+1" data-literal=":+1:" /></p>`,
		},
		"-1 emoji": {
			Markdown:     "This is an :-1:",
			ExpectedHTML: `<p>This is an <span data-emoji-name="-1" data-literal=":-1:" /></p>`,
		},
		"emoji with surrounding words": {
			Markdown:     "This is an :emoji: in a sentence.",
			ExpectedHTML: `<p>This is an <span data-emoji-name="emoji" data-literal=":emoji:" /> in a sentence.</p>`,
		},

		// Invalid emojis

		"incomplete emoji 1": {
			Markdown:     "This is not an :emoji",
			ExpectedHTML: `<p>This is not an :emoji</p>`,
		},
		"incomplete emoji 2": {
			Markdown:     "This is not an emoji:",
			ExpectedHTML: `<p>This is not an emoji:</p>`,
		},
		"invalid emoji with whitespace": {
			Markdown:     "This is not an :emo ji:",
			ExpectedHTML: `<p>This is not an :emo ji:</p>`,
		},
		"invalid emoji with other punctuation": {
			Markdown:     "This is not an :emo'ji:",
			ExpectedHTML: `<p>This is not an :emo'ji:</p>`,
		},
		"invalid emoji due to adjacent text 1": {
			Markdown: "Thisisnotan:emoji:",
			// This differs slightly from our commonmark.js implementation because it doesn't require :// when autolinking
			ExpectedHTML: `<p>Thisisnotan:emoji:</p>`,
		},
		"invalid emoji due to adjacent text 2": {
			Markdown: "This is not an :emoji:isit",
			// This differs slightly from our commonmark.js implementation because it doesn't require :// when autolinking
			ExpectedHTML: `<p>This is not an :emoji:isit</p>`,
		},
		"invalid emoji due to adjacent text 3": {
			Markdown: "This is not an:emoji:isit",
			// This differs slightly from our commonmark.js implementation because it doesn't require :// when autolinking
			ExpectedHTML: `<p>This is not an:emoji:isit</p>`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			actual := RenderHTML(tc.Markdown)

			assert.Equal(t, tc.ExpectedHTML, actual)
		})
	}
}
