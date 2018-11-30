package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestUserTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestUserTermsOfServiceStore)
}
