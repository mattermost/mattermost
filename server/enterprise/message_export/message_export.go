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
	postsToExport, _, err := m.Server.Store().Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: since}, limit)
	if err != nil {
		return warningCount, model.NewAppError("RunExport", "ent.message_export.run_export.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Debug("Found posts to export", mlog.Int("number_of_posts", len(postsToExport)))

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
	return runExportByType(rctx, exportType, postsToExport, batchPath, m.Server.Store(), fileBackend, t, m.Server.Config())
}

func runExportByType(rctx request.CTX, exportType string, postsToExport []*model.MessageExport, batchPath string, db store.Store, fileBackend filestore.FileBackend, htmlTemplates *templates.Container, config *model.Config) (warningCount int64, appErr *model.AppError) {
	preparePosts(rctx, postsToExport)

	switch exportType {
	case model.ComplianceExportTypeCsv:
		rctx.Logger().Debug("Exporting CSV")
		return csv_export.CsvExport(rctx, postsToExport, db, fileBackend, batchPath)

	case model.ComplianceExportTypeActiance:
		rctx.Logger().Debug("Exporting Actiance")
		return actiance_export.ActianceExport(rctx, postsToExport, db, fileBackend, batchPath)

	case model.ComplianceExportTypeGlobalrelay, model.ComplianceExportTypeGlobalrelayZip:
		rctx.Logger().Debug("Exporting GlobalRelay")
		f, err := os.CreateTemp("", "")
		if err != nil {
			return warningCount, model.NewAppError("RunExport", "ent.compliance.global_relay.open_temporary_file.appError", nil, "", http.StatusAccepted).Wrap(err)
		}
		defer file.DeleteTemp(rctx.Logger(), f)

		attachmentsRemovedPostIDs, warnings, appErr := global_relay_export.GlobalRelayExport(rctx, postsToExport, db, fileBackend, f, htmlTemplates)
		if appErr != nil {
			return warningCount, appErr
		}
		warningCount = warnings
		_, err = f.Seek(0, 0)
		if err != nil {
			return warningCount, model.NewAppError("RunExport", "ent.compliance.global_relay.rewind_temporary_file.appError", nil, "", http.StatusAccepted).Wrap(err)
		}

		if exportType == model.ComplianceExportTypeGlobalrelayZip {
			// Try to disable the write timeout for the potentially big export file.
			_, nErr := filestore.TryWriteFileContext(rctx.Context(), fileBackend, f, batchPath)
			if nErr != nil {
				return warningCount, model.NewAppError("runExportByType", "ent.compliance.global_relay.write_file.appError", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		} else {
			appErr = global_relay_export.Deliver(f, config)
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
		err := errors.New("Unknown output format " + exportType)
		return warningCount, model.NewAppError("RunExport", "ent.compliance.bad_export_type.appError", map[string]any{"ExportType": exportType}, "", http.StatusBadRequest).Wrap(err)
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
