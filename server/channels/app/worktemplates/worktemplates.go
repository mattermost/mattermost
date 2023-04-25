// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate go run generator/main.go

package worktemplates

var OrderedWorkTemplates = []*WorkTemplate{}
var OrderedWorkTemplateCategories = []*WorkTemplateCategory{}

// T is a placeholder to allow the translation tool to register the strings
func T(id string) string {
	return id
}

func registerWorkTemplate(id string, wt *WorkTemplate) {
	OrderedWorkTemplates = append(OrderedWorkTemplates, wt)
}

func registerWorkTemplateCategory(id string, wtc *WorkTemplateCategory) {
	OrderedWorkTemplateCategories = append(OrderedWorkTemplateCategories, wtc)
}

func ListCategories() ([]*WorkTemplateCategory, error) {
	return OrderedWorkTemplateCategories, nil
}

func ListByCategory(category string) ([]*WorkTemplate, error) {
	wts := []*WorkTemplate{}
	for i := range OrderedWorkTemplates {
		if OrderedWorkTemplates[i].Category == category {
			wts = append(wts, OrderedWorkTemplates[i])
		}
	}

	return wts, nil
}
