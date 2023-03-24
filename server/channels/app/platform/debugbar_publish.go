//go:build debug_bar

package platform

import "github.com/mattermost/mattermost-server/v6/model"

func (ps *PlatformService) PublishToDebugBar(event *model.WebSocketEvent) {
	if ps.DebugBar.IsEnabled() {
		ps.Publish(event)
	}
}
