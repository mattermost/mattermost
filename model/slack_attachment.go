// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type SlackAttachment struct {
	Id         string                  `json:"id"`
	Fallback   string                  `json:"fallback"`
	Color      string                  `json:"color"`
	Pretext    string                  `json:"pretext"`
	AuthorName string                  `json:"author_name"`
	AuthorLink string                  `json:"author_link"`
	AuthorIcon string                  `json:"author_icon"`
	Title      string                  `json:"title"`
	TitleLink  string                  `json:"title_link"`
	Text       string                  `json:"text"`
	Fields     []*SlackAttachmentField `json:"fields"`
	ImageURL   string                  `json:"image_url"`
	ThumbURL   string                  `json:"thumb_url"`
	Footer     string                  `json:"footer"`
	FooterIcon string                  `json:"footer_icon"`
	Timestamp  int64                   `json:"ts"`
}

type SlackAttachmentField struct {
	Title string      `json:"title"`
	Value interface{} `json:"value"`
	Short bool        `json:"short"`
}
