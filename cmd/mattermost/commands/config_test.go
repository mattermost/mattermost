// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

type TestConfig struct {
	TestServiceSettings       TestServiceSettings
	TestTeamSettings          TestTeamSettings
	TestClientRequirements    TestClientRequirements
	TestMessageExportSettings TestMessageExportSettings
}

type TestMessageExportSettings struct {
	Enableexport            bool
	Exportformat            string
	TestGlobalRelaySettings TestGlobalRelaySettings
}

type TestGlobalRelaySettings struct {
	Customertype string
	Smtpusername string
	Smtppassword string
}

type TestServiceSettings struct {
	Siteurl               string
	Websocketurl          string
	Licensedfieldlocation string
}

type TestTeamSettings struct {
	Sitename       string
	Maxuserperteam int
}

type TestClientRequirements struct {
	Androidlatestversion string
	Androidminversion    string
	Desktoplatestversion string
}

func TestConfigValidate(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	path := filepath.Join(dir, "config.json")
	config := &model.Config{}
	config.SetDefaults()
	require.NoError(t, ioutil.WriteFile(path, []byte(config.ToJson()), 0600))

	assert.Error(t, RunCommand(t, "--config", "foo.json", "config", "validate"))
	assert.NoError(t, RunCommand(t, "--config", path, "config", "validate"))
}

func TestConfigGet(t *testing.T) {
	// Error when no arguments are given
	assert.Error(t, RunCommand(t, "config", "get"))

	// Error when more than one config settings are given
	assert.Error(t, RunCommand(t, "config", "get", "abc", "def"))

	// Error when a config setting which is not in the config.json is given
	assert.Error(t, RunCommand(t, "config", "get", "abc"))

	// No Error when a config setting which is  in the config.json is given
	assert.NoError(t, RunCommand(t, "config", "get", "MessageExportSettings"))
	assert.NoError(t, RunCommand(t, "config", "get", "MessageExportSettings.GlobalRelaySettings"))
	assert.NoError(t, RunCommand(t, "config", "get", "MessageExportSettings.GlobalRelaySettings.CustomerType"))

	// check output
	output := CheckCommand(t, "config", "get", "MessageExportSettings")

	assert.Contains(t, string(output), "EnableExport")
	assert.Contains(t, string(output), "ExportFormat")
	assert.Contains(t, string(output), "DailyRunTime")
	assert.Contains(t, string(output), "ExportFromTimestamp")
}

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

func TestConfigToMap(t *testing.T) {
	// This test is almost the same as TestMapToStruct, but I have it here for the sake of completions
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
			res := configToMap(test.Input)

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
			res := printMap(test.Input, 0)

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

func TestPrintConfigValues(t *testing.T) {

	outputs := []string{
		"Siteurl: \"abc\"\nWebsocketurl: \"def\"\nLicensedfieldlocation: \"ghi\"\n",
		"Sitename: \"abc\"\nMaxuserperteam: \"1\"\n",
		"Androidlatestversion: \"abc\"\nAndroidminversion: \"def\"\nDesktoplatestversion: \"ghi\"\n",
		"Enableexport: \"true\"\nExportformat: \"abc\"\nTestGlobalRelaySettings:\n\tCustomertype: \"abc\"\n\tSmtpusername: \"def\"\n\tSmtppassword: \"ghi\"\n",
		"Customertype: \"abc\"\nSmtpusername: \"def\"\nSmtppassword: \"ghi\"\n",
	}

	commands := []string{
		"TestServiceSettings",
		"TestTeamSettings",
		"TestClientRequirements",
		"TestMessageExportSettings",
		"TestMessageExportSettings.TestGlobalRelaySettings",
	}

	input := TestConfig{
		TestServiceSettings{"abc", "def", "ghi"},
		TestTeamSettings{"abc", 1},
		TestClientRequirements{"abc", "def", "ghi"},
		TestMessageExportSettings{true, "abc", TestGlobalRelaySettings{"abc", "def", "ghi"}},
	}

	configMap := structToMap(input)

	cases := []struct {
		Name     string
		Command  string
		Expected string
	}{
		{
			Name:     "First test",
			Command:  commands[0],
			Expected: outputs[0],
		},
		{
			Name:     "Second test",
			Command:  commands[1],
			Expected: outputs[1],
		},
		{
			Name:     "third test",
			Command:  commands[2],
			Expected: outputs[2],
		},
		{
			Name:     "fourth test",
			Command:  commands[3],
			Expected: outputs[3],
		},
		{
			Name:     "fifth test",
			Command:  commands[4],
			Expected: outputs[4],
		},
	}

	for _, test := range cases {
		t.Run(test.Name, func(t *testing.T) {
			res, _ := printConfigValues(configMap, strings.Split(test.Command, "."), test.Command)

			// create two slice of string formed by splitting our strings on \n
			slice1 := strings.Split(res, "\n")
			slice2 := strings.Split(test.Expected, "\n")

			sort.Strings(slice1)
			sort.Strings(slice2)

			if !reflect.DeepEqual(slice1, slice2) {
				t.Errorf("got '%#v' want '%#v", slice1, slice2)
			}
		})
	}

}
