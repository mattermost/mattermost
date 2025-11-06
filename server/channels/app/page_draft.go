// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) SavePageDraftWithMetadata(rctx request.CTX, userId, wikiId, draftId, contentJSON, title, pageId string, props map[string]any) (*model.PageDraft, *model.AppError) {
	rctx.Logger().Trace("Saving page draft with metadata",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId),
		mlog.String("title", title),
		mlog.String("page_id", pageId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	pageDraft := &model.PageDraft{
		UserId:  userId,
		WikiId:  wikiId,
		DraftId: draftId,
		Title:   title,
	}

	if err := pageDraft.SetDocumentJSON(contentJSON); err != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.invalid_content.app_error",
			nil, "", http.StatusBadRequest).Wrap(err)
	}

	if props == nil {
		props = make(map[string]any)
	}
	if pageId != "" {
		props["page_id"] = pageId
	}
	pageDraft.SetProps(props)

	draft, err := a.Srv().Store().PageDraft().Upsert(pageDraft)
	if err != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return draft, nil
}

func (a *App) GetPageDraft(rctx request.CTX, userId, wikiId, draftId string) (*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId))

	draft, err := a.Srv().Store().PageDraft().Get(userId, wikiId, draftId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page.not_found",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return draft, nil
}

func (a *App) DeletePageDraft(rctx request.CTX, userId, wikiId, draftId string) *model.AppError {
	rctx.Logger().Debug("Deleting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId))

	if err := a.Srv().Store().PageDraft().Delete(userId, wikiId, draftId); err != nil {
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetPageDraftsForWiki(rctx request.CTX, userId, wikiId string) ([]*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page drafts for wiki",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	drafts, err := a.Srv().Store().PageDraft().GetForWiki(userId, wikiId)
	if err != nil {
		rctx.Logger().Error("Failed to get page drafts for wiki",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.Err(err))
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("Got page drafts for wiki",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.Int("count", len(drafts)))

	return drafts, nil
}
