package elasticache

import (
	"testing"

	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/testutil"
	check "gopkg.in/check.v1"
)

type S struct {
	elasticache *ElastiCache
}

var testServer = testutil.NewHTTPServer()

func Test(t *testing.T) {
	check.TestingT(t)
}

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.elasticache = New(auth, aws.Region{ElastiCacheEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestDescribeReplicationGroup(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.elasticache = New(auth, aws.Region{EC2Endpoint: aws.ServiceInfo{Endpoint: testServer.URL, Signer: aws.V2Signature}})

	testServer.Response(200, nil, DescribeReplicationGroupsResponse)

	resp, err := s.elasticache.DescribeReplicationGroup("test")
	req := testServer.WaitRequest()

	c.Assert(err, check.IsNil)
	c.Assert(req.URL.Query().Get("Action"), check.Equals, "DescribeReplicationGroup")

	c.Assert(resp.Status, check.Equals, "available")
}
