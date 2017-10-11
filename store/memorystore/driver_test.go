package memorystore

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/nosqlstore/nosqlstoretest"
)

func TestDriver(t *testing.T) {
	nosqlstoretest.TestDriver(t, &Driver{})
}
