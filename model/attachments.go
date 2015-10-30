// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Attachments []Attachment

type Attachment struct {
	Id         string            `json:"id"`
	PostId     string            `json:"post_id"`
	Fallback   string            `json:"fallback`
	Color      string            `json:"color`
	Pretext    string            `json:"pretext`
	AuthorName string            `json:"author_name`
	AuthorLink string            `json:"author_link`
	Title      string            `json:"title`
	TitleLink  string            `json:"title_link`
	Text       string            `json:"text`
	Fields     []AttachmentField `json:"fields"`
	ImageUrl   string            `json:"image_url"`
	ThumbUrl   string            `json:"thumb_url"`
}

type AttachmentField struct {
	Title string `json:"title`
	Value string `json:"value`
	Short bool   `json:"short`
}

func (a *Attachments) ToJson() string {
	b, err := json.Marshal(a)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AttachmentsFromJson(data io.Reader) *Attachments {
	decoder := json.NewDecoder(data)
	var o Attachments
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
