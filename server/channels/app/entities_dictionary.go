// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

const maxEntityPostIDs = 200

func (s *Server) loadEntityTerms() {
	rows, err := s.Store().EntityTerm().List()
	if err != nil {
		s.Log().Warn("Failed to load entity terms", mlog.Err(err))
		return
	}
	entities.LoadTerms(rows)
}

func (a *App) publishDictionaryChanged(typeID string, generation int64) {
	event := model.NewWebSocketEvent(model.WebsocketEventEntitiesDictionaryChanged, "", "", "", nil, "")
	event.Add("type_id", typeID)
	event.Add("generation", generation)
	a.Publish(event)
}

func (a *App) GetEntityPosts(rctx request.CTX, postIDs []string) (map[string][]*model.PostEntity, *model.AppError) {
	if !a.entitiesEnabled() {
		return nil, model.NewAppError("GetEntityPosts", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	if len(postIDs) == 0 || len(postIDs) > maxEntityPostIDs {
		return nil, model.NewAppError("GetEntityPosts", "api.context.invalid_body_param.app_error", map[string]any{"Name": "post_ids"}, "", http.StatusBadRequest)
	}
	posts, _, appErr := a.GetPostsByIds(postIDs)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return map[string][]*model.PostEntity{}, nil
		}
		return nil, appErr
	}
	readable := map[string]bool{}
	var kept []*model.Post
	for _, post := range posts {
		if post == nil || post.DeleteAt > 0 {
			continue
		}
		allowed, known := readable[post.ChannelId]
		if !known {
			channel, chErr := a.GetChannel(rctx, post.ChannelId)
			if chErr != nil {
				readable[post.ChannelId] = false
				continue
			}
			allowed, _ = a.SessionHasPermissionToReadChannel(rctx, *rctx.Session(), channel)
			readable[post.ChannelId] = allowed
		}
		if !allowed {
			continue
		}
		kept = append(kept, post)
	}
	a.hydratePostList(rctx, kept)
	out := map[string][]*model.PostEntity{}
	for _, post := range kept {
		entities := []*model.PostEntity{}
		if post.Metadata != nil && post.Metadata.Entities != nil {
			entities = post.Metadata.Entities
		}
		out[post.Id] = entities
	}
	return out, nil
}
