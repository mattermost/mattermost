// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

// This is a copy of https://github.com/elastic/go-elasticsearch/blob/9.0/typedapi/esdsl/sortcombinations.go.
// This API is meant to be part of 9.0, but it got added to as part of 8.18.
// That's why we need to copy it locally for now.

import "github.com/elastic/go-elasticsearch/v8/typedapi/types"

type _sortOptions struct {
	v *types.SortOptions
}

func NewSortOptions() *_sortOptions {
	return &_sortOptions{v: types.NewSortOptions()}
}

func (s *_sortOptions) Doc_(doc_ types.ScoreSortVariant) *_sortOptions {
	s.v.Doc_ = doc_.ScoreSortCaster()
	return s
}

func (s *_sortOptions) GeoDistance_(geodistance_ types.GeoDistanceSortVariant) *_sortOptions {
	s.v.GeoDistance_ = geodistance_.GeoDistanceSortCaster()
	return s
}

func (s *_sortOptions) Score_(score_ types.ScoreSortVariant) *_sortOptions {
	s.v.Score_ = score_.ScoreSortCaster()
	return s
}

func (s *_sortOptions) Script_(script_ types.ScriptSortVariant) *_sortOptions {
	s.v.Script_ = script_.ScriptSortCaster()
	return s
}

func (s *_sortOptions) SortOptions(sortoptions map[string]types.FieldSort) *_sortOptions {
	s.v.SortOptions = sortoptions
	return s
}

func (s *_sortOptions) AddSortOption(key string, value types.FieldSortVariant) *_sortOptions {
	var tmp map[string]types.FieldSort
	if s.v.SortOptions == nil {
		s.v.SortOptions = make(map[string]types.FieldSort)
	} else {
		tmp = s.v.SortOptions
	}

	tmp[key] = *value.FieldSortCaster()

	s.v.SortOptions = tmp
	return s
}

func (s *_sortOptions) SortOptionsCaster() *types.SortOptions {
	return s.v
}

// Interface implementation for SortOptions in SortCombinations union
func (s *_sortOptions) SortCombinationsCaster() *types.SortCombinations {
	t := types.SortCombinations(s.v)
	return &t
}
