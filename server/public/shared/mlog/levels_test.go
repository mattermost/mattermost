// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog_test

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// A new audit level must be added to MLvlAuditGeneral too, unless, like audit-delivery, it
// should not by itself mean audit logging is on.
func TestAuditLevelGroups(t *testing.T) {
	var notGeneral []mlog.Level
	for _, level := range mlog.MLvlAuditAll {
		if !slices.Contains(mlog.MLvlAuditGeneral, level) {
			notGeneral = append(notGeneral, level)
		}
	}
	require.Equal(t, []mlog.Level{mlog.LvlAuditDelivery}, notGeneral)

	for _, level := range mlog.MLvlAuditGeneral {
		require.Contains(t, mlog.MLvlAuditAll, level)
	}
}
