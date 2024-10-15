// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/enterprise/internal/file"

	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/actiance_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/csv_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/global_relay_export"
)

const (
	GlobalRelayExportFilename = "global-relay.zip"
)

type MessageExportInterfaceImpl struct {
	Server *app.Server
}

type MessageExportJobInterfaceImpl struct {
	Server *app.Server
}

func init() {
	app.RegisterJobsMessageExportJobInterface(func(s *app.Server) ejobs.MessageExportJobInterface {
		return &MessageExportJobInterfaceImpl{s}
	})
	app.RegisterMessageExportInterface(func(app *app.App) einterfaces.MessageExportInterface {
		return &MessageExportInterfaceImpl{app.Srv()}
	})
}

func (m *MessageExportInterfaceImpl) StartSynchronizeJob(rctx request.CTX, exportFromTimestamp int64) (*model.Job, *model.AppError) {
	// if a valid export time was specified, put it in the job data
	jobData := make(map[string]string)
	if exportFromTimestamp >= 0 {
		jobData[JobDataBatchStartTimestamp] = strconv.FormatInt(exportFromTimestamp, 10)
	}

	// passing nil for job data will cause the worker to inherit start time from previously successful job
	job, err := m.Server.Jobs.CreateJob(rctx, model.JobTypeMessageExport, jobData)
	if err != nil {
		return nil, err
	}

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for job.Status == model.JobStatusPending ||
		job.Status == model.JobStatusInProgress ||
		job.Status == model.JobStatusCancelRequested {
		select {
		case <-ticker.C:
			job, err = m.Server.Jobs.GetJob(rctx, job.Id)
			if err != nil {
				return nil, err
			}
		case <-rctx.Context().Done():
			return nil, model.NewAppError("StartSynchronizeJob", "ent.jobs.start_synchronize_job.timeout", nil, "", 0).Wrap(rctx.Context().Err())
		}
	}

	return job, nil
}

func (m *MessageExportInterfaceImpl) RunExport(rctx request.CTX, exportType string, since int64, limit int) (warningCount int64, appErr *model.AppError) {
	if limit < 0 {
		limit = math.MaxInt64
	}

	jobEndTime := model.GetMillis()

	var channelMetadata map[string]*common_export.MetadataChannel
	var channelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	if exportType == model.ComplianceExportTypeActiance {
		var err error
		reportProgress := func(message string) {
			rctx.Logger().Debug(message)
		}
		channelMetadata, channelMemberHistories, err = common_export.CalculateChannelExports(rctx, common_export.ChannelExportsParams{
			Store:                   m.Server.Store(),
			ExportPeriodStartTime:   since,
			ExportPeriodEndTime:     jobEndTime,
			ChannelBatchSize:        *m.Server.Config().MessageExportSettings.ChannelBatchSize,
			ChannelHistoryBatchSize: *m.Server.Config().MessageExportSettings.ChannelHistoryBatchSize,
			ReportProgressMessage:   reportProgress,
		})
		if err != nil {
			return warningCount, model.NewAppError("RunExport", "ent.message_export.calculate_channel_exports.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	postsToExport, _, err := m.Server.Store().Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: since}, limit)
	if err != nil {
		return warningCount, model.NewAppError("RunExport", "ent.message_export.run_export.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Debug("Found posts to export", mlog.Int("num_posts", len(postsToExport)))

	fileBackend := m.Server.FileBackend()
	templatesDir, ok := fileutils.FindDir("templates")
	if !ok {
		return warningCount, model.NewAppError("RunExport", "ent.compliance.run_export.template_watcher.appError", nil, "", http.StatusAccepted)
	}

	t, err2 := templates.New(templatesDir)
	if err2 != nil {
		return warningCount, model.NewAppError("RunExport", "ent.compliance.run_export.template_watcher.appError", nil, "", http.StatusAccepted).Wrap(err2)
	}

	batchPath := getBatchPath("", since, model.GetMillis(), 1)
	return runExportByType(rctx, exportParams{
		exportType:             exportType,
		channelMetadata:        channelMetadata,
		channelMemberHistories: channelMemberHistories,
		postsToExport:          postsToExport,
		batchPath:              batchPath,
		batchStartTime:         since,
		batchEndTime:           jobEndTime,
		db:                     m.Server.Store(),
		fileBackend:            fileBackend,
		htmlTemplates:          t,
		config:                 m.Server.Config(),
	})
}

type exportParams struct {
	exportType             string
	channelMetadata        map[string]*common_export.MetadataChannel
	channelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	postsToExport          []*model.MessageExport
	batchPath              string
	batchStartTime         int64
	batchEndTime           int64
	db                     store.Store
	fileBackend            filestore.FileBackend
	htmlTemplates          *templates.Container
	config                 *model.Config
}

func runExportByType(rctx request.CTX, p exportParams) (warningCount int64, appErr *model.AppError) {
	preparePosts(rctx, p.postsToExport)

	switch p.exportType {
	case model.ComplianceExportTypeCsv:
		rctx.Logger().Debug("Exporting CSV")
		return csv_export.CsvExport(rctx, p.postsToExport, p.db, p.fileBackend, p.batchPath)

	case model.ComplianceExportTypeActiance:
		rctx.Logger().Debug("Exporting Actiance")
		return actiance_export.ActianceExport(rctx, actiance_export.Params{
			ChannelMetadata:        p.channelMetadata,
			Posts:                  p.postsToExport,
			ChannelMemberHistories: p.channelMemberHistories,
			BatchPath:              p.batchPath,
			BatchStartTime:         p.batchStartTime,
			BatchEndTime:           p.batchEndTime,
			Db:                     p.db,
			FileBackend:            p.fileBackend,
		})

	case model.ComplianceExportTypeGlobalrelay, model.ComplianceExportTypeGlobalrelayZip:
		rctx.Logger().Debug("Exporting GlobalRelay")
		f, err := os.CreateTemp("", "")
		if err != nil {
			return warningCount, model.NewAppError("RunExport", "ent.compliance.global_relay.open_temporary_file.appError", nil, "", http.StatusAccepted).Wrap(err)
		}
		defer file.DeleteTemp(rctx.Logger(), f)

		attachmentsRemovedPostIDs, warnings, appErr := global_relay_export.GlobalRelayExport(rctx, p.postsToExport, p.db, p.fileBackend, f, p.htmlTemplates)
		if appErr != nil {
			return warningCount, appErr
		}
		warningCount = warnings
		_, err = f.Seek(0, 0)
		if err != nil {
			return warningCount, model.NewAppError("RunExport", "ent.compliance.global_relay.rewind_temporary_file.appError", nil, "", http.StatusAccepted).Wrap(err)
		}

		if p.exportType == model.ComplianceExportTypeGlobalrelayZip {
			// Try to disable the write timeout for the potentially big export file.
			_, nErr := filestore.TryWriteFileContext(rctx.Context(), p.fileBackend, f, p.batchPath)
			if nErr != nil {
				return warningCount, model.NewAppError("runExportByType", "ent.compliance.global_relay.write_file.appError", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		} else {
			appErr = global_relay_export.Deliver(f, p.config)
			if appErr != nil {
				return warningCount, appErr
			}
		}

		if len(attachmentsRemovedPostIDs) > 0 {
			rctx.Logger().Debug("Global Relay Attachments Removed because they were too large to send to Global Relay", mlog.Array("attachment_ids", attachmentsRemovedPostIDs))
			description := fmt.Sprintf("Attachments to post IDs %v were removed because they were too large to send to Global Relay.", attachmentsRemovedPostIDs)
			appErr = model.NewAppError("RunExport", "ent.compliance.global_relay.attachments_removed.appError", map[string]any{"Description": description}, description, http.StatusAccepted)
			return warningCount, appErr
		}
	default:
		err := errors.New("Unknown output format " + p.exportType)
		return warningCount, model.NewAppError("RunExport", "ent.compliance.bad_export_type.appError", map[string]any{"ExportType": p.exportType}, "", http.StatusBadRequest).Wrap(err)
	}
	return warningCount, nil
}

func preparePosts(rctx request.CTX, postsToExport []*model.MessageExport) {
	// go through all the posts and if the post's props contain 'from_bot' - override the IsBot field, since it's possible that the sender is not a user, but was a Bot and vise-versa
	for _, post := range postsToExport {
		if post.PostProps != nil {
			props := map[string]any{}

			if json.Unmarshal([]byte(*post.PostProps), &props) == nil {
				if val, ok := props["from_bot"]; ok {
					post.IsBot = val == "true"
				}
			}
		}

		// Team info can be null for DM/GM channels.
		if post.TeamId == nil {
			post.TeamId = new(string)
		}
		if post.TeamName == nil {
			post.TeamName = new(string)
		}
		if post.TeamDisplayName == nil {
			post.TeamDisplayName = new(string)
		}

		// make sure user information is present. Set defaults and log an error otherwise.
		if post.ChannelId == nil {
			rctx.Logger().Warn("ChannelId is missing for post", mlog.String("post_id", *post.PostId))
			post.ChannelId = new(string)
		}
		if post.ChannelName == nil {
			rctx.Logger().Warn("ChannelName is missing for post", mlog.String("post_id", *post.PostId))
			post.ChannelName = new(string)
		}
		if post.ChannelDisplayName == nil {
			rctx.Logger().Warn("ChannelDisplayName is missing for post", mlog.String("post_id", *post.PostId))
			post.ChannelDisplayName = new(string)
		}
		if post.ChannelType == nil {
			rctx.Logger().Warn("ChannelType is missing for post", mlog.String("post_id", *post.PostId))
			post.ChannelType = new(model.ChannelType)
		}

		if post.UserId == nil {
			rctx.Logger().Warn("UserId is missing for post", mlog.String("post_id", *post.PostId))
			post.UserId = new(string)
		}
		if post.UserEmail == nil {
			rctx.Logger().Warn("UserEmail is missing for post", mlog.String("post_id", *post.PostId))
			post.UserEmail = new(string)
		}
		if post.Username == nil {
			rctx.Logger().Warn("Username is missing for post", mlog.String("post_id", *post.PostId))
			post.Username = new(string)
		}

		if post.PostType == nil {
			rctx.Logger().Warn("Type is missing for post", mlog.String("post_id", *post.PostId))
			post.PostType = new(string)
		}
		if post.PostMessage == nil {
			rctx.Logger().Warn("Message is missing for post", mlog.String("post_id", *post.PostId))
			post.PostMessage = new(string)
		}
		if post.PostCreateAt == nil {
			rctx.Logger().Warn("CreateAt is missing for post", mlog.String("post_id", *post.PostId))
			post.PostCreateAt = new(int64)
		}
	}
}
