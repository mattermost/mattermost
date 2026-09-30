// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"path/filepath"
	"slices"
	"sync"

	"github.com/goccy/go-yaml"
	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

func (a *App) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) []model.FileData {
	functions := map[string]func(rctx request.CTX) (*model.FileData, error){
		"metadata": func(rctx request.CTX) (*model.FileData, error) {
			return supportPacketMetadataFile(a.getSupportPacketMetadata(rctx))
		},
		"stats": func(rctx request.CTX) (*model.FileData, error) {
			return supportPacketStatsFile(a.getSupportPacketStats(rctx))
		},
		"jobs": func(rctx request.CTX) (*model.FileData, error) {
			return supportPacketJobsFile(a.getSupportPacketJobList(rctx))
		},
		"permissions": func(rctx request.CTX) (*model.FileData, error) {
			return supportPacketPermissionsFile(a.getSupportPacketPermissionsInfo(rctx))
		},
		"plugins": func(rctx request.CTX) (*model.FileData, error) {
			return supportPacketPluginsFile(a.getPluginsList(rctx))
		},
		"schema": a.getSupportPacketDatabaseSchema,
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

func supportPacketMetadataFile(m *model.PacketMetadata, err error) (*model.FileData, error) {
	return platform.YAMLFile(model.PacketMetadataFileName, m, err)
}

func supportPacketStatsFile(s *model.SupportPacketStats, err error) (*model.FileData, error) {
	return platform.YAMLFile("stats.yaml", s, err)
}

func supportPacketJobsFile(j *model.SupportPacketJobList, err error) (*model.FileData, error) {
	return platform.YAMLFile("jobs.yaml", j, err)
}

func supportPacketPermissionsFile(p *model.SupportPacketPermissionInfo, err error) (*model.FileData, error) {
	return platform.YAMLFile("permissions.yaml", p, err)
}

func supportPacketPluginsFile(p *model.SupportPacketPluginList, err error) (*model.FileData, error) {
	return platform.JSONFile("plugins.json", p, err)
}

func (a *App) getSupportPacketStats(rctx request.CTX) (*model.SupportPacketStats, error) {
	var (
		rErr  *multierror.Error
		stats model.SupportPacketStats
	)

	collect := func(name string, get func() (int64, error)) *int64 {
		value, err := get()
		if err != nil {
			rErr = multierror.Append(rErr, errors.Wrapf(err, "failed to get %s", name))
			return nil
		}

		return &value
	}

	stats.RegisteredUsers = collect("registered user count", func() (int64, error) {
		return a.Srv().Store().User().Count(model.UserCountOptions{IncludeDeleted: true})
	})
	stats.ActiveUsers = collect("active user count", func() (int64, error) {
		return a.Srv().Store().User().Count(model.UserCountOptions{})
	})
	stats.DailyActiveUsers = collect("daily active user count", func() (int64, error) {
		return a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	})
	stats.MonthlyActiveUsers = collect("monthly active user count", func() (int64, error) {
		return a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	})
	stats.DeactivatedUsers = collect("deactivated user count", func() (int64, error) {
		return a.Srv().Store().User().AnalyticsGetInactiveUsersCount()
	})
	stats.Guests = collect("guest count", func() (int64, error) {
		return a.Srv().Store().User().AnalyticsGetGuestCount()
	})
	stats.SingleChannelGuests = collect("single channel guest count", func() (int64, error) {
		return a.Srv().Store().User().AnalyticsGetSingleChannelGuestCount()
	})
	stats.BotAccounts = collect("bot account count", func() (int64, error) {
		return a.Srv().Store().User().Count(model.UserCountOptions{IncludeBotAccounts: true, ExcludeRegularUsers: true})
	})
	stats.Posts = collect("post count", func() (int64, error) {
		return a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
	})
	stats.Channels = collect("channel count", func() (int64, error) {
		openChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
		if err != nil {
			return 0, err
		}

		privateChannels, err := a.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypePrivate)
		if err != nil {
			return 0, err
		}

		return openChannels + privateChannels, nil
	})
	stats.Teams = collect("team count", func() (int64, error) {
		return a.Srv().Store().Team().AnalyticsTeamCount(nil)
	})
	stats.SlashCommands = collect("command count", func() (int64, error) {
		return a.Srv().Store().Command().AnalyticsCommandCount("")
	})
	stats.IncomingWebhooks = collect("incoming webhook count", func() (int64, error) {
		return a.Srv().Store().Webhook().AnalyticsIncomingCount("", "")
	})
	stats.OutgoingWebhooks = collect("outgoing webhook count", func() (int64, error) {
		return a.Srv().Store().Webhook().AnalyticsOutgoingCount("")
	})

	return &stats, rErr.ErrorOrNil()
}

func (a *App) getSupportPacketJobList(rctx request.CTX) (*model.SupportPacketJobList, error) {
	const numberOfJobsRuns = 5

	var (
		rErr *multierror.Error
		err  error
		jobs model.SupportPacketJobList
	)

	jobs.LDAPSyncJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeLdapSync, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting LDAP sync jobs"))
	}
	jobs.DataRetentionJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeDataRetention, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting data retention jobs"))
	}
	jobs.MessageExportJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMessageExport, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting message export jobs"))
	}
	jobs.ElasticPostIndexingJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostIndexing, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting ES post indexing jobs"))
	}
	jobs.ElasticPostAggregationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeElasticsearchPostAggregation, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting ES post aggregation jobs"))
	}
	jobs.MigrationJobs, err = a.Srv().Store().Job().GetAllByTypePage(rctx, model.JobTypeMigrations, 0, numberOfJobsRuns)
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting migration jobs"))
	}

	return &jobs, rErr.ErrorOrNil()
}

func (a *App) getSupportPacketPermissionsInfo(_ request.CTX) (*model.SupportPacketPermissionInfo, error) {
	var (
		rErr        *multierror.Error
		permissions model.SupportPacketPermissionInfo
	)

	var allSchemes []*model.Scheme
	perPage := 100
	page := 0
	for {
		schemes, appErr := a.GetSchemesPage("", page, perPage)
		if appErr != nil {
			rErr = multierror.Append(rErr, errors.Wrap(appErr, "failed to get list of schemes"))
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
		rErr = multierror.Append(rErr, errors.Wrap(appErr, "failed to get list of roles"))
	}

	for _, r := range roles {
		r.Sanitize()
	}
	permissions.Roles = roles

	return &permissions, rErr.ErrorOrNil()
}

func (a *App) getPluginsList(_ request.CTX) (*model.SupportPacketPluginList, error) {
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

	return &pluginList, nil
}

func (a *App) getSupportPacketMetadata(_ request.CTX) (*model.PacketMetadata, error) {
	metadata, err := model.GeneratePacketMetadata(model.SupportPacketType, a.ServerId(), a.License(), nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate Packet metadata")
	}

	return metadata, nil
}

func (a *App) getSupportPacketDatabaseSchema(rctx request.CTX) (*model.FileData, error) {
	if *a.Config().SqlSettings.DriverName != model.DatabaseDriverPostgres {
		return nil, nil
	}

	schemaInfo, err := a.Srv().Store().GetSchemaDefinition()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get schema definition")
	}

	schemaDump, err := yaml.Marshal(schemaInfo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal schema into YAML")
	}

	return &model.FileData{
		Filename: "database_schema.yaml",
		Body:     schemaDump,
	}, nil
}
