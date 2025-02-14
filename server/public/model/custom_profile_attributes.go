// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const (
	CustomProfileAttributesPropertyAttrsValueType  = "value_type"
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
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (c CustomProfileAttributesSelectOption) GetID() string {
	return c.ID
}

func (c CustomProfileAttributesSelectOption) GetName() string {
	return c.Name
}

func (c *CustomProfileAttributesSelectOption) SetID(id string) {
	c.ID = id
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

	return nil
}
