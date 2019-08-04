// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"fmt"
	"sync"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

// emitter enables threadsafe registration and broadcasting to configuration listeners
type emitter struct {
	listeners sync.Map
}

// AddListener adds a callback function to invoke when the configuration is modified.
func (e *emitter) AddListener(listener Listener) string {
	id := model.NewId()

	e.listeners.Store(id, listener)

	return id
}

// RemoveListener removes a callback function using an id returned from AddListener.
func (e *emitter) RemoveListener(id string) {
	e.listeners.Delete(id)
}

// invokeConfigListeners synchronously notifies all listeners about the configuration change.
func (e *emitter) invokeConfigListeners(oldCfg, newCfg *model.Config) {
	mlog.Error("<><><><><> emitter.invokeConfigListeners: start")
	e.listeners.Range(func(key, value interface{}) bool {
		listener := value.(Listener)
		mlog.Error(fmt.Sprintf("<><><><><> emitter.invokeConfigListeners: invoking a listener for key: %+v", key))
		listener(oldCfg, newCfg)
		return true
	})
}
