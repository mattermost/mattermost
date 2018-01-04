// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

type ClientRoot struct {
	allowSameOriginFrame bool
	watcher              *HTMLTemplateWatcher
}

type ClientRootData struct {
	Nonce string
}

func (r *ClientRoot) Serve(w http.ResponseWriter, _ *http.Request) {
	if r.allowSameOriginFrame {
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Add("Content-Security-Policy", "frame-ancestors 'self'")
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	r.watcher.Templates().Execute(w, &ClientRootData{
		Nonce: model.NewId(),
	})
}

func (r *ClientRoot) Close() {
	r.watcher.Close()
}

func NewClientRoot(templatePath string, allowSameOriginFrame bool) (*ClientRoot, error) {
	watcher, err := NewHTMLTemplateWatcherFile(templatePath)
	if err != nil {
		return nil, err
	}
	return &ClientRoot{
		allowSameOriginFrame: allowSameOriginFrame,
		watcher:              watcher,
	}, nil
}
