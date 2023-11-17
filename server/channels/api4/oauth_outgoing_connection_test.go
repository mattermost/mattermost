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

func TestOAuthOutgoingConnectionGet(t *testing.T) {
	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_OAUTHOUTGOINGCONNECTION", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_OAUTHOUTGOINGCONNECTION")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		oauthSvc := &mocks.OAuthOutgoingConnectionInterface{}
		oauthOutgoingImpl := th.App.Srv().OAuthOutgoingConnection
		defer func() {
			th.App.Srv().OAuthOutgoingConnection = oauthOutgoingImpl
		}()
		th.App.Srv().OAuthOutgoingConnection = oauthSvc

		th.App.Srv().RemoveLicense()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		connections, response, err := th.Client.GetOAuthOutgoingConnections(context.Background())
		require.Error(t, err)
		require.Nil(t, connections)
		require.Equal(t, 501, response.StatusCode)
	})
}
