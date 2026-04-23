// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	FileinfoSortByCreated = "CreateAt"
	FileinfoSortBySize    = "Size"

	// MaxFilenameLength is the maximum length, in Unicode codepoints, of a
	// sanitized FileInfo.Name. It matches the VARCHAR(256) width of the
	// fileinfo.name column.
	MaxFilenameLength = 256
)

// FileDownloadType represents the type of file download or access being performed.
type FileDownloadType string

const (
	// FileDownloadTypeFile represents a full file download request.
	FileDownloadTypeFile FileDownloadType = "file"
	// FileDownloadTypeThumbnail represents a thumbnail image request.
	FileDownloadTypeThumbnail FileDownloadType = "thumbnail"
	// FileDownloadTypePreview represents a preview image request.
	FileDownloadTypePreview FileDownloadType = "preview"
	// FileDownloadTypePublic represents a public link access (unauthenticated).
	FileDownloadTypePublic FileDownloadType = "public"
)

// GetFileInfosOptions contains options for getting FileInfos
type GetFileInfosOptions struct {
	// UserIds optionally limits the FileInfos to those created by the given users.
	UserIds []string `json:"user_ids"`
	// ChannelIds optionally limits the FileInfos to those created in the given channels.
	ChannelIds []string `json:"channel_ids"`
	// Since optionally limits FileInfos to those created at or after the given time, specified as Unix time in milliseconds.
	Since int64 `json:"since"`
	// IncludeDeleted if set includes deleted FileInfos.
	IncludeDeleted bool `json:"include_deleted"`
	// SortBy sorts the FileInfos by this field. The default is to sort by date created.
	SortBy string `json:"sort_by"`
	// SortDescending changes the sort direction to descending order when true.
	SortDescending bool `json:"sort_descending"`
}

type FileInfo struct {
	Id        string `json:"id"`
	CreatorId string `json:"user_id"`
	PostId    string `json:"post_id,omitempty"`
	// ChannelId is the denormalized value from the corresponding post. Note that this value is
	// potentially distinct from the ChannelId provided when the file is first uploaded and
	// used to organize the directories in the file store, since in theory that same file
	// could be attached to a post from a different channel (or not attached to a post at all).
	ChannelId       string  `json:"channel_id"`
	CreateAt        int64   `json:"create_at"`
	UpdateAt        int64   `json:"update_at"`
	DeleteAt        int64   `json:"delete_at"`
	Path            string  `json:"-"` // not sent back to the client
	ThumbnailPath   string  `json:"-"` // not sent back to the client
	PreviewPath     string  `json:"-"` // not sent back to the client
	Name            string  `json:"name"`
	Extension       string  `json:"extension"`
	Size            int64   `json:"size"`
	MimeType        string  `json:"mime_type"`
	Width           int     `json:"width,omitempty"`
	Height          int     `json:"height,omitempty"`
	HasPreviewImage bool    `json:"has_preview_image,omitempty"`
	MiniPreview     *[]byte `json:"mini_preview"` // pointer to distinguish NULL (no preview) from empty data
	Content         string  `json:"-"`
	RemoteId        *string `json:"remote_id"`
	Archived        bool    `json:"archived"`
}

func (fi *FileInfo) Auditable() map[string]any {
	return map[string]any{
		"id":         fi.Id,
		"creator_id": fi.CreatorId,
		"post_id":    fi.PostId,
		"channel_id": fi.ChannelId,
		"create_at":  fi.CreateAt,
		"update_at":  fi.UpdateAt,
		"delete_at":  fi.DeleteAt,
		"name":       fi.Name,
		"extension":  fi.Extension,
		"size":       fi.Size,
	}
}

func (fi *FileInfo) PreSave() {
	if fi.Id == "" {
		fi.Id = NewId()
	}

	if fi.CreateAt == 0 {
		fi.CreateAt = GetMillis()
	}

	if fi.UpdateAt < fi.CreateAt {
		fi.UpdateAt = fi.CreateAt
	}

	if fi.RemoteId == nil {
		fi.RemoteId = NewPointer("")
	}
}

func (fi *FileInfo) IsValid() *AppError {
	if !IsValidId(fi.Id) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(fi.CreatorId) && (fi.CreatorId != "nouser" && fi.CreatorId != BookmarkFileOwner) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.user_id.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.PostId != "" && !IsValidId(fi.PostId) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.post_id.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.CreateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.create_at.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.UpdateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.update_at.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.Path == "" {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.path.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	if fi.Name != "" && !IsValidFilename(fi.Name) {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.name.app_error", nil, "id="+fi.Id, http.StatusBadRequest)
	}

	return nil
}

// IsValidFilename reports whether name is acceptable as FileInfo.Name.
// It rejects empty strings, bare "." and "..", names exceeding
// MaxFilenameLength, path separators, and ASCII control characters.
// The input is not mutated; see SanitizeFilename for the mutating form.
func IsValidFilename(name string) bool {
	if name == "" || name == "." || name == ".." {
		return false
	}
	if utf8.RuneCountInString(name) > MaxFilenameLength {
		return false
	}
	if strings.ContainsAny(name, `/\`) {
		return false
	}
	return !strings.ContainsFunc(name, func(r rune) bool {
		return r < 0x20 || r == 0x7f
	})
}

// SanitizeFilename returns a canonical form of name suitable for
// FileInfo.Name. It NFC-normalizes Unicode, removes ASCII control
// characters, collapses backslashes to forward slashes, reduces the
// value to its final path element via filepath.Base, and truncates
// to MaxFilenameLength codepoints to match the DB column width.
//
// Returns an empty string when nothing usable remains (for example
// when the input was "", ".", "..", "/", or entirely control
// characters); callers should treat an empty result as a failure.
func SanitizeFilename(name string) string {
	if name == "" {
		return ""
	}

	name = norm.NFC.String(name)
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, name)
	name = strings.ReplaceAll(name, `\`, "/")
	name = filepath.Base(name)

	if name == "." || name == ".." || name == string(filepath.Separator) {
		return ""
	}

	if runes := []rune(name); len(runes) > MaxFilenameLength {
		name = string(runes[:MaxFilenameLength])
	}

	return name
}

func (fi *FileInfo) IsImage() bool {
	return strings.HasPrefix(fi.MimeType, "image")
}

func (fi *FileInfo) IsSvg() bool {
	return fi.MimeType == "image/svg+xml"
}

func NewInfo(name string) *FileInfo {
	info := &FileInfo{
		Name: name,
	}

	extension := strings.ToLower(filepath.Ext(name))
	info.MimeType = mime.TypeByExtension(extension)

	if extension != "" && extension[0] == '.' {
		// The client expects a file extension without the leading period
		info.Extension = extension[1:]
	} else {
		info.Extension = extension
	}

	return info
}

func GetEtagForFileInfos(infos []*FileInfo) string {
	if len(infos) == 0 {
		return Etag()
	}

	var maxUpdateAt int64

	for _, info := range infos {
		if info.UpdateAt > maxUpdateAt {
			maxUpdateAt = info.UpdateAt
		}
	}

	return Etag(infos[0].PostId, maxUpdateAt)
}

func (fi *FileInfo) MakeContentInaccessible() {
	if fi == nil {
		return
	}

	fi.Archived = true
	fi.Content = ""
	fi.HasPreviewImage = false
	fi.MiniPreview = nil
	fi.Path = ""
	fi.PreviewPath = ""
	fi.ThumbnailPath = ""
}
