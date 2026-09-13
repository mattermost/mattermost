// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"encoding/json"
)

// PropertyField represents a property field definition
type PropertyField struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	CreateAt    int64                  `json:"create_at"`
	UpdateAt    int64                  `json:"update_at"`
	DeleteAt    int64                  `json:"delete_at"`
	Attrs       map[string]interface{} `json:"attrs"`
}

// PropertyValue represents a property value
type PropertyValue struct {
	ID       string          `json:"id"`
	FieldID  string          `json:"field_id"`
	Value    json.RawMessage `json:"value"`
	CreateAt int64           `json:"create_at"`
	UpdateAt int64           `json:"update_at"`
	DeleteAt int64           `json:"delete_at"`
}

// PropertyFieldRequest represents a request to create or update a property field
type PropertyFieldRequest struct {
	Name  string                   `json:"name"`
	Type  string                   `json:"type"`
	Attrs *PropertyFieldAttrsInput `json:"attrs,omitempty"`
}

// PropertyFieldAttrsInput represents property field attributes for input
type PropertyFieldAttrsInput struct {
	Visibility *string                `json:"visibility,omitempty"`
	SortOrder  *float64               `json:"sortOrder,omitempty"`
	Options    *[]PropertyOptionInput `json:"options,omitempty"`
	ParentID   *string                `json:"parentID,omitempty"`
}

// PropertyOptionInput represents a property option for input
type PropertyOptionInput struct {
	ID    *string `json:"id,omitempty"`
	Name  string  `json:"name"`
	Color *string `json:"color,omitempty"`
}

// PropertyValueRequest represents a request to set a property value
type PropertyValueRequest struct {
	Value json.RawMessage `json:"value"`
}
