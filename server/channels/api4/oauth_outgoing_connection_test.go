// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package api4

import (
	"context"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func TestOutgoingOAuthConnectionGet(t *testing.T) {
	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTION", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTION")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		defer func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
		}()
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.App.Srv().RemoveLicense()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background())
		require.Error(t, err)
		require.Nil(t, connections)
		require.Equal(t, 501, response.StatusCode)
	})
}
