// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strings"
	"text/template"

	"github.com/mattermost/mattermost/server/v8/channels/app/oembed"
	"github.com/pkg/errors"
)

// To update the list of oEmbed providers that we support:
// 1. Download the latest providers.json file from https://oembed.com/providers.json and place it in this folder
// 2. If desired, update supportedProviders below to add the names of additional oEmbed providers that we want to use
// 3. Run `go generate ./channels/app/oembed` from the server folder

var (
	// supportedProviders contains the names of all of the oEmbed providers that we currently support.
	//
	// As of writing, we're only going to support YouTube because they've stopped giving us the required OpenGraph
	// metadata. When we want to support oEmbed embeds for other providers, this will need to be updated.
	supportedProviders = []string{
		"YouTube",
	}

	outputTemplate = template.Must(template.New("providers.go.tmpl").ParseFiles("./generator/providers.go.tmpl"))
)

type oEmbedProvider struct {
	ProviderName string            `json:"provider_name"`
	ProviderURL  string            `json:"provider_url"`
	Endpoints    []*oEmbedEndpoint `json:"endpoints"`
}

type oEmbedEndpoint struct {
	Schemes   []string `json:"schemes,omitempty"`
	URL       string   `json:"url"`
	Discovery bool     `json:"discovery,omitempty"`
	Formats   []string `json:"formats,omitempty"`
}

func main() {
	inputJson, err := os.ReadFile("./generator/providers.json")
	if err != nil {
		panic(errors.Wrap(err, "Unable to read providers.json. Did you forget to put it next to providers_generator.go?"))
	}

	outputFile, err := os.Create("./providers_gen.go")
	if err != nil {
		panic(errors.Wrap(err, "Unable to open output file"))
	}
	defer outputFile.Close()

	var input []*oEmbedProvider
	err = json.Unmarshal(inputJson, &input)
	if err != nil {
		panic(errors.Wrap(err, "Unable to read providers.json"))
	}

	var endpoints []*oembed.ProviderEndpoint
	for _, inputProvider := range input {
		if !slices.Contains(supportedProviders, inputProvider.ProviderName) {
			continue
		}

		providerEndpoints, extractErr := extractEndpointsFromProvider(inputProvider)
		if extractErr != nil {
			panic(errors.Wrap(extractErr, "Unable to convert oEmbedProvider from providers.json to a ProviderEndpoint"))
		}
		endpoints = append(endpoints, providerEndpoints...)
	}

	err = outputTemplate.Execute(outputFile, map[string]any{
		"Endpoints": endpoints,
	})
	if err != nil {
		panic(errors.Wrap(err, "Unable to write file using template"))
	}
}

// extractEndpointsFromProvider turns the data for one provider into providers.json into multiple, more compact ProviderEndpoints
func extractEndpointsFromProvider(in *oEmbedProvider) ([]*oembed.ProviderEndpoint, error) {
	var out []*oembed.ProviderEndpoint

	for _, endpoint := range in.Endpoints {
		// Ensure that the endpoint URL is valid so that we don't need to error check it at runtime
		_, err := url.Parse(endpoint.URL)
		if err != nil {
			return nil, err
		}

		var patterns []*regexp.Regexp
		for _, scheme := range endpoint.Schemes {
			pattern, err := schemeToPattern(scheme)
			if err != nil {
				return nil, err
			}

			patterns = append(patterns, pattern)
		}

		if len(patterns) > 0 {
			out = append(out, &oembed.ProviderEndpoint{
				URL:      endpoint.URL,
				Patterns: patterns,
			})
		}
	}

	return out, nil
}

func schemeToPattern(scheme string) (*regexp.Regexp, error) {
	partsPattern := regexp.MustCompile(`^(\w+:(?://)?)([^/]*)(/[^?]*)?(\?[^?]*)?$`)
	parts := partsPattern.FindStringSubmatch(scheme)
	if parts == nil {
		return nil, fmt.Errorf("unable to split scheme %s into parts", scheme)
	} else if len(parts) != 5 {
		return nil, fmt.Errorf("wrong number of parts for scheme %s", scheme)
	}

	protocol := parts[1]
	if protocol != "http://" && protocol != "https://" && protocol != "spotify:" {
		return nil, fmt.Errorf("unrecognized protocol %s for scheme %s", protocol, scheme)
	}
	domain := parts[2]
	if domain == "" {
		return nil, fmt.Errorf("no domain found for scheme %s", scheme)
	}
	path := parts[3]
	if path == "" && protocol != "spotify:" {
		return nil, fmt.Errorf("no path found for scheme %s", scheme)
	}
	query := parts[4]

	// Replace any valid wildcards with a temporary character so that we can escape any regexp special characters
	domain = strings.Replace(domain, "*", "%", -1)
	path = strings.Replace(path, "*", "%", -1)
	query = strings.Replace(query, "*", "%", -1)

	// Escape any other special characters
	protocol = regexp.QuoteMeta(protocol)
	domain = regexp.QuoteMeta(domain)
	path = regexp.QuoteMeta(path)
	query = regexp.QuoteMeta(query)

	// Replace the temporary character with the proper regexp to match a wildcard in that part of the URL
	domain = strings.Replace(domain, "%", "[^/]*?", -1)
	path = strings.Replace(path, "%", ".*?", -1)
	query = strings.Replace(query, "%", ".*?", -1)

	// Allow http schemes to match https URLs as well
	if protocol == "http://" {
		protocol = "https?://"
	}

	return regexp.Compile("^" + protocol + domain + path + query + "$")
}
