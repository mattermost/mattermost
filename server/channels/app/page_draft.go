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

// UpsertPageDraft creates or updates a page draft.
// Content is stored in Draft.Message, metadata in Draft.Props.
// wiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) UpsertPageDraft(rctx request.CTX, userId, wikiId, pageId, contentJSON, title string, lastUpdateAt int64, props map[string]any, wiki *model.Wiki, channel *model.Channel) (*model.PageDraft, *model.AppError) {
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
		mlog.Int("last_update_at", lastUpdateAt))

	if wiki == nil {
		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
		}
	}

	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, wiki.ChannelId)
		if chanErr != nil {
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
		}
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate and normalize content (auto-converts plain text to TipTap JSON)
	processedContent := contentJSON
	if contentJSON != "" {
		var contentErr error
		processedContent, _, contentErr = validateAndNormalizePageContent(contentJSON, "")
		if contentErr != nil {
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.invalid_content",
				nil, "", http.StatusBadRequest).Wrap(contentErr)
		}
	}

	draft := &model.Draft{
		UserId:    userId,
		ChannelId: wikiId,
		RootId:    pageId,
		Message:   processedContent,
		FileIds:   []string{},
	}

	// Merge title and caller props into existing draft props
	// This prevents clobbering PageParentId, PageStatus, etc.
	existingDraft, getDraftErr := a.Srv().Store().Draft().GetPageDraft(pageId, userId, wikiId)
	var existingProps map[string]any
	if getDraftErr != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(getDraftErr, &nfErr) {
			return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.get_existing_error",
				nil, "", http.StatusInternalServerError).Wrap(getDraftErr)
		}
	} else {
		existingProps = existingDraft.GetProps()
	}
	if existingProps == nil {
		existingProps = map[string]any{}
	}
	// Allowlist client-supplied props. Anything outside this set is dropped:
	// the import path uses the same defense for trusted imports, the API
	// path is untrusted user input and should be at least as strict.
	for k, v := range props {
		switch k {
		case model.PagePropsPageStatus,
			model.PagePropsInlineAnchor,
			model.DraftPropsPageParentID,
			model.DraftPropsHasPublishedVersion,
			model.DraftPropsOriginalPageEditAt:
			existingProps[k] = v
		default:
			rctx.Logger().Debug("Dropping unsupported page-draft prop",
				mlog.String("key", k))
		}
	}
	existingProps[model.PagePropsTitle] = model.SanitizeUnicode(title)
	existingProps[model.PagePropsPageID] = pageId

	// Store BaseUpdateAt in Props for conflict detection.
	// Clamp to now to prevent a far-future client timestamp from disabling locking.
	if lastUpdateAt > 0 && lastUpdateAt <= model.GetMillis() {
		existingProps["base_update_at"] = lastUpdateAt
	}
	draft.SetProps(existingProps)

	savedDraft, draftErr := a.Srv().Store().Draft().UpsertPageDraft(draft)
	if draftErr != nil {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.metadata_error",
			nil, "", http.StatusInternalServerError).Wrap(draftErr)
	}

	// Build combined PageDraft from saved draft
	combinedDraft, convertErr := model.PageDraftFromDraft(savedDraft)
	if convertErr != nil {
		return nil, model.NewAppError("UpsertPageDraft", "app.draft.save_page.parse_error",
			nil, "", http.StatusInternalServerError).Wrap(convertErr)
	}

	// Notify other users of active editor
	a.BroadcastPageDraftUpdated(rctx, wiki, combinedDraft)

	result = "success"
	return combinedDraft, nil
}

// SavePageDraftWithMetadata is the convenience entrypoint for callers that
// don't have wiki/channel already fetched. UpsertPageDraft is the variant
// that accepts pre-fetched wiki and channel to avoid redundant lookups.
func (a *App) SavePageDraftWithMetadata(rctx request.CTX, userId, wikiId, pageId, contentJSON, title string, lastUpdateAt int64, props map[string]any) (*model.PageDraft, *model.AppError) {
	return a.UpsertPageDraft(rctx, userId, wikiId, pageId, contentJSON, title, lastUpdateAt, props, nil, nil)
}

// GetPageDraft fetches a page draft from the Drafts table.
// skipWikiValidation can be true if wiki was already validated by the API layer.
func (a *App) GetPageDraft(rctx request.CTX, userId, wikiId, pageId string, skipWikiValidation bool) (*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_id", pageId))

	// Validate wiki exists (skip if API layer already validated)
	if !skipWikiValidation {
		_, wikiErr := a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
		}
	}

	// Fetch draft from Drafts table (content is in Draft.Message)
	draft, draftErr := a.Srv().Store().Draft().GetPageDraft(pageId, userId, wikiId)
	if draftErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(draftErr, &nfErr):
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.not_found",
				nil, "", http.StatusNotFound).Wrap(draftErr)
		default:
			return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.app_error",
				nil, "", http.StatusInternalServerError).Wrap(draftErr)
		}
	}

	pageDraft, err := model.PageDraftFromDraft(draft)
	if err != nil {
		return nil, model.NewAppError("GetPageDraft", "app.draft.get_page_draft.parse_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return pageDraft, nil
}

// DeletePageDraft deletes a page draft from the Drafts table.
func (a *App) DeletePageDraft(rctx request.CTX, userId, wikiId, pageId string) *model.AppError {
	// Fetch wiki to get channelId
	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("DeletePageDraft", "app.draft.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	if err := a.Srv().Store().Draft().DeletePageDraft(pageId, userId, wikiId); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeletePageDraft", "app.draft.delete_page.not_found.app_error",
				nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeletePageDraft", "app.draft.delete_page.app_error",
				nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Notify other users that this editor stopped editing
	a.BroadcastPageDraftDeleted(rctx, wiki, pageId, userId)

	return nil
}

// MovePageDraft moves a draft to a new parent in the hierarchy.
// This only updates the page_parent_id prop in the Drafts table.
func (a *App) MovePageDraft(rctx request.CTX, userId, wikiId, pageId, newParentId string) *model.AppError {
	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("MovePageDraft", "app.draft.move_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	if err := a.Srv().Store().Draft().UpdateDraftParent(userId, wikiId, pageId, newParentId); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("MovePageDraft", "app.draft.move_page.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("MovePageDraft", "app.draft.move_page.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.BroadcastPageDraftMoved(rctx, wiki, pageId, userId)

	return nil
}

// GetPageDraftsForWiki fetches page drafts for a wiki with pagination.
// wiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) GetPageDraftsForWiki(rctx request.CTX, userId, wikiId string, offset, limit int, wiki *model.Wiki, channel *model.Channel) ([]*model.PageDraft, *model.AppError) {
	rctx.Logger().Debug("Getting page drafts for wiki",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.Int("offset", offset),
		mlog.Int("limit", limit))

	if wiki == nil {
		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
		}
	}

	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, wiki.ChannelId)
		if chanErr != nil {
			return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
		}
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	// Fetch page drafts from Drafts table (content is in Draft.Message)
	drafts, draftErr := a.Srv().Store().Draft().GetPageDraftsForUser(userId, wikiId, offset, limit)
	if draftErr != nil {
		return nil, model.NewAppError("GetPageDraftsForWiki", "app.draft.get_wiki_drafts.app_error",
			nil, "", http.StatusInternalServerError).Wrap(draftErr)
	}

	var pageDrafts []*model.PageDraft
	for _, draft := range drafts {
		if draft == nil {
			continue
		}

		pageDraft, err := model.PageDraftFromDraft(draft)
		if err != nil {
			rctx.Logger().Warn("Failed to convert draft to page draft, skipping",
				mlog.String("draft_root_id", draft.RootId),
				mlog.Err(err))
			continue
		}

		pageDrafts = append(pageDrafts, pageDraft)
	}

	rctx.Logger().Debug("Got page drafts for wiki",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.Int("count", len(pageDrafts)))

	return pageDrafts, nil
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

func (a *App) validateParentPage(rctx request.CTX, parentId string, wiki *model.Wiki) *model.AppError {
	if parentId == "" {
		return nil
	}

	parentPage, err := a.GetPage(rctx, parentId)
	if err != nil {
		return model.NewAppError("validateParentPage", "app.page.publish.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if parentPage.ChannelId != wiki.ChannelId {
		return model.NewAppError("validateParentPage", "app.page.publish.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (a *App) validatePageDraftForPublish(rctx request.CTX, userId, wikiId, draftId, parentId, message string) (*model.PageDraft, *model.Wiki, *model.Channel, *model.AppError) {
	draft, err := a.GetPageDraft(rctx, userId, wikiId, draftId, false)
	if err != nil {
		if err.StatusCode == http.StatusNotFound {
			return nil, nil, nil, model.NewAppError("PublishPageDraft", "app.draft.publish_page.not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, nil, nil, err
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

	channel, err := a.GetWikiBackingChannel(rctx, wiki.ChannelId)
	if err != nil {
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

	for _, a := range ancestors {
		if a.Id == pageId {
			return model.NewAppError("validateCircularReference", "app.page.publish.circular_reference.app_error",
				nil, "pageId="+pageId+", parentId="+parentId, http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) applyDraftPageStatus(rctx request.CTX, page *model.Page, draft *model.PageDraft) *model.AppError {
	rawStatus, exists := draft.Props[model.PagePropsPageStatus]
	if !exists {
		return nil
	}

	statusValue, ok := rawStatus.(string)
	if !ok {
		rctx.Logger().Warn("applyDraftPageStatus: status prop is not a string, ignoring",
			mlog.String("page_id", page.Id),
			mlog.Any("raw_status", rawStatus))
		return nil
	}

	if statusValue == "" {
		return nil
	}

	if err := a.SetPageStatus(rctx, page.Id, statusValue); err != nil {
		rctx.Logger().Warn("Failed to set page status from draft props",
			mlog.String("page_id", page.Id),
			mlog.String("status", statusValue),
			mlog.Err(err))
		return err
	}
	return nil
}

func (a *App) updatePageFromDraft(rctx request.CTX, page *model.Page, wikiId, parentId, title, content, searchText string, baseEditAt int64, force bool) (*model.Page, *model.AppError) {
	rctx.Logger().Debug("Updating existing page from draft",
		mlog.String("page_id", page.Id),
		mlog.String("wiki_id", wikiId),
		mlog.Bool("force", force))

	if circErr := a.validateCircularReference(rctx, page.Id, parentId); circErr != nil {
		return nil, circErr
	}

	updatedPage, err := a.UpdatePageWithOptimisticLocking(rctx, page, title, content, searchText, baseEditAt, force, nil)
	if err != nil {
		return nil, err
	}

	if parentId != page.ParentId {
		if _, parentErr := a.MovePage(rctx, page.Id, &parentId, wikiId, nil); parentErr != nil {
			return nil, parentErr
		}
		// GetPage always reads from master — see its implementation.
		updatedPage, err = a.GetPage(rctx, page.Id)
		if err != nil {
			return nil, err
		}
	}

	return updatedPage, nil
}

func (a *App) applyDraftToPage(rctx request.CTX, draft *model.PageDraft, existingPage *model.Page, wikiId, parentId, title, searchText, message, userId string, baseEditAt int64, force bool) (*model.Page, *model.AppError) {
	content, err := a.resolveDraftContent(draft, message)
	if err != nil {
		return nil, err
	}

	var page *model.Page
	if existingPage != nil {
		page, err = a.updatePageFromDraft(rctx, existingPage, wikiId, parentId, title, content, searchText, baseEditAt, force)
	} else {
		rctx.Logger().Debug("Creating new page from draft",
			mlog.String("wiki_id", wikiId),
			mlog.String("page_id", draft.PageId))
		// Pass the draft's pageId so the published page uses the same ID (unified ID model)
		page, err = a.CreateWikiPage(rctx, wikiId, parentId, title, content, userId, searchText, draft.PageId)
	}

	if err != nil {
		return nil, err
	}

	// Apply status from draft. Content was saved successfully so we return the page
	// regardless; log at Warn so the failure is visible without implying a hard error.
	if statusErr := a.applyDraftPageStatus(rctx, page, draft); statusErr != nil {
		rctx.Logger().Warn("Failed to apply draft page status during publish",
			mlog.String("page_id", page.Id), mlog.Err(statusErr))
	}

	// Set content on the returned page to avoid extra DB fetch in caller.
	page.Body = content

	return page, nil
}

// publishToLinkedSourceChannels publishes a WebSocket message to all source channels
// linked to the given wiki via ChannelMemberLinks. Wiki backing channels (ChannelTypeWiki)
// are excluded from GetAllChannelMembersForUser, so events broadcast to a backing
// channel are silently dropped by the WS hub. If no links exist, falls back to
// broadcasting directly to the wiki's backing channel (Mode A — standalone wiki).
// Wikis are addressed by wikiId here so callers don't need to thread
// the backing channel id; the ChannelMemberLink schema's join key is resolved via
// ChannelMemberLinkStore.GetByWiki (a single SQL JOIN through the Wikis table).
func (a *App) publishToLinkedSourceChannels(wikiId string, message *model.WebSocketEvent) {
	links, err := a.Srv().Store().ChannelMemberLink().GetByWiki(wikiId)
	if err != nil {
		a.Log().Warn("Failed to fetch wiki links for broadcast", mlog.Err(err))
		return
	}
	if len(links) == 0 {
		wiki, storeErr := a.Srv().Store().Wiki().Get(wikiId)
		if storeErr != nil {
			a.Log().Warn("Failed to fetch wiki for broadcast fallback", mlog.Err(storeErr))
			return
		}
		msg := message.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           wiki.ChannelId,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
		return
	}
	for _, link := range links {
		msg := message.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           link.SourceId,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
	}
}

func (a *App) BroadcastPagePublished(page *model.Page, wikiId, draftId, userId string) {
	pageJSON, jsonErr := marshalPageToJSON(page)
	if jsonErr != nil {
		a.Log().Warn("Failed to encode page to JSON", mlog.Err(jsonErr))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPagePublished, "", "", "", nil, "")
	message.Add("page_id", page.Id)
	message.Add("wiki_id", wikiId)
	message.Add("draft_id", draftId)
	message.Add("user_id", userId)
	message.Add("page", pageJSON)
	a.publishToLinkedSourceChannels(wikiId, message)
}

func (a *App) broadcastPageDeleted(pageId, wikiId, userId, newParentId string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageDeleted, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("wiki_id", wikiId)
	message.Add("user_id", userId)
	message.Add("new_parent_id", newParentId)
	a.publishToLinkedSourceChannels(wikiId, message)
}

// BroadcastPageTitleUpdated broadcasts a page title update to source channels linked to the wiki.
func (a *App) BroadcastPageTitleUpdated(pageId, title, wikiId string, updateAt int64) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageTitleUpdated, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("title", title)
	message.Add("wiki_id", wikiId)
	message.Add("update_at", updateAt)
	a.publishToLinkedSourceChannels(wikiId, message)
}

// PageMovedBroadcastOptions contains optional parameters for BroadcastPageMoved.
type PageMovedBroadcastOptions struct {
	SourceWikiId string        // Set when page is moved between wikis
	Siblings     []*model.Page // Updated siblings with new sort orders (for reorder broadcasts)
}

// BroadcastPageMoved broadcasts a page hierarchy change to source channels linked to the wiki.
// When siblings are provided (reorder operation), they are included so all clients can update sort orders.
func (a *App) BroadcastPageMoved(pageId, oldParentId, newParentId, wikiId string, updateAt int64, opts ...PageMovedBroadcastOptions) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageMoved, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("old_parent_id", oldParentId)
	message.Add("new_parent_id", newParentId)
	message.Add("wiki_id", wikiId)
	message.Add("update_at", updateAt)

	if len(opts) > 0 {
		opt := opts[0]
		if opt.SourceWikiId != "" && opt.SourceWikiId != wikiId {
			message.Add("source_wiki_id", opt.SourceWikiId)
		}
		if len(opt.Siblings) > 0 {
			// Include updated siblings so all clients can sync sort orders
			if siblingsJSON, err := marshalPageSliceToJSON(opt.Siblings); err != nil {
				a.Log().Warn("Failed to serialize siblings for page_moved broadcast; sort orders may be stale",
					mlog.String("page_id", pageId), mlog.Err(err))
			} else {
				message.Add("siblings", siblingsJSON)
			}
		}
	}

	a.publishToLinkedSourceChannels(wikiId, message)
}

// BroadcastWikiCreated broadcasts new wiki creation to all clients with access to the
// linked source channels. The wiki backing channel (ChannelTypeWiki) is excluded from
// GetAllChannelMembersForUser, so events broadcast there are silently dropped — we
// deliver only to source channels linked via ChannelMemberLinks.
// If knownLinks is non-nil it is used directly to fan out, avoiding a replica read that
// may lag behind the master in HA deployments. Pass nil to fall back to a
// GetByDestination store query.
func (a *App) BroadcastWikiCreated(wiki *model.Wiki, knownLinks []*model.ChannelMemberLink) {
	links := knownLinks
	if links == nil {
		var linksErr error
		links, linksErr = a.Srv().Store().ChannelMemberLink().GetByDestination(wiki.ChannelId)
		if linksErr != nil {
			a.Log().Warn("Failed to fetch wiki links for broadcast on wiki creation", mlog.Err(linksErr))
		}
	}
	for _, link := range links {
		msg := model.NewWebSocketEvent(model.WebsocketEventWikiCreated, "", link.SourceId, "", nil, "")
		msg.Add("wiki_id", wiki.Id)
		msg.Add("source_channel_id", link.SourceId)
		msg.Add("title", wiki.Title)
		msg.Add("description", wiki.Description)
		msg.Add("create_at", wiki.CreateAt)
		msg.Add("update_at", wiki.UpdateAt)
		msg.Add("sort_order", wiki.SortOrder)
		msg.Add("team_id", wiki.TeamId)
		msg.Add("creator_id", wiki.CreatorId)
		msg = msg.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           link.SourceId,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
	}
}

// BroadcastWikiUpdated broadcasts wiki metadata changes to all clients with access to
// the linked source channels. Backing channel broadcasts are intentionally omitted —
// see BroadcastWikiCreated for rationale.
func (a *App) BroadcastWikiUpdated(wiki *model.Wiki) {
	links, linksErr := a.Srv().Store().ChannelMemberLink().GetByDestination(wiki.ChannelId)
	if linksErr != nil {
		a.Log().Warn("Failed to fetch wiki links for broadcast on wiki update", mlog.Err(linksErr))
		return
	}
	for _, link := range links {
		msg := model.NewWebSocketEvent(model.WebsocketEventWikiUpdated, "", link.SourceId, "", nil, "")
		msg.Add("wiki_id", wiki.Id)
		msg.Add("title", wiki.Title)
		msg.Add("description", wiki.Description)
		msg.Add("update_at", wiki.UpdateAt)
		msg = msg.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           link.SourceId,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
	}
}

// BroadcastWikiMoved broadcasts wiki move events to both source and target channels.
// Source channel users will see the wiki removed, target channel users will see it added.
func (a *App) BroadcastWikiMoved(wiki *model.Wiki, sourceChannelId, targetChannelId string) {
	// Broadcast to source channel - wiki is being removed
	sourceMessage := model.NewWebSocketEvent(model.WebsocketEventWikiMoved, "", sourceChannelId, "", nil, "")
	sourceMessage.Add("wiki_id", wiki.Id)
	sourceMessage.Add("source_channel_id", sourceChannelId)
	sourceMessage.Add("target_channel_id", targetChannelId)
	sourceMessage.Add("title", wiki.Title)
	sourceMessage.Add("action", "removed")
	sourceMessage = sourceMessage.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           sourceChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(sourceMessage)

	// Broadcast to target channel - wiki is being added
	targetMessage := model.NewWebSocketEvent(model.WebsocketEventWikiMoved, "", targetChannelId, "", nil, "")
	targetMessage.Add("wiki_id", wiki.Id)
	targetMessage.Add("source_channel_id", sourceChannelId)
	targetMessage.Add("target_channel_id", targetChannelId)
	targetMessage.Add("title", wiki.Title)
	targetMessage.Add("description", wiki.Description)
	targetMessage.Add("create_at", wiki.CreateAt)
	targetMessage.Add("update_at", wiki.UpdateAt)
	targetMessage.Add("sort_order", wiki.SortOrder)
	targetMessage.Add("action", "added")
	targetMessage = targetMessage.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           targetChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(targetMessage)
}

// BroadcastWikiDeleted broadcasts wiki deletion to all clients with access to the channel.
func (a *App) BroadcastWikiDeleted(wiki *model.Wiki, links []*model.ChannelMemberLink) {
	for _, link := range links {
		msg := model.NewWebSocketEvent(model.WebsocketEventWikiDeleted, "", link.SourceId, "", nil, "")
		msg.Add("wiki_id", wiki.Id)
		msg.Add("title", wiki.Title)
		msg = msg.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           link.SourceId,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
	}
}

// publishDraftEventToWikiAuthorizedUsers publishes a draft-activity WebSocket event only to
// channel members who have read_wiki permission on the wiki's team. This prevents editor
// identity (who is editing which page) from leaking to arbitrary members of a linked source
// channel who have no wiki access.
//
// Implementation: batch-fetch team memberships for each source channel's members and check
// read_wiki via role grants. Members not found in the team (or whose role lacks read_wiki)
// are added to OmitUsers on the channel-scoped broadcast so the hub filters them out.
func (a *App) publishDraftEventToWikiAuthorizedUsers(rctx request.CTX, wiki *model.Wiki, message *model.WebSocketEvent) {
	links, err := a.Srv().Store().ChannelMemberLink().GetByWiki(wiki.Id)
	if err != nil {
		a.Log().Warn("Failed to fetch wiki links for draft broadcast", mlog.Err(err))
		return
	}
	for _, link := range links {
		memberIds, err := a.Srv().Store().Channel().GetAllChannelMemberIdsByChannelId(link.SourceId)
		if err != nil {
			a.Log().Warn("Failed to fetch channel members for draft broadcast",
				mlog.String("channel_id", link.SourceId), mlog.Err(err))
			continue
		}
		if len(memberIds) == 0 {
			continue
		}

		// Batch-check team membership + role grants for all channel members.
		authorizedSet := make(map[string]bool, len(memberIds))
		if wiki.TeamId != "" {
			teamMembers, tmErr := a.GetTeamMembersByIds(wiki.TeamId, memberIds, nil)
			if tmErr == nil {
				for _, tm := range teamMembers {
					if tm.DeleteAt == 0 && a.RolesGrantPermission(tm.GetRoles(), model.PermissionReadWiki.Id) {
						authorizedSet[tm.UserId] = true
					}
				}
			} else {
				a.Log().Warn("Failed to fetch team members for draft broadcast", mlog.Err(tmErr))
			}
		}
		// Fall back to team-scoped check for users not covered by the batch team-member
		// fetch (e.g. system admins added to the channel outside normal team flow).
		for _, uid := range memberIds {
			if !authorizedSet[uid] && a.HasPermissionToTeam(rctx, uid, wiki.TeamId, model.PermissionReadWiki) {
				authorizedSet[uid] = true
			}
		}

		var omitUsers map[string]bool
		for _, uid := range memberIds {
			if !authorizedSet[uid] {
				if omitUsers == nil {
					omitUsers = make(map[string]bool)
				}
				omitUsers[uid] = true
			}
		}
		msg := message.SetBroadcast(&model.WebsocketBroadcast{
			ChannelId:           link.SourceId,
			OmitUsers:           omitUsers,
			ReliableClusterSend: true,
		})
		a.Publish(msg)
	}
}

// BroadcastPageDraftUpdated broadcasts a draft update to wiki-authorized users in linked
// source channels. Only metadata is included; content is never broadcast cross-user.
func (a *App) BroadcastPageDraftUpdated(rctx request.CTX, wiki *model.Wiki, draft *model.PageDraft) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageDraftUpdated, "", "", "", nil, "")
	message.Add("page_id", draft.PageId)
	message.Add("user_id", draft.UserId)
	message.Add("timestamp", draft.UpdateAt)
	a.publishDraftEventToWikiAuthorizedUsers(rctx, wiki, message)
}

// BroadcastPageDraftDeleted broadcasts a draft deletion to wiki-authorized users in linked
// source channels. The deleted_at timestamp lets clients suppress stale refetches.
func (a *App) BroadcastPageDraftDeleted(rctx request.CTX, wiki *model.Wiki, pageId, userId string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageDraftDeleted, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	message.Add("deleted_at", model.GetMillis())
	a.publishDraftEventToWikiAuthorizedUsers(rctx, wiki, message)
}

// BroadcastPageDraftMoved broadcasts a draft parent change to wiki-authorized users in linked
// source channels.
func (a *App) BroadcastPageDraftMoved(rctx request.CTX, wiki *model.Wiki, pageId, userId string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageDraftUpdated, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	a.publishDraftEventToWikiAuthorizedUsers(rctx, wiki, message)
}

// BroadcastPageEditorStopped broadcasts that a user has stopped editing a page to
// wiki-authorized users in linked source channels.
func (a *App) BroadcastPageEditorStopped(rctx request.CTX, wiki *model.Wiki, pageId, userId string) {
	message := model.NewWebSocketEvent(model.WebsocketEventPageEditorStopped, "", "", "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	a.publishDraftEventToWikiAuthorizedUsers(rctx, wiki, message)
}

// PublishPageDraft publishes a draft as a page.
// Uses PublishPageDraftOptions to consolidate the many parameters into a structured options object.
func (a *App) PublishPageDraft(rctx request.CTX, userId string, opts model.PublishPageDraftOptions) (*model.Page, *model.AppError) {
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

	// Check if this is creating a new page or updating an existing one (for rollback logic)
	// Only treat ErrNotFound as "new page" - other errors should propagate
	existingPage, existingPageErr := a.GetPage(rctx, opts.PageId)
	var isNewPage bool
	if existingPageErr != nil {
		if existingPageErr.StatusCode == http.StatusNotFound {
			isNewPage = true
		} else {
			return nil, existingPageErr
		}
	}

	// For updates, save original state for potential rollback
	var originalMessage string
	var originalParentId string
	var originalStatus string
	if !isNewPage {
		originalParentId = existingPage.ParentId
		originalMessage = existingPage.Body
		if s, sErr := a.GetPageStatus(rctx, opts.PageId); sErr == nil {
			originalStatus = s
		} else {
			rctx.Logger().Warn("PublishPageDraft: failed to fetch original page status, status rollback will be skipped",
				mlog.String("page_id", opts.PageId), mlog.Err(sErr))
		}
	}

	rctx.Logger().Info("PublishPageDraft: applying draft to page",
		mlog.String("page_id", opts.PageId),
		mlog.String("wiki_id", opts.WikiId),
		mlog.String("user_id", userId),
		mlog.Int("base_edit_at", opts.BaseEditAt),
		mlog.Bool("is_new_page", isNewPage),
	)
	savedPost, err := a.applyDraftToPage(rctx, draft, existingPage, opts.WikiId, opts.ParentId, opts.Title, opts.SearchText, opts.Content, userId, opts.BaseEditAt, opts.Force)
	if err != nil {
		return nil, err
	}

	// Enrich the page with properties immediately after publishing (use master for read-after-write consistency)
	a.EnrichPageWithProperties(RequestContextWithMaster(rctx), savedPost, true)

	// Delete draft from both tables - this MUST succeed to maintain consistency
	if deleteErr := a.DeletePageDraft(rctx, userId, opts.WikiId, opts.PageId); deleteErr != nil {
		rctx.Logger().Error("Failed to delete draft after successful publish - attempting rollback",
			mlog.String("page_id", opts.PageId), mlog.Err(deleteErr))

		// Attempt rollback based on whether this was a new page or an update
		if isNewPage {
			// For new pages: delete the newly created page (DeletePage handles PropertyValue cleanup)
			if rollbackErr := a.DeletePage(rctx, savedPost, opts.WikiId); rollbackErr != nil {
				rctx.Logger().Error("CRITICAL: Failed to rollback page creation after draft deletion failure - data inconsistency",
					mlog.String("page_id", savedPost.Id),
					mlog.String("draft_id", opts.PageId),
					mlog.Err(rollbackErr))
			}
		} else {
			// For updates: restore original content (even when original message was empty)
			if rollbackErr := a.rollbackPageUpdate(rctx, savedPost.Id, opts.WikiId, userId, originalMessage, originalParentId, opts.ParentId, wiki.ChannelId); rollbackErr != nil {
				rctx.Logger().Error("CRITICAL: Failed to rollback page update after draft deletion failure - data inconsistency",
					mlog.String("page_id", savedPost.Id),
					mlog.String("draft_id", opts.PageId),
					mlog.Err(rollbackErr))
			}
			// Restore original status — SetPageStatus was called inside applyDraftToPage.
			// Skip if originalStatus is empty (status fetch failed before publish).
			if originalStatus != "" {
				if statusRollbackErr := a.SetPageStatus(rctx, savedPost.Id, originalStatus); statusRollbackErr != nil {
					rctx.Logger().Error("CRITICAL: Failed to rollback page status after draft deletion failure - data inconsistency",
						mlog.String("page_id", savedPost.Id),
						mlog.String("original_status", originalStatus),
						mlog.Err(statusRollbackErr))
				}
			}
		}
		return nil, model.NewAppError("PublishPageDraft", "app.draft.publish.delete_draft_failed.app_error",
			nil, "failed to delete draft after publish", http.StatusInternalServerError).Wrap(deleteErr)
	}

	// Update child draft references - less critical, log error but don't fail the operation
	if updateErr := a.updateChildDraftParentReferences(rctx, userId, opts.WikiId, wiki, opts.PageId, savedPost.Id); updateErr != nil {
		rctx.Logger().Warn("Failed to update child draft parent references - child drafts may have stale parent IDs",
			mlog.String("page_id", savedPost.Id), mlog.Err(updateErr))
	}

	// Note: Content is already set on savedPost by applyDraftToPage, no extra fetch needed

	// Broadcast to all clients in the channel
	a.BroadcastPagePublished(savedPost, opts.WikiId, opts.PageId, userId)

	return savedPost, nil
}

// rollbackPageUpdate restores a page to its original state after a failed publish operation.
// This is used when draft deletion fails after a page update was successfully applied.
// It broadcasts the restored state so clients that already received the PagePublished event
// revert their local view rather than displaying stale published content.
func (a *App) rollbackPageUpdate(rctx request.CTX, pageId, wikiId, userId, originalMessage, originalParentId, newParentId, channelId string) *model.AppError {
	// Restore original content via UpdatePageWithContent
	if _, err := a.Srv().Store().Page().UpdatePageWithContent(rctx, pageId, "", originalMessage); err != nil {
		return model.NewAppError("rollbackPageUpdate", "app.draft.rollback.content_restore_failed",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.invalidateCacheForChannelPosts(channelId)

	// Restore parent if it was changed
	if originalParentId != newParentId {
		if _, err := a.MovePage(rctx, pageId, &originalParentId, "", nil); err != nil {
			rctx.Logger().Warn("Failed to restore original parent during rollback - content was restored but hierarchy may be inconsistent",
				mlog.String("page_id", pageId),
				mlog.String("original_parent", originalParentId),
				mlog.Err(err))
		}
	}

	// Broadcast the restored state. Clients that received PagePublished before the rollback
	// will update to the pre-publish content; clients that haven't yet refreshed will get
	// the correct state. Use master to guarantee read-after-write consistency.
	if restoredPage, fetchErr := a.GetPage(RequestContextWithMaster(rctx), pageId); fetchErr == nil {
		a.BroadcastPagePublished(restoredPage, wikiId, "", userId)
	} else {
		rctx.Logger().Warn("Failed to fetch page for rollback broadcast; clients may show stale published content",
			mlog.String("page_id", pageId), mlog.Err(fetchErr))
	}

	rctx.Logger().Info("Successfully rolled back page update",
		mlog.String("page_id", pageId),
		mlog.String("original_parent", originalParentId))

	return nil
}

// CheckPageDraftExists checks if a page draft exists for the given pageId, userId, and wikiId.
func (a *App) CheckPageDraftExists(rctx request.CTX, pageId, userId, wikiId string) (bool, *model.AppError) {
	_, err := a.Srv().Store().Draft().GetPageDraft(pageId, userId, wikiId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return false, nil
		}
		return false, model.NewAppError("CheckPageDraftExists", "app.draft.page_draft_exists.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return true, nil
}

func (a *App) updateChildDraftParentReferences(rctx request.CTX, userId, wikiId string, wiki *model.Wiki, oldPageId, newPageId string) *model.AppError {
	updatedDrafts, err := a.Srv().Store().Draft().BatchUpdateDraftParentId(userId, wikiId, oldPageId, newPageId)
	if err != nil {
		return model.NewAppError("updateChildDraftParentReferences", "app.draft.batch_update_parent.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, draft := range updatedDrafts {
		message := model.NewWebSocketEvent(model.WebsocketEventPageDraftUpdated, "", "", "", nil, "")
		message.Add("page_id", draft.RootId)
		message.Add("user_id", draft.UserId)
		message.Add("timestamp", draft.UpdateAt)
		a.publishDraftEventToWikiAuthorizedUsers(rctx, wiki, message)
	}

	return nil
}
