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

func TestRoleStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestRoleStore)
}

// TestSqlRoleStoreCreateRoleValidates guards a regression: createRole must validate
// the role itself. It is called directly by scheme_store (bypassing Save/save and
// their validation), so removing its own validation would silently let invalid roles
// through that path (see MM-68830 review).
func TestSqlRoleStoreCreateRoleValidates(t *testing.T) {
	StoreTestWithSqlStore(t, func(t *testing.T, rctx request.CTX, ss store.Store, s storetest.SqlStore) {
		roleStore := ss.Role().(*SqlRoleStore)

		transaction, err := roleStore.GetMaster().Begin()
		require.NoError(t, err)
		defer func() { _ = transaction.Rollback() }()

		// A role carrying a permission this build does not recognize must be rejected
		// by createRole, just as it is by Save. createRole does not tolerate unknown
		// permissions; only the migration's SavePreservingUnknownPermissions path does.
		invalid := &model.Role{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Permissions: []string{"manage_own_agent_from_the_future"},
		}

		_, err = roleStore.createRole(invalid, transaction)
		require.Error(t, err, "createRole must reject unknown permissions")
		var invErr *store.ErrInvalidInput
		require.ErrorAs(t, err, &invErr)
	})
}
