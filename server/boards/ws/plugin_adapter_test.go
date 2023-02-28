package ws

import (
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v6/boards/model"

	mm_model "github.com/mattermost/mattermost-server/v6/model"

	"github.com/stretchr/testify/require"
)

func TestPluginAdapterTeamSubscription(t *testing.T) {
	th := SetupTestHelper(t)

	webConnID := mm_model.NewId()
	userID := mm_model.NewId()
	teamID := mm_model.NewId()

	var pac *PluginAdapterClient
	t.Run("Should correctly add a connection", func(t *testing.T) {
		require.Empty(t, th.pa.listeners)
		require.Empty(t, th.pa.listenersByTeam)
		th.pa.OnWebSocketConnect(webConnID, userID)
		require.Len(t, th.pa.listeners, 1)

		var ok bool
		pac, ok = th.pa.listeners[webConnID]
		require.True(t, ok)
		require.NotNil(t, pac)
		require.Equal(t, userID, pac.userID)
		require.Empty(t, th.pa.listenersByTeam)
	})

	t.Run("Should correctly subscribe to a team", func(t *testing.T) {
		require.False(t, pac.isSubscribedToTeam(teamID))

		th.SubscribeWebConnToTeam(pac.webConnID, pac.userID, teamID)

		require.Len(t, th.pa.listenersByTeam[teamID], 1)
		require.Contains(t, th.pa.listenersByTeam[teamID], pac)
		require.Len(t, pac.teams, 1)
		require.Contains(t, pac.teams, teamID)

		require.True(t, pac.isSubscribedToTeam(teamID))
	})

	t.Run("Subscribing again to a subscribed team would have no effect", func(t *testing.T) {
		require.True(t, pac.isSubscribedToTeam(teamID))

		th.SubscribeWebConnToTeam(pac.webConnID, pac.userID, teamID)

		require.Len(t, th.pa.listenersByTeam[teamID], 1)
		require.Contains(t, th.pa.listenersByTeam[teamID], pac)
		require.Len(t, pac.teams, 1)
		require.Contains(t, pac.teams, teamID)

		require.True(t, pac.isSubscribedToTeam(teamID))
	})

	t.Run("Should correctly unsubscribe to a team", func(t *testing.T) {
		require.True(t, pac.isSubscribedToTeam(teamID))

		th.UnsubscribeWebConnFromTeam(pac.webConnID, pac.userID, teamID)

		require.Empty(t, th.pa.listenersByTeam[teamID])
		require.Empty(t, pac.teams)

		require.False(t, pac.isSubscribedToTeam(teamID))
	})

	t.Run("Unsubscribing again to an unsubscribed team would have no effect", func(t *testing.T) {
		require.False(t, pac.isSubscribedToTeam(teamID))

		th.UnsubscribeWebConnFromTeam(pac.webConnID, pac.userID, teamID)

		require.Empty(t, th.pa.listenersByTeam[teamID])
		require.Empty(t, pac.teams)

		require.False(t, pac.isSubscribedToTeam(teamID))
	})

	t.Run("Should correctly be marked as inactive if disconnected", func(t *testing.T) {
		require.Len(t, th.pa.listeners, 1)
		require.True(t, th.pa.listeners[webConnID].isActive())

		th.pa.OnWebSocketDisconnect(webConnID, userID)

		require.Len(t, th.pa.listeners, 1)
		require.False(t, th.pa.listeners[webConnID].isActive())
	})

	t.Run("Should be marked back as active if reconnect", func(t *testing.T) {
		require.Len(t, th.pa.listeners, 1)
		require.False(t, th.pa.listeners[webConnID].isActive())

		th.pa.OnWebSocketConnect(webConnID, userID)

		require.Len(t, th.pa.listeners, 1)
		require.True(t, th.pa.listeners[webConnID].isActive())
	})
}

func TestPluginAdapterClientReconnect(t *testing.T) {
	th := SetupTestHelper(t)

	webConnID := mm_model.NewId()
	userID := mm_model.NewId()
	teamID := mm_model.NewId()

	var pac *PluginAdapterClient
	t.Run("A user should be able to reconnect within the accepted threshold and keep their subscriptions", func(t *testing.T) {
		// create the connection
		require.Len(t, th.pa.listeners, 0)
		require.Len(t, th.pa.listenersByUserID[userID], 0)
		th.pa.OnWebSocketConnect(webConnID, userID)
		require.Len(t, th.pa.listeners, 1)
		require.Len(t, th.pa.listenersByUserID[userID], 1)
		var ok bool
		pac, ok = th.pa.listeners[webConnID]
		require.True(t, ok)
		require.NotNil(t, pac)

		th.SubscribeWebConnToTeam(pac.webConnID, pac.userID, teamID)
		require.True(t, pac.isSubscribedToTeam(teamID))

		// disconnect
		th.pa.OnWebSocketDisconnect(webConnID, userID)
		require.False(t, pac.isActive())
		require.Len(t, th.pa.listeners, 1)
		require.Len(t, th.pa.listenersByUserID[userID], 1)

		// reconnect right away. The connection should still be subscribed
		th.pa.OnWebSocketConnect(webConnID, userID)
		require.Len(t, th.pa.listeners, 1)
		require.Len(t, th.pa.listenersByUserID[userID], 1)
		require.True(t, pac.isActive())
		require.True(t, pac.isSubscribedToTeam(teamID))
	})

	t.Run("Should remove old inactive connection when user connects with a different ID", func(t *testing.T) {
		// we set the stale threshold to zero so inactive connections always get deleted
		oldStaleThreshold := th.pa.staleThreshold
		th.pa.staleThreshold = 0
		defer func() { th.pa.staleThreshold = oldStaleThreshold }()
		th.pa.OnWebSocketDisconnect(webConnID, userID)
		require.Len(t, th.pa.listeners, 1)
		require.Len(t, th.pa.listenersByUserID[userID], 1)
		require.Equal(t, webConnID, th.pa.listenersByUserID[userID][0].webConnID)

		newWebConnID := mm_model.NewId()
		th.pa.OnWebSocketConnect(newWebConnID, userID)

		require.Len(t, th.pa.listeners, 1)
		require.Len(t, th.pa.listenersByUserID[userID], 1)
		require.Contains(t, th.pa.listeners, newWebConnID)
		require.NotContains(t, th.pa.listeners, webConnID)
		require.Equal(t, newWebConnID, th.pa.listenersByUserID[userID][0].webConnID)

		// if the same ID connects again, it should have no subscriptions
		th.pa.OnWebSocketConnect(webConnID, userID)
		require.Len(t, th.pa.listeners, 2)
		require.Len(t, th.pa.listenersByUserID[userID], 2)
		reconnectedPAC, ok := th.pa.listeners[webConnID]
		require.True(t, ok)
		require.False(t, reconnectedPAC.isSubscribedToTeam(teamID))
	})

	t.Run("Should not remove active connections when user connects with a different ID", func(t *testing.T) {
		// we set the stale threshold to zero so inactive connections always get deleted
		oldStaleThreshold := th.pa.staleThreshold
		th.pa.staleThreshold = 0
		defer func() { th.pa.staleThreshold = oldStaleThreshold }()

		// currently we have two listeners for userID, both active
		require.Len(t, th.pa.listeners, 2)

		// a new user connects
		th.pa.OnWebSocketConnect(mm_model.NewId(), userID)

		// and we should have three connections, all of them active
		require.Len(t, th.pa.listeners, 3)

		for _, listener := range th.pa.listeners {
			require.True(t, listener.isActive())
		}
	})
}

func TestGetUserIDsForTeam(t *testing.T) {
	th := SetupTestHelper(t)

	// we have two teams
	teamID1 := mm_model.NewId()
	teamID2 := mm_model.NewId()

	// user 1 has two connections
	userID1 := mm_model.NewId()
	webConnID1 := mm_model.NewId()
	webConnID2 := mm_model.NewId()

	// user 2 has one connection
	userID2 := mm_model.NewId()
	webConnID3 := mm_model.NewId()

	wg := new(sync.WaitGroup)
	wg.Add(3)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID1, userID1)
		th.SubscribeWebConnToTeam(webConnID1, userID1, teamID1)
		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID2, userID1)
		th.SubscribeWebConnToTeam(webConnID2, userID1, teamID2)
		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID3, userID2)
		th.SubscribeWebConnToTeam(webConnID3, userID2, teamID2)
		wg.Done()
	}(wg)

	wg.Wait()

	t.Run("should find that only user1 is connected to team 1", func(t *testing.T) {
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID1).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID1)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})

	t.Run("should find that both users are connected to team 2", func(t *testing.T) {
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID2)
		require.ElementsMatch(t, []string{userID1, userID2}, userIDs)
	})

	t.Run("should ignore user1 if webConn 2 inactive when getting team 2 user ids", func(t *testing.T) {
		th.pa.OnWebSocketDisconnect(webConnID2, userID1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID2)
		require.ElementsMatch(t, []string{userID2}, userIDs)
	})

	t.Run("should still find user 1 in team 1 after the webConn 2 disconnection", func(t *testing.T) {
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID1).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID1)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})

	t.Run("should find again both users if the webConn 2 comes back", func(t *testing.T) {
		th.pa.OnWebSocketConnect(webConnID2, userID1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID2)
		require.ElementsMatch(t, []string{userID1, userID2}, userIDs)
	})

	t.Run("should only find user 1 if user 2 has an active connection but is not a team member anymore", func(t *testing.T) {
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)

		// userID2 does not have team access
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(false).
			Times(1)

		userIDs := th.pa.getUserIDsForTeam(teamID2)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})
}

func TestGetUserIDsForTeamAndBoard(t *testing.T) {
	th := SetupTestHelper(t)

	// we have two teams
	teamID1 := mm_model.NewId()
	boardID1 := mm_model.NewId()
	teamID2 := mm_model.NewId()
	boardID2 := mm_model.NewId()

	// user 1 has two connections
	userID1 := mm_model.NewId()
	webConnID1 := mm_model.NewId()
	webConnID2 := mm_model.NewId()

	// user 2 has one connection
	userID2 := mm_model.NewId()
	webConnID3 := mm_model.NewId()

	wg := new(sync.WaitGroup)
	wg.Add(3)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID1, userID1)
		th.SubscribeWebConnToTeam(webConnID1, userID1, teamID1)
		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID2, userID1)
		th.SubscribeWebConnToTeam(webConnID2, userID1, teamID2)
		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.pa.OnWebSocketConnect(webConnID3, userID2)
		th.SubscribeWebConnToTeam(webConnID3, userID2, teamID2)
		wg.Done()
	}(wg)

	wg.Wait()

	t.Run("should find that only user1 is connected to team 1 and board 1", func(t *testing.T) {
		mockedMembers := []*model.BoardMember{{UserID: userID1}}
		th.store.EXPECT().
			GetMembersForBoard(boardID1).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID1).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID1, boardID1)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})

	t.Run("should find that both users are connected to team 2 and board 2", func(t *testing.T) {
		mockedMembers := []*model.BoardMember{{UserID: userID1}, {UserID: userID2}}
		th.store.EXPECT().
			GetMembersForBoard(boardID2).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID2, boardID2)
		require.ElementsMatch(t, []string{userID1, userID2}, userIDs)
	})

	t.Run("should find that only one user is connected to team 2 and board 2 if there is only one membership with both connected", func(t *testing.T) {
		mockedMembers := []*model.BoardMember{{UserID: userID1}}
		th.store.EXPECT().
			GetMembersForBoard(boardID2).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID2, boardID2)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})

	t.Run("should find only one if the other is inactive", func(t *testing.T) {
		th.pa.OnWebSocketDisconnect(webConnID3, userID2)
		defer th.pa.OnWebSocketConnect(webConnID3, userID2)

		mockedMembers := []*model.BoardMember{{UserID: userID1}, {UserID: userID2}}
		th.store.EXPECT().
			GetMembersForBoard(boardID2).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID2, boardID2)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})

	t.Run("should include a user that is not present if it's ensured", func(t *testing.T) {
		userID3 := mm_model.NewId()
		mockedMembers := []*model.BoardMember{{UserID: userID1}, {UserID: userID2}}
		th.store.EXPECT().
			GetMembersForBoard(boardID2).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(true).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID2, boardID2, userID3)
		require.ElementsMatch(t, []string{userID1, userID2, userID3}, userIDs)
	})

	t.Run("should not include a user that, although present, has no team access anymore", func(t *testing.T) {
		mockedMembers := []*model.BoardMember{{UserID: userID1}, {UserID: userID2}}
		th.store.EXPECT().
			GetMembersForBoard(boardID2).
			Return(mockedMembers, nil).
			Times(1)

		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID1, teamID2).
			Return(true).
			Times(1)

		// userID2 has no team access
		th.auth.EXPECT().
			DoesUserHaveTeamAccess(userID2, teamID2).
			Return(false).
			Times(1)

		userIDs := th.pa.getUserIDsForTeamAndBoard(teamID2, boardID2)
		require.ElementsMatch(t, []string{userID1}, userIDs)
	})
}

func TestParallelSubscriptionsOnMultipleConnections(t *testing.T) {
	th := SetupTestHelper(t)

	teamID1 := mm_model.NewId()
	teamID2 := mm_model.NewId()
	teamID3 := mm_model.NewId()
	teamID4 := mm_model.NewId()

	userID := mm_model.NewId()
	webConnID1 := mm_model.NewId()
	webConnID2 := mm_model.NewId()

	th.pa.OnWebSocketConnect(webConnID1, userID)
	pac1, ok := th.pa.GetListenerByWebConnID(webConnID1)
	require.True(t, ok)

	th.pa.OnWebSocketConnect(webConnID2, userID)
	pac2, ok := th.pa.GetListenerByWebConnID(webConnID2)
	require.True(t, ok)

	wg := new(sync.WaitGroup)
	wg.Add(4)

	go func(wg *sync.WaitGroup) {
		th.SubscribeWebConnToTeam(webConnID1, userID, teamID1)
		require.True(t, pac1.isSubscribedToTeam(teamID1))

		th.SubscribeWebConnToTeam(webConnID2, userID, teamID1)
		require.True(t, pac2.isSubscribedToTeam(teamID1))

		th.UnsubscribeWebConnFromTeam(webConnID1, userID, teamID1)
		require.False(t, pac1.isSubscribedToTeam(teamID1))

		th.UnsubscribeWebConnFromTeam(webConnID2, userID, teamID1)
		require.False(t, pac2.isSubscribedToTeam(teamID1))

		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.SubscribeWebConnToTeam(webConnID1, userID, teamID2)
		require.True(t, pac1.isSubscribedToTeam(teamID2))

		th.SubscribeWebConnToTeam(webConnID2, userID, teamID2)
		require.True(t, pac2.isSubscribedToTeam(teamID2))

		th.UnsubscribeWebConnFromTeam(webConnID1, userID, teamID2)
		require.False(t, pac1.isSubscribedToTeam(teamID2))

		th.UnsubscribeWebConnFromTeam(webConnID2, userID, teamID2)
		require.False(t, pac2.isSubscribedToTeam(teamID2))

		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.SubscribeWebConnToTeam(webConnID1, userID, teamID3)
		require.True(t, pac1.isSubscribedToTeam(teamID3))

		th.SubscribeWebConnToTeam(webConnID2, userID, teamID3)
		require.True(t, pac2.isSubscribedToTeam(teamID3))

		th.UnsubscribeWebConnFromTeam(webConnID1, userID, teamID3)
		require.False(t, pac1.isSubscribedToTeam(teamID3))

		th.UnsubscribeWebConnFromTeam(webConnID2, userID, teamID3)
		require.False(t, pac2.isSubscribedToTeam(teamID3))

		wg.Done()
	}(wg)

	go func(wg *sync.WaitGroup) {
		th.SubscribeWebConnToTeam(webConnID1, userID, teamID4)
		require.True(t, pac1.isSubscribedToTeam(teamID4))

		th.SubscribeWebConnToTeam(webConnID2, userID, teamID4)
		require.True(t, pac2.isSubscribedToTeam(teamID4))

		th.UnsubscribeWebConnFromTeam(webConnID1, userID, teamID4)
		require.False(t, pac1.isSubscribedToTeam(teamID4))

		th.UnsubscribeWebConnFromTeam(webConnID2, userID, teamID4)
		require.False(t, pac2.isSubscribedToTeam(teamID4))

		wg.Done()
	}(wg)

	wg.Wait()
}
