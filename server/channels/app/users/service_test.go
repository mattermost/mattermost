// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestNew(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	_, err := New(ServiceConfig{})
	require.Error(t, err)

	dbStore := mainHelper.GetStore()

	cfn := func() *model.Config {
		return &model.Config{}
	}

	lfn := func() *model.License {
		return model.NewTestLicense()
	}

	_, err = New(ServiceConfig{
		UserStore:    dbStore.User(),
		SessionStore: dbStore.Session(),
		OAuthStore:   dbStore.OAuth(),
		ConfigFn:     cfn,
		LicenseFn:    lfn,
	})
	require.NoError(t, err)
}
