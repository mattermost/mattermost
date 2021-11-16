package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/store/storetest"
)

func TestTokensStore(t *testing.T) {
	StoreTest(t, storetest.TestTokensStore)
}
