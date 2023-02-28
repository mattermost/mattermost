package ws

import (
	"sync"
	"sync/atomic"
	"time"

	mmModel "github.com/mattermost/mattermost-server/v6/model"
)

type PluginAdapterClient struct {
	inactiveAt int64
	webConnID  string
	userID     string
	teams      []string
	blocks     []string
	mu         sync.RWMutex
}

func (pac *PluginAdapterClient) isActive() bool {
	return atomic.LoadInt64(&pac.inactiveAt) == 0
}

func (pac *PluginAdapterClient) hasExpired(threshold time.Duration) bool {
	return !mmModel.GetTimeForMillis(atomic.LoadInt64(&pac.inactiveAt)).Add(threshold).After(time.Now())
}

func (pac *PluginAdapterClient) subscribeToTeam(teamID string) {
	pac.mu.Lock()
	defer pac.mu.Unlock()

	pac.teams = append(pac.teams, teamID)
}

func (pac *PluginAdapterClient) unsubscribeFromTeam(teamID string) {
	pac.mu.Lock()
	defer pac.mu.Unlock()

	newClientTeams := []string{}
	for _, id := range pac.teams {
		if id != teamID {
			newClientTeams = append(newClientTeams, id)
		}
	}
	pac.teams = newClientTeams
}

func (pac *PluginAdapterClient) unsubscribeFromBlock(blockID string) {
	pac.mu.Lock()
	defer pac.mu.Unlock()

	newClientBlocks := []string{}
	for _, id := range pac.blocks {
		if id != blockID {
			newClientBlocks = append(newClientBlocks, id)
		}
	}
	pac.blocks = newClientBlocks
}

func (pac *PluginAdapterClient) isSubscribedToTeam(teamID string) bool {
	pac.mu.RLock()
	defer pac.mu.RUnlock()

	for _, id := range pac.teams {
		if id == teamID {
			return true
		}
	}

	return false
}

//nolint:unused
func (pac *PluginAdapterClient) isSubscribedToBlock(blockID string) bool {
	pac.mu.RLock()
	defer pac.mu.RUnlock()

	for _, id := range pac.blocks {
		if id == blockID {
			return true
		}
	}

	return false
}
