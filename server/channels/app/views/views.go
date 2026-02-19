// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (vs *ViewService) CreateView(view *model.View) (*model.View, error) {
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
