// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net/http"
)

type registeredProduct struct {
	productID string
	adapter   Hooks
}

func (rp *registeredProduct) Implements(hookId int) bool {
	adapter, ok := rp.adapter.(*hooksAdapter)
	if !ok {
		return false
	}

	_, ok = adapter.implemented[hookId]
	return ok
}

// Implemented method is overridden intentionally to prevent calling it from outside.
func (a *hooksAdapter) Implemented() ([]string, error) {
	return nil, nil
}

// OnActivate is overridden intentionally as product should not call it.
func (a *hooksAdapter) OnActivate() error {
	return nil
}

// OnDeactivate is overridden intentionally as product should not call it.
func (a *hooksAdapter) OnDeactivate() error {
	return nil
}

// ServeHTTP is overridden intentionally as product should not call it.
func (a *hooksAdapter) ServeHTTP(c *Context, w http.ResponseWriter, r *http.Request) {}
