// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/actiance_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/global_relay_export"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

//go:embed testdata/actianceXMLHeader.tmpl
var actianceXMLHeader string

//go:embed testdata/batch1ch2.tmpl
var batch1ch2tmpl string

//go:embed testdata/batch1ch3.tmpl
var batch1ch3tmpl string

//go:embed testdata/batch2xml.tmpl
var batch2xmptmpl string

//go:embed testdata/batch3ch2.tmpl
var batch3ch2tmpl string

//go:embed testdata/batch3ch4.tmpl
var batch3ch4tmpl string

//go:embed testdata/e2eXml2.tmpl
var e2eXml2 string

//go:embed testdata/grE2E1Batch1Summary.tmpl
var grE2E1Batch1Summary string

//go:embed testdata/grE2E1Batch1.tmpl
var grE2E1Batch1 string

//go:embed testdata/grE2E1Batch2Summary.tmpl
var grE2E1Batch2Summary string

//go:embed testdata/grE2E1Batch2.tmpl
var grE2E1Batch2 string

//go:embed testdata/grE2E1Batch3Summary.tmpl
var grE2E1Batch3Summary string

//go:embed testdata/grE2E1Batch3.tmpl
var grE2E1Batch3 string

//go:embed testdata/csvE2E1Batch1.tmpl
var csvE2E1Batch1 string

//go:embed testdata/csvE2E1Batch2.tmpl
var csvE2E1Batch2 string

//go:embed testdata/csvE2E1Batch3.tmpl
var csvE2E1Batch3 string

//go:embed testdata/grE2E2Batch1Summary.tmpl
var grE2E2Batch1Summary string

//go:embed testdata/grE2E2Batch1.tmpl
var grE2E2Batch1 string

//go:embed testdata/csvE2E2Batch1.tmpl
var csvE2E2Batch1 string

//go:embed testdata/grE2E3Batch1SummaryPerm1.tmpl
var grE2E3Batch1SummaryPerm1 string

//go:embed testdata/grE2E3Batch1SummaryPerm2.tmpl
var grE2E3Batch1SummaryPerm2 string

//go:embed testdata/grE2E3Batch1SummaryPerm3.tmpl
var grE2E3Batch1SummaryPerm3 string

//go:embed testdata/grE2E3Batch1SummaryPerm4.tmpl
var grE2E3Batch1SummaryPerm4 string

//go:embed testdata/grE2E3Batch1Perm1.tmpl
var grE2E3Batch1Perm1 string

//go:embed testdata/grE2E3Batch1Perm2.tmpl
var grE2E3Batch1Perm2 string

//go:embed testdata/grE2E3Batch1Perm3.tmpl
var grE2E3Batch1Perm3 string

//go:embed testdata/grE2E3Batch1Perm4.tmpl
var grE2E3Batch1Perm4 string

//go:embed testdata/grE2E3Batch2SummaryPerm1.tmpl
var grE2E3Batch2SummaryPerm1 string

//go:embed testdata/grE2E3Batch2SummaryPerm2.tmpl
var grE2E3Batch2SummaryPerm2 string

//go:embed testdata/grE2E3Batch2Perm1.tmpl
var grE2E3Batch2Perm1 string

//go:embed testdata/grE2E3Batch2Perm2.tmpl
var grE2E3Batch2Perm2 string

//go:embed testdata/grE2E4Summary.tmpl
var grE2E4Summary string

//go:embed testdata/csvE2E3Batch1Perm1.tmpl
var csvE2E3Batch1Perm1 string

//go:embed testdata/csvE2E3Batch1Perm2.tmpl
var csvE2E3Batch1Perm2 string

//go:embed testdata/csvE2E3Batch1Perm3.tmpl
var csvE2E3Batch1Perm3 string

//go:embed testdata/csvE2E3Batch1Perm4.tmpl
var csvE2E3Batch1Perm4 string

//go:embed testdata/csvE2E3Batch2Perm1.tmpl
var csvE2E3Batch2Perm1 string

//go:embed testdata/csvE2E3Batch2Perm2.tmpl
var csvE2E3Batch2Perm2 string

//go:embed testdata/csvE2E4Batch1.tmpl
var csvE2E4Batch1 string

func conv(dateTime int64) string {
	return global_relay_export.TimestampConvert(dateTime)
}

type MyReporter struct {
	mock.Mock
}

func (mr *MyReporter) ReportProgressMessage(message string) {
	mr.Called(message)
}

func TestRunExportByType(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		testRunExportByType(t, fileBackend, exportTempDir, fileBackend, exportTempDir)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})
		require.NoError(t, err)

		testRunExportByType(t, exportBackend, exportTempDir, attachmentBackend, attachmentTempDir)
	})
}

func testRunExportByType(t *testing.T, exportBackend filestore.FileBackend, exportDir string, attachmentBackend filestore.FileBackend, attachmentDir string) {
	rctx := request.TestContext(t)

	chanTypeDirect := model.ChannelTypeDirect

	t.Run("missing user info", func(t *testing.T) {
		t.Cleanup(func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		})

		posts := []*model.MessageExport{
			{
				PostId:             model.NewPointer("post-id"),
				PostOriginalId:     model.NewPointer("post-original-id"),
				TeamId:             model.NewPointer("team-id"),
				TeamName:           model.NewPointer("team-name"),
				TeamDisplayName:    model.NewPointer("team-display-name"),
				ChannelId:          model.NewPointer("channel-id"),
				ChannelName:        model.NewPointer("channel-name"),
				ChannelDisplayName: model.NewPointer("channel-display-name"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostUpdateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("message"),
				UserEmail:          model.NewPointer("test@example.com"),
				Username:           model.NewPointer("Mr. Test"),
				UserId:             model.NewPointer(model.NewId()),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{},
			},
		}

		mockStore := &storetest.Store{}
		defer mockStore.AssertExpectations(t)
		mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", int64(1), int64(1)).
			Return([]string{"channel-id"}, nil)
		mockStore.ChannelStore.On("GetMany", []string{"channel-id"}, true).
			Return(model.ChannelList{{
				Id:          "channel-id",
				DisplayName: "channel-display-name",
				Name:        "channel-name",
				Type:        chanTypeDirect,
			}}, nil)
		mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(1), []string{"channel-id"}).Return([]*model.ChannelMemberHistoryResult{}, nil)

		myMockReporter := MyReporter{}
		defer myMockReporter.AssertExpectations(t)
		myMockReporter.On("ReportProgressMessage", "Exporting channel information for 1 channels.")
		myMockReporter.On("ReportProgressMessage", "Calculating channel activity: 0/1 channels completed.")

		channelMetadata, channelMemberHistories, err := shared.CalculateChannelExports(rctx,
			shared.ChannelExportsParams{
				Store:                   shared.NewMessageExportStore(mockStore),
				ExportPeriodStartTime:   1,
				ExportPeriodEndTime:     1,
				ChannelBatchSize:        100,
				ChannelHistoryBatchSize: 100,
				ReportProgressMessage:   myMockReporter.ReportProgressMessage,
			})
		assert.NoError(t, err)

		res, err := RunExportByType(rctx, ExportParams{
			ExportType:             model.ComplianceExportTypeActiance,
			ChannelMetadata:        channelMetadata,
			ChannelMemberHistories: channelMemberHistories,
			PostsToExport:          posts,
			BatchPath:              "testZipName",
			BatchStartTime:         1,
			BatchEndTime:           1,
		}, shared.BackendParams{
			Store:                 shared.NewMessageExportStore(mockStore),
			FileAttachmentBackend: attachmentBackend,
			ExportBackend:         exportBackend,
			HtmlTemplates:         nil,
			Config:                nil,
		})
		require.NoError(t, err)
		require.Zero(t, res.NumWarnings)
	})
}

func TestRunExportJobE2EByType(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		testRunExportJobE2E(t, fileBackend, exportTempDir, fileBackend, exportTempDir)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})
		require.NoError(t, err)

		testRunExportJobE2E(t, exportBackend, exportTempDir, attachmentBackend, attachmentTempDir)
	})
}

func testRunExportJobE2E(t *testing.T, exportBackend filestore.FileBackend, exportDir string,
	attachmentBackend filestore.FileBackend, attachmentDir string) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}

	t.Run("conflicting timestamps", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		time.Sleep(1 * time.Millisecond)
		now := model.GetMillis()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = now - 1
			*cfg.MessageExportSettings.BatchSize = 2
		})

		for i := 0; i < 3; i++ {
			_, err2 := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now,
			})
			require.NoError(t, err2)
		}

		job := runJobForTest(t, th, nil)

		warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(3), numExported)
	})

	t.Run("actiance -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		res := generateActianceBatchTest1(t, th, attachmentDir, exportDir, attachmentBackend)

		files, err := exportBackend.ListDirectory(res.jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, res.batches, files)

		fileContents := openZipAndReadFile(t, exportBackend, res.batches[0], res.attachments[0].Path)

		require.EqualValuesf(t, res.contents[0], fileContents, "file contents not equal")
	})

	t.Run("actiance -- multiple batches, using UntilUpdateAt", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		res := generateActianceBatchTest2(t, th, attachmentDir, exportDir)

		files, err := exportBackend.ListDirectory(res.jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, res.batches, files)
	})

	t.Run("actiance e2e 1", func(t *testing.T) {
		tests := []struct {
			name         string
			testStopping bool
		}{
			{
				name:         "full tests, no stopping",
				testStopping: false,
			},
			{
				name: "full tests, stopped and resumed",
				// This uses the same output as the previous e2e test, but tests that the job can be stopped and
				// resumed with no change to the directory, files, file contents, or job.Data that shouldn't change.
				// We want to be confident that jobs can resume without data missing or added from the original run.
				testStopping: true,
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := setup(t)
				defer th.TearDown()
				defer func() {
					err := os.RemoveAll(exportDir)
					assert.NoError(t, err)
					err = os.RemoveAll(attachmentDir)
					assert.NoError(t, err)
				}()

				ret := generateE2ETestType1Results(t, th, model.ComplianceExportTypeActiance, attachmentDir,
					exportDir, attachmentBackend, exportBackend, tt.testStopping)
				channel2 := ret.channels[0]
				channel3 := ret.channels[1]
				channel4 := ret.channels[2]
				start := ret.start
				jl := ret.joinLeaves
				posts := ret.posts
				createUpdateTimes := ret.createUpdateTimes
				attachments := ret.attachments
				contents := ret.contents
				jobEndTime := ret.jobEndTime
				batches := ret.batches

				// Expected data:
				//  - batch1 has two channels, and we're not sure which will come first. What a pain.

				batch1ch2 := fmt.Sprintf(batch1ch2tmpl, channel2.Id, start, jl[0].join, jl[1].join, jl[2].join,
					posts[0].Id, createUpdateTimes[0], createUpdateTimes[0], createUpdateTimes[0],
					posts[1].Id, createUpdateTimes[1], createUpdateTimes[1], createUpdateTimes[1],
					posts[2].Id, createUpdateTimes[2], createUpdateTimes[2], createUpdateTimes[2],
					jl[1].leave, jl[2].leave, createUpdateTimes[2], createUpdateTimes[2])

				batch1ch3 := fmt.Sprintf(batch1ch3tmpl, channel3.Id, start, jl[6].join, jl[6].leave, createUpdateTimes[2])

				xmlHeader := strings.TrimSpace(actianceXMLHeader)
				batch1Possibility1 := fmt.Sprintf(xmlHeader, batch1ch2, batch1ch3)
				batch1Possibility2 := fmt.Sprintf(xmlHeader, batch1ch3, batch1ch2)

				batch2xml := fmt.Sprintf(batch2xmptmpl, channel2.Id, createUpdateTimes[2], jl[0].join, jl[3].join,
					posts[3].Id, createUpdateTimes[3], createUpdateTimes[3], createUpdateTimes[3],
					posts[4].Id, createUpdateTimes[4], createUpdateTimes[4], createUpdateTimes[4],
					posts[5].Id, createUpdateTimes[5], createUpdateTimes[5], createUpdateTimes[5],
					jl[3].leave, createUpdateTimes[5], createUpdateTimes[5])
				batch2xml = strings.TrimSpace(batch2xml)

				//  Batch3 has two channels, and we're not sure which will come first. What a pain.
				batch3ch2 := fmt.Sprintf(batch3ch2tmpl, channel2.Id, createUpdateTimes[5], jl[0].join, jl[4].join, jl[5].join,
					posts[6].Id, createUpdateTimes[6], createUpdateTimes[6], createUpdateTimes[6],
					posts[7].Id, createUpdateTimes[7], createUpdateTimes[7], createUpdateTimes[7],
					posts[8].Id, createUpdateTimes[8], createUpdateTimes[8], createUpdateTimes[8],
					jl[4].leave, jl[5].leave, jobEndTime, jobEndTime)

				batch3ch4 := fmt.Sprintf(batch3ch4tmpl, channel4.Id, createUpdateTimes[5], jl[7].join, jobEndTime, jobEndTime)

				batch3Possibility1 := fmt.Sprintf(xmlHeader, batch3ch2, batch3ch4)

				batch3Possibility2 := fmt.Sprintf(xmlHeader, batch3ch4, batch3ch2)

				for b, batchName := range batches {
					xmlContents := openZipAndReadFile(t, exportBackend, batchName, "actiance_export.xml")

					// this is so clunky, sorry. but it's simple.
					if b == 0 {
						if xmlContents != batch1Possibility1 && xmlContents != batch1Possibility2 {
							// to make some output
							assert.Equal(t, batch1Possibility1, xmlContents, "batch 1 possibility 1")
							assert.Equal(t, batch1Possibility2, xmlContents, "batch 1 possibility 2")
						}
					}

					if b == 1 {
						require.Equal(t, batch2xml, xmlContents, "batch 2")
					}

					if b == 2 {
						if xmlContents != batch3Possibility1 && xmlContents != batch3Possibility2 {
							// to make some output
							assert.Equal(t, batch3Possibility1, xmlContents, "batch 3 possibility 1")
							assert.Equal(t, batch3Possibility2, xmlContents, "batch 3 possibility 2")
						}
					}

					zipBytes, err := exportBackend.ReadFile(batchName)
					require.NoError(t, err)
					zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
					require.NoError(t, err)

					for i := 0; i < 3; i++ {
						num := b*3 + i
						attachmentInZip, err := zipReader.Open(attachments[num].Path)
						require.NoError(t, err)
						attachmentInZipContents, err := io.ReadAll(attachmentInZip)
						require.NoError(t, err)
						err = attachmentInZip.Close()
						require.NoError(t, err)
						require.EqualValuesf(t, contents[num], string(attachmentInZipContents), "file contents not equal")
					}
				}
			})
		}
	})

	t.Run("GlobalRelay e2e 1", func(t *testing.T) {
		tests := []struct {
			name         string
			testStopping bool
		}{
			{
				name:         "full tests, no stopping",
				testStopping: false,
			},
			{
				name: "full tests, stopped and resumed",
				// This uses the same output as the previous e2e test, but tests that the job can be stopped and
				// resumed with no change to the directory, files, file contents, or job.Data that shouldn't change.
				// We want to be confident that jobs can resume without data missing or added from the original run.
				testStopping: true,
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := setup(t)
				defer th.TearDown()
				defer func() {
					err := os.RemoveAll(exportDir)
					assert.NoError(t, err)
					err = os.RemoveAll(attachmentDir)
					assert.NoError(t, err)
				}()

				ret := generateE2ETestType1Results(t, th, model.ComplianceExportTypeGlobalrelayZip, attachmentDir,
					exportDir, attachmentBackend, exportBackend, tt.testStopping)
				channel2 := ret.channels[0]
				posts := ret.posts
				batchTimes := ret.batchTimes
				jobStartTime := ret.start
				jl := ret.joinLeaves
				batches := ret.batches
				cu := ret.createUpdateTimes

				for batchNum, batchName := range batches {
					data := openZipAndReadFirstFile(t, exportBackend, batchName)
					// clean some bad csrf if present
					msg := global_relay_export.CleanTestOutput(data)

					// Global relay needs to be updated to use Actiance logic. MM-61718
					batchStartTime := batchTimes[batchNum].start
					batchEndTime := batchTimes[batchNum].end
					expectedBatchExport := []string{
						// batch 1 Summary
						fmt.Sprintf(grE2E1Batch1Summary,
							// 1                   2            3                     4                 5
							channel2.DisplayName, conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
							// 6              7                    8                9
							conv(jl[1].join), conv(jl[1].leave), conv(jl[2].join), conv(jl[2].leave),
							// 10                     11                       12
							conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt)),

						// batch 1
						fmt.Sprintf(grE2E1Batch1,
							// 1           2                   3                      4              5
							conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime), conv(jl[1].join),
							// 6                7                  8                  9           10
							conv(jl[1].leave), conv(jl[2].join), conv(jl[2].leave), conv(cu[0]), conv(cu[1]),
							// 11         12
							conv(cu[2]), conv(jobStartTime)),

						// batch 2 Summary
						fmt.Sprintf(grE2E1Batch2Summary,
							// 1                    2                    3                 4
							conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
							// 5              6                    7                8
							conv(jl[3].join), conv(jl[3].leave), conv(posts[3].CreateAt), conv(posts[4].CreateAt),
							// 9
							conv(posts[5].CreateAt)),

						// batch 2
						fmt.Sprintf(grE2E1Batch2,
							// 1                      2                  3                 4
							conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
							// 5               6                  7                  8      9
							conv(jl[3].join), conv(jl[3].leave), conv(cu[3]), conv(cu[4]), conv(cu[5]),
							// 10
							conv(jobStartTime)),

						// batch 3 Summary
						fmt.Sprintf(grE2E1Batch3Summary,
							// 1                    2                    3                 4
							conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
							// 5              6                    7                8
							conv(jl[4].join), conv(jl[4].leave), conv(jl[5].join), conv(jl[5].leave),
							// 9                      10                       11
							conv(posts[6].CreateAt), conv(posts[7].CreateAt), conv(posts[8].CreateAt)),

						// batch 3
						fmt.Sprintf(grE2E1Batch3,
							// 1                      2                  3                 4
							conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
							// 5               6                  7                  8
							conv(jl[4].join), conv(jl[4].leave), conv(jl[5].join), conv(jl[5].leave),
							// 9          10            11          12
							conv(cu[6]), conv(cu[7]), conv(cu[8]), conv(jobStartTime)),
					}

					if batchNum == 0 {
						global_relay_export.AssertHeaderContains(t, msg, map[string]string{
							"Subject":                  "Mattermost Compliance Export: the Channel Two",
							"From":                     "user1@email",
							"X-Mattermost-ChannelName": "the Channel Two",
							"To":                       "user1@email,user2@email,user3@email",
							"X-Mattermost-ChannelID":   channel2.Id,
							"X-Mattermost-ChannelType": "private",
						})
						assert.Contains(t, msg, expectedBatchExport[0], "batch 1")
						assert.Contains(t, msg, expectedBatchExport[1], "batch 1")
					}

					if batchNum == 1 {
						global_relay_export.AssertHeaderContains(t, msg, map[string]string{
							"Subject":                  "Mattermost Compliance Export: the Channel Two",
							"From":                     "user1@email",
							"X-Mattermost-ChannelName": "the Channel Two",
							"To":                       "user1@email,user4@email",
							"X-Mattermost-ChannelID":   channel2.Id,
							"X-Mattermost-ChannelType": "private",
						})
						assert.Contains(t, msg, expectedBatchExport[2], "batch 2")
						assert.Contains(t, msg, expectedBatchExport[3], "batch 2")
					}

					if batchNum == 2 {
						global_relay_export.AssertHeaderContains(t, msg, map[string]string{
							"Subject":                  "Mattermost Compliance Export: the Channel Two",
							"From":                     "user1@email",
							"X-Mattermost-ChannelName": "the Channel Two",
							"To":                       "user1@email,user5@email,user6@email",
							"X-Mattermost-ChannelID":   channel2.Id,
							"X-Mattermost-ChannelType": "private",
						})
						assert.Contains(t, msg, expectedBatchExport[4], "batch 3")
						assert.Contains(t, msg, expectedBatchExport[5], "batch 3")
					}
				}
			})
		}
	})

	t.Run("CSV e2e 1", func(t *testing.T) {
		tests := []struct {
			name         string
			testStopping bool
		}{
			{
				name:         "full tests, no stopping",
				testStopping: false,
			},
			{
				name: "full tests, stopped and resumed",
				// This uses the same output as the previous e2e test, but tests that the job can be stopped and
				// resumed with no change to the directory, files, file contents, or job.Data that shouldn't change.
				// We want to be confident that jobs can resume without data missing or added from the original run.
				testStopping: true,
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := setup(t)
				defer th.TearDown()
				defer func() {
					err := os.RemoveAll(exportDir)
					assert.NoError(t, err)
					err = os.RemoveAll(attachmentDir)
					assert.NoError(t, err)
				}()

				ret := generateE2ETestType1Results(t, th, model.ComplianceExportTypeCsv, attachmentDir,
					exportDir, attachmentBackend, exportBackend, tt.testStopping)
				jl := ret.joinLeaves
				cu := ret.createUpdateTimes
				posts := ret.posts
				files := ret.attachments
				users := ret.users
				channels := ret.channels
				teams := ret.teams
				batches := ret.batches
				//batchTimes := ret.batchTimes

				expectedBatchExport := []string{
					// batch 1
					fmt.Sprintf(csvE2E1Batch1,
						// 1           2              3                      4              5
						teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, channels[1].Id,
						// 6          7            8             9
						users[0].Id, users[1].Id, users[2].Id, users[6].Id,
						// 10         11           12           13           14           15
						posts[0].Id, posts[1].Id, posts[2].Id, files[0].Id, files[1].Id, files[2].Id,
						// 16   17           18          19     20          21     22
						jl[0].join, jl[1].join, jl[1].leave, cu[0], jl[2].join, cu[1], jl[2].leave,
						// 23            24       25
						jl[6].join, jl[6].leave, cu[2]),

					// batch 2
					fmt.Sprintf(csvE2E1Batch2,
						// 1           2              3                      4
						teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id,
						// 5          6            7            8            9
						users[0].Id, users[3].Id, posts[3].Id, posts[4].Id, posts[5].Id,
						// 10         11           12
						files[3].Id, files[4].Id, files[5].Id,
						// 13        14           15          16     17    18
						jl[0].join, jl[3].join, jl[3].leave, cu[3], cu[4], cu[5]),

					// batch 3
					fmt.Sprintf(csvE2E1Batch3,
						// 1           2              3                      4              5
						teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, channels[2].Id,
						// 6          7              8            9
						users[0].Id, users[4].Id, users[5].Id, users[7].Id,
						// 10         11           12
						posts[6].Id, posts[7].Id, posts[8].Id,
						// 13         14           15
						files[6].Id, files[7].Id, files[8].Id,
						// 16        17          18          19     20     21
						jl[0].join, jl[4].join, jl[4].leave, cu[6], cu[7], cu[8],
						// 22        23           24
						jl[5].join, jl[5].leave, jl[7].join),
				}

				for batchNum, batchName := range batches {
					export := openZipAndReadFirstFile(t, exportBackend, batchName)

					exportLines := strings.Split(export, "\n")
					expectedLines := strings.Split(expectedBatchExport[batchNum], "\n")

					//assert.Equal(t, expectedBatchExport[batchNum], export, "batch %d", batchNum)

					// the export is not always sorted when there are > 1 channels, so do this:
					assert.Len(t, exportLines, len(expectedLines))
					for _, l := range expectedLines {
						assert.Contains(t, exportLines, l, "batch %d, batchName: %s", batchNum+1, batchName)
					}
				}
			})
		}
	})

	t.Run("actiance e2e 2 - post from user not in channel", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		ret := generateE2ETestType2Results(t, th, model.ComplianceExportTypeActiance, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		channel2 := ret.channels[0]
		start := ret.start
		jl := ret.joinLeaves
		posts := ret.posts
		createUpdateTimes := ret.createUpdateTimes
		jobEndTime := ret.jobEndTime
		batches := ret.batches

		// Expected data:
		batch1xml := fmt.Sprintf(strings.TrimSpace(e2eXml2), channel2.Id, start, jl[0].join, start,
			posts[0].Id, createUpdateTimes[0],
			posts[1].Id, createUpdateTimes[1],
			jobEndTime, jobEndTime, jobEndTime)

		xmlContents := openZipAndReadFile(t, exportBackend, batches[0], "actiance_export.xml")

		require.Equal(t, batch1xml, xmlContents, "batch 1")
	})

	t.Run("GlobalRelay e2e 2 - post from user not in channel", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		ret := generateE2ETestType2Results(t, th, model.ComplianceExportTypeGlobalrelayZip, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		posts := ret.posts
		batchTimes := ret.batchTimes
		jobStartTime := ret.start
		jl := ret.joinLeaves
		batches := ret.batches
		cu := ret.createUpdateTimes

		// Global relay needs to be updated to use Actiance logic. MM-61718
		batchStartTime := batchTimes[0].start
		batchEndTime := batchTimes[0].end

		expectedBatchExport := []string{
			// batch 1 Summary
			fmt.Sprintf(grE2E2Batch1Summary,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                    6                    7                       8
				conv(batchStartTime), conv(batchEndTime), conv(posts[0].CreateAt), conv(posts[1].CreateAt)),

			// batch 1
			fmt.Sprintf(grE2E2Batch1,
				// 1                   2                   3                      4              5
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime), conv(batchStartTime),
				// 6                 7             8           9
				conv(batchEndTime), conv(cu[0]), conv(cu[1]), conv(jobStartTime)),
		}

		data := openZipAndReadFirstFile(t, exportBackend, batches[0])
		// clean some bad csrf if present
		msg := global_relay_export.CleanTestOutput(data)

		require.Contains(t, msg, expectedBatchExport[0])
		require.Contains(t, msg, expectedBatchExport[1])
	})

	t.Run("CSV e2e 2 - post from user not in channel", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		ret := generateE2ETestType2Results(t, th, model.ComplianceExportTypeCsv, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		posts := ret.posts
		jl := ret.joinLeaves
		batches := ret.batches
		batchTimes := ret.batchTimes
		cu := ret.createUpdateTimes
		users := ret.users
		channels := ret.channels
		teams := ret.teams
		batchStartTime := batchTimes[0].start

		expectedExport := fmt.Sprintf(csvE2E2Batch1,
			// 1           2              3                      4              5
			teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
			// 6          7              8           9          10              11      12
			users[1].Id, posts[0].Id, posts[1].Id, jl[0].join, batchStartTime, cu[0], cu[1])

		export := openZipAndReadFirstFile(t, exportBackend, batches[0])
		assert.Equal(t, expectedExport, export)
	})

	t.Run("actiance e2e 3 - test create, update, delete xml fields", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret, type3Ret := generateE2ETestType3Results(t, th, model.ComplianceExportTypeActiance, attachmentDir, exportDir, attachmentBackend, exportBackend)
		batches := ret.batches
		posts := ret.posts
		users := ret.users
		attachments := ret.attachments
		contents := ret.contents

		for b, batchName := range batches {
			xmlContents := openZipAndReadFile(t, exportBackend, batchName, "actiance_export.xml")

			// Because 7 and 8 fall on the boundary, they could be in either batch, so save them here
			// and then test for one or the other in each batch.
			// The new post that got modified by message8
			message7 := &actiance_export.PostExport{
				XMLName:        xml.Name{Local: "Message"},
				MessageId:      posts[6].Id,
				UserEmail:      users[0].Email,
				UserType:       "user",
				CreateAt:       posts[6].CreateAt,
				Message:        posts[6].Message,  // the original message
				UpdateAt:       posts[6].UpdateAt, // the edit update at
				UpdatedType:    shared.EditedOriginalMsg,
				EditedNewMsgId: posts[7].Id,
			}
			// The old post which has been edited
			message8 := &actiance_export.PostExport{
				XMLName:     xml.Name{Local: "Message"},
				MessageId:   posts[7].Id,
				UserEmail:   users[0].Email,
				UserType:    "user",
				CreateAt:    posts[7].CreateAt,
				Message:     posts[7].Message, // edited message
				UpdateAt:    posts[7].UpdateAt,
				UpdatedType: shared.EditedNewMsg,
			}

			if b == 0 {
				exportedChannels := actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
				assert.Len(t, exportedChannels, 1)
				messages := exportedChannels[0].Messages
				require.Len(t, messages, 10) // batch size 7 + deleted msg1, deleted ms3, 1 deleted file msg

				// 0 - post create
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[0].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[0].CreateAt,
					Message:   posts[0].Message,
				}, messages[0])

				// 1 - post created
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[1].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[1].CreateAt,
					Message:   posts[1].Message,
				}, messages[1])

				// 1 - post deleted
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[1].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[1].CreateAt,
					Message:     "delete " + posts[1].Message,
					UpdateAt:    type3Ret.message1DeleteAt,
					UpdatedType: shared.Deleted,
				}, messages[2])

				// 2 - post updated not edited (e.g., reaction)
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[2].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[2].CreateAt,
					Message:     posts[2].Message,
					UpdateAt:    type3Ret.updatedPost2.UpdateAt,
					UpdatedType: shared.UpdatedNoMsgChange,
				}, messages[3])

				// 3 - post created
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[3].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[3].CreateAt,
					Message:   posts[3].Message,
				}, messages[4])

				// 3 - post deleted with a deleted file
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[3].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[3].CreateAt,
					Message:     "delete " + posts[3].Message,
					UpdateAt:    type3Ret.message3DeleteAt,
					UpdatedType: shared.Deleted,
				}, messages[5])

				// file deleted message
				assert.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   messages[4].MessageId, // cheating bc we don't have this messageId
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[3].CreateAt,
					Message:     "delete " + attachments[0].Path,
					UpdateAt:    type3Ret.deletedPost3.DeleteAt,
					UpdatedType: shared.FileDeleted,
				}, messages[6])

				// the next messages 5, 6 can be in any order because all have equal `updateAt`s
				// 4 - original post
				equalUpdateAts := []*actiance_export.PostExport{
					{
						XMLName:        xml.Name{Local: "Message"},
						MessageId:      posts[4].Id,
						UserEmail:      users[0].Email,
						UserType:       "user",
						CreateAt:       posts[4].CreateAt,
						Message:        posts[4].Message,
						UpdateAt:       posts[4].UpdateAt, // will be the edit update at
						UpdatedType:    shared.EditedOriginalMsg,
						EditedNewMsgId: posts[5].Id,
					},
					{
						XMLName:     xml.Name{Local: "Message"},
						MessageId:   posts[5].Id,
						UserEmail:   users[0].Email,
						UserType:    "user",
						CreateAt:    posts[5].CreateAt,
						Message:     posts[5].Message,
						UpdateAt:    posts[5].UpdateAt,
						UpdatedType: shared.EditedNewMsg,
					},
				}
				require.ElementsMatch(t, equalUpdateAts, []*actiance_export.PostExport{
					messages[7], messages[8]})
				require.ElementsMatch(t, []string{posts[4].Id, posts[5].Id}, []string{messages[7].MessageId, messages[8].MessageId})

				// the last message is one of the two edited or original
				if messages[9].MessageId == message7.MessageId {
					assert.Equal(t, message7, messages[9])
				} else {
					assert.Equal(t, message8, messages[9])
				}

				// only batch one has files, but they're deleted
				zipBytes, err := exportBackend.ReadFile(batchName)
				require.NoError(t, err)
				zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
				require.NoError(t, err)

				attachmentInZip, err := zipReader.Open(attachments[0].Path)
				require.NoError(t, err)
				attachmentInZipContents, err := io.ReadAll(attachmentInZip)
				require.NoError(t, err)
				err = attachmentInZip.Close()
				require.NoError(t, err)
				assert.EqualValuesf(t, contents[0], string(attachmentInZipContents), "file contents not equal")
			}

			if b == 1 {
				exportedChannels := actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
				assert.Len(t, exportedChannels, 1)
				messages := exportedChannels[0].Messages
				require.Len(t, messages, 1)

				// check for either message 7 or message8
				if messages[0].MessageId == message7.MessageId {
					assert.Equal(t, message7, messages[0])
				} else {
					assert.Equal(t, message8, messages[0])
				}
			}
		}
	})

	t.Run("GlobalRelay e2e 3 - test create, update, delete xml fields", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret, type3Ret := generateE2ETestType3Results(t, th, model.ComplianceExportTypeGlobalrelayZip, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		jl := ret.joinLeaves
		posts := ret.posts
		batchTimes := ret.batchTimes
		jobStartTime := ret.start
		batches := ret.batches

		// Global relay needs to be updated to use Actiance logic. MM-61718
		batchStartTime := batchTimes[0].start
		batchEndTime := batchTimes[0].end

		// The comments on 10, 11, 12 show the permutation -- this is needed because 10 & 11 have same UpdateAt,
		// and 12 & 1 (in batch 2) have same UpdateAt
		expectedBatch1Summaries := []string{
			// batch 1 Summary -- Permutation 1
			fmt.Sprintf(grE2E3Batch1SummaryPerm1,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                   10  original            11  edited
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[4].CreateAt), conv(posts[5].CreateAt),
				// 12 original
				conv(posts[6].CreateAt)),

			// batch 1 Summary -- Permutation 2
			fmt.Sprintf(grE2E3Batch1SummaryPerm2,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                    10  edited              11  original
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[5].CreateAt), conv(posts[4].CreateAt),
				// 12 original
				conv(posts[6].CreateAt)),

			// batch 1 summary - Permutation 3
			fmt.Sprintf(grE2E3Batch1SummaryPerm3,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                   10  original            11  edited
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[4].CreateAt), conv(posts[5].CreateAt),
				// 12 edited
				conv(posts[6].CreateAt)),

			// batch 1 Summary -- Permutation 4
			fmt.Sprintf(grE2E3Batch1SummaryPerm4,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                    10  edited              11  original
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[5].CreateAt), conv(posts[4].CreateAt),
				// 12 edited
				conv(posts[6].CreateAt)),
		}

		// The comments on 10, 11, 12 show the permutation -- this is needed because 10 & 11 have same UpdateAt,
		// and 12 & 1 (in batch 2) have same UpdateAt
		expectedBatch1 := []string{
			// batch 1 -- Permutation 1
			fmt.Sprintf(grE2E3Batch1Perm1,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                   10  original            11  edited
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[4].CreateAt), conv(posts[5].CreateAt),
				// 12 original            13
				conv(posts[6].CreateAt), conv(jobStartTime)),

			// batch 1 -- Permutation 2
			fmt.Sprintf(grE2E3Batch1Perm2,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                    10  edited              11  original
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[5].CreateAt), conv(posts[4].CreateAt),
				// 12 original            13
				conv(posts[6].CreateAt), conv(jobStartTime)),

			// batch 1 - Permutation 3
			fmt.Sprintf(grE2E3Batch1Perm3,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                   10  original            11  edited
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[4].CreateAt), conv(posts[5].CreateAt),
				// 12 edited              13
				conv(posts[7].CreateAt), conv(jobStartTime)),

			// batch 1 -- Permutation 4
			fmt.Sprintf(grE2E3Batch1Perm4,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5                       6                         7                       8
				conv(posts[0].CreateAt), conv(posts[1].CreateAt), conv(posts[2].CreateAt), conv(posts[3].CreateAt),
				// 9                                    10  edited              11  original
				conv(type3Ret.deletedPost3.CreateAt), conv(posts[5].CreateAt), conv(posts[4].CreateAt),
				// 12 edited              13
				conv(posts[7].CreateAt), conv(jobStartTime)),
		}

		batchStartTime = batchTimes[1].start
		batchEndTime = batchTimes[1].end

		expectedBatch2Summaries := []string{
			// batch 2 Summary -- Permutation 1
			fmt.Sprintf(grE2E3Batch2SummaryPerm1,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5  edited
				conv(posts[7].CreateAt)),

			// batch 2 Summary -- Permutation 2
			fmt.Sprintf(grE2E3Batch2SummaryPerm2,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5  original
				conv(posts[6].CreateAt)),
		}

		expectedBatch2 := []string{
			// batch 2 Summary -- Permutation 1
			fmt.Sprintf(grE2E3Batch2Perm1,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5  edited              6
				conv(posts[7].CreateAt), conv(jobStartTime)),

			// batch 2 Summary -- Permutation 2
			fmt.Sprintf(grE2E3Batch2Perm2,
				//  1                  2                    3                 4
				conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
				// 5  original            6
				conv(posts[6].CreateAt), conv(jobStartTime)),
		}

		data := openZipAndReadFirstFile(t, exportBackend, batches[0])
		// clean some bad csrf if present
		msg := global_relay_export.CleanTestOutput(data)

		matched := dataContainsOneOfExpected(msg, expectedBatch1Summaries)

		assert.True(t, matched, "batch 1 summary didn't match one of the expected permutations")

		matched = dataContainsOneOfExpected(msg, expectedBatch1)
		assert.True(t, matched, "batch 1 body didn't match one of the expected permutations")

		data = openZipAndReadFirstFile(t, exportBackend, batches[1])
		// clean some bad csrf if present
		msg = global_relay_export.CleanTestOutput(data)

		matched = dataContainsOneOfExpected(msg, expectedBatch2Summaries)
		assert.True(t, matched, "batch 2 summary didn't match one of the expected permutations")

		matched = dataContainsOneOfExpected(msg, expectedBatch2)
		assert.True(t, matched, "batch 2 body didn't match one of the expected permutations")
	})

	t.Run("CSV e2e 3 - test create, update, delete fields", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret, ret3 := generateE2ETestType3Results(t, th, model.ComplianceExportTypeCsv, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		jl := ret.joinLeaves
		posts := ret.posts
		//cu := ret.createUpdateTimes
		//jobStartTime := ret.start
		batches := ret.batches
		users := ret.users
		channels := ret.channels
		teams := ret.teams
		attachments := ret.attachments

		// NOTE: the comments describe the order of the last three messages (21 22 23),
		// eg in perm1: message 4, edited message 4, and message 6
		expectedExports := []string{
			// original, edited, "original" msg 6
			fmt.Sprintf(csvE2E3Batch1Perm1,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6          7              8           9          10              11 edited
				posts[0].Id, posts[1].Id, posts[2].Id, posts[3].Id, posts[4].Id, posts[5].Id,
				// 12        13
				posts[6].Id, attachments[0].Id,
				// 14         15                  16                17                        18
				jl[0].join, posts[0].CreateAt, posts[1].CreateAt, ret3.message1DeleteAt, posts[2].CreateAt,
				// 19                     20                   21                  22               23
				posts[3].CreateAt, ret3.message3DeleteAt, posts[4].CreateAt, posts[4].CreateAt, posts[6].CreateAt,
				// 24 this is the editedBy for message 6
				posts[7].Id),

			// edited, original, original
			fmt.Sprintf(csvE2E3Batch1Perm2,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6          7              8           9          10              11 edited
				posts[0].Id, posts[1].Id, posts[2].Id, posts[3].Id, posts[4].Id, posts[5].Id,
				// 12        13
				posts[6].Id, attachments[0].Id,
				// 14         15                  16                17                        18
				jl[0].join, posts[0].CreateAt, posts[1].CreateAt, ret3.message1DeleteAt, posts[2].CreateAt,
				// 19                     20                21                  22               23
				posts[3].CreateAt, ret3.message3DeleteAt, posts[4].CreateAt, posts[4].CreateAt, posts[6].CreateAt,
				// 24 this is the editedBy for message 6
				posts[7].Id),

			// original, edited, edited
			fmt.Sprintf(csvE2E3Batch1Perm3,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6          7              8           9          10              11 edited
				posts[0].Id, posts[1].Id, posts[2].Id, posts[3].Id, posts[4].Id, posts[5].Id,
				// 12 id of edited msg6       13
				posts[7].Id, attachments[0].Id,
				// 14         15                  16                17                        18
				jl[0].join, posts[0].CreateAt, posts[1].CreateAt, ret3.message1DeleteAt, posts[2].CreateAt,
				// 19                     20                   21                  22               23
				posts[3].CreateAt, ret3.message3DeleteAt, posts[4].CreateAt, posts[4].CreateAt, posts[6].CreateAt),

			// edited, original, edited
			fmt.Sprintf(csvE2E3Batch1Perm4,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6          7              8           9          10              11 edited
				posts[0].Id, posts[1].Id, posts[2].Id, posts[3].Id, posts[4].Id, posts[5].Id,
				// 12 id of edited msg6      13
				posts[7].Id, attachments[0].Id,
				// 14         15                  16                17                        18
				jl[0].join, posts[0].CreateAt, posts[1].CreateAt, ret3.message1DeleteAt, posts[2].CreateAt,
				// 19                     20                  21                  22               23
				posts[3].CreateAt, ret3.message3DeleteAt, posts[4].CreateAt, posts[4].CreateAt, posts[6].CreateAt),
		}

		export := openZipAndReadFirstFile(t, exportBackend, batches[0])

		matched := false
		for _, perm := range expectedExports {
			if export == perm {
				matched = true
				break
			}
		}
		assert.True(t, matched, "batch 1 didn't match one of the expected permutations")

		expectedExports = []string{
			// original message 6  (which says "message 6" in the message, and has new id -- which is post 6's id)
			fmt.Sprintf(csvE2E3Batch2Perm1,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6
				posts[6].Id,
				// 7 this is the editedBy for message 6 -- editedBy is confusing (cause it's the original id), but it is what it is
				posts[7].Id,
				// 8                 9
				posts[6].CreateAt, jl[0].join),

			// edited message 6  (which says "edited message 6" in the message, and has original id)
			fmt.Sprintf(csvE2E3Batch2Perm2,
				// 1           2              3                      4              5
				teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
				// 6          7                  8
				posts[7].Id, posts[6].CreateAt, jl[0].join),
		}

		export = openZipAndReadFirstFile(t, exportBackend, batches[1])

		matched = false
		for _, perm := range expectedExports {
			if export == perm {
				matched = true
				break
			}
		}
		assert.True(t, matched, "batch 2 didn't match one of the expected permutations")
	})

	t.Run("actiance e2e 4 - test edits with multiple simultaneous updates", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret := generateE2ETestType4Results(t, th, model.ComplianceExportTypeActiance, attachmentDir, exportDir, attachmentBackend, exportBackend)
		batch001 := ret.batches[0]
		posts := ret.posts
		users := ret.users

		xmlContents := openZipAndReadFile(t, exportBackend, batch001, "actiance_export.xml")

		exportedChannels := actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages := exportedChannels[0].Messages
		require.Len(t, messages, 5)

		// the messages can be in any order because all have equal `updateAt`s
		equalUpdateAts := []*actiance_export.PostExport{
			{
				XMLName:        xml.Name{Local: "Message"},
				MessageId:      posts[0].Id,
				UserEmail:      users[0].Email,
				UserType:       "user",
				CreateAt:       posts[0].CreateAt,
				Message:        posts[0].Message,
				UpdateAt:       posts[1].UpdateAt, // the edit update at
				UpdatedType:    shared.EditedOriginalMsg,
				EditedNewMsgId: posts[1].Id,
			},
			{
				XMLName:     xml.Name{Local: "Message"},
				MessageId:   posts[1].Id,
				UserEmail:   users[0].Email,
				UserType:    "user",
				CreateAt:    posts[1].CreateAt,
				Message:     posts[1].Message,
				UpdateAt:    posts[1].UpdateAt,
				UpdatedType: shared.EditedNewMsg,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[2].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[2].CreateAt,
				Message:   posts[2].Message,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[3].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[3].CreateAt,
				Message:   posts[3].Message,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[4].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[4].CreateAt,
				Message:   posts[4].Message,
			},
		}
		require.ElementsMatch(t, equalUpdateAts, []*actiance_export.PostExport{
			messages[0], messages[1], messages[2], messages[3], messages[4]})
	})

	t.Run("GlobalRelay e2e 4 - test edits with multiple simultaneous updates", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret := generateE2ETestType4Results(t, th, model.ComplianceExportTypeGlobalrelayZip, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		jl := ret.joinLeaves
		posts := ret.posts
		batchTimes := ret.batchTimes
		//jobStartTime := ret.start
		batches := ret.batches

		// Global relay needs to be updated to use Actiance logic. MM-61718
		batchStartTime := batchTimes[0].start
		batchEndTime := batchTimes[0].end

		// summaryHeader
		allExpected := []string{fmt.Sprintf(grE2E4Summary,
			//  1                  2                    3                 4
			conv(batchStartTime), conv(batchEndTime), conv(jl[0].join), conv(batchEndTime),
		)}

		// summary body
		allExpected = append(allExpected,
			fmt.Sprintf("* %s @user1 user (user1@email): message 0", conv(posts[0].CreateAt)),
			fmt.Sprintf("* %s @user1 user (user1@email): edited message 0", conv(posts[1].CreateAt)),
			fmt.Sprintf("* %s @user1 user (user1@email): message 2", conv(posts[2].CreateAt)),
			fmt.Sprintf("* %s @user1 user (user1@email): message 3", conv(posts[3].CreateAt)),
			fmt.Sprintf("* %s @user1 user (user1@email): message 4", conv(posts[4].CreateAt)),
		)

		// first two are channel and participants, rest are messages
		allExpected = append(allExpected,
			fmt.Sprintf("<div class=3D\"summary-list\">\n    <ul>\n        <li><span class=3D\"bold\">Channel:&nbsp;</span>the Channel Two</li>\n        <li><span class=3D\"bold\">Started:&nbsp;</span>%s</li>\n        <li><span class=3D\"bold\">Ended:&nbsp;</span>%s</li>\n        <li><span class=3D\"bold\">Duration:&nbsp;</span>0 seconds</li>\n    </ul>\n</div>", conv(batchStartTime), conv(batchEndTime)),
			fmt.Sprintf("<tr>\n    <td class=3D\"username\">@user1</td>\n    <td class=3D\"usertype\">user</td>\n    <td class=3D\"email\">user1@email</td>\n    <td class=3D\"joined\">%s</td>\n    <td class=3D\"left\">%s</td>\n    <td class=3D\"duration\">0 seconds</td>\n    <td class=3D\"messages\">5</td>\n</tr>\n", conv(jl[0].join), conv(batchEndTime)),
			fmt.Sprintf("<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@user1</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(user1@email):</span>\n    <span class=3D\"message\">message 0</span>\n    <span class=3D\"previews_post\"></span>\n</li>\n", conv(posts[0].CreateAt)),
			fmt.Sprintf("<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@user1</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(user1@email):</span>\n    <span class=3D\"message\">edited message 0</span>\n    <span class=3D\"previews_post\"></span>\n</li>\n", conv(posts[1].CreateAt)),
			fmt.Sprintf("<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@user1</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(user1@email):</span>\n    <span class=3D\"message\">message 2</span>\n    <span class=3D\"previews_post\"></span>\n</li>\n", conv(posts[2].CreateAt)),
			fmt.Sprintf("<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@user1</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(user1@email):</span>\n    <span class=3D\"message\">message 3</span>\n    <span class=3D\"previews_post\"></span>\n</li>", conv(posts[3].CreateAt)),
			fmt.Sprintf("<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@user1</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(user1@email):</span>\n    <span class=3D\"message\">message 4</span>\n    <span class=3D\"previews_post\"></span>\n</li>\n", conv(posts[4].CreateAt)),
		)

		data := openZipAndReadFirstFile(t, exportBackend, batches[0])
		// clean some bad csrf if present
		msg := global_relay_export.CleanTestOutput(data)

		for _, expected := range allExpected {
			assert.Contains(t, msg, expected, "expected exported msg to contain: \n%s\n\nExported msg:\n%s\n", expected, msg)
			if !strings.Contains(msg, expected) {
				break
			}
		}
	})

	t.Run("CSV e2e 4 - test edits with multiple simultaneous updates", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		ret := generateE2ETestType4Results(t, th, model.ComplianceExportTypeCsv, attachmentDir,
			exportDir, attachmentBackend, exportBackend)
		jl := ret.joinLeaves
		posts := ret.posts
		batches := ret.batches
		users := ret.users
		channels := ret.channels
		teams := ret.teams

		// fill out the lines using the template (easier to read than if it were an inline string)
		tmpl := fmt.Sprintf(csvE2E4Batch1,
			// 1           2              3                      4              5
			teams[0].Id, teams[0].Name, teams[0].DisplayName, channels[0].Id, users[0].Id,
			// 6          7              8           9          10
			posts[0].Id, posts[1].Id, posts[2].Id, posts[3].Id, posts[4].Id,
			// 11         12                13
			jl[0].join, posts[0].CreateAt, posts[2].CreateAt)

		allExpected := strings.Split(tmpl, "\n")

		export := openZipAndReadFirstFile(t, exportBackend, batches[0])

		assert.Len(t, strings.Split(export, "\n"), len(allExpected)+1) // +1 for header line

		for _, expected := range allExpected {
			assert.Contains(t, export, expected, "expected export to contain: \n%s\n\nExport:\n%s\n", expected, export)
			if !strings.Contains(export, expected) {
				break
			}
		}
	})

	t.Run("actiance e2e 5 - test delete and update semantics", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		rets, ret5s := generateE2ETestType5Results(t, th, model.ComplianceExportTypeActiance, attachmentDir, exportDir, attachmentBackend, exportBackend)
		posts := rets[0].posts
		message0DeleteAt := ret5s[0].message0DeleteAt
		zipBytes := ret5s[0].zipBytes[0]

		//
		// Job 1
		//
		xmlContents := readFileFromZip(t, zipBytes, "actiance_export.xml")

		exportedChannels := actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages := exportedChannels[0].Messages
		require.Len(t, messages, 2) // 1 posted, 1 deleted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// 1 - post deleted
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		//
		// Job 2
		//
		posts = rets[1].posts
		message0DeleteAt = ret5s[1].message0DeleteAt
		zipBytes = ret5s[1].zipBytes[0]
		zipBytes2 := ret5s[1].zipBytes[1]

		xmlContents = readFileFromZip(t, zipBytes, "actiance_export.xml")

		exportedChannels = actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 1) // 1 posted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[1].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[1].CreateAt,
			Message:   posts[1].Message,
		}, messages[0])

		xmlContents = readFileFromZip(t, zipBytes2, "actiance_export.xml")

		exportedChannels = actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 2) // message0's create and delete messages

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// 1 - post deleted
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		//
		// Job 3
		//
		posts = rets[2].posts
		zipBytes = ret5s[2].zipBytes[0]

		xmlContents = readFileFromZip(t, zipBytes, "actiance_export.xml")

		exportedChannels = actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 2) // 2 posted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[1].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[1].CreateAt,
			Message:   posts[1].Message,
		}, messages[1])

		//
		// Job 4
		//
		posts = rets[3].posts
		updatedPost1 := ret5s[3].updatedPost1
		message0DeleteAt = ret5s[3].message0DeleteAt
		zipBytes = ret5s[3].zipBytes[0]

		xmlContents = readFileFromZip(t, zipBytes, "actiance_export.xml")

		exportedChannels = actiance_export.GetChannelExports(t, strings.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 3) //filler post, deleted post, and updated posts ONLY

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[2].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[2].CreateAt,
			Message:   posts[2].Message,
		}, messages[0])

		// post deleted ONLY (not its created post, because that was in the previous job)
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		// post updated ONLY (not its created post, because that was in the previous job)
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[1].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[1].CreateAt,
			Message:     posts[1].Message,
			UpdateAt:    updatedPost1.UpdateAt,
			UpdatedType: shared.UpdatedNoMsgChange,
		}, messages[2])
	})

	t.Run("GlobalRelay e2e 5 - test delete and update semantics", func(t *testing.T) {
		msgTmpl := "<li class=3D\"message\">\n    <span class=3D\"sent_time\">%s</span>\n    <span class=3D\"username\">@%s</span>\n    <span class=3D\"postusername\"></span>\n    <span class=3D\"usertype\">user</span>\n    <span class=3D\"email\">(%s):</span>\n    <span class=3D\"message\">%s</span>\n    <span class=3D\"previews_post\"></span>\n</li>\n"

		assertContainsAllMsgs := func(msg string, allExpected []string) {
			for _, expected := range allExpected {
				assert.Contains(t, msg, expected, "expected exported msg to contain: \n%s\n\nExported msg:\n%s\n", expected, msg)
				if !strings.Contains(msg, expected) {
					break
				}
			}

			numMessages := 0
			for _, l := range strings.Split(msg, "\n") {
				if strings.Contains(l, "<li class=3D\"message\">") {
					numMessages += 1
				}
			}

			assert.Equal(t, len(allExpected), numMessages)
		}

		th := setup(t)
		defer th.TearDown()

		rets, ret5s := generateE2ETestType5Results(t, th, model.ComplianceExportTypeGlobalrelayZip, attachmentDir, exportDir, attachmentBackend, exportBackend)
		posts := rets[0].posts
		zipBytes := ret5s[0].zipBytes[0]

		//
		// Job 1
		//
		data := readFirstFileFromZip(t, zipBytes)
		// clean some bad csrf if present
		msg := global_relay_export.CleanTestOutput(data)

		// post created
		allExpected := []string{
			fmt.Sprintf(msgTmpl, conv(posts[0].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[0].Message),
		}
		assertContainsAllMsgs(msg, allExpected)

		// NOTE: GlobalRelay does not record deleted posts (see actiance above) MM-61718

		//
		// Job 2
		//
		posts = rets[1].posts
		zipBytes = ret5s[1].zipBytes[0]
		zipBytes2 := ret5s[1].zipBytes[1]

		data = readFirstFileFromZip(t, zipBytes)
		// clean some bad csrf if present
		msg = global_relay_export.CleanTestOutput(data)

		// post created
		allExpected = []string{
			fmt.Sprintf(msgTmpl, conv(posts[1].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[1].Message),
		}
		assertContainsAllMsgs(msg, allExpected)

		data = readFirstFileFromZip(t, zipBytes2)
		// clean some bad csrf if present
		msg = global_relay_export.CleanTestOutput(data)

		// should get message 0's create message (but not its delete message MM-61718)
		allExpected = []string{
			fmt.Sprintf(msgTmpl, conv(posts[0].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[0].Message),
		}
		assertContainsAllMsgs(msg, allExpected)

		//
		// Job 3
		//
		posts = rets[2].posts
		zipBytes = ret5s[2].zipBytes[0]

		data = readFirstFileFromZip(t, zipBytes)
		// clean some bad csrf if present
		msg = global_relay_export.CleanTestOutput(data)

		// post created
		allExpected = []string{
			fmt.Sprintf(msgTmpl, conv(posts[0].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[0].Message),
			fmt.Sprintf(msgTmpl, conv(posts[1].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[1].Message),
		}
		assertContainsAllMsgs(msg, allExpected)

		//
		// Job 4
		//
		posts = rets[3].posts
		updatedPost1 := ret5s[3].updatedPost1
		zipBytes = ret5s[3].zipBytes[0]

		data = readFirstFileFromZip(t, zipBytes)
		// clean some bad csrf if present
		msg = global_relay_export.CleanTestOutput(data)

		// should get message 0's create message (but not its delete message MM-61718)
		allExpected = []string{
			fmt.Sprintf(msgTmpl, conv(posts[2].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[2].Message),

			// not the post deleted MM-61718 (andnot its created post, because that was in the previous job)

			// should be post updated ONLY, (not its created post, because that was in the previous job), but doesn't work yet: MM-61718
			fmt.Sprintf(msgTmpl, conv(posts[1].CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[1].Message),
			fmt.Sprintf(msgTmpl, conv(updatedPost1.CreateAt), th.BasicUser.Username, th.BasicUser.Email, posts[1].Message),
		}
		assertContainsAllMsgs(msg, allExpected)
	})

	t.Run("CSV e2e 5 - test delete and update semantics", func(t *testing.T) {
		type msgDetailsToCheck struct {
			createAt int64
			postId   string
			message  string
		}

		assertContainsAllMsgs := func(msg string, allExpected []msgDetailsToCheck, tag string) {
			allLines := strings.Split(strings.Trim(msg, " \n"), "\n")
			allLines = allLines[1:] // remove header
			var msgLines []string
			for _, l := range allLines {
				if !strings.Contains(l, "previously-joined") {
					msgLines = append(msgLines, l)
				}
			}

			assert.Equal(t, len(allExpected), len(msgLines), tag)

			for _, expected := range allExpected {
				found := false
				for _, msg := range msgLines {
					if strings.HasPrefix(msg, fmt.Sprintf("%d", expected.createAt)) &&
						strings.Contains(msg, expected.postId+",,,"+expected.message) {
						found = true
						break
					}
				}
				assert.True(t, found, "%s actual msg did not contain expected msg. msg: \n%s\nexpected msg details: %v\n", tag, msg, expected)
			}
		}

		th := setup(t)
		defer th.TearDown()

		rets, ret5s := generateE2ETestType5Results(t, th, model.ComplianceExportTypeCsv, attachmentDir, exportDir, attachmentBackend, exportBackend)
		posts := rets[0].posts
		message0DeleteAt := ret5s[0].message0DeleteAt
		zipBytes := ret5s[0].zipBytes[0]

		// NOTE: we know csv outputs correctly from above, so just test that the right post IDs are being exported

		//
		// Job 1
		//
		export := readFirstFileFromZip(t, zipBytes)

		// post created, post deleted
		assertContainsAllMsgs(export, []msgDetailsToCheck{
			{
				createAt: posts[0].CreateAt,
				postId:   posts[0].Id,
				message:  posts[0].Message,
			},
			{
				createAt: message0DeleteAt,
				postId:   posts[0].Id,
				message:  "delete " + posts[0].Message,
			},
		}, "Job 1")

		//
		// Job 2
		//
		posts = rets[1].posts
		message0DeleteAt = ret5s[1].message0DeleteAt
		zipBytes = ret5s[1].zipBytes[0]
		zipBytes2 := ret5s[1].zipBytes[1]

		export = readFirstFileFromZip(t, zipBytes)

		// post created
		assertContainsAllMsgs(export, []msgDetailsToCheck{
			{
				createAt: posts[1].CreateAt,
				postId:   posts[1].Id,
				message:  posts[1].Message,
			},
		}, "Job 1")

		export = readFirstFileFromZip(t, zipBytes2)

		// post created
		assertContainsAllMsgs(export, []msgDetailsToCheck{
			{
				createAt: posts[0].CreateAt,
				postId:   posts[0].Id,
				message:  posts[0].Message,
			},
			{
				createAt: message0DeleteAt,
				postId:   posts[0].Id,
				message:  "delete " + posts[0].Message,
			},
		}, "Job 2")

		// Job 3
		//
		posts = rets[2].posts
		zipBytes = ret5s[2].zipBytes[0]

		export = readFirstFileFromZip(t, zipBytes)

		// 2 posts created
		assertContainsAllMsgs(export, []msgDetailsToCheck{
			{
				createAt: posts[0].CreateAt,
				postId:   posts[0].Id,
				message:  posts[0].Message,
			},
			{
				createAt: posts[1].CreateAt,
				postId:   posts[1].Id,
				message:  posts[1].Message,
			},
		}, "Job 3")

		//
		// Job 4
		//
		posts = rets[3].posts
		message0DeleteAt = ret5s[3].message0DeleteAt
		zipBytes = ret5s[3].zipBytes[0]

		export = readFirstFileFromZip(t, zipBytes)

		// post created
		assertContainsAllMsgs(export, []msgDetailsToCheck{
			{
				createAt: posts[2].CreateAt,
				postId:   posts[2].Id,
				message:  posts[2].Message,
			},
			// post deleted ONLY (not its created post, because that was in the previous job)
			// except that CSV doesn't have this logic, needs fix, MM-61718
			{
				createAt: posts[0].CreateAt,
				postId:   posts[0].Id,
				message:  posts[0].Message,
			},
			{
				createAt: message0DeleteAt,
				postId:   posts[0].Id,
				message:  "delete " + posts[0].Message,
			},
			// post updated ONLY (not its created post, because that was in the previous job)
			{
				createAt: posts[1].CreateAt,
				postId:   posts[1].Id,
				message:  posts[1].Message,
			},
		}, "Job 4")
	})

	t.Run("csv -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		time.Sleep(1 * time.Millisecond)
		now := model.GetMillis()

		jobStart := now - 1
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = jobStart
			*cfg.MessageExportSettings.BatchSize = 5
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeCsv
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		attachmentContent := "Hello there"
		attachmentPath001 := "path/to/attachments/one.txt"
		_, _ = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath001)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    model.NewId(),
			Message:   "zz" + model.NewId() + "b",
			CreateAt:  now,
			UpdateAt:  now,
			FileIds:   []string{"test1"},
		})
		require.NoError(t, err)

		attachment, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  now,
			UpdateAt:  now,
			Path:      attachmentPath001,
		})
		require.NoError(t, err)

		for i := 0; i < 10; i++ {
			_, e := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now + int64(i),
				UpdateAt:  now + int64(i),
			})
			require.NoError(t, e)
		}

		job := runJobForTest(t, th, nil)

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
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{batch001, batch002, batch003}, files)

		zipBytes, err := exportBackend.ReadFile(batch001)
		require.NoError(t, err)

		zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		csvZipFilePath := path.Join("files", post.Id, fmt.Sprintf("%s-%s", attachment.Id, path.Base(attachment.Path)))

		attachmentInZip, err := zipReader.Open(csvZipFilePath)
		require.NoError(t, err)
		attachmentInZipContents, err := io.ReadAll(attachmentInZip)
		require.NoError(t, err)
		err = attachmentInZip.Close()
		require.NoError(t, err)

		require.EqualValuesf(t, attachmentContent, string(attachmentInZipContents), "file contents not equal")
	})
}

func openZipAndReadFile(t *testing.T, backend filestore.FileBackend, path string, filename string) string {
	zipBytes, err := backend.ReadFile(path)
	require.NoError(t, err)
	return readFileFromZip(t, zipBytes, filename)
}

func readFileFromZip(t *testing.T, zipBytes []byte, filename string) string {
	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	require.NoError(t, err)

	file, err := zipReader.Open(filename)
	require.NoError(t, err)
	contents, err := io.ReadAll(file)
	require.NoError(t, err)
	err = file.Close()
	require.NoError(t, err)

	return string(contents)
}

func openZipAndReadFirstFile(t *testing.T, backend filestore.FileBackend, path string) string {
	zipBytes, err := backend.ReadFile(path)
	require.NoError(t, err)
	return readFirstFileFromZip(t, zipBytes)
}

func readFirstFileFromZip(t *testing.T, zipBytes []byte) string {
	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	require.NoError(t, err)

	firstFile, err := zipReader.File[0].Open()
	require.NoError(t, err)
	contents, err := io.ReadAll(firstFile)
	require.NoError(t, err)
	err = firstFile.Close()
	require.NoError(t, err)

	return string(contents)
}

func dataContainsOneOfExpected(data string, expected []string) bool {
	for _, perm := range expected {
		if strings.Contains(data, perm) {
			return true
		}
	}
	return false
}
