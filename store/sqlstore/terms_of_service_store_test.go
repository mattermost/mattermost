package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

func TestTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestTermsOfServiceStore)
}
