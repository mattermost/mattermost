// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTipTapMentionParser_ProcessText(t *testing.T) {
	mainHelper.Parallel(t)

	userID1 := model.NewId()
	userID2 := model.NewId()
	userID3 := model.NewId()

	for name, tc := range map[string]struct {
		Content  string
		Keywords map[string][]string
		Expected *MentionResults
	}{
		"Single mention": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" hello"}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Multiple mentions": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" and "},{"type":"mention","attrs":{"id":"` + userID2 + `","label":"@user2"}}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
				"@user2": {userID2},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
					userID2: KeywordMention,
				},
			},
		},
		"Mention not in keywords": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}}]}]}`,
			Keywords: map[string][]string{
				"@user2": {userID2},
			},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"Nested mentions in complex structure": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello "},{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}}]},{"type":"paragraph","content":[{"type":"text","text":"and "},{"type":"mention","attrs":{"id":"` + userID2 + `","label":"@user2"}}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
				"@user2": {userID2},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
					userID2: KeywordMention,
				},
			},
		},
		"Duplicate mentions same user": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" and "},{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Empty content": {
			Content:  `{"type":"doc","content":[]}`,
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"No mentions in content": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"Mention with empty attrs": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"","label":"@empty"}}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"Mention with no attrs": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention"}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"Mixed mentions some in keywords some not": {
			Content: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" "},{"type":"mention","attrs":{"id":"` + userID3 + `","label":"@user3"}}]}]}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
				"@user2": {userID2},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			parser := makeTipTapMentionParser(mapsToMentionKeywords(tc.Keywords, nil))
			parser.ProcessText(tc.Content)

			result := parser.Results()
			assert.Equal(t, tc.Expected.Mentions, result.Mentions)
		})
	}
}

func TestTipTapMentionParser_InvalidJSON(t *testing.T) {
	mainHelper.Parallel(t)

	userID1 := model.NewId()

	for name, tc := range map[string]struct {
		Content  string
		Keywords map[string][]string
	}{
		"Invalid JSON": {
			Content: `{invalid json}`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
		},
		"Malformed JSON structure": {
			Content: `{"type":"doc"`,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
		},
		"Empty string": {
			Content: ``,
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			parser := makeTipTapMentionParser(mapsToMentionKeywords(tc.Keywords, nil))
			parser.ProcessText(tc.Content)

			result := parser.Results()
			assert.Nil(t, result.Mentions)
		})
	}
}

func TestGetExplicitMentionsFromPage(t *testing.T) {
	mainHelper.Parallel(t)

	userID1 := model.NewId()
	userID2 := model.NewId()

	for name, tc := range map[string]struct {
		Post     *model.Post
		Keywords map[string][]string
		Expected *MentionResults
	}{
		"Page with single mention": {
			Post: &model.Post{
				Message: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" check this"}]}]}`,
			},
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Page with multiple mentions": {
			Post: &model.Post{
				Message: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + userID1 + `","label":"@user1"}},{"type":"text","text":" and "},{"type":"mention","attrs":{"id":"` + userID2 + `","label":"@user2"}}]}]}`,
			},
			Keywords: map[string][]string{
				"@user1": {userID1},
				"@user2": {userID2},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
					userID2: KeywordMention,
				},
			},
		},
		"Page with no mentions": {
			Post: &model.Post{
				Message: `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"No mentions here"}]}]}`,
			},
			Keywords: map[string][]string{
				"@user1": {userID1},
			},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			result := getExplicitMentionsFromPage(tc.Post, mapsToMentionKeywords(tc.Keywords, nil))

			require.NotNil(t, result)
			assert.Equal(t, tc.Expected.Mentions, result.Mentions)
		})
	}
}

func TestTipTapMentionParser_ImplementsMentionParserInterface(t *testing.T) {
	keywords := make(MentionKeywords)
	parser := makeTipTapMentionParser(keywords)

	var _ MentionParser = parser

	assert.NotNil(t, parser)
	assert.NotNil(t, parser.Results())
}
