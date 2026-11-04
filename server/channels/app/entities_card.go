// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

func (a *App) GetEntityCard(rctx request.CTX, typeID, value string) (*model.EntityCard, *model.AppError) {
	if !a.entitiesEnabled() {
		return nil, model.NewAppError("GetEntityCard", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}

	card, remote, err := entities.Prepare(rctx.Context(), typeID, value)
	if err != nil {
		return nil, model.NewAppError("GetEntityCard", "api.context.invalid_url_param.app_error", map[string]any{"Name": "value"}, err.Error(), http.StatusBadRequest)
	}
	if remote != nil && remote.Cache != model.EntityCacheShared {
		return nil, model.NewAppError("GetEntityCard", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
	}
	if remote != nil {
		if got := a.lookupEntityProvider(rctx, remote, typeID, value, "", 0); got != nil {
			return got, nil
		}
		if term, ok := entities.TermCard(typeID, value); ok {
			return term, nil
		}
		card, err = entities.CoreLookup(rctx.Context(), typeID, value)
		if err != nil || card == nil {
			return &model.EntityCard{TypeID: typeID, Value: value, Title: value, Summary: "No additional information"}, nil
		}
	}
	return card, nil
}

func (a *App) GetEntityCardFromPost(rctx request.CTX, postID, typeID, value string) (*model.EntityCard, *model.AppError) {
	if !a.entitiesEnabled() {
		return nil, model.NewAppError("GetEntityCardFromPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	post, appErr := a.readableEntityPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}
	a.hydratePostEntities(withEntityAcceptAll(rctx), post)
	if !postContainsEntity(post, typeID, value) {
		return nil, model.NewAppError("GetEntityCardFromPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	card, remote, err := entities.Prepare(rctx.Context(), typeID, value)
	if err != nil {
		return nil, model.NewAppError("GetEntityCardFromPost", "api.context.invalid_url_param.app_error", map[string]any{"Name": "value"}, err.Error(), http.StatusBadRequest)
	}
	if remote != nil {
		if got := a.lookupEntityProvider(rctx, remote, typeID, value, post.Id, post.CreateAt); got != nil {
			return got, nil
		}
	}
	if term, ok := entities.TermCard(typeID, value); ok {
		return term, nil
	}
	if card != nil {
		return card, nil
	}
	return &model.EntityCard{TypeID: typeID, Value: value, Title: value, Summary: "No additional information"}, nil
}

func (a *App) readableEntityPost(rctx request.CTX, postID string) (*model.Post, *model.AppError) {
	session := rctx.Session()
	if session == nil {
		return nil, model.NewAppError("GetEntityCardForPost", "api.context.session_expired.app_error", nil, "", http.StatusUnauthorized)
	}
	post, appErr, _ := a.GetPostIfAuthorized(rctx, postID, session, false)
	if appErr != nil {
		return nil, appErr
	}
	return post, nil
}

func postContainsEntity(post *model.Post, typeID, value string) bool {
	if post == nil || post.Metadata == nil {
		return false
	}
	for _, entity := range post.Metadata.Entities {
		if entity == nil || entity.Value != value {
			continue
		}
		for _, id := range entity.TypeIDs {
			if id == typeID {
				return true
			}
		}
	}
	return false
}

func (a *App) GetEntityCardForPost(rctx request.CTX, postID, occurrence string) (*model.EntityCard, *model.AppError) {
	if !a.entitiesEnabled() {
		return nil, model.NewAppError("GetEntityCardForPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	post, appErr := a.readableEntityPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}
	a.hydratePostEntities(withEntityAcceptAll(rctx), post)
	if post.Metadata == nil {
		return nil, model.NewAppError("GetEntityCardForPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	var entity *model.PostEntity
	for _, candidate := range post.Metadata.Entities {
		if candidate != nil && candidate.ID == occurrence {
			entity = candidate
			break
		}
	}
	if entity == nil || len(entity.TypeIDs) == 0 {
		return nil, model.NewAppError("GetEntityCardForPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	if remote := entities.ProviderFor(entity.TypeIDs[0]); remote != nil {
		if got := a.lookupEntityProvider(rctx, remote, entity.TypeIDs[0], entity.Value, post.Id, post.CreateAt); got != nil {
			return got, nil
		}
	}
	for _, typeID := range entity.TypeIDs {
		if term, ok := entities.TermCard(typeID, entity.Value); ok {
			return term, nil
		}
	}
	return &model.EntityCard{TypeID: entity.TypeIDs[0], Value: entity.Value, Title: entity.Value}, nil
}

func (a *App) lookupEntityProvider(rctx request.CTX, remote *entities.Remote, typeID, value, postID string, createAt int64) *model.EntityCard {
	env := a.GetPluginsEnvironment()
	if env == nil || remote == nil {
		return nil
	}
	hooks, err := env.HooksForPlugin(remote.PluginID)
	if err != nil {
		return nil
	}
	userID := rctx.Session().UserId
	lookupUser := ""
	if remote.Cache != model.EntityCacheShared {
		lookupUser = userID
	}
	key, cacheable := entities.CardCacheKey(remote.ProviderID, remote.Cache, typeID, value, userID, postID, createAt)
	cardCache := a.Srv().entityCardCache
	if cacheable && cardCache != nil {
		var cached model.EntityCard
		if err := cardCache.Get(key, &cached); err == nil {
			cached.TypeID = typeID
			cached.Value = value
			return &cached
		}
	}
	type lookupResult struct {
		card *model.EntityCard
		err  error
	}
	done := make(chan lookupResult, 1)
	go func() {
		card, err := hooks.EntityLookup(&plugin.Context{}, &model.EntityLookupRequest{
			ProviderID: remote.ProviderID,
			TypeID:     typeID,
			Value:      value,
			UserID:     lookupUser,
			PostID:     postID,
			CreateAt:   createAt,
		})
		done <- lookupResult{card: card, err: err}
	}()
	var card *model.EntityCard
	select {
	case <-rctx.Context().Done():
		return nil
	case <-time.After(entityProviderBudget):
		return nil
	case result := <-done:
		card, err = result.card, result.err
	}
	if err != nil || card == nil {
		return nil
	}
	card.TypeID = typeID
	card.Value = value
	model.NormalizeEntityCard(card)
	if cacheable && cardCache != nil {
		if err := cardCache.SetWithExpiry(key, card, remote.CacheTTL); err != nil {
			rctx.Logger().Warn("Failed to cache entity card", mlog.String("type_id", typeID), mlog.Err(err))
		}
	}
	return card
}

func (a *App) RegisterPluginEntityType(pluginID string, t *model.EntityType) *model.AppError {
	if !a.entitiesEnabled() {
		return model.NewAppError("RegisterPluginEntityType", model.EntitiesDisabledError, nil, "", http.StatusNotImplemented)
	}
	if err := entities.AddType(pluginID, t); err != nil {
		return model.NewAppError("RegisterPluginEntityType", "api.context.invalid_body_param.app_error", map[string]any{"Name": "type"}, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) RegisterPluginEntityMatcher(pluginID string, m *model.EntityMatcher) *model.AppError {
	if !a.entitiesEnabled() {
		return model.NewAppError("RegisterPluginEntityMatcher", model.EntitiesDisabledError, nil, "", http.StatusNotImplemented)
	}
	if err := entities.AddMatcher(pluginID, m); err != nil {
		return model.NewAppError("RegisterPluginEntityMatcher", "api.context.invalid_body_param.app_error", map[string]any{"Name": "matcher"}, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) UnregisterPluginEntityMatcher(pluginID, id string) *model.AppError {
	if !a.entitiesEnabled() {
		return model.NewAppError("UnregisterPluginEntityMatcher", model.EntitiesDisabledError, nil, "", http.StatusNotImplemented)
	}
	if err := entities.UnregisterMatcher(pluginID, id); err != nil {
		return model.NewAppError("UnregisterPluginEntityMatcher", "api.context.invalid_body_param.app_error", map[string]any{"Name": "matcher"}, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) RegisterPluginEntityTerms(pluginID, typeID string, terms []model.EntityTerm) *model.AppError {
	if !a.entitiesEnabled() {
		return model.NewAppError("RegisterPluginEntityTerms", model.EntitiesDisabledError, nil, "", http.StatusNotImplemented)
	}
	epoch, changed, err := entities.ReplaceTerms(pluginID, typeID, terms)
	if err != nil {
		return model.NewAppError("RegisterPluginEntityTerms", "api.context.invalid_body_param.app_error", map[string]any{"Name": "terms"}, err.Error(), http.StatusBadRequest)
	}
	if changed {
		a.publishDictionaryChanged(typeID, epoch)
	}
	return nil
}

func (a *App) RegisterPluginEntityProvider(pluginID string, p *model.EntityProvider) *model.AppError {
	if !a.entitiesEnabled() {
		return model.NewAppError("RegisterPluginEntityProvider", model.EntitiesDisabledError, nil, "", http.StatusNotImplemented)
	}
	if err := entities.AddProvider(pluginID, p); err != nil {
		return model.NewAppError("RegisterPluginEntityProvider", "api.context.invalid_body_param.app_error", map[string]any{"Name": "provider"}, err.Error(), http.StatusBadRequest)
	}
	return nil
}
