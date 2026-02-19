// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateView(t *testing.T) {
	th := Setup(t)

	t.Run("seeds default kanban subview when none provided", func(t *testing.T) {
		view := makeView()
		saved, err := th.service.CreateView(view)
		require.NoError(t, err)
		require.Len(t, saved.Props.Subviews, 1)
		require.Equal(t, model.SubviewTypeKanban, saved.Props.Subviews[0].Type)
		require.NotEmpty(t, saved.Props.Subviews[0].Id)
	})

	t.Run("seeds default subview when Props is nil", func(t *testing.T) {
		view := makeView()
		view.Props = nil
		saved, err := th.service.CreateView(view)
		require.NoError(t, err)
		require.NotNil(t, saved.Props)
		require.Len(t, saved.Props.Subviews, 1)
	})

	t.Run("preserves provided subviews", func(t *testing.T) {
		view := makeView()
		view.Props = &model.ViewBoardProps{
			Subviews: []model.Subview{
				{Title: "Custom", Type: model.SubviewTypeKanban},
			},
		}
		saved, err := th.service.CreateView(view)
		require.NoError(t, err)
		require.Len(t, saved.Props.Subviews, 1)
		require.Equal(t, "Custom", saved.Props.Subviews[0].Title)
	})

	t.Run("seeds board property field ID in LinkedProperties", func(t *testing.T) {
		view := makeView()
		saved, err := th.service.CreateView(view)
		require.NoError(t, err)
		require.Len(t, saved.Props.LinkedProperties, 1)
		require.Equal(t, th.service.boardPropertyFieldID, saved.Props.LinkedProperties[0])
	})

	t.Run("preserves provided LinkedProperties", func(t *testing.T) {
		customID := model.NewId()
		view := makeView()
		view.Props = &model.ViewBoardProps{
			LinkedProperties: []string{customID},
		}
		saved, err := th.service.CreateView(view)
		require.NoError(t, err)
		require.Len(t, saved.Props.LinkedProperties, 1)
		require.Equal(t, customID, saved.Props.LinkedProperties[0])
	})
}

func TestGetView(t *testing.T) {
	th := Setup(t)

	t.Run("returns saved view", func(t *testing.T) {
		saved, err := th.service.CreateView(makeView())
		require.NoError(t, err)

		got, err := th.service.GetView(saved.Id)
		require.NoError(t, err)
		require.Equal(t, saved.Id, got.Id)
		require.Equal(t, saved.Title, got.Title)
	})

	t.Run("returns error for non-existent view", func(t *testing.T) {
		_, err := th.service.GetView(model.NewId())
		require.Error(t, err)
	})
}

func TestGetViewsForChannel(t *testing.T) {
	th := Setup(t)

	t.Run("returns all views for channel", func(t *testing.T) {
		channelID := model.NewId()

		v1 := makeView()
		v1.ChannelId = channelID
		_, err := th.service.CreateView(v1)
		require.NoError(t, err)

		v2 := makeView()
		v2.ChannelId = channelID
		_, err = th.service.CreateView(v2)
		require.NoError(t, err)

		views, err := th.service.GetViewsForChannel(channelID)
		require.NoError(t, err)
		require.Len(t, views, 2)
	})

	t.Run("does not return views from other channels", func(t *testing.T) {
		channelID := model.NewId()
		v := makeView()
		v.ChannelId = channelID
		_, err := th.service.CreateView(v)
		require.NoError(t, err)

		views, err := th.service.GetViewsForChannel(model.NewId())
		require.NoError(t, err)
		require.Empty(t, views)
	})
}

func TestUpdateView(t *testing.T) {
	th := Setup(t)

	t.Run("applies patch fields", func(t *testing.T) {
		saved, err := th.service.CreateView(makeView())
		require.NoError(t, err)

		newTitle := "Updated Title"
		updated, err := th.service.UpdateView(saved, &model.ViewPatch{Title: &newTitle})
		require.NoError(t, err)
		require.Equal(t, newTitle, updated.Title)
	})
}

func TestDeleteView(t *testing.T) {
	th := Setup(t)

	t.Run("soft-deletes the view", func(t *testing.T) {
		saved, err := th.service.CreateView(makeView())
		require.NoError(t, err)

		err = th.service.DeleteView(saved.Id)
		require.NoError(t, err)

		_, err = th.service.GetView(saved.Id)
		require.Error(t, err)
	})

	t.Run("returns error for non-existent view", func(t *testing.T) {
		err := th.service.DeleteView(model.NewId())
		require.Error(t, err)
	})
}
