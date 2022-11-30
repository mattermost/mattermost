// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/worktemplates"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

func (a *App) GetWorkTemplateCategories(t i18n.TranslateFunc) ([]*model.WorkTemplateCategory, *model.AppError) {
	categories, err := worktemplates.ListCategories()
	if err != nil {
		return nil, model.NewAppError("GetWorkTemplateCategories", "app.worktemplates.get_categories.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	modelCategories := make([]*model.WorkTemplateCategory, len(categories))
	for i := range categories {
		modelCategories[i] = &model.WorkTemplateCategory{
			ID:   categories[i].ID,
			Name: t(categories[i].Name),
		}
	}

	return modelCategories, nil
}

func (a *App) GetWorkTemplates(category string, featureFlags map[string]string, t i18n.TranslateFunc) ([]*model.WorkTemplate, *model.AppError) {
	templates, err := worktemplates.ListByCategory(category)
	if err != nil {
		return nil, model.NewAppError("GetWorkTemplates", "app.worktemplates.get_templates.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// filter out templates that are not enabled by feature Flag
	enabledTemplates := []*model.WorkTemplate{}
	for _, template := range templates {
		mTemplate := template.ToModelWorkTemplate(t)
		if template.FeatureFlag == nil {
			enabledTemplates = append(enabledTemplates, mTemplate)
			continue
		}

		if featureFlags[template.FeatureFlag.Name] == template.FeatureFlag.Value {
			enabledTemplates = append(enabledTemplates, mTemplate)
		}
	}

	return enabledTemplates, nil
}
