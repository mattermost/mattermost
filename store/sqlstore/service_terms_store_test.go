package sqlstore

import (
	"github.com/mattermost/mattermost-server/store/storetest"
	"testing"
)

func TestServiceTermsStore(t *testing.T) {
	StoreTest(t, storetest.TestServiceTermsStore)
}
