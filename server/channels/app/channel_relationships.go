// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// channelUrlRegex matches Mattermost channel URLs in various formats:
// - /team-name/channels/channel-name
// - /team-name/channels/channel-id
// - https://example.com/team-name/channels/channel-name
var channelUrlRegex = regexp.MustCompile(`(?:https?://[^/]+)?/([^/]+)/channels/([^/\s\)]+)`)

// ExtractChannelFromUrl parses Mattermost channel URLs and returns the channel.
// It supports:
//   - Relative URLs: /team-name/channels/channel-name
//   - Absolute URLs: https://example.com/team/channels/channel-name
//   - Channel names or channel IDs
//
// If teamId is provided, it will be used to resolve channel names. Otherwise,
// the team name from the URL will be used.
func (a *App) ExtractChannelFromUrl(rctx request.CTX, urlStr string, teamId string) (*model.Channel, error) {
	channelId, err := a.ExtractChannelIdFromUrl(rctx, urlStr, teamId)
	if err != nil {
		return nil, err
	}

	channel, storeErr := a.Srv().Store().Channel().Get(channelId, true)
	if storeErr != nil {
		return nil, fmt.Errorf("channel not found: %s", channelId)
	}

	return channel, nil
}

// ExtractChannelIdFromUrl parses Mattermost channel URLs and returns the channel ID.
// It supports:
//   - Relative URLs: /team-name/channels/channel-name
//   - Absolute URLs: https://example.com/team/channels/channel-name
//   - Channel names or channel IDs
//
// If teamId is provided, it will be used to resolve channel names. Otherwise,
// the team name from the URL will be used.
func (a *App) ExtractChannelIdFromUrl(rctx request.CTX, urlStr string, teamId string) (string, error) {
	// Try to match channel URL pattern
	matches := channelUrlRegex.FindStringSubmatch(urlStr)
	if len(matches) != 3 {
		return "", fmt.Errorf("invalid channel URL format: %s", urlStr)
	}

	teamNameOrId := matches[1]
	channelNameOrId := matches[2]

	// If it looks like a channel ID (26 character alphanumeric), try to get it directly
	if model.IsValidId(channelNameOrId) {
		channel, err := a.Srv().Store().Channel().Get(channelNameOrId, true)
		if err == nil && channel != nil {
			return channel.Id, nil
		}
		// If not found as ID, fall through to try as name
	}

	// Determine the team ID to use for lookup
	var lookupTeamId string
	if teamId != "" {
		lookupTeamId = teamId
	} else {
		// Try to resolve team from URL
		team, err := a.Srv().Store().Team().GetByName(teamNameOrId)
		if err != nil {
			return "", fmt.Errorf("team not found: %s", teamNameOrId)
		}
		lookupTeamId = team.Id
	}

	// Look up channel by name in the team
	channel, err := a.Srv().Store().Channel().GetByName(lookupTeamId, channelNameOrId, true)
	if err != nil {
		return "", fmt.Errorf("channel not found: %s/%s", teamNameOrId, channelNameOrId)
	}

	return channel.Id, nil
}

// SyncBookmarkRelationships scans all bookmarks for a channel and creates/updates relationships.
// This should be called when bookmarks are created, updated, or deleted.
func (a *App) SyncBookmarkRelationships(rctx request.CTX, channelId string) error {
	// Get the channel to determine its team
	channel, err := a.Srv().Store().Channel().Get(channelId, true)
	if err != nil {
		return fmt.Errorf("failed to get channel: %w", err)
	}

	// Delete all existing bookmark relationships for this channel
	if err := a.Srv().Store().ChannelRelationship().DeleteBySourceAndType(channelId, model.ChannelRelationBookmark); err != nil {
		rctx.Logger().Warn("Failed to delete existing bookmark relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	}

	// Get all bookmarks for this channel
	bookmarks, appErr := a.GetChannelBookmarks(channelId, 0)
	if appErr != nil {
		return fmt.Errorf("failed to get bookmarks: %w", appErr)
	}

	// Process each bookmark
	for _, bookmark := range bookmarks {
		if bookmark.Type != model.ChannelBookmarkLink {
			continue
		}

		// Try to extract channel ID from the bookmark URL
		targetChannelId, extractErr := a.ExtractChannelIdFromUrl(rctx, bookmark.LinkUrl, channel.TeamId)
		if extractErr != nil {
			// Not a valid channel URL, skip
			rctx.Logger().Debug("Bookmark URL is not a channel link",
				mlog.String("channel_id", channelId),
				mlog.String("bookmark_id", bookmark.Id),
				mlog.String("url", bookmark.LinkUrl),
			)
			continue
		}

		// Create the relationship
		relationship := &model.ChannelRelationship{
			SourceChannelId:  channelId,
			TargetChannelId:  targetChannelId,
			RelationshipType: model.ChannelRelationBookmark,
			Metadata: map[string]any{
				"bookmark_id": bookmark.Id,
			},
		}

		relationship.PreSave()

		if err := relationship.IsValid(); err != nil {
			rctx.Logger().Warn("Invalid channel relationship",
				mlog.String("channel_id", channelId),
				mlog.String("target_channel_id", targetChannelId),
				mlog.Err(err),
			)
			continue
		}

		if _, saveErr := a.Srv().Store().ChannelRelationship().Save(relationship); saveErr != nil {
			rctx.Logger().Warn("Failed to save bookmark relationship",
				mlog.String("channel_id", channelId),
				mlog.String("target_channel_id", targetChannelId),
				mlog.Err(saveErr),
			)
		}
	}

	return nil
}

// SyncHeaderRelationships extracts channel mentions from the header and creates/updates relationships.
// This should be called when a channel's header is updated.
func (a *App) SyncHeaderRelationships(rctx request.CTX, channelId string, header string) error {
	// Get the channel to determine its team
	channel, err := a.Srv().Store().Channel().Get(channelId, true)
	if err != nil {
		return fmt.Errorf("failed to get channel: %w", err)
	}

	// Delete all existing mention and link relationships for this channel
	if err := a.Srv().Store().ChannelRelationship().DeleteBySourceAndType(channelId, model.ChannelRelationMention); err != nil {
		rctx.Logger().Warn("Failed to delete existing mention relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	}
	if err := a.Srv().Store().ChannelRelationship().DeleteBySourceAndType(channelId, model.ChannelRelationLink); err != nil {
		rctx.Logger().Warn("Failed to delete existing link relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	}

	// Extract channel mentions using existing utility
	channelMentions := model.ChannelMentions(header)
	for _, mention := range channelMentions {
		// Look up the mentioned channel by name
		targetChannel, lookupErr := a.Srv().Store().Channel().GetByName(channel.TeamId, mention, true)
		if lookupErr != nil {
			rctx.Logger().Debug("Mentioned channel not found",
				mlog.String("channel_id", channelId),
				mlog.String("mention", mention),
			)
			continue
		}

		// Create the relationship
		relationship := &model.ChannelRelationship{
			SourceChannelId:  channelId,
			TargetChannelId:  targetChannel.Id,
			RelationshipType: model.ChannelRelationMention,
			Metadata: map[string]any{
				"mention": mention,
			},
		}

		relationship.PreSave()

		if err := relationship.IsValid(); err != nil {
			rctx.Logger().Warn("Invalid channel relationship",
				mlog.String("channel_id", channelId),
				mlog.String("target_channel_id", targetChannel.Id),
				mlog.Err(err),
			)
			continue
		}

		if _, saveErr := a.Srv().Store().ChannelRelationship().Save(relationship); saveErr != nil {
			rctx.Logger().Warn("Failed to save mention relationship",
				mlog.String("channel_id", channelId),
				mlog.String("target_channel_id", targetChannel.Id),
				mlog.Err(saveErr),
			)
		}
	}

	// Extract channel links from markdown links
	if err := a.syncHeaderLinkRelationships(rctx, channel, header); err != nil {
		rctx.Logger().Warn("Failed to sync header link relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	}

	return nil
}

// syncHeaderLinkRelationships extracts markdown links that point to channels.
func (a *App) syncHeaderLinkRelationships(rctx request.CTX, channel *model.Channel, header string) error {
	// Regex to match markdown links: [text](url)
	markdownLinkRegex := regexp.MustCompile(`\[([^\]]+)\]\(([^)]+)\)`)
	matches := markdownLinkRegex.FindAllStringSubmatch(header, -1)

	for _, match := range matches {
		if len(match) != 3 {
			continue
		}

		linkUrl := match[2]

		// Parse the URL to see if it's a channel link
		parsedUrl, parseErr := url.Parse(linkUrl)
		if parseErr != nil {
			continue
		}

		// Check if it's a relative or absolute Mattermost channel URL
		targetChannelId, extractErr := a.ExtractChannelIdFromUrl(rctx, linkUrl, channel.TeamId)
		if extractErr != nil {
			// Not a channel link, skip
			continue
		}

		// Create the relationship
		relationship := &model.ChannelRelationship{
			SourceChannelId:  channel.Id,
			TargetChannelId:  targetChannelId,
			RelationshipType: model.ChannelRelationLink,
			Metadata: map[string]any{
				"url":  linkUrl,
				"text": match[1],
				"host": parsedUrl.Host,
			},
		}

		relationship.PreSave()

		if err := relationship.IsValid(); err != nil {
			rctx.Logger().Warn("Invalid channel relationship",
				mlog.String("channel_id", channel.Id),
				mlog.String("target_channel_id", targetChannelId),
				mlog.Err(err),
			)
			continue
		}

		if _, saveErr := a.Srv().Store().ChannelRelationship().Save(relationship); saveErr != nil {
			rctx.Logger().Warn("Failed to save link relationship",
				mlog.String("channel_id", channel.Id),
				mlog.String("target_channel_id", targetChannelId),
				mlog.Err(saveErr),
			)
		}
	}

	return nil
}

// GetRelatedChannels returns all channels related to the given channel (both directions).
// It filters the results based on user permissions - only returns channels the user can access.
func (a *App) GetRelatedChannels(rctx request.CTX, channelId string, userId string) (*model.GetRelatedChannelsResponse, *model.AppError) {
	// Get relationships where this channel is the source
	outgoingRels, err := a.Srv().Store().ChannelRelationship().GetBySourceChannel(channelId)
	if err != nil {
		return nil, model.NewAppError("GetRelatedChannels", "app.channel.get_relationships.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Get relationships where this channel is the target
	incomingRels, err := a.Srv().Store().ChannelRelationship().GetByTargetChannel(channelId)
	if err != nil {
		return nil, model.NewAppError("GetRelatedChannels", "app.channel.get_relationships.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Combine relationships and deduplicate
	allRelationships := append(outgoingRels, incomingRels...)
	relationshipMap := make(map[string]*model.ChannelRelationship)
	relatedChannelIds := make(map[string]bool)

	for _, rel := range allRelationships {
		// Create a unique key for deduplication
		var key string
		if rel.SourceChannelId == channelId {
			key = fmt.Sprintf("%s_%s_%s", rel.SourceChannelId, rel.TargetChannelId, rel.RelationshipType)
			relatedChannelIds[rel.TargetChannelId] = true
		} else {
			key = fmt.Sprintf("%s_%s_%s", rel.TargetChannelId, rel.SourceChannelId, rel.RelationshipType)
			relatedChannelIds[rel.SourceChannelId] = true
		}

		if _, exists := relationshipMap[key]; !exists {
			relationshipMap[key] = rel
		}
	}

	// Convert map back to slice
	relationships := make([]*model.ChannelRelationship, 0, len(relationshipMap))
	for _, rel := range relationshipMap {
		relationships = append(relationships, rel)
	}

	// Get all related channel IDs as a slice
	channelIds := make([]string, 0, len(relatedChannelIds))
	for id := range relatedChannelIds {
		channelIds = append(channelIds, id)
	}

	// Fetch channel data for all related channels
	channels := make(map[string]*model.Channel)
	if len(channelIds) > 0 {
		channelList, err := a.Srv().Store().Channel().GetChannelsByIds(channelIds, false)
		if err != nil {
			return nil, model.NewAppError("GetRelatedChannels", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// Filter channels based on user permissions
		for _, ch := range channelList {
			// Check if user has permission to read this channel
			if !a.HasPermissionToChannel(rctx, userId, ch.Id, model.PermissionReadChannel) {
				// Remove relationships to this channel
				filteredRelationships := make([]*model.ChannelRelationship, 0, len(relationships))
				for _, rel := range relationships {
					if rel.SourceChannelId != ch.Id && rel.TargetChannelId != ch.Id {
						filteredRelationships = append(filteredRelationships, rel)
					}
				}
				relationships = filteredRelationships
				continue
			}

			channels[ch.Id] = ch
		}
	}

	// Build response with relationships and channel data
	relationshipsWithChannel := make(model.ChannelRelationshipWithChannelList, 0, len(relationships))
	for _, rel := range relationships {
		relWithChannel := &model.ChannelRelationshipWithChannel{
			ChannelRelationship: rel,
		}

		// Add the related channel (either source or target, whichever isn't the requested channel)
		var relatedChannelId string
		if rel.SourceChannelId == channelId {
			relatedChannelId = rel.TargetChannelId
		} else {
			relatedChannelId = rel.SourceChannelId
		}

		if ch, exists := channels[relatedChannelId]; exists {
			relWithChannel.Channel = ch
		}

		relationshipsWithChannel = append(relationshipsWithChannel, relWithChannel)
	}

	response := &model.GetRelatedChannelsResponse{
		Relationships: relationshipsWithChannel,
		TotalCount:    int64(len(relationshipsWithChannel)),
	}

	return response, nil
}

// CleanupChannelRelationships removes all relationships for a channel.
// This should be called when a channel is deleted.
func (a *App) CleanupChannelRelationships(rctx request.CTX, channelId string) error {
	// Get all relationships where this channel is involved (source or target)
	sourceRels, err := a.Srv().Store().ChannelRelationship().GetBySourceChannel(channelId)
	if err != nil {
		rctx.Logger().Warn("Failed to get source relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	} else {
		// Delete each relationship
		for _, rel := range sourceRels {
			if deleteErr := a.Srv().Store().ChannelRelationship().Delete(rel.Id); deleteErr != nil {
				rctx.Logger().Warn("Failed to delete relationship",
					mlog.String("channel_id", channelId),
					mlog.String("relationship_id", rel.Id),
					mlog.Err(deleteErr),
				)
			}
		}
	}

	targetRels, err := a.Srv().Store().ChannelRelationship().GetByTargetChannel(channelId)
	if err != nil {
		rctx.Logger().Warn("Failed to get target relationships",
			mlog.String("channel_id", channelId),
			mlog.Err(err),
		)
	} else {
		// Delete each relationship
		for _, rel := range targetRels {
			if deleteErr := a.Srv().Store().ChannelRelationship().Delete(rel.Id); deleteErr != nil {
				rctx.Logger().Warn("Failed to delete relationship",
					mlog.String("channel_id", channelId),
					mlog.String("relationship_id", rel.Id),
					mlog.Err(deleteErr),
				)
			}
		}
	}

	return nil
}

// IsChannelUrl checks if a URL is a Mattermost channel URL.
func IsChannelUrl(urlStr string) bool {
	return channelUrlRegex.MatchString(urlStr)
}

// NormalizeChannelUrl normalizes a channel URL to a consistent format.
// It removes the domain and returns just the path: /team/channels/channel
func NormalizeChannelUrl(urlStr string) string {
	matches := channelUrlRegex.FindStringSubmatch(urlStr)
	if len(matches) != 3 {
		return urlStr
	}

	return fmt.Sprintf("/%s/channels/%s", matches[1], matches[2])
}
