// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build unit

package commands

import (
	"encoding/json"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/golang/mock/gomock"
	"github.com/spf13/cobra"
)

const (
	wikiTeamID      = "wiki-team-id"
	wikiTeamName    = "wiki-team"
	wikiChannelID   = "wiki-channel-id"
	wikiChannelName = "wiki-channel"
	wikiID          = "wiki-id"
	wikiPageID1     = "page-id-1"
	wikiPageID2     = "page-id-2"
)

func (s *MmctlUnitTestSuite) TestWikiVerifyCmdF() {
	s.Run("Verify passes when counts match and no orphans", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Create pages without orphans (page2 has no parent reference, page1 has valid parent)
		page1 := &model.Post{
			Id:           wikiPageID1,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "", // Root page
		}
		page1.AddProp("title", "Page 1")
		page1.AddProp("import_source_id", "conf-1")

		page2 := &model.Post{
			Id:           wikiPageID2,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: wikiPageID1, // Valid parent
		}
		page2.AddProp("title", "Page 2")
		page2.AddProp("import_source_id", "conf-2")
		page2.Message = "content without placeholders"

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
				wikiPageID2: page2,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		// Mock GetPageComments for comment count verification (no comments)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID2).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		// Create a temp manifest file
		manifest := `{
			"version": "1.0",
			"created_at": "2024-01-01T00:00:00Z",
			"source": {"type": "confluence", "space_key": "TEST"},
			"target": {"team": "wiki-team", "channel": "wiki-channel"},
			"counts": {"pages": 2, "comments": 0, "attachments": 0}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
	})

	s.Run("Verify fails when page count mismatch", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Only 1 page but manifest expects 2
		page1 := &model.Post{
			Id:        wikiPageID1,
			Type:      model.PostTypePage,
			ChannelId: wikiChannelID,
		}
		page1.AddProp("title", "Page 1")

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
			},
			Order: []string{wikiPageID1},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		// Mock GetPageComments for comment count verification
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		manifest := `{
			"version": "1.0",
			"counts": {"pages": 2, "comments": 0, "attachments": 0}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "verification failed")
	})

	s.Run("Verify fails on orphaned pages", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// page2 has PageParentId pointing to non-existent page
		page1 := &model.Post{
			Id:           wikiPageID1,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "",
		}
		page1.AddProp("title", "Page 1")

		page2 := &model.Post{
			Id:           wikiPageID2,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "non-existent-parent-id", // Orphaned
		}
		page2.AddProp("title", "Orphaned Page")

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
				wikiPageID2: page2,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		// Mock GetPageComments for comment count verification
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID2).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		manifest := `{
			"version": "1.0",
			"counts": {"pages": 2, "comments": 0, "attachments": 0}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "verification failed")
	})

	s.Run("Verify fails on unresolved links", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Page with unresolved placeholder
		page1 := &model.Post{
			Id:           wikiPageID1,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "",
			Message:      "Content with {{CONF_PAGE_ID:12345}} placeholder",
		}
		page1.AddProp("title", "Page 1")
		page1.AddProp("import_source_id", "conf-1")

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
			},
			Order: []string{wikiPageID1},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		// Mock GetPageComments for comment count verification
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		manifest := `{
			"version": "1.0",
			"counts": {"pages": 1, "comments": 0, "attachments": 0}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "verification failed")
	})

	s.Run("Verify passes with correct attachment count", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Page with 2 attachments
		page1 := &model.Post{
			Id:           wikiPageID1,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "",
		}
		page1.AddProp("title", "Page 1")
		page1.AddProp("import_source_id", "conf-1")
		page1.AddProp("import_file_mappings", map[string]any{"file-1": "mapped-1", "file-2": "mapped-2"}) // 2 attachments

		// Page with 1 attachment
		page2 := &model.Post{
			Id:           wikiPageID2,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: wikiPageID1,
		}
		page2.AddProp("title", "Page 2")
		page2.AddProp("import_source_id", "conf-2")
		page2.AddProp("import_file_mappings", map[string]any{"file-3": "mapped-3"}) // 1 attachment

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
				wikiPageID2: page2,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID2).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		// Manifest expects 3 attachments total (2 + 1)
		manifest := `{
			"version": "1.0",
			"counts": {"pages": 2, "comments": 0, "attachments": 3}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
	})

	s.Run("Verify fails on attachment count mismatch", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Page with 1 attachment but manifest expects 5
		page1 := &model.Post{
			Id:           wikiPageID1,
			Type:         model.PostTypePage,
			ChannelId:    wikiChannelID,
			PageParentId: "",
		}
		page1.AddProp("title", "Page 1")
		page1.AddProp("import_source_id", "conf-1")
		page1.AddProp("import_file_mappings", map[string]any{"file-1": "mapped-1"}) // Only 1 attachment

		postList := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: page1,
			},
			Order: []string{wikiPageID1},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postList, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPageComments(gomock.Any(), wikiID, wikiPageID1).Return([]*model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("manifest", "", "")
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().String("output", "", "")

		// Manifest expects 5 attachments but we only have 1
		manifest := `{
			"version": "1.0",
			"counts": {"pages": 1, "comments": 0, "attachments": 5}
		}`
		manifestFile := s.T().TempDir() + "/manifest.json"
		s.Require().NoError(writeTestFile(manifestFile, manifest))

		cmd.Flags().Set("manifest", manifestFile)
		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiVerifyCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "verification failed")
	})
}

func (s *MmctlUnitTestSuite) TestWikiResolveLinksCmdF() {
	s.Run("Resolve links successfully", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		// Target page that link should resolve to
		targetPage := &model.Post{
			Id:        wikiPageID2,
			Type:      model.PostTypePage,
			ChannelId: wikiChannelID,
		}
		targetPage.AddProp("title", "Target Page")
		targetPage.AddProp("import_source_id", "conf-target")

		// Source page with placeholder
		sourcePage := &model.Post{
			Id:        wikiPageID1,
			Type:      model.PostTypePage,
			ChannelId: wikiChannelID,
			Message:   "Link to {{CONF_PAGE_ID:conf-target}} here",
		}
		sourcePage.AddProp("title", "Source Page")
		sourcePage.AddProp("import_source_id", "conf-source")

		postListWithContent := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: sourcePage,
				wikiPageID2: targetPage,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		postListNoContent := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: sourcePage,
				wikiPageID2: targetPage,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		// Fetched page for title preservation
		fetchedPage := &model.Post{
			Id:   wikiPageID1,
			Type: model.PostTypePage,
		}
		fetchedPage.AddProp("title", "Source Page")

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		// Called twice: once for buildPageMappings, once for buildFileMappings
		s.client.EXPECT().GetChannelPages(gomock.Any(), wikiChannelID).Return(postListNoContent, &model.Response{}, nil).Times(2)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postListWithContent, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetClientConfig(gomock.Any(), "").Return(map[string]string{"SiteURL": "https://example.com"}, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetPage(gomock.Any(), wikiID, wikiPageID1).Return(fetchedPage, &model.Response{}, nil).Times(1)
		s.client.EXPECT().UpdatePage(gomock.Any(), wikiID, wikiPageID1, "Source Page", gomock.Any(), "", int64(0)).Return(&model.Post{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().Bool("dry-run", false, "")

		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiResolveLinksCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
	})

	s.Run("Dry run does not update pages", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}
		mockWiki := &model.Wiki{Id: wikiID, ChannelId: wikiChannelID, Title: "Test Wiki"}

		targetPage := &model.Post{
			Id:        wikiPageID2,
			Type:      model.PostTypePage,
			ChannelId: wikiChannelID,
		}
		targetPage.AddProp("title", "Target Page")
		targetPage.AddProp("import_source_id", "conf-target")

		sourcePage := &model.Post{
			Id:        wikiPageID1,
			Type:      model.PostTypePage,
			ChannelId: wikiChannelID,
			Message:   "Link to {{CONF_PAGE_ID:conf-target}} here",
		}
		sourcePage.AddProp("title", "Source Page")
		sourcePage.AddProp("import_source_id", "conf-source")

		postListWithContent := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: sourcePage,
				wikiPageID2: targetPage,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		postListNoContent := &model.PostList{
			Posts: map[string]*model.Post{
				wikiPageID1: sourcePage,
				wikiPageID2: targetPage,
			},
			Order: []string{wikiPageID1, wikiPageID2},
		}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{mockWiki}, &model.Response{}, nil).Times(1)
		// Called twice: once for buildPageMappings, once for buildFileMappings
		s.client.EXPECT().GetChannelPages(gomock.Any(), wikiChannelID).Return(postListNoContent, &model.Response{}, nil).Times(2)
		s.client.EXPECT().GetChannelPagesWithContent(gomock.Any(), wikiChannelID, true).Return(postListWithContent, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetClientConfig(gomock.Any(), "").Return(map[string]string{"SiteURL": "https://example.com/"}, &model.Response{}, nil).Times(1)
		// UpdatePage should NOT be called in dry-run mode

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().Bool("dry-run", false, "")

		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)
		cmd.Flags().Set("dry-run", "true")

		err := wikiResolveLinksCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
	})

	s.Run("No wiki found returns error", func() {
		printer.Clean()

		mockTeam := &model.Team{Id: wikiTeamID, Name: wikiTeamName}
		mockChannel := &model.Channel{Id: wikiChannelID, Name: wikiChannelName}

		s.client.EXPECT().GetTeamByName(gomock.Any(), wikiTeamName, "").Return(mockTeam, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetChannelByName(gomock.Any(), wikiChannelName, wikiTeamID, "").Return(mockChannel, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetWikisForChannel(gomock.Any(), wikiChannelID).Return([]*model.Wiki{}, &model.Response{}, nil).Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")
		cmd.Flags().Bool("dry-run", false, "")

		cmd.Flags().Set("team", wikiTeamName)
		cmd.Flags().Set("channel", wikiChannelName)

		err := wikiResolveLinksCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "no wiki found")
	})
}

func (s *MmctlUnitTestSuite) TestResolvePlaceholders() {
	s.Run("Resolves CONF_PAGE_ID placeholders in plain text", func() {
		pageIDMapping := map[string]string{
			"12345": "mm-page-1",
			"67890": "mm-page-2",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		content := "Link to {{CONF_PAGE_ID:12345}} and {{CONF_PAGE_ID:67890}}"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("Link to https://example.com/pages/mm-page-1 and https://example.com/pages/mm-page-2", resolved)
	})

	s.Run("Preserves unresolved placeholders", func() {
		pageIDMapping := map[string]string{
			"12345": "mm-page-1",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		content := "Link to {{CONF_PAGE_ID:12345}} and {{CONF_PAGE_ID:unknown}}"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("Link to https://example.com/pages/mm-page-1 and {{CONF_PAGE_ID:unknown}}", resolved)
	})

	s.Run("Handles content without placeholders", func() {
		pageIDMapping := map[string]string{}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		content := "No placeholders here"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("No placeholders here", resolved)
	})

	s.Run("Resolves placeholders in TipTap JSON text nodes", func() {
		pageIDMapping := map[string]string{
			"conf-123": "mm-page-1",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		// TipTap JSON with placeholder in text node
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"See {{CONF_PAGE_ID:conf-123}} for details"}]}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse to verify JSON is valid
		var doc map[string]any
		err := json.Unmarshal([]byte(resolved), &doc)
		s.NoError(err, "Result should be valid JSON")

		// Verify placeholder was replaced in text
		s.Contains(resolved, "https://example.com/pages/mm-page-1")
		s.NotContains(resolved, "{{CONF_PAGE_ID:conf-123}}")
	})

	s.Run("Resolves placeholders in TipTap JSON link href", func() {
		pageIDMapping := map[string]string{
			"conf-456": "mm-page-2",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		// TipTap JSON with placeholder in link href
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"link","attrs":{"href":"{{CONF_PAGE_ID:conf-456}}"}}],"text":"Click here"}]}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse to verify JSON is valid
		var doc map[string]any
		err := json.Unmarshal([]byte(resolved), &doc)
		s.NoError(err, "Result should be valid JSON")

		// Verify placeholder was replaced in href
		s.Contains(resolved, `"href":"https://example.com/pages/mm-page-2"`)
		s.NotContains(resolved, "{{CONF_PAGE_ID:conf-456}}")
	})

	s.Run("Preserves JSON structure when resolving", func() {
		pageIDMapping := map[string]string{
			"conf-789": "mm-page-3",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		// Complex TipTap JSON with nested content
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Normal text"},{"type":"text","marks":[{"type":"bold"}],"text":"Bold text with {{CONF_PAGE_ID:conf-789}}"}]}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse to verify JSON is valid and structure preserved
		var doc map[string]any
		err := json.Unmarshal([]byte(resolved), &doc)
		s.NoError(err, "Result should be valid JSON")

		// Verify structure
		docContent, ok := doc["content"].([]any)
		s.True(ok, "Should have content array")
		s.Len(docContent, 1, "Should have one paragraph")

		// Verify placeholder was replaced
		s.Contains(resolved, "https://example.com/pages/mm-page-3")
	})

	s.Run("Does not corrupt JSON with special characters", func() {
		pageIDMapping := map[string]string{}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		// JSON with special characters that might confuse regex
		content := `{"type":"doc","content":[{"type":"text","text":"Code: function() { return \"test\"; }"}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse both to verify JSON is valid and equivalent
		var originalDoc, resolvedDoc map[string]any
		err := json.Unmarshal([]byte(content), &originalDoc)
		s.NoError(err, "Original should be valid JSON")
		err = json.Unmarshal([]byte(resolved), &resolvedDoc)
		s.NoError(err, "Result should be valid JSON after no-op resolution")

		// Content should be semantically unchanged (keys may be reordered)
		s.Equal(originalDoc, resolvedDoc, "JSON structure should be preserved")
	})

	s.Run("Resolves placeholders in image src attributes", func() {
		pageIDMapping := map[string]string{
			"img-page": "mm-img-page",
		}
		fileIDMapping := map[string]string{}
		baseURL := "https://example.com"

		// TipTap JSON with placeholder in image src
		content := `{"type":"doc","content":[{"type":"image","attrs":{"src":"{{CONF_PAGE_ID:img-page}}"}}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse to verify JSON is valid
		var doc map[string]any
		err := json.Unmarshal([]byte(resolved), &doc)
		s.NoError(err, "Result should be valid JSON")

		// Verify placeholder was replaced in src
		s.Contains(resolved, `"src":"https://example.com/pages/mm-img-page"`)
	})

	s.Run("Resolves CONF_FILE placeholders in plain text", func() {
		pageIDMapping := map[string]string{}
		fileIDMapping := map[string]string{
			"attach-123": "mm-file-abc",
			"attach-456": "mm-file-def",
		}
		baseURL := "https://example.com"

		content := "Download {{CONF_FILE:attach-123}} and {{CONF_FILE:attach-456}}"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("Download https://example.com/api/v4/files/mm-file-abc and https://example.com/api/v4/files/mm-file-def", resolved)
	})

	s.Run("Resolves CONF_FILE placeholders in TipTap JSON link href", func() {
		pageIDMapping := map[string]string{}
		fileIDMapping := map[string]string{
			"file-789": "mm-file-xyz",
		}
		baseURL := "https://example.com"

		// TipTap JSON with file placeholder in link href
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"link","attrs":{"href":"{{CONF_FILE:file-789}}"}}],"text":"Download PDF"}]}]}`
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		// Parse to verify JSON is valid
		var doc map[string]any
		err := json.Unmarshal([]byte(resolved), &doc)
		s.NoError(err, "Result should be valid JSON")

		// Verify file placeholder was replaced in href
		s.Contains(resolved, `"href":"https://example.com/api/v4/files/mm-file-xyz"`)
		s.NotContains(resolved, "{{CONF_FILE:file-789}}")
	})

	s.Run("Resolves mixed page and file placeholders", func() {
		pageIDMapping := map[string]string{
			"page-1": "mm-page-1",
		}
		fileIDMapping := map[string]string{
			"file-1": "mm-file-1",
		}
		baseURL := "https://example.com"

		content := "See {{CONF_PAGE_ID:page-1}} and download {{CONF_FILE:file-1}}"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("See https://example.com/pages/mm-page-1 and download https://example.com/api/v4/files/mm-file-1", resolved)
	})

	s.Run("Preserves unresolved file placeholders", func() {
		pageIDMapping := map[string]string{}
		fileIDMapping := map[string]string{
			"known-file": "mm-file-1",
		}
		baseURL := "https://example.com"

		content := "Download {{CONF_FILE:known-file}} and {{CONF_FILE:unknown-file}}"
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, baseURL)

		s.Equal("Download https://example.com/api/v4/files/mm-file-1 and {{CONF_FILE:unknown-file}}", resolved)
	})
}

func (s *MmctlUnitTestSuite) TestExtractUnresolvedPlaceholders() {
	s.Run("Extracts all placeholders", func() {
		content := "{{CONF_PAGE_ID:123}} and {{CONF_PAGE_ID:456}}"
		placeholders := extractUnresolvedPlaceholders(content)

		s.Len(placeholders, 2)
		s.Contains(placeholders, "{{CONF_PAGE_ID:123}}")
		s.Contains(placeholders, "{{CONF_PAGE_ID:456}}")
	})

	s.Run("Extracts file placeholders", func() {
		content := "{{CONF_FILE:file-123}} and {{CONF_FILE:file-456}}"
		placeholders := extractUnresolvedPlaceholders(content)

		s.Len(placeholders, 2)
		s.Contains(placeholders, "{{CONF_FILE:file-123}}")
		s.Contains(placeholders, "{{CONF_FILE:file-456}}")
	})

	s.Run("Extracts mixed page and file placeholders", func() {
		content := "{{CONF_PAGE_ID:page-1}} and {{CONF_FILE:file-1}}"
		placeholders := extractUnresolvedPlaceholders(content)

		s.Len(placeholders, 2)
		s.Contains(placeholders, "{{CONF_PAGE_ID:page-1}}")
		s.Contains(placeholders, "{{CONF_FILE:file-1}}")
	})

	s.Run("Returns empty for content without placeholders", func() {
		content := "No placeholders"
		placeholders := extractUnresolvedPlaceholders(content)

		s.Empty(placeholders)
	})
}

// Helper function to write test files
func writeTestFile(path, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}
