// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"unicode/utf8"
)

const (
	WikiTitleMaxRunes       = 128
	WikiDescriptionMaxRunes = 1024
	WikiIconMaxLength       = 256

	// Page status values - these are stored directly as display names
	// following the Mattermost pattern (see ContentFlaggingStatus* constants)
	PageStatusRoughDraft = "Rough draft"
	PageStatusInProgress = "In progress"
	PageStatusInReview   = "In review"
	PageStatusDone       = "Done"

	// Wiki export/import constants
	WikiExportFormatVersion = 1
	WikiExportFileSuffix    = "_wiki_export.jsonl"

	// Job data keys for wiki export/import
	WikiJobDataKeyChannelIds          = "channel_ids"
	WikiJobDataKeyIncludeComments     = "include_comments"
	WikiJobDataKeyIncludeAttachments  = "include_attachments"
	WikiJobDataKeyImportFile          = "import_file"
	WikiJobDataKeyLocalMode           = "local_mode"
	WikiJobDataKeyExportDir           = "export_dir"
	WikiJobDataKeyExportFile          = "export_file"
	WikiJobDataKeyIsDownloadable      = "is_downloadable"
	WikiJobDataKeyWikisExported       = "wikis_exported"
	WikiJobDataKeyPagesExported       = "pages_exported"
	WikiJobDataKeyAttachmentsExported = "attachments_exported"
	WikiJobDataKeyFailedChannels      = "failed_channels"
	WikiJobDataKeyFailedCommentPages  = "failed_comment_pages"
	WikiJobDataKeyFailedAttachments   = "failed_attachments"
	WikiJobDataKeyAttachmentsTotal    = "attachments_total"
)

type Wiki struct {
	Id          string          `json:"id"`
	ChannelId   string          `json:"channel_id"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Icon        string          `json:"icon,omitempty"`
	Props       StringInterface `json:"props"`
	CreateAt    int64           `json:"create_at"`
	UpdateAt    int64           `json:"update_at"`
	DeleteAt    int64           `json:"delete_at"`
	SortOrder   int64           `json:"sort_order"`
}

func (w *Wiki) PreSave() {
	if w.Id == "" {
		w.Id = NewId()
	}

	w.Title = SanitizeUnicode(w.Title)
	w.Description = SanitizeUnicode(w.Description)

	if w.CreateAt == 0 {
		w.CreateAt = GetMillis()
	}
	w.UpdateAt = w.CreateAt

	if w.SortOrder == 0 {
		w.SortOrder = w.CreateAt
	}
}

func (w *Wiki) PreUpdate() {
	w.UpdateAt = GetMillis()
	w.Title = SanitizeUnicode(w.Title)
	w.Description = SanitizeUnicode(w.Description)
}

func (w *Wiki) Auditable() map[string]any {
	return map[string]any{
		"id":          w.Id,
		"channel_id":  w.ChannelId,
		"title":       w.Title,
		"description": w.Description,
		"icon":        w.Icon,
		"props":       w.GetProps(),
		"create_at":   w.CreateAt,
		"update_at":   w.UpdateAt,
		"delete_at":   w.DeleteAt,
		"sort_order":  w.SortOrder,
	}
}

func (w *Wiki) LogClone() any {
	return w.Auditable()
}

func (w *Wiki) IsValid() *AppError {
	if !IsValidId(w.Id) {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if w.CreateAt == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.create_at.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if w.UpdateAt == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.update_at.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if !IsValidId(w.ChannelId) {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Title) == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.title.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Title) > WikiTitleMaxRunes {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.title_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Description) > WikiDescriptionMaxRunes {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.description_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if len(w.Icon) > WikiIconMaxLength {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.icon_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	return nil
}

func (w *Wiki) ToJSON() ([]byte, error) {
	return json.Marshal(w)
}

func WikiFromJSON(data []byte) (*Wiki, error) {
	var wiki Wiki
	if err := json.Unmarshal(data, &wiki); err != nil {
		return nil, err
	}
	return &wiki, nil
}

// BreadcrumbItem represents a single item in the breadcrumb path
type BreadcrumbItem struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Type      string `json:"type"` // "wiki", "page"
	Path      string `json:"path"`
	ChannelId string `json:"channel_id"`
}

// BreadcrumbPath represents the full breadcrumb navigation path
type BreadcrumbPath struct {
	Items       []*BreadcrumbItem `json:"items"`
	CurrentPage *BreadcrumbItem   `json:"current_page"`
}

// SetProps sets the Props field
func (w *Wiki) SetProps(props StringInterface) {
	w.Props = props
}

// GetProps returns the Props, initializing if necessary
func (w *Wiki) GetProps() StringInterface {
	if w.Props == nil {
		return make(StringInterface)
	}
	return w.Props
}

// ShowMentionsInChannelFeed returns whether page mention system messages should appear in channel feed
func (w *Wiki) ShowMentionsInChannelFeed() bool {
	if val, ok := w.Props["show_mentions_in_channel_feed"].(bool); ok {
		return val
	}
	return true // Default to true - show mentions in channel feed
}

// SetShowMentionsInChannelFeed sets the show_mentions_in_channel_feed prop
func (w *Wiki) SetShowMentionsInChannelFeed(show bool) {
	if w.Props == nil {
		w.Props = make(StringInterface)
	}
	w.Props["show_mentions_in_channel_feed"] = show
}

// WikiForExport contains wiki data with team/channel names for bulk export
type WikiForExport struct {
	Wiki
	TeamName    string `json:"team_name" db:"TeamName"`
	ChannelName string `json:"channel_name" db:"ChannelName"`
}

// PageForExport contains page data with content and metadata for bulk export
// Note: db tags use lowercase to match PostgreSQL's default behavior of lowercasing unquoted column names
type PageForExport struct {
	Id                   string `json:"id" db:"id"`
	TeamName             string `json:"team_name" db:"TeamName"`
	ChannelName          string `json:"channel_name" db:"ChannelName"`
	Username             string `json:"username" db:"Username"`
	Title                string `json:"title" db:"Title"`
	Content              string `json:"content" db:"Content"`
	WikiId               string `json:"wiki_id" db:"WikiId"`
	PageParentId         string `json:"page_parent_id,omitempty" db:"PageParentId"`
	ParentImportSourceId string `json:"parent_import_source_id,omitempty" db:"ParentImportSourceId"`
	Props                string `json:"props,omitempty" db:"props"`
	CreateAt             int64  `json:"create_at" db:"createat"`
	UpdateAt             int64  `json:"update_at" db:"updateat"`
	FileIds              string `json:"file_ids,omitempty" db:"fileids"`
}

// PageCommentForExport contains page comment data for bulk export
type PageCommentForExport struct {
	Id                        string `json:"id" db:"Id"`
	TeamName                  string `json:"team_name" db:"TeamName"`
	ChannelName               string `json:"channel_name" db:"ChannelName"`
	Username                  string `json:"username" db:"Username"`
	Content                   string `json:"content" db:"Content"`
	PageId                    string `json:"page_id" db:"PageId"`
	PageImportSourceId        string `json:"page_import_source_id"`
	ParentCommentId           string `json:"parent_comment_id,omitempty" db:"ParentCommentId"`
	ParentCommentImportSource string `json:"parent_comment_import_source,omitempty"`
	Props                     string `json:"props,omitempty" db:"Props"`
	CreateAt                  int64  `json:"create_at" db:"CreateAt"`
}

// WikiBulkExportOpts contains options for wiki bulk export
type WikiBulkExportOpts struct {
	ChannelIds         []string // Empty means all channels with wikis
	IncludeComments    bool     // Include page comments
	IncludeAttachments bool     // Include file attachments
}

// WikiExportAttachment represents a file attachment to be exported
type WikiExportAttachment struct {
	Path string
}

// WikiExportResult contains the result of a wiki export including attachments to write
type WikiExportResult struct {
	Attachments []WikiExportAttachment
}
