// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"errors"
	"fmt"
	"runtime"
	"sync"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/cache"
	"github.com/mattermost/mattermost-server/v5/store"
)

type UserService struct {
	store        store.UserStore
	sessionStore store.SessionStore
	oAuthStore   store.OAuthStore
	sessionCache cache.Cache
	sessionPool  sync.Pool
	metrics      einterfaces.MetricsInterface
	cluster      einterfaces.ClusterInterface
	config       func() *model.Config
}

// ServiceConfig is used to initialize the UserService.
type ServiceConfig struct {
	// Mandatory fields
	UserStore    store.UserStore
	SessionStore store.SessionStore
	OAuthStore   store.OAuthStore
	ConfigFn     func() *model.Config
	// Optional fields
	Metrics einterfaces.MetricsInterface
	Cluster einterfaces.ClusterInterface
}

func New(initializer ServiceConfig) (*UserService, error) {
	cacheProvider := cache.NewProvider()
	if err := cacheProvider.Connect(); err != nil {
		return nil, fmt.Errorf("could not create cache provider: %w", err)
	}

	sessionCache, err := cacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.SESSION_CACHE_SIZE,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	})
	if err != nil {
		return nil, fmt.Errorf("could not create session cache: %w", err)
	}

	if in := initializer; in.ConfigFn == nil || in.UserStore == nil || in.SessionStore == nil || in.OAuthStore == nil {
		return nil, errors.New("required parameters are not provided")
	}

	return &UserService{
		store:        initializer.UserStore,
		sessionStore: initializer.SessionStore,
		oAuthStore:   initializer.OAuthStore,
		config:       initializer.ConfigFn,
		metrics:      initializer.Metrics,
		cluster:      initializer.Cluster,
		sessionCache: sessionCache,
		sessionPool: sync.Pool{
			New: func() interface{} {
				return &model.Session{}
			},
		},
	}, nil
}
