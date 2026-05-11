// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetWikiIdForPage(rctx request.CTX, pageId string) (string, *model.AppError) {
	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.post_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	return a.GetWikiIdForPost(rctx, post)
}

// GetWikiIdForPost returns the wiki ID for a page post that's already been fetched.
// Use this variant when you already have the post to avoid an extra DB query.
func (a *App) GetWikiIdForPost(rctx request.CTX, post *model.Post) (string, *model.AppError) {
	if post == nil {
		return "", model.NewAppError("GetWikiIdForPost", "app.wiki.get_wiki_for_post.nil_post", nil, "", http.StatusBadRequest)
	}

	// Fast path: check Props cache
	if wikiId, ok := post.Props[model.PagePropsWikiID].(string); ok && wikiId != "" {
		return wikiId, nil
	}

	// Fallback: query PropertyValues (source of truth)
	wikiId, propErr := a.getWikiIdFromPropertyValues(post.Id)
	if propErr != nil {
		rctx.Logger().Debug("GetWikiIdForPost: PropertyValues lookup failed",
			mlog.String("page_id", post.Id),
			mlog.Err(propErr))
		return "", model.NewAppError("GetWikiIdForPost", "app.wiki.get_wiki_for_post.not_found", nil, "", http.StatusNotFound)
	}

	return wikiId, nil
}

func (a *App) getWikiIdFromPropertyValues(pageId string) (string, error) {
	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return "", grpErr
	}

	wikiField, fldErr := a.Srv().PropertyService().PropertyAccessService().GetPropertyFieldByName(anonymousCallerID, group.ID, "", pagePropertyNameWiki)
	if fldErr != nil {
		return "", fldErr
	}

	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: []string{pageId},
		FieldID:   wikiField.ID,
		PerPage:   1,
	}

	values, err := a.Srv().PropertyService().PropertyAccessService().SearchPropertyValues(anonymousCallerID, group.ID, searchOpts)
	if err != nil {
		return "", err
	}

	if len(values) == 0 {
		return "", errors.New("no wiki property value found for page")
	}

	var wikiId string
	if jsonErr := json.Unmarshal(values[0].Value, &wikiId); jsonErr != nil {
		return "", jsonErr
	}

	if wikiId == "" {
		return "", errors.New("wiki_id is empty")
	}

	return wikiId, nil
}
