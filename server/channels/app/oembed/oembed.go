// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oembed

import (
	"encoding/json"
	"fmt"
	"io"
)

type OEmbedResponse struct {
	// Type can be one of "photo", "video", "link", or "rich"
	Type string `json:"type"`

	// Fields that may be defined for any response type
	Version         string `json:"version"`
	Title           string `json:"title,omitempty"`
	AuthorName      string `json:"author_name,omitempty"`
	AuthorURL       string `json:"author_url,omitempty"`
	ProviderName    string `json:"provider_name,omitempty"`
	ProviderURL     string `json:"provider_url,omitempty"`
	CacheAge        string `json:"cache_age,omitempty"`
	ThumbnailURL    string `json:"thumbnail_url,omitempty"`
	ThumbnailWidth  int    `json:"thumbnail_width,omitempty"`
	ThumbnailHeight int    `json:"thumbnail_height,omitempty"`

	// Fields that are required for responses with the type "photo"
	URL string `json:"url"`

	// Fields that are required for responses of the type "video" or "rich"
	HTML string `json:"html"`

	// Fields that are required for responses with the type "photo", "video", or "rich"
	Width  int `json:"width"`
	Height int `json:"height"`
}

func ResponseFromJSON(r io.Reader) (*OEmbedResponse, error) {
	var response OEmbedResponse

	err := json.NewDecoder(r).Decode(&response)
	if err != nil {
		return nil, err
	}

	// Do a quick smoke test to confirm that this is hopefully a valid oEmbed response
	if response.Version != "1.0" {
		return nil, fmt.Errorf("ResponseFromJson: Received unsupported response version %s", response.Version)
	}
	if response.Type != "photo" && response.Type != "video" && response.Type != "link" && response.Type != "rich" {
		return nil, fmt.Errorf("ResponseFromJson: Received unsupported response type %s", response.Type)
	}

	return &response, nil
}
