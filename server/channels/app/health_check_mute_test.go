// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestMuteHealthFinding(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	healthFindingStore := storemocks.NewHealthFindingStore(t)
	mockStore.On("HealthFinding").Return(healthFindingStore)

	t.Run("mutes finding for system admin", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{UserId: model.NewId(), Local: true})
		healthFindingStore.On("Mute", "fp-1", "user-1", mock.AnythingOfType("int64")).Return(nil).Once()

		appErr := th.App.MuteHealthFinding(rctx, "fp-1", "user-1")
		require.Nil(t, appErr)
	})

	t.Run("returns not found for unknown fingerprint", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{UserId: model.NewId(), Local: true})
		healthFindingStore.On("Mute", "missing", "user-1", mock.AnythingOfType("int64")).Return(healthcheck.ErrFindingNotFound).Once()

		appErr := th.App.MuteHealthFinding(rctx, "missing", "user-1")
		require.NotNil(t, appErr)
		require.Equal(t, "app.health_finding.mute.not_found.app_error", appErr.Id)
		require.Equal(t, 404, appErr.StatusCode)
	})

}

func TestUnmuteHealthFinding(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	healthFindingStore := storemocks.NewHealthFindingStore(t)
	mockStore.On("HealthFinding").Return(healthFindingStore)

	rctx := th.Context.WithSession(&model.Session{UserId: model.NewId(), Local: true})

	healthFindingStore.On("Unmute", "fp-1").Return(nil).Once()
	appErr := th.App.UnmuteHealthFinding(rctx, "fp-1")
	require.Nil(t, appErr)

	healthFindingStore.On("Unmute", "missing").Return(healthcheck.ErrFindingNotFound).Once()
	appErr = th.App.UnmuteHealthFinding(rctx, "missing")
	require.NotNil(t, appErr)
	require.Equal(t, "app.health_finding.mute.not_found.app_error", appErr.Id)
	require.Equal(t, 404, appErr.StatusCode)
}

func TestGetHealthFindings(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	healthFindingStore := storemocks.NewHealthFindingStore(t)
	mockStore.On("HealthFinding").Return(healthFindingStore)

	rctx := th.Context.WithSession(&model.Session{UserId: model.NewId(), Local: true})
	expected := []*model.HealthFinding{{Fingerprint: "fp-1"}}

	healthFindingStore.On("List", model.HealthFindingFilter{Muted: model.MutedExcluded}).Return(expected, nil).Once()
	findings, appErr := th.App.GetHealthFindings(rctx, model.HealthFindingFilter{})
	require.Nil(t, appErr)
	require.Len(t, findings, 1)
	require.Equal(t, "fp-1", findings[0].Fingerprint)

	healthFindingStore.On("List", model.HealthFindingFilter{Muted: model.MutedOnly}).Return(expected, nil).Once()
	findings, appErr = th.App.GetHealthFindings(rctx, model.HealthFindingFilter{Muted: model.MutedOnly})
	require.Nil(t, appErr)
	require.Len(t, findings, 1)

	healthFindingStore.On("List", model.HealthFindingFilter{Muted: model.MutedOnly}).Return(expected, nil).Once()
	muted, appErr := th.App.GetMutedHealthFindings(rctx)
	require.Nil(t, appErr)
	require.Len(t, muted, 1)
}
