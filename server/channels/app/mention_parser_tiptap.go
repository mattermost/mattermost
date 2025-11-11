// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"maps"
	"slices"
)

var _ MentionParser = &TipTapMentionParser{}

type TipTapMentionParser struct {
	keywords MentionKeywords
	results  *MentionResults
}

func makeTipTapMentionParser(keywords MentionKeywords) *TipTapMentionParser {
	return &TipTapMentionParser{
		keywords: keywords,
		results:  &MentionResults{},
	}
}

func (p *TipTapMentionParser) ProcessText(content string) {
	mentionedUserIDs, err := extractMentionsFromTipTapContent(content)
	if err != nil {
		return
	}

	for _, userID := range mentionedUserIDs {
		targetMentionableID := mentionableUserID(userID)

		keywordValues := slices.Collect(maps.Values(p.keywords))
		if slices.ContainsFunc(keywordValues, func(mentionableIDs []MentionableID) bool {
			return slices.Contains(mentionableIDs, targetMentionableID)
		}) {
			p.results.addMention(userID, KeywordMention)
		}
	}
}

func (p *TipTapMentionParser) Results() *MentionResults {
	return p.results
}

func extractMentionsFromTipTapContent(content string) ([]string, error) {
	var doc struct {
		Type    string            `json:"type"`
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		return nil, err
	}

	mentionIDs := make(map[string]bool)
	extractMentionsFromNodes(doc.Content, mentionIDs)

	result := make([]string, 0, len(mentionIDs))
	for id := range mentionIDs {
		result = append(result, id)
	}

	return result, nil
}

func extractMentionsFromNodes(nodes []json.RawMessage, mentionIDs map[string]bool) {
	for _, nodeRaw := range nodes {
		var node struct {
			Type  string `json:"type"`
			Attrs *struct {
				ID string `json:"id"`
			} `json:"attrs,omitempty"`
			Content []json.RawMessage `json:"content,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			continue
		}

		if node.Type == "mention" && node.Attrs != nil && node.Attrs.ID != "" {
			mentionIDs[node.Attrs.ID] = true
		}

		if len(node.Content) > 0 {
			extractMentionsFromNodes(node.Content, mentionIDs)
		}
	}
}
