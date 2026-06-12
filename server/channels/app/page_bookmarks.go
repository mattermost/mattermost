// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateBookmarkFromPage creates a channel bookmark that links to a page.
func (a *App) CreateBookmarkFromPage(rctx request.CTX, page *model.Post, channelId string, displayName string, emoji string, connectionId string) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	pageId := page.Id
	post := page

	// Get wikiId from PropertyValues (not from Props)
	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageId)
	if wikiErr != nil {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.page_missing_wiki_id.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
	}
	if wikiId == "" {
		return nil, model.NewAppError("CreateBookmarkFromPage", "app.channel.bookmark.page_missing_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}

	// Get team name from page's backing channel
	pageChannel, channelErr := a.GetWikiBackingChannel(rctx, page.ChannelId)
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
		if utf8.RuneCountInString(displayName) > model.DisplayNameMaxRunes {
			displayName = string([]rune(displayName)[:model.DisplayNameMaxRunes])
		}
	}

	relativePath := model.BuildPageUrl(team.Name, wikiId, pageId)

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
