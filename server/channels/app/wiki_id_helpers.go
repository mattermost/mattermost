// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetWikiIdForPage(rctx request.CTX, pageId string) (string, *model.AppError) {
	post, err := a.GetPage(rctx, pageId)
	if err != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.page_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Fast path: wiki_id cached in Props by setWikiIdInPostProps
	if wikiId, ok := post.Props[model.PagePropsWikiID].(string); ok && wikiId != "" {
		return wikiId, nil
	}

	// Fallback: structural lookup via channel
	wiki, wikiErr := a.GetWikiByChannelId(rctx, post.ChannelId)
	if wikiErr != nil {
		rctx.Logger().Debug("GetWikiIdForPage: structural wiki lookup failed",
			mlog.String("page_id", pageId),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(wikiErr))
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.not_found", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}
	return wiki.Id, nil
}
