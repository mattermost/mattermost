package s3_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/s3"
	"github.com/AdRoll/goamz/s3/s3test"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"io/ioutil"
	"time"
)

type LocalServer struct {
	auth   aws.Auth
	region aws.Region
	srv    *s3test.Server
	config *s3test.Config
	clock  fakeClock
}

func (s *LocalServer) SetUp(c *check.C) {
	if s.config == nil {
		s.config = &s3test.Config{}
	}
	if s.config.Clock == nil {
		s.config.Clock = &s.clock
	}
	srv, err := s3test.NewServer(s.config)
	c.Assert(err, check.IsNil)
	c.Assert(srv, check.NotNil)

	s.srv = srv
	s.region = aws.Region{
		Name:                 "faux-region-1",
		S3Endpoint:           srv.URL(),
		S3LocationConstraint: true, // s3test server requires a LocationConstraint
	}
}

// LocalServerSuite defines tests that will run
// against the local s3test server. It includes
// selected tests from ClientTests;
// when the s3test functionality is sufficient, it should
// include all of them, and ClientTests can be simply embedded.
type LocalServerSuite struct {
	srv         LocalServer
	clientTests ClientTests
}

var (
	// run tests twice, once in us-east-1 mode, once not.
	_ = check.Suite(&LocalServerSuite{})
	_ = check.Suite(&LocalServerSuite{
		srv: LocalServer{
			config: &s3test.Config{
				Send409Conflict: true,
			},
		},
	})
)

func (s *LocalServerSuite) SetUpSuite(c *check.C) {
	s.srv.SetUp(c)
	s.clientTests.s3 = s3.New(s.srv.auth, s.srv.region)

	// TODO Sadly the fake server ignores auth completely right now. :-(
	s.clientTests.authIsBroken = true
	s.clientTests.Cleanup()
}

func (s *LocalServerSuite) TearDownTest(c *check.C) {
	s.clientTests.Cleanup()
}

func (s *LocalServerSuite) TestBasicFunctionality(c *check.C) {
	s.clientTests.TestBasicFunctionality(c)
}

func (s *LocalServerSuite) TestGetNotFound(c *check.C) {
	s.clientTests.TestGetNotFound(c)
}

func (s *LocalServerSuite) TestBucketList(c *check.C) {
	s.clientTests.TestBucketList(c)
}

func (s *LocalServerSuite) TestDoublePutBucket(c *check.C) {
	s.clientTests.TestDoublePutBucket(c)
}

func (s *LocalServerSuite) TestMultiComplete(c *check.C) {
	if !testutil.Amazon {
		c.Skip("live tests against AWS disabled (no -amazon)")
	}
	s.clientTests.TestMultiComplete(c)
}

func (s *LocalServerSuite) TestGetHeaders(c *check.C) {
	b := s.clientTests.s3.Bucket("bucket")
	err := b.PutBucket(s3.Private)
	c.Assert(err, check.IsNil)

	// Test with a fake time that has a one-digit day (where
	// amzFormat "2 Jan" differs from RFC1123 "02 Jan") and a
	// non-UTC time zone, regardless of the time and timezone of
	// the host running the tests.
	ft, err := time.Parse(time.RFC3339, "2006-01-02T07:04:05-08:00")
	c.Assert(err, check.IsNil)
	s.srv.clock.now = &ft
	err = b.Put("name", []byte("content"), "text/plain", s3.Private, s3.Options{})
	s.srv.clock.now = nil

	c.Assert(err, check.IsNil)
	defer b.Del("name")
	resp, err := b.GetResponse("name")
	c.Assert(err, check.IsNil)

	content, err := ioutil.ReadAll(resp.Body)
	c.Assert(err, check.IsNil)
	c.Check(content, check.DeepEquals, []byte("content"))

	c.Check(resp.Header.Get("Last-Modified"), check.Equals, "Mon, 2 Jan 2006 15:04:05 GMT")
}

type fakeClock struct {
	// Time to return for Now(). If nil, return current time.
	now *time.Time
}

func (c *fakeClock) Now() time.Time {
	if c.now != nil {
		return *c.now
	} else {
		return time.Now()
	}
}
