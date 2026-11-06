// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	entityCacheWriteCap        = 256
	entityProviderBudget       = 2 * time.Second
	entityPatternTTL           = 24 * time.Hour
	entityPageScanParallel     = 4
	entityPatternCacheSize     = 8192
	entityPatternCacheReadWait = 200 * time.Millisecond
	entityProviderLookupCap    = 4
)

func (a *App) AppendEntityEtag(etag string) string {
	if !a.entitiesEnabled() {
		return etag
	}
	return etag + "." + entities.PatternGeneration() + "." + entities.TermEpoch() + "." + entities.ProviderGeneration()
}

func (a *App) entitiesEnabled() bool {
	if a == nil || a.ch == nil || a.ch.cfgSvc == nil {
		return false
	}
	cfg := a.Config()
	if cfg == nil || cfg.FeatureFlags == nil || !cfg.FeatureFlags.Entities {
		return false
	}
	// Unit/bench helpers may wire FeatureFlags without a full platform.
	if a.ch.srv == nil || a.ch.srv.platform == nil {
		return true
	}
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
	return !strings.HasPrefix(post.Type, "custom_")
}

type entityPageKey struct{}

var (
	entityScan      singleflight.Group
	entityScanCount atomic.Int64

	patternWritesOnce sync.Once
	patternWrites     = make(chan patternWrite, entityCacheWriteCap)
	patternWriteCount atomic.Int64

	providerLookupSlot sync.Map
)

type patternWrite struct {
	store  cache.Cache
	key    string
	value  model.EntityPatternCache
	logger mlog.LoggerIFace
}

type patternScan struct {
	patterns  []*model.PostEntity
	protected [][2]int
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
}

func (a *App) hydratePostEntities(rctx request.CTX, post *model.Post) {
	a.hydratePostList(rctx, []*model.Post{post})
}

func (a *App) hydratePostList(rctx request.CTX, posts []*model.Post) {
	if !a.entitiesEnabled() || len(posts) == 0 {
		return
	}
	generation := entities.PatternGeneration()
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
		wg.Add(1)
		sem <- struct{}{}
		go func(miss *entityMiss) {
			defer wg.Done()
			defer func() { <-sem }()
			miss.list = a.scanAndRemember(rctx, miss.post, miss.hash, generation)
		}(miss)
	}
	wg.Wait()
	for _, miss := range scans {
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

func (a *App) scanAndRemember(rctx request.CTX, post *model.Post, hash, generation string) []*model.PostEntity {
	found, protected := a.scanPostPatterns(post, hash, generation)
	merged := entities.ApplyTerms(post.Message, protected, found)
	a.enqueuePatternWrite(rctx, patternCacheKey(post.Id, hash), model.EntityPatternCache{
		Generation: generation,
		Protected:  append([][2]int(nil), protected...),
		Patterns:   clonePostEntities(found),
	})
	return merged
}

func (a *App) scanPostPatterns(post *model.Post, hash, generation string) ([]*model.PostEntity, [][2]int) {
	key := post.Id + "\n" + hash + "\n" + generation
	v, _, _ := entityScan.Do(key, func() (any, error) {
		entityScanCount.Add(1)
		found, protected := entities.Detect(post.Message)
		return patternScan{patterns: found, protected: protected}, nil
	})
	scanned, _ := v.(patternScan)
	return scanned.patterns, scanned.protected
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
