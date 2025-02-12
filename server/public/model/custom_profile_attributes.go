// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"strings"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const (
	CustomProfileAttributesPropertyAttrsValueType  = "value_type"
	CustomProfileAttributesPropertyAttrsOptions    = "options"
	CustomProfileAttributesPropertyAttrsVisibility = "visibility"
)

const (
	CustomProfileAttributesValueTypeNone  = ""
	CustomProfileAttributesValueTypeEmail = "email"
	CustomProfileAttributesValueTypeURL   = "url"
	CustomProfileAttributesValueTypePhone = "phone"
)

const (
	CustomProfileAttributesVisibilityHidden  = "hidden"
	CustomProfileAttributesVisibilityWhenSet = "when_set"
	CustomProfileAttributesVisibilityAlways  = "always"
)

type CustomProfileAttributesSelectOption struct {
	ID    string
	Name  string
	Color string
}

func NewCustomProfileAttributesSelectOption(name, color string) CustomProfileAttributesSelectOption {
	return CustomProfileAttributesSelectOption{
		ID:    NewId(),
		Name:  strings.TrimSpace(name),
		Color: strings.TrimSpace(color),
	}
}

func (c CustomProfileAttributesSelectOption) IsValid() error {
	if c.ID == "" {
		return errors.New("id cannot be empty")
	}

	if !IsValidId(c.ID) {
		return errors.New("id is not a valid ID")
	}

	if c.Name == "" {
		return errors.New("name cannot be empty")
	}

	if c.Color == "" {
		return errors.New("color cannot be empty")
	}

	return nil
}

type CustomProfileAttributesSelectOptions []CustomProfileAttributesSelectOption
