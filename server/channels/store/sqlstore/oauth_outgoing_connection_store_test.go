package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestOAuthOutgoingConnectionStore(t *testing.T) {
	StoreTest(t, storetest.TestOAuthOutgoingConnectionStore)
}
