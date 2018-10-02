package sqlstore

import (
	"github.com/mattermost/mattermost-server/store/storetest"
	"testing"
)

func TestRemindStore(t *testing.T) {
	StoreTest(t, storetest.TestRemindStore)
}
