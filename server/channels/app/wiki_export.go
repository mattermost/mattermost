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
func (a *App) WikiBulkExport(rctx request.CTX, writer io.Writer, job *model.Job, opts model.WikiBulkExportOpts) *model.AppError {
	// Validate inputs
	if writer == nil {
		return model.NewAppError("WikiBulkExport", "app.wiki_export.writer_nil.error", nil, "", http.StatusBadRequest)
	}

	// Validate channelIds don't contain empty strings
	for _, id := range opts.ChannelIds {
		if strings.TrimSpace(id) == "" {
			return model.NewAppError("WikiBulkExport", "app.wiki_export.invalid_channel_id.error", nil, "empty channel ID provided", http.StatusBadRequest)
		}
	}

	rctx.Logger().Info("Starting wiki bulk export",
		mlog.Int("channel_count", len(opts.ChannelIds)),
	)

	// Write version line
	if err := writeExportLine(writer, "version", map[string]any{"version": model.WikiExportFormatVersion}); err != nil {
		return model.NewAppError("WikiBulkExport", "app.wiki_export.write_version.error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			return appErr
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
				return model.NewAppError("WikiBulkExport", "app.wiki_export.write_wiki.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			totalWikis++
			exportedChannels[channelId] = true

			// Export pages for this wiki
			pagesExported, appErr := a.exportWikiPages(rctx, writer, wiki, opts, job)
			if appErr != nil {
				return appErr
			}
			totalPages += pagesExported
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
			return model.NewAppError("WikiBulkExport", "app.wiki_export.write_resolve.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	rctx.Logger().Info("Wiki bulk export completed",
		mlog.Int("wikis_exported", totalWikis),
		mlog.Int("pages_exported", totalPages),
		mlog.Int("failed_channels", len(failedChannels)),
	)

	// Update job data with export stats
	if job != nil && job.Data != nil {
		job.Data["wikis_exported"] = strconv.Itoa(totalWikis)
		job.Data["pages_exported"] = strconv.Itoa(totalPages)
		if len(failedChannels) > 0 {
			job.Data["failed_channels"] = strings.Join(failedChannels, ",")
		}
	}

	return nil
}

// exportWikiPages exports all pages for a wiki
func (a *App) exportWikiPages(rctx request.CTX, writer io.Writer, wiki *model.WikiForExport, opts model.WikiBulkExportOpts, job *model.Job) (int, *model.AppError) {
	pagesExported := 0
	afterId := ""

	// Track pages with failed comment exports
	var failedCommentPages []string

	for {
		pages, err := a.Srv().Store().Wiki().GetPagesForExport(wiki.Id, ExportPageBatchSize, afterId)
		if err != nil {
			return pagesExported, model.NewAppError("exportWikiPages", "app.wiki_export.get_pages.error", nil, "", http.StatusInternalServerError).Wrap(err)
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

			// Include import_source_id in props for idempotency
			importSourceId := page.Id
			if page.Props != "" {
				propsMap := model.StringInterfaceFromJSON(jsonReader(page.Props))
				if existingSourceId, ok := propsMap[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
					importSourceId = existingSourceId
				}
			}
			pageData.Props = &model.StringInterface{
				model.PostPropsImportSourceId: importSourceId,
			}

			if err := writeExportLine(writer, "page", pageData); err != nil {
				return pagesExported, model.NewAppError("exportWikiPages", "app.wiki_export.write_page.error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		job.Data["failed_comment_pages"] = strings.Join(failedCommentPages, ",")
	}

	return pagesExported, nil
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

		// Include import_source_id in props
		importSourceId := comment.Id
		if comment.Props != "" {
			propsMap := model.StringInterfaceFromJSON(jsonReader(comment.Props))
			if existingSourceId, ok := propsMap[model.PostPropsImportSourceId].(string); ok && existingSourceId != "" {
				importSourceId = existingSourceId
			}
		}
		commentData.Props = &model.StringInterface{
			model.PostPropsImportSourceId: importSourceId,
		}

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
	return &jsonStringReader{s: s, i: 0}
}

type jsonStringReader struct {
	s string
	i int
}

func (r *jsonStringReader) Read(p []byte) (n int, err error) {
	if r.i >= len(r.s) {
		return 0, io.EOF
	}
	n = copy(p, r.s[r.i:])
	r.i += n
	return n, nil
}
