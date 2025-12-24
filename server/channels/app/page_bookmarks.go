// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateBookmarkFromPage creates a channel bookmark that links to a page.
// Accepts a type-safe *Page that has already been validated.
func (a *App) CreateBookmarkFromPage(rctx request.CTX, page *Page, channelId string, displayName string, emoji string, connectionId string) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	pageId := page.Id()
	post := page.Post()

	// Cross-channel permission check: user must have read access to page's channel
	if !a.SessionHasPermissionToChannel(rctx, *rctx.Session(), page.ChannelId(), model.PermissionReadChannel) {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.no_permission_to_page_channel.app_error", nil, "", http.StatusForbidden)
	}

	// Get wikiId from PropertyValues (not from Props)
	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageId)
	if wikiErr != nil {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.page_missing_wiki_id.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
	}
	if wikiId == "" {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.page_missing_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	// Get team name from page's channel
	pageChannel, channelErr := a.GetChannel(rctx, page.ChannelId())
	if channelErr != nil {
		return nil, channelErr
	}

	team, teamErr := a.GetTeam(pageChannel.TeamId)
	if teamErr != nil {
		return nil, teamErr
	}

	// Use page title as display name if not provided
	if displayName == "" {
		displayName = post.GetPageTitle()
		if len(displayName) > model.DisplayNameMaxRunes {
			displayName = displayName[:model.DisplayNameMaxRunes]
		}
	}

	// Build internal page URL (relative path)
	relativePath := model.BuildPageUrl(team.Name, page.ChannelId(), wikiId, pageId)

	// Convert to absolute URL using site URL
	if a.Config().ServiceSettings.SiteURL == nil || *a.Config().ServiceSettings.SiteURL == "" {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.site_url_required.app_error", nil, "", http.StatusInternalServerError)
	}
	siteURL := *a.Config().ServiceSettings.SiteURL
	pageUrl := siteURL + relativePath

	// Create bookmark
	bookmark := &model.ChannelBookmark{
		ChannelId:   channelId,
		OwnerId:     rctx.Session().UserId,
		LinkUrl:     pageUrl,
		DisplayName: displayName,
		Emoji:       emoji,
		Type:        model.ChannelBookmarkLink,
		SortOrder:   0,
	}

	return a.CreateChannelBookmark(rctx, bookmark, connectionId)
}
