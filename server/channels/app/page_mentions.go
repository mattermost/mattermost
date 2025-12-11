// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ExtractMentionsFromTipTapContent parses TipTap JSON and extracts user IDs from mention nodes.
// TipTap stores mentions as nodes with type="mention" and attrs.id containing the user ID.
// This is simpler than markdown parsing since IDs are explicit in the structure.
func (a *App) ExtractMentionsFromTipTapContent(content string) ([]string, error) {
	mlog.Trace("extractMentions.parsing", mlog.Int("content_length", len(content)))

	var doc struct {
		Type    string            `json:"type"`
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		mlog.Debug("extractMentions.parse_error", mlog.Err(err))
		return nil, err
	}

	mlog.Trace("extractMentions.parsed", mlog.String("doc_type", doc.Type), mlog.Int("content_nodes", len(doc.Content)))

	mentionIDs := make(map[string]bool)
	a.extractMentionsFromNodes(doc.Content, mentionIDs)

	result := make([]string, 0, len(mentionIDs))
	for id := range mentionIDs {
		result = append(result, id)
	}

	mlog.Debug("extractMentions.complete", mlog.Int("mention_count", len(result)))
	return result, nil
}

// extractMentionsFromNodes recursively walks TipTap JSON nodes to find mentions
func (a *App) extractMentionsFromNodes(nodes []json.RawMessage, mentionIDs map[string]bool) {
	for _, nodeRaw := range nodes {
		var node struct {
			Type  string `json:"type"`
			Attrs *struct {
				ID string `json:"id"`
			} `json:"attrs,omitempty"`
			Content []json.RawMessage `json:"content,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			mlog.Trace("extractMentions.node_parse_error", mlog.Err(err))
			continue
		}

		mlog.Trace("extractMentions.processing_node", mlog.String("node_type", node.Type))

		if node.Type == "mention" && node.Attrs != nil && node.Attrs.ID != "" {
			mlog.Trace("extractMentions.found_mention", mlog.String("user_id", node.Attrs.ID))
			mentionIDs[node.Attrs.ID] = true
		}

		if len(node.Content) > 0 {
			a.extractMentionsFromNodes(node.Content, mentionIDs)
		}
	}
}

// GetPreviouslyNotifiedMentions retrieves the list of users who were previously notified
func (a *App) GetPreviouslyNotifiedMentions(page *model.Post) []string {
	if page.Props == nil {
		return []string{}
	}

	notifiedInterface, exists := page.Props["notified_mentions"]
	if !exists {
		return []string{}
	}

	switch notified := notifiedInterface.(type) {
	case []any:
		result := make([]string, 0, len(notified))
		for _, id := range notified {
			if userID, ok := id.(string); ok {
				result = append(result, userID)
			}
		}
		return result
	case []string:
		return notified
	default:
		return []string{}
	}
}

// SetNotifiedMentions updates the page props with the current list of notified users
func (a *App) SetNotifiedMentions(page *model.Post, userIDs []string) {
	if page.Props == nil {
		page.Props = make(model.StringInterface)
	}
	page.Props["notified_mentions"] = userIDs
}

// CalculateMentionDelta returns users who should be newly notified
func (a *App) CalculateMentionDelta(currentMentions, previouslyNotified []string) []string {
	notifiedMap := make(map[string]bool)
	for _, id := range previouslyNotified {
		notifiedMap[id] = true
	}

	newMentions := make([]string, 0)
	for _, id := range currentMentions {
		if !notifiedMap[id] {
			newMentions = append(newMentions, id)
		}
	}

	return newMentions
}

// handlePageMentions extracts mentions from page content and sends notifications
func (a *App) handlePageMentions(rctx request.CTX, page *model.Post, channelId, content, authorUserID string) {
	rctx.Logger().Debug("handlePageMentions called",
		mlog.String("page_id", page.Id),
		mlog.String("channel_id", channelId),
		mlog.Int("content_length", len(content)))

	if content == "" {
		rctx.Logger().Debug("handlePageMentions: empty content", mlog.String("page_id", page.Id))
		return
	}

	currentMentions, extractErr := a.ExtractMentionsFromTipTapContent(content)
	if extractErr != nil {
		rctx.Logger().Warn("Failed to extract mentions from page content", mlog.String("page_id", page.Id), mlog.Err(extractErr))
		return
	}

	rctx.Logger().Debug("handlePageMentions: extracted current mentions",
		mlog.String("page_id", page.Id),
		mlog.Int("current_mention_count", len(currentMentions)))

	previouslyNotified := a.GetPreviouslyNotifiedMentions(page)

	rctx.Logger().Debug("handlePageMentions: previous notifications",
		mlog.String("page_id", page.Id),
		mlog.Int("previously_notified_count", len(previouslyNotified)))

	newMentions := a.CalculateMentionDelta(currentMentions, previouslyNotified)

	rctx.Logger().Debug("handlePageMentions: calculated delta",
		mlog.String("page_id", page.Id),
		mlog.Int("new_mention_count", len(newMentions)))

	if len(newMentions) == 0 {
		rctx.Logger().Debug("No new mentions to notify", mlog.String("page_id", page.Id))
		return
	}

	channel, chanErr := a.GetChannel(rctx, channelId)
	if chanErr != nil {
		rctx.Logger().Warn("Failed to get channel for mention notifications", mlog.String("channel_id", channelId), mlog.Err(chanErr))
		return
	}

	a.sendPageMentionNotifications(rctx, page, channel, authorUserID, newMentions, content)

	updatedPage := page.Clone()
	a.SetNotifiedMentions(updatedPage, currentMentions)

	if _, updateErr := a.Srv().Store().Post().Update(rctx, updatedPage, page.Clone()); updateErr != nil {
		rctx.Logger().Warn("Failed to update page props with notified mentions",
			mlog.String("page_id", page.Id),
			mlog.Err(updateErr))
	}
}

func (a *App) sendPageMentionNotifications(rctx request.CTX, page *model.Post, channel *model.Channel, authorUserID string, mentionedUserIDs []string, content string) {
	if len(mentionedUserIDs) == 0 {
		rctx.Logger().Debug("No mentions in page", mlog.String("page_id", page.Id))
		return
	}

	user, err := a.GetUser(authorUserID)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for mention notifications",
			mlog.String("user_id", authorUserID),
			mlog.Err(err))
		return
	}

	team, err := a.GetTeam(channel.TeamId)
	if err != nil {
		rctx.Logger().Warn("Failed to get team for mention notifications",
			mlog.String("team_id", channel.TeamId),
			mlog.Err(err))
		return
	}

	if _, err := a.SendNotifications(rctx, page, team, channel, user, nil, true, mentionedUserIDs); err != nil {
		rctx.Logger().Warn("Failed to send mention notifications for page",
			mlog.String("page_id", page.Id),
			mlog.Err(err))
	} else {
		rctx.Logger().Debug("Successfully sent mention notifications for page",
			mlog.String("page_id", page.Id),
			mlog.Int("mention_count", len(mentionedUserIDs)))
	}

	wikiId, wikiIdErr := a.GetWikiIdForPage(rctx, page.Id)
	if wikiIdErr != nil {
		rctx.Logger().Warn("Failed to get wiki ID for page mention channel posts",
			mlog.String("page_id", page.Id),
			mlog.Err(wikiIdErr))
		return
	}

	rctx.Logger().Debug("Starting channel post creation for page mentions",
		mlog.String("page_id", page.Id),
		mlog.String("wiki_id", wikiId),
		mlog.Int("mention_count", len(mentionedUserIDs)))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		rctx.Logger().Warn("Failed to get wiki for page mention channel posts",
			mlog.String("wiki_id", wikiId),
			mlog.Err(wikiErr))
		return
	}

	rctx.Logger().Debug("Checking ShowMentionsInChannelFeed",
		mlog.String("wiki_id", wikiId),
		mlog.Bool("show_mentions", wiki.ShowMentionsInChannelFeed()))

	if !wiki.ShowMentionsInChannelFeed() {
		rctx.Logger().Debug("Wiki has channel feed mentions disabled",
			mlog.String("wiki_id", wikiId))
		return
	}

	rctx.Logger().Debug("Wiki has channel feed mentions enabled, proceeding with post creation",
		mlog.String("wiki_id", wikiId))

	// Batch fetch all mentioned users to avoid N+1 queries
	mentionedUsers, getUsersErr := a.Srv().Store().User().GetProfileByIds(rctx, mentionedUserIDs, nil, false)
	if getUsersErr != nil {
		rctx.Logger().Warn("Failed to batch fetch mentioned users",
			mlog.Err(getUsersErr))
		return
	}

	// Create a map for quick lookup
	mentionedUsersMap := make(map[string]*model.User, len(mentionedUsers))
	for _, u := range mentionedUsers {
		mentionedUsersMap[u.Id] = u
	}

	pageTitle := page.GetProp("title")
	if pageTitle == "" {
		pageTitle = "Untitled"
	}

	rctx.Logger().Debug("Extracting mention context",
		mlog.String("page_id", page.Id),
		mlog.Int("content_length", len(content)))

	for _, mentionedUserID := range mentionedUserIDs {
		mentionedUser, ok := mentionedUsersMap[mentionedUserID]
		if !ok {
			rctx.Logger().Warn("Mentioned user not found in batch fetch",
				mlog.String("user_id", mentionedUserID))
			continue
		}

		mentionContext := a.extractMentionContext(rctx, content, mentionedUserID)

		rctx.Logger().Debug("Extracted mention context",
			mlog.String("mentioned_user_id", mentionedUserID),
			mlog.String("context", mentionContext),
			mlog.Int("context_length", len(mentionContext)))

		teamURL := fmt.Sprintf("/%s", team.Name)
		pageURL := fmt.Sprintf("%s/wiki/%s/%s/%s", teamURL, channel.Id, wikiId, page.Id)
		postMessage := fmt.Sprintf("Mentioned @%s on the page: [%s](%s)\n\n%s",
			mentionedUser.Username,
			pageTitle,
			pageURL,
			mentionContext)

		channelPost := &model.Post{
			UserId:    authorUserID,
			ChannelId: channel.Id,
			Message:   postMessage,
			Type:      model.PostTypePageMention,
			Props: model.StringInterface{
				"page_id":           page.Id,
				"wiki_id":           wikiId,
				"mentioned_user_id": mentionedUserID,
				"username":          mentionedUser.Username,
				"page_title":        pageTitle,
			},
		}

		flags := model.CreatePostFlags{
			TriggerWebhooks: false,
			SetOnline:       true,
		}
		if _, createErr := a.CreatePost(rctx, channelPost, channel, flags); createErr != nil {
			rctx.Logger().Warn("Failed to create page mention channel post",
				mlog.String("page_id", page.Id),
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(createErr))
		}
	}
}

// extractMentionContext extracts the paragraph containing a mention from TipTap JSON content
func (a *App) extractMentionContext(rctx request.CTX, content string, mentionedUserID string) string {
	if content == "" {
		return ""
	}

	var doc struct {
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		rctx.Logger().Warn("Failed to parse TipTap content for mention context",
			mlog.String("mentioned_user_id", mentionedUserID),
			mlog.Err(err))
		return ""
	}

	context := a.findMentionInNodes(rctx, doc.Content, mentionedUserID)
	if context != "" {
		return context
	}

	return ""
}

// findMentionInNodes recursively searches TipTap nodes for a paragraph containing the mention
func (a *App) findMentionInNodes(rctx request.CTX, nodes []json.RawMessage, mentionedUserID string) string {
	for _, nodeRaw := range nodes {
		var node struct {
			Type    string            `json:"type"`
			Content []json.RawMessage `json:"content,omitempty"`
			Attrs   map[string]any    `json:"attrs,omitempty"`
			Text    string            `json:"text,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while searching for mention",
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(err))
			continue
		}

		if node.Type == "paragraph" {
			paragraphText := a.extractTextFromNodes(rctx, node.Content)
			if a.paragraphContainsMention(rctx, node.Content, mentionedUserID) {
				return paragraphText
			}
		}

		if len(node.Content) > 0 {
			if result := a.findMentionInNodes(rctx, node.Content, mentionedUserID); result != "" {
				return result
			}
		}
	}

	return ""
}

// paragraphContainsMention checks if a paragraph contains a mention of the specified user
func (a *App) paragraphContainsMention(rctx request.CTX, nodes []json.RawMessage, mentionedUserID string) bool {
	for _, nodeRaw := range nodes {
		var node struct {
			Type  string         `json:"type"`
			Attrs map[string]any `json:"attrs,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while checking for mention",
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(err))
			continue
		}

		if node.Type == "mention" && node.Attrs != nil {
			if id, ok := node.Attrs["id"].(string); ok && id == mentionedUserID {
				return true
			}
		}
	}

	return false
}

// extractTextFromNodes converts TipTap nodes to plain text
func (a *App) extractTextFromNodes(rctx request.CTX, nodes []json.RawMessage) string {
	var text strings.Builder

	for _, nodeRaw := range nodes {
		var node struct {
			Type    string            `json:"type"`
			Text    string            `json:"text,omitempty"`
			Content []json.RawMessage `json:"content,omitempty"`
			Attrs   map[string]any    `json:"attrs,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while extracting text",
				mlog.Err(err))
			continue
		}

		switch node.Type {
		case "text":
			text.WriteString(node.Text)
		case "mention":
			if node.Attrs != nil {
				if label, ok := node.Attrs["label"].(string); ok {
					text.WriteString(label)
				}
			}
		case "hardBreak":
			text.WriteString("\n")
		default:
			if len(node.Content) > 0 {
				text.WriteString(a.extractTextFromNodes(rctx, node.Content))
			}
		}
	}

	return text.String()
}

func getExplicitMentionsFromPage(post *model.Post, keywords MentionKeywords) *MentionResults {
	parser := makeTipTapMentionParser(keywords)
	parser.ProcessText(post.Message)
	return parser.Results()
}
