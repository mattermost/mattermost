// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type MarketplacePluginState int

const (
	MarketplacePluginStateNotInstalled MarketplacePluginState = iota
	MarketplacePluginStateInstalled
)

type BaseMarketplacePlugin struct {
	HomepageURL  string
	DownloadURL  string
	SignatureURL string
	Manifest     *Manifest
}

// MarketplacePlugin is a state aware marketplace plugin.
type MarketplacePlugin struct {
	*BaseMarketplacePlugin
	State MarketplacePluginState
}

// BaseMarketplacePluginsFromReader decodes a json-encoded list of plugins from the given io.Reader.
func BaseMarketplacePluginsFromReader(reader io.Reader) ([]*BaseMarketplacePlugin, error) {
	plugins := []*BaseMarketplacePlugin{}
	decoder := json.NewDecoder(reader)

	if err := decoder.Decode(&plugins); err != nil && err != io.EOF {
		return nil, err
	}

	return plugins, nil
}

// MarketplacePluginsFromReader decodes a json-encoded list of plugins from the given io.Reader.
func MarketplacePluginsFromReader(reader io.Reader) ([]*MarketplacePlugin, error) {
	plugins := []*MarketplacePlugin{}
	decoder := json.NewDecoder(reader)

	if err := decoder.Decode(&plugins); err != nil && err != io.EOF {
		return nil, err
	}

	return plugins, nil
}
