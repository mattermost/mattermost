// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
	"encoding/json"
	"fmt"
	"path"
	"strconv"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	MissingFileMessageDuringBackendRead = "File backend read: File missing for post; cannot copy file to archive"
	MissingFileMessageDuringCopy        = "Copy buffer: File missing for post; cannot copy file to archive"

	EstimatedPostCount = 10_000_000

	// JobDataBatchStartTime is the posts.updateat value from the previous batch. Posts are selected using
	// keyset pagination sorted by (posts.updateat, posts.id).
	JobDataBatchStartTime = "batch_start_time"

	// JobDataJobStartTime is the start of the job (doesn't change across batches)
	JobDataJobStartTime = "job_start_time"

	// JobDataBatchStartId is the posts.id value from the previous batch.
	JobDataBatchStartId = "batch_start_id"

	// JobDataJobEndTime is the point up to which this job is exporting. It is the time the job was started,
	// i.e., we export everything from the end of previous batch to the moment this batch started.
	JobDataJobEndTime = "job_end_time"

	JobDataJobStartId              = "job_start_id"
	JobDataExportType              = "export_type"
	JobDataBatchSize               = "batch_size"
	JobDataChannelBatchSize        = "channel_batch_size"
	JobDataChannelHistoryBatchSize = "channel_history_batch_size"
	JobDataMessagesExported        = "messages_exported"
	JobDataWarningCount            = "warning_count"
	JobDataIsDownloadable          = "is_downloadable"
	JobDataExportDir               = "export_dir"
	JobDataBatchNumber             = "job_batch_number"
	JobDataTotalPostsExpected      = "total_posts_expected"
)

type PostUpdatedType string

const (
	EditedOriginalMsg  PostUpdatedType = "EditedOriginalMsg"
	EditedNewMsg       PostUpdatedType = "EditedNewMsg"
	UpdatedNoMsgChange PostUpdatedType = "UpdatedNoMsgChange"
	Deleted            PostUpdatedType = "Deleted"
	FileDeleted        PostUpdatedType = "FileDeleted"
)

// JobData keeps the current state of the job.
// When used by a worker, all fields in JobDataExported are exported to the job's job.Data prop bag.
type JobData struct {
	JobDataExported

	ExportPeriodStartTime int64

	// This section is the current state of the export
	ChannelMetadata        map[string]*MetadataChannel
	ChannelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	Cursor                 model.MessageExportCursor
	PostsToExport          []*model.MessageExport
	BatchEndTime           int64
	BatchPath              string
	MessageExportMs        []int64
	ProcessingPostsMs      []int64
	ProcessingXmlMs        []int64
	TransferringFilesMs    []int64
	TransferringZipMs      []int64
	TotalBatchMs           []int64
	Finished               bool
}

type JobDataExported struct {
	ExportType              string
	ExportDir               string
	BatchStartTime          int64
	BatchStartId            string
	JobStartTime            int64
	JobEndTime              int64
	JobStartId              string
	BatchSize               int
	ChannelBatchSize        int
	ChannelHistoryBatchSize int
	BatchNumber             int
	TotalPostsExpected      int
	MessagesExported        int
	WarningCount            int
	IsDownloadable          bool
}

func JobDataToStringMap(jd JobData) map[string]string {
	ret := make(map[string]string)
	ret[JobDataExportType] = jd.ExportType
	ret[JobDataExportDir] = jd.ExportDir
	ret[JobDataBatchStartTime] = strconv.FormatInt(jd.BatchStartTime, 10)
	ret[JobDataBatchStartId] = jd.BatchStartId
	ret[JobDataJobStartTime] = strconv.FormatInt(jd.JobStartTime, 10)
	ret[JobDataJobEndTime] = strconv.FormatInt(jd.JobEndTime, 10)
	ret[JobDataJobStartId] = jd.JobStartId
	ret[JobDataBatchSize] = strconv.Itoa(jd.BatchSize)
	ret[JobDataChannelBatchSize] = strconv.Itoa(jd.ChannelBatchSize)
	ret[JobDataChannelHistoryBatchSize] = strconv.Itoa(jd.ChannelHistoryBatchSize)
	ret[JobDataBatchNumber] = strconv.Itoa(jd.BatchNumber)
	ret[JobDataTotalPostsExpected] = strconv.Itoa(jd.TotalPostsExpected)
	ret[JobDataMessagesExported] = strconv.Itoa(jd.MessagesExported)
	ret[JobDataWarningCount] = strconv.Itoa(jd.WarningCount)
	ret[JobDataIsDownloadable] = strconv.FormatBool(jd.IsDownloadable)
	return ret
}

func StringMapToJobDataWithZeroValues(sm map[string]string) (JobData, error) {
	var jd JobData
	var err error

	jd.ExportType = sm[JobDataExportType]
	jd.ExportDir = sm[JobDataExportDir]

	batchStartTime, ok := sm[JobDataBatchStartTime]
	if !ok {
		batchStartTime = "0"
	}
	if jd.BatchStartTime, err = strconv.ParseInt(batchStartTime, 10, 64); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataBatchStartTime")
	}

	jd.BatchStartId = sm[JobDataBatchStartId]

	jobStartTime, ok := sm[JobDataJobStartTime]
	if !ok {
		jobStartTime = "0"
	}
	if jd.JobStartTime, err = strconv.ParseInt(jobStartTime, 10, 64); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataJobStartTime")
	}

	jobEndTime, ok := sm[JobDataJobEndTime]
	if !ok {
		jobEndTime = "0"
	}
	if jd.JobEndTime, err = strconv.ParseInt(jobEndTime, 10, 64); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataJobEndTime")
	}

	jd.JobStartId = sm[JobDataJobStartId]

	jobBatchSize, ok := sm[JobDataBatchSize]
	if !ok {
		jobBatchSize = "0"
	}
	if jd.BatchSize, err = strconv.Atoi(jobBatchSize); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataBatchSize")
	}

	channelBatchSize, ok := sm[JobDataChannelBatchSize]
	if !ok {
		channelBatchSize = "0"
	}
	if jd.ChannelBatchSize, err = strconv.Atoi(channelBatchSize); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataChannelBatchSize")
	}

	channelHistoryBatchSize, ok := sm[JobDataChannelHistoryBatchSize]
	if !ok {
		channelHistoryBatchSize = "0"
	}
	if jd.ChannelHistoryBatchSize, err = strconv.Atoi(channelHistoryBatchSize); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataChannelHistoryBatchSize")
	}

	batchNumber, ok := sm[JobDataBatchNumber]
	if !ok {
		batchNumber = "0"
	}
	if jd.BatchNumber, err = strconv.Atoi(batchNumber); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataBatchNumber")
	}

	totalPostsExpected, ok := sm[JobDataTotalPostsExpected]
	if !ok {
		totalPostsExpected = "0"
	}
	if jd.TotalPostsExpected, err = strconv.Atoi(totalPostsExpected); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataTotalPostsExpected")
	}

	messagesExported, ok := sm[JobDataMessagesExported]
	if !ok {
		messagesExported = "0"
	}
	if jd.MessagesExported, err = strconv.Atoi(messagesExported); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataMessagesExported")
	}

	warningCount, ok := sm[JobDataWarningCount]
	if !ok {
		warningCount = "0"
	}
	if jd.WarningCount, err = strconv.Atoi(warningCount); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataWarningCount")
	}

	isDownloadable, ok := sm[JobDataIsDownloadable]
	if !ok {
		isDownloadable = "0"
	}
	if jd.IsDownloadable, err = strconv.ParseBool(isDownloadable); err != nil {
		return jd, errors.Wrap(err, "error converting JobDataIsDownloadable")
	}

	return jd, nil
}

type BackendParams struct {
	Config                *model.Config
	Store                 MessageExportStore
	FileAttachmentBackend filestore.FileBackend
	ExportBackend         filestore.FileBackend
	HtmlTemplates         *templates.Container
}

type ExportParams struct {
	ExportType             string
	ChannelMetadata        map[string]*MetadataChannel
	Posts                  []*model.MessageExport
	ChannelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	JobStartTime           int64
	BatchPath              string
	BatchStartTime         int64
	BatchEndTime           int64
	Config                 *model.Config
	Db                     MessageExportStore
	FileAttachmentBackend  filestore.FileBackend
	ExportBackend          filestore.FileBackend
	Templates              *templates.Container
}

type WriteExportResult struct {
	TransferringFilesMs int64
	ProcessingXmlMs     int64
	TransferringZipMs   int64
	NumWarnings         int
}

type RunExportResults struct {
	CreatedPosts       int
	EditedOrigMsgPosts int
	EditedNewMsgPosts  int
	UpdatedPosts       int
	DeletedPosts       int
	UploadedFiles      int
	DeletedFiles       int
	NumChannels        int
	Joins              int
	Leaves             int
	ProcessingPostsMs  int64
	WriteExportResult
}

type ChannelMemberJoin struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
	Datetime int64
}

type ChannelMemberLeave struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
	Datetime int64
}

type ChannelMember struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
}

type MetadataChannel struct {
	TeamId             *string
	TeamName           *string
	TeamDisplayName    *string
	ChannelId          string
	ChannelName        string
	ChannelDisplayName string
	ChannelType        model.ChannelType
	RoomId             string
	StartTime          int64
	EndTime            int64
	MessagesCount      int
	AttachmentsCount   int
}

type Metadata struct {
	Channels         map[string]*MetadataChannel
	MessagesCount    int
	AttachmentsCount int
	StartTime        int64
	EndTime          int64
}

func (metadata *Metadata) UpdateCounts(channelId string, numMessages int, numAttachments int) error {
	_, ok := metadata.Channels[channelId]
	if !ok {
		return fmt.Errorf("could not find channelId for post in metadata.Channels")
	}

	metadata.Channels[channelId].AttachmentsCount += numAttachments
	metadata.AttachmentsCount += numAttachments
	metadata.Channels[channelId].MessagesCount += numMessages
	metadata.MessagesCount += numMessages

	return nil
}

// GetInitialExportPeriodData calculates and caches the channel memberships, channel metadata, and the TotalPostsExpected.
func GetInitialExportPeriodData(rctx request.CTX, store MessageExportStore, data JobData, reportProgress func(string)) (JobData, error) {
	// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
	// on with the job anyway. The only issue is that the progress % reporting will be inaccurate.
	count, err := store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: data.JobStartId, SinceUpdateAt: data.ExportPeriodStartTime, UntilUpdateAt: data.JobEndTime})
	if err != nil {
		rctx.Logger().Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		data.TotalPostsExpected = EstimatedPostCount
	} else {
		data.TotalPostsExpected = int(count)
	}

	rctx.Logger().Info("Expecting to export total posts", mlog.Int("total_posts", data.TotalPostsExpected))

	// Every time we claim the job, we need to gather the membership data that every batch will use.
	// If we're here, then either this is the start of the job, or the job was stopped (e.g., the worker stopped)
	// and we've claimed it again. Either way, we need to recalculate channel and member history data.
	data.ChannelMetadata, data.ChannelMemberHistories, err = CalculateChannelExports(rctx,
		ChannelExportsParams{
			Store:                   store,
			ExportPeriodStartTime:   data.ExportPeriodStartTime,
			ExportPeriodEndTime:     data.JobEndTime,
			ChannelBatchSize:        data.ChannelBatchSize,
			ChannelHistoryBatchSize: data.ChannelHistoryBatchSize,
			ReportProgressMessage:   reportProgress,
		})
	if err != nil {
		return data, err
	}

	data.Cursor = model.MessageExportCursor{
		LastPostUpdateAt: data.BatchStartTime,
		LastPostId:       data.BatchStartId,
		UntilUpdateAt:    data.JobEndTime,
	}

	return data, nil
}

type ChannelExportsParams struct {
	Store                   MessageExportStore
	ExportPeriodStartTime   int64
	ExportPeriodEndTime     int64
	ChannelBatchSize        int
	ChannelHistoryBatchSize int
	ReportProgressMessage   func(message string)
}

// CalculateChannelExports returns the channel info ( map[channelId]*MetadataChannel ) and the channel user
// joins/leaves ( map[channelId][]*model.ChannelMemberHistoryResult ) for any channel that has had activity
// (posts or user join/leaves) between ExportPeriodStartTime and ExportPeriodEndTime.
func CalculateChannelExports(rctx request.CTX, opt ChannelExportsParams) (map[string]*MetadataChannel, map[string][]*model.ChannelMemberHistoryResult, error) {
	// Which channels had user activity in the export period?
	activeChannelIds, err := opt.Store.ChannelMemberHistory().GetChannelsWithActivityDuring(opt.ExportPeriodStartTime, opt.ExportPeriodEndTime)
	if err != nil {
		return nil, nil, err
	}

	if len(activeChannelIds) == 0 {
		return nil, nil, nil
	}

	rctx.Logger().Debug("Started CalculateChannelExports", mlog.Int("export_period_start_time", opt.ExportPeriodStartTime), mlog.Int("export_period_end_time", opt.ExportPeriodEndTime), mlog.Int("num_active_channel_ids", len(activeChannelIds)))
	message := rctx.T("ent.message_export.actiance_export.calculate_channel_exports.channel_message", model.StringMap{"NumChannels": strconv.Itoa(len(activeChannelIds))})
	opt.ReportProgressMessage(message)

	// For each channel, get its metadata.
	channelMetadata := make(map[string]*MetadataChannel, len(activeChannelIds))

	// Use batches to reduce db load and network waste.
	for pos := 0; pos < len(activeChannelIds); pos += opt.ChannelBatchSize {
		upTo := min(pos+opt.ChannelBatchSize, len(activeChannelIds))
		batch := activeChannelIds[pos:upTo]
		channels, err := opt.Store.Channel().GetMany(batch, true)
		if err != nil {
			return nil, nil, err
		}

		for _, channel := range channels {
			channelMetadata[channel.Id] = &MetadataChannel{
				TeamId:             model.NewPointer(channel.TeamId),
				ChannelId:          channel.Id,
				ChannelName:        channel.Name,
				ChannelDisplayName: channel.DisplayName,
				ChannelType:        channel.Type,
				RoomId:             fmt.Sprintf("%v - %v", ChannelTypeDisplayName(channel.Type), channel.Id),
				StartTime:          opt.ExportPeriodStartTime,
				EndTime:            opt.ExportPeriodEndTime,
			}
		}
	}

	historiesByChannelId := make(map[string][]*model.ChannelMemberHistoryResult, len(activeChannelIds))

	var batchTimes []int64

	// Now that we have metadata, get channelMemberHistories for each channel.
	// Use batches to reduce total db load and network waste.
	for pos := 0; pos < len(activeChannelIds); pos += opt.ChannelHistoryBatchSize {
		// This may take a while, so update the system console UI.
		message := rctx.T("ent.message_export.actiance_export.calculate_channel_exports.activity_message", model.StringMap{
			"NumChannels":  strconv.Itoa(len(activeChannelIds)),
			"NumCompleted": strconv.Itoa(pos),
		})
		opt.ReportProgressMessage(message)

		start := time.Now()

		upTo := min(pos+opt.ChannelHistoryBatchSize, len(activeChannelIds))
		batch := activeChannelIds[pos:upTo]
		channelMemberHistories, err := opt.Store.ChannelMemberHistory().GetUsersInChannelDuring(opt.ExportPeriodStartTime, opt.ExportPeriodEndTime, batch)
		if err != nil {
			return nil, nil, err
		}

		batchTimes = append(batchTimes, time.Since(start).Milliseconds())

		// collect the channelMemberHistories by channelId
		for _, entry := range channelMemberHistories {
			historiesByChannelId[entry.ChannelId] = append(historiesByChannelId[entry.ChannelId], entry)
		}
	}

	rctx.Logger().Info("GetUsersInChannelDuring batch times", mlog.Array("batch_times", batchTimes))

	return channelMetadata, historiesByChannelId, nil
}

// ChannelHasActivity returns true if the channel (represented by the []*model.ChannelMemberHistoryResult slice)
// had user activity between startTime and endTime
func ChannelHasActivity(cmhs []*model.ChannelMemberHistoryResult, startTime int64, endTime int64) bool {
	for _, cmh := range cmhs {
		if (cmh.JoinTime >= startTime && cmh.JoinTime <= endTime) ||
			(cmh.LeaveTime != nil && *cmh.LeaveTime >= startTime && *cmh.LeaveTime <= endTime) {
			return true
		}
	}
	return false
}

func GetJoinsAndLeavesForChannel(startTime int64, endTime int64, channelMembersHistory []*model.ChannelMemberHistoryResult,
	postAuthors map[string]ChannelMember) ([]ChannelMemberJoin, []ChannelMemberLeave) {
	var joins []ChannelMemberJoin
	var leaves []ChannelMemberLeave

	alreadyJoined := make(map[string]bool)
	for _, cmh := range channelMembersHistory {
		if cmh.UserDeleteAt > 0 && cmh.UserDeleteAt < startTime {
			continue
		}

		if cmh.JoinTime > endTime {
			continue
		}

		if cmh.LeaveTime != nil && *cmh.LeaveTime < startTime {
			continue
		}

		if cmh.JoinTime <= endTime {
			joins = append(joins, ChannelMemberJoin{
				UserId:   cmh.UserId,
				IsBot:    cmh.IsBot,
				Email:    cmh.UserEmail,
				Username: cmh.Username,
				Datetime: cmh.JoinTime,
			})
			alreadyJoined[cmh.UserId] = true
		}

		if cmh.LeaveTime != nil && *cmh.LeaveTime <= endTime {
			leaves = append(leaves, ChannelMemberLeave{
				UserId:   cmh.UserId,
				IsBot:    cmh.IsBot,
				Email:    cmh.UserEmail,
				Username: cmh.Username,
				Datetime: *cmh.LeaveTime,
			})
		}
	}

	for _, member := range postAuthors {
		if alreadyJoined[member.UserId] {
			continue
		}

		joins = append(joins, ChannelMemberJoin{
			UserId:   member.UserId,
			IsBot:    member.IsBot,
			Email:    member.Email,
			Username: member.Username,
			Datetime: startTime,
		})
	}
	return joins, leaves
}

// GetPostAttachments if the post included any files, we need to add special elements to the export.
func GetPostAttachments(db MessageExportStore, post *model.MessageExport) ([]*model.FileInfo, error) {
	if len(post.PostFileIds) == 0 {
		return []*model.FileInfo{}, nil
	}

	attachments, err := db.FileInfo().GetForPost(*post.PostId, true, true, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info for a post: %w", err)
	}
	return attachments, nil
}

func ChannelTypeDisplayName(channelType model.ChannelType) string {
	return map[model.ChannelType]string{
		model.ChannelTypeOpen:    "public",
		model.ChannelTypePrivate: "private",
		model.ChannelTypeDirect:  "direct",
		model.ChannelTypeGroup:   "group",
	}[channelType]
}

func GetBatchPath(exportDir string, prevPostUpdateAt int64, lastPostUpdateAt int64, batchNumber int) string {
	if exportDir == "" {
		exportDir = path.Join(model.ComplianceExportPath, time.Now().Format(model.ComplianceExportDirectoryFormat))
	}
	return path.Join(exportDir,
		fmt.Sprintf("batch%03d-%d-%d.zip", batchNumber, prevPostUpdateAt, lastPostUpdateAt))
}

// GetExportBackend returns the file backend where the export will be created.
func GetExportBackend(rctx request.CTX, config *model.Config) (filestore.FileBackend, error) {
	insecure := config.ServiceSettings.EnableInsecureOutgoingConnections
	skipVerify := insecure != nil && *insecure

	if config.FileSettings.DedicatedExportStore != nil && *config.FileSettings.DedicatedExportStore {
		rctx.Logger().Debug("Worker: using dedicated export filestore", mlog.String("driver_name", *config.FileSettings.ExportDriverName))
		backend, errFileBack := filestore.NewExportFileBackend(filestore.NewExportFileBackendSettingsFromConfig(&config.FileSettings, true, skipVerify))
		if errFileBack != nil {
			return nil, errFileBack
		}

		return backend, nil
	}

	backend, err := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&config.FileSettings, true, skipVerify))
	if err != nil {
		return nil, err
	}
	return backend, nil
}

// GetFileAttachmentBackend returns the file backend where file attachments are
// located for messages that will be exported. This may be the same backend
// where the export will be created.
func GetFileAttachmentBackend(rctx request.CTX, config *model.Config) (filestore.FileBackend, error) {
	insecure := config.ServiceSettings.EnableInsecureOutgoingConnections

	backend, err := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&config.FileSettings, true, insecure != nil && *insecure))
	if err != nil {
		return nil, err
	}
	return backend, nil
}

func IsDeletedMsg(post *model.MessageExport) bool {
	if model.SafeDereference(post.PostDeleteAt) > 0 && post.PostProps != nil {
		props := map[string]any{}
		err := json.Unmarshal([]byte(*post.PostProps), &props)
		if err != nil {
			return false
		}

		if _, ok := props[model.PostPropsDeleteBy]; ok {
			return true
		}
	}
	return false
}
