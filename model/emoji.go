// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	l4g "github.com/alecthomas/log4go"
	"io"
	"io/ioutil"
	"net/http"
)

const (
	EMOJI_NAME_MAX_LENGTH = 64
	EMOJI_SORT_BY_NAME    = "name"
)

var systemEmojis = initSystemEmoji()

func initSystemEmoji() map[string]string {
	emojiFile, err := ioutil.ReadFile("emoji.json")
	if err != nil {
		l4g.Critical("reading emoji json file", err.Error())
		return map[string]string{}
	}
	var objs interface{}

	err = json.Unmarshal(emojiFile, &objs)
	if err != nil {
		l4g.Critical("unmarshalling emoji json file", err.Error())
		return map[string]string{}
	}

	var localSystemEmojis = map[string]string{}
	for _, obj := range objs.([]interface{}) {
		obj := obj.(map[string]interface{})

		for _, alias := range obj["aliases"].([]interface{}) {

			localSystemEmojis[alias.(string)] = obj["filename"].(string)
		}
	}
	return localSystemEmojis
}

type Emoji struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatorId string `json:"creator_id"`
	Name      string `json:"name"`
}

func inSystemEmoji(emojiName string) bool {
	_, ok := systemEmojis[emojiName]
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

	if len(emoji.CreatorId) != 26 {
		return NewAppError("Emoji.IsValid", "model.emoji.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(emoji.Name) == 0 || len(emoji.Name) > EMOJI_NAME_MAX_LENGTH || !IsValidAlphaNumHyphenUnderscore(emoji.Name, false) || inSystemEmoji(emoji.Name) {
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
