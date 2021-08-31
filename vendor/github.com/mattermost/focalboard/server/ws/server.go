package ws

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/store"

	mmModel "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const singleUserID = "single-user-id"

type wsClient struct {
	*websocket.Conn
	mu         sync.Mutex
	workspaces []string
	blocks     []string
}

func (c *wsClient) WriteJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	err := c.Conn.WriteJSON(v)
	return err
}

func (c *wsClient) isSubscribedToWorkspace(workspaceID string) bool {
	for _, id := range c.workspaces {
		if id == workspaceID {
			return true
		}
	}

	return false
}

func (c *wsClient) isSubscribedToBlock(blockID string) bool {
	for _, id := range c.blocks {
		if id == blockID {
			return true
		}
	}

	return false
}

// Server is a WebSocket server.
type Server struct {
	upgrader             websocket.Upgrader
	listeners            map[*wsClient]bool
	listenersByWorkspace map[string][]*wsClient
	listenersByBlock     map[string][]*wsClient
	mu                   sync.RWMutex
	auth                 *auth.Auth
	singleUserToken      string
	isMattermostAuth     bool
	logger               *mlog.Logger
}

// UpdateMsg is sent on block updates.
type UpdateMsg struct {
	Action string      `json:"action"`
	Block  model.Block `json:"block"`
}

// WebsocketCommand is an incoming command from the client.
type WebsocketCommand struct {
	Action      string   `json:"action"`
	WorkspaceID string   `json:"workspaceId"`
	Token       string   `json:"token"`
	ReadToken   string   `json:"readToken"`
	BlockIDs    []string `json:"blockIds"`
}

type websocketSession struct {
	client *wsClient
	userID string
}

func (wss *websocketSession) isAuthenticated() bool {
	return wss.userID != ""
}

// NewServer creates a new Server.
func NewServer(auth *auth.Auth, singleUserToken string, isMattermostAuth bool, logger *mlog.Logger) *Server {
	return &Server{
		listeners:            make(map[*wsClient]bool),
		listenersByWorkspace: make(map[string][]*wsClient),
		listenersByBlock:     make(map[string][]*wsClient),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		auth:             auth,
		singleUserToken:  singleUserToken,
		isMattermostAuth: isMattermostAuth,
		logger:           logger,
	}
}

// RegisterRoutes registers routes.
func (ws *Server) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/ws", ws.handleWebSocket)
}

func (*Server) WebSocketMessageHasBeenPosted(webConnID, userID string, req *mmModel.WebSocketRequest) {
	// empty method to satisfy interface for now.
}

func (*Server) OnWebSocketDisconnect(webConnID, userID string) {}

func (*Server) OnWebSocketConnect(webConnID, userID string) {}

func (ws *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade initial GET request to a websocket
	client, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		ws.logger.Error("ERROR upgrading to websocket", mlog.Err(err))
		return
	}

	// create an empty session with websocket client
	wsSession := websocketSession{
		client: &wsClient{client, sync.Mutex{}, []string{}, []string{}},
		userID: "",
	}

	if ws.isMattermostAuth {
		wsSession.userID = r.Header.Get("Mattermost-User-Id")
	}

	ws.addListener(wsSession.client)

	// Make sure we close the connection when the function returns
	defer func() {
		ws.logger.Debug("DISCONNECT WebSocket", mlog.Stringer("client", wsSession.client.RemoteAddr()))

		// Remove client from listeners
		ws.removeListener(wsSession.client)
		wsSession.client.Close()
	}()

	// Simple message handling loop
	for {
		_, p, err := wsSession.client.ReadMessage()
		if err != nil {
			ws.logger.Error("ERROR WebSocket",
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
				mlog.Err(err),
			)
			ws.removeListener(wsSession.client)
			break
		}

		var command WebsocketCommand

		err = json.Unmarshal(p, &command)
		if err != nil {
			// handle this error
			ws.logger.Error(`ERROR webSocket parsing command`, mlog.String("json", string(p)))

			continue
		}

		if command.Action == websocketActionAuth {
			ws.logger.Debug(`Command: AUTH`, mlog.Stringer("client", wsSession.client.RemoteAddr()))
			ws.authenticateListener(&wsSession, command.Token)

			continue
		}

		// if the client wants to subscribe to a set of blocks and it
		// is sending a read token, we don't need to check for
		// authentication
		if command.Action == websocketActionSubscribeBlocks {
			ws.logger.Debug(`Command: SUBSCRIBE_BLOCKS`,
				mlog.String("workspaceID", command.WorkspaceID),
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
			)

			if !ws.isCommandReadTokenValid(command) {
				ws.logger.Error(`Rejected invalid read token`,
					mlog.Stringer("client", wsSession.client.RemoteAddr()),
					mlog.String("action", command.Action),
					mlog.String("readToken", command.ReadToken),
				)

				continue
			}

			ws.subscribeListenerToBlocks(wsSession.client, command.BlockIDs)
			continue
		}

		if command.Action == websocketActionUnsubscribeBlocks {
			ws.logger.Debug(`Command: UNSUBSCRIBE_BLOCKS`,
				mlog.String("workspaceID", command.WorkspaceID),
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
			)

			if !ws.isCommandReadTokenValid(command) {
				ws.logger.Error(`Rejected invalid read token`,
					mlog.Stringer("client", wsSession.client.RemoteAddr()),
					mlog.String("action", command.Action),
					mlog.String("readToken", command.ReadToken),
				)

				continue
			}

			ws.unsubscribeListenerFromBlocks(wsSession.client, command.BlockIDs)
			continue
		}

		// if the command is not authenticated at this point, it will
		// not be processed
		if !wsSession.isAuthenticated() {
			ws.logger.Error(`Rejected unauthenticated message`,
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
				mlog.String("action", command.Action),
			)

			continue
		}

		switch command.Action {
		case websocketActionSubscribeWorkspace:
			ws.logger.Debug(`Command: SUBSCRIBE_WORKSPACE`,
				mlog.String("workspaceID", command.WorkspaceID),
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
			)

			// if single user mode, check that the userID is valid and
			// assume that the user has permission if so
			if len(ws.singleUserToken) != 0 {
				if wsSession.userID != singleUserID {
					continue
				}

				// if not in single user mode validate that the session
				// has permissions to the workspace
			} else {
				if !ws.auth.DoesUserHaveWorkspaceAccess(wsSession.userID, command.WorkspaceID) {
					continue
				}
			}

			ws.subscribeListenerToWorkspace(wsSession.client, command.WorkspaceID)
		case websocketActionUnsubscribeWorkspace:
			ws.logger.Debug(`Command: UNSUBSCRIBE_WORKSPACE`,
				mlog.String("workspaceID", command.WorkspaceID),
				mlog.Stringer("client", wsSession.client.RemoteAddr()),
			)

			ws.unsubscribeListenerFromWorkspace(wsSession.client, command.WorkspaceID)
		default:
			ws.logger.Error(`ERROR webSocket command, invalid action`, mlog.String("action", command.Action))
		}
	}
}

// isCommandReadTokenValid ensures that a command contains a read
// token and a set of block ids that said token is valid for.
func (ws *Server) isCommandReadTokenValid(command WebsocketCommand) bool {
	if len(command.WorkspaceID) == 0 {
		return false
	}

	container := store.Container{WorkspaceID: command.WorkspaceID}

	if len(command.ReadToken) != 0 && len(command.BlockIDs) != 0 {
		// Read token must be valid for all block IDs
		for _, blockID := range command.BlockIDs {
			isValid, _ := ws.auth.IsValidReadToken(container, blockID, command.ReadToken)
			if !isValid {
				return false
			}
		}
		return true
	}

	return false
}

// addListener adds a listener to the websocket server. The listener
// should not receive any update from the server until it subscribes
// itself to some entity changes. Adding a listener to the server
// doesn't mean that it's authenticated in any way.
func (ws *Server) addListener(client *wsClient) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.listeners[client] = true
}

// removeListener removes a listener and all its subscriptions, if
// any, from the websockets server.
func (ws *Server) removeListener(client *wsClient) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	// remove the listener from its subscriptions, if any

	// workspace subscriptions
	for _, workspace := range client.workspaces {
		ws.removeListenerFromWorkspace(client, workspace)
	}

	// block subscriptions
	for _, block := range client.blocks {
		ws.removeListenerFromBlock(client, block)
	}

	delete(ws.listeners, client)
}

// subscribeListenerToWorkspace safely modifies the listener and the
// server to subscribe the listener to a given workspace updates.
func (ws *Server) subscribeListenerToWorkspace(client *wsClient, workspaceID string) {
	if client.isSubscribedToWorkspace(workspaceID) {
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.listenersByWorkspace[workspaceID] = append(ws.listenersByWorkspace[workspaceID], client)
	client.workspaces = append(client.workspaces, workspaceID)
}

// unsubscribeListenerFromWorkspace safely modifies the listener and
// the server data structures to remove the link between the listener
// and a given workspace ID.
func (ws *Server) unsubscribeListenerFromWorkspace(client *wsClient, workspaceID string) {
	if !client.isSubscribedToWorkspace(workspaceID) {
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.removeListenerFromWorkspace(client, workspaceID)
}

// subscribeListenerToBlocks safely modifies the listener and the
// server to subscribe the listener to a given set of block updates.
func (ws *Server) subscribeListenerToBlocks(client *wsClient, blockIDs []string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for _, blockID := range blockIDs {
		if client.isSubscribedToBlock(blockID) {
			continue
		}

		ws.listenersByBlock[blockID] = append(ws.listenersByBlock[blockID], client)
		client.blocks = append(client.blocks, blockID)
	}
}

// unsubscribeListenerFromBlocks safely modifies the listener and the
// server data structures to remove the link between the listener and
// a given set of block IDs.
func (ws *Server) unsubscribeListenerFromBlocks(client *wsClient, blockIDs []string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for _, blockID := range blockIDs {
		if client.isSubscribedToBlock(blockID) {
			ws.removeListenerFromBlock(client, blockID)
		}
	}
}

// removeListenerFromWorkspace removes the listener from both its own
// block subscribed list and the server listeners by workspace map.
func (ws *Server) removeListenerFromWorkspace(client *wsClient, workspaceID string) {
	// we remove the listener from the workspace index
	newWorkspaceListeners := []*wsClient{}
	for _, listener := range ws.listenersByWorkspace[workspaceID] {
		if listener != client {
			newWorkspaceListeners = append(newWorkspaceListeners, listener)
		}
	}
	ws.listenersByWorkspace[workspaceID] = newWorkspaceListeners

	// we remove the workspace from the listener subscription list
	newClientWorkspaces := []string{}
	for _, id := range client.workspaces {
		if id != workspaceID {
			newClientWorkspaces = append(newClientWorkspaces, id)
		}
	}
	client.workspaces = newClientWorkspaces
}

// removeListenerFromBlock removes the listener from both its own
// block subscribed list and the server listeners by block map.
func (ws *Server) removeListenerFromBlock(client *wsClient, blockID string) {
	// we remove the listener from the block index
	newBlockListeners := []*wsClient{}
	for _, listener := range ws.listenersByBlock[blockID] {
		if listener != client {
			newBlockListeners = append(newBlockListeners, listener)
		}
	}
	ws.listenersByBlock[blockID] = newBlockListeners

	// we remove the block from the listener subscription list
	newClientBlocks := []string{}
	for _, id := range client.blocks {
		if id != blockID {
			newClientBlocks = append(newClientBlocks, id)
		}
	}
	client.blocks = newClientBlocks
}

func (ws *Server) getUserIDForToken(token string) string {
	if len(ws.singleUserToken) > 0 {
		if token == ws.singleUserToken {
			return singleUserID
		} else {
			return ""
		}
	}

	session, err := ws.auth.GetSession(token)
	if session == nil || err != nil {
		return ""
	}

	return session.UserID
}

func (ws *Server) authenticateListener(wsSession *websocketSession, token string) {
	ws.logger.Debug("authenticateListener",
		mlog.String("token", token),
		mlog.String("wsSession.userID", wsSession.userID),
	)
	if wsSession.isAuthenticated() {
		// Do not allow multiple auth calls (for security)
		ws.logger.Debug(
			"authenticateListener: Ignoring already authenticated session",
			mlog.String("userID", wsSession.userID),
			mlog.Stringer("client", wsSession.client.RemoteAddr()),
		)
		return
	}

	// Authenticate session
	userID := ws.getUserIDForToken(token)
	if userID == "" {
		wsSession.client.Close()
		return
	}

	// Authenticated
	wsSession.userID = userID
	ws.logger.Debug("authenticateListener: Authenticated", mlog.String("userID", userID), mlog.Stringer("client", wsSession.client.RemoteAddr()))
}

// getListenersForBlock returns the listeners subscribed to a
// block changes.
func (ws *Server) getListenersForBlock(blockID string) []*wsClient {
	return ws.listenersByBlock[blockID]
}

// getListenersForWorkspace returns the listeners subscribed to a
// workspace changes.
func (ws *Server) getListenersForWorkspace(workspaceID string) []*wsClient {
	return ws.listenersByWorkspace[workspaceID]
}

// BroadcastBlockDelete broadcasts delete messages to clients.
func (ws *Server) BroadcastBlockDelete(workspaceID, blockID, parentID string) {
	now := time.Now().Unix()
	block := model.Block{}
	block.ID = blockID
	block.ParentID = parentID
	block.UpdateAt = now
	block.DeleteAt = now

	ws.BroadcastBlockChange(workspaceID, block)
}

// BroadcastBlockChange broadcasts update messages to clients.
func (ws *Server) BroadcastBlockChange(workspaceID string, block model.Block) {
	blockIDsToNotify := []string{block.ID, block.ParentID}

	message := UpdateMsg{
		Action: websocketActionUpdateBlock,
		Block:  block,
	}

	listeners := ws.getListenersForWorkspace(workspaceID)
	ws.logger.Debug("listener(s) for workspaceID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("workspaceID", workspaceID),
	)

	for _, blockID := range blockIDsToNotify {
		listeners = append(listeners, ws.getListenersForBlock(blockID)...)
		ws.logger.Debug("listener(s) for blockID",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("blockID", blockID),
		)
	}

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast change",
			mlog.String("workspaceID", workspaceID),
			mlog.String("blockID", block.ID),
			mlog.Stringer("remoteAddr", listener.RemoteAddr()),
		)

		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.Close()
		}
	}
}
