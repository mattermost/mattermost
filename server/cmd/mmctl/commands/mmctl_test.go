// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/mocks"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/v8/channels/api4"
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
	// if a test helper was used, we run the teardown and remove it
	// from the structure to avoid reusing the same helper between
	// tests
	if s.th != nil {
		s.th.TearDown()
		s.th = nil
	}
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
