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

// SavePageDraftWithMetadata saves a page draft using the hybrid two-table approach:
// - Metadata (FileIds, Props) stored in Drafts table with WikiId
// - Content (Title, TipTap JSON) stored in PageDraftContents table
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

	// Prepare content for PageDraftContents table
	pageDraftContent := &model.PageDraftContent{
		UserId:  userId,
		WikiId:  wikiId,
		DraftId: draftId,
		Title:   title,
	}

	if err := pageDraftContent.SetDocumentJSON(contentJSON); err != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.invalid_content.app_error",
			nil, "", http.StatusBadRequest).Wrap(err)
	}

	// Prepare metadata for Drafts table
	if props == nil {
		props = make(map[string]any)
	}
	if pageId != "" {
		props["page_id"] = pageId
	}

	rctx.Logger().Info("=== [SavePageDraftWithMetadata] Props received ===",
		mlog.String("draft_id", draftId),
		mlog.Any("props", props),
		mlog.Any("page_status", props["page_status"]))
	if originalUpdateAt, ok := props["original_page_update_at"]; ok {
		rctx.Logger().Debug("[APP] original_page_update_at present in props", mlog.Any("value", originalUpdateAt))
	} else {
		rctx.Logger().Debug("[APP] original_page_update_at NOT present in props")
	}

	draft := &model.Draft{
		UserId:    userId,
		WikiId:    wikiId,
		ChannelId: wikiId,
		RootId:    draftId,
		Message:   "",
		FileIds:   []string{},
	}
	draft.SetProps(props)

	draftProps := draft.GetProps()
	rctx.Logger().Info("=== [SavePageDraftWithMetadata] Draft props after SetProps ===",
		mlog.String("draft_id", draftId),
		mlog.Any("props", draftProps),
		mlog.Any("page_status", draftProps["page_status"]))
	if originalUpdateAt, ok := draftProps["original_page_update_at"]; ok {
		rctx.Logger().Debug("[APP] original_page_update_at in draft", mlog.Any("value", originalUpdateAt))
	} else {
		rctx.Logger().Debug("[APP] original_page_update_at NOT in draft")
	}

	rctx.Logger().Info("About to upsert page draft with transaction",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId),
		mlog.String("title", title),
		mlog.String("page_id_param", pageId))

	// Save both content and metadata in a single transaction (DraftStore owns both tables - MM pattern)
	savedContent, savedDraft, err := a.Srv().Store().Draft().UpsertPageDraftWithTransaction(pageDraftContent, draft)
	if err != nil {
		return nil, model.NewAppError("SavePageDraftWithMetadata", "app.draft.save_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Step 3: Return combined PageDraft
	combinedDraft := &model.PageDraft{
		UserId:    savedDraft.UserId,
		WikiId:    savedDraft.WikiId,
		ChannelId: savedDraft.ChannelId,
		DraftId:   savedDraft.RootId,
		FileIds:   savedDraft.FileIds,
		Props:     savedDraft.GetProps(),
		CreateAt:  savedDraft.CreateAt,
		UpdateAt:  savedDraft.UpdateAt,
		Title:     savedContent.Title,
		Content:   savedContent.Content,
	}

	// Step 4: Send WebSocket event to notify other users of active editor
	if pageId != "" {
		// This is editing an existing page, send active editor notification
		message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", channel.Id, "", nil, "")
		message.Add("page_id", pageId)
		message.Add("user_id", userId)
		message.Add("timestamp", savedDraft.UpdateAt)
		a.Publish(message)

		rctx.Logger().Info("Sent draft updated WebSocket event for active editor",
			mlog.String("page_id", pageId),
			mlog.String("user_id", userId),
			mlog.Int("timestamp", int(savedDraft.UpdateAt)))
	}

	return combinedDraft, nil
}

// GetPageDraft fetches a page draft from both Drafts and PageDraftContents tables
func (a *App) GetPageDraft(rctx request.CTX, userId, wikiId, draftId string) (*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId))

	// Validate wiki exists
	_, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	// Fetch content from PageDraftContents table (DraftStore owns both tables - MM pattern)
	content, err := a.Srv().Store().Draft().GetPageDraftContent(userId, wikiId, draftId)
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
	draft, draftErr := a.Srv().Store().Draft().Get(userId, wikiId, draftId, false)
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
		UserId:    draft.UserId,
		WikiId:    draft.WikiId,
		ChannelId: draft.ChannelId,
		DraftId:   draft.RootId,
		FileIds:   draft.FileIds,
		Props:     draft.GetProps(),
		CreateAt:  draft.CreateAt,
		UpdateAt:  draft.UpdateAt,
		Title:     content.Title,
		Content:   content.Content,
	}

	return combinedDraft, nil
}

// DeletePageDraft deletes a page draft from both Drafts and PageDraftContents tables
func (a *App) DeletePageDraft(rctx request.CTX, userId, wikiId, draftId string) *model.AppError {
	rctx.Logger().Info("Deleting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId))

	// Fetch wiki to get channelId
	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	// Check if this draft is for an existing page (draftId might be the pageId)
	pageId := draftId // Use draftId as pageId for WebSocket event (works for both existing pages and new drafts)
	_, postErr := a.GetSinglePost(rctx, draftId, false)
	if postErr == nil {
		rctx.Logger().Info("Draft deletion is for existing page",
			mlog.String("page_id", pageId),
			mlog.String("user_id", userId))
	} else {
		rctx.Logger().Info("Draft deletion is for new page draft",
			mlog.String("draft_id", draftId),
			mlog.String("user_id", userId))
	}

	// Delete from both PageDraftContents and Drafts tables in a single transaction (DraftStore owns both tables - MM pattern)
	// Page drafts store WikiId in ChannelId field, so pass wikiId for both parameters
	if err := a.Srv().Store().Draft().DeletePageDraftWithTransaction(userId, wikiId, wikiId, draftId); err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Always send WebSocket event to notify other users that this editor stopped editing
	// The pageId/draftId is used to identify which page the editor was working on
	message := model.NewWebSocketEvent(model.WebsocketEventPageDraftDeleted, "", wiki.ChannelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	a.Publish(message)

	rctx.Logger().Info("Sent page draft deleted WebSocket event for active editor",
		mlog.String("page_id", pageId),
		mlog.String("user_id", userId))

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

	// Fetch content from PageDraftContents table (DraftStore owns both tables - MM pattern)
	contents, err := a.Srv().Store().Draft().GetPageDraftContentsForWiki(userId, wikiId)
	if err != nil {
		rctx.Logger().Error("Failed to get page draft contents for wiki",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.Err(err))
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts_content.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Extract all draft IDs for batch fetching
	draftIds := make([]string, len(contents))
	for i, content := range contents {
		draftIds[i] = content.DraftId
	}

	// Batch fetch all draft metadata in one query (page drafts store WikiId in ChannelId field)
	drafts, draftErr := a.Srv().Store().Draft().GetManyByRootIds(userId, wikiId, draftIds, false)
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
		draft, found := draftMap[content.DraftId]
		if !found {
			rctx.Logger().Warn("Draft metadata not found for content, skipping",
				mlog.String("draft_id", content.DraftId))
			continue
		}

		combinedDraft := &model.PageDraft{
			UserId:    draft.UserId,
			WikiId:    draft.WikiId,
			ChannelId: draft.ChannelId,
			DraftId:   draft.RootId,
			FileIds:   draft.FileIds,
			Props:     draft.GetProps(),
			CreateAt:  draft.CreateAt,
			UpdateAt:  draft.UpdateAt,
			Title:     content.Title,
			Content:   content.Content,
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
	pageId, isUpdate := draft.Props["page_id"].(string)

	if isUpdate && pageId != "" {
		existingPage, err := a.GetSinglePost(rctx, pageId, false)
		if err != nil {
			return model.NewAppError("validateDraftPermissions", "app.draft.publish_page.get_existing_error",
				nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return a.HasPermissionToModifyPage(rctx, session, existingPage, PageOperationEdit, "validateDraftPermissions")
	}

	return a.checkPageCreatePermission(rctx, session, channel)
}

func (a *App) checkPageCreatePermission(rctx request.CTX, session *model.Session, channel *model.Channel) *model.AppError {
	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(channel.Type, PageOperationCreate)
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

	parentPage, err := a.GetSinglePost(rctx, parentId, false)
	if err != nil {
		return model.NewAppError("validateParentPage", "api.page.publish.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if parentPage.Type != model.PostTypePage {
		return model.NewAppError("validateParentPage", "api.page.publish.parent_not_page.app_error", nil, "", http.StatusBadRequest)
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
	rctx.Logger().Info("=== applyDraftPageStatus CALLED ===",
		mlog.String("page_id", page.Id),
		mlog.Any("draft_props", draft.Props),
		mlog.Bool("is_update", isUpdate))

	// Check if page_status exists
	rawStatus, exists := draft.Props["page_status"]
	if !exists {
		rctx.Logger().Info("No page_status key in draft props", mlog.String("page_id", page.Id))
		return
	}

	rctx.Logger().Info("=== page_status value found ===",
		mlog.String("page_id", page.Id),
		mlog.Any("raw_value", rawStatus),
		mlog.String("type", fmt.Sprintf("%T", rawStatus)))

	// Try string type assertion
	statusValue, ok := rawStatus.(string)
	if !ok {
		// If not a string, try to convert to string
		if rawStatus != nil {
			statusValue = fmt.Sprintf("%v", rawStatus)
			rctx.Logger().Info("Converted page_status to string",
				mlog.String("page_id", page.Id),
				mlog.String("status", statusValue))
		} else {
			rctx.Logger().Info("page_status is nil", mlog.String("page_id", page.Id))
			return
		}
	}

	if statusValue == "" {
		rctx.Logger().Info("page_status is empty string", mlog.String("page_id", page.Id))
		return
	}

	rctx.Logger().Info("Setting page status from draft",
		mlog.String("page_id", page.Id),
		mlog.String("status", statusValue))

	if err := a.SetPageStatus(rctx, page.Id, statusValue); err != nil {
		logLevel := mlog.LvlWarn
		if isUpdate {
			logLevel = mlog.LvlError
		}
		rctx.Logger().Log(logLevel, "Failed to set page status from draft props",
			mlog.String("page_id", page.Id),
			mlog.String("status", statusValue),
			mlog.Err(err))
	} else {
		rctx.Logger().Info("Successfully set page status",
			mlog.String("page_id", page.Id),
			mlog.String("status", statusValue))
	}
}

func (a *App) updatePageFromDraft(rctx request.CTX, pageId, wikiId, parentId, title, content, searchText string, baseUpdateAt int64, force bool) (*model.Post, *model.AppError) {
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

	updatedPost, err := a.UpdatePageWithOptimisticLocking(rctx, pageId, title, content, searchText, baseUpdateAt, force)
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

	rctx.Logger().Info("Page updated from draft",
		mlog.String("page_id", updatedPost.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId))

	return updatedPost, nil
}

func (a *App) createPageFromDraft(rctx request.CTX, wikiId, parentId, title, content, searchText, userId string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Creating new page from draft",
		mlog.String("wiki_id", wikiId))

	createdPost, err := a.CreateWikiPage(rctx, wikiId, parentId, title, content, userId, searchText)
	if err != nil {
		return nil, err
	}

	rctx.Logger().Info("Page created from draft",
		mlog.String("page_id", createdPost.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId))

	return createdPost, nil
}

func (a *App) applyDraftToPage(rctx request.CTX, draft *model.PageDraft, wikiId, parentId, title, searchText, message, userId string, baseUpdateAt int64, force bool) (*model.Post, *model.AppError) {
	content, err := a.resolveDraftContent(draft, message)
	if err != nil {
		return nil, err
	}

	pageId, isUpdate := draft.Props["page_id"].(string)

	var page *model.Post
	if isUpdate && pageId != "" {
		page, err = a.updatePageFromDraft(rctx, pageId, wikiId, parentId, title, content, searchText, baseUpdateAt, force)
	} else {
		page, err = a.createPageFromDraft(rctx, wikiId, parentId, title, content, searchText, userId)
	}

	if err != nil {
		return nil, err
	}

	a.applyDraftPageStatus(rctx, page, draft, isUpdate)

	return page, nil
}

func (a *App) BroadcastPagePublished(page *model.Post, wikiId, channelId, draftId, userId string, sourceWikiId ...string) {
	mlog.Info("Broadcasting page published event",
		mlog.String("page_id", page.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("channel_id", channelId),
		mlog.String("draft_id", draftId),
		mlog.String("user_id", userId))

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
		ChannelId: channelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventPagePublished)))
	a.Publish(message)
	mlog.Info("Message published to websocket")
}

func (a *App) broadcastPageDeleted(pageId, wikiId, channelId, userId string) {
	mlog.Info("Broadcasting page deleted event",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("channel_id", channelId),
		mlog.String("user_id", userId))

	message := model.NewWebSocketEvent(model.WebsocketEventPageDeleted, "", channelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("wiki_id", wikiId)
	message.Add("user_id", userId)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId: channelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventPageDeleted)))
	a.Publish(message)
	mlog.Info("Message published to websocket")
}

// BroadcastPageTitleUpdated broadcasts a page title update to all clients with access to the channel
func (a *App) BroadcastPageTitleUpdated(pageId, title, wikiId, channelId string, updateAt int64) {
	mlog.Info("Broadcasting page title updated event",
		mlog.String("page_id", pageId),
		mlog.String("title", title),
		mlog.String("wiki_id", wikiId),
		mlog.String("channel_id", channelId))

	message := model.NewWebSocketEvent(model.WebsocketEventPageTitleUpdated, "", channelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("title", title)
	message.Add("wiki_id", wikiId)
	message.Add("update_at", updateAt)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId: channelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventPageTitleUpdated)))
	a.Publish(message)
}

// BroadcastPageMoved broadcasts a page hierarchy change to all clients with access to the channel
func (a *App) BroadcastPageMoved(pageId, oldParentId, newParentId, wikiId, channelId string, updateAt int64, sourceWikiId ...string) {
	mlog.Info("Broadcasting page moved event",
		mlog.String("page_id", pageId),
		mlog.String("old_parent_id", oldParentId),
		mlog.String("new_parent_id", newParentId),
		mlog.String("wiki_id", wikiId),
		mlog.String("channel_id", channelId))

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
		ChannelId: channelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventPageMoved)))
	a.Publish(message)
}

// BroadcastWikiUpdated broadcasts wiki metadata changes to all clients with access to the channel
func (a *App) BroadcastWikiUpdated(wiki *model.Wiki) {
	mlog.Info("Broadcasting wiki updated event",
		mlog.String("wiki_id", wiki.Id),
		mlog.String("title", wiki.Title),
		mlog.String("channel_id", wiki.ChannelId))

	message := model.NewWebSocketEvent(model.WebsocketEventWikiUpdated, "", wiki.ChannelId, "", nil, "")
	message.Add("wiki_id", wiki.Id)
	message.Add("channel_id", wiki.ChannelId)
	message.Add("title", wiki.Title)
	message.Add("description", wiki.Description)
	message.Add("update_at", wiki.UpdateAt)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId: wiki.ChannelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventWikiUpdated)))
	a.Publish(message)
}

// PublishPageDraft publishes a draft as a page
func (a *App) PublishPageDraft(rctx request.CTX, userId, wikiId, draftId, parentId, title, searchText, message, pageStatus string, baseUpdateAt int64, force bool) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Publishing page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId),
		mlog.Int("message_length", len(message)),
		mlog.Bool("force", force))

	draft, wiki, _, err := a.validatePageDraftForPublish(rctx, userId, wikiId, draftId, parentId, message)
	if err != nil {
		return nil, err
	}

	rctx.Logger().Info("=== [PublishPageDraft] Draft fetched from DB ===",
		mlog.String("draft_id", draftId),
		mlog.Any("draft_props", draft.Props),
		mlog.String("pageStatus_param", pageStatus))

	if pageStatus != "" {
		if draft.Props == nil {
			draft.Props = make(map[string]any)
		}
		draft.Props["page_status"] = pageStatus
		rctx.Logger().Info("=== [PublishPageDraft] Overriding draft status with pageStatus param ===",
			mlog.String("pageStatus_param", pageStatus))
	} else {
		rctx.Logger().Info("=== [PublishPageDraft] No pageStatus param, using draft props ===",
			mlog.Any("draft_status", draft.Props["page_status"]))
	}

	savedPost, err := a.applyDraftToPage(rctx, draft, wikiId, parentId, title, searchText, message, userId, baseUpdateAt, force)
	if err != nil {
		return nil, err
	}

	// Enrich the page with properties immediately after publishing
	// This ensures both API response and websocket payload have enriched properties
	rctx.Logger().Info("=== BEFORE ENRICHMENT ===",
		mlog.String("page_id", savedPost.Id),
		mlog.Any("props_before", savedPost.Props))

	if enrichErr := a.EnrichPageWithProperties(rctx, savedPost); enrichErr != nil {
		rctx.Logger().Error("Failed to enrich published page with properties",
			mlog.String("page_id", savedPost.Id),
			mlog.Err(enrichErr))
	}

	rctx.Logger().Info("=== AFTER ENRICHMENT ===",
		mlog.String("page_id", savedPost.Id),
		mlog.Any("props_after", savedPost.Props),
		mlog.Bool("has_page_status", savedPost.Props != nil && savedPost.Props["page_status"] != nil))

	// Delete draft from both tables
	if deleteErr := a.DeletePageDraft(rctx, userId, wikiId, draftId); deleteErr != nil {
		rctx.Logger().Warn("Failed to delete draft after successful publish - orphaned draft will remain",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.String("draft_id", draftId),
			mlog.String("page_id", savedPost.Id),
			mlog.Err(deleteErr))
	} else {
		rctx.Logger().Info("Draft deleted successfully, now updating child draft references",
			mlog.String("deleted_draft_id", draftId),
			mlog.String("published_page_id", savedPost.Id))
	}

	if updateErr := a.updateChildDraftParentReferences(rctx, userId, wikiId, draftId, savedPost.Id); updateErr != nil {
		rctx.Logger().Error("Failed to update child draft parent references after publish",
			mlog.String("wiki_id", wikiId),
			mlog.String("published_draft_id", draftId),
			mlog.String("new_page_id", savedPost.Id),
			mlog.Err(updateErr))
	}

	// Load page content for the response (PageContent table stores the actual content)
	// This is separate from enrichment and fetches the full page content
	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(savedPost.Id)
	if contentErr != nil {
		rctx.Logger().Warn("Failed to fetch page content after publish", mlog.String("page_id", savedPost.Id), mlog.Err(contentErr))
		// Don't fail the whole operation, just return without content
		savedPost.Message = ""
	} else {
		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			rctx.Logger().Warn("Failed to serialize page content", mlog.String("page_id", savedPost.Id), mlog.Err(jsonErr))
			savedPost.Message = ""
		} else {
			savedPost.Message = contentJSON
		}
	}

	// Broadcast to all clients in the channel
	rctx.Logger().Info("=== BROADCASTING PAGE ===",
		mlog.String("page_id", savedPost.Id),
		mlog.Any("props_to_broadcast", savedPost.Props),
		mlog.Bool("has_page_status", savedPost.Props != nil && savedPost.Props["page_status"] != nil))
	a.BroadcastPagePublished(savedPost, wikiId, wiki.ChannelId, draftId, userId)

	rctx.Logger().Info("=== RETURNING PAGE FROM API ===",
		mlog.String("page_id", savedPost.Id),
		mlog.Any("props_in_response", savedPost.Props))

	return savedPost, nil
}

func (a *App) updateChildDraftParentReferences(rctx request.CTX, userId, wikiId, oldDraftId, newPageId string) *model.AppError {
	rctx.Logger().Info("=== updateChildDraftParentReferences CALLED ===",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("old_draft_id", oldDraftId),
		mlog.String("new_page_id", newPageId))

	drafts, err := a.GetPageDraftsForWiki(rctx, userId, wikiId)
	if err != nil {
		rctx.Logger().Error("Failed to get drafts for wiki", mlog.Err(err))
		return err
	}

	rctx.Logger().Info("Found drafts in wiki", mlog.Int("draft_count", len(drafts)))

	for _, childDraft := range drafts {
		draftId := childDraft.DraftId
		rctx.Logger().Info("Checking draft",
			mlog.String("draft_id", draftId),
			mlog.Any("props", childDraft.Props))

		parentIdProp, hasParent := childDraft.Props["page_parent_id"]
		if !hasParent {
			rctx.Logger().Info("Draft has NO page_parent_id prop", mlog.String("draft_id", draftId))
			continue
		}

		parentId, ok := parentIdProp.(string)
		if !ok {
			rctx.Logger().Info("page_parent_id is NOT a string",
				mlog.String("draft_id", draftId),
				mlog.Any("parent_id_prop", parentIdProp))
			continue
		}

		rctx.Logger().Info("Comparing parent IDs",
			mlog.String("draft_id", draftId),
			mlog.String("draft_parent_id", parentId),
			mlog.String("looking_for_draft_id", oldDraftId),
			mlog.Bool("match", parentId == oldDraftId))

		if parentId != oldDraftId {
			continue
		}

		rctx.Logger().Info("=== FOUND CHILD DRAFT TO UPDATE ===",
			mlog.String("child_draft_id", draftId),
			mlog.String("old_parent_draft_id", oldDraftId),
			mlog.String("new_parent_page_id", newPageId))

		updatedProps := maps.Clone(childDraft.Props)
		updatedProps["page_parent_id"] = newPageId

		rctx.Logger().Info("About to update draft props only",
			mlog.String("child_draft_id", draftId),
			mlog.Any("updated_props", updatedProps))

		updateErr := a.Srv().Store().Draft().UpdatePropsOnly(userId, wikiId, draftId, updatedProps, childDraft.UpdateAt)
		if updateErr != nil {
			rctx.Logger().Warn("Skipping child draft update due to concurrent modification",
				mlog.String("child_draft_id", draftId),
				mlog.Err(updateErr))
		} else {
			rctx.Logger().Info("=== SUCCESSFULLY UPDATED CHILD DRAFT PROPS ===",
				mlog.String("child_draft_id", draftId),
				mlog.String("new_parent_id", newPageId))

			childDraft.Props = updatedProps
			childDraft.UpdateAt = model.GetMillis()

			message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", childDraft.ChannelId, userId, nil, "")
			draftJSON, jsonErr := json.Marshal(childDraft)
			if jsonErr != nil {
				rctx.Logger().Warn("Failed to encode updated draft to JSON", mlog.Err(jsonErr))
			} else {
				message.Add("draft", string(draftJSON))
				a.Publish(message)
				rctx.Logger().Info("Sent websocket event for updated child draft", mlog.String("child_draft_id", draftId))
			}
		}
	}

	rctx.Logger().Info("=== updateChildDraftParentReferences COMPLETED ===")
	return nil
}
