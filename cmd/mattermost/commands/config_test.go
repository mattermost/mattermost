// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"io/ioutil"
	"os"
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

type TestNewConfig struct {
	TestNewServiceSettings TestNewServiceSettings
	TestNewTeamSettings    TestNewTeamSettings
}

type TestNewServiceSettings struct {
	SiteUrl                  *string
	UseLetsEncrypt           *bool
	TLSStrictTransportMaxAge *int64
	AllowedThemes            []string
}

type TestNewTeamSettings struct {
	SiteName       *string
	MaxUserPerTeam *int
}

func TestConfigValidate(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	tempFile, err := ioutil.TempFile("", "TestConfigValidate")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())

	assert.Error(t, th.RunCommand(t, "--config", tempFile.Name(), "config", "validate"))
	th.CheckCommand(t, "config", "validate")
}

func TestConfigGet(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	t.Run("Error when no arguments are given", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "get"))
	})

	t.Run("Error when more than one config settings are given", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "get", "abc", "def"))
	})

	t.Run("Error when a config setting which is not in the config.json is given", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "get", "abc"))
	})

	t.Run("No Error when a config setting which is in the config.json is given", func(t *testing.T) {
		th.CheckCommand(t, "config", "get", "MessageExportSettings")
		th.CheckCommand(t, "config", "get", "MessageExportSettings.GlobalRelaySettings")
		th.CheckCommand(t, "config", "get", "MessageExportSettings.GlobalRelaySettings.CustomerType")
	})

	t.Run("check output", func(t *testing.T) {
		output := th.CheckCommand(t, "config", "get", "MessageExportSettings")

		assert.Contains(t, string(output), "EnableExport")
		assert.Contains(t, string(output), "ExportFormat")
		assert.Contains(t, string(output), "DailyRunTime")
		assert.Contains(t, string(output), "ExportFromTimestamp")
	})
}

func TestConfigSet(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	t.Run("Error when no arguments are given", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "set"))
	})

	t.Run("Error when only one argument is given", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "set", "test"))
	})

	t.Run("Error when the wrong key is set", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "set", "invalid-key", "value"))
		assert.Error(t, th.RunCommand(t, "config", "get", "invalid-key"))
	})

	t.Run("Error when the wrong value is set", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "set", "EmailSettings.ConnectionSecurity", "invalid"))
		output := th.CheckCommand(t, "config", "get", "EmailSettings.ConnectionSecurity")
		assert.NotContains(t, string(output), "invalid")
	})

	t.Run("Error when the wrong locale is set", func(t *testing.T) {
		th.CheckCommand(t, "config", "set", "LocalizationSettings.DefaultServerLocale", "es")
		assert.Error(t, th.RunCommand(t, "config", "set", "LocalizationSettings.DefaultServerLocale", "invalid"))
		output := th.CheckCommand(t, "config", "get", "LocalizationSettings.DefaultServerLocale")
		assert.NotContains(t, string(output), "invalid")
		assert.NotContains(t, string(output), "\"en\"")
	})

	t.Run("Success when a valid value is set", func(t *testing.T) {
		assert.NoError(t, th.RunCommand(t, "config", "set", "EmailSettings.ConnectionSecurity", "TLS"))
		output := th.CheckCommand(t, "config", "get", "EmailSettings.ConnectionSecurity")
		assert.Contains(t, string(output), "TLS")
	})

	t.Run("Success when a valid locale is set", func(t *testing.T) {
		assert.NoError(t, th.RunCommand(t, "config", "set", "LocalizationSettings.DefaultServerLocale", "es"))
		output := th.CheckCommand(t, "config", "get", "LocalizationSettings.DefaultServerLocale")
		assert.Contains(t, string(output), "\"es\"")
	})
}

func TestConfigToMap(t *testing.T) {
	// This test is almost the same as TestStructToMap, but I have it here for the sake of completions
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

func TestConfigShow(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	t.Run("error with unknown subcommand", func(t *testing.T) {
		assert.Error(t, th.RunCommand(t, "config", "show", "abc"))
	})

	t.Run("successfully dumping config", func(t *testing.T) {
		output := th.CheckCommand(t, "config", "show")
		assert.Contains(t, string(output), "SqlSettings")
		assert.Contains(t, string(output), "MessageExportSettings")
		assert.Contains(t, string(output), "AnnouncementSettings")
	})
}

func TestSetConfig(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Error when no argument is given
	assert.Error(t, th.RunCommand(t, "config", "set"))

	// No Error when more than one argument is given
	th.CheckCommand(t, "config", "set", "ThemeSettings.AllowedThemes", "hello", "World")

	// No Error when two arguments are given
	th.CheckCommand(t, "config", "set", "ThemeSettings.AllowedThemes", "hello")

	// Error when only one argument is given
	assert.Error(t, th.RunCommand(t, "config", "set", "ThemeSettings.AllowedThemes"))

	// Error when config settings not in the config file are given
	assert.Error(t, th.RunCommand(t, "config", "set", "Abc"))
}

func TestUpdateMap(t *testing.T) {
	// create a config to make changes
	config := TestNewConfig{
		TestNewServiceSettings{
			SiteUrl:                  model.NewString("abc.def"),
			UseLetsEncrypt:           model.NewBool(false),
			TLSStrictTransportMaxAge: model.NewInt64(36),
			AllowedThemes:            []string{"Hello", "World"},
		},
		TestNewTeamSettings{
			SiteName:       model.NewString("def.ghi"),
			MaxUserPerTeam: model.NewInt(12),
		},
	}

	// create a map of type map[string]interface
	configMap := configToMap(config)

	cases := []struct {
		Name           string
		configSettings []string
		newVal         []string
		expected       interface{}
	}{
		{
			Name:           "check for Map and string",
			configSettings: []string{"TestNewServiceSettings", "SiteUrl"},
			newVal:         []string{"siteurl"},
			expected:       "siteurl",
		},
		{
			Name:           "check for Map and bool",
			configSettings: []string{"TestNewServiceSettings", "UseLetsEncrypt"},
			newVal:         []string{"true"},
			expected:       true,
		},
		{
			Name:           "check for Map and int64",
			configSettings: []string{"TestNewServiceSettings", "TLSStrictTransportMaxAge"},
			newVal:         []string{"56"},
			expected:       int64(56),
		},
		{
			Name:           "check for Map and string Slice",
			configSettings: []string{"TestNewServiceSettings", "AllowedThemes"},
			newVal:         []string{"hello1", "world1"},
			expected:       []string{"hello1", "world1"},
		},
		{
			Name:           "Map and string",
			configSettings: []string{"TestNewTeamSettings", "SiteName"},
			newVal:         []string{"jkl.mno"},
			expected:       "jkl.mno",
		},
		{
			Name:           "Map and int",
			configSettings: []string{"TestNewTeamSettings", "MaxUserPerTeam"},
			newVal:         []string{"18"},
			expected:       18,
		},
	}

	for _, test := range cases {

		t.Run(test.Name, func(t *testing.T) {
			err := UpdateMap(configMap, test.configSettings, test.newVal)

			if err != nil {
				t.Fatal("Wasn't expecting an error: ", err)
			}

			if !contains(configMap, test.expected, test.configSettings) {
				t.Error("update didn't happen")
			}

		})
	}

}

func contains(configMap map[string]interface{}, v interface{}, configSettings []string) bool {
	res := configMap[configSettings[0]]

	value := reflect.ValueOf(res)

	switch value.Kind() {
	case reflect.Map:
		return contains(res.(map[string]interface{}), v, configSettings[1:])
	case reflect.Slice:
		return reflect.DeepEqual(value.Interface(), v)
	case reflect.Int64:
		return value.Interface() == v.(int64)
	default:
		return value.Interface() == v
	}
}
