// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withoutDeletedOptionOmission reverts 000244, putting back the 000223 bodies
// of UserAttributeView and ChannelAttributeView, and returns a function that
// re-applies it. Restoring is left to the caller, as a defer, for the same
// reason as withoutLegacyAttributeView.
func withoutDeletedOptionOmission(t *testing.T, s *SqlStore) func() {
	t.Helper()
	_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000244_omit_attributes_naming_deleted_options.down.sql"))
	require.NoError(t, err, "reverting 000244")
	return func() {
		_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000244_omit_attributes_naming_deleted_options.up.sql"))
		assert.NoError(t, err, "re-applying 000244")
	}
}
