// cursorplugin is a minimal server plugin used by sharedchannel-test. It exposes
// one admin-only endpoint that moves a shared channel remote's sync cursor with
// UpdateSharedChannelCursor and then asks for a sync.
package main

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
}

type setCursorRequest struct {
	ChannelID string `json:"channel_id"`
	RemoteID  string `json:"remote_id"`
	UpdateAt  int64  `json:"update_at"`
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" || !p.API.HasPermissionTo(userID, model.PermissionManageSystem) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if r.URL.Path != "/cursor" || r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	var req setCursorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	cursor := model.GetPostsSinceForSyncCursor{LastPostUpdateAt: req.UpdateAt}
	if err := p.API.UpdateSharedChannelCursor(req.ChannelID, req.RemoteID, cursor); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := p.API.SyncSharedChannel(req.ChannelID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func main() {
	plugin.ClientMain(&Plugin{})
}
