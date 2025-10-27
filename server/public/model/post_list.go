// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
)

const (
	// TimeTypeCreateAt indicates using CreateAt timestamp for filtering and pagination
	TimeTypeCreateAt = "create_at"
	// TimeTypeUpdateAt indicates using UpdateAt timestamp for filtering and pagination
	TimeTypeUpdateAt = "update_at"
)

// GetPostsSinceCursor represents a cursor for paginating through posts since a given timestamp.
// The cursor encodes the time type, timestamp, and post ID to enable stateless pagination.
type GetPostsSinceCursor struct {
	// TimeType specifies which timestamp field to use: "create_at" or "update_at"
	TimeType string
	// LastPostTimestamp is the timestamp of the last post returned in the previous page
	LastPostTimestamp int64
	// LastPostID is the ID of the last post returned in the previous page
	LastPostID string
}

// validateAndNormalizePostsSinceCursor validates a GetPostsSinceCursor and normalizes empty TimeType to "create_at".
// Returns the normalized TimeType and an error if validation fails.
func validateAndNormalizePostsSinceCursor(timeType string, timestamp int64, postID string) (string, error) {
	// Validate TimeType: must be "create_at", "update_at", or empty (defaults to "create_at")
	if timeType == "" {
		timeType = TimeTypeCreateAt
	} else if timeType != TimeTypeCreateAt && timeType != TimeTypeUpdateAt {
		return "", fmt.Errorf("invalid TimeType: must be %q or %q, got %q", TimeTypeCreateAt, TimeTypeUpdateAt, timeType)
	}

	// Validate timestamp: must be non-negative
	if timestamp < 0 {
		return "", fmt.Errorf("invalid timestamp: must be >= 0, got %d", timestamp)
	}

	// Validate post ID: must be non-empty
	if postID == "" {
		return "", fmt.Errorf("invalid post ID: must be non-empty")
	}

	return timeType, nil
}

// EncodePostsSinceCursor encodes a GetPostsSinceCursor into a string format.
// The cursor is encoded as: {timeType}:{timestamp}:{postId}
// Returns an error if the cursor fails validation.
func EncodePostsSinceCursor(cursor GetPostsSinceCursor) (string, error) {
	// Validate and normalize the cursor
	timeType, err := validateAndNormalizePostsSinceCursor(cursor.TimeType, cursor.LastPostTimestamp, cursor.LastPostID)
	if err != nil {
		return "", err
	}

	// Encode cursor as: {timeType}:{timestamp}:{postId}
	encoded := fmt.Sprintf("%s:%s:%s", timeType, strconv.FormatInt(cursor.LastPostTimestamp, 10), cursor.LastPostID)
	return encoded, nil
}

// DecodePostsSinceCursor decodes a cursor string into a GetPostsSinceCursor struct.
// The cursor string must be in the format: {timeType}:{timestamp}:{postId}
// Returns an error if the cursor string is malformed or fails validation.
// Guarantee: if decode succeeds, the returned cursor is valid and ready to use.
func DecodePostsSinceCursor(cursorStr string) (GetPostsSinceCursor, error) {
	// Split cursor string on ':' and expect exactly 3 parts
	parts := strings.Split(cursorStr, ":")
	if len(parts) != 3 {
		return GetPostsSinceCursor{}, fmt.Errorf("invalid cursor format: expected 3 parts separated by ':', got %d parts", len(parts))
	}

	timeType := parts[0]
	timestampStr := parts[1]
	postID := parts[2]

	// Parse timestamp string to int64 with base 10 and 64 bits
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return GetPostsSinceCursor{}, fmt.Errorf("invalid timestamp: failed to parse %q as int64: %w", timestampStr, err)
	}

	// Validate and normalize the cursor fields
	timeType, err = validateAndNormalizePostsSinceCursor(timeType, timestamp, postID)
	if err != nil {
		return GetPostsSinceCursor{}, err
	}

	return GetPostsSinceCursor{
		TimeType:          timeType,
		LastPostTimestamp: timestamp,
		LastPostID:        postID,
	}, nil
}

type PostList struct {
	Order      []string         `json:"order"`
	Posts      map[string]*Post `json:"posts"`
	NextPostId string           `json:"next_post_id"`
	PrevPostId string           `json:"prev_post_id"`
	// HasNext indicates whether there are more items to be fetched or not.
	HasNext *bool `json:"has_next,omitempty"`
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

func (o *PostList) BuildWranglerPostList() *WranglerPostList {
	wpl := &WranglerPostList{}

	o.UniqueOrder()
	o.SortByCreateAt()
	posts := o.ToSlice()

	if len(posts) == 0 {
		// Something was sorted wrong or an empty PostList was provided.
		return wpl
	}

	// A separate ID key map to ensure no duplicates.
	idKeys := make(map[string]bool)

	for i := range posts {
		p := posts[len(posts)-i-1]

		// Add UserID to metadata if it's new.
		if _, ok := idKeys[p.UserId]; !ok {
			idKeys[p.UserId] = true
			wpl.ThreadUserIDs = append(wpl.ThreadUserIDs, p.UserId)
		}

		wpl.FileAttachmentCount += int64(len(p.FileIds))

		wpl.Posts = append(wpl.Posts, p)
	}

	// Set metadata for earliest and latest posts
	wpl.EarlistPostTimestamp = wpl.RootPost().CreateAt
	wpl.LatestPostTimestamp = wpl.Posts[wpl.NumPosts()-1].CreateAt

	return wpl
}
