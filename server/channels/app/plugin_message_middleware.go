// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type pluginMessageMiddleware struct {
	pluginID   string
	middleware plugin.MessageMiddleware
}

type messageMiddlewareManager struct {
	middlewares []pluginMessageMiddleware
	mu          sync.RWMutex
}

var middlewareManager = &messageMiddlewareManager{
	middlewares: make([]pluginMessageMiddleware, 0),
}

// RegisterPluginMessageMiddleware registers message middleware for a plugin (mattermost-extended).
func (a *App) RegisterPluginMessageMiddleware(pluginID string, middleware plugin.MessageMiddleware) error {
	middlewareManager.mu.Lock()
	defer middlewareManager.mu.Unlock()

	middlewareManager.middlewares = append(middlewareManager.middlewares, pluginMessageMiddleware{
		pluginID:   pluginID,
		middleware: middleware,
	})

	return nil
}

// UnregisterPluginMessageMiddleware removes all middlewares for a plugin (mattermost-extended).
func (a *App) UnregisterPluginMessageMiddleware(pluginID string) {
	middlewareManager.mu.Lock()
	defer middlewareManager.mu.Unlock()

	filtered := make([]pluginMessageMiddleware, 0)
	for _, m := range middlewareManager.middlewares {
		if m.pluginID != pluginID {
			filtered = append(filtered, m)
		}
	}
	middlewareManager.middlewares = filtered
}

// ExecuteMessagePreSendMiddlewares runs all PreSend middlewares on a post (mattermost-extended).
// Returns the modified post, or nil if the message should be blocked.
func (a *App) ExecuteMessagePreSendMiddlewares(post *model.Post, session *model.Session) (*model.Post, error) {
	middlewareManager.mu.RLock()
	defer middlewareManager.mu.RUnlock()

	currentPost := post
	for _, m := range middlewareManager.middlewares {
		modifiedPost, err := m.middleware.PreSend(currentPost, session)
		if err != nil {
			return nil, err
		}
		if modifiedPost == nil {
			// Middleware blocked the message
			return nil, nil
		}
		currentPost = modifiedPost
	}

	return currentPost, nil
}

// ExecuteMessagePostReceiveMiddlewares runs all PostReceive middlewares on a post (mattermost-extended).
func (a *App) ExecuteMessagePostReceiveMiddlewares(post *model.Post, session *model.Session) (*model.Post, error) {
	middlewareManager.mu.RLock()
	defer middlewareManager.mu.RUnlock()

	currentPost := post
	for _, m := range middlewareManager.middlewares {
		modifiedPost, err := m.middleware.PostReceive(currentPost, session)
		if err != nil {
			return nil, err
		}
		currentPost = modifiedPost
	}

	return currentPost, nil
}
