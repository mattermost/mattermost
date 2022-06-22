// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) QueryHashTag(hash_tag_query *string, count uint64) ([]*string, *model.AppError) {
	// Return a list of hashtags that match the query
	hash_tags, err := a.Srv().GetStore().Post().QueryHashTag(hash_tag_query, count)
	if err != nil {
		return nil, model.NewAppError("QueryHashTag", "app.hash_tag.query_hash_tag.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return hash_tags, nil
}
