// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
)

// SlackCompatibleBool is an alias for bool that implements json.Unmarshaler
type SlackCompatibleBool bool

// UnmarshalJSON implements json.Unmarshaler
//
// Slack allows bool values to be represented as strings ("true"/"false") or
// literals (true/false). To maintain compatibility, we define an Unmarshaler
// that supports both.
func (b *SlackCompatibleBool) UnmarshalJSON(data []byte) error {
	value := strings.ToLower(string(data))
	if value == "true" || value == `"true"` {
		*b = true
	} else if value == "false" || value == `"false"` {
		*b = false
	} else {
		return fmt.Errorf("unmarshal: unable to convert %s to bool", data)
	}

	return nil
}
