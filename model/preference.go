// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW = "direct_channel_show"
	PREFERENCE_CATEGORY_TEST                = "test" // do not use, just for testing uniqueness while there's only one real category
	PREFERENCE_NAME_TEST                    = "test" // do not use, just for testing while there's no constant name
)

type Preference struct {
	UserId   string `json:"user_id"`
	Category string `json:"category"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

func (o *Preference) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PreferenceFromJson(data io.Reader) *Preference {
	decoder := json.NewDecoder(data)
	var o Preference
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Preference) IsValid() *AppError {
	if len(o.UserId) != 26 {
		return NewAppError("Preference.IsValid", "Invalid user id", "user_id="+o.UserId)
	}

	if len(o.Category) == 0 || len(o.Category) > 32 || !IsPreferenceCategoryValid(o.Category) {
		return NewAppError("Preference.IsValid", "Invalid category", "category="+o.Category)
	}

	// name can either be a valid constant or an id
	if len(o.Name) == 0 || len(o.Name) > 32 || !(len(o.Name) == 26 || IsPreferenceNameValid(o.Name)) {
		return NewAppError("Preference.IsValid", "Invalid name", "name="+o.Name)
	}

	if len(o.Value) > 128 {
		return NewAppError("Preference.IsValid", "Value is too long", "value="+o.Value)
	}

	return nil
}

func IsPreferenceCategoryValid(category string) bool {
	return category == PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW || category == PREFERENCE_CATEGORY_TEST
}

func IsPreferenceNameValid(name string) bool {
	return name == PREFERENCE_NAME_TEST
}
