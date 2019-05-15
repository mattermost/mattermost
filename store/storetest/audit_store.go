// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testAuditStore(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testAuditStorePermanentDeleteBatch(t, ss) })
}

func testAuditStore(t *testing.T, ss store.Store) {
	audit := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	require.Nil(t, ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	require.Nil(t, ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	require.Nil(t, ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	audit.ExtraInfo = "extra"
	time.Sleep(100 * time.Millisecond)
	require.Nil(t, ss.Audit().Save(audit))

	time.Sleep(100 * time.Millisecond)

	audits, err := ss.Audit().Get(audit.UserId, 0, 100)
	require.Nil(t, err)

	assert.Len(t, audits, 4)

	assert.Equal(t, "extra", audits[0].ExtraInfo)

	audits, err = ss.Audit().Get("missing", 0, 100)

	assert.Len(t, audits, 0)

	audits, err = ss.Audit().Get("", 0, 100)

	if len(audits) < 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	require.Nil(t, ss.Audit().PermanentDeleteByUser(audit.UserId))
}

func testAuditStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	a1 := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	require.Nil(t, ss.Audit().Save(a1))
	time.Sleep(10 * time.Millisecond)
	a2 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	require.Nil(t, ss.Audit().Save(a2))
	time.Sleep(10 * time.Millisecond)
	cutoff := model.GetMillis()
	time.Sleep(10 * time.Millisecond)
	a3 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	require.Nil(t, ss.Audit().Save(a3))

	audits, err := ss.Audit().Get(a1.UserId, 0, 100)
	assert.Len(t, audits, 3)

	_, err = ss.Audit().PermanentDeleteBatch(cutoff, 1000000)
	require.Nil(t, err)

	audits, err = ss.Audit().Get(a1.UserId, 0, 100)
	assert.Len(t, audits, 1)

	require.Nil(t, ss.Audit().PermanentDeleteByUser(a1.UserId))
}
