// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
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

func (a *App) IsPostPriorityEnabled() bool {
	return *a.Config().ServiceSettings.PostPriority
}

func (a *App) DeletePriorityForPost(postId string) *model.AppError {
	err := a.Srv().Store().PostPriority().Delete(postId)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return model.NewAppError("DeletePriorityForPost", "app.post_priority.delete_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
