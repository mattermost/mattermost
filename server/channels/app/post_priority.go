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
		return nil, model.NewAppError("GetPriorityForPost", "app.post_prority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return priority, nil
}

func (a *App) GetPriorityForPostList(list *model.PostList) (map[string]*model.PostPriority, *model.AppError) {
	priority, err := a.Srv().Store().PostPriority().GetForPosts(list.Order)
	if err != nil {
		return nil, model.NewAppError("GetPriorityForPost", "app.post_prority.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	priorityMap := make(map[string]*model.PostPriority)
	for _, p := range priority {
		priorityMap[p.PostId] = p
	}

	return priorityMap, nil
}
