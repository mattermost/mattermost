// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"runtime"
	"sync"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GenerateSupportPacket(c request.CTX, options *model.SupportPacketOptions) []model.FileData {
	// A array of the functions that we can iterate through since they all have the same return value
	functions := map[string]func(c request.CTX) (*model.FileData, error){
		"support packet": a.generateSupportPacketYaml,
		"plugins":        a.createPluginsFile,
		"config":         a.createSanitizedConfigFile,
		"cpu profile":    a.Srv().Platform().CreateCPUProfile,
		"heap profile":   a.Srv().Platform().CreateHeapProfile,
		"goroutines":     a.Srv().Platform().CreateGoroutineProfile,
		"metadata":       a.createSupportPacketMetadata,
	}

	if options.IncludeLogs {
		functions["mattermost log"] = a.Srv().Platform().GetLogFile
		functions["notification log"] = a.Srv().Platform().GetNotificationLogFile
	}

	// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
	var warnings *multierror.Error
	// Creating an array of files that we are going to be adding to our zip file
	var fileDatas []model.FileData
	var wg sync.WaitGroup
	var mut sync.Mutex // Protects warnings and fileDatas

	wg.Add(1)
	go func() {
		defer wg.Done()

		for name, fn := range functions {
			fileData, err := fn(c)
			mut.Lock()
			if err != nil {
				c.Logger().Error("Failed to generate file for Support Packet", mlog.String("file", name), mlog.Err(err))
				warnings = multierror.Append(warnings, err)
			}

			if fileData != nil {
				fileDatas = append(fileDatas, *fileData)
			}
			mut.Unlock()
		}
	}()

	// Run the cluster generation in a separate goroutine as CPU profile generation and file upload can take a long time
	if cluster := a.Cluster(); cluster != nil && *a.Config().ClusterSettings.Enable {
		wg.Add(1)
		go func() {
			defer wg.Done()

			files, err := cluster.GenerateSupportPacket(c, options)
			mut.Lock()
			if err != nil {
				c.Logger().Error("Failed to generate Support Packet from cluster nodes", mlog.Err(err))
				warnings = multierror.Append(warnings, err)
			}

			for _, node := range files {
				fileDatas = append(fileDatas, node...)
			}
			mut.Unlock()
		}()
	}

	wg.Wait()

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		pluginContext := pluginContext(c)
		for _, id := range options.PluginPackets {
			hooks, err := pluginsEnvironment.HooksForPlugin(id)
			if err != nil {
				c.Logger().Error("Failed to call hooks for plugin", mlog.Err(err), mlog.String("plugin", id))
				warnings = multierror.Append(warnings, err)
				continue
			}
			pluginData, err := hooks.GenerateSupportData(pluginContext)
			if err != nil {
				c.Logger().Warn("Failed to generate plugin file for Support Packet", mlog.Err(err), mlog.String("plugin", id))
				warnings = multierror.Append(warnings, err)
				continue
			}
			for _, data := range pluginData {
				fileDatas = append(fileDatas, *data)
			}
		}
	}

	// Adding a warning.txt file to the fileDatas if any warning
	if warnings != nil {
		fileDatas = append(fileDatas, model.FileData{
			Filename: model.SupportPacketErrorFile,
			Body:     []byte(warnings.Error()),
		})
	}

	return fileDatas
}

func (a *App) generateSupportPacketYaml(c request.CTX) (*model.FileData, error) {
	var rErr *multierror.Error

	/* DB */

	databaseType, databaseSchemaVersion := a.Srv().DatabaseTypeAndSchemaVersion()
	databaseVersion, err := a.Srv().Store().GetDbVersion(false)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting DB version"))
	}

	/* Cluster */

	var clusterID string
	if cluster := a.Cluster(); cluster != nil {
		clusterID = cluster.GetClusterId()
	}

	/* File store */

	fileDriver := a.Srv().Platform().FileBackend().DriverName()
	fileStatus := model.StatusOk
	err = a.Srv().Platform().FileBackend().TestConnection()
	if err != nil {
		fileStatus = model.StatusFail + ": " + err.Error()
	}

	/* LDAP */

	var vendorName, vendorVersion string
	if ldap := a.Ldap(); ldap != nil {
		vendorName, vendorVersion, err = ldap.GetVendorNameAndVendorVersion(c)
		if err != nil {
			rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP vendor info"))
		}

		if vendorName == "" {
			vendorName = "unknown"
		}
		if vendorVersion == "" {
			vendorVersion = "unknown"
		}
	}

	/* Elastic Search */

	var elasticServerVersion string
	var elasticServerPlugins []string
	if se := a.Srv().Platform().SearchEngine.ElasticsearchEngine; se != nil {
		elasticServerVersion = se.GetFullVersion()
		elasticServerPlugins = se.GetPlugins()
	}

	/* License */

	var (
		licenseTo      string
		supportedUsers int
		isTrial        bool
	)
	if license := a.Srv().License(); license != nil {
		licenseTo = license.Customer.Company
		supportedUsers = *license.Features.Users
		isTrial = license.IsTrial
	}

	/* Server stats */

	uniqueUserCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting user count"))
	}

	var (
		totalChannels        int
		totalPosts           int
		totalTeams           int
		websocketConnections int
		masterDbConnections  int
		replicaDbConnections int
		dailyActiveUsers     int
		monthlyActiveUsers   int
		inactiveUserCount    int
	)
	analytics, appErr := a.GetAnalyticsForSupportPacket(c)
	if appErr != nil {
		rErr = multierror.Append(errors.Wrap(appErr, "error while getting analytics"))
	} else {
		if len(analytics) < 11 {
			rErr = multierror.Append(errors.New("not enough analytics information found"))
		} else {
			totalChannels = int(analytics[0].Value) + int(analytics[1].Value)
			totalPosts = int(analytics[2].Value)
			totalTeams = int(analytics[4].Value)
			websocketConnections = int(analytics[5].Value)
			masterDbConnections = int(analytics[6].Value)
			replicaDbConnections = int(analytics[7].Value)
			dailyActiveUsers = int(analytics[8].Value)
			monthlyActiveUsers = int(analytics[9].Value)
			inactiveUserCount = int(analytics[10].Value)
		}
	}

	/* Jobs  */

	dataRetentionJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeDataRetention, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting data retention jobs"))
	}
	messageExportJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeMessageExport, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting message export jobs"))
	}
	elasticPostIndexingJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeElasticsearchPostIndexing, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post indexing jobs"))
	}
	elasticPostAggregationJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeElasticsearchPostAggregation, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post aggregation jobs"))
	}
	blevePostIndexingJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeBlevePostIndexing, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting bleve post indexing jobs"))
	}
	ldapSyncJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeLdapSync, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP sync jobs"))
	}
	migrationJobs, err := a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeMigrations, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting migration jobs"))
	}

	// Creating the struct for Support Packet yaml file
	supportPacket := model.SupportPacket{
		/* Build information */
		ServerOS:           runtime.GOOS,
		ServerArchitecture: runtime.GOARCH,
		ServerVersion:      model.CurrentVersion,
		BuildHash:          model.BuildHash,

		/* DB */
		DatabaseType:          databaseType,
		DatabaseVersion:       databaseVersion,
		DatabaseSchemaVersion: databaseSchemaVersion,
		WebsocketConnections:  websocketConnections,
		MasterDbConnections:   masterDbConnections,
		ReplicaDbConnections:  replicaDbConnections,

		/* Cluster */
		ClusterID: clusterID,

		/* File store */
		FileDriver: fileDriver,
		FileStatus: fileStatus,

		/* LDAP */
		LdapVendorName:    vendorName,
		LdapVendorVersion: vendorVersion,

		/* Elastic Search */
		ElasticServerVersion: elasticServerVersion,
		ElasticServerPlugins: elasticServerPlugins,

		/* License */
		LicenseTo:             licenseTo,
		LicenseSupportedUsers: supportedUsers,
		LicenseIsTrial:        isTrial,

		/* Server stats */
		ActiveUsers:        int(uniqueUserCount),
		DailyActiveUsers:   dailyActiveUsers,
		MonthlyActiveUsers: monthlyActiveUsers,
		InactiveUserCount:  inactiveUserCount,
		TotalPosts:         totalPosts,
		TotalChannels:      totalChannels,
		TotalTeams:         totalTeams,

		/* Jobs */
		DataRetentionJobs:          dataRetentionJobs,
		MessageExportJobs:          messageExportJobs,
		ElasticPostIndexingJobs:    elasticPostIndexingJobs,
		ElasticPostAggregationJobs: elasticPostAggregationJobs,
		BlevePostIndexingJobs:      blevePostIndexingJobs,
		LdapSyncJobs:               ldapSyncJobs,
		MigrationJobs:              migrationJobs,
	}

	// Marshal to a YAML File
	supportPacketYaml, err := yaml.Marshal(&supportPacket)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal Support Packet into yaml"))
	}

	fileData := &model.FileData{
		Filename: "support_packet.yaml",
		Body:     supportPacketYaml,
	}
	return fileData, rErr.ErrorOrNil()
}

func (a *App) createSanitizedConfigFile(_ request.CTX) (*model.FileData, error) {
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

func (a *App) createPluginsFile(_ request.CTX) (*model.FileData, error) {
	// Getting the plugins installed on the server, prettify it, and then add them to the file data array
	pluginsResponse, appErr := a.GetPlugins()
	if appErr != nil {
		return nil, errors.Wrap(appErr, "failed to get plugin list for Support Packet")
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

func (a *App) createSupportPacketMetadata(_ request.CTX) (*model.FileData, error) {
	metadata, err := model.GeneratePacketMetadata(model.SupportPacketType, a.TelemetryId(), a.License(), nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate Packet metadata")
	}

	b, err := yaml.Marshal(metadata)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal Packet metadata into yaml")
	}

	fileData := &model.FileData{
		Filename: model.PacketMetadataFileName,
		Body:     b,
	}
	return fileData, nil
}
