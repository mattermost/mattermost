// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -copyright_file=../../copyright.txt -destination=mocks/mockpluginapi.go -package mocks github.com/mattermost/mattermost/server/public/plugin API
package ws

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/v8/boards/auth"
	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/utils"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const websocketMessagePrefix = "custom_boards_"

var errMissingTeamInCommand = fmt.Errorf("command doesn't contain teamId")

type PluginAdapterInterface interface {
	Adapter
	OnWebSocketConnect(webConnID, userID string)
	OnWebSocketDisconnect(webConnID, userID string)
	WebSocketMessageHasBeenPosted(webConnID, userID string, req *mm_model.WebSocketRequest)
	BroadcastConfigChange(clientConfig model.ClientConfig)
	BroadcastBlockChange(teamID string, block *model.Block)
	BroadcastBlockDelete(teamID, blockID, parentID string)
	BroadcastSubscriptionChange(teamID string, subscription *model.Subscription)
	BroadcastCardLimitTimestampChange(cardLimitTimestamp int64)
	HandleClusterEvent(ev mm_model.PluginClusterEvent)
}

type PluginAdapter struct {
	api            servicesAPI
	auth           auth.AuthInterface
	staleThreshold time.Duration
	store          Store
	logger         mlog.LoggerIFace

	listenersMU       sync.RWMutex
	listeners         map[string]*PluginAdapterClient
	listenersByUserID map[string][]*PluginAdapterClient

	subscriptionsMU  sync.RWMutex
	listenersByTeam  map[string][]*PluginAdapterClient
	listenersByBlock map[string][]*PluginAdapterClient
}

// servicesAPI is the interface required by the PluginAdapter to interact with
// the mattermost-server.
type servicesAPI interface {
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *mm_model.WebsocketBroadcast)
	PublishPluginClusterEvent(ev mm_model.PluginClusterEvent, opts mm_model.PluginClusterEventSendOptions) error
}

func NewPluginAdapter(api servicesAPI, auth auth.AuthInterface, store Store, logger mlog.LoggerIFace) *PluginAdapter {
	return &PluginAdapter{
		api:               api,
		auth:              auth,
		store:             store,
		staleThreshold:    5 * time.Minute,
		logger:            logger,
		listeners:         make(map[string]*PluginAdapterClient),
		listenersByUserID: make(map[string][]*PluginAdapterClient),
		listenersByTeam:   make(map[string][]*PluginAdapterClient),
		listenersByBlock:  make(map[string][]*PluginAdapterClient),
		listenersMU:       sync.RWMutex{},
		subscriptionsMU:   sync.RWMutex{},
	}
}

func (pa *PluginAdapter) GetListenerByWebConnID(webConnID string) (pac *PluginAdapterClient, ok bool) {
	pa.listenersMU.RLock()
	defer pa.listenersMU.RUnlock()

	pac, ok = pa.listeners[webConnID]
	return
}

func (pa *PluginAdapter) GetListenersByUserID(userID string) []*PluginAdapterClient {
	pa.listenersMU.RLock()
	defer pa.listenersMU.RUnlock()

	return pa.listenersByUserID[userID]
}

func (pa *PluginAdapter) GetListenersByTeam(teamID string) []*PluginAdapterClient {
	pa.subscriptionsMU.RLock()
	defer pa.subscriptionsMU.RUnlock()

	return pa.listenersByTeam[teamID]
}

func (pa *PluginAdapter) GetListenersByBlock(blockID string) []*PluginAdapterClient {
	pa.subscriptionsMU.RLock()
	defer pa.subscriptionsMU.RUnlock()

	return pa.listenersByBlock[blockID]
}

func (pa *PluginAdapter) addListener(pac *PluginAdapterClient) {
	pa.listenersMU.Lock()
	defer pa.listenersMU.Unlock()

	pa.listeners[pac.webConnID] = pac
	pa.listenersByUserID[pac.userID] = append(pa.listenersByUserID[pac.userID], pac)
}

func (pa *PluginAdapter) removeListener(pac *PluginAdapterClient) {
	pa.listenersMU.Lock()
	defer pa.listenersMU.Unlock()

	// team subscriptions
	for _, team := range pac.teams {
		pa.removeListenerFromTeam(pac, team)
	}

	// block subscriptions
	for _, block := range pac.blocks {
		pa.removeListenerFromBlock(pac, block)
	}

	// user ID list
	newUserListeners := []*PluginAdapterClient{}
	for _, listener := range pa.listenersByUserID[pac.userID] {
		if listener.webConnID != pac.webConnID {
			newUserListeners = append(newUserListeners, listener)
		}
	}
	pa.listenersByUserID[pac.userID] = newUserListeners

	delete(pa.listeners, pac.webConnID)
}

func (pa *PluginAdapter) removeExpiredForUserID(userID string) {
	for _, pac := range pa.GetListenersByUserID(userID) {
		if !pac.isActive() && pac.hasExpired(pa.staleThreshold) {
			pa.removeListener(pac)
		}
	}
}

func (pa *PluginAdapter) removeListenerFromTeam(pac *PluginAdapterClient, teamID string) {
	newTeamListeners := []*PluginAdapterClient{}
	for _, listener := range pa.GetListenersByTeam(teamID) {
		if listener.webConnID != pac.webConnID {
			newTeamListeners = append(newTeamListeners, listener)
		}
	}
	pa.subscriptionsMU.Lock()
	pa.listenersByTeam[teamID] = newTeamListeners
	pa.subscriptionsMU.Unlock()

	pac.unsubscribeFromTeam(teamID)
}

func (pa *PluginAdapter) removeListenerFromBlock(pac *PluginAdapterClient, blockID string) {
	newBlockListeners := []*PluginAdapterClient{}
	for _, listener := range pa.GetListenersByBlock(blockID) {
		if listener.webConnID != pac.webConnID {
			newBlockListeners = append(newBlockListeners, listener)
		}
	}
	pa.subscriptionsMU.Lock()
	pa.listenersByBlock[blockID] = newBlockListeners
	pa.subscriptionsMU.Unlock()

	pac.unsubscribeFromBlock(blockID)
}

func (pa *PluginAdapter) subscribeListenerToTeam(pac *PluginAdapterClient, teamID string) {
	if pac.isSubscribedToTeam(teamID) {
		return
	}

	pa.subscriptionsMU.Lock()
	pa.listenersByTeam[teamID] = append(pa.listenersByTeam[teamID], pac)
	pa.subscriptionsMU.Unlock()

	pac.subscribeToTeam(teamID)
}

func (pa *PluginAdapter) unsubscribeListenerFromTeam(pac *PluginAdapterClient, teamID string) {
	if !pac.isSubscribedToTeam(teamID) {
		return
	}

	pa.removeListenerFromTeam(pac, teamID)
}

func (pa *PluginAdapter) getUserIDsForTeam(teamID string) []string {
	userMap := map[string]bool{}
	for _, pac := range pa.GetListenersByTeam(teamID) {
		if pac.isActive() {
			userMap[pac.userID] = true
		}
	}

	userIDs := []string{}
	for userID := range userMap {
		if pa.auth.DoesUserHaveTeamAccess(userID, teamID) {
			userIDs = append(userIDs, userID)
		}
	}

	return userIDs
}

func (pa *PluginAdapter) getUserIDsForTeamAndBoard(teamID, boardID string, ensureUserIDs ...string) []string {
	userMap := map[string]bool{}
	for _, pac := range pa.GetListenersByTeam(teamID) {
		if pac.isActive() {
			userMap[pac.userID] = true
		}
	}

	members, err := pa.store.GetMembersForBoard(boardID)
	if err != nil {
		pa.logger.Error("error getting members for board",
			mlog.String("method", "getUserIDsForTeamAndBoard"),
			mlog.String("teamID", teamID),
			mlog.String("boardID", boardID),
		)
		return nil
	}

	// the list of users would be the intersection between the ones
	// that are connected to the team and the board members that need
	// to see the updates
	userIDs := []string{}
	for _, member := range members {
		for userID := range userMap {
			if userID == member.UserID && pa.auth.DoesUserHaveTeamAccess(userID, teamID) {
				userIDs = append(userIDs, userID)
			}
		}
	}

	// if we don't have to make sure that some IDs are included, we
	// can return at this point
	if len(ensureUserIDs) == 0 {
		return userIDs
	}

	completeUserMap := map[string]bool{}
	for _, id := range userIDs {
		completeUserMap[id] = true
	}
	for _, id := range ensureUserIDs {
		completeUserMap[id] = true
	}

	completeUserIDs := []string{}
	for id := range completeUserMap {
		completeUserIDs = append(completeUserIDs, id)
	}

	return completeUserIDs
}

//nolint:unused
func (pa *PluginAdapter) unsubscribeListenerFromBlocks(pac *PluginAdapterClient, blockIDs []string) {
	for _, blockID := range blockIDs {
		if pac.isSubscribedToBlock(blockID) {
			pa.removeListenerFromBlock(pac, blockID)
		}
	}
}

func (pa *PluginAdapter) OnWebSocketConnect(webConnID, userID string) {
	if existingPAC, ok := pa.GetListenerByWebConnID(webConnID); ok {
		pa.logger.Debug("inactive connection found for webconn, reusing",
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
		)
		atomic.StoreInt64(&existingPAC.inactiveAt, 0)
		return
	}

	newPAC := &PluginAdapterClient{
		inactiveAt: 0,
		webConnID:  webConnID,
		userID:     userID,
		teams:      []string{},
		blocks:     []string{},
	}

	pa.addListener(newPAC)
	pa.removeExpiredForUserID(userID)
}

func (pa *PluginAdapter) OnWebSocketDisconnect(webConnID, userID string) {
	pac, ok := pa.GetListenerByWebConnID(webConnID)
	if !ok {
		pa.logger.Debug("received a disconnect for an unregistered webconn",
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
		)
		return
	}

	atomic.StoreInt64(&pac.inactiveAt, mm_model.GetMillis())
}

func commandFromRequest(req *mm_model.WebSocketRequest) (*WebsocketCommand, error) {
	c := &WebsocketCommand{Action: strings.TrimPrefix(req.Action, websocketMessagePrefix)}

	if teamID, ok := req.Data["teamId"]; ok {
		c.TeamID = teamID.(string)
	} else {
		return nil, errMissingTeamInCommand
	}

	if readToken, ok := req.Data["readToken"]; ok {
		c.ReadToken = readToken.(string)
	}

	if blockIDs, ok := req.Data["blockIds"]; ok {
		c.BlockIDs = blockIDs.([]string)
	}

	return c, nil
}

func (pa *PluginAdapter) WebSocketMessageHasBeenPosted(webConnID, userID string, req *mm_model.WebSocketRequest) {
	pac, ok := pa.GetListenerByWebConnID(webConnID)
	if !ok {
		pa.logger.Debug("received a message for an unregistered webconn",
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
			mlog.String("action", req.Action),
		)
		return
	}

	// only process messages using the plugin actions
	if !strings.HasPrefix(req.Action, websocketMessagePrefix) {
		return
	}

	command, err := commandFromRequest(req)
	if err != nil {
		pa.logger.Error("error getting command from request",
			mlog.String("action", req.Action),
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
			mlog.Err(err),
		)
		return
	}

	switch command.Action {
	// The block-related commands are not implemented in the adapter
	// as there is no such thing as unauthenticated websocket
	// connections in plugin mode. Only a debug line is logged
	case websocketActionSubscribeBlocks, websocketActionUnsubscribeBlocks:
		pa.logger.Debug(`Command not implemented in plugin mode`,
			mlog.String("command", command.Action),
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
			mlog.String("teamID", command.TeamID),
		)

	case websocketActionSubscribeTeam:
		pa.logger.Debug(`Command not implemented in plugin mode`,
			mlog.String("command", command.Action),
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
			mlog.String("teamID", command.TeamID),
		)

		if !pa.auth.DoesUserHaveTeamAccess(userID, command.TeamID) {
			return
		}

		pa.subscribeListenerToTeam(pac, command.TeamID)
	case websocketActionUnsubscribeTeam:
		pa.logger.Debug(`Command: UNSUBSCRIBE_WORKSPACE`,
			mlog.String("webConnID", webConnID),
			mlog.String("userID", userID),
			mlog.String("teamID", command.TeamID),
		)

		pa.unsubscribeListenerFromTeam(pac, command.TeamID)
	}
}

// sendMessageToAll will send a websocket message to all clients on all nodes.
func (pa *PluginAdapter) sendMessageToAll(event string, payload map[string]interface{}) {
	// Empty &mm_model.WebsocketBroadcast will send to all users
	pa.api.PublishWebSocketEvent(event, payload, &mm_model.WebsocketBroadcast{})
}

func (pa *PluginAdapter) BroadcastConfigChange(pluginConfig model.ClientConfig) {
	pa.sendMessageToAll(websocketActionUpdateConfig, utils.StructToMap(pluginConfig))
}

// sendUserMessageSkipCluster sends the message to specific users.
func (pa *PluginAdapter) sendUserMessageSkipCluster(event string, payload map[string]interface{}, userIDs ...string) {
	for _, userID := range userIDs {
		pa.api.PublishWebSocketEvent(event, payload, &mm_model.WebsocketBroadcast{UserId: userID})
	}
}

// sendTeamMessageSkipCluster sends a message to all the users
// with a websocket client subscribed to a given team.
func (pa *PluginAdapter) sendTeamMessageSkipCluster(event, teamID string, payload map[string]interface{}) {
	userIDs := pa.getUserIDsForTeam(teamID)
	pa.sendUserMessageSkipCluster(event, payload, userIDs...)
}

// sendTeamMessage sends and propagates a message that is aimed
// for all the users that are subscribed to a given team.
func (pa *PluginAdapter) sendTeamMessage(event, teamID string, payload map[string]interface{}, ensureUserIDs ...string) {
	go func() {
		clusterMessage := &ClusterMessage{
			TeamID:      teamID,
			Payload:     payload,
			EnsureUsers: ensureUserIDs,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendTeamMessageSkipCluster(event, teamID, payload)
}

// sendBoardMessageSkipCluster sends a message to all the users
// subscribed to a given team that belong to one of its boards.
func (pa *PluginAdapter) sendBoardMessageSkipCluster(teamID, boardID string, payload map[string]interface{}, ensureUserIDs ...string) {
	userIDs := pa.getUserIDsForTeamAndBoard(teamID, boardID, ensureUserIDs...)
	pa.sendUserMessageSkipCluster(websocketActionUpdateBoard, payload, userIDs...)
}

// sendBoardMessage sends and propagates a message that is aimed for
// all the users that are subscribed to the board's team and are
// members of it too.
func (pa *PluginAdapter) sendBoardMessage(teamID, boardID string, payload map[string]interface{}, ensureUserIDs ...string) {
	go func() {
		clusterMessage := &ClusterMessage{
			TeamID:      teamID,
			BoardID:     boardID,
			Payload:     payload,
			EnsureUsers: ensureUserIDs,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendBoardMessageSkipCluster(teamID, boardID, payload, ensureUserIDs...)
}

func (pa *PluginAdapter) BroadcastBlockChange(teamID string, block *model.Block) {
	pa.logger.Trace("BroadcastingBlockChange",
		mlog.String("teamID", teamID),
		mlog.String("boardID", block.BoardID),
		mlog.String("blockID", block.ID),
	)

	message := UpdateBlockMsg{
		Action: websocketActionUpdateBlock,
		TeamID: teamID,
		Block:  block,
	}

	pa.sendBoardMessage(teamID, block.BoardID, utils.StructToMap(message))
}

func (pa *PluginAdapter) BroadcastCategoryChange(category model.Category) {
	pa.logger.Debug("BroadcastCategoryChange",
		mlog.String("userID", category.UserID),
		mlog.String("teamID", category.TeamID),
		mlog.String("categoryID", category.ID),
	)

	message := UpdateCategoryMessage{
		Action:   websocketActionUpdateCategory,
		TeamID:   category.TeamID,
		Category: &category,
	}

	payload := utils.StructToMap(message)

	go func() {
		clusterMessage := &ClusterMessage{
			Payload: payload,
			UserID:  category.UserID,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendUserMessageSkipCluster(websocketActionUpdateCategory, payload, category.UserID)
}

func (pa *PluginAdapter) BroadcastCategoryReorder(teamID, userID string, categoryOrder []string) {
	pa.logger.Debug("BroadcastCategoryReorder",
		mlog.String("userID", userID),
		mlog.String("teamID", teamID),
	)

	message := CategoryReorderMessage{
		Action:        websocketActionReorderCategories,
		CategoryOrder: categoryOrder,
		TeamID:        teamID,
	}
	payload := utils.StructToMap(message)
	go func() {
		clusterMessage := &ClusterMessage{
			Payload: payload,
			UserID:  userID,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendUserMessageSkipCluster(message.Action, payload, userID)
}

func (pa *PluginAdapter) BroadcastCategoryBoardsReorder(teamID, userID, categoryID string, boardsOrder []string) {
	pa.logger.Debug("BroadcastCategoryBoardsReorder",
		mlog.String("userID", userID),
		mlog.String("teamID", teamID),
		mlog.String("categoryID", categoryID),
	)

	message := CategoryBoardReorderMessage{
		Action:     websocketActionReorderCategoryBoards,
		CategoryID: categoryID,
		BoardOrder: boardsOrder,
		TeamID:     teamID,
	}
	payload := utils.StructToMap(message)
	go func() {
		clusterMessage := &ClusterMessage{
			Payload: payload,
			UserID:  userID,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendUserMessageSkipCluster(message.Action, payload, userID)
}

func (pa *PluginAdapter) BroadcastCategoryBoardChange(teamID, userID string, boardCategories []*model.BoardCategoryWebsocketData) {
	pa.logger.Debug(
		"BroadcastCategoryBoardChange",
		mlog.String("userID", userID),
		mlog.String("teamID", teamID),
		mlog.Int("numEntries", len(boardCategories)),
	)

	message := UpdateCategoryMessage{
		Action:          websocketActionUpdateCategoryBoard,
		TeamID:          teamID,
		BoardCategories: boardCategories,
	}

	payload := utils.StructToMap(message)

	go func() {
		clusterMessage := &ClusterMessage{
			Payload: payload,
			UserID:  userID,
		}

		pa.sendMessageToCluster(clusterMessage)
	}()

	pa.sendUserMessageSkipCluster(websocketActionUpdateCategoryBoard, utils.StructToMap(message), userID)
}

func (pa *PluginAdapter) BroadcastBlockDelete(teamID, blockID, boardID string) {
	now := utils.GetMillis()
	block := &model.Block{}
	block.ID = blockID
	block.BoardID = boardID
	block.UpdateAt = now
	block.DeleteAt = now

	pa.BroadcastBlockChange(teamID, block)
}

func (pa *PluginAdapter) BroadcastBoardChange(teamID string, board *model.Board) {
	pa.logger.Debug("BroadcastingBoardChange",
		mlog.String("teamID", teamID),
		mlog.String("boardID", board.ID),
	)

	message := UpdateBoardMsg{
		Action: websocketActionUpdateBoard,
		TeamID: teamID,
		Board:  board,
	}

	pa.sendBoardMessage(teamID, board.ID, utils.StructToMap(message))
}

func (pa *PluginAdapter) BroadcastBoardDelete(teamID, boardID string) {
	now := utils.GetMillis()
	board := &model.Board{}
	board.ID = boardID
	board.TeamID = teamID
	board.UpdateAt = now
	board.DeleteAt = now

	pa.BroadcastBoardChange(teamID, board)
}

func (pa *PluginAdapter) BroadcastMemberChange(teamID, boardID string, member *model.BoardMember) {
	pa.logger.Debug("BroadcastingMemberChange",
		mlog.String("teamID", teamID),
		mlog.String("boardID", boardID),
		mlog.String("userID", member.UserID),
	)

	message := UpdateMemberMsg{
		Action: websocketActionUpdateMember,
		TeamID: teamID,
		Member: member,
	}

	pa.sendBoardMessage(teamID, boardID, utils.StructToMap(message), member.UserID)
}

func (pa *PluginAdapter) BroadcastMemberDelete(teamID, boardID, userID string) {
	pa.logger.Debug("BroadcastingMemberDelete",
		mlog.String("teamID", teamID),
		mlog.String("boardID", boardID),
		mlog.String("userID", userID),
	)

	message := UpdateMemberMsg{
		Action: websocketActionDeleteMember,
		TeamID: teamID,
		Member: &model.BoardMember{UserID: userID, BoardID: boardID},
	}

	// when fetching the members of the board that should receive the
	// member deletion message, the deleted member will not be one of
	// them, so we need to ensure they receive the message
	pa.sendBoardMessage(teamID, boardID, utils.StructToMap(message), userID)
}

func (pa *PluginAdapter) BroadcastSubscriptionChange(teamID string, subscription *model.Subscription) {
	pa.logger.Debug("BroadcastingSubscriptionChange",
		mlog.String("TeamID", teamID),
		mlog.String("blockID", subscription.BlockID),
		mlog.String("subscriberID", subscription.SubscriberID),
	)

	message := UpdateSubscription{
		Action:       websocketActionUpdateSubscription,
		Subscription: subscription,
	}

	pa.sendTeamMessage(websocketActionUpdateSubscription, teamID, utils.StructToMap(message))
}

func (pa *PluginAdapter) BroadcastCardLimitTimestampChange(cardLimitTimestamp int64) {
	pa.logger.Debug("BroadcastCardLimitTimestampChange",
		mlog.Int64("cardLimitTimestamp", cardLimitTimestamp),
	)

	message := UpdateCardLimitTimestamp{
		Action:    websocketActionUpdateCardLimitTimestamp,
		Timestamp: cardLimitTimestamp,
	}

	pa.sendMessageToAll(websocketActionUpdateCardLimitTimestamp, utils.StructToMap(message))
}
