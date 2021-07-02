// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"sort"
)

const (
	EMOJI_NAME_MAX_LENGTH = 64
	EMOJI_SORT_BY_NAME    = "name"
)

var EMOJI_PATTERN = regexp.MustCompile(`:[a-zA-Z0-9_+-]+:`)

var ReverseSystemEmojisMap = makeReverseEmojiMap()

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

func GetSystemEmojiId(emojiName string) (string, bool) {
	id, found := SystemEmojis[emojiName]
	return id, found
}

func makeReverseEmojiMap() map[string][]string {
	reverseEmojiMap := make(map[string][]string)
	for key, value := range SystemEmojis {
		emojiNames := reverseEmojiMap[value]
		emojiNames = append(emojiNames, key)
		sort.Strings(emojiNames)
		reverseEmojiMap[value] = emojiNames
	}

	return reverseEmojiMap
}

func GetEmojiNameFromUnicode(unicode string) (emojiName string, count int) {
	if emojiNames, found := ReverseSystemEmojisMap[unicode]; found {
		return emojiNames[0], len(emojiNames)
	}

	return "", 0
}

func (emoji *Emoji) IsValid() *AppError {
	if !IsValidId(emoji.Id) {
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
	if name == "" || len(name) > EMOJI_NAME_MAX_LENGTH || !IsValidAlphaNumHyphenUnderscorePlus(name) || inSystemEmoji(name) {
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
