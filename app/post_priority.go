// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) GetPriorityForPost(postId string) (*model.PostPriority, *model.AppError) {
	priority, err := a.Srv().Store().PostPriority().GetForPost(postId)

	if err != nil && err != sql.ErrNoRows {
		return nil, model.NewAppError("GetPriorityForPost", "app.post_priority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return priority, nil
}
