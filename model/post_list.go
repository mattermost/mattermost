// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type PostList struct {
	Order []string         `json:"order"`
	Posts map[string]*Post `json:"posts"`
}

func (o *PostList) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *PostList) MakeNonNil() {
	if o.Order == nil {
		o.Order = make([]string, 0)
	}

	if o.Posts == nil {
		o.Posts = make(map[string]*Post)
	}

	for _, v := range o.Posts {
		v.MakeNonNil()
	}
}

func (o *PostList) AddOrder(id string) {

	if o.Order == nil {
		o.Order = make([]string, 0, 128)
	}

	o.Order = append(o.Order, id)
}

func (o *PostList) AddPost(post *Post) {

	if o.Posts == nil {
		o.Posts = make(map[string]*Post)
	}

	o.Posts[post.Id] = post
}

func (o *PostList) Etag() string {

	id := "0"
	var t int64 = 0

	for _, v := range o.Posts {
		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		}
	}

	return Etag(id, t)
}

func (o *PostList) IsChannelId(channelId string) bool {
	for _, v := range o.Posts {
		if v.ChannelId != channelId {
			return false
		}
	}

	return true
}

func PostListFromJson(data io.Reader) *PostList {
	decoder := json.NewDecoder(data)
	var o PostList
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
