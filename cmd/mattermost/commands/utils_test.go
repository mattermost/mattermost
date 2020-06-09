// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestStructToMap(t *testing.T) {
	cases := []struct {
		Name     string
		Input    interface{}
		Expected map[string]interface{}
	}{
		{
			Name: "Struct with one string field",
			Input: struct {
				Test string
			}{
				Test: "test",
			},
			Expected: map[string]interface{}{
				"Test": "test",
			},
		},
		{
			Name: "String with multiple fields of different ",
			Input: struct {
				Test1 string
				Test2 int
				Test3 string
				Test4 bool
			}{
				Test1: "test1",
				Test2: 21,
				Test3: "test2",
				Test4: false,
			},
			Expected: map[string]interface{}{
				"Test1": "test1",
				"Test2": 21,
				"Test3": "test2",
				"Test4": false,
			},
		},
		{
			Name: "Nested fields",
			Input: TestConfig{
				TestServiceSettings{"abc", "def", "ghi"},
				TestTeamSettings{"abc", 1},
				TestClientRequirements{"abc", "def", "ghi"},
				TestMessageExportSettings{true, "abc", TestGlobalRelaySettings{"abc", "def", "ghi"}},
			},
			Expected: map[string]interface{}{
				"TestServiceSettings": map[string]interface{}{
					"Siteurl":               "abc",
					"Websocketurl":          "def",
					"Licensedfieldlocation": "ghi",
				},
				"TestTeamSettings": map[string]interface{}{
					"Sitename":       "abc",
					"Maxuserperteam": 1,
				},
				"TestClientRequirements": map[string]interface{}{
					"Androidlatestversion": "abc",
					"Androidminversion":    "def",
					"Desktoplatestversion": "ghi",
				},
				"TestMessageExportSettings": map[string]interface{}{
					"Enableexport": true,
					"Exportformat": "abc",
					"TestGlobalRelaySettings": map[string]interface{}{
						"Customertype": "abc",
						"Smtpusername": "def",
						"Smtppassword": "ghi",
					},
				},
			},
		},
	}

	for _, test := range cases {
		t.Run(test.Name, func(t *testing.T) {
			res := structToMap(test.Input)

			if !reflect.DeepEqual(res, test.Expected) {
				t.Errorf("got %v want %v ", res, test.Expected)
			}
		})
	}
}

func TestPrintMap(t *testing.T) {
	inputCases := []interface{}{
		map[string]interface{}{
			"CustomerType": "A9",
			"SmtpUsername": "",
			"SmtpPassword": "",
			"EmailAddress": "",
		},
		map[string]interface{}{
			"EnableExport": false,
			"ExportFormat": "actiance",
			"DailyRunTime": "01:00",
			"GlobalRelaySettings": map[string]interface{}{
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
