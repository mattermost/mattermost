// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

const (
	entityMemoCap    = 8192
	entityRefreshCap = 4
	validateCacheCap = 4096
	validateCacheTTL = 30 * time.Second
)

func (a *App) entitiesEnabled() bool {
	if os.Getenv("MM_ENTITIES") == "1" {
		return true
	}
	if a.Config().FeatureFlags != nil && a.Config().FeatureFlags.Entities {
		license := a.License()
		if license == nil {
			return true
		}
		if !model.MinimumEnterpriseLicense(license) {
			return false
		}
		if license.Features != nil && license.Features.Entities != nil && !*license.Features.Entities {
			return false
		}
		return true
	}
	return false
}

func shouldDetectEntities(post *model.Post) bool {
	if post == nil || post.Id == "" || post.DeleteAt > 0 || post.Message == "" {
		return false
	}
	if post.Type == model.PostTypeBurnOnRead {
		return false
	}
	if strings.HasPrefix(post.Type, "system_") {
		return false
	}
	switch post.Type {
	case "custom_tf_location", "custom_tf_airfields":
		return true
	}
	if strings.HasPrefix(post.Type, "custom_") {
		return false
	}
	return true
}

type entityPending struct {
	post *model.Post
	hash string
}

type entityScanResult struct {
	list  []*model.PostEntity
	saved bool
}

type entityMemo struct {
	mu    sync.Mutex
	order []string
	items map[string][]*model.PostEntity
	pos   int
}

func newEntityMemo(capacity int) *entityMemo {
	return &entityMemo{
		order: make([]string, capacity),
		items: map[string][]*model.PostEntity{},
	}
}

func (m *entityMemo) get(key string) ([]*model.PostEntity, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	list, ok := m.items[key]
	if !ok {
		return nil, false
	}
	return clonePostEntities(list), true
}

func (m *entityMemo) put(key string, list []*model.PostEntity) {
	m.mu.Lock()
	defer m.mu.Unlock()
	copied := clonePostEntities(list)
	if _, exists := m.items[key]; exists {
		m.items[key] = copied
		return
	}
	if old := m.order[m.pos]; old != "" {
		delete(m.items, old)
	}
	m.order[m.pos] = key
	m.items[key] = copied
	m.pos = (m.pos + 1) % len(m.order)
}

func (m *entityMemo) reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.order = make([]string, len(m.order))
	m.items = map[string][]*model.PostEntity{}
	m.pos = 0
}

type entityPageKey struct{}

var (
	postEntityMemo    = newEntityMemo(entityMemoCap)
	entityScan        singleflight.Group
	entityRefreshSlot = make(chan struct{}, entityRefreshCap)

	validateMu    sync.Mutex
	validateCache = map[string]validateHit{}
)

type validateHit struct {
	ok    bool
	until int64
}

func entityMemoKey(postID, hash, generation string, epoch int64) string {
	return postID + "\n" + hash + "\n" + generation + "\n" + strconv.FormatInt(epoch, 10)
}

func (a *App) hydratePostEntities(rctx request.CTX, post *model.Post) {
	a.hydratePostList(rctx, []*model.Post{post})
}

func (a *App) hydratePostList(rctx request.CTX, posts []*model.Post) {
	if !a.entitiesEnabled() || len(posts) == 0 {
		return
	}
	generation := entities.PatternGeneration()
	epoch := entities.TermEpoch()
	pending := make([]entityPending, 0, len(posts))
	ids := make([]string, 0, len(posts))
	for _, post := range posts {
		if !shouldDetectEntities(post) {
			continue
		}
		if post.Metadata == nil {
			post.Metadata = &model.PostMetadata{}
		}
		hash := entities.MessageHash(post.Message)
		if list, ok := postEntityMemo.get(entityMemoKey(post.Id, hash, generation, epoch)); ok {
			post.Metadata.Entities = a.presentPostEntities(rctx, post, list)
			continue
		}
		pending = append(pending, entityPending{post: post, hash: hash})
		ids = append(ids, post.Id)
	}
	if len(pending) == 0 {
		return
	}

	rows, err := a.Srv().Store().PostEntity().GetMany(ids)
	if err != nil {
		rctx.Logger().Warn("Failed to get post entities", mlog.Err(err))
		return
	}
	if rows == nil {
		rows = map[string]*model.PostEntityRow{}
	}
	for _, item := range pending {
		row := rows[item.post.Id]
		if row != nil && row.MessageHash == item.hash && row.PatternGeneration == generation {
			a.rememberEntities(rctx, item.post, item.hash, generation, epoch, entities.ApplyTerms(item.post.Message, row.ProtectedRanges, row.Entities))
			continue
		}
		if row != nil && row.MessageHash == item.hash {
			item.post.Metadata.Entities = a.presentPostEntities(rctx, item.post, entities.ApplyTerms(item.post.Message, row.ProtectedRanges, row.Entities))
			a.refreshEntitiesLater(rctx, item.post)
			continue
		}
		list, saved := a.scanPostEntities(rctx, item.post, item.hash, generation)
		if saved {
			a.rememberEntities(rctx, item.post, item.hash, generation, epoch, list)
			continue
		}
		item.post.Metadata.Entities = a.presentPostEntities(rctx, item.post, list)
	}
}

func (a *App) rememberEntities(rctx request.CTX, post *model.Post, hash, generation string, epoch int64, list []*model.PostEntity) {
	postEntityMemo.put(entityMemoKey(post.Id, hash, generation, epoch), list)
	post.Metadata.Entities = a.presentPostEntities(rctx, post, list)
}

func (a *App) scanPostEntities(rctx request.CTX, post *model.Post, hash, generation string) ([]*model.PostEntity, bool) {
	key := post.Id + "\n" + hash + "\n" + generation
	v, _, _ := entityScan.Do(key, func() (any, error) {
		found, protected, incomplete := entities.DetectAccepted(post.Message, func(pluginID, typeID, value string) (bool, error) {
			return a.acceptEntityValue(rctx, pluginID, typeID, value, post.CreateAt)
		})
		applied := entities.ApplyTerms(post.Message, protected, found)
		if incomplete {
			return entityScanResult{list: applied}, nil
		}
		saved := &model.PostEntityRow{
			PostId:            post.Id,
			ChannelId:         post.ChannelId,
			MessageHash:       hash,
			PatternGeneration: generation,
			ProtectedRanges:   protected,
			Entities:          found,
			UpdateAt:          model.GetMillis(),
		}
		if err := a.Srv().Store().PostEntity().Save(saved); err != nil {
			rctx.Logger().Warn("Failed to save post entities", mlog.String("post_id", post.Id), mlog.Err(err))
			return entityScanResult{list: applied}, nil
		}
		return entityScanResult{list: applied, saved: true}, nil
	})
	result, _ := v.(entityScanResult)
	return result.list, result.saved
}

func (a *App) refreshEntitiesLater(rctx request.CTX, post *model.Post) {
	select {
	case entityRefreshSlot <- struct{}{}:
	default:
		return
	}
	fresh := post.Clone()
	logger := rctx.Logger()
	go func() {
		defer func() { <-entityRefreshSlot }()
		hash := entities.MessageHash(fresh.Message)
		a.scanPostEntities(request.EmptyContext(logger), fresh, hash, entities.PatternGeneration())
	}()
}

func (a *App) presentPostEntities(rctx request.CTX, post *model.Post, list []*model.PostEntity) []*model.PostEntity {
	scoped, bots := entities.ReadFlags(list)
	ctx := entities.ReadContext{}
	if scoped {
		channel, appErr := a.GetChannel(rctx, post.ChannelId)
		if appErr == nil && channel != nil {
			ctx.ChannelName = channel.Name
			ctx.DirectOrGroup = channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup
			if channel.TeamId != "" {
				if team, teamErr := a.GetTeam(channel.TeamId); teamErr == nil && team != nil {
					ctx.TeamName = team.Name
				}
			}
		}
	}
	if bots {
		user, appErr := a.GetUser(rctx, post.UserId)
		if appErr == nil && user != nil && user.IsBot {
			ctx.AuthorIsBot = true
		}
	}
	return entities.Present(list, ctx)
}

func (a *App) acceptEntityValue(rctx request.CTX, pluginID, typeID, value string, createAt int64) (bool, error) {
	if ok, hit := cachedAccept(pluginID, typeID, value, createAt); hit {
		return ok, nil
	}
	env := a.GetPluginsEnvironment()
	if env == nil {
		return false, nil
	}
	hooks, err := env.HooksForPlugin(pluginID)
	if err != nil || hooks == nil {
		return false, nil
	}
	ok, callErr := hooks.EntityValidate(&plugin.Context{}, &model.EntityValidateRequest{
		TypeID:   typeID,
		Value:    value,
		CreateAt: createAt,
	})
	if callErr != nil {
		return false, callErr
	}
	rememberAccept(pluginID, typeID, value, createAt, ok)
	return ok, nil
}

func entityValidateKey(pluginID, typeID, value string, createAt int64) string {
	return pluginID + "\x00" + typeID + "\x00" + value + "\x00" + strconv.FormatInt(createAt, 10)
}

func cachedAccept(pluginID, typeID, value string, createAt int64) (bool, bool) {
	key := entityValidateKey(pluginID, typeID, value, createAt)
	now := model.GetMillis()
	validateMu.Lock()
	defer validateMu.Unlock()
	hit, ok := validateCache[key]
	if !ok || hit.until < now {
		return false, false
	}
	return hit.ok, true
}

func rememberAccept(pluginID, typeID, value string, createAt int64, ok bool) {
	key := entityValidateKey(pluginID, typeID, value, createAt)
	validateMu.Lock()
	defer validateMu.Unlock()
	if len(validateCache) >= validateCacheCap {
		validateCache = map[string]validateHit{}
	}
	validateCache[key] = validateHit{ok: ok, until: model.GetMillis() + validateCacheTTL.Milliseconds()}
}

func clonePostEntities(list []*model.PostEntity) []*model.PostEntity {
	if len(list) == 0 {
		return nil
	}
	out := make([]*model.PostEntity, len(list))
	for i, entity := range list {
		if entity == nil {
			continue
		}
		cp := *entity
		out[i] = &cp
	}
	return out
}
