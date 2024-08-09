package sqlstore

import (
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"testing"
)

func TestScheduledPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestScheduledPostStore)
}
