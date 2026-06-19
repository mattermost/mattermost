// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

// GetFirstWikiForChannel retrieves the ID of the first wiki in the given channel.
// If no wiki exists, an error is returned.
func (api *PluginAPI) GetFirstWikiForChannel(channelID string) (string, *model.AppError) {
	if !model.IsValidId(channelID) {
		return "", model.NewAppError("GetFirstWikiForChannel", "plugin_api.wiki.invalid_channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	wikis, err := api.app.GetWikisForChannel(api.ctx, channelID, false)
	if err != nil {
		return "", err
	}

	if len(wikis) == 0 {
		return "", model.NewAppError("GetFirstWikiForChannel", "api.plugin.get_first_wiki.no_wiki", nil, "no wiki found for channel", http.StatusNotFound)
	}

	return wikis[0].Id, nil
}

// CreateWikiPage creates a new wiki page with the given title and content on behalf of the specified user.
// Returns the created page.
func (api *PluginAPI) CreateWikiPage(wikiID, title, content, userID string) (*model.Page, *model.AppError) {
	if !model.IsValidId(wikiID) {
		return nil, model.NewAppError("CreateWikiPage", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(userID) {
		return nil, model.NewAppError("CreateWikiPage", "plugin_api.wiki.invalid_user_id.app_error", nil, "", http.StatusBadRequest)
	}

	return api.app.CreateWikiPage(api.ctx, wikiID, "", title, content, userID, "", "")
}

// GetWiki retrieves a wiki by its ID.
func (api *PluginAPI) GetWiki(wikiID string) (*model.Wiki, *model.AppError) {
	if !model.IsValidId(wikiID) {
		return nil, model.NewAppError("GetWiki", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	return api.app.GetWiki(api.ctx, wikiID)
}

// GetPage retrieves a page by its ID without content.
func (api *PluginAPI) GetPage(pageID string) (*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("GetPage", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	return api.app.GetPage(api.ctx, pageID)
}

// GetPageWithContent retrieves a page by its ID with full content.
func (api *PluginAPI) GetPageWithContent(pageID string) (*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("GetPageWithContent", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	return api.app.GetPageWithContent(api.ctx, pageID)
}

// GetWikiPages retrieves pages for a wiki with pagination.
// Uses offset/limit internally but accepts page/perPage for MM standard pagination.
func (api *PluginAPI) GetWikiPages(wikiID string, page, perPage int) ([]*model.Page, *model.AppError) {
	if !model.IsValidId(wikiID) {
		return nil, model.NewAppError("GetWikiPages", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	offset := page * perPage
	return api.app.GetWikiPages(api.ctx, wikiID, offset, perPage)
}

// UpdateWikiPage updates an existing wiki page with optimistic locking.
// baseEditAt must match the page's current EditAt to prevent overwriting concurrent edits.
func (api *PluginAPI) UpdateWikiPage(pageID, wikiID, title, content string, baseEditAt int64) (*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("UpdateWikiPage", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(wikiID) {
		return nil, model.NewAppError("UpdateWikiPage", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	page, err := api.app.GetPage(api.ctx, pageID)
	if err != nil {
		return nil, err
	}

	// force=false to enforce optimistic locking (AI must respect conflicts).
	// nil channel is fetched lazily by UpdatePageWithOptimisticLocking only if needed.
	return api.app.UpdatePageWithOptimisticLocking(api.ctx, page, title, content, "", baseEditAt, false, nil)
}

// DeleteWikiPage soft-deletes a wiki page.
func (api *PluginAPI) DeleteWikiPage(pageID, wikiID string) *model.AppError {
	if !model.IsValidId(pageID) {
		return model.NewAppError("DeleteWikiPage", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(wikiID) {
		return model.NewAppError("DeleteWikiPage", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	page, err := api.app.GetPage(api.ctx, pageID)
	if err != nil {
		return err
	}

	// Pass nil for wiki and channel - App layer will fetch them
	return api.app.DeleteWikiPage(api.ctx, page, wikiID, nil, nil)
}

// MoveWikiPage moves a page to a new parent within the same wiki.
func (api *PluginAPI) MoveWikiPage(pageID string, newParentID *string, wikiID string) ([]*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("MoveWikiPage", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(wikiID) {
		return nil, model.NewAppError("MoveWikiPage", "plugin_api.wiki.invalid_wiki_id.app_error", nil, "", http.StatusBadRequest)
	}
	if newParentID != nil && *newParentID != "" && !model.IsValidId(*newParentID) {
		return nil, model.NewAppError("MoveWikiPage", "plugin_api.wiki.invalid_parent_id.app_error", nil, "", http.StatusBadRequest)
	}
	// Pass nil for newIndex - we only support parent change, not reordering
	return api.app.MovePage(api.ctx, pageID, newParentID, wikiID, nil)
}

// GetPageChildren retrieves immediate children of a page with pagination.
func (api *PluginAPI) GetPageChildren(pageID string, page, perPage int) ([]*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("GetPageChildren", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	options := model.GetPostsOptions{
		Page:    page,
		PerPage: perPage,
	}
	return api.app.GetPageChildren(api.ctx, pageID, options)
}

// GetPageAncestors retrieves all ancestors of a page.
func (api *PluginAPI) GetPageAncestors(pageID string) ([]*model.Page, *model.AppError) {
	if !model.IsValidId(pageID) {
		return nil, model.NewAppError("GetPageAncestors", "plugin_api.wiki.invalid_page_id.app_error", nil, "", http.StatusBadRequest)
	}
	return api.app.GetPageAncestors(api.ctx, pageID)
}
