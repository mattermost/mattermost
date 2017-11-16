// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/store"
)

type Option func(a *App)

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

func ConfigFile(file string) Option {
	return func(a *App) {
		a.configFile = file
	}
}
