// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

type databaseStore struct {
}

func NewDatabaseStore() *databaseStore {
	return &databaseStore{}
}
