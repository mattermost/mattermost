// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type MarketplacePluginState int

const (
	NotInstalled MarketplacePluginState = iota
	Installed
)

// MarketplacePlugin provides a cluster-aware view of installed plugins.
type MarketplacePlugin struct {
	HomepageURL  string
	DownloadURL  string
	SignatureURL string
	Manifest     *Manifest
	State        MarketplacePluginState
}

type MarketplacePlugins []*MarketplacePlugin

// PluginFromReader decodes a json-encoded cluster from the given io.Reader.
func PluginFromReader(reader io.Reader) (*MarketplacePlugin, error) {
	cluster := MarketplacePlugin{}
	decoder := json.NewDecoder(reader)
	err := decoder.Decode(&cluster)
	if err != nil && err != io.EOF {
		return nil, err
	}

	return &cluster, nil
}

// PluginsFromReader decodes a json-encoded list of plugins from the given io.Reader.
func PluginsFromReader(reader io.Reader) (MarketplacePlugins, error) {
	plugins := []*MarketplacePlugin{}
	decoder := json.NewDecoder(reader)

	err := decoder.Decode(&plugins)
	if err != nil && err != io.EOF {
		return nil, err
	}

	return plugins, nil
}

// PluginsFromReader decodes a json-encoded list of plugins from the given io.Reader.
// ToJson serializes the bot to json.
func (p *MarketplacePlugin) ToJson() []byte {
	data, _ := json.Marshal(p)
	return data
}

func (p *MarketplacePlugins) ToJson() []byte {
	data, _ := json.Marshal(p)
	return data
}
