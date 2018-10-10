package sqlstore

import (
	"github.com/mattermost/mattermost-server/store/storetest"
	"testing"
)

func TestTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestTermsOfServiceStore)
}
