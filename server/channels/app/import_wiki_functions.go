// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

// Regex patterns for CONF placeholders in page content.
// Uses ((?:[^{}\\]|\\[{}])*) to handle escaped braces in titles/IDs.
// This allows titles like "Function() { return true; }" to work correctly
// when escaped as "Function() \{ return true; \}".
var confFilePlaceholderRegex = regexp.MustCompile(`\{\{CONF_FILE:((?:[^{}\\]|\\[{}])*)\}\}`)

// Regex pattern for CONF_PAGE_TITLE placeholders (page links by title)
var confPageTitlePlaceholderRegex = regexp.MustCompile(`\{\{CONF_PAGE_TITLE:((?:[^{}\\]|\\[{}])*)\}\}`)

// Regex pattern for CONF_PAGE_ID placeholders (page links by Confluence page ID)
var confPageIDPlaceholderRegex = regexp.MustCompile(`\{\{CONF_PAGE_ID:((?:[^{}\\]|\\[{}])*)\}\}`)

// importWiki imports a wiki for a channel.
// Uses Props["import_source_id"] for idempotency - matches wiki by source ID rather than position.
// This supports multi-space imports where multiple Confluence spaces become multiple wikis in one channel.
func (a *App) importWiki(rctx request.CTX, data *imports.WikiImportData, dryRun bool) *model.AppError {
	if err := imports.ValidateWikiImportData(data); err != nil {
		return err
	}

	importSourceId := getImportSourceId(data.Props)

	rctx.Logger().Info("Importing wiki",
		mlog.String("team", *data.Team),
		mlog.String("channel", *data.Channel),
		mlog.String("import_source_id", importSourceId),
	)

	if dryRun {
		return nil
	}

	team, err := a.Srv().Store().Team().GetByName(strings.ToLower(*data.Team))
	if err != nil {
		return model.NewAppError("importWiki", "app.import.import_wiki.team_not_found.error",
			map[string]any{"TeamName": *data.Team}, "", http.StatusNotFound).Wrap(err)
	}

	channel, err := a.Srv().Store().Channel().GetByName(team.Id, strings.ToLower(*data.Channel), false)
	if err != nil {
		return model.NewAppError("importWiki", "app.import.import_wiki.channel_not_found.error",
			map[string]any{"ChannelName": *data.Channel}, "", http.StatusNotFound).Wrap(err)
	}

	// Look for existing wiki with matching import_source_id
	existingWikis, appErr := a.GetWikisForChannel(rctx, channel.Id, false)
	if appErr != nil {
		return appErr
	}

	var existingWiki *model.Wiki
	for _, wiki := range existingWikis {
		// Match by import_source_id in props (for imported wikis)
		if wikiSourceId, ok := wiki.Props[model.PostPropsImportSourceId].(string); ok && wikiSourceId == importSourceId {
			existingWiki = wiki
			break
		}
		// Also match by wiki.Id (for wikis created locally, not originally imported)
		// The export uses wiki.Id as import_source_id when no import_source_id exists
		if wiki.Id == importSourceId {
			existingWiki = wiki
			break
		}
	}

	if existingWiki != nil {
		// Wiki with this import_source_id exists - update if needed
		rctx.Logger().Info("Wiki already exists, checking for updates",
			mlog.String("wiki_id", existingWiki.Id),
			mlog.String("import_source_id", importSourceId),
		)

		needsUpdate := false

		if data.Title != nil && *data.Title != existingWiki.Title {
			existingWiki.Title = *data.Title
			needsUpdate = true
		}
		if data.Description != nil && *data.Description != existingWiki.Description {
			existingWiki.Description = *data.Description
			needsUpdate = true
		}

		if needsUpdate {
			_, appErr = a.UpdateWiki(rctx, existingWiki)
			if appErr != nil {
				return appErr
			}
		}
		return nil
	}

	// Create new wiki with import_source_id
	title := channel.DisplayName + " Wiki"
	if data.Title != nil && strings.TrimSpace(*data.Title) != "" {
		title = strings.TrimSpace(*data.Title)
	}

	description := ""
	if data.Description != nil {
		description = *data.Description
	}

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		Title:       title,
		Description: description,
		Props: model.StringInterface{
			model.PostPropsImportSourceId: importSourceId,
		},
	}

	// Use system user for wiki creation during import
	_, appErr = a.CreateWiki(rctx, wiki, "")
	return appErr
}

// importResolveWikiPlaceholders resolves cross-page link placeholders after all pages are imported.
// This should be called after all pages in a channel are imported so the title -> ID mapping is complete.
func (a *App) importResolveWikiPlaceholders(rctx request.CTX, data *imports.ResolveWikiPlaceholdersImportData, dryRun bool) *model.AppError {
	if err := imports.ValidateResolveWikiPlaceholdersImportData(data); err != nil {
		return err
	}

	rctx.Logger().Info("Resolving wiki placeholders",
		mlog.String("team", *data.Team),
		mlog.String("channel", *data.Channel),
	)

	if dryRun {
		return nil
	}

	team, err := a.Srv().Store().Team().GetByName(strings.ToLower(*data.Team))
	if err != nil {
		return model.NewAppError("importResolveWikiPlaceholders", "app.import.resolve_wiki_placeholders.team_not_found.error",
			map[string]any{"TeamName": *data.Team}, "", http.StatusNotFound).Wrap(err)
	}

	channel, err := a.Srv().Store().Channel().GetByName(team.Id, strings.ToLower(*data.Channel), false)
	if err != nil {
		return model.NewAppError("importResolveWikiPlaceholders", "app.import.resolve_wiki_placeholders.channel_not_found.error",
			map[string]any{"ChannelName": *data.Channel}, "", http.StatusNotFound).Wrap(err)
	}

	// Repair orphaned page hierarchies first (pages imported before their parents)
	repaired, repairErr := a.RepairOrphanedPageHierarchy(rctx, channel.Id)
	if repairErr != nil {
		rctx.Logger().Warn("Failed to repair orphaned page hierarchies",
			mlog.String("channel_id", channel.Id),
			mlog.Err(repairErr),
		)
	} else if repaired > 0 {
		rctx.Logger().Info("Repaired orphaned page hierarchies before placeholder resolution",
			mlog.String("channel_id", channel.Id),
			mlog.Int("repaired_count", repaired),
		)
	}

	// Resolve CONF_PAGE_TITLE placeholders (links by page title)
	if appErr := a.ResolvePageTitlePlaceholders(rctx, channel.Id); appErr != nil {
		return appErr
	}

	// Resolve CONF_PAGE_ID placeholders (links by Confluence page ID)
	if appErr := a.ResolvePageIDPlaceholders(rctx, channel.Id); appErr != nil {
		return appErr
	}

	// Cleanup any remaining unresolved placeholders by converting them to broken link indicators
	if appErr := a.CleanupUnresolvedPlaceholders(rctx, channel.Id); appErr != nil {
		return appErr
	}

	return nil
}

// importPage imports a page into a wiki.
// Uses Props["import_source_id"] for idempotency - if a page with the same import_source_id exists, it's skipped.
func (a *App) importPage(rctx request.CTX, data *imports.PageImportData, dryRun bool) *model.AppError {
	if err := imports.ValidatePageImportData(data); err != nil {
		return err
	}

	importSourceId := getImportSourceId(data.Props)

	if dryRun {
		return nil
	}

	team, err := a.Srv().Store().Team().GetByName(strings.ToLower(*data.Team))
	if err != nil {
		return model.NewAppError("importPage", "app.import.import_page.team_not_found.error",
			map[string]any{"TeamName": *data.Team}, "", http.StatusNotFound).Wrap(err)
	}

	channel, err := a.Srv().Store().Channel().GetByName(team.Id, strings.ToLower(*data.Channel), false)
	if err != nil {
		return model.NewAppError("importPage", "app.import.import_page.channel_not_found.error",
			map[string]any{"ChannelName": *data.Channel}, "", http.StatusNotFound).Wrap(err)
	}

	user, err := a.Srv().Store().User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("importPage", "app.import.import_page.user_not_found.error",
			map[string]any{"Username": *data.User}, "", http.StatusBadRequest).Wrap(err)
	}

	// Get wiki for channel (must exist before pages)
	wikis, appErr := a.GetWikisForChannel(rctx, channel.Id, false)
	if appErr != nil {
		return appErr
	}
	if len(wikis) == 0 {
		return model.NewAppError("importPage", "app.import.import_page.wiki_not_found.error",
			map[string]any{"ChannelName": *data.Channel}, "", http.StatusNotFound)
	}
	wiki := wikis[0]

	// Check for existing page by import_source_id (idempotency)
	var existingPage *model.Post
	if importSourceId != "" {
		var lookupErr error
		existingPage, lookupErr = a.getPageByImportSourceId(rctx, channel.Id, importSourceId)
		if lookupErr != nil {
			return model.NewAppError("importPage", "app.import.import_page.lookup_error", nil, "", http.StatusInternalServerError).Wrap(lookupErr)
		}
	}

	// Resolve parent page if specified
	var parentId string
	var deferredParentSourceId string
	if data.ParentImportSourceId != nil && *data.ParentImportSourceId != "" {
		parentPage, perr := a.getPageByImportSourceId(rctx, channel.Id, *data.ParentImportSourceId)
		if perr != nil {
			return model.NewAppError("importPage", "app.import.import_page.parent_lookup_error", nil, "", http.StatusInternalServerError).Wrap(perr)
		}
		if parentPage != nil {
			if parentPage.ChannelId != channel.Id {
				return model.NewAppError("importPage", "app.import.import_page.parent_wrong_channel.app_error",
					nil, "parent page is in different channel", http.StatusBadRequest)
			}
			parentId = parentPage.Id
		} else {
			// Parent not found yet - store for deferred hierarchy repair
			deferredParentSourceId = *data.ParentImportSourceId
			rctx.Logger().Warn("Parent page not found by import_source_id, will attempt repair later",
				mlog.String("parent_import_source_id", *data.ParentImportSourceId),
			)
		}
	}

	if existingPage != nil {
		rctx.Logger().Info("Page already exists, skipping",
			mlog.String("page_id", existingPage.Id),
			mlog.String("import_source_id", importSourceId),
		)
		return nil
	}

	// Create new page
	page, appErr := a.CreateWikiPage(rctx, wiki.Id, parentId, *data.Title, *data.Content, user.Id, "", "")
	if appErr != nil {
		return appErr
	}

	if propsErr := a.updatePostPropsFromImport(rctx, page, data.Props); propsErr != nil {
		return propsErr
	}

	// Preserve original CreateAt for page ordering (pages are ordered by CreateAt)
	if data.CreateAt != nil && *data.CreateAt > 0 && *data.CreateAt != page.CreateAt {
		page.CreateAt = *data.CreateAt
		// Use Overwrite to update CreateAt without creating a version history entry
		if _, err := a.Srv().Store().Post().Overwrite(rctx, page); err != nil {
			rctx.Logger().Warn("Failed to set CreateAt for imported page",
				mlog.String("page_id", page.Id),
				mlog.Millis("create_at", *data.CreateAt),
				mlog.Err(err),
			)
		}
	}

	// Store parent_import_source_id for deferred hierarchy repair if parent wasn't found
	if deferredParentSourceId != "" {
		oldPage := page.Clone()
		page.AddProp("parent_import_source_id", deferredParentSourceId)
		if _, updateErr := a.Srv().Store().Post().Update(rctx, page, oldPage); updateErr != nil {
			rctx.Logger().Warn("Failed to store parent_import_source_id for deferred repair",
				mlog.String("page_id", page.Id),
				mlog.Err(updateErr),
			)
		}
	}

	// Import attachments if provided
	if data.Attachments != nil && len(*data.Attachments) > 0 {
		rctx.Logger().Info("Importing page attachments",
			mlog.String("page_id", page.Id),
			mlog.Int("count", len(*data.Attachments)),
		)

		fileIDs, sourceIDMappings, failedAttachments := a.uploadWikiAttachments(rctx, data.Attachments, page, team.Id)

		// Report failed attachments summary
		if len(failedAttachments) > 0 {
			rctx.Logger().Warn("Some attachments failed to import for page",
				mlog.String("page_id", page.Id),
				mlog.Int("total_attachments", len(*data.Attachments)),
				mlog.Int("successful", len(fileIDs)),
				mlog.Int("failed", len(failedAttachments)),
				mlog.Any("failed_source_ids", failedAttachments),
			)
		}

		if len(fileIDs) > 0 {
			// Update page with file IDs
			page.FileIds = make([]string, 0, len(fileIDs))
			for fileID := range fileIDs {
				page.FileIds = append(page.FileIds, fileID)
			}
			a.updateFileInfoWithPostId(rctx, page)
		}

		// Store source ID -> file ID mappings for later link resolution
		if len(sourceIDMappings) > 0 {
			page.AddProp(model.PostPropsImportFileMappings, sourceIDMappings)
		}

		// Resolve CONF_FILE placeholders in page content using source ID mappings
		if len(sourceIDMappings) > 0 {
			if resolveErr := a.resolveFilePlaceholders(rctx, page.Id, sourceIDMappings); resolveErr != nil {
				rctx.Logger().Warn("Failed to resolve file placeholders",
					mlog.String("page_id", page.Id),
					mlog.Err(resolveErr),
				)
			}
		}
	}

	// Import nested comments if provided (pass page to avoid N+1 lookups)
	if data.Comments != nil {
		for _, commentData := range *data.Comments {
			commentData.PageImportSourceId = &importSourceId
			if err := a.importPageComment(rctx, &commentData, false, page); err != nil {
				commentSourceId := getImportSourceId(commentData.Props)
				return model.NewAppError("importPage", "app.import.import_page.nested_comment_failed.error",
					map[string]any{"PageId": page.Id, "CommentSourceId": commentSourceId},
					"", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

// importPageComment imports a comment on a page.
// Uses Props["import_source_id"] for idempotency.
// If page is provided, skips the page lookup (used when called from importPage to avoid N+1 queries).
func (a *App) importPageComment(rctx request.CTX, data *imports.PageCommentImportData, dryRun bool, page *model.Post) *model.AppError {
	if err := imports.ValidatePageCommentImportData(data); err != nil {
		return err
	}

	importSourceId := getImportSourceId(data.Props)

	rctx.Logger().Info("Importing page comment",
		mlog.String("page_import_source_id", *data.PageImportSourceId),
		mlog.String("user", *data.User),
		mlog.String("import_source_id", importSourceId),
	)

	if dryRun {
		return nil
	}

	user, err := a.Srv().Store().User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("importPageComment", "app.import.import_page_comment.user_not_found.error",
			map[string]any{"Username": *data.User}, "", http.StatusBadRequest).Wrap(err)
	}

	// Use provided page or look it up (standalone comment import)
	if page == nil {
		var appErr *model.AppError
		page, appErr = a.findPageByImportSourceId(rctx, *data.PageImportSourceId)
		if appErr != nil {
			return appErr
		}
		if page == nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.page_not_found.error",
				map[string]any{"PageImportSourceId": *data.PageImportSourceId}, "", http.StatusNotFound)
		}
	}

	// Check for existing comment by import_source_id (idempotency)
	if importSourceId != "" {
		existingComment, cerr := a.getCommentByImportSourceId(rctx, page.Id, importSourceId)
		if cerr != nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.lookup_error", nil, "", http.StatusInternalServerError).Wrap(cerr)
		}
		if existingComment != nil {
			rctx.Logger().Info("Comment already exists, skipping",
				mlog.String("comment_id", existingComment.Id),
				mlog.String("import_source_id", importSourceId),
			)
			return nil
		}
	}

	// Resolve parent comment if this is a reply
	var parentCommentId string
	if data.ParentCommentImportSourceId != nil && *data.ParentCommentImportSourceId != "" {
		parentComment, perr := a.getCommentByImportSourceId(rctx, page.Id, *data.ParentCommentImportSourceId)
		if perr != nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.parent_lookup_error", nil, "", http.StatusInternalServerError).Wrap(perr)
		}
		if parentComment != nil {
			// Check if parent is itself a reply (has parent_comment_id in Props)
			// If so, flatten the hierarchy by using the top-level parent instead
			// Our system only supports one level of comment nesting
			if grandparentId, ok := parentComment.GetProp("parent_comment_id").(string); ok && grandparentId != "" {
				rctx.Logger().Info("Flattening nested comment reply to single level",
					mlog.String("import_source_id", importSourceId),
					mlog.String("original_parent_id", parentComment.Id),
					mlog.String("flattened_to_parent_id", grandparentId),
				)
				parentCommentId = grandparentId
			} else {
				parentCommentId = parentComment.Id
			}
		}
	}

	// Create comment using the context with the import user's session
	session := &model.Session{UserId: user.Id}
	rctx = rctx.WithSession(session)

	// Extract inline_anchor from props if present (for inline comments from Confluence)
	// This ensures CreatePageComment sets comment_type: "inline" correctly
	var inlineAnchor map[string]any
	if data.Props != nil {
		if anchor, ok := (*data.Props)["inline_anchor"].(map[string]any); ok {
			inlineAnchor = anchor
		}
	}

	var comment *model.Post
	var createErr *model.AppError
	if parentCommentId != "" {
		comment, createErr = a.CreatePageCommentReply(rctx, page.Id, parentCommentId, *data.Content, "", nil, nil)
	} else {
		comment, createErr = a.CreatePageComment(rctx, page.Id, *data.Content, inlineAnchor, "", nil, nil)
	}

	if createErr != nil {
		return createErr
	}

	// Update props first
	if propsErr := a.updatePostPropsFromImport(rctx, comment, data.Props); propsErr != nil {
		return propsErr
	}

	// If the comment was resolved in the source system, resolve it here too
	if data.IsResolved != nil && *data.IsResolved {
		// Pass nil for page/channel - function will fetch if needed for WebSocket event
		_, resolveErr := a.ResolvePageComment(rctx, comment, user.Id, nil, nil)
		if resolveErr != nil {
			rctx.Logger().Warn("Failed to resolve imported comment",
				mlog.String("comment_id", comment.Id),
				mlog.Err(resolveErr),
			)
			// Don't fail the import, just log the warning
		}
	}

	return nil
}

// getImportSourceId extracts the import_source_id from Props map
func getImportSourceId(props *model.StringInterface) string {
	if props == nil {
		return ""
	}
	if id, ok := (*props)[model.PostPropsImportSourceId].(string); ok {
		return strings.TrimSpace(id)
	}
	return ""
}

// getPageByImportSourceId finds a page by its import_source_id in Props within a channel.
// Also checks if a page's ID matches the importSourceId (for locally created pages).
func (a *App) getPageByImportSourceId(rctx request.CTX, channelId, importSourceId string) (*model.Post, error) {
	if !model.IsValidId(channelId) {
		return nil, errors.New("invalid channel ID")
	}

	// First, try to find by import_source_id in Props (for imported pages)
	posts, err := a.Srv().Store().Post().GetPostsByTypeAndProps(channelId, model.PostTypePage, model.PostPropsImportSourceId, importSourceId)
	if err != nil {
		return nil, err
	}
	if len(posts) > 0 {
		return posts[0], nil
	}

	// Also check if a page exists with ID matching importSourceId (for locally created pages)
	// The export uses page.Id as import_source_id when no import_source_id exists
	if model.IsValidId(importSourceId) {
		post, err := a.Srv().Store().Post().GetSingle(rctx, importSourceId, false)
		if err == nil && post != nil && post.Type == model.PostTypePage && post.ChannelId == channelId {
			return post, nil
		}
	}

	return nil, nil
}

// findPageByImportSourceId finds a page by import_source_id across all channels.
// This is a more expensive query - search across all pages.
// Also checks if a page's ID matches the importSourceId (for locally created pages).
func (a *App) findPageByImportSourceId(rctx request.CTX, importSourceId string) (*model.Post, *model.AppError) {
	// First, try to find by import_source_id in Props (for imported pages)
	posts, err := a.Srv().Store().Post().GetPostsByTypeAndPropsGlobal(model.PostTypePage, model.PostPropsImportSourceId, importSourceId)
	if err != nil {
		return nil, model.NewAppError("findPageByImportSourceId", "app.import.find_page.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(posts) > 0 {
		return posts[0], nil
	}

	// Also check if a page exists with ID matching importSourceId (for locally created pages)
	if model.IsValidId(importSourceId) {
		post, perr := a.Srv().Store().Post().GetSingle(rctx, importSourceId, false)
		if perr == nil && post != nil && post.Type == model.PostTypePage {
			return post, nil
		}
	}

	return nil, nil
}

// getCommentByImportSourceId finds a comment by its import_source_id for a specific page.
// It searches both regular comments (using RootId) and inline comments (using props.page_id).
func (a *App) getCommentByImportSourceId(rctx request.CTX, pageId, importSourceId string) (*model.Post, error) {
	// First, try to find by RootId (regular page comments)
	posts, err := a.Srv().Store().Post().GetPostRepliesByTypeAndProps(pageId, model.PostTypePageComment, model.PostPropsImportSourceId, importSourceId)
	if err != nil {
		return nil, err
	}
	if len(posts) > 0 {
		return posts[0], nil
	}

	// If not found, search for inline comments which have page_id in props instead of RootId
	posts, err = a.Srv().Store().Post().GetPageCommentsByPageIdPropAndImportSourceId(pageId, importSourceId)
	if err != nil {
		return nil, err
	}
	if len(posts) > 0 {
		return posts[0], nil
	}

	return nil, nil
}

// allowedImportProps is the allowlist of props that can be set during import.
// This prevents injection of arbitrary props like from_bot, override_username, etc.
var allowedImportProps = map[string]bool{
	"import_source_id":        true,
	"inline_anchor":           true,
	"parent_import_source_id": true,
	"page_status":             true,
}

// updatePostPropsFromImport merges allowed import Props into an existing post.
// Only props in allowedImportProps are accepted; others are logged and ignored.
// For import_source_id, the value must be a non-empty string.
func (a *App) updatePostPropsFromImport(rctx request.CTX, post *model.Post, props *model.StringInterface) *model.AppError {
	if props == nil {
		return nil
	}

	oldPost := post.Clone()
	propsSet := false

	for key, value := range *props {
		if !allowedImportProps[key] {
			rctx.Logger().Warn("Ignoring disallowed import prop",
				mlog.String("post_id", post.Id),
				mlog.String("prop_key", key),
			)
			continue
		}

		// Validate import_source_id must be a non-empty string
		if key == model.PostPropsImportSourceId {
			strValue, ok := value.(string)
			if !ok {
				rctx.Logger().Warn("Ignoring import_source_id with non-string value",
					mlog.String("post_id", post.Id),
					mlog.Any("value_type", value),
				)
				continue
			}
			if strValue == "" {
				rctx.Logger().Warn("Ignoring empty import_source_id",
					mlog.String("post_id", post.Id),
				)
				continue
			}
		}

		// Validate inline_anchor must have a valid structure with "text" key
		if key == "inline_anchor" {
			anchorMap, ok := value.(map[string]any)
			if !ok {
				rctx.Logger().Warn("Ignoring inline_anchor with invalid type",
					mlog.String("post_id", post.Id),
					mlog.Any("value_type", value),
				)
				continue
			}
			text, hasText := anchorMap["text"]
			if !hasText {
				rctx.Logger().Warn("Ignoring inline_anchor without text key",
					mlog.String("post_id", post.Id),
				)
				continue
			}
			textStr, ok := text.(string)
			if !ok || textStr == "" {
				rctx.Logger().Warn("Ignoring inline_anchor with empty or non-string text",
					mlog.String("post_id", post.Id),
				)
				continue
			}
		}

		post.AddProp(key, value)
		propsSet = true
	}

	if !propsSet {
		return nil
	}

	// For pages, Message may have been populated by loadPageContentForPost after creation.
	// Clear it before Update since page content is stored in PageContents table, not Post.Message.
	// Post.Update() validates Message against maxPostSize, which would fail for large pages.
	// NOTE: Only clear for PostTypePage, NOT PostTypePageComment - comments store content in Message.
	if post.Type == model.PostTypePage {
		post.Message = ""
		oldPost.Message = ""
	}

	if _, err := a.Srv().Store().Post().Update(rctx, post, oldPost); err != nil {
		return model.NewAppError("updatePostPropsFromImport", "app.import.update_post_props.app_error",
			map[string]any{"PostId": post.Id}, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// uploadWikiAttachments imports attachments for a wiki page and tracks import_source_id mappings.
// Returns:
//   - fileIDs: map of Mattermost file IDs that were imported
//   - sourceIDMappings: map of import_source_id -> Mattermost file ID (for placeholder and link resolution)
//   - failedAttachments: slice of source IDs for attachments that failed to import
func (a *App) uploadWikiAttachments(rctx request.CTX, attachments *[]imports.AttachmentImportData, post *model.Post, teamID string) (map[string]bool, map[string]string, []string) {
	if attachments == nil {
		return nil, nil, nil
	}

	fileIDs := make(map[string]bool)
	sourceIDMappings := make(map[string]string)
	var failedAttachments []string

	for _, attachment := range *attachments {
		fileInfo, err := a.importAttachment(rctx, &attachment, post, teamID, false)
		if err != nil {
			// Track the failed attachment source ID
			var sourceID string
			if attachment.Props != nil {
				sourceID, _ = (*attachment.Props)[model.PostPropsImportSourceId].(string)
			}
			if sourceID != "" {
				failedAttachments = append(failedAttachments, sourceID)
			}

			if attachment.Path != nil {
				rctx.Logger().Warn(
					"failed to import wiki attachment",
					mlog.String("path", *attachment.Path),
					mlog.String("source_id", sourceID),
					mlog.String("error", err.Error()))
			} else {
				rctx.Logger().Warn("failed to import wiki attachment; path was nil",
					mlog.String("source_id", sourceID),
					mlog.String("error", err.Error()))
			}
			continue
		}

		fileIDs[fileInfo.Id] = true

		// Track import_source_id -> file ID mapping for placeholder and link resolution
		if attachment.Props != nil {
			if sourceID, ok := (*attachment.Props)[model.PostPropsImportSourceId].(string); ok && sourceID != "" {
				sourceIDMappings[sourceID] = fileInfo.Id
				rctx.Logger().Debug("Mapped wiki attachment by source_id",
					mlog.String("source_id", sourceID),
					mlog.String("file_id", fileInfo.Id),
				)
			}
		}
	}

	return fileIDs, sourceIDMappings, failedAttachments
}

// resolveFilePlaceholders replaces {{CONF_FILE:source_id}} placeholders in page content
// with actual Mattermost file URLs.
func (a *App) resolveFilePlaceholders(rctx request.CTX, pageId string, sourceIDMappings map[string]string) *model.AppError {
	// Get current page content
	pageContent, err := a.Srv().Store().Page().GetPageContent(pageId)
	if err != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.get_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(err)
	}

	if pageContent == nil || len(pageContent.Content.Content) == 0 {
		return nil
	}

	// Serialize TipTapDocument to JSON string for placeholder replacement
	contentJSON, jsonErr := json.Marshal(pageContent.Content)
	if jsonErr != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.serialize_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	originalContentStr := string(contentJSON)
	resolvedContentStr := originalContentStr

	// Find all placeholders and replace them
	matches := confFilePlaceholderRegex.FindAllStringSubmatch(resolvedContentStr, -1)
	replacementsCount := 0

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		placeholder := match[0] // Full match: {{CONF_FILE:attachment_source_id}}
		sourceID := match[1]    // Captured group: attachment_source_id

		fileId, ok := sourceIDMappings[sourceID]
		if !ok {
			rctx.Logger().Warn("File placeholder source ID not found in mappings",
				mlog.String("page_id", pageId),
				mlog.String("source_id", sourceID),
			)
			continue
		}

		// Replace placeholder with Mattermost file URL
		fileURL := "/api/v4/files/" + fileId
		resolvedContentStr = strings.Replace(resolvedContentStr, placeholder, fileURL, 1)
		replacementsCount++

		rctx.Logger().Debug("Resolved file placeholder",
			mlog.String("page_id", pageId),
			mlog.String("source_id", sourceID),
			mlog.String("file_id", fileId),
			mlog.String("file_url", fileURL),
		)
	}

	if replacementsCount == 0 || resolvedContentStr == originalContentStr {
		return nil
	}

	// Deserialize back to TipTapDocument
	var resolvedContent model.TipTapDocument
	if jsonErr := json.Unmarshal([]byte(resolvedContentStr), &resolvedContent); jsonErr != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.deserialize_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	// Update page content with resolved placeholders
	pageContent.Content = resolvedContent
	if _, err := a.Srv().Store().Page().UpdatePageContent(pageContent); err != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.update_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Resolved file placeholders in page content",
		mlog.String("page_id", pageId),
		mlog.Int("replacements_count", replacementsCount),
	)

	return nil
}

// ResolvePageTitlePlaceholders resolves {{CONF_PAGE_TITLE:title}} placeholders
// in page content by looking up page IDs by title.
// This should be called after all pages are imported so the title -> ID mapping is complete.
func (a *App) ResolvePageTitlePlaceholders(rctx request.CTX, channelId string) *model.AppError {
	// Get channel to find team
	channel, err := a.Srv().Store().Channel().Get(channelId, false)
	if err != nil {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.channel_not_found.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusNotFound).Wrap(err)
	}

	// Get team for URL generation
	team, err := a.Srv().Store().Team().Get(channel.TeamId)
	if err != nil {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.team_not_found.error",
			map[string]any{"TeamId": channel.TeamId}, "", http.StatusNotFound).Wrap(err)
	}

	// Get wiki for channel (use first wiki for URL generation)
	wikis, appErr := a.GetWikisForChannel(rctx, channelId, false)
	if appErr != nil {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.get_wikis.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusInternalServerError).Wrap(appErr)
	}
	if len(wikis) == 0 {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.no_wiki.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusNotFound)
	}
	wikiId := wikis[0].Id

	// Get all pages in the channel
	postList, appErr := a.GetChannelPages(rctx, channelId)
	if appErr != nil {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.get_pages.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusInternalServerError).Wrap(appErr)
	}

	pages := postList.ToSlice()
	if len(pages) == 0 {
		return nil
	}

	// Build title -> page ID mapping (case-insensitive)
	titleToPageID := make(map[string]string)
	for _, page := range pages {
		title := page.GetProp("title")
		if titleStr, ok := title.(string); ok && titleStr != "" {
			titleToPageID[strings.ToLower(titleStr)] = page.Id
		}
	}

	rctx.Logger().Info("Built page title mapping for placeholder resolution",
		mlog.String("channel_id", channelId),
		mlog.Int("page_count", len(titleToPageID)),
	)

	// Batch fetch all page contents to avoid N+1 queries
	pageIDs := make([]string, len(pages))
	for i, page := range pages {
		pageIDs[i] = page.Id
	}
	pageContents, batchErr := a.Srv().Store().Page().GetManyPageContents(pageIDs)
	if batchErr != nil {
		rctx.Logger().Warn("Failed to batch fetch page contents for placeholder resolution",
			mlog.String("channel_id", channelId),
			mlog.Err(batchErr),
		)
		return nil
	}

	// Build pageId -> pageContent map
	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, pc := range pageContents {
		if pc != nil {
			contentMap[pc.PageId] = pc
		}
	}

	// Process each page using the pre-fetched content
	totalResolved := 0
	for _, page := range pages {
		pageContent, ok := contentMap[page.Id]
		if !ok || pageContent == nil || len(pageContent.Content.Content) == 0 {
			continue
		}

		// Serialize TipTapDocument to JSON string for placeholder replacement
		contentJSON, jsonErr := json.Marshal(pageContent.Content)
		if jsonErr != nil {
			rctx.Logger().Warn("Failed to serialize page content",
				mlog.String("page_id", page.Id),
				mlog.Err(jsonErr),
			)
			continue
		}

		originalContentStr := string(contentJSON)
		resolvedContentStr := originalContentStr

		// Find all CONF_PAGE_TITLE placeholders and replace them
		matches := confPageTitlePlaceholderRegex.FindAllStringSubmatch(resolvedContentStr, -1)
		replacementsCount := 0

		for _, match := range matches {
			if len(match) < 2 {
				continue
			}

			placeholder := match[0] // Full match: {{CONF_PAGE_TITLE:Page Title}}
			title := match[1]       // Captured group: Page Title

			// Unescape the title (handle escaped braces)
			title = strings.ReplaceAll(title, "\\}", "}")
			title = strings.ReplaceAll(title, "\\{", "{")

			pageID, ok := titleToPageID[strings.ToLower(title)]
			if !ok {
				rctx.Logger().Warn("Page title not found for placeholder resolution",
					mlog.String("page_id", page.Id),
					mlog.String("target_title", title),
				)
				continue
			}

			// Replace placeholder with full wiki page URL
			// Format: /{teamName}/wiki/{channelId}/{wikiId}/{pageId}
			// Use url.PathEscape for team name to handle special characters
			pageURL := "/" + url.PathEscape(team.Name) + "/wiki/" + channelId + "/" + wikiId + "/" + pageID
			resolvedContentStr = strings.Replace(resolvedContentStr, placeholder, pageURL, 1)
			replacementsCount++

			rctx.Logger().Debug("Resolved page title placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("target_title", title),
				mlog.String("target_page_id", pageID),
				mlog.String("page_url", pageURL),
			)
		}

		if replacementsCount == 0 || resolvedContentStr == originalContentStr {
			continue
		}

		// Deserialize back to TipTapDocument
		var resolvedContent model.TipTapDocument
		if jsonErr := json.Unmarshal([]byte(resolvedContentStr), &resolvedContent); jsonErr != nil {
			rctx.Logger().Warn("Failed to deserialize resolved page content",
				mlog.String("page_id", page.Id),
				mlog.Err(jsonErr),
			)
			continue
		}

		// Update page content with resolved placeholders
		pageContent.Content = resolvedContent
		if _, err := a.Srv().Store().Page().UpdatePageContent(pageContent); err != nil {
			rctx.Logger().Warn("Failed to update page content with resolved placeholders",
				mlog.String("page_id", page.Id),
				mlog.Err(err),
			)
			continue
		}

		totalResolved += replacementsCount
	}

	if totalResolved > 0 {
		rctx.Logger().Info("Resolved page title placeholders",
			mlog.String("channel_id", channelId),
			mlog.Int("total_resolved", totalResolved),
		)
	}

	return nil
}

// ResolvePageIDPlaceholders resolves {{CONF_PAGE_ID:confId}} placeholders
// in page content by looking up pages by their import_source_id.
// This should be called after all pages are imported.
func (a *App) ResolvePageIDPlaceholders(rctx request.CTX, channelId string) *model.AppError {
	// Get channel, team, and wiki for URL generation
	channel, err := a.Srv().Store().Channel().Get(channelId, false)
	if err != nil {
		return model.NewAppError("ResolvePageIDPlaceholders", "app.import.resolve_page_id_placeholders.channel_not_found.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusNotFound).Wrap(err)
	}

	team, err := a.Srv().Store().Team().Get(channel.TeamId)
	if err != nil {
		return model.NewAppError("ResolvePageIDPlaceholders", "app.import.resolve_page_id_placeholders.team_not_found.error",
			map[string]any{"TeamId": channel.TeamId}, "", http.StatusNotFound).Wrap(err)
	}

	wikis, appErr := a.GetWikisForChannel(rctx, channelId, false)
	if appErr != nil {
		return appErr
	}
	if len(wikis) == 0 {
		return model.NewAppError("ResolvePageIDPlaceholders", "app.import.resolve_page_id_placeholders.no_wiki.error",
			map[string]any{"ChannelId": channelId}, "", http.StatusNotFound)
	}
	wikiId := wikis[0].Id

	// Get all pages in the channel to build import_source_id -> page ID mapping
	postList, appErr := a.GetChannelPages(rctx, channelId)
	if appErr != nil {
		return appErr
	}

	pages := postList.ToSlice()
	if len(pages) == 0 {
		return nil
	}

	// Build import_source_id (Confluence ID) -> Mattermost page ID mapping
	sourceIDToPageID := make(map[string]string)
	for _, page := range pages {
		if sourceID, ok := page.GetProp(model.PostPropsImportSourceId).(string); ok && sourceID != "" {
			sourceIDToPageID[sourceID] = page.Id
		}
	}

	rctx.Logger().Info("Built page source ID mapping for CONF_PAGE_ID resolution",
		mlog.String("channel_id", channelId),
		mlog.Int("mapping_count", len(sourceIDToPageID)),
	)

	// Batch fetch all page contents to avoid N+1 queries
	pageIDs := make([]string, len(pages))
	for i, page := range pages {
		pageIDs[i] = page.Id
	}
	pageContents, batchErr := a.Srv().Store().Page().GetManyPageContents(pageIDs)
	if batchErr != nil {
		rctx.Logger().Warn("Failed to batch fetch page contents for CONF_PAGE_ID resolution",
			mlog.String("channel_id", channelId),
			mlog.Err(batchErr),
		)
		return nil
	}

	// Build pageId -> pageContent map
	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, pc := range pageContents {
		if pc != nil {
			contentMap[pc.PageId] = pc
		}
	}

	totalResolved := 0
	for _, page := range pages {
		pageContent, ok := contentMap[page.Id]
		if !ok || pageContent == nil || len(pageContent.Content.Content) == 0 {
			continue
		}

		contentJSON, jsonErr := json.Marshal(pageContent.Content)
		if jsonErr != nil {
			continue
		}

		originalContentStr := string(contentJSON)
		resolvedContentStr := originalContentStr

		matches := confPageIDPlaceholderRegex.FindAllStringSubmatch(resolvedContentStr, -1)
		replacementsCount := 0

		for _, match := range matches {
			if len(match) < 2 {
				continue
			}

			placeholder := match[0]  // {{CONF_PAGE_ID:confId}}
			confSourceID := match[1] // Confluence page ID (stored as import_source_id)

			pageID, ok := sourceIDToPageID[confSourceID]
			if !ok {
				rctx.Logger().Warn("Page not found for CONF_PAGE_ID placeholder",
					mlog.String("page_id", page.Id),
					mlog.String("conf_source_id", confSourceID),
				)
				continue
			}

			// Generate proper wiki URL: /{teamName}/wiki/{channelId}/{wikiId}/{pageId}
			// Use url.PathEscape for team name to handle special characters
			pageURL := "/" + url.PathEscape(team.Name) + "/wiki/" + channelId + "/" + wikiId + "/" + pageID
			resolvedContentStr = strings.Replace(resolvedContentStr, placeholder, pageURL, 1)
			replacementsCount++

			rctx.Logger().Debug("Resolved CONF_PAGE_ID placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("conf_source_id", confSourceID),
				mlog.String("target_page_id", pageID),
				mlog.String("page_url", pageURL),
			)
		}

		if replacementsCount == 0 || resolvedContentStr == originalContentStr {
			continue
		}

		var resolvedContent model.TipTapDocument
		if jsonErr := json.Unmarshal([]byte(resolvedContentStr), &resolvedContent); jsonErr != nil {
			rctx.Logger().Warn("Failed to parse resolved content",
				mlog.String("page_id", page.Id),
				mlog.Err(jsonErr),
			)
			continue
		}

		pageContent.Content = resolvedContent
		if _, err := a.Srv().Store().Page().UpdatePageContent(pageContent); err != nil {
			rctx.Logger().Warn("Failed to update page content",
				mlog.String("page_id", page.Id),
				mlog.Err(err),
			)
			continue
		}

		totalResolved += replacementsCount
	}

	if totalResolved > 0 {
		rctx.Logger().Info("Resolved CONF_PAGE_ID placeholders",
			mlog.String("channel_id", channelId),
			mlog.Int("total_resolved", totalResolved),
		)
	}

	return nil
}

// Regex patterns for converting unresolved placeholders to broken link indicators.
// Uses ((?:[^{}\\]|\\[{}])*) to handle escaped braces in titles/IDs.
var (
	unresolvedPageTitleRegex = regexp.MustCompile(`\{\{CONF_PAGE_TITLE:((?:[^{}\\]|\\[{}])*)\}\}`)
	unresolvedPageIDRegex    = regexp.MustCompile(`\{\{CONF_PAGE_ID:((?:[^{}\\]|\\[{}])*)\}\}`)
	unresolvedFileRegex      = regexp.MustCompile(`\{\{CONF_FILE:((?:[^{}\\]|\\[{}])*)\}\}`)
)

// CleanupUnresolvedPlaceholders converts any remaining unresolved placeholders
// to broken link indicators like [Missing: Page Title] or [Missing Image].
// This should be called after all resolution attempts are complete.
func (a *App) CleanupUnresolvedPlaceholders(rctx request.CTX, channelId string) *model.AppError {
	// Get all pages in the channel
	postList, appErr := a.GetChannelPages(rctx, channelId)
	if appErr != nil {
		return appErr
	}

	pages := postList.ToSlice()
	if len(pages) == 0 {
		return nil
	}

	// Batch fetch all page contents to avoid N+1 queries
	pageIDs := make([]string, len(pages))
	for i, page := range pages {
		pageIDs[i] = page.Id
	}
	pageContents, batchErr := a.Srv().Store().Page().GetManyPageContents(pageIDs)
	if batchErr != nil {
		rctx.Logger().Warn("Failed to batch fetch page contents for placeholder cleanup",
			mlog.String("channel_id", channelId),
			mlog.Err(batchErr),
		)
		return nil
	}

	// Build pageId -> pageContent map
	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, pc := range pageContents {
		if pc != nil {
			contentMap[pc.PageId] = pc
		}
	}

	totalCleaned := 0
	for _, page := range pages {
		pageContent, ok := contentMap[page.Id]
		if !ok || pageContent == nil || len(pageContent.Content.Content) == 0 {
			continue
		}

		contentJSON, jsonErr := json.Marshal(pageContent.Content)
		if jsonErr != nil {
			continue
		}

		originalContentStr := string(contentJSON)
		cleanedContentStr := originalContentStr
		replacementsCount := 0

		// Convert CONF_PAGE_TITLE placeholders to [Missing: Title]
		cleanedContentStr = unresolvedPageTitleRegex.ReplaceAllStringFunc(cleanedContentStr, func(match string) string {
			submatch := unresolvedPageTitleRegex.FindStringSubmatch(match)
			if len(submatch) < 2 {
				return match
			}
			title := submatch[1]
			// Unescape the title
			title = strings.ReplaceAll(title, "\\}", "}")
			title = strings.ReplaceAll(title, "\\{", "{")
			replacementsCount++
			rctx.Logger().Debug("Converting unresolved page title placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("title", title),
			)
			return "[Missing: " + title + "]"
		})

		// Convert CONF_PAGE_ID placeholders to [Missing Page]
		cleanedContentStr = unresolvedPageIDRegex.ReplaceAllStringFunc(cleanedContentStr, func(match string) string {
			submatch := unresolvedPageIDRegex.FindStringSubmatch(match)
			if len(submatch) < 2 {
				return match
			}
			confID := submatch[1]
			replacementsCount++
			rctx.Logger().Debug("Converting unresolved page ID placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("conf_id", confID),
			)
			return "[Missing Page]"
		})

		// Convert CONF_FILE placeholders to [Missing Image]
		cleanedContentStr = unresolvedFileRegex.ReplaceAllStringFunc(cleanedContentStr, func(match string) string {
			submatch := unresolvedFileRegex.FindStringSubmatch(match)
			if len(submatch) < 2 {
				return match
			}
			fileID := submatch[1]
			replacementsCount++
			rctx.Logger().Debug("Converting unresolved file placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("file_id", fileID),
			)
			return "[Missing Image]"
		})

		if replacementsCount == 0 || cleanedContentStr == originalContentStr {
			continue
		}

		var cleanedContent model.TipTapDocument
		if jsonErr := json.Unmarshal([]byte(cleanedContentStr), &cleanedContent); jsonErr != nil {
			rctx.Logger().Warn("Failed to parse cleaned content",
				mlog.String("page_id", page.Id),
				mlog.Err(jsonErr),
			)
			continue
		}

		pageContent.Content = cleanedContent
		if _, err := a.Srv().Store().Page().UpdatePageContent(pageContent); err != nil {
			rctx.Logger().Warn("Failed to update page content after cleanup",
				mlog.String("page_id", page.Id),
				mlog.Err(err),
			)
			continue
		}

		totalCleaned += replacementsCount
	}

	if totalCleaned > 0 {
		rctx.Logger().Info("Cleaned up unresolved placeholders",
			mlog.String("channel_id", channelId),
			mlog.Int("total_cleaned", totalCleaned),
		)
	}

	return nil
}

// RepairOrphanedPageHierarchy fixes page parent relationships that were broken during import
// because child pages were imported before their parents.
// This should be called after all pages are imported.
func (a *App) RepairOrphanedPageHierarchy(rctx request.CTX, channelId string) (int, *model.AppError) {
	postList, appErr := a.GetChannelPages(rctx, channelId)
	if appErr != nil {
		return 0, appErr
	}

	pages := postList.ToSlice()
	if len(pages) == 0 {
		return 0, nil
	}

	// Build import_source_id -> page mapping
	sourceIdToPage := make(map[string]*model.Post)
	for _, page := range pages {
		if sourceId, ok := page.GetProp(model.PostPropsImportSourceId).(string); ok && sourceId != "" {
			sourceIdToPage[sourceId] = page
		}
	}

	// Find orphaned pages that have parent_import_source_id but no PageParentId
	repaired := 0
	for _, page := range pages {
		parentSourceId, ok := page.GetProp("parent_import_source_id").(string)
		if !ok || parentSourceId == "" {
			continue
		}

		// Page has a parent_import_source_id but check if PageParentId is set
		if page.PageParentId != "" {
			continue
		}

		// Find parent by import_source_id
		parentPage, exists := sourceIdToPage[parentSourceId]
		if !exists {
			rctx.Logger().Warn("Parent page not found for orphan repair",
				mlog.String("page_id", page.Id),
				mlog.String("parent_import_source_id", parentSourceId),
			)
			continue
		}

		// Update page parent using ChangePageParent (includes cycle detection)
		// Pass empty wikiId - ChangePageParent will fetch it from page props
		if changeErr := a.ChangePageParent(rctx, page.Id, parentPage.Id, ""); changeErr != nil {
			rctx.Logger().Warn("Failed to repair orphaned page hierarchy",
				mlog.String("page_id", page.Id),
				mlog.String("parent_id", parentPage.Id),
				mlog.Err(changeErr),
			)
			continue
		}

		repaired++
		rctx.Logger().Info("Repaired orphaned page hierarchy",
			mlog.String("page_id", page.Id),
			mlog.String("parent_id", parentPage.Id),
			mlog.String("parent_import_source_id", parentSourceId),
		)
	}

	if repaired > 0 {
		rctx.Logger().Info("Repaired orphaned page hierarchies",
			mlog.String("channel_id", channelId),
			mlog.Int("repaired_count", repaired),
		)
	}

	return repaired, nil
}
