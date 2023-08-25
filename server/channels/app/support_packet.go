// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"os"
	"runtime"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/config"
)

func (a *App) GenerateSupportPacket() []model.FileData {
	// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
	var warnings []string

	// Creating an array of files that we are going to be adding to our zip file
	fileDatas := []model.FileData{}

	// A array of the functions that we can iterate through since they all have the same return value
	functions := []func() (*model.FileData, error){
		a.generateSupportPacketYaml,
		a.createPluginsFile,
		a.createSanitizedConfigFile,
		a.getMattermostLog,
		a.getNotificationsLog,
	}

	for _, fn := range functions {
		fileData, err := fn()

		if fileData != nil {
			fileDatas = append(fileDatas, *fileData)
		} else {
			warnings = append(warnings, err.Error())
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

func (a *App) generateSupportPacketYaml() (*model.FileData, error) {
	var rErr error

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
	databaseType, databaseSchemaVersion := a.Srv().DatabaseTypeAndSchemaVersion()

	databaseVersion, _ := a.Srv().Store().GetDbVersion(false)

	uniqueUserCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting user count"))
	}
	elasticPostIndexing, err := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeElasticsearchPostIndexing, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post indexing jobs"))
	}
	elasticPostAggregation, _ := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeElasticsearchPostAggregation, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post aggregation jobs"))
	}
	ldapSyncJobs, err := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeLdapSync, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP sync jobs"))
	}
	messageExport, err := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeMessageExport, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting message export jobs"))
	}
	dataRetentionJobs, err := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeDataRetention, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting data retention jobs"))
	}
	complianceJobs, err := a.Srv().Store().Job().GetAllByTypePage("compliance", 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting compliance jobs"))
	}
	migrationJobs, err := a.Srv().Store().Job().GetAllByTypePage(model.JobTypeMigrations, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting migration jobs"))
	}

	licenseTo := ""
	supportedUsers := 0
	if license := a.Srv().License(); license != nil {
		supportedUsers = *license.Features.Users
		licenseTo = license.Customer.Company
	}

	// Creating the struct for support packet yaml file
	supportPacket := model.SupportPacket{
		LicenseTo:                  licenseTo,
		ServerOS:                   runtime.GOOS,
		ServerArchitecture:         runtime.GOARCH,
		ServerVersion:              model.CurrentVersion,
		BuildHash:                  model.BuildHash,
		DatabaseType:               databaseType,
		DatabaseVersion:            databaseVersion,
		DatabaseSchemaVersion:      databaseSchemaVersion,
		LdapVendorName:             vendorName,
		LdapVendorVersion:          vendorVersion,
		ElasticServerVersion:       elasticServerVersion,
		ElasticServerPlugins:       elasticServerPlugins,
		ActiveUsers:                int(uniqueUserCount),
		LicenseSupportedUsers:      supportedUsers,
		ElasticPostIndexingJobs:    elasticPostIndexing,
		ElasticPostAggregationJobs: elasticPostAggregation,
		LdapSyncJobs:               ldapSyncJobs,
		MessageExportJobs:          messageExport,
		DataRetentionJobs:          dataRetentionJobs,
		ComplianceJobs:             complianceJobs,
		MigrationJobs:              migrationJobs,
	}

	analytics, appErr := a.GetAnalytics("standard", "")
	if appErr != nil {
		rErr = multierror.Append(errors.Wrap(appErr, "error while getting analytics"))
	}
	if len(analytics) < 11 {
		rErr = multierror.Append(errors.New("not enought analytics information found"))
	} else {
		supportPacket.TotalChannels = int(analytics[0].Value) + int(analytics[1].Value)
		supportPacket.TotalPosts = int(analytics[2].Value)
		supportPacket.TotalTeams = int(analytics[4].Value)
		supportPacket.WebsocketConnections = int(analytics[5].Value)
		supportPacket.MasterDbConnections = int(analytics[6].Value)
		supportPacket.ReplicaDbConnections = int(analytics[7].Value)
		supportPacket.DailyActiveUsers = int(analytics[8].Value)
		supportPacket.MonthlyActiveUsers = int(analytics[9].Value)
		supportPacket.InactiveUserCount = int(analytics[10].Value)
	}

	// Marshal to a Yaml File
	supportPacketYaml, err := yaml.Marshal(&supportPacket)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal support package into yaml"))
	}

	fileData := &model.FileData{
		Filename: "support_packet.yaml",
		Body:     supportPacketYaml,
	}
	return fileData, rErr
}

func (a *App) createPluginsFile() (*model.FileData, error) {
	// Getting the plugins installed on the server, prettify it, and then add them to the file data array
	pluginsResponse, appErr := a.GetPlugins()
	if appErr != nil {
		return nil, errors.Wrap(appErr, "failed to get plugin list for support package")
	}

	pluginsPrettyJSON, err := json.MarshalIndent(pluginsResponse, "", "    ")
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal plugin list into json")
	}

	fileData := &model.FileData{
		Filename: "plugins.json",
		Body:     pluginsPrettyJSON,
	}
	return fileData, nil

}

func (a *App) getNotificationsLog() (*model.FileData, error) {
	if !*a.Config().NotificationLogSettings.EnableFile {
		return nil, errors.New("Unable to retrieve notifications.log because LogSettings: EnableFile is false in config.json")
	}

	notificationsLog := config.GetNotificationsLogFileLocation(*a.Config().LogSettings.FileLocation)
	notificationsLogFileData, err := os.ReadFile(notificationsLog)
	if err != nil {
		return nil, errors.Wrapf(err, "failed read notifcation log file at path %s", notificationsLog)
	}

	fileData := &model.FileData{
		Filename: "notifications.log",
		Body:     notificationsLogFileData,
	}
	return fileData, nil
}

func (a *App) getMattermostLog() (*model.FileData, error) {
	if !*a.Config().LogSettings.EnableFile {
		return nil, errors.New("Unable to retrieve mattermost.log because LogSettings: EnableFile is false in config.json")
	}

	mattermostLog := config.GetLogFileLocation(*a.Config().LogSettings.FileLocation)
	mattermostLogFileData, err := os.ReadFile(mattermostLog)
	if err != nil {
		return nil, errors.Wrapf(err, "failed read mattermost log file at path %s", mattermostLog)
	}

	fileData := &model.FileData{
		Filename: "mattermost.log",
		Body:     mattermostLogFileData,
	}
	return fileData, nil
}

func (a *App) createSanitizedConfigFile() (*model.FileData, error) {
	// Getting sanitized config, prettifying it, and then adding it to our file data array
	sanitizedConfigPrettyJSON, err := json.MarshalIndent(a.GetSanitizedConfig(), "", "    ")
	if err != nil {
		return nil, errors.Wrap(err, "failed to sanitized config into json")
	}

	fileData := &model.FileData{
		Filename: "sanitized_config.json",
		Body:     sanitizedConfigPrettyJSON,
	}
	return fileData, nil
}
