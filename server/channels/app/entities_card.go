// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"slices"
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
			return entityCardFallback(typeID, value), nil
		}
	}
	localizeEntityCard(rctx, card)
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
	a.hydratePostEntities(rctx, post)
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
		localizeEntityCard(rctx, card)
		return card, nil
	}
	return entityCardFallback(typeID, value), nil
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
		if slices.Contains(entity.TypeIDs, typeID) {
			return true
		}
	}
	return false
}

func (a *App) GetEntityCardForPost(rctx request.CTX, postID, occurrence, preferredTypeID string) (*model.EntityCard, *model.AppError) {
	if !a.entitiesEnabled() {
		return nil, model.NewAppError("GetEntityCardForPost", "api.context.404.app_error", nil, "", http.StatusNotFound)
	}
	post, appErr := a.readableEntityPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}
	a.hydratePostEntities(rctx, post)
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
	typeIDs := entity.TypeIDs
	if preferredTypeID != "" {
		ordered := make([]string, 0, len(typeIDs))
		for _, typeID := range typeIDs {
			if typeID == preferredTypeID {
				ordered = append(ordered, typeID)
			}
		}
		for _, typeID := range typeIDs {
			if typeID != preferredTypeID {
				ordered = append(ordered, typeID)
			}
		}
		if len(ordered) > 0 && ordered[0] == preferredTypeID {
			typeIDs = ordered
		}
	}
	var thin *model.EntityCard
	for _, typeID := range typeIDs {
		card, remote, err := entities.Prepare(rctx.Context(), typeID, entity.Value)
		if err != nil {
			continue
		}
		if remote != nil {
			if got := a.lookupEntityProvider(rctx, remote, typeID, entity.Value, post.Id, post.CreateAt); got != nil {
				return got, nil
			}
		}
		if term, ok := entities.TermCard(typeID, entity.Value); ok {
			return term, nil
		}
		if card != nil {
			model.NormalizeEntityCard(card)
			localizeEntityCard(rctx, card)
			if model.EntityCardHasBody(card) || card.Instant != 0 {
				return card, nil
			}
			if thin == nil {
				thin = card
			}
		}
	}
	if thin != nil {
		return thin, nil
	}
	return entityCardFallback(entity.TypeIDs[0], entity.Value), nil
}

func entityCardFallback(typeID, value string) *model.EntityCard {
	return &model.EntityCard{TypeID: typeID, Value: value, Title: value}
}

func localizeEntityCard(rctx request.CTX, card *model.EntityCard) {
	if card == nil || rctx.GetT() == nil || card.TypeID != "mm.time" {
		return
	}
	card.Title = rctx.T("app.entities.core.timestamp_title")
	if card.Instant == 0 {
		return
	}
	utc := time.UnixMilli(card.Instant).UTC()
	blocks, err := json.Marshal([]map[string]any{
		{
			"type": "text",
			"text": rctx.T("app.entities.core.timestamp_utc", map[string]any{"Time": utc.Format("15:04 MST")}),
		},
		{
			"type":      "text",
			"text":      rctx.T("app.entities.core.timestamp_as_written", map[string]any{"Value": card.Value}),
			"is_subtle": true,
		},
	})
	if err != nil {
		return
	}
	card.Blocks = blocks
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
		if cacheErr := cardCache.Get(key, &cached); cacheErr == nil {
			cached.TypeID = typeID
			cached.Value = value
			return &cached
		}
	}
	slot, _ := providerLookupSlot.LoadOrStore(remote.ProviderID, make(chan struct{}, entityProviderLookupCap))
	slots := slot.(chan struct{})
	select {
	case slots <- struct{}{}:
	default:
		return nil
	}
	type lookupResult struct {
		card *model.EntityCard
		err  error
	}
	done := make(chan lookupResult, 1)
	go func() {
		defer func() { <-slots }()
		card, lookupErr := hooks.EntityLookup(&plugin.Context{}, &model.EntityLookupRequest{
			ProviderID: remote.ProviderID,
			TypeID:     typeID,
			Value:      value,
			UserID:     lookupUser,
			PostID:     postID,
			CreateAt:   createAt,
		})
		done <- lookupResult{card: card, err: lookupErr}
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
	if _, _, err := entities.ReplaceTerms(pluginID, typeID, terms); err != nil {
		return model.NewAppError("RegisterPluginEntityTerms", "api.context.invalid_body_param.app_error", map[string]any{"Name": "terms"}, err.Error(), http.StatusBadRequest)
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
