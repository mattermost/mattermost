// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/actiance_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/csv_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/global_relay_export"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
)

const GlobalRelayExportFilename = "global-relay.zip"

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

func RunBatch(rctx request.CTX, data shared.JobData, params shared.BackendParams) (shared.RunExportResults, shared.JobData, error) {
	var err error
	var res shared.RunExportResults
	data, err = GetDataForBatch(rctx, data, params)
	if err != nil {
		return res, data, err
	}

	if data.Finished {
		return res, data, nil
	}

	// Now write the data to the export type.
	res, err = RunExportByType(rctx, DataToExportParams(data), params)
	if err != nil {
		return res, data, err
	}

	data.TotalWarningCount += res.NumWarnings
	data.BatchStartTime = data.BatchEndTime

	return res, data, err
}

// GetDataForBatch gets the posts for this batch and updates JobData with the current state.
func GetDataForBatch(rctx request.CTX, data shared.JobData, params shared.BackendParams) (shared.JobData, error) {
	var err error
	// Using BatchSize+1 is a trick to test whether or not we've reached the final batch.
	data.PostsToExport, data.Cursor, err = params.Store.Compliance().MessageExport(rctx, data.Cursor, data.BatchSize+1)
	if err != nil {
		return data, err
	}

	if len(data.PostsToExport) == data.BatchSize+1 {
		// We still have posts after this current batch.
		// Remove the last post, we have to leave it for the next batch.
		lastPostIdx := len(data.PostsToExport) - 1
		data.PostsToExport = data.PostsToExport[:lastPostIdx]
		lastPostIdx = len(data.PostsToExport) - 1
		data.Cursor.LastPostUpdateAt = *data.PostsToExport[lastPostIdx].PostUpdateAt
		data.Cursor.LastPostId = *data.PostsToExport[lastPostIdx].PostId
		data.BatchEndTime = data.Cursor.LastPostUpdateAt
	} else {
		// We've reached the final batch; we need to include all join/leave events that occur after the lastpost.
		// This will let us also pick up the joins/leaves that occur after lastPostUpdateAt but before JobEndTime.
		data.BatchEndTime = data.JobEndTime
	}

	if len(data.PostsToExport) == 0 {
		data.Finished = true
		return data, nil
	}

	rctx.Logger().Debug("Found posts to export", mlog.Int("num_posts", len(data.PostsToExport)))
	data.TotalPostsExported += len(data.PostsToExport)
	data.BatchNumber++
	data.BatchPath = shared.GetBatchPath(data.ExportDir, data.BatchStartTime, data.BatchEndTime, data.BatchNumber)

	return data, nil
}

type ExportParams struct {
	ExportType             string
	ChannelMetadata        map[string]*shared.MetadataChannel
	ChannelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	PostsToExport          []*model.MessageExport
	BatchPath              string
	BatchStartTime         int64
	BatchEndTime           int64
}

func DataToExportParams(data shared.JobData) ExportParams {
	return ExportParams{
		ExportType:             data.ExportType,
		ChannelMetadata:        data.ChannelMetadata,
		ChannelMemberHistories: data.ChannelMemberHistories,
		PostsToExport:          data.PostsToExport,
		BatchPath:              data.BatchPath,
		BatchStartTime:         data.BatchStartTime,
		BatchEndTime:           data.BatchEndTime,
	}
}

func RunExportByType(rctx request.CTX, p ExportParams, b shared.BackendParams) (results shared.RunExportResults, err error) {
	preparePosts(rctx, p.PostsToExport)

	switch p.ExportType {
	case model.ComplianceExportTypeCsv:
		rctx.Logger().Debug("Exporting CSV")
		results.NumWarnings, err = csv_export.CsvExport(rctx, p.PostsToExport, b.Store, b.FileBackend, p.BatchPath)
		return results, err

	case model.ComplianceExportTypeActiance:
		rctx.Logger().Debug("Exporting Actiance")
		return actiance_export.ActianceExport(rctx, actiance_export.Params{
			ChannelMetadata:        p.ChannelMetadata,
			Posts:                  p.PostsToExport,
			ChannelMemberHistories: p.ChannelMemberHistories,
			BatchPath:              p.BatchPath,
			BatchStartTime:         p.BatchStartTime,
			BatchEndTime:           p.BatchEndTime,
			Db:                     b.Store,
			FileBackend:            b.FileBackend,
		})

	case model.ComplianceExportTypeGlobalrelay, model.ComplianceExportTypeGlobalrelayZip:
		rctx.Logger().Debug("Exporting GlobalRelay")
		f, err := os.CreateTemp("", "")
		if err != nil {
			return results, fmt.Errorf("unable to open the temporary export file: %w", err)
		}
		defer file.DeleteTemp(rctx.Logger(), f)

		var attachmentsRemovedPostIDs []string
		attachmentsRemovedPostIDs, results.NumWarnings, err = global_relay_export.GlobalRelayExport(rctx, p.PostsToExport, b.Store, b.FileBackend, f, b.HtmlTemplates)
		if err != nil {
			return results, err
		}

		_, err = f.Seek(0, 0)
		if err != nil {
			return results, fmt.Errorf("unable to re-read the Global Relay temporary export file: %w", err)
		}

		if p.ExportType == model.ComplianceExportTypeGlobalrelayZip {
			// Try to disable the write timeout for the potentially big export file.
			_, err = filestore.TryWriteFileContext(rctx.Context(), b.FileBackend, f, p.BatchPath)
			if err != nil {
				return results, fmt.Errorf("unable to write the global relay file: %w", err)
			}
		} else {
			err = global_relay_export.Deliver(f, b.Config)
			if err != nil {
				return results, err
			}
		}

		if len(attachmentsRemovedPostIDs) > 0 {
			rctx.Logger().Warn("Global Relay Attachments Removed because they were too large to send to Global Relay",
				mlog.Int("number_of_attachments_removed", len(attachmentsRemovedPostIDs)))
			rctx.Logger().Warn("List of posts which had attachments removed",
				mlog.Array("post_ids", attachmentsRemovedPostIDs))
			return results, nil
		}
	default:
		return results, errors.New("Unknown output format: " + p.ExportType)
	}

	return results, nil
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
