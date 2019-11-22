// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// AliasesService returns the aliases associated with one or more indices, or the
// indices associated with one or more aliases, or a combination of those filters.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/indices-aliases.html.
type AliasesService struct {
	client *Client
	index  []string
	alias  []string
	pretty bool
}

// NewAliasesService instantiates a new AliasesService.
func NewAliasesService(client *Client) *AliasesService {
	builder := &AliasesService{
		client: client,
	}
	return builder
}

// Pretty asks Elasticsearch to indent the returned JSON.
func (s *AliasesService) Pretty(pretty bool) *AliasesService {
	s.pretty = pretty
	return s
}

// Index adds one or more indices.
func (s *AliasesService) Index(index ...string) *AliasesService {
	s.index = append(s.index, index...)
	return s
}

// Alias adds one or more aliases.
func (s *AliasesService) Alias(alias ...string) *AliasesService {
	s.alias = append(s.alias, alias...)
	return s
}

// buildURL builds the URL for the operation.
func (s *AliasesService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_alias/{alias}", map[string]string{
			"index": strings.Join(s.index, ","),
			"alias": strings.Join(s.alias, ","),
		})
	} else {
		path, err = uritemplates.Expand("/_alias/{alias}", map[string]string{
			"alias": strings.Join(s.alias, ","),
		})
	}
	if err != nil {
		return "", url.Values{}, err
	}
	path = strings.TrimSuffix(path, "/")

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	return path, params, nil
}

func (s *AliasesService) Do(ctx context.Context) (*AliasesResult, error) {
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "GET",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// {
	//   "indexName" : {
	//     "aliases" : {
	//       "alias1" : { },
	//       "alias2" : { }
	//     }
	//   },
	//   "indexName2" : {
	//     ...
	//   },
	// }
	indexMap := make(map[string]struct {
		Aliases map[string]struct {
			IsWriteIndex bool `json:"is_write_index"`
		} `json:"aliases"`
	})
	if err := s.client.decoder.Decode(res.Body, &indexMap); err != nil {
		return nil, err
	}

	// Each (indexName, _)
	ret := &AliasesResult{
		Indices: make(map[string]indexResult),
	}
	for indexName, indexData := range indexMap {
		if indexData.Aliases == nil {
			continue
		}

		indexOut, found := ret.Indices[indexName]
		if !found {
			indexOut = indexResult{Aliases: make([]aliasResult, 0)}
		}

		// { "aliases" : { ... } }
		for aliasName, aliasData := range indexData.Aliases {
			aliasRes := aliasResult{AliasName: aliasName, IsWriteIndex: aliasData.IsWriteIndex}
			indexOut.Aliases = append(indexOut.Aliases, aliasRes)
		}

		ret.Indices[indexName] = indexOut
	}

	return ret, nil
}

// -- Result of an alias request.

// AliasesResult is the outcome of calling AliasesService.Do.
type AliasesResult struct {
	Indices map[string]indexResult
}

type indexResult struct {
	Aliases []aliasResult
}

type aliasResult struct {
	AliasName    string
	IsWriteIndex bool
}

// IndicesByAlias returns all indices given a specific alias name.
func (ar AliasesResult) IndicesByAlias(aliasName string) []string {
	var indices []string
	for indexName, indexInfo := range ar.Indices {
		for _, aliasInfo := range indexInfo.Aliases {
			if aliasInfo.AliasName == aliasName {
				indices = append(indices, indexName)
			}
		}
	}
	return indices
}

// HasAlias returns true if the index has a specific alias.
func (ir indexResult) HasAlias(aliasName string) bool {
	for _, alias := range ir.Aliases {
		if alias.AliasName == aliasName {
			return true
		}
	}
	return false
}
