// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type PostMetadata struct {
	// An array of the information required to render additional details about the contents of this post.
	Embeds []*PostEmbed `json:"embeds,omitempty"`

	// An arrayof the  custom emojis used in the post or in reactions to the post.
	Emojis []*Emoji `json:"emojis,omitempty"`

	// An array of information about the files attached to the post.
	FileInfos []*FileInfo `json:"files_infos,omitempty"`

	// A map of image URL to dimensions for all external images in the post. This includes image embeds,
	// inline Markdown images, OpenGraph images, and message attachment images, but it does not contain the dimensions
	// of file attachments which are contained in PostMetadata.FileInfos.
	ImageDimensions map[string]*PostImageDimensions `json:"images_dimensions,omitempty"`

	// A map of emoji names to a count of users that reacted with the given emoji.
	ReactionCounts ReactionCounts `json:"reaction_counts,omitempty"`
}

type PostImageDimensions struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}
