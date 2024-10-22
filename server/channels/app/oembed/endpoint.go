// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oembed

import (
	"net/url"
	"regexp"
)

//go:generate go run ./generator/providers_generator.go

type ProviderEndpoint struct {
	URL      string
	Patterns []*regexp.Regexp
}

func (e *ProviderEndpoint) GetProviderURL(requestURL string) string {
	// This error is checked when generating the list of providers
	url, _ := url.Parse(e.URL)

	query := url.Query()
	query.Add("format", "json")
	query.Add("url", requestURL)
	url.RawQuery = query.Encode()

	return url.String()
}

// FindEndpointForURL returns a ProviderEndpoint for a given URL if it matches one that's supported by us. Returns nil
// if none of the supported providers match the given URL.
func FindEndpointForURL(requestURL string) *ProviderEndpoint {
	for _, provider := range providers {
		for _, pattern := range provider.Patterns {
			if pattern.MatchString(requestURL) {
				return provider
			}
		}
	}

	return nil
}
