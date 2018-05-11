// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"

	"github.com/json-iterator/go"
)

type Preferences []Preference

func (o *Preferences) ToJson() string {
	b, _ := jsoniter.Marshal(o)
	return string(b)
}

func PreferencesFromJson(data io.Reader) (Preferences, error) {
	decoder := json.NewDecoder(data)
	var o Preferences
	err := decoder.Decode(&o)
	if err == nil {
		return o, nil
	} else {
		return nil, err
	}
}
