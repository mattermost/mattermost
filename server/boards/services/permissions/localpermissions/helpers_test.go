// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localpermissions

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	permissionsMocks "github.com/mattermost/mattermost-server/server/v8/boards/services/permissions/mocks"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

type TestHelper struct {
	t           *testing.T
	ctrl        *gomock.Controller
	store       *permissionsMocks.MockStore
	permissions *Service
}

func SetupTestHelper(t *testing.T) *TestHelper {
	ctrl := gomock.NewController(t)
	mockStore := permissionsMocks.NewMockStore(ctrl)
	return &TestHelper{
		t:           t,
		ctrl:        ctrl,
		store:       mockStore,
		permissions: New(mockStore, mlog.CreateConsoleTestLogger(false, mlog.LvlDebug)),
	}
}

func (th *TestHelper) checkBoardPermissions(roleName string, member *model.BoardMember, hasPermissionTo, hasNotPermissionTo []*mm_model.Permission) {
	for _, p := range hasPermissionTo {
		th.t.Run(roleName+" "+p.Id, func(t *testing.T) {
			th.store.EXPECT().
				GetMemberForBoard(member.BoardID, member.UserID).
				Return(member, nil).
				Times(1)

			hasPermission := th.permissions.HasPermissionToBoard(member.UserID, member.BoardID, p)
			assert.True(t, hasPermission)
		})
	}

	for _, p := range hasNotPermissionTo {
		th.t.Run(roleName+" "+p.Id, func(t *testing.T) {
			th.store.EXPECT().
				GetMemberForBoard(member.BoardID, member.UserID).
				Return(member, nil).
				Times(1)

			hasPermission := th.permissions.HasPermissionToBoard(member.UserID, member.BoardID, p)
			assert.False(t, hasPermission)
		})
	}
}
