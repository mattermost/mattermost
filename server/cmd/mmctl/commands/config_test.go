// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

const (
	configFilePayload = "{\"TeamSettings\": {\"SiteName\": \"ADifferentName\"}}"
)

func (s *MmctlUnitTestSuite) TestConfigGetCmd() {
	s.Run("Get a string config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.DriverName"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("postgres", *(printer.GetLines()[0].(*string)))
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get an int config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.MaxIdleConns"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(*(printer.GetLines()[0].(*int)), 20)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get an int64 config value for a given key", func() {
		printer.Clean()
		args := []string{"FileSettings.MaxFileSize"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(int64(100*(1<<20)), *(printer.GetLines()[0].(*int64)))
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get a boolean config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.Trace"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(*(printer.GetLines()[0].(*bool)), false)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get a slice of string config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.DataSourceReplicas"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], []string{})
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get config struct for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()
		sqlSettings := model.SqlSettings{}
		sqlSettings.SetDefaults(false)

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], sqlSettings)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get error if the key doesn't exists", func() {
		printer.Clean()
		args := []string{"SqlSettings.WrongKey"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()
		sqlSettings := model.SqlSettings{}
		sqlSettings.SetDefaults(false)

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should handle the response error", func() {
		printer.Clean()
		args := []string{"SqlSettings.DriverName"}
		outputConfig := &model.Config{}
		outputConfig.SetDefaults()
		sqlSettings := model.SqlSettings{}
		sqlSettings.SetDefaults(false)

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{StatusCode: 500}, errors.New("")).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get value if the key points to a map element", func() {
		outputConfig := &model.Config{}
		pluginState := &model.PluginState{Enable: true}
		pluginSettings := map[string]interface{}{
			"test1": 1,
			"test2": []string{"a", "b"},
			"test3": map[string]string{"a": "b"},
		}
		outputConfig.PluginSettings.PluginStates = map[string]*model.PluginState{
			"com.mattermost.testplugin": pluginState,
		}
		outputConfig.PluginSettings.Plugins = map[string]map[string]interface{}{
			"com.mattermost.testplugin": pluginSettings,
		}

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(7)

		printer.Clean()
		err := configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.PluginStates.com.mattermost.testplugin"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], pluginState)
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], pluginSettings)
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test1"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test2"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], []string{"a", "b"})
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test3"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], map[string]string{"a": "b"})
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configGetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test3.a"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "b")
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get error value if the key points to a missing map element", func() {
		printer.Clean()
		args := []string{"PluginSettings.PluginStates.com.mattermost.testplugin.x"}
		outputConfig := &model.Config{}
		pluginState := &model.PluginState{Enable: true}
		outputConfig.PluginSettings.PluginStates = map[string]*model.PluginState{
			"com.mattermost.testplugin": pluginState,
		}

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(0)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get cloud restricted error value if the path is cloud restricted and value is nil", func() {
		printer.Clean()
		args := []string{"ServiceSettings.EnableDeveloper"}
		outputConfig := &model.Config{}

		s.client.
			EXPECT().
			GetConfig().
			Return(outputConfig, &model.Response{}, nil).
			Times(1)

		err := configGetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestConfigSetCmd() {
	s.Run("Set a string config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.DriverName", "postgres"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := "postgres"
		inputConfig.SqlSettings.DriverName = &changedValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set an int config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.MaxIdleConns", "20"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := 20
		inputConfig.SqlSettings.MaxIdleConns = &changedValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set an int64 config value for a given key", func() {
		printer.Clean()
		args := []string{"FileSettings.MaxFileSize", "52428800"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := int64(52428800)
		inputConfig.FileSettings.MaxFileSize = &changedValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set a boolean config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.Trace", "true"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := true
		inputConfig.SqlSettings.Trace = &changedValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set a slice of string config value for a given key", func() {
		printer.Clean()
		args := []string{"SqlSettings.DataSourceReplicas", "test1", "test2"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		inputConfig.SqlSettings.DataSourceReplicas = []string{"test1", "test2"}

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should get an error if a string is passed while trying to set a slice", func() {
		printer.Clean()
		args := []string{"SqlSettings.DataSourceReplicas", "[\"test1\", \"test2\"]"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		inputConfig.SqlSettings.DataSourceReplicas = []string{"test1", "test2"}

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Get error if the key doesn't exists", func() {
		printer.Clean()
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		args := []string{"SqlSettings.WrongKey", "test1"}
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should handle response error from the server", func() {
		printer.Clean()
		args := []string{"SqlSettings.DriverName", "postgres"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := "postgres"
		inputConfig.SqlSettings.DriverName = &changedValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{StatusCode: 500}, errors.New("")).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set a field inside a map", func() {
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		defaultConfig.PluginSettings.PluginStates = map[string]*model.PluginState{
			"com.mattermost.testplugin": {Enable: false},
		}
		pluginSettings := map[string]interface{}{
			"test1": 1,
			"test2": []string{"a", "b"},
			"test3": map[string]interface{}{"a": "b"},
		}
		defaultConfig.PluginSettings.Plugins = map[string]map[string]interface{}{
			"com.mattermost.testplugin": pluginSettings,
		}

		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		inputConfig.PluginSettings.PluginStates = map[string]*model.PluginState{
			"com.mattermost.testplugin": {Enable: true},
		}
		inputConfig.PluginSettings.Plugins = map[string]map[string]interface{}{
			"com.mattermost.testplugin": pluginSettings,
		}
		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(3)

		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(3)

		printer.Clean()
		err := configSetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.PluginStates.com.mattermost.testplugin.Enable", "true"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configSetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test1", "123"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printer.Clean()
		err = configSetCmdF(s.client, &cobra.Command{}, []string{"PluginSettings.Plugins.com.mattermost.testplugin.test3.a", "123"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to set a field inside a map for incorrect field, get error", func() {
		printer.Clean()
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		defaultConfig.PluginSettings.PluginStates = map[string]*model.PluginState{
			"com.mattermost.testplugin": {Enable: true},
		}
		args := []string{"PluginSettings.PluginStates.com.mattermost.testplugin.x", "true"}

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		err := configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set a config value for a cloud restricted config path", func() {
		printer.Clean()
		args := []string{"ServiceSettings.EnableDeveloper", "true"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		js, err := defaultConfig.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		s.Require().NoError(err)
		defaultConfig = model.ConfigFromJSON(bytes.NewBuffer(js))

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		err = configSetCmdF(s.client, &cobra.Command{}, args)
		s.Require().EqualError(err, fmt.Sprintf("changing this config path: %s is restricted in a cloud environment", "ServiceSettings.EnableDeveloper"))
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestConfigPatchCmd() {
	tmpFile, err := ioutil.TempFile(os.TempDir(), "config_*.json")
	s.Require().Nil(err)

	invalidFile, err := ioutil.TempFile(os.TempDir(), "invalid_config_*.json")
	s.Require().Nil(err)

	_, err = tmpFile.Write([]byte(configFilePayload))
	s.Require().Nil(err)

	defer func() {
		os.Remove(tmpFile.Name())
		os.Remove(invalidFile.Name())
	}()

	s.Run("Patch config with a valid file", func() {
		printer.Clean()
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()
		brandValue := "BrandText"
		defaultConfig.TeamSettings.CustomBrandText = &brandValue

		inputConfig := &model.Config{}
		inputConfig.SetDefaults()
		changedValue := "ADifferentName"
		inputConfig.TeamSettings.SiteName = &changedValue
		inputConfig.TeamSettings.CustomBrandText = &brandValue

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchConfig(inputConfig).
			Return(inputConfig, &model.Response{}, nil).
			Times(1)

		err = configPatchCmdF(s.client, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], inputConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to patch config if file is invalid", func() {
		printer.Clean()
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		err = configPatchCmdF(s.client, &cobra.Command{}, []string{invalidFile.Name()})
		s.Require().NotNil(err)
	})

	s.Run("Fail to patch config if file not found", func() {
		printer.Clean()
		path := "/path/to/nonexistentfile"
		errMsg := "open " + path + ": no such file or directory"

		err = configPatchCmdF(s.client, &cobra.Command{}, []string{path})
		s.Require().NotNil(err)
		s.Require().EqualError(err, errMsg)
	})
}

func (s *MmctlUnitTestSuite) TestConfigResetCmd() {
	s.Run("Reset a single key", func() {
		printer.Clean()
		args := []string{"SqlSettings.DriverName"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			UpdateConfig(defaultConfig).
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		resetCmd := &cobra.Command{}
		resetCmd.Flags().Bool("confirm", true, "")
		err := configResetCmdF(s.client, resetCmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], defaultConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reset a whole config section", func() {
		printer.Clean()
		args := []string{"SqlSettings"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			UpdateConfig(defaultConfig).
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		resetCmd := &cobra.Command{}
		resetCmd.Flags().Bool("confirm", true, "")
		_ = resetCmd.ParseFlags([]string{"confirm"})
		err := configResetCmdF(s.client, resetCmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], defaultConfig)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail if the key doesn't exists", func() {
		printer.Clean()
		args := []string{"WrongKey"}
		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		s.client.
			EXPECT().
			GetConfig().
			Return(defaultConfig, &model.Response{}, nil).
			Times(1)

		resetCmd := &cobra.Command{}
		resetCmd.Flags().Bool("confirm", true, "")
		_ = resetCmd.ParseFlags([]string{"confirm"})
		err := configResetCmdF(s.client, resetCmd, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestConfigShowCmd() {
	s.Run("Should show config", func() {
		printer.Clean()
		mockConfig := &model.Config{}

		s.client.
			EXPECT().
			GetConfig().
			Return(mockConfig, &model.Response{}, nil).
			Times(1)

		err := configShowCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(mockConfig, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should return an error", func() {
		printer.Clean()
		configError := errors.New("config error")

		s.client.
			EXPECT().
			GetConfig().
			Return(nil, &model.Response{}, configError).
			Times(1)

		err := configShowCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.EqualError(err, configError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestConfigReloadCmd() {
	s.Run("Should reload config", func() {
		printer.Clean()

		s.client.
			EXPECT().
			ReloadConfig().
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := configReloadCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail on error when reload config", func() {
		printer.Clean()

		s.client.
			EXPECT().
			ReloadConfig().
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("some-error")).
			Times(1)

		err := configReloadCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
	})
}

func (s *MmctlUnitTestSuite) TestConfigMigrateCmd() {
	s.Run("Should fail without the --local flag", func() {
		printer.Clean()
		args := []string{"from", "to"}

		err := configMigrateCmdF(s.client, &cobra.Command{}, args)
		s.Require().Error(err)
	})

	s.Run("Should be able to migrate config", func() {
		printer.Clean()
		args := []string{"from", "to"}

		s.client.
			EXPECT().
			MigrateConfig(args[0], args[1]).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("local", true, "")

		err := configMigrateCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail on error when migrating config", func() {
		printer.Clean()
		args := []string{"from", "to"}

		s.client.
			EXPECT().
			MigrateConfig(args[0], args[1]).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("some-error")).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("local", true, "")

		err := configMigrateCmdF(s.client, cmd, args)
		s.Require().NotNil(err)
	})
}

func TestCloudRestricted(t *testing.T) {
	cfg := &model.Config{
		ServiceSettings: model.ServiceSettings{
			GoogleDeveloperKey: model.NewString("test"),
			SiteURL:            model.NewString("test"),
		},
	}

	t.Run("Should return true if the config is cloud restricted", func(t *testing.T) {
		path := "ServiceSettings.GoogleDeveloperKey"

		require.True(t, cloudRestricted(cfg, parseConfigPath(path)))
	})

	t.Run("Should return false if the config is not cloud restricted", func(t *testing.T) {
		path := "ServiceSettings.SiteURL"

		require.False(t, cloudRestricted(cfg, parseConfigPath(path)))
	})

	t.Run("Should return false if the config is not cloud restricted and the path is not found", func(t *testing.T) {
		path := "ServiceSettings.Unknown"

		require.False(t, cloudRestricted(cfg, parseConfigPath(path)))
	})

	t.Run("Should return true if the config is cloud restricted and the value is not found", func(t *testing.T) {
		path := "ServiceSettings.EnableDeveloper"

		require.True(t, cloudRestricted(cfg, parseConfigPath(path)))
	})
}
