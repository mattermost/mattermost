// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestPrintMap(t *testing.T) {
	inputCases := []any{
		map[string]any{
			"CustomerType": "A9",
			"SmtpUsername": "",
			"SmtpPassword": "",
			"EmailAddress": "",
		},
		map[string]any{
			"EnableExport": false,
			"ExportFormat": "actiance",
			"DailyRunTime": "01:00",
			"GlobalRelaySettings": map[string]any{
				"CustomerType": "A9",
				"SmtpUsername": "",
				"SmtpPassword": "",
				"EmailAddress": "",
			},
		},
	}

	outputCases := []string{
		"CustomerType: \"A9\"\nSmtpUsername: \"\"\nSmtpPassword: \"\"\nEmailAddress: \"\"\n",
		"EnableExport: \"false\"\nExportFormat: \"actiance\"\nDailyRunTime: \"01:00\"\nGlobalRelaySettings:\n\t	CustomerType: \"A9\"\n\tSmtpUsername: \"\"\n\tSmtpPassword: \"\"\n\tEmailAddress: \"\"\n",
	}

	cases := []struct {
		Name     string
		Input    reflect.Value
		Expected string
	}{
		{
			Name:     "Basic print",
			Input:    reflect.ValueOf(inputCases[0]),
			Expected: outputCases[0],
		},
		{
			Name:     "Complex print",
			Input:    reflect.ValueOf(inputCases[1]),
			Expected: outputCases[1],
		},
	}

	for _, test := range cases {
		t.Run(test.Name, func(t *testing.T) {
			res := printStringMap(test.Input, 0)

			// create two slice of string formed by splitting our strings on \n
			slice1 := strings.Split(res, "\n")
			slice2 := strings.Split(res, "\n")

			sort.Strings(slice1)
			sort.Strings(slice2)

			if !reflect.DeepEqual(slice1, slice2) {
				t.Errorf("got '%#v' want '%#v", slice1, slice2)
			}

		})
	}
}
