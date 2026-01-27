// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "strings"

// MarkdownExportRequest is the request body for page markdown export
type MarkdownExportRequest struct {
	Markdown string            `json:"markdown"`
	Filename string            `json:"filename"`
	Files    []MarkdownFileRef `json:"files"`
}

// MarkdownFileRef represents a file to include in the export
type MarkdownFileRef struct {
	FileId    string `json:"file_id"`
	LocalPath string `json:"local_path"` // e.g., "attachments/abc123.png"
}

// IsValid validates the export request
func (r *MarkdownExportRequest) IsValid() *AppError {
	if r.Markdown == "" {
		return NewAppError("MarkdownExportRequest.IsValid", "model.page_export.markdown_required", nil, "", 400)
	}
	if r.Filename == "" {
		return NewAppError("MarkdownExportRequest.IsValid", "model.page_export.filename_required", nil, "", 400)
	}
	// Validate filename length
	if len(r.Filename) > MaxExportFilenameLength {
		return NewAppError("MarkdownExportRequest.IsValid", "model.page_export.filename_too_long", nil, "", 400)
	}
	// Validate filename doesn't contain path traversal characters
	if strings.Contains(r.Filename, "..") || strings.Contains(r.Filename, "/") || strings.Contains(r.Filename, "\\") {
		return NewAppError("MarkdownExportRequest.IsValid", "model.page_export.filename_invalid_chars", nil, "", 400)
	}
	// Validate file references
	for i, fileRef := range r.Files {
		if err := fileRef.IsValid(); err != nil {
			err.DetailedError = "file index " + string(rune('0'+i))
			return err
		}
	}
	return nil
}

// IsValid validates a file reference
func (f *MarkdownFileRef) IsValid() *AppError {
	if f.FileId == "" {
		return NewAppError("MarkdownFileRef.IsValid", "model.page_export.file_id_required", nil, "", 400)
	}
	if !IsValidId(f.FileId) {
		return NewAppError("MarkdownFileRef.IsValid", "model.page_export.file_id_invalid", nil, "", 400)
	}
	// Validate LocalPath: must start with "attachments/" and not contain path traversal
	if f.LocalPath != "" {
		if !strings.HasPrefix(f.LocalPath, ExportAttachmentsDir+"/") {
			return NewAppError("MarkdownFileRef.IsValid", "model.page_export.local_path_invalid_prefix", nil, "", 400)
		}
		if strings.Contains(f.LocalPath, "..") {
			return NewAppError("MarkdownFileRef.IsValid", "model.page_export.local_path_traversal", nil, "", 400)
		}
	}
	return nil
}
