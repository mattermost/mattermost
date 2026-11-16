// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"go.uber.org/mock/gomock"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestPluginAddCmd() {
	s.Run("Add 1 plugin", func() {
		printer.Clean()
		tmpFile, err := os.CreateTemp("", "tmpPlugin")
		s.Require().Nil(err)
		defer os.Remove(tmpFile.Name())

		pluginName := tmpFile.Name()

		s.client.
			EXPECT().
			UploadPlugin(context.TODO(), gomock.AssignableToTypeOf(tmpFile)).
			Return(&model.Manifest{}, &model.Response{}, nil).
			Times(1)

		err = pluginAddCmdF(s.client, &cobra.Command{}, []string{pluginName})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Added plugin: "+pluginName)
	})

	s.Run("Add 1 plugin, with force active", func() {
		printer.Clean()
		tmpFile, err := os.CreateTemp("", "tmpPlugin")
		s.Require().Nil(err)
		defer os.Remove(tmpFile.Name())

		pluginName := tmpFile.Name()

		s.client.
			EXPECT().
			UploadPluginForced(context.TODO(), gomock.AssignableToTypeOf(tmpFile)).
			Return(&model.Manifest{}, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")

		err = pluginAddCmdF(s.client, cmd, []string{pluginName})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Added plugin: "+pluginName)
	})

	s.Run("Add 1 plugin no file", func() {
		printer.Clean()
		err := pluginAddCmdF(s.client, &cobra.Command{}, []string{"non_existent_plugin"})
		s.Require().NotNil(err)
		s.Require().True(err.Error() == "open non_existent_plugin: no such file or directory" || err.Error() == "open non_existent_plugin: The system cannot find the file specified.")
	})

	s.Run("Add 1 plugin with error", func() {
		printer.Clean()
		tmpFile, err := os.CreateTemp("", "tmpPlugin")
		s.Require().Nil(err)
		defer os.Remove(tmpFile.Name())

		pluginName := tmpFile.Name()
		mockError := errors.New("plugin add error")

		s.client.
			EXPECT().
			UploadPlugin(context.TODO(), gomock.AssignableToTypeOf(tmpFile)).
			Return(&model.Manifest{}, &model.Response{}, mockError).
			Times(1)

		err = pluginAddCmdF(s.client, &cobra.Command{}, []string{pluginName})
		s.Require().ErrorContains(err, "plugin add error")
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to add plugin: "+pluginName+". Error: "+mockError.Error())
	})

	s.Run("Add several plugins with some error", func() {
		printer.Clean()
		args := []string{"fail", "ok", "fail"}
		mockError := errors.New("plugin add error")

		for idx, arg := range args {
			tmpFile, err := os.CreateTemp("", "tmpPlugin")
			s.Require().Nil(err)
			defer os.Remove(tmpFile.Name())
			if arg == "fail" {
				s.client.
					EXPECT().
					UploadPlugin(context.TODO(), gomock.AssignableToTypeOf(tmpFile)).
					Return(nil, &model.Response{}, mockError).
					Times(1)
			} else {
				s.client.
					EXPECT().
					UploadPlugin(context.TODO(), gomock.AssignableToTypeOf(tmpFile)).
					Return(&model.Manifest{}, &model.Response{}, nil).
					Times(1)
			}
			args[idx] = tmpFile.Name()
		}

		err := pluginAddCmdF(s.client, &cobra.Command{}, args)
		s.Require().ErrorContains(err, "plugin add error")
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Added plugin: "+args[1])
		s.Require().Len(printer.GetErrorLines(), 2)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to add plugin: "+args[0]+". Error: "+mockError.Error())
		s.Require().Equal(printer.GetErrorLines()[1], "Unable to add plugin: "+args[2]+". Error: "+mockError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestPluginInstallUrlCmd() {
	s.Run("Install multiple plugins", func() {
		printer.Clean()

		pluginURL1 := "https://example.com/plugin1.tar.gz"
		pluginURL2 := "https://example.com/plugin2.tar.gz"
		manifest1 := &model.Manifest{Name: "plugin one"}
		manifest2 := &model.Manifest{Name: "plugin two"}
		args := []string{pluginURL1, pluginURL2}

		s.client.
			EXPECT().
			InstallPluginFromURL(context.TODO(), pluginURL1, false).
			Return(manifest1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			InstallPluginFromURL(context.TODO(), pluginURL2, false).
			Return(manifest2, &model.Response{}, nil).
			Times(1)

		err := pluginInstallURLCmdF(s.client, &cobra.Command{}, args)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(manifest1, printer.GetLines()[0])
		s.Require().Equal(manifest2, printer.GetLines()[1])
	})

	s.Run("Install one plugin, with force active", func() {
		printer.Clean()

		pluginURL := "https://example.com/plugin.tar.gz"
		manifest := &model.Manifest{Name: "plugin name"}

		s.client.
			EXPECT().
			InstallPluginFromURL(context.TODO(), pluginURL, true).
			Return(manifest, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")

		err := pluginInstallURLCmdF(s.client, cmd, []string{pluginURL})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(manifest, printer.GetLines()[0])
	})

	s.Run("Install multiple plugins, some failing", func() {
		printer.Clean()

		pluginURL1 := "https://example.com/plugin1.tar.gz"
		pluginURL2 := "https://example.com/plugin2.tar.gz"
		manifest1 := &model.Manifest{Name: "plugin one"}
		args := []string{pluginURL1, pluginURL2}

		s.client.
			EXPECT().
			InstallPluginFromURL(context.TODO(), pluginURL1, false).
			Return(manifest1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			InstallPluginFromURL(context.TODO(), pluginURL2, false).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := pluginInstallURLCmdF(s.client, &cobra.Command{}, args)
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to install plugin from URL \"https://example.com/plugin2.tar.gz\". Error: mock error", printer.GetErrorLines()[0])
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(manifest1, printer.GetLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestPluginDisableCmd() {
	s.Run("Disable 1 plugin", func() {
		printer.Clean()
		arg := "plug1"

		s.client.
			EXPECT().
			DisablePlugin(context.TODO(), arg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := pluginDisableCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Disabled plugin: "+arg)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to disable 1 plugin", func() {
		printer.Clean()
		arg := "fail1"
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			DisablePlugin(context.TODO(), arg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := pluginDisableCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to disable plugin: "+arg+". Error: "+mockError.Error())
	})

	s.Run("Disble several plugin with some errors", func() {
		printer.Clean()
		args := []string{"fail1", "plug2", "plug3", "fail4"}
		mockError := errors.New("mock error")

		for _, arg := range args {
			if strings.HasPrefix(arg, "fail") {
				s.client.
					EXPECT().
					DisablePlugin(context.TODO(), arg).
					Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
					Times(1)
			} else {
				s.client.
					EXPECT().
					DisablePlugin(context.TODO(), arg).
					Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
					Times(1)
			}
		}

		err := pluginDisableCmdF(s.client, &cobra.Command{}, args)
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Disabled plugin: "+args[1])
		s.Require().Equal(printer.GetLines()[1], "Disabled plugin: "+args[2])
		s.Require().Len(printer.GetErrorLines(), 2)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to disable plugin: "+args[0]+". Error: "+mockError.Error())
		s.Require().Equal(printer.GetErrorLines()[1], "Unable to disable plugin: "+args[3]+". Error: "+mockError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestPluginEnableCmd() {
	s.Run("Enable 1 plugin", func() {
		printer.Clean()
		pluginArg := "test-plugin"

		s.client.
			EXPECT().
			EnablePlugin(context.TODO(), pluginArg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := pluginEnableCmdF(s.client, &cobra.Command{}, []string{pluginArg})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Enabled plugin: "+pluginArg)
	})

	s.Run("Enable multiple plugins", func() {
		printer.Clean()
		plugins := []string{"plugin1", "plugin2", "plugin3"}

		for _, plugin := range plugins {
			s.client.
				EXPECT().
				EnablePlugin(context.TODO(), plugin).
				Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
				Times(1)
		}

		err := pluginEnableCmdF(s.client, &cobra.Command{}, plugins)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 3)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "Enabled plugin: "+plugins[0])
		s.Require().Equal(printer.GetLines()[1], "Enabled plugin: "+plugins[1])
		s.Require().Equal(printer.GetLines()[2], "Enabled plugin: "+plugins[2])
	})

	s.Run("Fail to enable plugin", func() {
		printer.Clean()
		pluginArg := "fail-plugin"
		mockErr := errors.New("mock error")

		s.client.
			EXPECT().
			EnablePlugin(context.TODO(), pluginArg).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErr).
			Times(1)

		err := pluginEnableCmdF(s.client, &cobra.Command{}, []string{pluginArg})
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to enable plugin: "+pluginArg+". Error: "+mockErr.Error())
	})

	s.Run("Enable multiple plugins with some having errors", func() {
		printer.Clean()
		okPlugins := []string{"ok-plugin-1", "ok-plugin-2"}
		failPlugins := []string{"fail-plugin-1", "fail-plugin-2"}
		allPlugins := okPlugins
		allPlugins = append(allPlugins, failPlugins...)

		mockErr := errors.New("mock error")

		for _, plugin := range okPlugins {
			s.client.
				EXPECT().
				EnablePlugin(context.TODO(), plugin).
				Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
				Times(1)
		}

		for _, plugin := range failPlugins {
			s.client.
				EXPECT().
				EnablePlugin(context.TODO(), plugin).
				Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErr).
				Times(1)
		}

		err := pluginEnableCmdF(s.client, &cobra.Command{}, allPlugins)
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Enabled plugin: "+okPlugins[0])
		s.Require().Equal(printer.GetLines()[1], "Enabled plugin: "+okPlugins[1])
		s.Require().Len(printer.GetErrorLines(), 2)
		s.Require().Equal(printer.GetErrorLines()[0], "Unable to enable plugin: "+failPlugins[0]+". Error: "+mockErr.Error())
		s.Require().Equal(printer.GetErrorLines()[1], "Unable to enable plugin: "+failPlugins[1]+". Error: "+mockErr.Error())
	})
}

func (s *MmctlUnitTestSuite) TestPluginListCmd() {
	s.Run("List JSON plugins", func() {
		printer.Clean()
		mockList := &model.PluginsResponse{
			Active: []*model.PluginInfo{
				{
					Manifest: model.Manifest{
						Id:      "id1",
						Name:    "name1",
						Version: "v1",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id2",
						Name:    "name2",
						Version: "v2",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id3",
						Name:    "name3",
						Version: "v3",
					},
				},
			}, Inactive: []*model.PluginInfo{
				{
					Manifest: model.Manifest{
						Id:      "id4",
						Name:    "name4",
						Version: "v4",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id5",
						Name:    "name5",
						Version: "v5",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id6",
						Name:    "name6",
						Version: "v6",
					},
				},
			},
		}

		s.client.
			EXPECT().
			GetPlugins(context.TODO()).
			Return(mockList, &model.Response{}, nil).
			Times(1)

		err := pluginListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 9)

		s.Require().Equal("Listing enabled plugins", printer.GetLines()[0])
		for i, plugin := range mockList.Active {
			s.Require().Equal(plugin, printer.GetLines()[i+1])
		}

		s.Require().Equal("", printer.GetLines()[4])
		s.Require().Equal("Listing disabled plugins", printer.GetLines()[5])
		for i, plugin := range mockList.Inactive {
			s.Require().Equal(plugin, printer.GetLines()[i+6])
		}
	})

	s.Run("List Plain Plugins", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		defer printer.SetFormat(printer.FormatJSON)

		mockList := &model.PluginsResponse{
			Active: []*model.PluginInfo{
				{
					Manifest: model.Manifest{
						Id:      "id1",
						Name:    "name1",
						Version: "v1",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id2",
						Name:    "name2",
						Version: "v2",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id3",
						Name:    "name3",
						Version: "v3",
					},
				},
			}, Inactive: []*model.PluginInfo{
				{
					Manifest: model.Manifest{
						Id:      "id4",
						Name:    "name4",
						Version: "v4",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id5",
						Name:    "name5",
						Version: "v5",
					},
				},
				{
					Manifest: model.Manifest{
						Id:      "id6",
						Name:    "name6",
						Version: "v6",
					},
				},
			},
		}

		s.client.
			EXPECT().
			GetPlugins(context.TODO()).
			Return(mockList, &model.Response{}, nil).
			Times(1)

		err := pluginListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 9)

		s.Require().Equal("Listing enabled plugins", printer.GetLines()[0])
		for i, plugin := range mockList.Active {
			s.Require().Equal(plugin.Id+": "+plugin.Name+", Version: "+plugin.Version, printer.GetLines()[i+1])
		}

		s.Require().Equal("", printer.GetLines()[4])
		s.Require().Equal("Listing disabled plugins", printer.GetLines()[5])
		for i, plugin := range mockList.Inactive {
			s.Require().Equal(plugin.Id+": "+plugin.Name+", Version: "+plugin.Version, printer.GetLines()[i+6])
		}
	})

	s.Run("GetPlugins returns error", func() {
		printer.Clean()
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetPlugins(context.TODO()).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := pluginListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().EqualError(err, "Unable to list plugins. Error: "+mockError.Error())
	})
}

func (s *MmctlUnitTestSuite) TestPluginDeleteCmd() {
	s.Run("Delete one plugin with error", func() {
		printer.Clean()
		args := "plugin"
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := pluginDeleteCmdF(s.client, &cobra.Command{}, []string{args})
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to delete plugin: "+args+". Error: "+mockError.Error(), printer.GetErrorLines()[0])
	})

	s.Run("Delete one plugin with no error", func() {
		printer.Clean()
		args := "plugin"

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := pluginDeleteCmdF(s.client, &cobra.Command{}, []string{args})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("Deleted plugin: "+args, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Delete several plugins", func() {
		printer.Clean()
		args := []string{
			"plugin0",
			"error1",
			"error2",
			"plugin3",
		}
		mockErrors := []error{
			errors.New("mock error1"),
			errors.New("mock error2"),
		}

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args[0]).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args[1]).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErrors[0]).
			Times(1)

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args[2]).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErrors[1]).
			Times(1)

		s.client.
			EXPECT().
			RemovePlugin(context.TODO(), args[3]).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := pluginDeleteCmdF(s.client, &cobra.Command{}, args)
		s.Require().ErrorContains(err, "mock error")
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal("Deleted plugin: "+args[0], printer.GetLines()[0])
		s.Require().Equal("Deleted plugin: "+args[3], printer.GetLines()[1])
		s.Require().Len(printer.GetErrorLines(), 2)
		s.Require().Equal("Unable to delete plugin: "+args[1]+". Error: "+mockErrors[0].Error(), printer.GetErrorLines()[0])
		s.Require().Equal("Unable to delete plugin: "+args[2]+". Error: "+mockErrors[1].Error(), printer.GetErrorLines()[1])
	})
}

func (s *MmctlUnitTestSuite) TestPluginPublicKeysCmd() {
	s.Run("List public key names", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetPluginPublicKeys(context.TODO()).
			Return([]string{"key1.asc", "key2.gpg"}, &model.Response{}, nil).
			Times(1)

		err := pluginPublicKeysCmdF(s.client, newTestCmd(s.T(), PluginPublicKeysCmd), []string{})
		s.Require().NoError(err)
		s.Require().Equal([]any{"key1.asc", "key2.gpg"}, printer.GetLines())
	})

	s.Run("List public keys verbosely", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetPluginPublicKeys(context.TODO()).
			Return([]string{"key1.asc", "key2.gpg"}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetPluginPublicKey(context.TODO(), "key1.asc").
			Return([]byte("key one"), &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetPluginPublicKey(context.TODO(), "key2.gpg").
			Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, errors.New("mock error")).
			Times(1)

		cmd := newTestCmd(s.T(), PluginPublicKeysCmd)
		s.Require().NoError(cmd.Flags().Set("verbose", "true"))

		err := pluginPublicKeysCmdF(s.client, cmd, []string{})
		s.Require().Error(err)
		s.Require().Equal([]any{"Plugin public key: key1.asc\nkey one"}, printer.GetLines())
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(`Unable to get plugin public key "key2.gpg". Error: mock error`, printer.GetErrorLines()[0])
	})

	s.Run("Fail to list public keys", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetPluginPublicKeys(context.TODO()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("mock error")).
			Times(1)

		err := pluginPublicKeysCmdF(s.client, newTestCmd(s.T(), PluginPublicKeysCmd), []string{})
		s.Require().EqualError(err, "unable to list plugin public keys: mock error")
		s.Require().Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) TestPluginAddPublicKeyCmd() {
	s.Run("Add public keys named after their file", func() {
		printer.Clean()
		dir := s.T().TempDir()
		path1 := filepath.Join(dir, "key1.asc")
		path2 := filepath.Join(dir, "key2.gpg")
		s.Require().NoError(os.WriteFile(path1, []byte("key one"), 0600))
		s.Require().NoError(os.WriteFile(path2, []byte("key two"), 0600))

		s.client.
			EXPECT().
			AddPluginPublicKey(context.TODO(), "key1.asc", gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusCreated}, nil).
			Times(1)
		s.client.
			EXPECT().
			AddPluginPublicKey(context.TODO(), "key2.gpg", gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := pluginAddPublicKeyCmdF(s.client, &cobra.Command{}, []string{path1, path2})
		s.Require().Error(err)
		s.Require().Equal([]any{"Added plugin public key: key1.asc"}, printer.GetLines())
		s.Require().Equal([]string{fmt.Sprintf("Unable to add plugin public key %q. Error: mock error", path2)}, printer.GetErrorLines())
	})

	s.Run("Fail to open a key file", func() {
		printer.Clean()
		path := filepath.Join(s.T().TempDir(), "missing.asc")

		err := pluginAddPublicKeyCmdF(s.client, &cobra.Command{}, []string{path})
		s.Require().Error(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Len(printer.GetErrorLines(), 1)
	})
}

func (s *MmctlUnitTestSuite) TestPluginDeletePublicKeyCmd() {
	s.Run("Delete public keys", func() {
		printer.Clean()
		s.client.
			EXPECT().
			DeletePluginPublicKey(context.TODO(), "key1.asc").
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		s.client.
			EXPECT().
			DeletePluginPublicKey(context.TODO(), "key2.gpg").
			Return(&model.Response{StatusCode: http.StatusNotFound}, errors.New("mock error")).
			Times(1)

		err := pluginDeletePublicKeyCmdF(s.client, &cobra.Command{}, []string{"key1.asc", "key2.gpg"})
		s.Require().Error(err)
		s.Require().Equal([]any{"Deleted plugin public key: key1.asc"}, printer.GetLines())
		s.Require().Equal([]string{`Unable to delete plugin public key "key2.gpg". Error: mock error`}, printer.GetErrorLines())
	})
}
