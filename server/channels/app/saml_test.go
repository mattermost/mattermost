// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func registerMockSaml(t *testing.T, configureErr error) *mocks.SamlInterface {
	saml := &mocks.SamlInterface{}
	saml.On("ConfigureSP", mock.AnythingOfType("*request.Context")).Return(configureErr)
	RegisterSamlInterface(func(_ *App) einterfaces.SamlInterface { return saml })
	t.Cleanup(func() { RegisterSamlInterface(nil) })
	return saml
}

func TestReloadSaml(t *testing.T) {
	t.Run("no-op when no SAML interface is registered", func(t *testing.T) {
		RegisterSamlInterface(nil)
		th := Setup(t)

		require.Nil(t, th.App.Saml())
		require.NotPanics(t, func() {
			th.App.reloadSaml(request.TestContext(t))
		})
	})

	for name, configureErr := range map[string]error{
		"reloads the SP and broadcasts to the cluster":      nil,
		"swallows a ConfigureSP error and still broadcasts": errors.New("partial certificate set"),
	} {
		t.Run(name, func(t *testing.T) {
			saml := registerMockSaml(t, configureErr)

			cluster := &testlib.FakeClusterInterface{}
			th := SetupWithClusterMock(t, cluster)

			// Discard the ConfigureSP calls and cluster messages from startup.
			saml.Calls = nil
			cluster.ClearMessages()

			th.App.reloadSaml(request.TestContext(t))

			saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
			msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
				return m.Event == model.ClusterEventReloadSaml
			})
			require.Len(t, msgs, 1)
		})
	}

	t.Run("cluster handler reconfigures the SP", func(t *testing.T) {
		saml := registerMockSaml(t, nil)

		th := Setup(t)
		saml.Calls = nil

		th.Server.clusterReloadSamlHandler(&model.ClusterMessage{Event: model.ClusterEventReloadSaml})

		saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
	})
}
