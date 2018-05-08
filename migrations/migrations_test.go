// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetMigrationState(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	state, job, err := GetMigrationState(MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Nil(t, job)
	assert.Equal(t, "unscheduled", state)
}

