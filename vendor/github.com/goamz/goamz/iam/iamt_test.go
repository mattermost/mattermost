package iam_test

import (
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/iam"
	"github.com/goamz/goamz/iam/iamtest"
	. "gopkg.in/check.v1"
)

// LocalServer represents a local ec2test fake server.
type LocalServer struct {
	auth   aws.Auth
	region aws.Region
	srv    *iamtest.Server
}

func (s *LocalServer) SetUp(c *C) {
	srv, err := iamtest.NewServer()
	c.Assert(err, IsNil)
	c.Assert(srv, NotNil)

	s.srv = srv
	s.region = aws.Region{IAMEndpoint: srv.URL()}
}

// LocalServerSuite defines tests that will run
// against the local iamtest server. It includes
// tests from ClientTests.
type LocalServerSuite struct {
	srv LocalServer
	ClientTests
}

var _ = Suite(&LocalServerSuite{})

func (s *LocalServerSuite) SetUpSuite(c *C) {
	s.srv.SetUp(c)
	s.ClientTests.iam = iam.New(s.srv.auth, s.srv.region)
}
