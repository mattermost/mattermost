// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost-server/v6/channels/config"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) GenerateSupportPacket() []model.FileData {
	// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
	var warnings []string

	// Creating an array of files that we are going to be adding to our zip file
	fileDatas := []model.FileData{}

	// A array of the functions that we can iterate through since they all have the same return value
	functions := []func() (*model.FileData, string){
		a.generateSupportPacketYaml,
		a.createPluginsFile,
		a.createSanitizedConfigFile,
		a.getMattermostLog,
		a.getNotificationsLog,
	}

	for _, fn := range functions {
		fileData, warning := fn()

		if fileData != nil {
			fileDatas = append(fileDatas, *fileData)
		} else {
			warnings = append(warnings, warning)
		}
	}

	// Adding a warning.txt file to the fileDatas if any warning
	if len(warnings) > 0 {
		finalWarning := strings.Join(warnings, "\n")
		fileDatas = append(fileDatas, model.FileData{
			Filename: "warning.txt",
			Body:     []byte(finalWarning),
		})
	}

	return fileDatas
}

func (a *App) generateSupportPacketYaml() (*model.FileData, string) {
	// Here we are getting information regarding Elastic Search
	var elasticServerVersion string
	var elasticServerPlugins []string
	if a.Srv().Platform().SearchEngine.ElasticsearchEngine != nil {
		elasticServerVersion = a.Srv().Platform().SearchEngine.ElasticsearchEngine.GetFullVersion()
		elasticServerPlugins = a.Srv().Platform().SearchEngine.ElasticsearchEngine.GetPlugins()
	}

	// Here we are getting information regarding LDAP
	ldapInterface := a.ch.Ldap
	var vendorName, vendorVersion string
	if ldapInterface != nil {
		vendorName, vendorVersion = ldapInterface.GetVendorNameAndVendorVersion()
	}

	// Here we are getting information regarding the database (mysql/postgres + current schema version)
	databaseType, databaseVersion := a.Srv().DatabaseTypeAndSchemaVersion()

	uniqueUserCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, errors.Wrap(err, "error while getting user count").Error()
	}

	supportedUsers := 0
	if license := a.Srv().License(); license != nil {
		supportedUsers = *license.Features.Users
	}

	// Creating the struct for support packet yaml file
	supportPacket := model.SupportPacket{
		ServerOS:              runtime.GOOS,
		ServerArchitecture:    runtime.GOARCH,
		ServerVersion:         model.CurrentVersion,
		BuildHash:             model.BuildHash,
		DatabaseType:          databaseType,
		DatabaseVersion:       databaseVersion,
		LdapVendorName:        vendorName,
		LdapVendorVersion:     vendorVersion,
		ElasticServerVersion:  elasticServerVersion,
		ElasticServerPlugins:  elasticServerPlugins,
		ActiveUsers:           int(uniqueUserCount),
		LicenseSupportedUsers: supportedUsers,
	}

	// Marshal to a Yaml File
	supportPacketYaml, err := yaml.Marshal(&supportPacket)
	if err == nil {
		fileData := model.FileData{
			Filename: "support_packet.yaml",
			Body:     supportPacketYaml,
		}
		return &fileData, ""
	}

	warning := fmt.Sprintf("yaml.Marshal(&supportPacket) Error: %s", err.Error())
	return nil, warning
}

func (a *App) createPluginsFile() (*model.FileData, string) {
	var warning string

	// Getting the plugins installed on the server, prettify it, and then add them to the file data array
	pluginsResponse, appErr := a.GetPlugins()
	if appErr == nil {
		pluginsPrettyJSON, err := json.MarshalIndent(pluginsResponse, "", "    ")
		if err == nil {
			fileData := model.FileData{
				Filename: "plugins.json",
				Body:     pluginsPrettyJSON,
			}

			return &fileData, ""
		}

		warning = fmt.Sprintf("json.MarshalIndent(pluginsResponse) Error: %s", err.Error())
	} else {
		warning = fmt.Sprintf("c.App.GetPlugins() Error: %s", appErr.Error())
	}

	return nil, warning
}

func (a *App) getNotificationsLog() (*model.FileData, string) {
	var warning string

	// Getting notifications.log
	if *a.Config().NotificationLogSettings.EnableFile {
		// notifications.log
		notificationsLog := config.GetNotificationsLogFileLocation(*a.Config().LogSettings.FileLocation)

		notificationsLogFileData, notificationsLogFileDataErr := os.ReadFile(notificationsLog)

		if notificationsLogFileDataErr == nil {
			fileData := model.FileData{
				Filename: "notifications.log",
				Body:     notificationsLogFileData,
			}
			return &fileData, ""
		}

		warning = fmt.Sprintf("os.ReadFile(notificationsLog) Error: %s", notificationsLogFileDataErr.Error())

	} else {
		warning = "Unable to retrieve notifications.log because LogSettings: EnableFile is false in config.json"
	}

	return nil, warning
}

func (a *App) getMattermostLog() (*model.FileData, string) {
	var warning string

	// Getting mattermost.log
	if *a.Config().LogSettings.EnableFile {
		// mattermost.log
		mattermostLog := config.GetLogFileLocation(*a.Config().LogSettings.FileLocation)

		mattermostLogFileData, mattermostLogFileDataErr := os.ReadFile(mattermostLog)

		if mattermostLogFileDataErr == nil {
			fileData := model.FileData{
				Filename: "mattermost.log",
				Body:     mattermostLogFileData,
			}
			return &fileData, ""
		}
		warning = fmt.Sprintf("os.ReadFile(mattermostLog) Error: %s", mattermostLogFileDataErr.Error())

	} else {
		warning = "Unable to retrieve mattermost.log because LogSettings: EnableFile is false in config.json"
	}

	return nil, warning
}

func (a *App) createSanitizedConfigFile() (*model.FileData, string) {
	// Getting sanitized config, prettifying it, and then adding it to our file data array
	sanitizedConfigPrettyJSON, err := json.MarshalIndent(a.GetSanitizedConfig(), "", "    ")
	if err == nil {
		fileData := model.FileData{
			Filename: "sanitized_config.json",
			Body:     sanitizedConfigPrettyJSON,
		}
		return &fileData, ""
	}

	warning := fmt.Sprintf("json.MarshalIndent(c.App.GetSanitizedConfig()) Error: %s", err.Error())
	return nil, warning
}
