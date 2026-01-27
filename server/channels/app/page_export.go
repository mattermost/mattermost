// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"path/filepath"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ExportPageToMarkdownZip creates a ZIP containing markdown + attachments for a page
func (a *App) ExportPageToMarkdownZip(rctx request.CTX, pageId string, req model.MarkdownExportRequest) ([]byte, *model.AppError) {
	// Validate request
	if appErr := req.IsValid(); appErr != nil {
		return nil, appErr
	}

	// Create ZIP buffer
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Add markdown file
	mdFilename := req.Filename + ".md"
	mdFile, err := zipWriter.Create(mdFilename)
	if err != nil {
		return nil, model.NewAppError("ExportPageToMarkdownZip", "app.page_export.create_md.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, err := mdFile.Write([]byte(req.Markdown)); err != nil {
		return nil, model.NewAppError("ExportPageToMarkdownZip", "app.page_export.write_md.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Add attachments
	for _, fileRef := range req.Files {
		if err := a.addFileToZip(rctx, pageId, fileRef, zipWriter); err != nil {
			// Log warning but continue - don't fail entire export for one missing file
			rctx.Logger().Warn("Failed to add file to export",
				mlog.String("file_id", fileRef.FileId),
				mlog.String("page_id", pageId),
				mlog.Err(err))
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, model.NewAppError("ExportPageToMarkdownZip", "app.page_export.close_zip.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return buf.Bytes(), nil
}

// addFileToZip adds a single file to the ZIP, validating it belongs to the page
func (a *App) addFileToZip(rctx request.CTX, pageId string, fileRef model.MarkdownFileRef, zipWriter *zip.Writer) *model.AppError {
	// Get file info to validate ownership and get path
	fileInfo, appErr := a.GetFileInfo(rctx, fileRef.FileId)
	if appErr != nil {
		return model.NewAppError("addFileToZip", "app.page_export.get_file_info.error", nil, "", appErr.StatusCode).Wrap(appErr)
	}

	// Security check: verify file belongs to this page
	if fileInfo.PostId != pageId {
		rctx.Logger().Warn("File does not belong to page, skipping",
			mlog.String("file_id", fileRef.FileId),
			mlog.String("file_post_id", fileInfo.PostId),
			mlog.String("requested_page_id", pageId))
		return model.NewAppError("addFileToZip", "app.page_export.file_not_owned.error", nil, "", http.StatusForbidden)
	}

	// Read file from filestore
	fileReader, appErr := a.FileReader(fileInfo.Path)
	if appErr != nil {
		return model.NewAppError("addFileToZip", "app.page_export.read_file.error", nil, "", appErr.StatusCode).Wrap(appErr)
	}
	defer fileReader.Close()

	// Determine filename in ZIP (use localPath from request, which is like "attachments/abc.png")
	zipPath := fileRef.LocalPath
	if zipPath == "" {
		// Fallback: use attachments/fileId.ext
		ext := filepath.Ext(fileInfo.Name)
		if ext == "" {
			ext = model.DefaultFileExtension
		}
		zipPath = model.ExportAttachmentsDir + "/" + fileRef.FileId + ext
	}

	// Create file in ZIP
	zipFile, err := zipWriter.Create(zipPath)
	if err != nil {
		return model.NewAppError("addFileToZip", "app.page_export.create_zip_entry.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Copy file content
	if _, err := io.Copy(zipFile, fileReader); err != nil {
		return model.NewAppError("addFileToZip", "app.page_export.copy_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
