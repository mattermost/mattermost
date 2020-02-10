// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/url"
	"strconv"

	"github.com/pkg/errors"
)

// BaseMarketplacePlugin is a Mattermost plugin received from the Marketplace server.
type BaseMarketplacePlugin struct {
	HomepageURL     string             `json:"homepage_url"`
	IconData        string             `json:"icon_data"`
	DownloadURL     string             `json:"download_url"`
	ReleaseNotesURL string             `json:"release_notes_url"`
	Labels          []MarketplaceLabel `json:"labels"`
	Signature       string             `json:"signature"` // Signature represents a signature of a plugin saved in base64 encoding.
	Manifest        *Manifest          `json:"manifest"`
}

// MarketplaceLabel represents a label shown in the Marketplace UI.
type MarketplaceLabel struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Color       string `json:"color"`
}

// MarketplacePlugin is a state aware Marketplace plugin.
type MarketplacePlugin struct {
	*BaseMarketplacePlugin
	InstalledVersion string `json:"installed_version"`
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

// DecodeSignature Decodes signature and returns ReadSeeker.
func (plugin *BaseMarketplacePlugin) DecodeSignature() (io.ReadSeeker, error) {
	signatureBytes, err := base64.StdEncoding.DecodeString(plugin.Signature)
	if err != nil {
		return nil, errors.Wrap(err, "Unable to decode base64 signature.")
	}
	return bytes.NewReader(signatureBytes), nil
}

// MarketplacePluginFilter describes the parameters to request a list of plugins.
type MarketplacePluginFilter struct {
	Page          int
	PerPage       int
	Filter        string
	ServerVersion string
	LocalOnly     bool
}

// ApplyToURL modifies the given url to include query string parameters for the request.
func (filter *MarketplacePluginFilter) ApplyToURL(u *url.URL) {
	q := u.Query()
	q.Add("page", strconv.Itoa(filter.Page))
	if filter.PerPage > 0 {
		q.Add("per_page", strconv.Itoa(filter.PerPage))
	}
	q.Add("filter", filter.Filter)
	q.Add("server_version", filter.ServerVersion)
	q.Add("local_only", strconv.FormatBool(filter.LocalOnly))
	u.RawQuery = q.Encode()
}

// InstallMarketplacePluginRequest struct describes parameters of the requested plugin.
type InstallMarketplacePluginRequest struct {
	Id      string `json:"id"`
	Version string `json:"version"`
}

// PluginRequestFromReader decodes a json-encoded plugin request from the given io.Reader.
func PluginRequestFromReader(reader io.Reader) (*InstallMarketplacePluginRequest, error) {
	var r *InstallMarketplacePluginRequest
	err := json.NewDecoder(reader).Decode(&r)
	if err != nil {
		return nil, err
	}
	return r, nil
}

// ToJson method will return json from plugin request.
func (r *InstallMarketplacePluginRequest) ToJson() (string, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
