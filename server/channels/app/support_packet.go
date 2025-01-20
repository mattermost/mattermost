// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"slices"
	"sync"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) []model.FileData {
	functions := map[string]func(c request.CTX) (*model.FileData, error){
		"metadata":    a.getSupportPacketMetadata,
		"stats":       a.getSupportPacketStats,
		"jobs":        a.getSupportPacketJobList,
		"permissions": a.getSupportPacketPermissionsInfo,
		"plugins":     a.getPluginsFile,
	}

	var (
		// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
		warnings *multierror.Error
		// Creating an array of files that we are going to be adding to our zip file
		fileDatas []model.FileData
		wg        sync.WaitGroup
		mut       sync.Mutex // Protects warnings and fileDatas
	)

	wg.Add(1)
	go func() {
		defer wg.Done()

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
		if files != nil {
			fileDatas = append(fileDatas, files...)
		}
		mut.Unlock()
	}()

	// Run the cluster generation in a separate goroutine as CPU profile generation and file upload can take a long time
	if cluster := a.Cluster(); cluster != nil && *a.Config().ClusterSettings.Enable {
		wg.Add(1)
		go func() {
			defer wg.Done()

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
		}()
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
		rErr = multierror.Append(errors.Wrap(err, "failed to get registered user count"))
	}

	stats.ActiveUsers, err = a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get active user count"))
	}

	stats.DailyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get daily active user count"))
	}

	stats.MonthlyActiveUsers, err = a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get monthly active user count"))
	}

	stats.DeactivatedUsers, err = a.Srv().Store().User().AnalyticsGetInactiveUsersCount()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get deactivated user count"))
	}

	stats.Guests, err = a.Srv().Store().User().AnalyticsGetGuestCount()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get guest count"))
	}

	stats.BotAccounts, err = a.Srv().Store().User().Count(model.UserCountOptions{IncludeBotAccounts: true, ExcludeRegularUsers: true})
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get bot acount count"))
	}

	stats.Posts, err = a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
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
	stats.Channels = openChannels + privateChannels

	stats.Teams, err = a.Srv().Store().Team().AnalyticsTeamCount(nil)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get team count"))
	}

	stats.SlashCommands, err = a.Srv().Store().Command().AnalyticsCommandCount("")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get command count"))
	}

	stats.IncomingWebhooks, err = a.Srv().Store().Webhook().AnalyticsIncomingCount("", "")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get incoming webhook count"))
	}

	stats.OutgoingWebhooks, err = a.Srv().Store().Webhook().AnalyticsOutgoingCount("")
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get  outgoing webhook count"))
	}

	b, err := yaml.Marshal(&stats)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal Support Packet into yaml"))
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
		rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP sync jobs"))
	}
	jobs.DataRetentionJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeDataRetention, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting data retention jobs"))
	}
	jobs.MessageExportJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMessageExport, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting message export jobs"))
	}
	jobs.ElasticPostIndexingJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostIndexing, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post indexing jobs"))
	}
	jobs.ElasticPostAggregationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostAggregation, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting ES post aggregation jobs"))
	}
	jobs.BlevePostIndexingJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeBlevePostIndexing, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting bleve post indexing jobs"))
	}
	jobs.MigrationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMigrations, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting migration jobs"))
	}

	b, err := yaml.Marshal(&jobs)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal jobs list into yaml"))
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
			rErr = multierror.Append(errors.Wrap(appErr, "failed to get list of schemes"))
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
		rErr = multierror.Append(errors.Wrap(appErr, "failed to get list of roles"))
	}

	for _, r := range roles {
		r.Sanitize()
	}
	permissions.Roles = roles

	b, err := yaml.Marshal(&permissions)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal permission info into yaml"))
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
		return nil, errors.Wrap(appErr, "failed to get plugin list for Support Packet")
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
		return nil, errors.Wrap(err, "failed to marshal plugin list into json")
	}

	fileData := &model.FileData{
		Filename: "plugins.json",
		Body:     pluginsPrettyJSON,
	}
	return fileData, nil
}

func (a *App) getSupportPacketMetadata(_ request.CTX) (*model.FileData, error) {
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
