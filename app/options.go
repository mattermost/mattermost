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
// The storeOrFactory parameter must be either a store.Store or func(App) store.Store.
func StoreOverride(storeOrFactory interface{}) Option {
	return func(a *App) {
		switch s := storeOrFactory.(type) {
		case store.Store:
			a.newStore = func() store.Store {
				return s
			}
		case func(*App) store.Store:
			a.newStore = func() store.Store {
				return s(a)
			}
		default:
			panic("invalid StoreOverride")
		}
	}
}
