// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostMetadata struct {
	// Embeds holds information required to render content embedded in the post. This includes the OpenGraph metadata
	// for links in the post.
	Embeds []*PostEmbed `json:"embeds,omitempty"`

	// Emojis holds all custom emojis used in the post or used in reaction to the post.
	Emojis []*Emoji `json:"emojis,omitempty"`

	// Files holds information about the file attachments on the post.
	Files []*FileInfo `json:"files,omitempty"`

	// Images holds the dimensions of all external images in the post as a map of the image URL to its dimensions.
	// This includes image embeds (when the message contains a plaintext link to an image), Markdown images, images
	// contained in the OpenGraph metadata, and images contained in message attachments. It does not contain
	// the dimensions of any file attachments as those are stored in FileInfos.
	Images map[string]*PostImage `json:"images,omitempty"`

	// Reactions holds reactions made to the post.
	Reactions []*Reaction `json:"reactions,omitempty"`

	// Priority holds info about priority settings for the post.
	Priority *PostPriority `json:"priority,omitempty"`

	// Acknowledgements holds acknowledgements made by users to the post
	Acknowledgements []*PostAcknowledgement `json:"acknowledgements,omitempty"`
}

func (pm *PostMetadata) Auditable() map[string]any {
	embeds := make([]map[string]any, 0, len(pm.Embeds))
	for _, pe := range pm.Embeds {
		embeds = append(embeds, pe.Auditable())
	}
	if len(embeds) == 0 {
		embeds = nil
	}

	return map[string]any{
		"embeds":           embeds,
		"emojis":           pm.Emojis,
		"files":            pm.Files,
		"images":           pm.Images,
		"reactions":        pm.Reactions,
		"priority":         pm.Priority,
		"acknowledgements": pm.Acknowledgements,
	}
}

type PostImage struct {
	Width  int `json:"width"`
	Height int `json:"height"`

	// Format is the name of the image format as used by image/go such as "png", "gif", or "jpeg".
	Format string `json:"format"`

	// FrameCount stores the number of frames in this image, if it is an animated gif. It will be 0 for other formats.
	FrameCount int `json:"frame_count"`
}

// Copy does a deep copy
func (p *PostMetadata) Copy() *PostMetadata {
	embedsCopy := make([]*PostEmbed, len(p.Embeds))
	copy(embedsCopy, p.Embeds)

	emojisCopy := make([]*Emoji, len(p.Emojis))
	copy(emojisCopy, p.Emojis)

	filesCopy := make([]*FileInfo, len(p.Files))
	copy(filesCopy, p.Files)

	imagesCopy := map[string]*PostImage{}
	for k, v := range p.Images {
		imagesCopy[k] = v
	}

	reactionsCopy := make([]*Reaction, len(p.Reactions))
	copy(reactionsCopy, p.Reactions)

	acknowledgementsCopy := make([]*PostAcknowledgement, len(p.Acknowledgements))
	copy(acknowledgementsCopy, p.Acknowledgements)

	var postPriorityCopy *PostPriority
	if p.Priority != nil {
		postPriorityCopy = &PostPriority{
			Priority:                p.Priority.Priority,
			RequestedAck:            p.Priority.RequestedAck,
			PersistentNotifications: p.Priority.PersistentNotifications,
			PostId:                  p.Priority.PostId,
			ChannelId:               p.Priority.ChannelId,
		}
	}

	return &PostMetadata{
		Embeds:           embedsCopy,
		Emojis:           emojisCopy,
		Files:            filesCopy,
		Images:           imagesCopy,
		Reactions:        reactionsCopy,
		Priority:         postPriorityCopy,
		Acknowledgements: acknowledgementsCopy,
	}
}
