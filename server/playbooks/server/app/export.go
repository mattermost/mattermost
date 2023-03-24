// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"reflect"
)

const CurrentPlaybookExportVersion = 1

func getFieldsForExport(in interface{}) map[string]interface{} {
	out := map[string]interface{}{}

	inType := reflect.TypeOf(in)
	inValue := reflect.ValueOf(in)
	for i := 0; i < inType.NumField(); i++ {
		field := inType.Field(i)
		tag := field.Tag.Get("export")
		fieldValue := inValue.Field(i)
		if tag != "" && tag != "-" && !fieldValue.IsZero() {
			out[tag] = fieldValue.Interface()
		}
	}

	return out
}

func generateChecklistItemExport(checklistItems []ChecklistItem) []interface{} {
	exported := make([]interface{}, 0, len(checklistItems))
	for _, item := range checklistItems {
		exportItem := getFieldsForExport(item)
		exported = append(exported, exportItem)
	}

	return exported
}

func generateChecklistExport(checklists []Checklist) []interface{} {
	exported := make([]interface{}, 0, len(checklists))
	for _, checklist := range checklists {
		exportList := getFieldsForExport(checklist)
		exportList["items"] = generateChecklistItemExport(checklist.Items)
		exported = append(exported, exportList)
	}

	return exported
}

func generateMetricsExport(metrics []PlaybookMetricConfig) []interface{} {
	exported := make([]interface{}, 0, len(metrics))
	for _, checklist := range metrics {
		exportList := getFieldsForExport(checklist)
		exported = append(exported, exportList)
	}

	return exported
}

// GeneratePlaybookExport returns a playbook in export format.
// Fields marked with the stuct tag "export" are included using the given string.
func GeneratePlaybookExport(playbook Playbook) ([]byte, error) {
	export := getFieldsForExport(playbook)
	export["version"] = CurrentPlaybookExportVersion
	export["checklists"] = generateChecklistExport(playbook.Checklists)
	export["metrics"] = generateMetricsExport(playbook.Metrics)

	result, err := json.MarshalIndent(export, "", "    ")
	if err != nil {
		return nil, err
	}

	return result, nil
}
