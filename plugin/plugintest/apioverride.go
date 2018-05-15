// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugintest

import "github.com/mattermost/mattermost-server/plugin"

type API struct {
	APIMOCKINTERNAL
	Store *KeyValueStore
}

var _ plugin.API = (*API)(nil)
var _ plugin.KeyValueStore = (*KeyValueStore)(nil)

func (m *API) KeyValueStore() plugin.KeyValueStore {
	return m.Store
}
