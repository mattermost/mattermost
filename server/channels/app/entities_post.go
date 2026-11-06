// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	entityCacheWriteCap        = 256
	validateCacheCap           = 4096
	validateCacheTTL           = 30 * time.Second
	entityProviderBudget       = 2 * time.Second
	entityPluginDownTTL        = 10 * time.Second
	entityPatternTTL           = 24 * time.Hour
	entityPageValidateCap      = 100
	entityPageScanParallel     = 4
	entityPatternCacheSize     = 8192
	entityPatternCacheReadWait = 200 * time.Millisecond
	entityValidateInflightCap  = 4
	entityProviderLookupCap    = 4
)

func (a *App) AppendEntityEtag(etag string) string {
	if !a.entitiesEnabled() {
		return etag
	}
	return etag + "." + entities.PatternGeneration() + "." + entities.TermEpoch() + "." + entities.ProviderGeneration()
}

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
	return !strings.HasPrefix(post.Type, "custom_")
}

type entityPageKey struct{}
type entityServeKey struct{}
type entityAcceptAllKey struct{}

// EntityServeState records whether a response must not be cached under the current entity etag.
type EntityServeState struct {
	mu    sync.Mutex
	stale bool
}

// Stale reports that the response must not be cached under the current entity etag.
func (s *EntityServeState) Stale() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stale
}

func (s *EntityServeState) mark() {
	if s == nil {
		return
	}
	s.mu.Lock()
	s.stale = true
	s.mu.Unlock()
}

// BeginEntityServe attaches the flag a handler checks before it writes an ETag.
func (a *App) BeginEntityServe(rctx request.CTX) (request.CTX, *EntityServeState) {
	state := &EntityServeState{}
	return rctx.WithContext(context.WithValue(rctx.Context(), entityServeKey{}, state)), state
}

func entityServeFrom(rctx request.CTX) *EntityServeState {
	state, _ := rctx.Context().Value(entityServeKey{}).(*EntityServeState)
	return state
}

func withEntityAcceptAll(rctx request.CTX) request.CTX {
	return rctx.WithContext(context.WithValue(rctx.Context(), entityAcceptAllKey{}, true))
}

func entityAcceptAll(rctx request.CTX) bool {
	all, _ := rctx.Context().Value(entityAcceptAllKey{}).(bool)
	return all
}

var (
	entityScan      singleflight.Group
	entityScanCount atomic.Int64

	patternWritesOnce sync.Once
	patternWrites     = make(chan patternWrite, entityCacheWriteCap)
	patternWriteCount atomic.Int64

	validateMu    sync.Mutex
	validateCache = map[string]validateHit{}

	pluginDownMu sync.Mutex
	pluginDown   = map[string]int64{}

	validateInflight   sync.Map
	providerLookupSlot sync.Map
)

type validateHit struct {
	ok    bool
	until int64
}

type patternWrite struct {
	store  cache.Cache
	key    string
	value  model.EntityPatternCache
	logger mlog.LoggerIFace
}

type patternScan struct {
	patterns   []*model.PostEntity
	protected  [][2]int
	incomplete bool
}

type patternHit struct {
	generation string
	protected  [][2]int
	patterns   []*model.PostEntity
}

type entityMiss struct {
	post *model.Post
	hash string
	list []*model.PostEntity
	ran  bool
}

func (a *App) hydratePostEntities(rctx request.CTX, post *model.Post) {
	a.hydratePostList(rctx, []*model.Post{post})
}

func (a *App) hydratePostList(rctx request.CTX, posts []*model.Post) {
	if !a.entitiesEnabled() || len(posts) == 0 {
		return
	}
	generation := entities.PatternGeneration()
	serve := entityServeFrom(rctx)
	budgetDeadline := time.Now().Add(entityProviderBudget)
	var validateCalls atomic.Int32
	var misses []*entityMiss

	for _, post := range posts {
		if !shouldDetectEntities(post) {
			continue
		}
		if post.Metadata == nil {
			post.Metadata = &model.PostMetadata{}
		}
		misses = append(misses, &entityMiss{post: post, hash: entities.MessageHash(post.Message)})
	}
	if len(misses) == 0 {
		return
	}

	cached := a.readPatternCache(misses)
	var scans []*entityMiss
	for i, miss := range misses {
		hit := cached[i]
		if hit != nil && hit.generation == generation {
			merged := entities.ApplyTerms(miss.post.Message, hit.protected, hit.patterns)
			miss.post.Metadata.Entities = a.presentPostEntities(rctx, miss.post, merged)
			continue
		}
		scans = append(scans, miss)
	}
	if len(scans) == 0 {
		return
	}

	sem := make(chan struct{}, entityPageScanParallel)
	var wg sync.WaitGroup
	for _, miss := range scans {
		if time.Now().After(budgetDeadline) || validateCalls.Load() >= entityPageValidateCap {
			serve.mark()
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(miss *entityMiss) {
			defer wg.Done()
			defer func() { <-sem }()
			miss.ran = true
			miss.list = a.scanAndRemember(rctx, miss.post, miss.hash, generation, budgetDeadline, &validateCalls, serve)
		}(miss)
	}
	wg.Wait()
	for _, miss := range scans {
		if !miss.ran {
			miss.post.Metadata.Entities = nil
			continue
		}
		miss.post.Metadata.Entities = a.presentPostEntities(rctx, miss.post, miss.list)
	}
}

func (a *App) readPatternCache(misses []*entityMiss) []*patternHit {
	store := a.entityPatternCache()
	out := make([]*patternHit, len(misses))
	if store == nil || len(misses) == 0 {
		return out
	}
	keys := make([]string, len(misses))
	values := make([]model.EntityPatternCache, len(misses))
	ptrs := make([]any, len(misses))
	for i, miss := range misses {
		keys[i] = patternCacheKey(miss.post.Id, miss.hash)
		ptrs[i] = &values[i]
	}
	type multiResult struct {
		errs []error
	}
	done := make(chan multiResult, 1)
	go func() {
		done <- multiResult{errs: store.GetMulti(keys, ptrs)}
	}()
	var errs []error
	select {
	case <-time.After(entityPatternCacheReadWait):
		return out
	case result := <-done:
		errs = result.errs
	}
	for i, err := range errs {
		if err != nil || values[i].Generation == "" && len(values[i].Patterns) == 0 && len(values[i].Protected) == 0 {
			continue
		}
		out[i] = &patternHit{
			generation: values[i].Generation,
			protected:  append([][2]int(nil), values[i].Protected...),
			patterns:   clonePostEntities(values[i].Patterns),
		}
	}
	return out
}

func patternCacheKey(postID, hash string) string {
	return postID + ":" + hash
}

func (a *App) scanAndRemember(rctx request.CTX, post *model.Post, hash, generation string, deadline time.Time, calls *atomic.Int32, serve *EntityServeState) []*model.PostEntity {
	found, protected, incomplete := a.scanPostPatterns(rctx, post, hash, generation, deadline, calls)
	merged := entities.ApplyTerms(post.Message, protected, found)
	if incomplete {
		serve.mark()
		return merged
	}
	if !entityAcceptAll(rctx) {
		a.enqueuePatternWrite(rctx, patternCacheKey(post.Id, hash), model.EntityPatternCache{
			Generation: generation,
			Protected:  append([][2]int(nil), protected...),
			Patterns:   clonePostEntities(found),
		})
	}
	return merged
}

func (a *App) scanPostPatterns(rctx request.CTX, post *model.Post, hash, generation string, deadline time.Time, calls *atomic.Int32) ([]*model.PostEntity, [][2]int, bool) {
	acceptAll := entityAcceptAll(rctx)
	key := post.Id + "\n" + hash + "\n" + generation
	if acceptAll {
		key += "\naccept"
	}
	v, _, _ := entityScan.Do(key, func() (any, error) {
		entityScanCount.Add(1)
		found, protected, incomplete := entities.DetectAccepted(post.Message, func(pluginID, typeID, value string) (bool, error) {
			if acceptAll {
				return true, nil
			}
			if calls != nil && calls.Load() >= entityPageValidateCap {
				return false, fmt.Errorf("entity validation budget is exhausted")
			}
			if time.Now().After(deadline) {
				return false, fmt.Errorf("entity validation timed out")
			}
			return a.acceptEntityValue(rctx, pluginID, typeID, value, post.CreateAt, deadline, calls)
		})
		return patternScan{patterns: found, protected: protected, incomplete: incomplete}, nil
	})
	scanned, _ := v.(patternScan)
	return scanned.patterns, scanned.protected, scanned.incomplete
}

func (a *App) entityPatternCache() cache.Cache {
	if a == nil || a.ch == nil || a.ch.srv == nil {
		return nil
	}
	return a.ch.srv.entityPatternCache
}

func (a *App) enqueuePatternWrite(rctx request.CTX, key string, value model.EntityPatternCache) {
	store := a.entityPatternCache()
	if store == nil {
		return
	}
	var logger mlog.LoggerIFace
	if rctx != nil {
		logger = rctx.Logger()
	}
	patternWritesOnce.Do(func() {
		go func() {
			for job := range patternWrites {
				if err := job.store.SetWithExpiry(job.key, job.value, entityPatternTTL); err != nil {
					if job.logger != nil {
						job.logger.Debug("Failed to store entity pattern", mlog.Err(err))
					} else {
						mlog.Debug("Failed to store entity pattern", mlog.Err(err))
					}
				}
				patternWriteCount.Add(1)
			}
		}()
	})
	select {
	case patternWrites <- patternWrite{store: store, key: key, value: value, logger: logger}:
	default:
	}
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

func (a *App) acceptEntityValue(rctx request.CTX, pluginID, typeID, value string, createAt int64, deadline time.Time, calls *atomic.Int32) (bool, error) {
	if calls != nil {
		if calls.Add(1) > entityPageValidateCap {
			return false, fmt.Errorf("entity validation budget is exhausted")
		}
	}
	generation := entities.PatternGeneration()
	if ok, hit := cachedAccept(pluginID, typeID, value, createAt, generation); hit {
		return ok, nil
	}
	if pluginUnavailable(pluginID) {
		return false, fmt.Errorf("plugin is unavailable")
	}
	env := a.GetPluginsEnvironment()
	if env == nil {
		markPluginDown(pluginID)
		return false, fmt.Errorf("plugin environment is unavailable")
	}
	hooks, err := env.HooksForPluginWithRPCErr(pluginID)
	if err != nil || hooks == nil {
		markPluginDown(pluginID)
		return false, fmt.Errorf("plugin is unavailable")
	}
	slot, _ := validateInflight.LoadOrStore(pluginID, make(chan struct{}, entityValidateInflightCap))
	slots := slot.(chan struct{})
	select {
	case slots <- struct{}{}:
	default:
		return false, fmt.Errorf("entity validation is busy")
	}
	type validateResult struct {
		ok      bool
		callErr error
		rpcErr  error
	}
	done := make(chan validateResult, 1)
	go func() {
		defer func() { <-slots }()
		ok, callErr, rpcErr := hooks.EntityValidateWithRPCErr(&plugin.Context{}, &model.EntityValidateRequest{
			TypeID:   typeID,
			Value:    value,
			CreateAt: createAt,
		})
		done <- validateResult{ok: ok, callErr: callErr, rpcErr: rpcErr}
	}()
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	select {
	case <-rctx.Context().Done():
		return false, rctx.Context().Err()
	case <-timer.C:
		return false, fmt.Errorf("entity validation timed out")
	case result := <-done:
		if result.rpcErr != nil {
			markPluginDown(pluginID)
			return false, result.rpcErr
		}
		if result.callErr != nil {
			return false, result.callErr
		}
		rememberAccept(pluginID, typeID, value, createAt, generation, result.ok)
		return result.ok, nil
	}
}

func pluginUnavailable(pluginID string) bool {
	pluginDownMu.Lock()
	defer pluginDownMu.Unlock()
	return pluginDown[pluginID] > model.GetMillis()
}

func markPluginDown(pluginID string) {
	pluginDownMu.Lock()
	defer pluginDownMu.Unlock()
	pluginDown[pluginID] = model.GetMillis() + entityPluginDownTTL.Milliseconds()
}

func entityValidateKey(pluginID, typeID, value string, createAt int64, generation string) string {
	return pluginID + "\x00" + typeID + "\x00" + value + "\x00" + fmt.Sprint(createAt) + "\x00" + generation
}

func cachedAccept(pluginID, typeID, value string, createAt int64, generation string) (bool, bool) {
	key := entityValidateKey(pluginID, typeID, value, createAt, generation)
	now := model.GetMillis()
	validateMu.Lock()
	defer validateMu.Unlock()
	hit, ok := validateCache[key]
	if !ok || hit.until < now {
		return false, false
	}
	return hit.ok, true
}

func rememberAccept(pluginID, typeID, value string, createAt int64, generation string, ok bool) {
	key := entityValidateKey(pluginID, typeID, value, createAt, generation)
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
		if entity.TypeIDs != nil {
			cp.TypeIDs = append([]string(nil), entity.TypeIDs...)
		}
		out[i] = &cp
	}
	return out
}
