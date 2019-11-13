package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestTeamStore(t *testing.T) {
	StoreTest(t, storetest.TestTeamStore)
}
