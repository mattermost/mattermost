// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import "github.com/mattermost/mattermost/server/public/model"

type PropertyOptionGraphQLInput struct {
	ID    *string `json:"id"`
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

type PropertyFieldAttrsGraphQLInput struct {
	Visibility *string                       `json:"visibility"`
	SortOrder  *float64                      `json:"sortOrder"`
	Options    *[]PropertyOptionGraphQLInput `json:"options"`
	ParentID   *string                       `json:"parentID"`
	ValueType  *string                       `json:"valueType"`
}

type PropertyFieldGraphQLInput struct {
	Name  string                          `json:"name"`
	Type  model.PropertyFieldType         `json:"type"`
	Attrs *PropertyFieldAttrsGraphQLInput `json:"attrs"`
}
