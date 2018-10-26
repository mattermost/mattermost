// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type PostMetadata struct {
	// An array of the information required to render additional details about the contents of this post.
	Embeds []*PostEmbed `json:"embeds,omitempty"`

	// An arrayof the  custom emojis used in the post or in reactions to the post.
	Emojis []*Emoji `json:"emojis,omitempty"`

	// An array of information about the file attachments on the post.
	Files []*FileInfo `json:"files,omitempty"`

	// A map of image URL to information about  all external images in the post. This includes image embeds,
	// inline Markdown images, OpenGraph images, and message attachment images, but it does not contain the dimensions
	// of file attachments which are contained in PostMetadata.FileInfos.
	Images map[string]*PostImage `json:"images,omitempty"`

	// A list of reactions made to the post
	Reactions []*Reaction `json:"reactions,omitempty"`
}

type PostImage struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}
