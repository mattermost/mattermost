// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Emoji struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatorId string `json:"creator_id"`
	Name      string `json:"name"`
}

func (emoji *Emoji) IsValid() *AppError {
	if len(emoji.Id) != 26 {
		return NewLocAppError("Emoji.IsValid", "model.emoji.id.app_error", nil, "")
	}

	if emoji.CreateAt == 0 {
		return NewLocAppError("Emoji.IsValid", "model.emoji.create_at.app_error", nil, "id="+emoji.Id)
	}

	if emoji.UpdateAt == 0 {
		return NewLocAppError("Emoji.IsValid", "model.emoji.update_at.app_error", nil, "id="+emoji.Id)
	}

	if len(emoji.CreatorId) != 26 {
		return NewLocAppError("Emoji.IsValid", "model.emoji.user_id.app_error", nil, "")
	}

	if len(emoji.Name) == 0 || len(emoji.Name) > 64 {
		return NewLocAppError("Emoji.IsValid", "model.emoji.name.app_error", nil, "")
	}

	return nil
}

func (emoji *Emoji) PreSave() {
	if emoji.Id == "" {
		emoji.Id = NewId()
	}

	emoji.CreateAt = GetMillis()
	emoji.UpdateAt = emoji.CreateAt
}

func (emoji *Emoji) PreUpdate() {
	emoji.UpdateAt = GetMillis()
}

func (emoji *Emoji) ToJson() string {
	b, err := json.Marshal(emoji)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func EmojiFromJson(data io.Reader) *Emoji {
	decoder := json.NewDecoder(data)
	var emoji Emoji
	err := decoder.Decode(&emoji)
	if err == nil {
		return &emoji
	} else {
		return nil
	}
}

func EmojiListToJson(emojiList []*Emoji) string {
	b, err := json.Marshal(emojiList)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func EmojiListFromJson(data io.Reader) []*Emoji {
	decoder := json.NewDecoder(data)
	var emojiList []*Emoji
	err := decoder.Decode(&emojiList)
	if err == nil {
		return emojiList
	} else {
		return nil
	}
}
