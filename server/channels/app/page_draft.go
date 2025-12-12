// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// UpsertPageDraft creates or updates a page draft using the unified PageContent model.
// If lastUpdateAt == 0, creates a new draft. Otherwise, updates with optimistic locking.
// Content is stored in PageContents table with status='draft'.
// Metadata (FileIds, Props) is stored in Drafts table with WikiId.
func (a *App) UpsertPageDraft(rctx request.CTX, userId, wikiId, pageId, contentJSON, title string, lastUpdateAt int64, props map[string]any) (*model.PageDraft, *model.AppError) {
	result := "failure"
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().IncrementWikiDraftSave(result)
		}
	}()

	rctx.Logger().Trace("Upserting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_id", pageId),
		mlog.String("title", title),
		mlog.Int("last_update_at", int(lastUpdateAt)))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	// Upsert draft content using unified PageContent model with optimistic locking
	savedContent, err := a.Srv().Store().Draft().UpsertPageDraftContent(pageId, userId, wikiId, contentJSON, title, lastUpdateAt)
	if err != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		var confErr *store.ErrConflict

		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.not_found",
				nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.already_published",
				nil, "", http.StatusConflict).Wrap(err)
		case errors.As(err, &confErr):
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.version_conflict",
				nil, "", http.StatusConflict).Wrap(err)
		default:
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.app_error",
				nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Always upsert Drafts table metadata (required for GetPageDraft to work)
	draft := &model.Draft{
		UserId:    userId,
		WikiId:    wikiId,
		ChannelId: wikiId,
		RootId:    pageId,
		Message:   "",
		FileIds:   []string{},
	}
	if props != nil {
		draft.SetProps(props)
	}
	if _, draftErr := a.Srv().Store().Draft().UpsertPageDraft(draft); draftErr != nil {
		rctx.Logger().Warn("Failed to upsert draft metadata", mlog.Err(draftErr))
	}

	// Return combined PageDraft
	combinedDraft := &model.PageDraft{
		UserId:              userId,
		WikiId:              wikiId,
		ChannelId:           wikiId,
		PageId:              savedContent.PageId,
		Props:               props,
		CreateAt:            savedContent.CreateAt,
		UpdateAt:            savedContent.UpdateAt,
		Title:               savedContent.Title,
		Content:             savedContent.Content,
		BaseUpdateAt:        savedContent.BaseUpdateAt,
		HasPublishedVersion: savedContent.HasPublishedVersion,
	}

	// Send WebSocket event to notify other users of active editor
	message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", channel.Id, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	message.Add("timestamp", savedContent.UpdateAt)
	draftJSON, jsonErr := json.Marshal(combinedDraft)
	if jsonErr == nil {
		message.Add("draft", string(draftJSON))
	}
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           channel.Id,
		ReliableClusterSend: true,
	})
	a.Publish(message)

	result = "success"
	return combinedDraft, nil
}

// SavePageDraftWithMetadata is an alias for UpsertPageDraft for backward compatibility.
// Deprecated: Use UpsertPageDraft instead.
func (a *App) SavePageDraftWithMetadata(rctx request.CTX, userId, wikiId, pageId, contentJSON, title string, lastUpdateAt int64, props map[string]any) (*model.PageDraft, *model.AppError) {
	return a.UpsertPageDraft(rctx, userId, wikiId, pageId, contentJSON, title, lastUpdateAt, props)
}

// GetPageDraft fetches a page draft from PageContents (status='draft') and Drafts tables
func (a *App) GetPageDraft(rctx request.CTX, userId, wikiId, pageId string) (*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_id", pageId))

	// Validate wiki exists
	_, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	// Fetch content from PageContents table with status='draft'
	content, err := a.Srv().Store().Draft().GetPageDraft(pageId, userId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.not_found",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Fetch metadata from Drafts table using wikiId (page drafts store WikiId in ChannelId field)
	draft, draftErr := a.Srv().Store().Draft().Get(userId, wikiId, pageId, false)
	if draftErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(draftErr, &nfErr) {
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft_metadata.not_found",
				nil, "", http.StatusNotFound).Wrap(draftErr)
		}
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft_metadata.app_error",
			nil, "", http.StatusInternalServerError).Wrap(draftErr)
	}

	// Combine into PageDraft
	combinedDraft := &model.PageDraft{
		UserId:              draft.UserId,
		WikiId:              draft.WikiId,
		ChannelId:           draft.ChannelId,
		PageId:              draft.RootId,
		FileIds:             draft.FileIds,
		Props:               draft.GetProps(),
		CreateAt:            draft.CreateAt,
		UpdateAt:            draft.UpdateAt,
		Title:               content.Title,
		Content:             content.Content,
		BaseUpdateAt:        content.BaseUpdateAt,
		HasPublishedVersion: content.HasPublishedVersion,
	}

	return combinedDraft, nil
}

// DeletePageDraft deletes a page draft from PageContents (status='draft') and Drafts tables
func (a *App) DeletePageDraft(rctx request.CTX, userId, wikiId, pageId string) *model.AppError {
	// Fetch wiki to get channelId
	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	// Delete from PageContents table (status='draft')
	if err := a.Srv().Store().Draft().DeletePageDraft(pageId, userId); err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Also delete from Drafts metadata table (page drafts store WikiId in ChannelId field)
	if err := a.Srv().Store().Draft().Delete(userId, wikiId, pageId); err != nil {
		rctx.Logger().Warn("Failed to delete draft metadata", mlog.Err(err))
	}

	// Always send WebSocket event to notify other users that this editor stopped editing
	message := model.NewWebSocketEvent(model.WebsocketEventPageDraftDeleted, "", wiki.ChannelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           wiki.ChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(message)

	return nil
}

// GetPageDraftsForWiki fetches all page drafts for a wiki from both tables
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

	// Fetch content from PageContents table with status='draft'
	contents, err := a.Srv().Store().Draft().GetPageDraftsForUser(userId, wikiId)
	if err != nil {
		rctx.Logger().Error("Failed to get page draft contents for wiki",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.Err(err))
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts_content.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Extract all page IDs for batch fetching
	pageIds := make([]string, len(contents))
	for i, content := range contents {
		pageIds[i] = content.PageId
	}

	// Batch fetch all draft metadata in one query (page drafts store WikiId in ChannelId field)
	drafts, draftErr := a.Srv().Store().Draft().GetManyByRootIds(userId, wikiId, pageIds, false)
	if draftErr != nil {
		rctx.Logger().Error("Failed to get draft metadata",
			mlog.String("user_id", userId),
			mlog.String("channel_id", channel.Id),
			mlog.Err(draftErr))
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts_metadata.app_error",
			nil, "", http.StatusInternalServerError).Wrap(draftErr)
	}

	// Create map for efficient lookup
	draftMap := make(map[string]*model.Draft, len(drafts))
	for _, draft := range drafts {
		draftMap[draft.RootId] = draft
	}

	// Combine contents with drafts
	var combinedDrafts []*model.PageDraft
	for _, content := range contents {
		draft, found := draftMap[content.PageId]
		if !found {
			rctx.Logger().Warn("Draft metadata not found for content, skipping",
				mlog.String("page_id", content.PageId))
			continue
		}

		combinedDraft := &model.PageDraft{
			UserId:              draft.UserId,
			WikiId:              draft.WikiId,
			ChannelId:           draft.ChannelId,
			PageId:              draft.RootId,
			FileIds:             draft.FileIds,
			Props:               draft.GetProps(),
			CreateAt:            draft.CreateAt,
			UpdateAt:            draft.UpdateAt,
			Title:               content.Title,
			Content:             content.Content,
			BaseUpdateAt:        content.BaseUpdateAt,
			HasPublishedVersion: content.HasPublishedVersion,
		}

		combinedDrafts = append(combinedDrafts, combinedDraft)
	}

	rctx.Logger().Debug("Got page drafts for wiki",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.Int("count", len(combinedDrafts)))

	return combinedDrafts, nil
}

func (a *App) resolveDraftContent(draft *model.PageDraft, providedMessage string) (string, *model.AppError) {
	if providedMessage != "" {
		return providedMessage, nil
	}

	content, err := draft.GetDocumentJSON()
	if err != nil {
		return "", model.NewAppError("resolveDraftContent", "app.draft.publish_page.content_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return content, nil
}

func (a *App) validateDraftPermissions(rctx request.CTX, draft *model.PageDraft, channel *model.Channel) *model.AppError {
	session := rctx.Session()

	// Check if this is an update to an existing page
	existingPage, _ := a.GetSinglePost(rctx, draft.PageId, false)
	if IsPagePost(existingPage) {
		return a.HasPermissionToModifyPage(rctx, session, existingPage, PageOperationEdit, "validateDraftPermissions")
	}

	return a.checkPageCreatePermission(rctx, session, channel)
}

func (a *App) checkPageCreatePermission(rctx request.CTX, session *model.Session, channel *model.Channel) *model.AppError {
	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(PageOperationCreate)
		if permission == nil {
			return model.NewAppError("checkPageCreatePermission", "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
		}
		if !a.HasPermissionToChannel(rctx, session.UserId, channel.Id, permission) {
			return model.NewAppError("checkPageCreatePermission", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := a.GetChannelMember(rctx, channel.Id, session.UserId); err != nil {
			return model.NewAppError("checkPageCreatePermission", "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
		}
		user, err := a.GetUser(session.UserId)
		if err != nil {
			return err
		}
		if user.IsGuest() {
			return model.NewAppError("checkPageCreatePermission", "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
		}

	default:
		return model.NewAppError("checkPageCreatePermission", "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
	}

	return nil
}

func (a *App) validateParentPage(rctx request.CTX, parentId string, wiki *model.Wiki) *model.AppError {
	if parentId == "" {
		return nil
	}

	parentPage, err := a.getPagePost(rctx, parentId)
	if err != nil {
		return model.NewAppError("validateParentPage", "api.page.publish.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if parentPage.ChannelId != wiki.ChannelId {
		return model.NewAppError("validateParentPage", "api.page.publish.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (a *App) validatePageDraftForPublish(rctx request.CTX, userId, wikiId, draftId, parentId, message string) (*model.PageDraft, *model.Wiki, *model.Channel, *model.AppError) {
	draft, err := a.GetPageDraft(rctx, userId, wikiId, draftId)
	if err != nil {
		return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "app.draft.publish_page.not_found",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	content, contentErr := a.resolveDraftContent(draft, message)
	if contentErr != nil {
		return nil, nil, nil, contentErr
	}

	rctx.Logger().Debug("Draft content before validation",
		mlog.String("provided_message", message),
		mlog.Int("provided_length", len(message)),
		mlog.Int("resolved_content_length", len(content)),
		mlog.Int("file_ids_count", len(draft.FileIds)),
		mlog.Any("props", draft.Props))

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, nil, nil, err
	}

	channel, err := a.GetChannel(rctx, wiki.ChannelId)
	if err != nil {
		return nil, nil, nil, err
	}

	if err := a.validateDraftPermissions(rctx, draft, channel); err != nil {
		return nil, nil, nil, err
	}

	if err := a.validateParentPage(rctx, parentId, wiki); err != nil {
		return nil, nil, nil, err
	}

	return draft, wiki, channel, nil
}

func (a *App) validateCircularReference(rctx request.CTX, pageId, parentId string) *model.AppError {
	if parentId == "" {
		return nil
	}

	ancestors, err := a.GetPageAncestors(rctx, parentId)
	if err != nil {
		return err
	}

	if _, exists := ancestors.Posts[pageId]; exists {
		return model.NewAppError("validateCircularReference", "api.page.publish.circular_reference.app_error",
			nil, "pageId="+pageId+", parentId="+parentId, http.StatusBadRequest)
	}

	return nil
}

func (a *App) applyDraftPageStatus(rctx request.CTX, page *model.Post, draft *model.PageDraft, isUpdate bool) {
	rawStatus, exists := draft.Props[model.PagePropsPageStatus]
	if !exists {
		return
	}

	// Try string type assertion
	statusValue, ok := rawStatus.(string)
	if !ok {
		// If not a string, try to convert to string
		if rawStatus != nil {
			statusValue = fmt.Sprintf("%v", rawStatus)
		} else {
			return
		}
	}

	if statusValue == "" {
		return
	}

	if err := a.SetPageStatus(rctx, page.Id, statusValue); err != nil {
		logLevel := mlog.LvlWarn
		if isUpdate {
			logLevel = mlog.LvlError
		}
		rctx.Logger().Log(logLevel, "Failed to set page status from draft props",
			mlog.String("page_id", page.Id),
			mlog.String("status", statusValue),
			mlog.Err(err))
	}
}

func (a *App) updatePageFromDraft(rctx request.CTX, pageId, wikiId, parentId, title, content, searchText string, baseEditAt int64, force bool) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Updating existing page from draft",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.Bool("force", force))

	existingPost, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return nil, model.NewAppError("updatePageFromDraft", "app.draft.publish_page.get_existing_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if circErr := a.validateCircularReference(rctx, pageId, parentId); circErr != nil {
		return nil, circErr
	}

	updatedPost, err := a.UpdatePageWithOptimisticLocking(rctx, pageId, title, content, searchText, baseEditAt, force)
	if err != nil {
		return nil, err
	}

	if parentId != existingPost.PageParentId {
		if parentErr := a.ChangePageParent(rctx, pageId, parentId); parentErr != nil {
			return nil, parentErr
		}
		updatedPost, err = a.GetSinglePost(rctx, pageId, false)
		if err != nil {
			return nil, err
		}
	}

	return updatedPost, nil
}

func (a *App) createPageFromDraft(rctx request.CTX, wikiId, parentId, title, content, searchText, userId, pageId string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Creating new page from draft",
		mlog.String("wiki_id", wikiId),
		mlog.String("page_id", pageId))

	// Pass the draft's pageId so the published page uses the same ID (unified ID model)
	createdPost, err := a.CreateWikiPage(rctx, wikiId, parentId, title, content, userId, searchText, pageId)
	if err != nil {
		return nil, err
	}

	return createdPost, nil
}

func (a *App) applyDraftToPage(rctx request.CTX, draft *model.PageDraft, wikiId, parentId, title, searchText, message, userId string, baseEditAt int64, force bool) (*model.Post, *model.AppError) {
	content, err := a.resolveDraftContent(draft, message)
	if err != nil {
		return nil, err
	}

	// With unified page ID model, check if a published page exists with this draft's PageId
	var isUpdate bool
	existingPage, _ := a.GetSinglePost(rctx, draft.PageId, false)
	if IsPagePost(existingPage) {
		isUpdate = true
	}

	var page *model.Post
	if isUpdate {
		page, err = a.updatePageFromDraft(rctx, draft.PageId, wikiId, parentId, title, content, searchText, baseEditAt, force)
	} else {
		// Pass draft.PageId so published page uses the same ID (unified ID model)
		page, err = a.createPageFromDraft(rctx, wikiId, parentId, title, content, searchText, userId, draft.PageId)
	}

	if err != nil {
		return nil, err
	}

	a.applyDraftPageStatus(rctx, page, draft, isUpdate)

	return page, nil
}

func (a *App) BroadcastPagePublished(page *model.Post, wikiId, channelId, draftId, userId string, sourceWikiId ...string) {
	pageJSON, jsonErr := page.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode page to JSON", mlog.Err(jsonErr))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPagePublished, "", channelId, "", nil, "")
	message.Add("page_id", page.Id)
	message.Add("wiki_id", wikiId)
	message.Add("draft_id", draftId)
	message.Add("user_id", userId)
	message.Add("page", pageJSON)
	if len(sourceWikiId) > 0 && sourceWikiId[0] != "" {
		message.Add("source_wiki_id", sourceWikiId[0])
	}
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           channelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

func (a *App) broadcastPageDeleted(pageId, wikiId, channelId, userId string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageDeleted, "", channelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("wiki_id", wikiId)
	message.Add("user_id", userId)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           channelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

// BroadcastPageTitleUpdated broadcasts a page title update to all clients with access to the channel
func (a *App) BroadcastPageTitleUpdated(pageId, title, wikiId, channelId string, updateAt int64) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageTitleUpdated, "", channelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("title", title)
	message.Add("wiki_id", wikiId)
	message.Add("update_at", updateAt)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           channelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

// BroadcastPageMoved broadcasts a page hierarchy change to all clients with access to the channel
func (a *App) BroadcastPageMoved(pageId, oldParentId, newParentId, wikiId, channelId string, updateAt int64, sourceWikiId ...string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageMoved, "", channelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("old_parent_id", oldParentId)
	message.Add("new_parent_id", newParentId)
	message.Add("wiki_id", wikiId)
	message.Add("update_at", updateAt)
	if len(sourceWikiId) > 0 && sourceWikiId[0] != "" && sourceWikiId[0] != wikiId {
		message.Add("source_wiki_id", sourceWikiId[0])
	}
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           channelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

// BroadcastWikiUpdated broadcasts wiki metadata changes to all clients with access to the channel
func (a *App) BroadcastWikiUpdated(wiki *model.Wiki) {
	message := model.NewWebSocketEvent(model.WebsocketEventWikiUpdated, "", wiki.ChannelId, "", nil, "")
	message.Add("wiki_id", wiki.Id)
	message.Add("channel_id", wiki.ChannelId)
	message.Add("title", wiki.Title)
	message.Add("description", wiki.Description)
	message.Add("update_at", wiki.UpdateAt)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           wiki.ChannelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

// PublishPageDraft publishes a draft as a page.
// Uses PublishPageDraftOptions to consolidate the many parameters into a structured options object.
func (a *App) PublishPageDraft(rctx request.CTX, userId string, opts model.PublishPageDraftOptions) (*model.Post, *model.AppError) {
	if err := opts.IsValid(); err != nil {
		return nil, err
	}

	draft, wiki, _, err := a.validatePageDraftForPublish(rctx, userId, opts.WikiId, opts.PageId, opts.ParentId, opts.Content)
	if err != nil {
		return nil, err
	}

	if opts.PageStatus != "" {
		if draft.Props == nil {
			draft.Props = make(map[string]any)
		}
		draft.Props[model.PagePropsPageStatus] = opts.PageStatus
	}

	savedPost, err := a.applyDraftToPage(rctx, draft, opts.WikiId, opts.ParentId, opts.Title, opts.SearchText, opts.Content, userId, opts.BaseEditAt, opts.Force)
	if err != nil {
		return nil, err
	}

	// Enrich the page with properties immediately after publishing
	if enrichErr := a.EnrichPageWithProperties(rctx, savedPost); enrichErr != nil {
		rctx.Logger().Warn("Failed to enrich published page with properties", mlog.String("page_id", savedPost.Id), mlog.Err(enrichErr))
	}

	// Delete draft from both tables
	if deleteErr := a.DeletePageDraft(rctx, userId, opts.WikiId, opts.PageId); deleteErr != nil {
		rctx.Logger().Warn("Failed to delete draft after successful publish", mlog.String("page_id", opts.PageId), mlog.Err(deleteErr))
	}

	if updateErr := a.updateChildDraftParentReferences(rctx, userId, opts.WikiId, opts.PageId, savedPost.Id); updateErr != nil {
		rctx.Logger().Warn("Failed to update child draft parent references", mlog.Err(updateErr))
	}

	// Load page content for the response
	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(savedPost.Id)
	if contentErr != nil {
		savedPost.Message = ""
	} else {
		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			savedPost.Message = ""
		} else {
			savedPost.Message = contentJSON
		}
	}

	// Broadcast to all clients in the channel
	a.BroadcastPagePublished(savedPost, opts.WikiId, wiki.ChannelId, opts.PageId, userId)

	return savedPost, nil
}

func (a *App) updateChildDraftParentReferences(rctx request.CTX, userId, wikiId, oldPageId, newPageId string) *model.AppError {
	drafts, err := a.GetPageDraftsForWiki(rctx, userId, wikiId)
	if err != nil {
		return err
	}

	for _, childDraft := range drafts {
		pageId := childDraft.PageId

		parentIdProp, hasParent := childDraft.Props[model.DraftPropsPageParentID]
		if !hasParent {
			continue
		}

		parentId, ok := parentIdProp.(string)
		if !ok {
			continue
		}

		if parentId != oldPageId {
			continue
		}

		updatedProps := maps.Clone(childDraft.Props)
		updatedProps[model.DraftPropsPageParentID] = newPageId

		updateErr := a.Srv().Store().Draft().UpdatePropsOnly(userId, wikiId, pageId, updatedProps, childDraft.UpdateAt)
		if updateErr != nil {
			continue
		}

		childDraft.Props = updatedProps
		childDraft.UpdateAt = model.GetMillis()

		message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", childDraft.ChannelId, userId, nil, "")
		draftJSON, jsonErr := json.Marshal(childDraft)
		if jsonErr == nil {
			message.Add("draft", string(draftJSON))
			a.Publish(message)
		}
	}

	return nil
}
