// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"fmt"
	"strings"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const (
	CustomProfileAttributesPropertyAttrsValueType  = "value_type"
	CustomProfileAttributesPropertyAttrsOptions    = "options"
	CustomProfileAttributesPropertyAttrsVisibility = "visibility"
)

const (
	CustomProfileAttributesValueTypeEmail = "email"
	CustomProfileAttributesValueTypeURL   = "url"
	CustomProfileAttributesValueTypePhone = "phone"
)

func IsKnownCustomProfilteAttributesValueType(valueType string) bool {
	switch valueType {
	case CustomProfileAttributesValueTypeEmail,
		CustomProfileAttributesValueTypeURL,
		CustomProfileAttributesValueTypePhone:
		return true
	}

	return false
}

const (
	CustomProfileAttributesVisibilityHidden  = "hidden"
	CustomProfileAttributesVisibilityWhenSet = "when_set"
	CustomProfileAttributesVisibilityAlways  = "always"

	CustomProfileAttributesVisibilityDefault = CustomProfileAttributesVisibilityWhenSet
)

func IsKnownCustomProfilteAttributesVisibility(visibility string) bool {
	switch visibility {
	case CustomProfileAttributesVisibilityHidden,
		CustomProfileAttributesVisibilityWhenSet,
		CustomProfileAttributesVisibilityAlways:
		return true
	}

	return false
}

type CustomProfileAttributesSelectOption struct {
	ID    string
	Name  string
	Color string
}

func NewCustomProfileAttributesSelectOptionFromMap(m map[string]any) CustomProfileAttributesSelectOption {
	name := ""
	color := ""

	if v, ok := m["name"]; ok {
		if vStr, ok := v.(string); ok {
			name = vStr
		}
	}

	if v, ok := m["color"]; ok {
		if vStr, ok := v.(string); ok {
			color = vStr
		}
	}

	return NewCustomProfileAttributesSelectOption(name, color)
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

func (c CustomProfileAttributesSelectOptions) IsValid() error {
	if len(c) == 0 {
		return errors.New("options list cannot be empty")
	}

	seenNames := make(map[string]struct{})
	for i, option := range c {
		if err := option.IsValid(); err != nil {
			return fmt.Errorf("invalid option at index %d: %w", i, err)
		}

		if _, exists := seenNames[option.Name]; exists {
			return fmt.Errorf("duplicate option name found at index %d: %s", i, option.Name)
		}
		seenNames[option.Name] = struct{}{}
	}

	return nil
}
