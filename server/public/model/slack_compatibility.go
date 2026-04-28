// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
)

// Deprecated: Use MessageAttachment instead.
type SlackAttachment = MessageAttachment

// Deprecated: Use MessageAttachmentField instead.
type SlackAttachmentField = MessageAttachmentField

// Deprecated: Use ParseMessageAttachment instead.
func ParseSlackAttachment(post *Post, attachments []*MessageAttachment) {
	ParseMessageAttachment(post, attachments)
}

// Deprecated: Use StringifyMessageAttachmentFieldValue instead.
func StringifySlackFieldValue(a []*MessageAttachment) []*MessageAttachment {
	return StringifyMessageAttachmentFieldValue(a)
}

// SlackCompatibleBool is an alias for bool that implements json.Unmarshaler
type SlackCompatibleBool bool

// UnmarshalJSON implements json.Unmarshaler
//
// Slack allows bool values to be represented as strings ("true"/"false") or
// literals (true/false). To maintain compatibility, we define an Unmarshaler
// that supports both.
func (b *SlackCompatibleBool) UnmarshalJSON(data []byte) error {
	value := strings.ToLower(string(data))
	switch value {
	case "true", `"true"`:
		*b = true
	case "false", `"false"`:
		*b = false
	default:
		return fmt.Errorf("unmarshal: unable to convert %s to bool", data)
	}

	return nil
}
