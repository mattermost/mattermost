// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

// importPageBatchSize is the number of pages fetched per batch during wiki import resolution.
const importPageBatchSize = 500

// importWikiLookupBatchSize is the page size used when scanning team wikis to resolve an import_source_id.
const importWikiLookupBatchSize = 200

// getWikiByImportSourceId returns the wiki in the given team whose Props["import_source_id"]
// matches sourceId. As a fallback, a wiki whose Id equals sourceId is also returned —
// this matches how the exporter falls back to wiki.Id when the wiki has no recorded
// import_source_id (see wiki_export.go).
func (a *App) getWikiByImportSourceId(rctx request.CTX, teamId, sourceId string) (*model.Wiki, *model.AppError) {
	page := 0
	for {
		wikis, err := a.Srv().Store().Wiki().GetForTeam(teamId, page, importWikiLookupBatchSize)
		if err != nil {
			return nil, model.NewAppError("getWikiByImportSourceId", "app.wiki.get_for_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(wikis) == 0 {
			return nil, nil
		}
		for _, w := range wikis {
			if existing, ok := w.Props[model.PostPropsImportSourceId].(string); ok && existing == sourceId {
				return w, nil
			}
			if w.Id == sourceId {
				return w, nil
			}
		}
		if len(wikis) < importWikiLookupBatchSize {
			return nil, nil
		}
		page++
	}
}

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
		TeamId:      channel.TeamId,
		Title:       title,
		Description: description,
		Props: model.StringInterface{
			model.PostPropsImportSourceId: importSourceId,
		},
	}

	// Use channel creator for wiki creation during import
	savedWiki, appErr := a.CreateWiki(rctx, wiki, channel.CreatorId)
	if appErr != nil {
		return appErr
	}
	_, appErr = a.LinkWikiToChannel(rctx, savedWiki.Id, channel.Id, channel.CreatorId)
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
		mlog.String("wiki_import_source_id", *data.WikiImportSourceId),
	)

	if dryRun {
		return nil
	}

	team, err := a.Srv().Store().Team().GetByName(strings.ToLower(*data.Team))
	if err != nil {
		return model.NewAppError("importResolveWikiPlaceholders", "app.import.resolve_wiki_placeholders.team_not_found.error",
			map[string]any{"TeamName": *data.Team}, "", http.StatusNotFound).Wrap(err)
	}

	wiki, appErr := a.getWikiByImportSourceId(rctx, team.Id, *data.WikiImportSourceId)
	if appErr != nil {
		return appErr
	}
	if wiki == nil {
		return model.NewAppError("importResolveWikiPlaceholders", "app.import.resolve_wiki_placeholders.wiki_not_found.error",
			map[string]any{"WikiImportSourceId": *data.WikiImportSourceId}, "", http.StatusNotFound)
	}

	// Repair orphaned page hierarchies first (pages imported before their parents)
	repaired, repairErr := a.RepairOrphanedPageHierarchy(rctx, wiki)
	if repairErr != nil {
		rctx.Logger().Warn("Failed to repair orphaned page hierarchies",
			mlog.String("wiki_id", wiki.Id),
			mlog.Err(repairErr),
		)
	} else if repaired > 0 {
		rctx.Logger().Info("Repaired orphaned page hierarchies before placeholder resolution",
			mlog.String("wiki_id", wiki.Id),
			mlog.Int("repaired_count", repaired),
		)
	}

	// Resolve CONF_PAGE_TITLE placeholders (links by page title)
	if appErr := a.ResolvePageTitlePlaceholders(rctx, team, wiki); appErr != nil {
		return appErr
	}

	// Resolve CONF_PAGE_ID placeholders (links by Confluence page ID)
	if appErr := a.ResolvePageIDPlaceholders(rctx, team, wiki); appErr != nil {
		return appErr
	}

	// Cleanup any remaining unresolved placeholders by converting them to broken link indicators
	if appErr := a.CleanupUnresolvedPlaceholders(rctx, wiki); appErr != nil {
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

	user, err := a.Srv().Store().User().GetByUsername(*data.User)
	if err != nil {
		return model.NewAppError("importPage", "app.import.import_page.user_not_found.error",
			map[string]any{"Username": *data.User}, "", http.StatusBadRequest).Wrap(err)
	}

	wiki, appErr := a.getWikiByImportSourceId(rctx, team.Id, *data.WikiImportSourceId)
	if appErr != nil {
		return appErr
	}
	if wiki == nil {
		return model.NewAppError("importPage", "app.import.import_page.wiki_not_found.error",
			map[string]any{"WikiImportSourceId": *data.WikiImportSourceId}, "", http.StatusNotFound)
	}

	// Pages live in the wiki's backing channel
	backingChannelId := wiki.ChannelId

	// Check for existing page by import_source_id (idempotency)
	var existingPage *model.Post
	if importSourceId != "" {
		var lookupErr error
		existingPage, lookupErr = a.getPageByImportSourceId(rctx, backingChannelId, importSourceId)
		if lookupErr != nil {
			return model.NewAppError("importPage", "app.import.import_page.lookup_error", nil, "", http.StatusInternalServerError).Wrap(lookupErr)
		}
	}

	// Resolve parent page if specified
	var parentId string
	var deferredParentSourceId string
	if data.ParentImportSourceId != nil && *data.ParentImportSourceId != "" {
		parentPage, perr := a.getPageByImportSourceId(rctx, backingChannelId, *data.ParentImportSourceId)
		if perr != nil {
			return model.NewAppError("importPage", "app.import.import_page.parent_lookup_error", nil, "", http.StatusInternalServerError).Wrap(perr)
		}
		if parentPage != nil {
			if parentPage.ChannelId != backingChannelId {
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
// Nested comments (page != nil) inherit Team and WikiImportSourceId scope from their parent page,
// so they bypass the standalone validator (User+Content were already validated by ValidatePageImportData).
func (a *App) importPageComment(rctx request.CTX, data *imports.PageCommentImportData, dryRun bool, page *model.Post) *model.AppError {
	if page == nil {
		if err := imports.ValidatePageCommentImportData(data); err != nil {
			return err
		}
	} else {
		if data == nil {
			return model.NewAppError("importPageComment", "app.import.validate_page_comment_import_data.null_data.error", nil, "", http.StatusBadRequest)
		}
		if data.User == nil || strings.TrimSpace(*data.User) == "" {
			return model.NewAppError("importPageComment", "app.import.validate_page_comment_import_data.user_missing.error", nil, "", http.StatusBadRequest)
		}
		if data.Content == nil || strings.TrimSpace(*data.Content) == "" {
			return model.NewAppError("importPageComment", "app.import.validate_page_comment_import_data.content_missing.error", nil, "", http.StatusBadRequest)
		}
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

	// Use provided page or look it up (standalone comment import).
	// Standalone comments must include Team and WikiImportSourceId so the page lookup
	// is scoped to one wiki's backing channel — without this scoping, a crafted JSONL
	// can attach a comment to any page server-wide via import_source_id collision.
	if page == nil {
		team, terr := a.Srv().Store().Team().GetByName(*data.Team)
		if terr != nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.team_not_found.error",
				map[string]any{"Team": *data.Team}, "", http.StatusNotFound).Wrap(terr)
		}

		wiki, wikiErr := a.getWikiByImportSourceId(rctx, team.Id, *data.WikiImportSourceId)
		if wikiErr != nil {
			return wikiErr
		}
		if wiki == nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.wiki_not_found.error",
				map[string]any{"WikiImportSourceId": *data.WikiImportSourceId}, "", http.StatusNotFound)
		}

		var appErr *model.AppError
		page, appErr = a.findPageByImportSourceId(rctx, *data.PageImportSourceId)
		if appErr != nil {
			return appErr
		}
		if page == nil {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.page_not_found.error",
				map[string]any{"PageImportSourceId": *data.PageImportSourceId}, "", http.StatusNotFound)
		}

		// Defense against cross-wiki / cross-team comment injection: the resolved page
		// must live in the wiki's backing channel.
		if page.ChannelId != wiki.ChannelId {
			return model.NewAppError("importPageComment", "app.import.import_page_comment.page_wiki_mismatch.error",
				map[string]any{
					"PageImportSourceId": *data.PageImportSourceId,
					"WikiImportSourceId": *data.WikiImportSourceId,
				}, "", http.StatusBadRequest)
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
// Also checks if the comment's post ID directly matches importSourceId (for locally created comments
// that were exported with their ID as the import_source_id).
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

	// Also check if a comment exists with ID matching importSourceId (for locally created comments
	// that were exported with their post ID used as the import_source_id).
	if model.IsValidId(importSourceId) {
		post, getErr := a.Srv().Store().Post().GetSingle(rctx, importSourceId, false)
		if getErr == nil && post != nil && post.Type == model.PostTypePageComment && post.DeleteAt == 0 {
			propPageId, _ := post.Props[model.PagePropsPageID].(string)
			if post.RootId == pageId || propPageId == pageId {
				return post, nil
			}
		}
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
	// Get current page - content is in Post.Message
	page, err := a.GetPage(rctx, pageId)
	if err != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.get_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(err)
	}

	if page.Message == "" {
		return nil
	}

	originalContentStr := page.Message
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

	// Update page content via UpdatePageWithContent
	if _, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, pageId, "", resolvedContentStr); storeErr != nil {
		return model.NewAppError("resolveFilePlaceholders", "app.import.resolve_placeholders.update_content.error",
			map[string]any{"PageId": pageId}, "", http.StatusInternalServerError).Wrap(storeErr)
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
func (a *App) ResolvePageTitlePlaceholders(rctx request.CTX, team *model.Team, wiki *model.Wiki) *model.AppError {
	wikiId := wiki.Id
	backingChannelId := wiki.ChannelId

	// Fetch all pages once (store loads all anyway).
	postList, appErr := a.GetChannelPages(rctx, backingChannelId, 0, 0)
	if appErr != nil {
		return model.NewAppError("ResolvePageTitlePlaceholders", "app.import.resolve_page_placeholders.get_pages.error",
			map[string]any{"WikiId": wikiId}, "", http.StatusInternalServerError).Wrap(appErr)
	}
	if postList == nil || len(postList.Posts) == 0 {
		return nil
	}

	// Pass 1: build complete title -> page ID map.
	titleToPageID := make(map[string]string, len(postList.Posts))
	for _, pageID := range postList.Order {
		page := postList.Posts[pageID]
		if titleStr, ok := page.GetProp("title").(string); ok && titleStr != "" {
			titleToPageID[strings.ToLower(titleStr)] = page.Id
		}
	}

	// Pass 2: resolve placeholders in every page.
	totalResolved := 0
	for _, pageID := range postList.Order {
		page := postList.Posts[pageID]
		if page.Message == "" {
			continue
		}

		originalContentStr := page.Message
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

			resolvedPageID, ok := titleToPageID[strings.ToLower(title)]
			if !ok {
				rctx.Logger().Warn("Page title not found for placeholder resolution",
					mlog.String("page_id", page.Id),
					mlog.String("target_title", title),
				)
				continue
			}

			// Replace placeholder with full wiki page URL
			// Format: /{teamName}/wiki/{wikiId}/{pageId}
			pageURL := "/" + url.PathEscape(team.Name) + "/wiki/" + wikiId + "/" + resolvedPageID
			resolvedContentStr = strings.Replace(resolvedContentStr, placeholder, pageURL, 1)
			replacementsCount++

			rctx.Logger().Debug("Resolved page title placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("target_title", title),
				mlog.String("target_page_id", resolvedPageID),
				mlog.String("page_url", pageURL),
			)
		}

		if replacementsCount == 0 || resolvedContentStr == originalContentStr {
			continue
		}

		// Update page content via UpdatePageWithContent
		if _, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, page.Id, "", resolvedContentStr); storeErr != nil {
			rctx.Logger().Warn("Failed to update page content with resolved placeholders",
				mlog.String("page_id", page.Id),
				mlog.Err(storeErr),
			)
			continue
		}

		totalResolved += replacementsCount
	}

	if totalResolved > 0 {
		rctx.Logger().Info("Resolved page title placeholders",
			mlog.String("wiki_id", wikiId),
			mlog.Int("total_resolved", totalResolved),
		)
	}

	return nil
}

// ResolvePageIDPlaceholders resolves {{CONF_PAGE_ID:confId}} placeholders
// in page content by looking up pages by their import_source_id.
// This should be called after all pages are imported.
func (a *App) ResolvePageIDPlaceholders(rctx request.CTX, team *model.Team, wiki *model.Wiki) *model.AppError {
	wikiId := wiki.Id
	backingChannelId := wiki.ChannelId

	// Fetch all pages once (store loads all anyway).
	postList, appErr := a.GetChannelPages(rctx, backingChannelId, 0, 0)
	if appErr != nil {
		return appErr
	}
	if postList == nil || len(postList.Posts) == 0 {
		return nil
	}

	// Pass 1: build complete import_source_id -> Mattermost page ID map.
	sourceIDToPageID := make(map[string]string, len(postList.Posts))
	for _, pageID := range postList.Order {
		page := postList.Posts[pageID]
		if sourceID, ok := page.GetProp(model.PostPropsImportSourceId).(string); ok && sourceID != "" {
			sourceIDToPageID[sourceID] = page.Id
		}
	}

	if len(sourceIDToPageID) == 0 {
		return nil
	}

	rctx.Logger().Info("Built page source ID mapping for CONF_PAGE_ID resolution",
		mlog.String("wiki_id", wikiId),
		mlog.Int("mapping_count", len(sourceIDToPageID)),
	)

	// Pass 2: resolve placeholders in every page.
	totalResolved := 0
	for _, pageID := range postList.Order {
		page := postList.Posts[pageID]
		if page.Message == "" {
			continue
		}

		originalContentStr := page.Message
		resolvedContentStr := originalContentStr

		matches := confPageIDPlaceholderRegex.FindAllStringSubmatch(resolvedContentStr, -1)
		replacementsCount := 0

		for _, match := range matches {
			if len(match) < 2 {
				continue
			}

			placeholder := match[0]  // {{CONF_PAGE_ID:confId}}
			confSourceId := match[1] // Confluence page ID (stored as import_source_id)

			resolvedPageID, ok := sourceIDToPageID[confSourceId]
			if !ok {
				rctx.Logger().Warn("Page not found for CONF_PAGE_ID placeholder",
					mlog.String("page_id", page.Id),
					mlog.String("conf_source_id", confSourceId),
				)
				continue
			}

			// Generate proper wiki URL: /{teamName}/wiki/{wikiId}/{pageId}
			pageURL := "/" + url.PathEscape(team.Name) + "/wiki/" + wikiId + "/" + resolvedPageID
			resolvedContentStr = strings.Replace(resolvedContentStr, placeholder, pageURL, 1)
			replacementsCount++

			rctx.Logger().Debug("Resolved CONF_PAGE_ID placeholder",
				mlog.String("page_id", page.Id),
				mlog.String("conf_source_id", confSourceId),
				mlog.String("target_page_id", resolvedPageID),
				mlog.String("page_url", pageURL),
			)
		}

		if replacementsCount == 0 || resolvedContentStr == originalContentStr {
			continue
		}

		// Update page content via UpdatePageWithContent
		if _, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, page.Id, "", resolvedContentStr); storeErr != nil {
			rctx.Logger().Warn("Failed to update page content",
				mlog.String("page_id", page.Id),
				mlog.Err(storeErr),
			)
			continue
		}

		totalResolved += replacementsCount
	}

	if totalResolved > 0 {
		rctx.Logger().Info("Resolved CONF_PAGE_ID placeholders",
			mlog.String("wiki_id", wikiId),
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
func (a *App) CleanupUnresolvedPlaceholders(rctx request.CTX, wiki *model.Wiki) *model.AppError {
	backingChannelId := wiki.ChannelId

	// Process each page in batches - content is in Post.Message
	totalCleaned := 0
	offset := 0
	for {
		postList, appErr := a.GetChannelPages(rctx, backingChannelId, offset, importPageBatchSize)
		if appErr != nil {
			return appErr
		}
		if postList == nil || len(postList.Posts) == 0 {
			break
		}
		batchSize := len(postList.Posts)

		for _, pageID := range postList.Order {
			page := postList.Posts[pageID]
			if page.Message == "" {
				continue
			}

			originalContentStr := page.Message
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

			// Update page content via UpdatePageWithContent
			if _, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, page.Id, "", cleanedContentStr); storeErr != nil {
				rctx.Logger().Warn("Failed to update page content after cleanup",
					mlog.String("page_id", page.Id),
					mlog.Err(storeErr),
				)
				continue
			}

			totalCleaned += replacementsCount
		}

		if batchSize < importPageBatchSize {
			break
		}
		offset += importPageBatchSize
	}

	if totalCleaned > 0 {
		rctx.Logger().Info("Cleaned up unresolved placeholders",
			mlog.String("wiki_id", wiki.Id),
			mlog.Int("total_cleaned", totalCleaned),
		)
	}

	return nil
}

// RepairOrphanedPageHierarchy fixes page parent relationships that were broken during import
// because child pages were imported before their parents.
// This should be called after all pages are imported.
func (a *App) RepairOrphanedPageHierarchy(rctx request.CTX, wiki *model.Wiki) (int, *model.AppError) {
	backingChannelId := wiki.ChannelId

	postList, appErr := a.GetChannelPages(rctx, backingChannelId, 0, 0)
	if appErr != nil {
		return 0, appErr
	}

	pages := postList.ToSlice()
	if len(pages) == 0 {
		return 0, nil
	}

	// Build in-memory lookup maps from already-fetched data.
	sourceIdToPage := make(map[string]*model.Post, len(pages))
	pageById := make(map[string]*model.Post, len(pages))
	for _, page := range pages {
		pageById[page.Id] = page
		if sourceId, ok := page.GetProp(model.PostPropsImportSourceId).(string); ok && sourceId != "" {
			sourceIdToPage[sourceId] = page
		}
	}

	// hasAncestorCycle walks the proposed parent chain entirely in memory to detect cycles.
	// Returns true if assigning parentId as the parent of pageId would create a cycle.
	hasAncestorCycle := func(pageId, parentId string) bool {
		visited := make(map[string]bool)
		current := parentId
		for current != "" {
			if current == pageId {
				return true
			}
			if visited[current] {
				return true
			}
			visited[current] = true
			p, ok := pageById[current]
			if !ok {
				break
			}
			current = p.PageParentId
		}
		return false
	}

	// Collect valid reparentings without any DB calls.
	updates := make(map[string]string)
	for _, page := range pages {
		parentSourceId, ok := page.GetProp("parent_import_source_id").(string)
		if !ok || parentSourceId == "" {
			continue
		}
		if page.PageParentId != "" {
			continue
		}

		parentPage, exists := sourceIdToPage[parentSourceId]
		if !exists {
			rctx.Logger().Warn("Parent page not found for orphan repair",
				mlog.String("page_id", page.Id),
				mlog.String("parent_import_source_id", parentSourceId),
			)
			continue
		}

		if hasAncestorCycle(page.Id, parentPage.Id) {
			rctx.Logger().Warn("Skipping cyclic parent assignment during hierarchy repair",
				mlog.String("page_id", page.Id),
				mlog.String("proposed_parent_id", parentPage.Id),
			)
			continue
		}

		updates[page.Id] = parentPage.Id
	}

	if len(updates) == 0 {
		return 0, nil
	}

	// Single batch UPDATE — eliminates the N+1 query pattern.
	if err := a.Srv().Store().Page().BatchSetPageParent(updates); err != nil {
		return 0, model.NewAppError("RepairOrphanedPageHierarchy",
			"app.page.repair_hierarchy.batch_update.app_error", nil, "",
			http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Repaired orphaned page hierarchies",
		mlog.String("wiki_id", wiki.Id),
		mlog.Int("repaired_count", len(updates)),
	)

	return len(updates), nil
}
