// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

// This is a copy of https://github.com/elastic/go-elasticsearch/blob/9.0/typedapi/esdsl/sortcombinations.go.
// This API is meant to be part of 9.0, but it got added to as part of 8.18.
// That's why we need to copy it locally for now.

import (
	"encoding/json"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
)

type _sortOptions struct {
	v *types.SortOptions
}

func NewSortOptions() *_sortOptions {
	return &_sortOptions{v: types.NewSortOptions()}
}

func (s *_sortOptions) Doc_(doc_ *types.ScoreSort) *_sortOptions {
	s.v.Doc_ = doc_
	return s
}

func (s *_sortOptions) GeoDistance_(geodistance_ *types.GeoDistanceSort) *_sortOptions {
	s.v.GeoDistance_ = geodistance_
	return s
}

func (s *_sortOptions) Score_(score_ *types.ScoreSort) *_sortOptions {
	s.v.Score_ = score_
	return s
}

func (s *_sortOptions) Script_(script_ *types.ScriptSort) *_sortOptions {
	s.v.Script_ = script_
	return s
}

func (s *_sortOptions) SortOptions(sortoptions map[string]types.FieldSort) *_sortOptions {
	s.v.SortOptions = sortoptions
	return s
}

func (s *_sortOptions) AddSortOption(key string, value *types.FieldSort) *_sortOptions {
	tmp := s.v.SortOptions
	if s.v.SortOptions == nil {
		tmp = make(map[string]types.FieldSort)
	}

	tmp[key] = *value

	s.v.SortOptions = tmp
	return s
}

func (s *_sortOptions) SortOptionsCaster() *types.SortOptions {
	return s.v
}

func (s *_sortOptions) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.v)
}

// Interface implementation for SortOptions in SortCombinations union
func (s *_sortOptions) SortCombinationsCaster() *types.SortCombinations {
	t := types.SortCombinations(s.v)
	return &t
}
