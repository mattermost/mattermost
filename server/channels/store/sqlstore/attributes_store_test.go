// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestAttributesStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestAttributesStore)
}

func TestGetSubjectRespectsMasterContext(t *testing.T) {
	StoreTestWithSqlStore(t, func(t *testing.T, rctx request.CTX, ss store.Store, s storetest.SqlStore) {
		sqlStore := ss.(*SqlStore)
		masterCtx := RequestContextWithMaster(rctx)
		require.False(t, HasMaster(rctx.Context()))
		require.True(t, HasMaster(masterCtx.Context()))
		require.Same(t, sqlStore.GetReplica(), sqlStore.DBXFromContext(rctx.Context()))
		require.Same(t, sqlStore.GetMaster(), sqlStore.DBXFromContext(masterCtx.Context()))

		_, err := ss.Attributes().GetSubject(masterCtx, model.NewId(), model.NewId(), model.PropertyFieldObjectTypeUser)
		require.Error(t, err)
		var nf *store.ErrNotFound
		require.ErrorAs(t, err, &nf)
	})
}
