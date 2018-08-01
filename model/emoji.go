// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	EMOJI_NAME_MAX_LENGTH = 64
	EMOJI_SORT_BY_NAME    = "name"
)

type Emoji struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatorId string `json:"creator_id"`
	Name      string `json:"name"`
}

func inSystemEmoji(emojiName string) bool {
	_, ok := SystemEmojis[emojiName]
	return ok
}

func (emoji *Emoji) IsValid() *AppError {
	if len(emoji.Id) != 26 {
		return NewAppError("Emoji.IsValid", "model.emoji.id.app_error", nil, "", http.StatusBadRequest)
	}

	if emoji.CreateAt == 0 {
		return NewAppError("Emoji.IsValid", "model.emoji.create_at.app_error", nil, "id="+emoji.Id, http.StatusBadRequest)
	}

	if emoji.UpdateAt == 0 {
		return NewAppError("Emoji.IsValid", "model.emoji.update_at.app_error", nil, "id="+emoji.Id, http.StatusBadRequest)
	}

	if len(emoji.CreatorId) > 26 {
		return NewAppError("Emoji.IsValid", "model.emoji.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	return IsValidEmojiName(emoji.Name)
}

func IsValidEmojiName(name string) *AppError {
	if len(name) == 0 || len(name) > EMOJI_NAME_MAX_LENGTH || !IsValidAlphaNumHyphenUnderscore(name, false) || inSystemEmoji(name) {
		return NewAppError("Emoji.IsValid", "model.emoji.name.app_error", nil, "", http.StatusBadRequest)
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

func (emoji *Emoji) ToJson() string {
	b, _ := json.Marshal(emoji)
	return string(b)
}

func EmojiFromJson(data io.Reader) *Emoji {
	var emoji *Emoji
	json.NewDecoder(data).Decode(&emoji)
	return emoji
}

func EmojiListToJson(emojiList []*Emoji) string {
	b, _ := json.Marshal(emojiList)
	return string(b)
}

func EmojiListFromJson(data io.Reader) []*Emoji {
	var emojiList []*Emoji
	json.NewDecoder(data).Decode(&emojiList)
	return emojiList
}
