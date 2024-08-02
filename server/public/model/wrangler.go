// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// WranglerPostList provides a list of posts along with metadata about those
// posts.
type WranglerPostList struct {
	Posts                []*Post
	ThreadUserIDs        []string
	EarlistPostTimestamp int64
	LatestPostTimestamp  int64
	FileAttachmentCount  int64
}

// NumPosts returns the number of posts in a post list.
func (wpl *WranglerPostList) NumPosts() int {
	return len(wpl.Posts)
}

// RootPost returns the root post in a post list.
func (wpl *WranglerPostList) RootPost() *Post {
	if wpl.NumPosts() < 1 {
		return nil
	}

	return wpl.Posts[0]
}

// ContainsFileAttachments returns if the post list contains any file attachments.
func (wpl *WranglerPostList) ContainsFileAttachments() bool {
	return wpl.FileAttachmentCount != 0
}
