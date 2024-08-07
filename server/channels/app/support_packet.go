// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"os"
	"runtime"
	"slices"
	"sync"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	envVarInstallType = "MM_INSTALL_TYPE"
	unknownDataPoint  = "unknown"
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

	pluginContext := pluginContext(c)
	a.ch.RunMultiHook(func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		// If the plugin defined the support_packet prop it means there is a UI element to include it in the support packet.
		// Check if the plugin is in the list of plugins to include in the Support Packet.
		if _, ok := manifest.Props["support_packet"]; ok {
			if !slices.Contains(options.PluginPackets, manifest.Id) {
				return true
			}
		}

		// Otherwise, just call the hook as the plugin decided to always include it in the Support Packet.
		pluginData, err := hooks.GenerateSupportData(pluginContext)
		if err != nil {
			c.Logger().Warn("Failed to generate plugin file for Support Packet", mlog.String("plugin", manifest.Id), mlog.Err(err))
			warnings = multierror.Append(warnings, err)
			return true
		}

		for _, data := range pluginData {
			fileDatas = append(fileDatas, *data)
		}

		return true
	}, plugin.GenerateSupportDataID)

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

	var sp model.SupportPacket

	sp.Version = model.CurrentSupportPacketVersion

	/* License */
	if license := a.Srv().License(); license != nil {
		sp.License.Company = license.Customer.Company
		sp.License.Users = model.SafeDereference(license.Features.Users)
		sp.License.IsTrial = license.IsTrial
		sp.License.IsGovSKU = license.IsGovSku
	}

	/* Server */
	sp.Server.OS = runtime.GOOS
	sp.Server.Architecture = runtime.GOARCH
	sp.Server.Version = model.CurrentVersion
	sp.Server.BuildHash = model.BuildHash
	installationType := os.Getenv(envVarInstallType)
	if installationType == "" {
		installationType = unknownDataPoint
	}
	sp.Server.InstallationType = installationType

	/* Config */
	sp.Config.Source = a.Srv().Platform().DescribeConfig()

	/* DB */
	sp.Database.Type, sp.Database.SchemaVersion = a.Srv().DatabaseTypeAndSchemaVersion()
	databaseVersion, err := a.Srv().Store().GetDbVersion(false)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting DB version"))
	} else {
		sp.Database.Version = databaseVersion
	}
	sp.Database.MasterConnectios = a.Srv().Store().TotalMasterDbConnections()
	sp.Database.ReplicaConnectios = a.Srv().Store().TotalReadDbConnections()
	sp.Database.SearchConnections = a.Srv().Store().TotalSearchDbConnections()

	/* File store */
	sp.FileStore.Driver = a.Srv().Platform().FileBackend().DriverName()
	sp.FileStore.Status = model.StatusOk
	err = a.Srv().Platform().FileBackend().TestConnection()
	if err != nil {
		sp.FileStore.Status = model.StatusFail + ": " + err.Error()
	}

	/* Websockets */
	sp.Websocket.Connections = a.TotalWebsocketConnections()

	/* Cluster */

	if cluster := a.Cluster(); cluster != nil {
		sp.Cluster.ID = cluster.GetClusterId()
		clusterInfo := cluster.GetClusterInfos()
		sp.Cluster.NumberOfNodes = len(clusterInfo)
	}

	/* LDAP */

	if ldap := a.Ldap(); ldap != nil && (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync) {
		var severName, serverVersion string

		severName, serverVersion, err = ldap.GetVendorNameAndVendorVersion(c)
		if err != nil {
			rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP vendor info"))
		}

		if severName == "" {
			severName = unknownDataPoint
		}
		if serverVersion == "" {
			serverVersion = unknownDataPoint
		}

		sp.LDAP.ServerName = severName
		sp.LDAP.ServerVersion = serverVersion

		sp.LDAP.Status = model.StatusOk
		appErr := ldap.RunTest(c)
		if appErr != nil {
			sp.LDAP.Status = model.StatusFail + ": " + appErr.Error()
		}
	}

	/* Elastic Search */
	if se := a.Srv().Platform().SearchEngine.ElasticsearchEngine; se != nil {
		sp.ElasticSearch.ServerVersion = se.GetFullVersion()
		sp.ElasticSearch.ServerPlugins = se.GetPlugins()
	}

	/* Server stats */

	sp.Stats.RegisteredUsers, err = a.Srv().Store().User().Count(model.UserCountOptions{IncludeDeleted: true})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get registered user count"))
	}

	sp.Stats.ActiveUsers, err = a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get active user count"))
	}

	sp.Stats.DailyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get daily active user count"))
	}

	sp.Stats.MonthlyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get monthly active user count"))
	}

	sp.Stats.DeactivatedUsers, err = a.Srv().Store().User().AnalyticsGetInactiveUsersCount()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get deactivated user count"))
	}

	sp.Stats.Guests, err = a.Srv().Store().User().AnalyticsGetGuestCount()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get guest count"))
	}

	sp.Stats.BotAccounts, err = a.Srv().Store().User().Count(model.UserCountOptions{IncludeBotAccounts: true, ExcludeRegularUsers: true})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get bot acount count"))
	}

	sp.Stats.Posts, err = a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get post count"))
	}

	openChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get open channels count"))
	}
	privateChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypePrivate)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get private channels count"))
	}
	sp.Stats.Channels = openChannels + privateChannels

	sp.Stats.Teams, err = a.Srv().Store().Team().AnalyticsTeamCount(nil)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get team count"))
	}

	sp.Stats.SlashCommands, err = a.Srv().Store().Command().AnalyticsCommandCount("")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get command count"))
	}

	sp.Stats.IncomingWebhooks, err = a.Srv().Store().Webhook().AnalyticsIncomingCount("", "")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get incoming webhook count"))
	}

	sp.Stats.OutgoingWebhooks, err = a.Srv().Store().Webhook().AnalyticsOutgoingCount("")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get  outgoing webhook count"))
	}

	/* Jobs  */
	sp.Jobs.LDAPSyncJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeLdapSync, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP sync jobs"))
	}
	sp.Jobs.DataRetentionJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeDataRetention, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting data retention jobs"))
	}
	sp.Jobs.MessageExportJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeMessageExport, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting message export jobs"))
	}
	sp.Jobs.ElasticPostIndexingJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeElasticsearchPostIndexing, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post indexing jobs"))
	}
	sp.Jobs.ElasticPostAggregationJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeElasticsearchPostAggregation, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post aggregation jobs"))
	}
	sp.Jobs.DataRetentionJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeBlevePostIndexing, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting bleve post indexing jobs"))
	}
	sp.Jobs.MigrationJobs, err = a.Srv().Store().Job().GetAllByTypePage(c, model.JobTypeMigrations, 0, 2)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting migration jobs"))
	}

	supportPacketYaml, err := yaml.Marshal(&sp)
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
