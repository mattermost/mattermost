// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"sort"
)

type PostList struct {
	Order      []string         `json:"order"`
	Posts      map[string]*Post `json:"posts"`
	NextPostId string           `json:"next_post_id"`
	PrevPostId string           `json:"prev_post_id"`
	// HasNext indicates whether there are more items to be fetched or not.
	HasNext bool `json:"has_next"`
	// If there are inaccessible posts, FirstInaccessiblePostTime is the time of the latest inaccessible post
	FirstInaccessiblePostTime int64 `json:"first_inaccessible_post_time"`
}

func NewPostList() *PostList {
	return &PostList{
		Order:      make([]string, 0),
		Posts:      make(map[string]*Post),
		NextPostId: "",
		PrevPostId: "",
	}
}

func (o *PostList) Clone() *PostList {
	orderCopy := make([]string, len(o.Order))
	postsCopy := make(map[string]*Post)
	copy(orderCopy, o.Order)
	for k, v := range o.Posts {
		postsCopy[k] = v.Clone()
	}
	return &PostList{
		Order:                     orderCopy,
		Posts:                     postsCopy,
		NextPostId:                o.NextPostId,
		PrevPostId:                o.PrevPostId,
		HasNext:                   o.HasNext,
		FirstInaccessiblePostTime: o.FirstInaccessiblePostTime,
	}
}

func (o *PostList) ForPlugin() *PostList {
	plCopy := o.Clone()
	for k, p := range plCopy.Posts {
		plCopy.Posts[k] = p.ForPlugin()
	}
	return plCopy
}

func (o *PostList) ToSlice() []*Post {
	var posts []*Post

	if l := len(o.Posts); l > 0 {
		posts = make([]*Post, 0, l)
	}

	for _, id := range o.Order {
		posts = append(posts, o.Posts[id])
	}
	return posts
}

func (o *PostList) WithRewrittenImageURLs(f func(string) string) *PostList {
	plCopy := *o
	plCopy.Posts = make(map[string]*Post)
	for id, post := range o.Posts {
		plCopy.Posts[id] = post.WithRewrittenImageURLs(f)
	}
	return &plCopy
}

func (o *PostList) StripActionIntegrations() {
	posts := o.Posts
	o.Posts = make(map[string]*Post)
	for id, post := range posts {
		pcopy := post.Clone()
		pcopy.StripActionIntegrations()
		o.Posts[id] = pcopy
	}
}

func (o *PostList) ToJSON() (string, error) {
	plCopy := *o
	plCopy.StripActionIntegrations()
	b, err := json.Marshal(&plCopy)
	return string(b), err
}

func (o *PostList) EncodeJSON(w io.Writer) error {
	o.StripActionIntegrations()
	return json.NewEncoder(w).Encode(o)
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

func (o *PostList) UniqueOrder() {
	keys := make(map[string]bool)
	order := []string{}
	for _, postId := range o.Order {
		if _, value := keys[postId]; !value {
			keys[postId] = true
			order = append(order, postId)
		}
	}

	o.Order = order
}

func (o *PostList) Extend(other *PostList) {
	for postId := range other.Posts {
		o.AddPost(other.Posts[postId])
	}

	for _, postId := range other.Order {
		o.AddOrder(postId)
	}

	o.UniqueOrder()
}

func (o *PostList) SortByCreateAt() {
	sort.Slice(o.Order, func(i, j int) bool {
		return o.Posts[o.Order[i]].CreateAt > o.Posts[o.Order[j]].CreateAt
	})
}

func (o *PostList) Etag() string {

	id := "0"
	var t int64

	for _, v := range o.Posts {
		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		} else if v.UpdateAt == t && v.Id > id {
			t = v.UpdateAt
			id = v.Id
		}
	}

	orderId := ""
	if len(o.Order) > 0 {
		orderId = o.Order[0]
	}

	return Etag(orderId, id, t)
}

func (o *PostList) IsChannelId(channelId string) bool {
	for _, v := range o.Posts {
		if v.ChannelId != channelId {
			return false
		}
	}

	return true
}
