// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestReloadSaml(t *testing.T) {
	t.Run("no-op when no SAML interface is registered", func(t *testing.T) {
		RegisterSamlInterface(nil)
		th := Setup(t)

		require.Nil(t, th.App.Saml())
		// Team edition has no SAML interface; reloadSaml must not panic.
		require.NotPanics(t, func() {
			th.App.reloadSaml(request.TestContext(t))
		})
	})

	t.Run("reloads the SP and broadcasts to the cluster", func(t *testing.T) {
		var configureCalls int
		saml := &mocks.SamlInterface{}
		saml.On("ConfigureSP", mock.AnythingOfType("*request.Context")).
			Run(func(mock.Arguments) { configureCalls++ }).Return(nil)
		RegisterSamlInterface(func(_ *App) einterfaces.SamlInterface { return saml })
		defer RegisterSamlInterface(nil)

		cluster := &testlib.FakeClusterInterface{}
		th := SetupWithClusterMock(t, cluster)

		// Discard the unconditional ConfigureSP call and any messages from startup.
		configureCalls = 0
		cluster.ClearMessages()

		th.App.reloadSaml(request.TestContext(t))

		assert.Equal(t, 1, configureCalls)
		msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
			return m.Event == model.ClusterEventReloadSaml
		})
		require.Len(t, msgs, 1)
	})

	t.Run("swallows a ConfigureSP error and still broadcasts", func(t *testing.T) {
		var configureCalls int
		saml := &mocks.SamlInterface{}
		saml.On("ConfigureSP", mock.AnythingOfType("*request.Context")).
			Run(func(mock.Arguments) { configureCalls++ }).Return(errors.New("partial certificate set"))
		RegisterSamlInterface(func(_ *App) einterfaces.SamlInterface { return saml })
		defer RegisterSamlInterface(nil)

		cluster := &testlib.FakeClusterInterface{}
		th := SetupWithClusterMock(t, cluster)

		configureCalls = 0
		cluster.ClearMessages()

		// A failed local reconfigure (e.g. one certificate uploaded before the
		// rest) must not abort the reload or the cluster broadcast.
		th.App.reloadSaml(request.TestContext(t))

		assert.Equal(t, 1, configureCalls)
		msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
			return m.Event == model.ClusterEventReloadSaml
		})
		require.Len(t, msgs, 1)
	})
}
