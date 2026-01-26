// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build e2e

package commands

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// SetupWikiExportTestHelper sets up a test helper with job workers running for wiki export tests
func (s *MmctlE2ETestSuite) SetupWikiExportTestHelper() *api4.TestHelper {
	s.th = api4.Setup(s.T()).InitBasic(s.T())

	// Start job workers and schedulers
	err := s.th.App.Srv().Jobs.StartWorkers()
	s.Require().NoError(err)

	err = s.th.App.Srv().Jobs.StartSchedulers()
	s.Require().NoError(err)

	return s.th
}

func (s *MmctlE2ETestSuite) TestWikiExportJob() {
	s.T().Skip("Temporarily disabled - wiki export/import format needs fixing")
	s.SetupWikiExportTestHelper()

	s.RunForSystemAdminAndLocal("wiki export job creates valid export file", func(c client.Client) {
		printer.Clean()

		// Create a unique test channel to avoid conflicts between runs
		testSuffix := model.NewId()[:8]
		testChannel, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "wiki-export-test-" + testSuffix,
			DisplayName: "Wiki Export Test " + testSuffix,
		}, false)
		s.Require().Nil(appErr)
		defer s.th.App.PermanentDeleteChannel(s.th.Context, testChannel)

		// Create a wiki with pages for export
		wiki := &model.Wiki{
			ChannelId:   testChannel.Id,
			Title:       "Export Test Wiki " + testSuffix,
			Description: "Wiki for export testing",
		}
		createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().NotNil(createdWiki)

		// Create some pages in the wiki
		page1, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", "Test Page 1", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		s.Require().NotNil(page1)

		// Update page1 with content
		_, appErr = s.th.App.UpdatePage(s.th.Context, page1, "Test Page 1", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is test content for page 1"}]}]}`, "", testChannel)
		s.Require().Nil(appErr)

		// Create a child page
		page2, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, page1.Id, "Child Page", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		s.Require().NotNil(page2)

		// Update page2 with content
		_, appErr = s.th.App.UpdatePage(s.th.Context, page2, "Child Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is child page content"}]}]}`, "", testChannel)
		s.Require().Nil(appErr)

		// Create and run the wiki export job
		jobData := map[string]string{
			"channel_ids":         testChannel.Id,
			"include_attachments": "false",
		}

		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: jobData,
		})
		s.Require().NoError(err)
		s.Require().NotNil(job)

		// Wait for job to complete
		completedJob := s.waitForJob(job.Id, 60*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedJob.Status, "Job should complete successfully, got status: %s, error: %s", completedJob.Status, completedJob.Data["error"])

		// Verify export file was created
		exportFile := completedJob.Data["export_file"]
		s.Require().NotEmpty(exportFile, "Export file path should be set")

		// Download and verify the export file
		exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
			*s.th.App.Config().ExportSettings.Directory))
		s.Require().NoError(err)

		exportFilePath := filepath.Join(exportPath, exportFile)
		_, err = os.Stat(exportFilePath)
		s.Require().NoError(err, "Export file should exist")

		// Read the export file - it's a JSONL file since we're not including attachments
		jsonlContent, err := os.ReadFile(exportFilePath)
		s.Require().NoError(err)
		s.Require().NotEmpty(jsonlContent, "JSONL export should have content")

		// Parse and verify the JSONL content
		scanner := bufio.NewScanner(bytes.NewReader(jsonlContent))
		var versionFound, wikiFound bool
		pageCount := 0

		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			var entry map[string]interface{}
			err := json.Unmarshal([]byte(line), &entry)
			s.Require().NoError(err, "Each line should be valid JSON")

			switch entry["type"] {
			case "version":
				versionFound = true
			case "wiki":
				wikiFound = true
				wikiData := entry["wiki"].(map[string]interface{})
				s.True(strings.HasPrefix(*getStringPtr(wikiData, "title"), "Export Test Wiki"), "Wiki title should start with 'Export Test Wiki'")
			case "page":
				pageCount++
			}
		}
		s.Require().NoError(scanner.Err())

		s.True(versionFound, "Export should contain version line")
		s.True(wikiFound, "Export should contain wiki entry")
		s.Equal(2, pageCount, "Export should contain 2 pages")

		// Cleanup
		err = os.Remove(exportFilePath)
		s.Require().NoError(err)
	})
}

func (s *MmctlE2ETestSuite) TestWikiImportJob() {
	s.T().Skip("Temporarily disabled - wiki export/import format needs fixing")
	s.SetupWikiExportTestHelper()

	s.RunForSystemAdminAndLocal("wiki import job imports wiki from export file", func(c client.Client) {
		printer.Clean()

		// Step 1: Create a wiki with pages for export
		wiki := &model.Wiki{
			ChannelId:   s.th.BasicChannel.Id,
			Title:       "Import Test Wiki",
			Description: "Wiki for import testing",
		}
		createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		page1, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", "Import Page 1", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdatePage(s.th.Context, page1, "Import Page 1", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content for import test"}]}]}`, "", s.th.BasicChannel)
		s.Require().Nil(appErr)

		// Step 2: Export the wiki
		exportJobData := map[string]string{
			"channel_ids":         s.th.BasicChannel.Id,
			"include_attachments": "false",
		}

		exportJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: exportJobData,
		})
		s.Require().NoError(err)

		completedExportJob := s.waitForJob(exportJob.Id, 60*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedExportJob.Status)

		exportFile := completedExportJob.Data["export_file"]
		s.Require().NotEmpty(exportFile)

		// Step 3: Create a new channel for import
		importChannel, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "wiki-import-target-" + model.NewId()[:8],
			DisplayName: "Wiki Import Target",
		}, false)
		s.Require().Nil(appErr)

		// Step 4: Import the wiki into the new channel
		// Get the full path to the export file
		exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
			*s.th.App.Config().ExportSettings.Directory))
		s.Require().NoError(err)
		exportFilePath := filepath.Join(exportPath, exportFile)

		importJobData := map[string]string{
			model.WikiJobDataKeyImportFile: exportFilePath,
			model.WikiJobDataKeyLocalMode:  "true",
		}

		importJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiImport,
			Data: importJobData,
		})
		s.Require().NoError(err)

		completedImportJob := s.waitForJob(importJob.Id, 60*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedImportJob.Status, "Import job should succeed, error: %s", completedImportJob.Data["error"])

		// Step 5: Verify the import - wiki should exist
		// Note: The import creates/updates based on import_source_id,
		// so it will update the existing wiki rather than create in new channel
		// This is the expected idempotent behavior

		// Cleanup export file
		_ = os.Remove(exportFilePath)
		// Cleanup import channel
		_ = s.th.App.PermanentDeleteChannel(s.th.Context, importChannel)
	})
}

func (s *MmctlE2ETestSuite) TestWikiExportImportComprehensive() {
	s.T().Skip("Temporarily disabled - wiki export/import format needs fixing")
	s.SetupWikiExportTestHelper()

	s.RunForSystemAdminAndLocal("comprehensive export/import with multiple wikis, pages, comments, and attachments", func(c client.Client) {
		printer.Clean()

		// ============================================================
		// SETUP: Create multiple wikis with pages, hierarchy, and comments
		// ============================================================

		// Use unique suffix for this test run to avoid conflicts
		testSuffix := model.NewId()[:8]

		// Create first channel for wiki 1 (use unique channel to avoid conflicts between runs)
		channel1, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "wiki-test-channel-1-" + testSuffix,
			DisplayName: "Wiki Test Channel 1 " + testSuffix,
		}, false)
		s.Require().Nil(appErr)
		defer s.th.App.PermanentDeleteChannel(s.th.Context, channel1)

		// Create second channel for wiki 2
		channel2, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "wiki-test-channel-2-" + testSuffix,
			DisplayName: "Wiki Test Channel 2 " + testSuffix,
		}, false)
		s.Require().Nil(appErr)
		defer s.th.App.PermanentDeleteChannel(s.th.Context, channel2)

		// --- Wiki 1: In channel1 ---
		wiki1 := &model.Wiki{
			ChannelId:   channel1.Id,
			Title:       "Comprehensive Wiki 1 " + testSuffix,
			Description: "First wiki for comprehensive testing",
		}
		createdWiki1, appErr := s.th.App.CreateWiki(s.th.Context, wiki1, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		// Wiki 1 - Root page
		wiki1Root, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki1.Id, "", "Wiki1 Root Page", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_, appErr = s.th.App.UpdatePage(s.th.Context, wiki1Root, "Wiki1 Root Page",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is the root page of Wiki 1"}]}]}`, "", channel1)
		s.Require().Nil(appErr)

		// Wiki 1 - Child page (under root)
		wiki1Child1, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki1.Id, wiki1Root.Id, "Wiki1 Child Page 1", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_, appErr = s.th.App.UpdatePage(s.th.Context, wiki1Child1, "Wiki1 Child Page 1",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First child page content"}]}]}`, "", channel1)
		s.Require().Nil(appErr)

		// Wiki 1 - Second child page (under root)
		wiki1Child2, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki1.Id, wiki1Root.Id, "Wiki1 Child Page 2", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_, appErr = s.th.App.UpdatePage(s.th.Context, wiki1Child2, "Wiki1 Child Page 2",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Second child page content"}]}]}`, "", channel1)
		s.Require().Nil(appErr)

		// Wiki 1 - Grandchild page (under child1)
		wiki1Grandchild, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki1.Id, wiki1Child1.Id, "Wiki1 Grandchild Page", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_, appErr = s.th.App.UpdatePage(s.th.Context, wiki1Grandchild, "Wiki1 Grandchild Page",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Grandchild page - deep hierarchy test"}]}]}`, "", channel1)
		s.Require().Nil(appErr)

		// --- Wiki 2: In channel2 ---
		wiki2 := &model.Wiki{
			ChannelId:   channel2.Id,
			Title:       "Comprehensive Wiki 2 " + testSuffix,
			Description: "Second wiki for comprehensive testing",
		}
		createdWiki2, appErr := s.th.App.CreateWiki(s.th.Context, wiki2, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		// Wiki 2 - Single page
		wiki2Page, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki2.Id, "", "Wiki2 Page", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_, appErr = s.th.App.UpdatePage(s.th.Context, wiki2Page, "Wiki2 Page",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content from Wiki 2"}]}]}`, "", channel2)
		s.Require().Nil(appErr)

		// --- Add comments to Wiki 1 Root Page ---
		// Need a session context for creating comments (they use the session's user ID)
		session, sessionErr := s.th.App.CreateSession(s.th.Context, &model.Session{UserId: s.th.BasicUser.Id, Props: model.StringMap{}})
		s.Require().Nil(sessionErr)
		sessionCtx := s.th.Context.WithSession(session)

		comment1, appErr := s.th.App.CreatePageComment(sessionCtx, wiki1Root.Id, "This is a comment on the root page", nil, createdWiki1.Id, wiki1Root, channel1)
		s.Require().Nil(appErr)
		s.Require().NotNil(comment1)

		// Reply to the first comment (threaded comment)
		comment2, appErr := s.th.App.CreatePageCommentReply(sessionCtx, wiki1Root.Id, comment1.Id, "This is a reply to the first comment", createdWiki1.Id, wiki1Root, channel1)
		s.Require().Nil(appErr)
		s.Require().NotNil(comment2)

		// Another top-level comment
		comment3, appErr := s.th.App.CreatePageComment(sessionCtx, wiki1Root.Id, "Another top-level comment", nil, createdWiki1.Id, wiki1Root, channel1)
		s.Require().Nil(appErr)
		s.Require().NotNil(comment3)

		// ============================================================
		// EXPORT: Export both wikis with comments
		// ============================================================
		exportJobData := map[string]string{
			model.WikiJobDataKeyChannelIds:         channel1.Id + "," + channel2.Id,
			model.WikiJobDataKeyIncludeComments:    "true",
			model.WikiJobDataKeyIncludeAttachments: "false", // No attachments in this test
		}

		exportJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: exportJobData,
		})
		s.Require().NoError(err)

		completedExportJob := s.waitForJob(exportJob.Id, 90*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedExportJob.Status,
			"Export job should succeed, error: %s", completedExportJob.Data["error"])

		// Verify export statistics
		wikisExported := completedExportJob.Data[model.WikiJobDataKeyWikisExported]
		pagesExported := completedExportJob.Data[model.WikiJobDataKeyPagesExported]
		s.Equal("2", wikisExported, "Should export 2 wikis")
		s.Equal("5", pagesExported, "Should export 5 pages (4 from wiki1 + 1 from wiki2)")

		// Get export file path
		exportFile := completedExportJob.Data["export_file"]
		s.Require().NotEmpty(exportFile)

		exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
			*s.th.App.Config().ExportSettings.Directory))
		s.Require().NoError(err)
		exportFilePath := filepath.Join(exportPath, exportFile)

		// ============================================================
		// VERIFY EXPORT FILE STRUCTURE
		// ============================================================
		// Since IncludeAttachments is false, the export is a plain JSONL file, not a ZIP
		jsonlContent, err := os.ReadFile(exportFilePath)
		s.Require().NoError(err)
		s.Require().NotEmpty(jsonlContent, "JSONL export file should have content")

		// Parse JSONL and count entities
		scanner := bufio.NewScanner(bytes.NewReader(jsonlContent))
		var (
			versionCount int
			wikiCount    int
			pageCount    int
			commentCount int
			resolveCount int
		)

		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			var entry map[string]interface{}
			err := json.Unmarshal([]byte(line), &entry)
			s.Require().NoError(err, "Each line should be valid JSON: %s", line)

			switch entry["type"] {
			case "version":
				versionCount++
			case "wiki":
				wikiCount++
			case "page":
				pageCount++
			case "page_comment":
				commentCount++
			case "resolve_wiki_placeholders":
				resolveCount++
			}
		}
		s.Require().NoError(scanner.Err())

		s.Equal(1, versionCount, "Should have 1 version line")
		s.Equal(2, wikiCount, "Should have 2 wiki entries")
		s.Equal(5, pageCount, "Should have 5 page entries")
		s.Equal(3, commentCount, "Should have 3 comment entries")
		s.Equal(2, resolveCount, "Should have 2 resolve_wiki_placeholders entries (one per channel)")

		// ============================================================
		// IMPORT: Re-import the export file
		// ============================================================
		importJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiImport,
			Data: map[string]string{
				model.WikiJobDataKeyImportFile: exportFilePath,
				model.WikiJobDataKeyLocalMode:  "true",
			},
		})
		s.Require().NoError(err)

		completedImportJob := s.waitForJob(importJob.Id, 90*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedImportJob.Status,
			"Import job should succeed, error: %s", completedImportJob.Data["error"])

		// ============================================================
		// VERIFY: Data integrity after import
		// ============================================================

		// Verify Wiki 1 exists with correct structure
		wikis1, appErr := s.th.App.GetWikisForChannel(s.th.Context, channel1.Id, false)
		s.Require().Nil(appErr)
		s.Require().NotEmpty(wikis1)

		expectedWiki1Title := "Comprehensive Wiki 1 " + testSuffix
		var foundWiki1 *model.Wiki
		for _, w := range wikis1 {
			if w.Title == expectedWiki1Title {
				foundWiki1 = w
				break
			}
		}
		s.Require().NotNil(foundWiki1, "Wiki 1 should exist after import")

		// Verify Wiki 2 exists
		wikis2, appErr := s.th.App.GetWikisForChannel(s.th.Context, channel2.Id, false)
		s.Require().Nil(appErr)
		s.Require().NotEmpty(wikis2)

		expectedWiki2Title := "Comprehensive Wiki 2 " + testSuffix
		var foundWiki2 *model.Wiki
		for _, w := range wikis2 {
			if w.Title == expectedWiki2Title {
				foundWiki2 = w
				break
			}
		}
		s.Require().NotNil(foundWiki2, "Wiki 2 should exist after import")

		// Verify page count in Wiki 1's channel
		pages1, appErr := s.th.App.GetChannelPages(s.th.Context, channel1.Id)
		s.Require().Nil(appErr)
		s.GreaterOrEqual(len(pages1.Posts), 4, "Wiki 1 channel should have at least 4 pages")

		// Verify page count in Wiki 2's channel
		pages2, appErr := s.th.App.GetChannelPages(s.th.Context, channel2.Id)
		s.Require().Nil(appErr)
		s.GreaterOrEqual(len(pages2.Posts), 1, "Wiki 2 channel should have at least 1 page")

		// ============================================================
		// CLEANUP
		// ============================================================
		_ = os.Remove(exportFilePath)
	})
}

func (s *MmctlE2ETestSuite) TestWikiExportWithAttachments() {
	s.T().Skip("Temporarily disabled - wiki export/import format needs fixing")
	s.SetupWikiExportTestHelper()

	s.RunForSystemAdminAndLocal("export with attachments flag creates correct export structure", func(c client.Client) {
		printer.Clean()

		// Use unique suffix to avoid conflicts between runs
		testSuffix := model.NewId()[:8]

		// Create unique channel for this test run
		testChannel, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "attachment-test-" + testSuffix,
			DisplayName: "Attachment Test " + testSuffix,
		}, false)
		s.Require().Nil(appErr)
		defer s.th.App.PermanentDeleteChannel(s.th.Context, testChannel)

		// Create wiki with a page
		wiki := &model.Wiki{
			ChannelId:   testChannel.Id,
			Title:       "Attachment Test Wiki " + testSuffix,
			Description: "Wiki for attachment export testing",
		}
		createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		page, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", "Page With Attachment", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdatePage(s.th.Context, page, "Page With Attachment",
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This page has an attachment"}]}]}`, "", testChannel)
		s.Require().Nil(appErr)

		// Create a file info record associated with the page
		// Note: In a real scenario, you'd upload an actual file. This creates the metadata.
		fileInfo := &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: s.th.BasicUser.Id,
			PostId:    page.Id,
			ChannelId: testChannel.Id,
			CreateAt:  model.GetMillis(),
			Name:      "test-document.pdf",
			Extension: "pdf",
			MimeType:  "application/pdf",
			Size:      1024,
			Path:      "data/test-document.pdf",
		}
		_, err := s.th.App.Srv().Store().FileInfo().Save(s.th.Context, fileInfo)
		s.Require().NoError(err)

		// Update the page to reference the file
		page.FileIds = []string{fileInfo.Id}
		_, err = s.th.App.Srv().Store().Post().Update(s.th.Context, page, page)
		s.Require().NoError(err)

		// Export WITH attachments flag
		exportJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: map[string]string{
				model.WikiJobDataKeyChannelIds:         testChannel.Id,
				model.WikiJobDataKeyIncludeAttachments: "true",
				model.WikiJobDataKeyIncludeComments:    "false",
			},
		})
		s.Require().NoError(err)

		completedJob := s.waitForJob(exportJob.Id, 60*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedJob.Status,
			"Export should succeed, error: %s", completedJob.Data["error"])

		// Verify export file exists
		exportFile := completedJob.Data["export_file"]
		s.Require().NotEmpty(exportFile)

		exportPath, _ := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
			*s.th.App.Config().ExportSettings.Directory))
		exportFilePath := filepath.Join(exportPath, exportFile)

		// Read and verify JSONL contains attachment references
		zipReader, err := zip.OpenReader(exportFilePath)
		s.Require().NoError(err)

		var jsonlContent []byte
		for _, f := range zipReader.File {
			if strings.HasSuffix(f.Name, ".jsonl") {
				rc, _ := f.Open()
				jsonlContent, _ = io.ReadAll(rc)
				rc.Close()
				break
			}
		}
		zipReader.Close()

		// Check that the page entry has attachments field
		scanner := bufio.NewScanner(bytes.NewReader(jsonlContent))
		var foundPageWithAttachments bool

		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			var entry map[string]interface{}
			_ = json.Unmarshal([]byte(line), &entry)

			if entry["type"] == "page" {
				pageData := entry["page"].(map[string]interface{})
				if attachments, ok := pageData["attachments"]; ok && attachments != nil {
					foundPageWithAttachments = true
					attachList := attachments.([]interface{})
					s.NotEmpty(attachList, "Page should have attachments listed")
				}
			}
		}

		s.True(foundPageWithAttachments, "Export should include page with attachments")

		// Cleanup
		_ = os.Remove(exportFilePath)
	})
}

func (s *MmctlE2ETestSuite) TestWikiExportMultipleChannels() {
	s.T().Skip("Temporarily disabled - wiki export/import format needs fixing")
	s.SetupWikiExportTestHelper()

	s.RunForSystemAdminAndLocal("export from multiple channels simultaneously", func(c client.Client) {
		printer.Clean()

		// Use unique suffix to avoid conflicts between runs
		testSuffix := model.NewId()[:8]

		// Create 3 channels with wikis - all unique to this test run
		channels := make([]*model.Channel, 3)
		wikis := make([]*model.Wiki, 3)

		for i := 0; i < 3; i++ {
			ch, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
				TeamId:      s.th.BasicTeam.Id,
				Type:        model.ChannelTypeOpen,
				Name:        fmt.Sprintf("multi-export-ch-%d-%s", i, testSuffix),
				DisplayName: fmt.Sprintf("Multi Export Channel %d %s", i, testSuffix),
			}, false)
			s.Require().Nil(appErr)
			channels[i] = ch

			wiki := &model.Wiki{
				ChannelId:   channels[i].Id,
				Title:       fmt.Sprintf("Multi Export Wiki %d %s", i+1, testSuffix),
				Description: fmt.Sprintf("Wiki %d for multi-channel export test", i+1),
			}
			createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
			s.Require().Nil(appErr)
			wikis[i] = createdWiki

			// Create a page in each wiki
			page, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", fmt.Sprintf("Page in Wiki %d", i+1), "", s.th.BasicUser.Id, "", "")
			s.Require().Nil(appErr)
			_, appErr = s.th.App.UpdatePage(s.th.Context, page, fmt.Sprintf("Page in Wiki %d", i+1),
				fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content for wiki %d"}]}]}`, i+1), "", channels[i])
			s.Require().Nil(appErr)
		}

		// Export all 3 channels
		channelIds := channels[0].Id + "," + channels[1].Id + "," + channels[2].Id
		exportJob, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: map[string]string{
				model.WikiJobDataKeyChannelIds:         channelIds,
				model.WikiJobDataKeyIncludeComments:    "false",
				model.WikiJobDataKeyIncludeAttachments: "false",
			},
		})
		s.Require().NoError(err)

		completedJob := s.waitForJob(exportJob.Id, 90*time.Second)
		s.Require().Equal(model.JobStatusSuccess, completedJob.Status)

		// Verify counts
		s.Equal("3", completedJob.Data[model.WikiJobDataKeyWikisExported], "Should export 3 wikis")
		s.Equal("3", completedJob.Data[model.WikiJobDataKeyPagesExported], "Should export 3 pages")

		// Cleanup
		exportFile := completedJob.Data["export_file"]
		if exportFile != "" {
			exportPath, _ := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
				*s.th.App.Config().ExportSettings.Directory))
			_ = os.Remove(filepath.Join(exportPath, exportFile))
		}
		for i := 0; i < 3; i++ {
			_ = s.th.App.PermanentDeleteChannel(s.th.Context, channels[i])
		}
	})
}

// waitForJob polls for job completion
func (s *MmctlE2ETestSuite) waitForJob(jobId string, timeout time.Duration) *model.Job {
	timeoutCh := time.After(timeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeoutCh:
			// Get the job one more time to return its current state
			job, _, err := s.th.SystemAdminClient.GetJob(context.Background(), jobId)
			if err != nil {
				s.T().Fatalf("Timeout waiting for job to complete and failed to get job: %v", err)
			}
			s.T().Fatalf("Timeout waiting for job to complete. Job status: %s, data: %v", job.Status, job.Data)
			return job // Won't reach here due to Fatalf
		case <-ticker.C:
			job, _, err := s.th.SystemAdminClient.GetJob(context.Background(), jobId)
			s.Require().NoError(err)
			if job.Status == model.JobStatusSuccess || job.Status == model.JobStatusError {
				return job
			}
		}
	}
}

func (s *MmctlE2ETestSuite) TestWikiExportJobPermissions() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("regular user cannot create wiki export job", func() {
		printer.Clean()

		jobData := map[string]string{
			"channel_ids": s.th.BasicChannel.Id,
		}

		_, _, err := s.th.Client.CreateJob(context.Background(), &model.Job{
			Type: model.JobTypeWikiExport,
			Data: jobData,
		})
		s.Require().Error(err)
		s.Contains(err.Error(), "appropriate permissions")
	})
}

func (s *MmctlE2ETestSuite) TestWikiVerifyCommand() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("verify command with valid wiki", func(c client.Client) {
		printer.Clean()

		// Create a wiki with pages
		wiki := &model.Wiki{
			ChannelId:   s.th.BasicChannel.Id,
			Title:       "Verify Test Wiki",
			Description: "Wiki for verify testing",
		}
		createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		// Create pages
		page1, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", "Page 1", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)

		page2, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, page1.Id, "Page 2", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)
		_ = page2 // Use the variable

		// Create a manifest file
		manifest := fmt.Sprintf(`{
			"version": "1.0",
			"created_at": "%s",
			"source": {"type": "test", "space_key": "TEST"},
			"target": {"team": "%s", "channel": "%s"},
			"counts": {"pages": 2, "comments": 0, "attachments": 0}
		}`, time.Now().Format(time.RFC3339), s.th.BasicTeam.Name, s.th.BasicChannel.Name)

		manifestFile := filepath.Join(s.T().TempDir(), "manifest.json")
		err := os.WriteFile(manifestFile, []byte(manifest), 0644)
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", s.th.BasicTeam.Name)
		cmd.Flags().Set("channel", s.th.BasicChannel.Name)

		err = wikiVerifyCmdF(c, cmd, []string{})
		s.Require().NoError(err)
	})
}

func (s *MmctlE2ETestSuite) TestWikiResolveLinksCommand() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("resolve-links dry run", func(c client.Client) {
		printer.Clean()

		// Create a wiki
		wiki := &model.Wiki{
			ChannelId:   s.th.BasicChannel.Id,
			Title:       "Resolve Links Test Wiki",
			Description: "Wiki for resolve links testing",
		}
		createdWiki, appErr := s.th.App.CreateWiki(s.th.Context, wiki, s.th.BasicUser.Id)
		s.Require().Nil(appErr)

		// Create a page (no placeholders, should be a no-op)
		page, appErr := s.th.App.CreateWikiPage(s.th.Context, createdWiki.Id, "", "Test Page", "", s.th.BasicUser.Id, "", "")
		s.Require().Nil(appErr)

		// Update with content (no placeholders)
		_, appErr = s.th.App.UpdatePage(s.th.Context, page, "Test Page", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Regular content without placeholders"}]}]}`, "", s.th.BasicChannel)
		s.Require().Nil(appErr)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().Bool("dry-run", false, "")

		cmd.Flags().Set("team", s.th.BasicTeam.Name)
		cmd.Flags().Set("channel", s.th.BasicChannel.Name)
		cmd.Flags().Set("dry-run", "true")

		err := wikiResolveLinksCmdF(c, cmd, []string{})
		s.Require().NoError(err)
	})
}

// Helper function to safely get string pointer from map
func getStringPtr(m map[string]interface{}, key string) *string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return &s
		}
	}
	return nil
}
