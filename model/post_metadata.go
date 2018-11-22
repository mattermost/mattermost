// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type PostMetadata struct {
	// Embeds holds information required to render content embedded in the post. This includes the OpenGraph metadata
	// for links in the post.
	Embeds []*PostEmbed `json:"embeds,omitempty"`

	// Emojis holds all custom emojis used in the post or used in reaction to the post.
	Emojis []*Emoji `json:"emojis,omitempty"`

	// Files holds information about the file attachments on the post.
	Files []*FileInfo `json:"files,omitempty"`

	// Images holds the dimensions of all external images in the post as a map of the image URL to its diemsnions.
	// This includes image embeds (when the message contains a plaintext link to an image), Markdown images, images
	// contained in the OpenGraph metadata, and images contained in message attachments. It does not contain
	// the dimensions of any file attachments as those are stored in FileInfos.
	Images map[string]*PostImage `json:"images,omitempty"`

	// Reactions holds reactions made to the post.
	Reactions []*Reaction `json:"reactions,omitempty"`
}

type PostImage struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}
