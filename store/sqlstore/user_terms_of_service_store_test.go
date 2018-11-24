package sqlstore

import (
	"github.com/mattermost/mattermost-server/store/storetest"
	"testing"
)

func TestUserTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestUserTermsOfServiceStore)
}
