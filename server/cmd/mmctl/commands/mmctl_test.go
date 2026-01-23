// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/mocks"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var EnableEnterpriseTests string

type MmctlUnitTestSuite struct {
	suite.Suite
	mockCtrl *gomock.Controller
	client   *mocks.MockClient
}

func (s *MmctlUnitTestSuite) SetupTest() {
	printer.Clean()
	printer.SetFormat(printer.FormatJSON)

	s.mockCtrl = gomock.NewController(s.T())
	s.client = mocks.NewMockClient(s.mockCtrl)
}

func (s *MmctlUnitTestSuite) TearDownTest() {
	s.mockCtrl.Finish()
}

type MmctlE2ETestSuite struct {
	suite.Suite
	th *api4.TestHelper
}

func (s *MmctlE2ETestSuite) SetupTest() {
	printer.Clean()
	printer.SetFormat(printer.FormatJSON)
}

func (s *MmctlE2ETestSuite) TearDownTest() {
	// Remove the test helper from the structure to avoid reusing the same helper between tests
	s.th = nil
}

func (s *MmctlE2ETestSuite) SetupTestHelper() *api4.TestHelper {
	s.th = api4.Setup(s.T())
	return s.th
}

func (s *MmctlE2ETestSuite) SetupEnterpriseTestHelper() *api4.TestHelper {
	if EnableEnterpriseTests != "true" {
		s.T().SkipNow()
	}
	s.th = api4.SetupEnterprise(s.T())
	return s.th
}

func (s *MmctlE2ETestSuite) SetupMessageExportTestHelper() *api4.TestHelper {
	if EnableEnterpriseTests != "true" {
		s.T().SkipNow()
	}

	jobs.DefaultWatcherPollingInterval = 100
	s.th = api4.SetupEnterprise(s.T()).InitBasic(s.T())
	s.th.App.Srv().SetLicense(model.NewTestLicense("message_export"))
	s.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.DownloadExportResults = true
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
	})

	err := s.th.App.Srv().Jobs.StartWorkers()
	require.NoError(s.T(), err)

	err = s.th.App.Srv().Jobs.StartSchedulers()
	require.NoError(s.T(), err)

	return s.th
}

// RunForSystemAdminAndLocal runs a test function for both SystemAdmin
// and Local clients. Several commands work in the same way when used
// by a fully privileged user and through the local mode, so this
// helper facilitates checking both
func (s *MmctlE2ETestSuite) RunForSystemAdminAndLocal(testName string, fn func(client.Client)) {
	s.Run(testName+"/SystemAdminClient", func() {
		fn(s.th.SystemAdminClient)
	})

	s.Run(testName+"/LocalClient", func() {
		fn(s.th.LocalClient)
	})
}

// RunForAllClients runs a test function for all the clients
// registered in the TestHelper
func (s *MmctlE2ETestSuite) RunForAllClients(testName string, fn func(client.Client)) {
	s.Run(testName+"/Client", func() {
		fn(s.th.Client)
	})

	s.Run(testName+"/SystemAdminClient", func() {
		fn(s.th.SystemAdminClient)
	})

	s.Run(testName+"/LocalClient", func() {
		fn(s.th.LocalClient)
	})
}

func (s *MmctlE2ETestSuite) CheckErrorID(err error, errorId string) {
	api4.CheckErrorID(s.T(), err, errorId)
}

// Helper functions for compliance export job testing

// getMostRecentJobWithId gets the most recent job with the specified ID
func (s *MmctlE2ETestSuite) getMostRecentJobWithId(id string) *model.Job {
	list, _, err := s.th.SystemAdminClient.GetJobsByType(context.Background(), model.JobTypeMessageExport, 0, 1)
	s.Require().NoError(err)
	s.Require().Len(list, 1)
	s.Require().Equal(id, list[0].Id)
	return list[0]
}

// checkJobForStatus polls until the job with the specified ID reaches the expected status
func (s *MmctlE2ETestSuite) checkJobForStatus(id string, status string) {
	doneChan := make(chan bool)
	var job *model.Job
	go func() {
		defer close(doneChan)
		for {
			job = s.getMostRecentJobWithId(id)
			if job.Status == status {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		s.Require().Equal(status, job.Status)
	}()
	select {
	case <-doneChan:
	case <-time.After(15 * time.Second):
		s.Require().Fail(fmt.Sprintf("expected job's status to be %s, got %s", status, job.Status))
	}
}

// runJobForTest creates a job and waits for it to complete
func (s *MmctlE2ETestSuite) runJobForTest(jobData map[string]string) *model.Job {
	job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(),
		&model.Job{Type: model.JobTypeMessageExport, Data: jobData})
	s.Require().NoError(err)
	// poll until completion
	s.checkJobForStatus(job.Id, model.JobStatusSuccess)
	job = s.getMostRecentJobWithId(job.Id)
	return job
}
