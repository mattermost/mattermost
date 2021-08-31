package ws

import (
	"github.com/mattermost/focalboard/server/model"
	mmModel "github.com/mattermost/mattermost-server/v6/model"
)

const (
	websocketActionAuth                 = "AUTH"
	websocketActionSubscribeWorkspace   = "SUBSCRIBE_WORKSPACE"
	websocketActionUnsubscribeWorkspace = "UNSUBSCRIBE_WORKSPACE"
	websocketActionSubscribeBlocks      = "SUBSCRIBE_BLOCKS"
	websocketActionUnsubscribeBlocks    = "UNSUBSCRIBE_BLOCKS"
	websocketActionUpdateBlock          = "UPDATE_BLOCK"
)

type Adapter interface {
	BroadcastBlockChange(workspaceID string, block model.Block)
	BroadcastBlockDelete(workspaceID, blockID, parentID string)
	WebSocketMessageHasBeenPosted(webConnID, userID string, req *mmModel.WebSocketRequest)
	OnWebSocketDisconnect(webConnID, userID string)
	OnWebSocketConnect(webConnID, userID string)
}
