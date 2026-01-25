// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

const (
	// ExportPageBatchSize is the number of pages to fetch per batch
	ExportPageBatchSize = 100
)

// WikiBulkExport exports wikis and pages to JSONL format.
// The output format matches the import format used by importWiki/importPage.
// Returns WikiExportResult containing attachments that need to be written to zip.
func (a *App) WikiBulkExport(rctx request.CTX, writer io.Writer, job *model.Job, opts model.WikiBulkExportOpts) (*model.WikiExportResult, *model.AppError) {
	result := &model.WikiExportResult{}

	// Validate inputs
	if writer == nil {
		return nil, model.NewAppError("WikiBulkExport", "app.wiki_export.writer_nil.error", nil, "", http.StatusBadRequest)
	}

	// Validate channelIds don't contain empty strings
	for _, id := range opts.ChannelIds {
		if strings.TrimSpace(id) == "" {
			return nil, model.NewAppError("WikiBulkExport", "app.wiki_export.invalid_channel_id.error", nil, "empty channel ID provided", http.StatusBadRequest)
		}
	}

	rctx.Logger().Info("Starting wiki bulk export",
		mlog.Int("channel_count", len(opts.ChannelIds)),
		mlog.Bool("include_attachments", opts.IncludeAttachments),
	)

	// Write version line
	if err := writeExportLine(writer, "version", map[string]any{"version": model.WikiExportFormatVersion}); err != nil {
		return nil, model.NewAppError("WikiBulkExport", "app.wiki_export.write_version.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Track channels we're exporting for resolve_wiki_placeholders
	exportedChannels := make(map[string]bool)

	// Track failed channels for reporting
	var failedChannels []string

	// Get channels to export
	channelIds := opts.ChannelIds
	if len(channelIds) == 0 {
		// Export all channels that have wikis
		var appErr *model.AppError
		channelIds, appErr = a.getChannelsWithWikis(rctx)
		if appErr != nil {
			return nil, appErr
		}
	}

	totalWikis := 0
	totalPages := 0

	for _, channelId := range channelIds {
		// Get wikis for this channel
		wikis, err := a.Srv().Store().Wiki().GetWikisForExport(channelId)
		if err != nil {
			rctx.Logger().Error("Failed to get wikis for channel", mlog.String("channel_id", channelId), mlog.Err(err))
			failedChannels = append(failedChannels, channelId)
			continue
		}

		for _, wiki := range wikis {
			// Export wiki
			wikiData := &imports.WikiImportData{
				Team:        &wiki.TeamName,
				Channel:     &wiki.ChannelName,
				Title:       &wiki.Title,
				Description: &wiki.Description,
			}

			// Include import_source_id in props for idempotency
			importSourceId := wiki.Id
			if existingSourceId, ok := wiki.Props[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
				importSourceId = existingSourceId
			}
			wikiData.Props = &model.StringInterface{
				model.PostPropsImportSourceId: importSourceId,
			}

			if err := writeExportLine(writer, "wiki", wikiData); err != nil {
				return nil, model.NewAppError("WikiBulkExport", "app.wiki_export.write_wiki.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			totalWikis++
			exportedChannels[channelId] = true

			// Export pages for this wiki
			pagesExported, pageAttachments, appErr := a.exportWikiPages(rctx, writer, wiki, opts, job)
			if appErr != nil {
				return nil, appErr
			}
			totalPages += pagesExported
			// Convert imports.AttachmentImportData to model.WikiExportAttachment
			for _, att := range pageAttachments {
				if att.Path != nil {
					result.Attachments = append(result.Attachments, model.WikiExportAttachment{Path: *att.Path})
				}
			}
		}
	}

	// Emit resolve_wiki_placeholders for each channel
	for channelId := range exportedChannels {
		channel, err := a.Srv().Store().Channel().Get(channelId, false)
		if err != nil {
			rctx.Logger().Error("Failed to get channel for resolve_wiki_placeholders",
				mlog.String("channel_id", channelId), mlog.Err(err))
			continue
		}
		team, err := a.Srv().Store().Team().Get(channel.TeamId)
		if err != nil {
			rctx.Logger().Error("Failed to get team for resolve_wiki_placeholders",
				mlog.String("team_id", channel.TeamId), mlog.Err(err))
			continue
		}

		resolveData := &imports.ResolveWikiPlaceholdersImportData{
			Team:    &team.Name,
			Channel: &channel.Name,
		}
		if err := writeExportLine(writer, "resolve_wiki_placeholders", resolveData); err != nil {
			return nil, model.NewAppError("WikiBulkExport", "app.wiki_export.write_resolve.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	rctx.Logger().Info("Wiki bulk export completed",
		mlog.Int("wikis_exported", totalWikis),
		mlog.Int("pages_exported", totalPages),
		mlog.Int("attachments_count", len(result.Attachments)),
		mlog.Int("failed_channels", len(failedChannels)),
	)

	// Update job data with export stats
	if job != nil && job.Data != nil {
		job.Data[model.WikiJobDataKeyWikisExported] = strconv.Itoa(totalWikis)
		job.Data[model.WikiJobDataKeyPagesExported] = strconv.Itoa(totalPages)
		if len(failedChannels) > 0 {
			job.Data[model.WikiJobDataKeyFailedChannels] = strings.Join(failedChannels, ",")
		}
	}

	return result, nil
}

// exportWikiPages exports all pages for a wiki
// Returns the number of pages exported and list of attachments to write
func (a *App) exportWikiPages(rctx request.CTX, writer io.Writer, wiki *model.WikiForExport, opts model.WikiBulkExportOpts, job *model.Job) (int, []imports.AttachmentImportData, *model.AppError) {
	pagesExported := 0
	afterId := ""
	var allAttachments []imports.AttachmentImportData

	// Track pages with failed comment exports
	var failedCommentPages []string

	for {
		pages, err := a.Srv().Store().Wiki().GetPagesForExport(wiki.Id, ExportPageBatchSize, afterId)
		if err != nil {
			return pagesExported, nil, model.NewAppError("exportWikiPages", "app.wiki_export.get_pages.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(pages) == 0 {
			break
		}

		for _, page := range pages {
			pageData := &imports.PageImportData{
				Team:    &page.TeamName,
				Channel: &page.ChannelName,
				User:    &page.Username,
				Title:   &page.Title,
				Content: &page.Content,
			}

			// Set create_at
			if page.CreateAt > 0 {
				pageData.CreateAt = &page.CreateAt
			}

			// Set parent reference using import_source_id
			if page.PageParentId != "" {
				pageData.ParentImportSourceId = &page.ParentImportSourceId
			}

			// Include import_source_id and page_status in props for idempotency
			importSourceId := page.Id
			exportProps := model.StringInterface{
				model.PostPropsImportSourceId: importSourceId,
			}
			if page.Props != "" {
				propsMap := model.StringInterfaceFromJSON(jsonReader(page.Props))
				if existingSourceId, ok := propsMap[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
					exportProps[model.PostPropsImportSourceId] = existingSourceId
				}
				// Include page_status if set
				if pageStatus, ok := propsMap[model.PagePropsPageStatus].(string); ok && pageStatus != "" {
					exportProps[model.PagePropsPageStatus] = pageStatus
				}
			}
			pageData.Props = &exportProps

			// Export attachments if requested and page has files
			if opts.IncludeAttachments && page.FileIds != "" {
				pageAttachments, appErr := a.buildPageAttachments(page.Id)
				if appErr != nil {
					rctx.Logger().Warn("Failed to build attachments for page",
						mlog.String("page_id", page.Id),
						mlog.Err(appErr),
					)
				} else if len(pageAttachments) > 0 {
					pageData.Attachments = &pageAttachments
					allAttachments = append(allAttachments, pageAttachments...)
				}
			}

			if err := writeExportLine(writer, "page", pageData); err != nil {
				return pagesExported, nil, model.NewAppError("exportWikiPages", "app.wiki_export.write_page.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			pagesExported++

			// Export comments if requested
			if opts.IncludeComments {
				if appErr := a.exportPageComments(rctx, writer, page); appErr != nil {
					rctx.Logger().Error("Failed to export comments for page",
						mlog.String("page_id", page.Id),
						mlog.Err(appErr),
					)
					failedCommentPages = append(failedCommentPages, page.Id)
				}
			}

			afterId = page.Id
		}

		if len(pages) < ExportPageBatchSize {
			break
		}
	}

	// Track failed comment pages in job data
	if job != nil && job.Data != nil && len(failedCommentPages) > 0 {
		job.Data[model.WikiJobDataKeyFailedCommentPages] = strings.Join(failedCommentPages, ",")
	}

	return pagesExported, allAttachments, nil
}

// buildPageAttachments builds attachment data for a page's files
func (a *App) buildPageAttachments(pageID string) ([]imports.AttachmentImportData, *model.AppError) {
	infos, nErr := a.Srv().Store().FileInfo().GetForPost(pageID, false, false, false)
	if nErr != nil {
		return nil, model.NewAppError("buildPageAttachments", "app.file_info.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	attachments := make([]imports.AttachmentImportData, 0, len(infos))
	for _, info := range infos {
		attachments = append(attachments, imports.AttachmentImportData{Path: &info.Path})
	}

	return attachments, nil
}

// exportPageComments exports comments for a page (Phase 2)
func (a *App) exportPageComments(rctx request.CTX, writer io.Writer, page *model.PageForExport) *model.AppError {
	comments, err := a.Srv().Store().Wiki().GetPageCommentsForExport(page.Id)
	if err != nil {
		return model.NewAppError("exportPageComments", "app.wiki_export.get_comments.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, comment := range comments {
		commentData := &imports.PageCommentImportData{
			User:    &comment.Username,
			Content: &comment.Content,
		}

		// Set page reference
		pageImportSourceId := page.Id
		if page.Props != "" {
			propsMap := model.StringInterfaceFromJSON(jsonReader(page.Props))
			if existingSourceId, ok := propsMap[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
				pageImportSourceId = existingSourceId
			}
		}
		commentData.PageImportSourceId = &pageImportSourceId

		// Set create_at
		if comment.CreateAt > 0 {
			commentData.CreateAt = &comment.CreateAt
		}

		// Set parent comment reference if threaded
		if comment.ParentCommentId != "" {
			commentData.ParentCommentImportSourceId = &comment.ParentCommentImportSource
		}

		// Include import_source_id and inline_anchor in props
		importSourceId := comment.Id
		exportProps := model.StringInterface{
			model.PostPropsImportSourceId: importSourceId,
		}
		if comment.Props != "" {
			propsMap := model.StringInterfaceFromJSON(jsonReader(comment.Props))
			if existingSourceId, ok := propsMap[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
				exportProps[model.PostPropsImportSourceId] = existingSourceId
			}
			// Check if comment is resolved
			if resolved, ok := propsMap[model.PagePropsCommentResolved].(bool); ok && resolved {
				isResolved := true
				commentData.IsResolved = &isResolved
			}
			// Include inline_anchor if present (for inline comments)
			if inlineAnchor, ok := propsMap[model.PagePropsInlineAnchor].(map[string]any); ok {
				exportProps[model.PagePropsInlineAnchor] = inlineAnchor
			}
		}
		commentData.Props = &exportProps

		if err := writeExportLine(writer, "page_comment", commentData); err != nil {
			return model.NewAppError("exportPageComments", "app.wiki_export.write_comment.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

// getChannelsWithWikis returns all channel IDs that have at least one wiki
func (a *App) getChannelsWithWikis(rctx request.CTX) ([]string, *model.AppError) {
	wikis, err := a.Srv().Store().Wiki().GetForChannel("", true)
	if err != nil {
		return nil, model.NewAppError("getChannelsWithWikis", "app.wiki_export.get_all_wikis.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	channelMap := make(map[string]bool)
	for _, wiki := range wikis {
		channelMap[wiki.ChannelId] = true
	}

	channels := make([]string, 0, len(channelMap))
	for channelId := range channelMap {
		channels = append(channels, channelId)
	}

	return channels, nil
}

// writeExportLine writes a single JSONL line to the writer
func writeExportLine(writer io.Writer, lineType string, data any) error {
	line := map[string]any{
		"type":   lineType,
		lineType: data,
	}

	jsonBytes, err := json.Marshal(line)
	if err != nil {
		return err
	}

	jsonBytes = append(jsonBytes, '\n')
	n, err := writer.Write(jsonBytes)
	if err != nil {
		return err
	}
	if n != len(jsonBytes) {
		return io.ErrShortWrite
	}
	return nil
}

// jsonReader creates an io.Reader from a JSON string
func jsonReader(s string) io.Reader {
	return strings.NewReader(s)
}
