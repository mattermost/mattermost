// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type Option func(a *App)

// By default, the app will use a global configuration file. This allows you to override all or part
// of that configuration.
//
// The override parameter must be a *model.Config, func(*model.Config), or func(*model.Config) *model.Config.
//
// XXX: Most code will not respect this at the moment. (We need to eliminate utils.Cfg first.)
func ConfigOverride(override interface{}) Option {
	return func(a *App) {
		switch o := override.(type) {
		case *model.Config:
			a.configOverride = func(*model.Config) *model.Config {
				return o
			}
		case func(*model.Config):
			a.configOverride = func(cfg *model.Config) *model.Config {
				ret := *cfg
				o(&ret)
				return &ret
			}
		case func(*model.Config) *model.Config:
			a.configOverride = o
		default:
			panic("invalid ConfigOverride")
		}
	}
}

// By default, the app will use the store specified by the configuration. This allows you to
// construct an app with a different store.
//
// The override parameter must be either a store.Store or func(App) store.Store.
func StoreOverride(override interface{}) Option {
	return func(a *App) {
		switch o := override.(type) {
		case store.Store:
			a.newStore = func() store.Store {
				return o
			}
		case func(*App) store.Store:
			a.newStore = func() store.Store {
				return o(a)
			}
		default:
			panic("invalid StoreOverride")
		}
	}
}
