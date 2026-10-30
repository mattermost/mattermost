// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import "github.com/mattermost/mattermost/server/public/model"

type postEntityStore struct{}

func (postEntityStore) Save(*model.PostEntityRow) error { return nil }
func (postEntityStore) Get(string) (*model.PostEntityRow, error) {
	return nil, nil
}
func (postEntityStore) GetMany([]string) (map[string]*model.PostEntityRow, error) {
	return map[string]*model.PostEntityRow{}, nil
}

type entityTermStore struct{}

func (entityTermStore) Replace(string, string, []model.EntityTerm, int64) error { return nil }
func (entityTermStore) List() ([]model.EntityTermRow, error)                    { return nil, nil }
