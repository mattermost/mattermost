package ws

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/mattermost/mattermost-server/v6/boards/auth"
	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (wss *websocketSession) WriteJSON(v interface{}) error {
	wss.mu.Lock()
	defer wss.mu.Unlock()
	err := wss.conn.WriteJSON(v)
	return err
}

func (wss *websocketSession) isSubscribedToTeam(teamID string) bool {
	for _, id := range wss.teams {
		if id == teamID {
			return true
		}
	}

	return false
}

func (wss *websocketSession) isSubscribedToBlock(blockID string) bool {
	for _, id := range wss.blocks {
		if id == blockID {
			return true
		}
	}

	return false
}

// Server is a WebSocket server.
type Server struct {
	upgrader         websocket.Upgrader
	listeners        map[*websocketSession]bool
	listenersByTeam  map[string][]*websocketSession
	listenersByBlock map[string][]*websocketSession
	mu               sync.RWMutex
	auth             *auth.Auth
	singleUserToken  string
	isMattermostAuth bool
	logger           mlog.LoggerIFace
	store            Store
}

type websocketSession struct {
	conn   *websocket.Conn
	userID string
	mu     sync.Mutex
	teams  []string
	blocks []string
}

func (wss *websocketSession) isAuthenticated() bool {
	return wss.userID != ""
}

// NewServer creates a new Server.
func NewServer(auth *auth.Auth, singleUserToken string, isMattermostAuth bool, logger mlog.LoggerIFace, store Store) *Server {
	return &Server{
		listeners:        make(map[*websocketSession]bool),
		listenersByTeam:  make(map[string][]*websocketSession),
		listenersByBlock: make(map[string][]*websocketSession),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		auth:             auth,
		singleUserToken:  singleUserToken,
		isMattermostAuth: isMattermostAuth,
		logger:           logger,
		store:            store,
	}
}

// RegisterRoutes registers routes.
func (ws *Server) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/ws", ws.handleWebSocket)
}

func (ws *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade initial GET request to a websocket
	client, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		ws.logger.Error("ERROR upgrading to websocket", mlog.Err(err))
		return
	}

	// create an empty session with websocket client
	wsSession := &websocketSession{
		conn:   client,
		userID: "",
		mu:     sync.Mutex{},
		teams:  []string{},
		blocks: []string{},
	}

	if ws.isMattermostAuth {
		wsSession.userID = r.Header.Get("Mattermost-User-Id")
	}

	ws.addListener(wsSession)

	// Make sure we close the connection when the function returns
	defer func() {
		ws.logger.Debug("DISCONNECT WebSocket", mlog.Stringer("client", wsSession.conn.RemoteAddr()))

		// Remove session from listeners
		ws.removeListener(wsSession)
		wsSession.conn.Close()
	}()

	// Simple message handling loop
	for {
		_, p, err := wsSession.conn.ReadMessage()
		if err != nil {
			ws.logger.Error("ERROR WebSocket",
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
				mlog.Err(err),
			)
			ws.removeListener(wsSession)
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
			ws.logger.Debug(`Command: AUTH`, mlog.Stringer("client", wsSession.conn.RemoteAddr()))
			ws.authenticateListener(wsSession, command.Token)

			continue
		}

		// if the client wants to subscribe to a set of blocks and it
		// is sending a read token, we don't need to check for
		// authentication
		if command.Action == websocketActionSubscribeBlocks {
			ws.logger.Debug(`Command: SUBSCRIBE_BLOCKS`,
				mlog.String("teamID", command.TeamID),
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
			)

			if !ws.isCommandReadTokenValid(command) {
				ws.logger.Error(`Rejected invalid read token`,
					mlog.Stringer("client", wsSession.conn.RemoteAddr()),
					mlog.String("action", command.Action),
					mlog.String("readToken", command.ReadToken),
				)

				continue
			}

			ws.subscribeListenerToBlocks(wsSession, command.BlockIDs)
			continue
		}

		if command.Action == websocketActionUnsubscribeBlocks {
			ws.logger.Debug(`Command: UNSUBSCRIBE_BLOCKS`,
				mlog.String("teamID", command.TeamID),
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
			)

			if !ws.isCommandReadTokenValid(command) {
				ws.logger.Error(`Rejected invalid read token`,
					mlog.Stringer("client", wsSession.conn.RemoteAddr()),
					mlog.String("action", command.Action),
					mlog.String("readToken", command.ReadToken),
				)

				continue
			}

			ws.unsubscribeListenerFromBlocks(wsSession, command.BlockIDs)
			continue
		}

		// if the command is not authenticated at this point, it will
		// not be processed
		if !wsSession.isAuthenticated() {
			ws.logger.Error(`Rejected unauthenticated message`,
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
				mlog.String("action", command.Action),
			)

			continue
		}

		switch command.Action {
		case websocketActionSubscribeTeam:
			ws.logger.Debug(`Command: SUBSCRIBE_TEAM`,
				mlog.String("teamID", command.TeamID),
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
			)

			// if single user mode, check that the userID is valid and
			// assume that the user has permission if so
			if len(ws.singleUserToken) != 0 {
				if wsSession.userID != model.SingleUser {
					continue
				}

				// if not in single user mode validate that the session
				// has permissions to the team
			} else {
				ws.logger.Debug("Not single user mode")
				if !ws.auth.DoesUserHaveTeamAccess(wsSession.userID, command.TeamID) {
					ws.logger.Error("WS user doesn't have team access", mlog.String("teamID", command.TeamID), mlog.String("userID", wsSession.userID))
					continue
				}
			}

			ws.subscribeListenerToTeam(wsSession, command.TeamID)
		case websocketActionUnsubscribeTeam:
			ws.logger.Debug(`Command: UNSUBSCRIBE_TEAM`,
				mlog.String("teamID", command.TeamID),
				mlog.Stringer("client", wsSession.conn.RemoteAddr()),
			)

			ws.unsubscribeListenerFromTeam(wsSession, command.TeamID)
		default:
			ws.logger.Error(`ERROR webSocket command, invalid action`, mlog.String("action", command.Action))
		}
	}
}

// isCommandReadTokenValid ensures that a command contains a read
// token and a set of block ids that said token is valid for.
func (ws *Server) isCommandReadTokenValid(command WebsocketCommand) bool {
	if len(command.TeamID) == 0 {
		return false
	}

	boardID := ""
	// all the blocks must be part of the same board
	for _, blockID := range command.BlockIDs {
		block, err := ws.store.GetBlock(blockID)
		if err != nil {
			return false
		}

		if boardID == "" {
			boardID = block.BoardID
			continue
		}

		if boardID != block.BoardID {
			return false
		}
	}

	// the read token must be valid for the board
	isValid, err := ws.auth.IsValidReadToken(boardID, command.ReadToken)
	if err != nil {
		ws.logger.Error(`ERROR when checking token validity`,
			mlog.String("teamID", command.TeamID),
			mlog.Err(err),
		)
		return false
	}

	return isValid
}

// addListener adds a listener to the websocket server. The listener
// should not receive any update from the server until it subscribes
// itself to some entity changes. Adding a listener to the server
// doesn't mean that it's authenticated in any way.
func (ws *Server) addListener(listener *websocketSession) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.listeners[listener] = true
}

// removeListener removes a listener and all its subscriptions, if
// any, from the websockets server.
func (ws *Server) removeListener(listener *websocketSession) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	// remove the listener from its subscriptions, if any

	// team subscriptions
	for _, team := range listener.teams {
		ws.removeListenerFromTeam(listener, team)
	}

	// block subscriptions
	for _, block := range listener.blocks {
		ws.removeListenerFromBlock(listener, block)
	}

	delete(ws.listeners, listener)
}

// subscribeListenerToTeam safely modifies the listener and the
// server to subscribe the listener to a given team updates.
func (ws *Server) subscribeListenerToTeam(listener *websocketSession, teamID string) {
	if listener.isSubscribedToTeam(teamID) {
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.listenersByTeam[teamID] = append(ws.listenersByTeam[teamID], listener)
	listener.teams = append(listener.teams, teamID)
}

// unsubscribeListenerFromTeam safely modifies the listener and
// the server data structures to remove the link between the listener
// and a given team ID.
func (ws *Server) unsubscribeListenerFromTeam(listener *websocketSession, teamID string) {
	if !listener.isSubscribedToTeam(teamID) {
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.removeListenerFromTeam(listener, teamID)
}

// subscribeListenerToBlocks safely modifies the listener and the
// server to subscribe the listener to a given set of block updates.
func (ws *Server) subscribeListenerToBlocks(listener *websocketSession, blockIDs []string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for _, blockID := range blockIDs {
		if listener.isSubscribedToBlock(blockID) {
			continue
		}

		ws.listenersByBlock[blockID] = append(ws.listenersByBlock[blockID], listener)
		listener.blocks = append(listener.blocks, blockID)
	}
}

// unsubscribeListenerFromBlocks safely modifies the listener and the
// server data structures to remove the link between the listener and
// a given set of block IDs.
func (ws *Server) unsubscribeListenerFromBlocks(listener *websocketSession, blockIDs []string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for _, blockID := range blockIDs {
		if listener.isSubscribedToBlock(blockID) {
			ws.removeListenerFromBlock(listener, blockID)
		}
	}
}

// removeListenerFromTeam removes the listener from both its own
// block subscribed list and the server listeners by team map.
func (ws *Server) removeListenerFromTeam(listener *websocketSession, teamID string) {
	// we remove the listener from the team index
	newTeamListeners := []*websocketSession{}
	for _, l := range ws.listenersByTeam[teamID] {
		if l != listener {
			newTeamListeners = append(newTeamListeners, l)
		}
	}
	ws.listenersByTeam[teamID] = newTeamListeners

	// we remove the team from the listener subscription list
	newListenerTeams := []string{}
	for _, id := range listener.teams {
		if id != teamID {
			newListenerTeams = append(newListenerTeams, id)
		}
	}
	listener.teams = newListenerTeams
}

// removeListenerFromBlock removes the listener from both its own
// block subscribed list and the server listeners by block map.
func (ws *Server) removeListenerFromBlock(listener *websocketSession, blockID string) {
	// we remove the listener from the block index
	newBlockListeners := []*websocketSession{}
	for _, l := range ws.listenersByBlock[blockID] {
		if l != listener {
			newBlockListeners = append(newBlockListeners, l)
		}
	}
	ws.listenersByBlock[blockID] = newBlockListeners

	// we remove the block from the listener subscription list
	newListenerBlocks := []string{}
	for _, id := range listener.blocks {
		if id != blockID {
			newListenerBlocks = append(newListenerBlocks, id)
		}
	}
	listener.blocks = newListenerBlocks
}

func (ws *Server) getUserIDForToken(token string) string {
	if len(ws.singleUserToken) > 0 {
		if token == ws.singleUserToken {
			return model.SingleUser
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
			mlog.Stringer("client", wsSession.conn.RemoteAddr()),
		)
		return
	}

	// Authenticate session
	userID := ws.getUserIDForToken(token)
	if userID == "" {
		wsSession.conn.Close()
		return
	}

	// Authenticated
	wsSession.userID = userID
	ws.logger.Debug("authenticateListener: Authenticated", mlog.String("userID", userID), mlog.Stringer("client", wsSession.conn.RemoteAddr()))
}

// getListenersForBlock returns the listeners subscribed to a
// block changes.
func (ws *Server) getListenersForBlock(blockID string) []*websocketSession {
	return ws.listenersByBlock[blockID]
}

// getListenersForTeam returns the listeners subscribed to a
// team changes.
func (ws *Server) getListenersForTeam(teamID string) []*websocketSession {
	return ws.listenersByTeam[teamID]
}

// getListenersForTeamAndBoard returns the listeners subscribed to a
// team changes and members of a given board.
func (ws *Server) getListenersForTeamAndBoard(teamID, boardID string, ensureUsers ...string) []*websocketSession {
	members, err := ws.store.GetMembersForBoard(boardID)
	if err != nil {
		ws.logger.Error("error getting members for board",
			mlog.String("method", "getListenersForTeamAndBoard"),
			mlog.String("teamID", teamID),
			mlog.String("boardID", boardID),
		)
		return nil
	}

	memberMap := map[string]bool{}
	for _, member := range members {
		memberMap[member.UserID] = true
	}
	for _, id := range ensureUsers {
		memberMap[id] = true
	}

	memberIDs := []string{}
	for id := range memberMap {
		memberIDs = append(memberIDs, id)
	}

	listeners := []*websocketSession{}
	for _, memberID := range memberIDs {
		for _, listener := range ws.listenersByTeam[teamID] {
			if listener.userID == memberID {
				listeners = append(listeners, listener)
			}
		}
	}
	return listeners
}

// BroadcastBlockDelete broadcasts delete messages to clients.
func (ws *Server) BroadcastBlockDelete(teamID, blockID, boardID string) {
	now := utils.GetMillis()
	block := &model.Block{}
	block.ID = blockID
	block.BoardID = boardID
	block.UpdateAt = now
	block.DeleteAt = now

	ws.BroadcastBlockChange(teamID, block)
}

// BroadcastBlockChange broadcasts update messages to clients.
func (ws *Server) BroadcastBlockChange(teamID string, block *model.Block) {
	blockIDsToNotify := []string{block.ID, block.ParentID}

	message := UpdateBlockMsg{
		Action: websocketActionUpdateBlock,
		TeamID: teamID,
		Block:  block,
	}

	listeners := ws.getListenersForTeamAndBoard(teamID, block.BoardID)
	ws.logger.Trace("listener(s) for teamID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
		mlog.String("boardID", block.BoardID),
	)

	for _, blockID := range blockIDsToNotify {
		listeners = append(listeners, ws.getListenersForBlock(blockID)...)
		ws.logger.Trace("listener(s) for blockID",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("blockID", blockID),
		)
	}

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast block change",
			mlog.String("teamID", teamID),
			mlog.String("blockID", block.ID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastCategoryChange(category model.Category) {
	message := UpdateCategoryMessage{
		Action:   websocketActionUpdateCategory,
		TeamID:   category.TeamID,
		Category: &category,
	}

	listeners := ws.getListenersForTeam(category.TeamID)
	ws.logger.Debug("listener(s) for teamID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", category.TeamID),
		mlog.String("categoryID", category.ID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast block change",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("teamID", category.TeamID),
			mlog.String("categoryID", category.ID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		if err := listener.WriteJSON(message); err != nil {
			ws.logger.Error("broadcast category change error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastCategoryReorder(teamID, userID string, categoryOrder []string) {
	message := CategoryReorderMessage{
		Action:        websocketActionReorderCategories,
		CategoryOrder: categoryOrder,
		TeamID:        teamID,
	}

	listeners := ws.getListenersForTeam(teamID)
	ws.logger.Debug("listener(s) for teamID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast category order change",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("teamID", teamID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		if err := listener.WriteJSON(message); err != nil {
			ws.logger.Error("broadcast category order change error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastCategoryBoardsReorder(teamID, userID, categoryID string, boardOrder []string) {
	message := CategoryBoardReorderMessage{
		Action:     websocketActionReorderCategoryBoards,
		CategoryID: categoryID,
		BoardOrder: boardOrder,
		TeamID:     teamID,
	}

	listeners := ws.getListenersForTeam(teamID)
	ws.logger.Debug("listener(s) for teamID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast board category order change",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("teamID", teamID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		if err := listener.WriteJSON(message); err != nil {
			ws.logger.Error("broadcast category order change error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastCategoryBoardChange(teamID, userID string, boardCategories []*model.BoardCategoryWebsocketData) {
	message := UpdateCategoryMessage{
		Action:          websocketActionUpdateCategoryBoard,
		TeamID:          teamID,
		BoardCategories: boardCategories,
	}

	listeners := ws.getListenersForTeam(teamID)
	ws.logger.Debug("listener(s) for teamID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
		mlog.Int("numEntries", len(boardCategories)),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast block change",
			mlog.Int("listener_count", len(listeners)),
			mlog.String("teamID", teamID),
			mlog.Int("numEntries", len(boardCategories)),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		if err := listener.WriteJSON(message); err != nil {
			ws.logger.Error("broadcast category change error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

// BroadcastConfigChange broadcasts update messages to clients.
func (ws *Server) BroadcastConfigChange(clientConfig model.ClientConfig) {
	message := UpdateClientConfig{
		Action:       websocketActionUpdateConfig,
		ClientConfig: clientConfig,
	}

	listeners := ws.listeners
	ws.logger.Debug("broadcasting config change to listener(s)",
		mlog.Int("listener_count", len(listeners)),
	)

	for listener := range listeners {
		ws.logger.Debug("Broadcast Config change",
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)
		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastBoardChange(teamID string, board *model.Board) {
	message := UpdateBoardMsg{
		Action: websocketActionUpdateBoard,
		TeamID: teamID,
		Board:  board,
	}

	listeners := ws.getListenersForTeamAndBoard(teamID, board.ID)
	ws.logger.Trace("listener(s) for teamID and boardID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
		mlog.String("boardID", board.ID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast board change",
			mlog.String("teamID", teamID),
			mlog.String("boardID", board.ID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastBoardDelete(teamID, boardID string) {
	now := utils.GetMillis()
	board := &model.Board{}
	board.ID = boardID
	board.TeamID = teamID
	board.UpdateAt = now
	board.DeleteAt = now

	ws.BroadcastBoardChange(teamID, board)
}

func (ws *Server) BroadcastMemberChange(teamID, boardID string, member *model.BoardMember) {
	message := UpdateMemberMsg{
		Action: websocketActionUpdateMember,
		TeamID: teamID,
		Member: member,
	}

	listeners := ws.getListenersForTeamAndBoard(teamID, boardID)
	ws.logger.Trace("listener(s) for teamID and boardID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
		mlog.String("boardID", boardID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast member change",
			mlog.String("teamID", teamID),
			mlog.String("boardID", boardID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastMemberDelete(teamID, boardID, userID string) {
	message := UpdateMemberMsg{
		Action: websocketActionDeleteMember,
		TeamID: teamID,
		Member: &model.BoardMember{UserID: userID, BoardID: boardID},
	}

	// when fetching the members of the board that should receive the
	// member deletion message, the deleted member will not be one of
	// them, so we need to ensure they receive the message
	listeners := ws.getListenersForTeamAndBoard(teamID, boardID, userID)
	ws.logger.Trace("listener(s) for teamID and boardID",
		mlog.Int("listener_count", len(listeners)),
		mlog.String("teamID", teamID),
		mlog.String("boardID", boardID),
	)

	for _, listener := range listeners {
		ws.logger.Debug("Broadcast member removal",
			mlog.String("teamID", teamID),
			mlog.String("boardID", boardID),
			mlog.Stringer("remoteAddr", listener.conn.RemoteAddr()),
		)

		err := listener.WriteJSON(message)
		if err != nil {
			ws.logger.Error("broadcast error", mlog.Err(err))
			listener.conn.Close()
		}
	}
}

func (ws *Server) BroadcastSubscriptionChange(workspaceID string, subscription *model.Subscription) {
	// not implemented for standalone server.
}

func (ws *Server) BroadcastCardLimitTimestampChange(cardLimitTimestamp int64) {
	// not implemented for standalone server.
}
