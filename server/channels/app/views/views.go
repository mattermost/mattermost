// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// CreateView saves a new view and seeds its initial state.
//
// A default kanban subview is always created if none are provided, following
// the spec requirement that every board starts with a kanban presentation.
//
// The system-level "board" property field ID is pre-populated in LinkedProperties
// so that the board can filter cards by their board membership.
func (vs *ViewService) CreateView(view *model.View) (*model.View, error) {
	if view.Props == nil {
		view.Props = &model.ViewBoardProps{}
	}

	if len(view.Props.Subviews) == 0 {
		view.Props.Subviews = []model.Subview{
			{Title: i18n.T("app.view.default_subview.title"), Type: model.SubviewTypeKanban},
		}
	}

	if len(view.Props.LinkedProperties) == 0 {
		view.Props.LinkedProperties = []string{vs.boardPropertyFieldID}
	}

	return vs.store.Save(view)
}

func (vs *ViewService) GetView(viewID string) (*model.View, error) {
	return vs.store.Get(viewID)
}

func (vs *ViewService) GetViewsForChannel(channelID string) ([]*model.View, error) {
	return vs.store.GetForChannel(channelID)
}

func (vs *ViewService) UpdateView(view *model.View, patch *model.ViewPatch) (*model.View, error) {
	view.Patch(patch)
	return vs.store.Update(view)
}

func (vs *ViewService) DeleteView(viewID string) error {
	return vs.store.Delete(viewID, model.GetMillis())
}
