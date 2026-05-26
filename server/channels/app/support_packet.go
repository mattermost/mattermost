// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"sync"

	"github.com/goccy/go-yaml"
	"github.com/hashicorp/go-multierror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) []model.FileData {
	functions := map[string]func(rctx request.CTX) (*model.FileData, error){
		"metadata":    a.getSupportPacketMetadata,
		"stats":       a.getSupportPacketStats,
		"jobs":        a.getSupportPacketJobList,
		"permissions": a.getSupportPacketPermissionsInfo,
		"plugins":     a.getPluginsFile,
		"schema":      a.getSupportPacketDatabaseSchema,
	}

	var (
		// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
		warnings *multierror.Error
		// Creating an array of files that we are going to be adding to our zip file
		fileDatas []model.FileData
		wg        sync.WaitGroup
		mut       sync.Mutex // Protects warnings and fileDatas
	)

	wg.Go(func() {
		for name, fn := range functions {
			fileData, err := fn(rctx)
			mut.Lock()
			if err != nil {
				rctx.Logger().Error("Failed to generate file for Support Packet",
					mlog.String("file", name),
					mlog.Err(err),
				)
				warnings = multierror.Append(warnings, err)
			}

			if fileData != nil {
				fileDatas = append(fileDatas, *fileData)
			}
			mut.Unlock()
		}

		// Generate platform support packet
		files, err := a.Srv().Platform().GenerateSupportPacket(rctx, options)
		mut.Lock()
		if err != nil {
			warnings = multierror.Append(warnings, err)
		}

		if fileDatas != nil {
			if cluster := a.Cluster(); cluster != nil && *a.Config().ClusterSettings.Enable {
				hostname := cluster.GetMyClusterInfo().Hostname
				for _, file := range files {
					// When running in a cluster, the files are generated with the cluster node name as the directory, e.g. 7917b92f9e4c/mattermost.log
					fileDatas = append(fileDatas, model.FileData{
						Filename: filepath.Join(hostname, file.Filename),
						Body:     file.Body,
					})
				}
			} else {
				// When running in standalone mode, all files are generated with the same directory name, e.g. mattermost.log.
				fileDatas = append(fileDatas, files...)
			}
		}
		mut.Unlock()
	})

	// Run the cluster generation in a separate goroutine as CPU profile generation and file upload can take a long time
	if cluster := a.Cluster(); cluster != nil && *a.Config().ClusterSettings.Enable {
		wg.Go(func() {
			files, err := cluster.GenerateSupportPacket(rctx, options)
			mut.Lock()
			if err != nil {
				rctx.Logger().Error("Failed to generate Support Packet from cluster nodes", mlog.Err(err))
				warnings = multierror.Append(warnings, err)
			}

			for _, node := range files {
				fileDatas = append(fileDatas, node...)
			}
			mut.Unlock()
		})
	}

	wg.Wait()

	pluginContext := pluginContext(rctx)
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
			rctx.Logger().Warn("Failed to generate plugin file for Support Packet", mlog.String("plugin", manifest.Id), mlog.Err(err))
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

func (a *App) getSupportPacketStats(rctx request.CTX) (*model.FileData, error) {
	var (
		rErr  *multierror.Error
		err   error
		stats model.SupportPacketStats
	)

	stats.RegisteredUsers, err = a.Srv().Store().User().Count(model.UserCountOptions{IncludeDeleted: true})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get registered user count: %w", err))
	}

	stats.ActiveUsers, err = a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get active user count: %w", err))
	}

	stats.DailyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get daily active user count: %w", err))
	}

	stats.MonthlyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get monthly active user count: %w", err))
	}

	stats.DeactivatedUsers, err = a.Srv().Store().User().AnalyticsGetInactiveUsersCount()
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get deactivated user count: %w", err))
	}

	stats.Guests, err = a.Srv().Store().User().AnalyticsGetGuestCount()
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get guest count: %w", err))
	}

	stats.SingleChannelGuests, err = a.Srv().Store().User().AnalyticsGetSingleChannelGuestCount()
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get single channel guest count: %w", err))
	}

	stats.BotAccounts, err = a.Srv().Store().User().Count(model.UserCountOptions{IncludeBotAccounts: true, ExcludeRegularUsers: true})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get bot acount count: %w", err))
	}

	stats.Posts, err = a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get post count: %w", err))
	}

	openChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get open channels count: %w", err))
	}
	privateChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypePrivate)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get private channels count: %w", err))
	}
	stats.Channels = openChannels + privateChannels

	stats.Teams, err = a.Srv().Store().Team().AnalyticsTeamCount(nil)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get team count: %w", err))
	}

	stats.SlashCommands, err = a.Srv().Store().Command().AnalyticsCommandCount("")
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get command count: %w", err))
	}

	stats.IncomingWebhooks, err = a.Srv().Store().Webhook().AnalyticsIncomingCount("", "")
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get incoming webhook count: %w", err))
	}

	stats.OutgoingWebhooks, err = a.Srv().Store().Webhook().AnalyticsOutgoingCount("")
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get  outgoing webhook count: %w", err))
	}

	b, err := yaml.Marshal(&stats)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to marshal Support Packet into yaml: %w", err))
	}

	fileData := &model.FileData{
		Filename: "stats.yaml",
		Body:     b,
	}
	return fileData, rErr.ErrorOrNil()
}

func (a *App) getSupportPacketJobList(rctx request.CTX) (*model.FileData, error) {
	const numberOfJobsRuns = 5

	var (
		rErr *multierror.Error
		err  error
		jobs model.SupportPacketJobList
	)

	jobs.LDAPSyncJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeLdapSync, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting LDAP sync jobs: %w", err))
	}
	jobs.DataRetentionJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeDataRetention, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting data retention jobs: %w", err))
	}
	jobs.MessageExportJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMessageExport, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting message export jobs: %w", err))
	}
	jobs.ElasticPostIndexingJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostIndexing, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting ES post indexing jobs: %w", err))
	}
	jobs.ElasticPostAggregationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostAggregation, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting ES post aggregation jobs: %w", err))
	}
	jobs.MigrationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMigrations, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("error while getting migration jobs: %w", err))
	}

	b, err := yaml.Marshal(&jobs)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to marshal jobs list into yaml: %w", err))
	}

	fileData := &model.FileData{
		Filename: "jobs.yaml",
		Body:     b,
	}
	return fileData, rErr.ErrorOrNil()
}

func (a *App) getSupportPacketPermissionsInfo(_ request.CTX) (*model.FileData, error) {
	var (
		rErr        *multierror.Error
		err         error
		permissions model.SupportPacketPermissionInfo
	)

	var allSchemes []*model.Scheme
	perPage := 100
	page := 0
	for {
		schemes, appErr := a.GetSchemesPage("", page, perPage)
		if appErr != nil {
			rErr = multierror.Append(fmt.Errorf("failed to get list of schemes: %w", appErr))
			break
		}

		allSchemes = append(allSchemes, schemes...)
		if len(schemes) < perPage {
			break
		}
		page++
	}

	for _, s := range allSchemes {
		s.Sanitize()
	}
	permissions.Schemes = allSchemes

	roles, appErr := a.GetAllRoles()
	if appErr != nil {
		rErr = multierror.Append(fmt.Errorf("failed to get list of roles: %w", appErr))
	}

	for _, r := range roles {
		r.Sanitize()
	}
	permissions.Roles = roles

	b, err := yaml.Marshal(&permissions)
	if err != nil {
		rErr = multierror.Append(fmt.Errorf("failed to marshal permission info into yaml: %w", err))
	}

	fileData := &model.FileData{
		Filename: "permissions.yaml",
		Body:     b,
	}
	return fileData, rErr.ErrorOrNil()
}

func (a *App) getPluginsFile(_ request.CTX) (*model.FileData, error) {
	// Getting the plugins installed on the server, prettify it, and then add them to the file data array
	plugins, appErr := a.GetPlugins()
	if appErr != nil {
		return nil, fmt.Errorf("failed to get plugin list for Support Packet: %w", appErr)
	}

	var pluginList model.SupportPacketPluginList
	for _, p := range plugins.Active {
		pluginList.Enabled = append(pluginList.Enabled, p.Manifest)
	}
	for _, p := range plugins.Inactive {
		pluginList.Disabled = append(pluginList.Disabled, p.Manifest)
	}

	pluginsPrettyJSON, err := json.MarshalIndent(pluginList, "", "    ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal plugin list into json: %w", err)
	}

	fileData := &model.FileData{
		Filename: "plugins.json",
		Body:     pluginsPrettyJSON,
	}
	return fileData, nil
}

func (a *App) getSupportPacketMetadata(_ request.CTX) (*model.FileData, error) {
	metadata, err := model.GeneratePacketMetadata(model.SupportPacketType, a.ServerId(), a.License(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Packet metadata: %w", err)
	}

	b, err := yaml.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Packet metadata into yaml: %w", err)
	}

	fileData := &model.FileData{
		Filename: model.PacketMetadataFileName,
		Body:     b,
	}
	return fileData, nil
}

func (a *App) getSupportPacketDatabaseSchema(rctx request.CTX) (*model.FileData, error) {
	if *a.Config().SqlSettings.DriverName != model.DatabaseDriverPostgres {
		return nil, nil
	}

	schemaInfo, err := a.Srv().Store().GetSchemaDefinition()
	if err != nil {
		return nil, fmt.Errorf("failed to get schema definition: %w", err)
	}

	schemaDump, err := yaml.Marshal(schemaInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema into YAML: %w", err)
	}

	return &model.FileData{
		Filename: "database_schema.yaml",
		Body:     schemaDump,
	}, nil
}
