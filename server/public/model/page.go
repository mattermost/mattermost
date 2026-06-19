// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"maps"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	PageTypePage   = "page"
	PageTypeFolder = "page_folder"

	PageTitleMaxRunes = 256
)

// Page is a wiki page stored in the dedicated Pages table (not as a Posts row).
// Live pages and version snapshots share the table; DeleteAt=0 is the live-vs-snapshot
// discriminator. Structural fields are columns; the persisted Props blob holds only
// non-structural metadata (translation and import keys), while product attributes
// (page status, etc.) live in Property System v2, delivered to the client via the
// transient Properties field.
type Page struct {
	// persisted columns
	Id         string `json:"id"`
	WikiId     string `json:"wiki_id"`   // foreign key — the wiki this page belongs to
	ChannelId  string `json:"-"`         // denormalized cache of the wiki's backing channel (1:1 via uq_wikis_channel_id); hot-path access/broadcast. Invariant: == Wikis[WikiId].ChannelId
	ParentId   string `json:"parent_id"` // single-parent adjacency tree; root pages have ParentId==""
	Type       string `json:"type"`      // PageTypePage | PageTypeFolder
	Title      string `json:"title"`
	Body       string `json:"body"`
	SearchText string `json:"search_text,omitempty"` // client-supplied extracted text for full-text search

	UserId         string `json:"user_id"`          // creator
	LastModifiedBy string `json:"last_modified_by"` // last editor (server-managed)
	SortOrder      int64  `json:"sort_order"`       // gap-based sibling order

	CreateAt   int64  `json:"create_at"`
	UpdateAt   int64  `json:"update_at"`
	EditAt     int64  `json:"edit_at"`
	DeleteAt   int64  `json:"delete_at"`   // live=0; snapshot>0 (live/snapshot discriminator)
	OriginalId string `json:"original_id"` // version-chain link; "" on a live row

	HasEffectiveViewRestriction bool `json:"has_effective_view_restriction"`
	HasLocalEditRestriction     bool `json:"has_local_edit_restriction"`

	// Props is a persisted JSON blob for non-structural page metadata: client-facing
	// translation keys (set via PatchPageProps) and import keys (e.g. import_source_id from
	// a Confluence import). Structural fields stay as columns; Props holds only the
	// key/values that do not warrant their own column.
	Props StringInterface `json:"props"`

	// sparse delete-bookkeeping (NULL except on a soft-deleted row)
	ReparentedParentOnDelete   *string `json:"-"`
	ReparentedChildrenOnDelete *string `json:"-"` // JSON-encoded child-id list

	// transient (db:"-")
	PendingFileIds StringArray    `json:"pending_file_ids,omitempty" db:"-"` // INBOUND ONLY — file ids to attach/reparent on write. Ownership lives in FileInfo.PageId; the read-side attachment list is loaded separately.
	Properties     map[string]any `json:"properties,omitempty" db:"-"`       // enriched Property System v2 values for the client (status, etc.)
}

func (p *Page) PreSave() {
	if p.Id == "" {
		p.Id = NewId()
	}

	p.Title = strings.TrimSpace(SanitizeUnicode(p.Title))

	if p.Type == "" {
		p.Type = PageTypePage
	}

	if p.Props == nil {
		p.Props = make(StringInterface)
	}

	if p.CreateAt == 0 {
		p.CreateAt = GetMillis()
	}
	p.UpdateAt = p.CreateAt
}

func (p *Page) PreUpdate() {
	p.UpdateAt = GetMillis()
	p.Title = strings.TrimSpace(SanitizeUnicode(p.Title))
	p.Body = SanitizeUnicode(p.Body)
}

func (p *Page) IsValid() *AppError {
	if !IsValidId(p.Id) {
		return NewAppError("Page.IsValid", "model.page.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(p.UserId) {
		return NewAppError("Page.IsValid", "model.page.is_valid.user_id.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.CreateAt == 0 {
		return NewAppError("Page.IsValid", "model.page.is_valid.create_at.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.UpdateAt == 0 {
		return NewAppError("Page.IsValid", "model.page.is_valid.update_at.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.Type != PageTypePage && p.Type != PageTypeFolder {
		return NewAppError("Page.IsValid", "model.page.is_valid.type.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(p.Title) > PageTitleMaxRunes {
		return NewAppError("Page.IsValid", "model.page.is_valid.title.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.ParentId != "" && !IsValidId(p.ParentId) {
		return NewAppError("Page.IsValid", "model.page.is_valid.parent_id.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.ParentId == p.Id {
		return NewAppError("Page.IsValid", "model.page.is_valid.parent_self.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.OriginalId != "" && !IsValidId(p.OriginalId) {
		return NewAppError("Page.IsValid", "model.page.is_valid.original_id.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	// WikiId and ChannelId are the FK and its cache: required on a persisted row but
	// set server-side after decode (SanitizeInput zeros them on the client body), so
	// validate them empty-tolerantly — exactly Wiki.IsValid for its own ChannelId.
	if p.WikiId != "" && !IsValidId(p.WikiId) {
		return NewAppError("Page.IsValid", "model.page.is_valid.wiki_id.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	if p.ChannelId != "" && !IsValidId(p.ChannelId) {
		return NewAppError("Page.IsValid", "model.page.is_valid.channel_id.app_error", nil, "id="+p.Id, http.StatusBadRequest)
	}

	return nil
}

func (p *Page) Auditable() map[string]any {
	return map[string]any{
		"id":                             p.Id,
		"wiki_id":                        p.WikiId,
		"channel_id":                     p.ChannelId,
		"parent_id":                      p.ParentId,
		"type":                           p.Type,
		"title":                          p.Title,
		"user_id":                        p.UserId,
		"last_modified_by":               p.LastModifiedBy,
		"sort_order":                     p.SortOrder,
		"create_at":                      p.CreateAt,
		"update_at":                      p.UpdateAt,
		"edit_at":                        p.EditAt,
		"delete_at":                      p.DeleteAt,
		"original_id":                    p.OriginalId,
		"has_effective_view_restriction": p.HasEffectiveViewRestriction,
		"has_local_edit_restriction":     p.HasLocalEditRestriction,
	}
}

func (p *Page) LogClone() any {
	return p.Auditable()
}

// Clone returns an independent copy. No mutex is needed (unlike Post.Props): the Props
// blob, the transient slice/map, and the nullable pointers are all deep-copied so the
// clone does not alias the original.
func (p *Page) Clone() *Page {
	cp := *p

	if p.PendingFileIds != nil {
		cp.PendingFileIds = make(StringArray, len(p.PendingFileIds))
		copy(cp.PendingFileIds, p.PendingFileIds)
	}

	if p.Properties != nil {
		cp.Properties = make(map[string]any, len(p.Properties))
		maps.Copy(cp.Properties, p.Properties)
	}

	if p.Props != nil {
		cp.Props = make(StringInterface, len(p.Props))
		maps.Copy(cp.Props, p.Props)
	}

	if p.ReparentedParentOnDelete != nil {
		v := *p.ReparentedParentOnDelete
		cp.ReparentedParentOnDelete = &v
	}

	if p.ReparentedChildrenOnDelete != nil {
		v := *p.ReparentedChildrenOnDelete
		cp.ReparentedChildrenOnDelete = &v
	}

	return &cp
}

// ShallowCopy copies all fields into dst (slices/maps are shared, not duplicated).
func (p *Page) ShallowCopy(dst *Page) {
	*dst = *p
}

// SanitizeInput zeros every server-managed field so a client-supplied body cannot set
// them. This is the primary enforcement boundary for the restriction markers and the
// FK/cache; it runs unconditionally regardless of which write path consumes the struct.
func (p *Page) SanitizeInput() {
	p.DeleteAt = 0
	p.EditAt = 0
	p.OriginalId = ""
	p.HasEffectiveViewRestriction = false
	p.HasLocalEditRestriction = false
	p.LastModifiedBy = ""
	p.SortOrder = 0
	p.WikiId = ""
	p.ChannelId = ""
}
