// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net/http"
)

type RegisteredProduct struct {
	ProductID string
	Adapter   Hooks
}

func (rp *RegisteredProduct) Implements(hookId int) bool {
	adapter, ok := rp.Adapter.(*HooksAdapter)
	if !ok {
		return false
	}

	_, ok = adapter.implemented[hookId]
	return ok
}

// Implemented method is overridden intentionally to prevent calling it from outside.
func (a *HooksAdapter) Implemented() ([]string, error) {
	return nil, nil
}

// OnActivate is overridden intentionally as product should not call it.
func (a *HooksAdapter) OnActivate() error {
	return nil
}

// OnDeactivate is overridden intentionally as product should not call it.
func (a *HooksAdapter) OnDeactivate() error {
	return nil
}

// ServeHTTP is overridden intentionally as product should not call it.
func (a *HooksAdapter) ServeHTTP(c *Context, w http.ResponseWriter, r *http.Request) {}
