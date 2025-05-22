// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	st "github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type MessageExport struct {
	TeamId          string
	TeamName        string
	TeamDisplayName string

	ChannelId          string
	ChannelName        string
	ChannelDisplayName string
	ChannelType        model.ChannelType

	UserId    string
	UserEmail string
	Username  string
	IsBot     bool

	PostId         string
	PostCreateAt   int64
	PostUpdateAt   int64
	PostDeleteAt   int64
	PostEditAt     int64
	PostMessage    string
	PostType       string
	PostRootId     string
	PostProps      string
	PostOriginalId string
	PostFileIds    []string
}

func removePointers(p *model.MessageExport) MessageExport {
	return MessageExport{
		TeamId:             model.SafeDereference(p.TeamId),
		TeamName:           model.SafeDereference(p.TeamName),
		TeamDisplayName:    model.SafeDereference(p.TeamDisplayName),
		ChannelId:          model.SafeDereference(p.ChannelId),
		ChannelName:        model.SafeDereference(p.ChannelName),
		ChannelDisplayName: model.SafeDereference(p.ChannelDisplayName),
		ChannelType:        model.SafeDereference(p.ChannelType),
		UserId:             model.SafeDereference(p.UserId),
		UserEmail:          model.SafeDereference(p.UserEmail),
		Username:           model.SafeDereference(p.Username),
		IsBot:              p.IsBot,
		PostId:             model.SafeDereference(p.PostId),
		PostCreateAt:       model.SafeDereference(p.PostCreateAt),
		PostUpdateAt:       model.SafeDereference(p.PostUpdateAt),
		PostDeleteAt:       model.SafeDereference(p.PostDeleteAt),
		PostEditAt:         model.SafeDereference(p.PostEditAt),
		PostMessage:        model.SafeDereference(p.PostMessage),
		PostType:           model.SafeDereference(p.PostType),
		PostRootId:         model.SafeDereference(p.PostRootId),
		PostProps:          model.SafeDereference(p.PostProps),
		PostOriginalId:     model.SafeDereference(p.PostOriginalId),
		PostFileIds:        p.PostFileIds,
	}
}

// assertNumPostsToExport checks both the MessageExport and the AnalyticsPostCount -- they were sometimes giving
// different numbers and this helps debug.
func assertNumPostsToExport(t *testing.T, th *api4.TestHelper, num int, since, until int64) {
	exports, _, err := th.App.Srv().Store().Compliance().MessageExport(th.Context, model.MessageExportCursor{
		LastPostUpdateAt: since, UntilUpdateAt: until,
	}, 100)
	assert.NoError(t, err)
	assert.Len(t, exports, num)
	assert.Lenf(t, exports, num, "MessageExport posts found, since %d, th.BasicChannel.Id: %s\n", since, th.BasicChannel.Id)
	if len(exports) != num {
		for _, p := range exports {
			t.Logf("%#+v\n", removePointers(p))
		}
	}

	count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, UsersPostsOnly: true, SincePostID: "", SinceUpdateAt: since})
	require.NoError(t, err)
	assert.Equal(t, num, int(count))
}

func assertNumExported(t *testing.T, expectedNum int, data map[string]string) {
	numExported, err := strconv.Atoi(data[shared.JobDataMessagesExported])
	require.NoError(t, err)
	assert.Equalf(t, numExported, expectedNum, "\njobData: %v\n", data)
	require.Equal(t, expectedNum, numExported)
}

func getMostRecentJobWithId(t *testing.T, th *api4.TestHelper, id string) *model.Job {
	list, _, err := th.SystemAdminClient.GetJobsByType(context.Background(), "message_export", 0, 1)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, id, list[0].Id)
	return list[0]
}

func checkJobForStatus(t *testing.T, th *api4.TestHelper, id string, status string) {
	doneChan := make(chan bool)
	var job *model.Job
	go func() {
		defer close(doneChan)
		for {
			job = getMostRecentJobWithId(t, th, id)
			if job.Status == status {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.Equal(t, status, job.Status)
	}()
	select {
	case <-doneChan:
	case <-time.After(15 * time.Second):
		require.True(t, false, "expected job's status to be %s, got %s", status, job.Status)
	}
}

func runJobForTest(t *testing.T, th *api4.TestHelper, jobData map[string]string) *model.Job {
	job, _, err := th.SystemAdminClient.CreateJob(context.Background(),
		&model.Job{Type: "message_export", Data: jobData})
	require.NoError(t, err)
	// poll until completion
	checkJobForStatus(t, th, job.Id, "success")
	job = getMostRecentJobWithId(t, th, job.Id)
	return job
}

func setup(t *testing.T) *api4.TestHelper {
	jobs.DefaultWatcherPollingInterval = 100
	th := api4.SetupEnterprise(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("message_export"))
	messageExportImpl := MessageExportJobInterfaceImpl{th.App.Srv()}
	th.App.Srv().Jobs.RegisterJobType(model.JobTypeMessageExport, messageExportImpl.MakeWorker(), messageExportImpl.MakeScheduler())

	err := th.App.Srv().Jobs.StartWorkers()
	require.NoError(t, err)

	err = th.App.Srv().Jobs.StartSchedulers()
	require.NoError(t, err)

	return th
}

// jobDataInvariantsShouldBeEqual tests that the parts of the job.Data that shouldn't change, don't change.
func jobDataInvariantsShouldBeEqual(t *testing.T, expected map[string]string, received map[string]string) {
	assert.Equal(t, expected[shared.JobDataExportType], received[shared.JobDataExportType])
	assert.Equal(t, expected[shared.JobDataBatchSize], received[shared.JobDataBatchSize])
	assert.Equal(t, expected[shared.JobDataChannelBatchSize], received[shared.JobDataChannelBatchSize])
	assert.Equal(t, expected[shared.JobDataChannelHistoryBatchSize], received[shared.JobDataChannelHistoryBatchSize])
	assert.Equal(t, expected[shared.JobDataExportDir], received[shared.JobDataExportDir])
	assert.Equal(t, expected[shared.JobDataJobEndTime], received[shared.JobDataJobEndTime])
	assert.Equal(t, expected[shared.JobDataJobStartTime], received[shared.JobDataJobStartTime])
}

type joinLeave struct {
	join  int64
	leave int64
}
type batchStartEndTimes struct {
	start int64
	end   int64
}

type JobResults struct {
	start             int64
	joinLeaves        []joinLeave
	users             []*model.User
	createUpdateTimes []int64
	attachments       []*model.FileInfo
	contents          []string
	jobEndTime        int64
	batches           []string
	posts             []*model.Post
	channels          []*model.Channel
	teams             []*model.Team
	batchTimes        []batchStartEndTimes
	jobExportDir      string
}

func generateActianceBatchTest1(t *testing.T, th *api4.TestHelper, attachmentDir, exportDir string,
	attachmentBackend filestore.FileBackend) JobResults {
	now := model.GetMillis()
	jobStart := now - 1

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = jobStart
		*cfg.MessageExportSettings.BatchSize = 5
		*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	contents := []string{"Hello there"}
	attachmentPath001 := "path/to/attachments/one.txt"
	_, _ = attachmentBackend.WriteFile(bytes.NewBufferString(contents[0]), attachmentPath001)
	post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    st.NewTestID(),
		Message:   st.NewTestID(),
		CreateAt:  now,
		UpdateAt:  now,
		FileIds:   []string{"test1"},
	})
	require.NoError(t, err)

	attachment, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
		Id:        st.NewTestID(),
		CreatorId: post.UserId,
		PostId:    post.Id,
		CreateAt:  now,
		UpdateAt:  now,
		Path:      attachmentPath001,
	})
	require.NoError(t, err)
	attachments := []*model.FileInfo{attachment}

	for i := 0; i < 10; i++ {
		_, e := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    st.NewTestID(),
			Message:   st.NewTestID(),
			CreateAt:  now + int64(i),
			UpdateAt:  now + int64(i),
		})
		require.NoError(t, e)
	}

	until := model.GetMillis()
	assertNumPostsToExport(t, th, 11, jobStart, until)

	job := runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
	require.NoError(t, err)
	require.Equal(t, 0, warnings)

	numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
	require.NoError(t, err)
	require.Equal(t, int64(11), numExported)

	jobEnd, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 0, 64)
	require.NoError(t, err)
	jobExportDir := job.Data[shared.JobDataExportDir]
	batch001 := shared.GetBatchPath(jobExportDir, jobStart, now+3, 1)
	batch002 := shared.GetBatchPath(jobExportDir, now+3, now+8, 2)
	batch003 := shared.GetBatchPath(jobExportDir, now+8, jobEnd, 3)
	batches := []string{batch001, batch002, batch003}

	return JobResults{
		attachments:  attachments,
		contents:     contents,
		batches:      batches,
		jobExportDir: jobExportDir,
	}
}

func generateActianceBatchTest2(t *testing.T, th *api4.TestHelper, attachmentDir, exportDir string) JobResults {
	now := model.GetMillis()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.BatchSize = 3
		*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	for i := 0; i < 10; i++ {
		_, e := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    st.NewTestID(),
			Message:   st.NewTestID(),
			CreateAt:  now + int64(i),
			UpdateAt:  now + int64(i),
		})
		require.NoError(t, e)
	}

	// start at the 2nd post and get till the 7th post (inclusive) = 6 posts
	job := runJobForTest(t, th, map[string]string{
		shared.JobDataBatchStartTime: strconv.Itoa(int(now) + 1),
		shared.JobDataJobEndTime:     strconv.Itoa(int(now) + 6),
	})
	numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
	require.NoError(t, err)
	numExpected, err := strconv.ParseInt(job.Data[shared.JobDataTotalPostsExpected], 0, 64)
	require.NoError(t, err)
	// test that we only exported 6 (because the JobDataJobEndTime was translated to the cursor's UntilUpdateAt)
	require.Equal(t, 6, int(numExported))
	// test that we were reporting that correctly in the UI
	require.Equal(t, 6, int(numExpected))

	jobEnd, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 0, 64)
	require.NoError(t, err)
	require.Equal(t, now+6, jobEnd)
	jobExportDir := job.Data[shared.JobDataExportDir]
	batch001 := shared.GetBatchPath(jobExportDir, now+1, now+3, 1)
	// lastPostUpdateAt will be post#4 (now+3), even though we exported it above, because LastPostId will exclude it
	batch002 := shared.GetBatchPath(jobExportDir, now+3, now+6, 2)
	batches := []string{batch001, batch002}

	return JobResults{
		batches:      batches,
		jobExportDir: jobExportDir,
	}
}

func generateE2ETestType1Results(t *testing.T, th *api4.TestHelper, exportType, attachmentDir, exportDir string,
	attachmentBackend, exportBackend filestore.FileBackend, testStopping bool) JobResults {
	// This tests (reading the files exported and testing the actual exported data):
	//  - job system exports the complete time from beginning to end; i.e., it doesn't use the post updateAt values as the bounds, it uses the start time and end time of the job.
	//  - job system uses previous job's end time as the start for the next batch
	//  - user joins and leaves before the first post in the first batch (but after the job start time)
	//  - user joins and leaves before the first post in the second batch
	//  - user joins and leaves before the first post in the last batch
	//  - user joins and leaves after the last post in the last batch (but before the job end time)
	//  - channel with no posts but user activity (one user joins and leaves after start of batch period but before first post)
	//  - channel with no posts but user activity (one user leaves after last post but before end of batch period)
	//  - worked, but making sure we test for it specifically in e2e:
	//    - exports with multiple channels (this wasn't tested before)
	//    - user joins before job start time and stays (should record user's original join time, not the start of the job)
	//    - attachments are recorded with correct names in the xml and content in the files
	//    - a post from a user who wasn't a member in the channel creates a record for the user entering the channel at the start of the batch and leaving at the end of the batch (to be discussed with end user, this seems wrong)

	// Also tests the `BatchSize+1` logic in the worker, because we have 9 posts and batch size of 3.

	start := model.GetMillis()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = 0
		*cfg.MessageExportSettings.BatchSize = 3
		*cfg.MessageExportSettings.ExportFormat = exportType
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	// Users:
	users := make([]*model.User, 0)
	user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user1",
		Email:    "user1@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user2",
		Email:    "user2@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user3",
		Email:    "user3@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user4",
		Email:    "user4@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user5",
		Email:    "user5@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user6",
		Email:    "user6@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user7",
		Email:    "user7@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user8",
		Email:    "user8@email",
	})
	require.NoError(t, err)
	users = append(users, user)

	channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Two",
		Name:        "channel_two_name",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// channel3 will have only one user leaving during export time
	channel3, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Three",
		Name:        "channel_three_name",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// channel4 will have only one user joining during export time
	channel4, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Four",
		Name:        "channel_four_name",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// Save 9 posts so that we have the following batches:
	createUpdateTimes := []int64{
		start + 10, start + 14, start + 20, // batch 1: start-20, posts start at 10
		start + 23, start + 25, start + 30, // batch 2: 20-30, posts start at 23
		start + 36, start + 37, start + 40, // batch 3: 30-40, posts start at 36
	}

	jl := []joinLeave{
		{start - 5, 0},           // user 1 never leaves
		{start + 7, start + 8},   // user 2 joins and leaves before first post (but after startTime)
		{start + 11, start + 15}, // user 3 joins and leaves during first batch
		{start + 21, start + 22}, // user 4 joins and leaves during second batch but before second batch's post
		{start + 32, start + 35}, // user 5 joins and leaves during third batch but before third batch's post
		{start + 55, start + 57}, // user 6 joins and leaves after the last batch's last post but before when export is run
		{start - 100, start + 5}, // user 7 joins channel3 before start time and leaves before batch 1
		{start + 59, 0},          // user 8 joins channel4 after batch 3 (but before end)
	}

	// user 1 joins before start time and stays (and posts)
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, jl[0].join)
	require.NoError(t, err)
	// user 2 joins and leaves before first post (but after startTime)
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[1].Id, channel2.Id, jl[1].join)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[1].Id, channel2.Id, jl[1].leave)
	require.NoError(t, err)
	// user 3 joins and leaves during first batch
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[2].Id, channel2.Id, jl[2].join)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[2].Id, channel2.Id, jl[2].leave)
	require.NoError(t, err)
	// user 4 joins and leaves during second batch but before second batch's post
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[3].Id, channel2.Id, jl[3].join)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[3].Id, channel2.Id, jl[3].leave)
	// user 5 joins and leaves during third batch but before third batch's post
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[4].Id, channel2.Id, jl[4].join)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[4].Id, channel2.Id, jl[4].leave)
	require.NoError(t, err)
	// user 6 joins and leaves after the last batch's last post
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[5].Id, channel2.Id, jl[5].join)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[5].Id, channel2.Id, jl[5].leave)
	require.NoError(t, err)

	// user 7 joins channel3 before start time and leaves before batch 1
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[6].Id, channel3.Id, start-100)
	require.NoError(t, err)
	err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[6].Id, channel3.Id, start+5)
	require.NoError(t, err)
	// user 8 joins channel4 after batch 3 (but before end)
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[7].Id, channel4.Id, start+59)
	require.NoError(t, err)

	assertNumPostsToExport(t, th, 0, start, model.GetMillis())

	var attachments []*model.FileInfo
	var contents []string
	var posts []*model.Post
	for i, updateAt := range createUpdateTimes {
		post, err2 := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   fmt.Sprintf("message %d", i),
			CreateAt:  updateAt,
			UpdateAt:  updateAt,
			FileIds:   []string{fmt.Sprintf("test%d", i)},
		})
		require.NoError(t, err2)
		posts = append(posts, post)
		time.Sleep(time.Millisecond)

		attachmentContent := fmt.Sprintf("Hello there %d", i)
		attachmentPath := fmt.Sprintf("path/to/attachments/file_%d.txt", i)
		_, err = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath)
		require.NoError(t, err)

		info, err2 := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        st.NewTestID(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  updateAt,
			UpdateAt:  updateAt,
			Path:      attachmentPath,
		})
		require.NoError(t, err2)
		attachments = append(attachments, info)
		contents = append(contents, attachmentContent)
	}

	// Test that it's picking up a previous successful job
	var previousJob *model.Job
	previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
	require.Error(t, err)
	require.Nil(t, previousJob)

	_, err = th.App.Srv().Store().Job().Save(&model.Job{
		Id:             "blah",
		Type:           model.JobTypeMessageExport,
		Priority:       0,
		CreateAt:       0,
		StartAt:        0,
		LastActivityAt: 0,
		Status:         model.JobStatusSuccess,
		Progress:       100,
		Data:           map[string]string{shared.JobDataBatchStartTime: strconv.Itoa(int(start))},
	})
	require.NoError(t, err)

	previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
	require.NoError(t, err)
	require.NotNilf(t, previousJob, "prevJob")

	var prevUpdatedAt int64
	if timestamp, prevExists := previousJob.Data[shared.JobDataBatchStartTime]; prevExists {
		prevUpdatedAt, err = strconv.ParseInt(timestamp, 10, 64)
		require.NoError(t, err)
	}
	require.Equal(t, prevUpdatedAt, start)

	// move past the last post time
	time.Sleep(100 * time.Millisecond)

	// check number of messages to be exported
	until := model.GetMillis()
	assertNumPostsToExport(t, th, 9, start, until)

	// Now run the exports
	var job *model.Job
	if testStopping {
		var jobData map[string]string
		// manually create the job (which will start right away, so we need to wait for it below, after we use its id.
		job, _, err = th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: "message_export",
			Data: map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)}})
		require.NoError(t, err)

		// Stop the export after the second batch by stopping the Worker.
		batchCount := 0
		testEndOfBatchCb = func(worker *MessageExportWorker) {
			batchCount++
			if batchCount == 2 {
				job = getMostRecentJobWithId(t, th, job.Id)
				jobData = job.Data

				// let the job continue, but stop Worker, check we went back to Pending, then start the Worker.
				go func() {
					worker.Stop()
					checkJobForStatus(t, th, job.Id, model.JobStatusPending)
					worker.Run()
					checkJobForStatus(t, th, job.Id, model.JobStatusInProgress)
				}()
			}
		}

		// Wait for the rest of the exports to finish
		checkJobForStatus(t, th, job.Id, model.JobStatusSuccess)
		job = getMostRecentJobWithId(t, th, job.Id)
		testEndOfBatchCb = nil
		jobDataInvariantsShouldBeEqual(t, jobData, job.Data)
	} else {
		job = runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})
	}

	warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
	require.NoError(t, err)
	require.Equal(t, 0, warnings)

	assertNumExported(t, 9, job.Data)

	jobExportDir := job.Data[shared.JobDataExportDir]
	jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batchTimes := []batchStartEndTimes{
		{start: prevUpdatedAt, end: createUpdateTimes[2]},
		{start: createUpdateTimes[2], end: createUpdateTimes[5]},
		{start: createUpdateTimes[5], end: jobEndTime},
	}

	batch001 := shared.GetBatchPath(jobExportDir, batchTimes[0].start, batchTimes[0].end, 1)
	batch002 := shared.GetBatchPath(jobExportDir, batchTimes[1].start, batchTimes[1].end, 2)
	batch003 := shared.GetBatchPath(jobExportDir, batchTimes[2].start, batchTimes[2].end, 3)
	files, err := exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches := []string{batch001, batch002, batch003}
	require.ElementsMatch(t, batches, files)

	return JobResults{
		start:             start,
		joinLeaves:        jl,
		users:             users,
		createUpdateTimes: createUpdateTimes,
		attachments:       attachments,
		contents:          contents,
		jobEndTime:        jobEndTime,
		batches:           batches,
		posts:             posts,
		channels:          []*model.Channel{channel2, channel3, channel4},
		teams:             []*model.Team{th.BasicTeam},
		batchTimes:        batchTimes,
	}
}

func generateE2ETestType2Results(t *testing.T, th *api4.TestHelper, exportType, attachmentDir, exportDir string,
	attachmentBackend, exportBackend filestore.FileBackend) JobResults {
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = 0
		*cfg.MessageExportSettings.BatchSize = 3
		*cfg.MessageExportSettings.ExportFormat = exportType
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	start := model.GetMillis()

	// Users:
	users := make([]*model.User, 0)
	user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user1",
		Email:    "user1@email",
	})
	require.NoError(t, err)
	users = append(users, user)
	user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user2",
		Email:    "user2@email",
	})
	require.NoError(t, err)
	users = append(users, user)

	channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Two",
		Name:        "channel_two_name",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	createUpdateTimes := []int64{start + 10, start + 14}

	jl := []joinLeave{
		{start - 5, 0}, // user 1 never leaves
	}

	// user 1 joins before start time and stays (and posts)
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, jl[0].join)
	require.NoError(t, err)

	assertNumPostsToExport(t, th, 0, start, model.GetMillis())

	var posts []*model.Post

	// first post from user 1 (member)
	post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 1",
		CreateAt:  createUpdateTimes[0],
		UpdateAt:  createUpdateTimes[0],
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[1].Id,
		Message:   "message 2",
		CreateAt:  createUpdateTimes[1],
		UpdateAt:  createUpdateTimes[1],
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// Test that it's picking up a previous successful job
	var previousJob *model.Job
	previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
	require.Error(t, err)
	require.Nil(t, previousJob)

	_, err = th.App.Srv().Store().Job().Save(&model.Job{
		Id:             "blah",
		Type:           model.JobTypeMessageExport,
		Priority:       0,
		CreateAt:       0,
		StartAt:        0,
		LastActivityAt: 0,
		Status:         model.JobStatusSuccess,
		Progress:       100,
		Data:           map[string]string{shared.JobDataBatchStartTime: strconv.Itoa(int(start))},
	})
	require.NoError(t, err)

	previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
	require.NoError(t, err)
	require.NotNilf(t, previousJob, "prevJob")

	var prevUpdatedAt int64
	if timestamp, prevExists := previousJob.Data[shared.JobDataBatchStartTime]; prevExists {
		prevUpdatedAt, err = strconv.ParseInt(timestamp, 10, 64)
		require.NoError(t, err)
	}
	require.Equal(t, prevUpdatedAt, start)

	// move past the last post time
	time.Sleep(30 * time.Millisecond)

	// check number of messages to be exported
	until := model.GetMillis()
	assertNumPostsToExport(t, th, 2, start, until)

	// Now run the exports
	job := runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
	require.NoError(t, err)
	require.Equal(t, 0, warnings)

	assertNumExported(t, 2, job.Data)

	jobExportDir := job.Data[shared.JobDataExportDir]
	jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batch001 := shared.GetBatchPath(jobExportDir, prevUpdatedAt, jobEndTime, 1)
	files, err := exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches := []string{batch001}
	require.ElementsMatch(t, batches, files)

	return JobResults{
		start:             start,
		joinLeaves:        jl,
		users:             users,
		createUpdateTimes: createUpdateTimes,
		jobEndTime:        jobEndTime,
		batches:           batches,
		posts:             posts,
		channels:          []*model.Channel{channel2},
		teams:             []*model.Team{th.BasicTeam},
		batchTimes:        []batchStartEndTimes{{start, jobEndTime}},
	}
}

// Type3Results specific data needed to be returned by this test only
type Type3Results struct {
	message1DeleteAt            int64
	updatedPost2                *model.Post
	message3AndFileInfoDeleteAt int64
	deletedPost3                *model.Post
}

func generateE2ETestType3Results(t *testing.T, th *api4.TestHelper, exportType, attachmentDir, exportDir string,
	attachmentBackend, exportBackend filestore.FileBackend) (JobResults, Type3Results) {
	// This tests (reading the files exported and testing the exported xml):
	//  - post create at field is set
	//  - post deleted fields are set
	//  - post updated (not edited)
	//  - post deleted with a deleted file
	//  - post edited (new message created with original message, old message updated)
	//  - post edited with 3 simultaneous posts in-between - forward
	//  - post edited but falls on the batch boundary (originalId is in batch 1, newId is batch 2)

	start := model.GetMillis()

	// Users:
	users := make([]*model.User, 0)
	user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user1",
		Email:    "user1@email",
	})
	require.NoError(t, err)
	users = append(users, user)

	// only testing one channel
	channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Two",
		Name:        "channel_two_name",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// user 1 joins before start time and stays (and posts)
	user1JoinTime := start - 100
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, user1JoinTime)
	require.NoError(t, err)

	jl := []joinLeave{
		{user1JoinTime, 0}, // user 1 never leaves
	}

	assertNumPostsToExport(t, th, 0, start, model.GetMillis())

	var attachments []*model.FileInfo
	var contents []string
	var posts []*model.Post

	// 0 - post create
	post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 0",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 1 - post deleted
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 1",
	})
	require.NoError(t, err)
	message1DeleteAt := model.GetMillis()
	err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message1DeleteAt, users[0].Id)
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 2 - post updated not edited (e.g., reaction)
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 2",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)
	_, err = th.App.Srv().Store().Reaction().Save(&model.Reaction{
		UserId:    users[0].Id,
		PostId:    post.Id,
		EmojiName: "smile",
		ChannelId: channel2.Id,
	})
	require.NoError(t, err)
	updatedPost2, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
	require.NoError(t, err)

	// 3 - post deleted with a deleted file
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 3",
		FileIds:   []string{"test3"},
	})
	require.NoError(t, err)
	time.Sleep(100 * time.Millisecond)
	message3AndFileInfoDeleteAt := model.GetMillis()
	err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message3AndFileInfoDeleteAt, users[0].Id)
	require.NoError(t, err)
	deletedPost3, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// Message for deleted file -- NOT INCLUDED IN THE BATCH SIZE
	attachmentContent := "Hello there message 3"
	attachmentPath := "path/to/attachments/file_3.txt"
	_, err = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath)
	require.NoError(t, err)
	info, err2 := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
		Id:        st.NewTestID(),
		CreatorId: post.UserId,
		PostId:    post.Id,
		CreateAt:  post.CreateAt,
		UpdateAt:  message3AndFileInfoDeleteAt,
		Path:      attachmentPath,
		DeleteAt:  message3AndFileInfoDeleteAt,
	})
	require.NoError(t, err2)
	attachments = append(attachments, info)
	time.Sleep(100 * time.Millisecond)
	contents = append(contents, attachmentContent)

	// 4 - original post
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 4",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)
	// 5 - post edited
	post, err = th.App.Srv().Store().Post().Update(th.Context, &model.Post{
		Id:        post.Id,
		CreateAt:  post.CreateAt,
		EditAt:    model.GetMillis(),
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "edited message 4",
	}, post)
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 6 - post edited but falls on the batch boundary
	// original post, but gets modified by the next edit
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 6",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 7 - new post with original message
	// update returns "new" post, which is the old post modified
	post, err = th.App.Srv().Store().Post().Update(th.Context, &model.Post{
		Id:        post.Id,
		CreateAt:  post.CreateAt,
		EditAt:    model.GetMillis(),
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "edited message 6",
	}, post)
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	require.Len(t, posts, 8)
	// therefore, need a batch size of 7

	// use the config fallback
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = start
		*cfg.MessageExportSettings.BatchSize = 7
		*cfg.MessageExportSettings.ExportFormat = exportType
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	// check number of messages to be exported
	until := model.GetMillis()
	assertNumPostsToExport(t, th, 8, start, until)

	// Now run the exports
	job := runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	assertNumExported(t, 8, job.Data)

	jobExportDir := job.Data[shared.JobDataExportDir]
	jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batchTimes := []batchStartEndTimes{
		{start, posts[7].UpdateAt},
		{posts[7].UpdateAt, jobEndTime},
	}

	// using posts[7] because it's updateAt is what posts[6] is changed to (after the edit)
	batch001 := shared.GetBatchPath(jobExportDir, batchTimes[0].start, batchTimes[0].end, 1)
	batch002 := shared.GetBatchPath(jobExportDir, batchTimes[1].start, batchTimes[1].end, 2)
	files, err := exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches := []string{batch001, batch002}
	require.ElementsMatch(t, batches, files)

	return JobResults{
			start:       start,
			users:       users,
			joinLeaves:  jl,
			jobEndTime:  jobEndTime,
			batches:     batches,
			posts:       posts,
			attachments: attachments,
			contents:    contents,
			channels:    []*model.Channel{channel2},
			teams:       []*model.Team{th.BasicTeam},
			batchTimes:  batchTimes,
		}, Type3Results{
			message1DeleteAt:            message1DeleteAt,
			updatedPost2:                updatedPost2,
			message3AndFileInfoDeleteAt: message3AndFileInfoDeleteAt,
			deletedPost3:                deletedPost3,
		}
}

func generateE2ETestType4Results(t *testing.T, th *api4.TestHelper, exportType, attachmentDir, exportDir string,
	attachmentBackend, exportBackend filestore.FileBackend) JobResults {
	start := model.GetMillis()

	// Users:
	users := make([]*model.User, 0)
	user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
		Username: "user1",
		Email:    "user1@email",
	})
	require.NoError(t, err)
	users = append(users, user)

	// only testing one channel
	channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Two",
		Name:        "channel_two_name",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// user 1 joins before start time and stays (and posts)
	user1JoinTime := model.GetMillis() - 200
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, user1JoinTime)
	require.NoError(t, err)

	jl := []joinLeave{
		{user1JoinTime, 0}, // user 1 never leaves
	}

	// This tests (reading the files exported and testing the exported xml):
	//  - post edited with 3 simultaneous posts in-between
	assertNumPostsToExport(t, th, 0, start, model.GetMillis())

	var posts []*model.Post

	// 0 - post edited with 3 simultaneous posts in-between - forward
	// original post with edited message
	originalPost, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 0",
	})
	require.NoError(t, err)
	posts = append(posts, originalPost)
	time.Sleep(100 * time.Millisecond)

	// 1 - edited post
	post, err := th.App.Srv().Store().Post().Update(th.Context, &model.Post{
		Id:        originalPost.Id,
		CreateAt:  originalPost.CreateAt,
		EditAt:    model.GetMillis(),
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "edited message 0",
	}, originalPost)
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	simultaneous := post.UpdateAt

	// 2 - post 1 at same updateAt
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 2",
		CreateAt:  simultaneous,
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 3 - post 2 at same updateAt
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 3",
		CreateAt:  simultaneous,
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// 4 - post 3 in-between
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    users[0].Id,
		Message:   "message 4",
		CreateAt:  simultaneous,
	})
	require.NoError(t, err)
	posts = append(posts, post)
	// Use the config fallback for simplicity

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = start
		*cfg.MessageExportSettings.BatchSize = 10
		*cfg.MessageExportSettings.ExportFormat = exportType
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	// check number of messages to be exported
	until := model.GetMillis()
	assertNumPostsToExport(t, th, 5, start, until)

	// Now run the exports
	job := runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})
	// cleanup for next run
	_, err = th.App.Srv().Store().Job().Delete(job.Id)
	require.NoError(t, err)

	assertNumExported(t, 5, job.Data)

	jobExportDir := job.Data[shared.JobDataExportDir]
	jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batchTimes := []batchStartEndTimes{{start, jobEndTime}}

	batch001 := shared.GetBatchPath(jobExportDir, batchTimes[0].start, batchTimes[0].end, 1)
	files, err := exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches := []string{batch001}
	require.ElementsMatch(t, batches, files)

	return JobResults{
		start:      start,
		users:      users,
		joinLeaves: jl,
		jobEndTime: jobEndTime,
		batches:    batches,
		posts:      posts,
		channels:   []*model.Channel{channel2},
		teams:      []*model.Team{th.BasicTeam},
		batchTimes: batchTimes,
	}
}

// Type5Results specific data needed to be returned by this test only
type Type5Results struct {
	message0DeleteAt int64
	updatedPost1     *model.Post
	zipBytes         [][]byte
}

// generateE2ETestType5Results does 4 jobs, returns an array of each job's data to use in testing
func generateE2ETestType5Results(t *testing.T, th *api4.TestHelper, exportType, attachmentDir, exportDir string,
	attachmentBackend, exportBackend filestore.FileBackend) ([]JobResults, []Type5Results) {
	// This tests (reading the files exported and testing the exported file):
	//  - post deleted in current job: shows created post, then deleted post
	//  - post deleted in current job but different batch: shows created post (in second batch), then deleted post
	//  - post created in previous job, deleted in current job: shows only deleted post in current job
	//    (and same for updated post)

	start := model.GetMillis()

	channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
		DisplayName: "the Channel Two",
		Name:        "channel_two_name",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, 999)
	require.NoError(t, err)

	// user 1 joins before start time and stays (and posts)
	user1JoinTime := model.GetMillis() - 100
	err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(th.BasicUser.Id, channel2.Id, user1JoinTime)
	require.NoError(t, err)

	// Job 1: post deleted in current job: shows created post, then deleted post
	assertNumPostsToExport(t, th, 0, start, model.GetMillis())

	var posts []*model.Post

	// post create
	post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 0",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// post deleted
	message0DeleteAt := model.GetMillis()
	err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message0DeleteAt, th.BasicUser.Id)
	require.NoError(t, err)

	// use the config fallback
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFromTimestamp = start
		*cfg.MessageExportSettings.BatchSize = 2
		*cfg.MessageExportSettings.ExportFormat = exportType
		*cfg.FileSettings.DriverName = model.ImageDriverLocal
		*cfg.FileSettings.Directory = attachmentDir

		if exportDir != attachmentDir {
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
			*cfg.FileSettings.ExportDirectory = exportDir
		}
	})

	// check number of messages to be exported -- will be 1 (because one message deleted)
	until := model.GetMillis()
	assertNumPostsToExport(t, th, 1, start, until)

	// Now run the exports
	job := runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	assertNumExported(t, 1, job.Data)

	jobExportDir := job.Data[shared.JobDataExportDir]
	jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batchTimes := []batchStartEndTimes{
		{start: start, end: jobEndTime},
	}

	batch001 := shared.GetBatchPath(jobExportDir, batchTimes[0].start, batchTimes[0].end, 1)
	files, err := exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches := []string{batch001}
	require.ElementsMatch(t, batches, files)

	zipBytes, err := exportBackend.ReadFile(batches[0])
	require.NoError(t, err)

	var setupReturns []JobResults
	var setupType5Returns []Type5Results

	setupReturns = append(setupReturns, JobResults{
		posts: posts,
	})
	setupType5Returns = append(setupType5Returns, Type5Results{
		message0DeleteAt: message0DeleteAt,
		zipBytes:         [][]byte{zipBytes},
	})

	// Cleanup for next job
	err = os.RemoveAll(exportDir)
	assert.NoError(t, err)
	err = os.RemoveAll(attachmentDir)
	assert.NoError(t, err)
	_, err = th.App.Srv().Store().Job().Delete(job.Id)
	assert.NoError(t, err)

	//
	// Job 2
	//

	// Job 2: post deleted in current job, shows up in second batch because it was deleted after the "second" post
	start = model.GetMillis()

	posts = make([]*model.Post, 0)

	// post create -- this will be the one deleted
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 0",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// post create -- this is the "second" post, but it will show up first because first post is deleted after
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 1",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// post deleted -- first post deleted
	message0DeleteAt = model.GetMillis()
	err = th.App.Srv().Store().Post().Delete(th.Context, posts[0].Id, message0DeleteAt, th.BasicUser.Id)
	require.NoError(t, err)

	// use the config fallback
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.ExportFromTimestamp = start
		*cfg.MessageExportSettings.BatchSize = 1
	})

	// check number of messages to be exported
	until = model.GetMillis()
	assertNumPostsToExport(t, th, 2, start, until)

	// Now run the exports
	job = runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	assertNumExported(t, 2, job.Data)

	jobExportDir = job.Data[shared.JobDataExportDir]
	jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	// use the message1 updateAt, because the message0's updateAt is now after
	batch001 = shared.GetBatchPath(jobExportDir, start, posts[1].UpdateAt, 1)
	batch002 := shared.GetBatchPath(jobExportDir, posts[1].UpdateAt, jobEndTime, 2)
	files, err = exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches = []string{batch001, batch002}
	require.ElementsMatch(t, batches, files)

	zipBytes, err = exportBackend.ReadFile(batches[0])
	require.NoError(t, err)
	zipBytes2, err := exportBackend.ReadFile(batches[1])
	require.NoError(t, err)

	setupReturns = append(setupReturns, JobResults{
		posts: posts,
	})
	setupType5Returns = append(setupType5Returns, Type5Results{
		message0DeleteAt: message0DeleteAt,
		zipBytes:         [][]byte{zipBytes, zipBytes2},
	})

	// Cleanup for next job
	err = os.RemoveAll(exportDir)
	assert.NoError(t, err)
	err = os.RemoveAll(attachmentDir)
	assert.NoError(t, err)
	_, err = th.App.Srv().Store().Job().Delete(job.Id)
	assert.NoError(t, err)

	//
	// Job 3
	//

	// Job 3: post created in previous job, deleted in current job: shows only deleted post in current job
	start = model.GetMillis()

	posts = make([]*model.Post, 0)

	// post create -- this will be the one deleted in second job
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 0",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// post create -- this will be the one updated in second job
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 1",
	})
	require.NoError(t, err)
	posts = append(posts, post)

	// use the config fallback
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.ExportFromTimestamp = start
		*cfg.MessageExportSettings.BatchSize = 10
	})

	until = model.GetMillis()
	assertNumPostsToExport(t, th, 2, start, until)

	// Now run the exports
	job = runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	assertNumExported(t, 2, job.Data)

	jobExportDir = job.Data[shared.JobDataExportDir]
	jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batch001 = shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
	files, err = exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches = []string{batch001}
	require.ElementsMatch(t, batches, files)

	zipBytes, err = exportBackend.ReadFile(batches[0])
	require.NoError(t, err)

	setupReturns = append(setupReturns, JobResults{
		posts: posts,
	})
	setupType5Returns = append(setupType5Returns, Type5Results{
		zipBytes: [][]byte{zipBytes},
	})

	// Now, clean up outputs for next job
	err = os.RemoveAll(exportDir)
	assert.NoError(t, err)
	err = os.RemoveAll(attachmentDir)
	assert.NoError(t, err)
	_, err = th.App.Srv().Store().Job().Delete(job.Id)
	assert.NoError(t, err)

	//
	// Job 4
	//
	start = model.GetMillis()

	// make a copy of posts so the one we sent earlier doesn't get modified and cause difficult to detect bugs
	posts = append([]*model.Post{}, posts...)

	// post create -- filler
	post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: channel2.Id,
		UserId:    th.BasicUser.Id,
		Message:   "message 1",
	})
	require.NoError(t, err)
	posts = append(posts, post)
	time.Sleep(100 * time.Millisecond)

	// post deleted -- first post deleted (the first one exported earlier)
	message0DeleteAt = model.GetMillis()
	err = th.App.Srv().Store().Post().Delete(th.Context, posts[0].Id, message0DeleteAt, th.BasicUser.Id)
	require.NoError(t, err)

	// post updated -- second post updated (the second one exported earlier)
	_, err = th.App.Srv().Store().Reaction().Save(&model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    posts[1].Id,
		EmojiName: "smile",
		ChannelId: channel2.Id,
	})
	require.NoError(t, err)
	updatedPost1, err := th.App.Srv().Store().Post().GetSingle(th.Context, posts[1].Id, false)
	require.NoError(t, err)

	// use the config fallback
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.ExportFromTimestamp = start
	})

	// check number of messages to be exported
	// filler post, deleted post, and updated post
	until = model.GetMillis()
	assertNumPostsToExport(t, th, 3, start, until)

	// Now run the exports
	job = runJobForTest(t, th, map[string]string{shared.JobDataJobEndTime: strconv.FormatInt(until, 10)})

	assertNumExported(t, 3, job.Data)

	jobExportDir = job.Data[shared.JobDataExportDir]
	jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
	require.NoError(t, err)

	batch001 = shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
	files, err = exportBackend.ListDirectory(jobExportDir)
	require.NoError(t, err)
	batches = []string{batch001}
	require.ElementsMatch(t, batches, files)

	zipBytes, err = exportBackend.ReadFile(batches[0])
	require.NoError(t, err)

	setupReturns = append(setupReturns, JobResults{
		posts: posts,
	})
	setupType5Returns = append(setupType5Returns, Type5Results{
		message0DeleteAt: message0DeleteAt,
		updatedPost1:     updatedPost1,
		zipBytes:         [][]byte{zipBytes},
	})

	// Cleanup
	err = os.RemoveAll(exportDir)
	assert.NoError(t, err)
	err = os.RemoveAll(attachmentDir)
	assert.NoError(t, err)
	_, err = th.App.Srv().Store().Job().Delete(job.Id)
	assert.NoError(t, err)

	return setupReturns, setupType5Returns
}
