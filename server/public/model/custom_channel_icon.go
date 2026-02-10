// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/base64"
	"html"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	CustomChannelIconNameMaxLength = 64
	CustomChannelIconSvgMaxSize    = 50 * 1024 // 50KB max for base64 SVG
)

// CustomChannelIcon represents a custom SVG icon for channels stored server-side.
type CustomChannelIcon struct {
	Id             string `json:"id" db:"id"`
	Name           string `json:"name" db:"name"`
	Svg            string `json:"svg" db:"svg"` // Base64-encoded SVG content
	NormalizeColor bool   `json:"normalize_color" db:"normalizecolor"`
	CreateAt       int64  `json:"create_at" db:"createat"`
	UpdateAt       int64  `json:"update_at" db:"updateat"`
	DeleteAt       int64  `json:"delete_at" db:"deleteat"`
	CreatedBy      string `json:"created_by" db:"createdby"`
}

// CustomChannelIconPatch represents a patch request for updating a custom channel icon.
type CustomChannelIconPatch struct {
	Name           *string `json:"name,omitempty"`
	Svg            *string `json:"svg,omitempty"`
	NormalizeColor *bool   `json:"normalize_color,omitempty"`
}

// PreSave prepares the CustomChannelIcon for saving.
func (i *CustomChannelIcon) PreSave() {
	if i.Id == "" {
		i.Id = NewId()
	}
	if i.CreateAt == 0 {
		i.CreateAt = GetMillis()
	}
	i.UpdateAt = i.CreateAt
}

// PreUpdate prepares the CustomChannelIcon for updating.
func (i *CustomChannelIcon) PreUpdate() {
	i.UpdateAt = GetMillis()
}

// IsValid validates the CustomChannelIcon.
func (i *CustomChannelIcon) IsValid() *AppError {
	if !IsValidId(i.Id) {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if i.Name == "" {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.name.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(i.Name) > CustomChannelIconNameMaxLength {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.name_length.app_error", nil, "", http.StatusBadRequest)
	}

	if i.Svg == "" {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg.app_error", nil, "", http.StatusBadRequest)
	}

	if len(i.Svg) > CustomChannelIconSvgMaxSize {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg_size.app_error", nil, "", http.StatusBadRequest)
	}

	svgData, err := base64.StdEncoding.DecodeString(i.Svg)
	if err != nil {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg_base64.app_error", nil, "", http.StatusBadRequest)
	}

	svgStr := string(svgData)
	if !strings.HasPrefix(strings.TrimSpace(svgStr), "<svg") {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg_start.app_error", nil, "", http.StatusBadRequest)
	}

	svgStr = html.UnescapeString(svgStr)

	lowerSvg := strings.ToLower(svgStr)
	if strings.Contains(lowerSvg, "<script") ||
		strings.Contains(lowerSvg, "<foreignobject") ||
		strings.Contains(lowerSvg, "javascript:") ||
		strings.Contains(lowerSvg, "data:") ||
		strings.Contains(lowerSvg, "@import") ||
		strings.Contains(lowerSvg, "xlink:href=\"http") ||
		strings.Contains(lowerSvg, "xlink:href='http") {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg_security.app_error", nil, "", http.StatusBadRequest)
	}

	if matched, _ := regexp.MatchString(`(?i)\bon[a-z]+\s*=`, svgStr); matched {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.svg_security.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(i.CreatedBy) {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.created_by.app_error", nil, "", http.StatusBadRequest)
	}

	if i.CreateAt == 0 {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if i.UpdateAt == 0 {
		return NewAppError("CustomChannelIcon.IsValid", "model.custom_channel_icon.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// Patch applies the patch to the CustomChannelIcon.
func (i *CustomChannelIcon) Patch(patch *CustomChannelIconPatch) {
	if patch.Name != nil {
		i.Name = *patch.Name
	}
	if patch.Svg != nil {
		i.Svg = *patch.Svg
	}
	if patch.NormalizeColor != nil {
		i.NormalizeColor = *patch.NormalizeColor
	}
}

// IsValidPatch validates the CustomChannelIconPatch.
func (p *CustomChannelIconPatch) IsValidPatch() *AppError {
	if p.Name != nil {
		if *p.Name == "" {
			return NewAppError("CustomChannelIconPatch.IsValidPatch", "model.custom_channel_icon.is_valid.name.app_error", nil, "", http.StatusBadRequest)
		}
		if utf8.RuneCountInString(*p.Name) > CustomChannelIconNameMaxLength {
			return NewAppError("CustomChannelIconPatch.IsValidPatch", "model.custom_channel_icon.is_valid.name_length.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if p.Svg != nil {
		if *p.Svg == "" {
			return NewAppError("CustomChannelIconPatch.IsValidPatch", "model.custom_channel_icon.is_valid.svg.app_error", nil, "", http.StatusBadRequest)
		}
		if len(*p.Svg) > CustomChannelIconSvgMaxSize {
			return NewAppError("CustomChannelIconPatch.IsValidPatch", "model.custom_channel_icon.is_valid.svg_size.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}
