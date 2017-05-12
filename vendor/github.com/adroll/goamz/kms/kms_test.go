package kms_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/kms"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

type S struct {
	kms *kms.KMS
}

var _ = check.Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "fake_akey", SecretKey: "fake_skey"}
	s.kms = kms.New(auth, aws.Region{KMSEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestDescribeKey(c *check.C) {
	testServer.Response(200, nil, DescribeKeyExample)

	desc, err := s.kms.DescribeKey(kms.DescribeKeyInfo{KeyId: "alias/test"})
	header := testServer.WaitRequest().Header

	c.Assert(header.Get("Content-Type"), check.Equals, "application/x-amz-json-1.1")
	c.Assert(header.Get("X-Amz-Target"), check.Equals, "TrentService.DescribeKey")

	c.Assert(err, check.IsNil)

	c.Assert(desc.KeyMetadata.AWSAccountId, check.Equals, "987654321")
	c.Assert(desc.KeyMetadata.Arn, check.Equals, "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012")
	c.Assert(desc.KeyMetadata.CreationDate, check.Equals, 123456.789)
	c.Assert(desc.KeyMetadata.Description, check.Equals, "This is a test")
	c.Assert(desc.KeyMetadata.Enabled, check.Equals, true)
	c.Assert(desc.KeyMetadata.KeyId, check.Equals, "12345678-1234-1234-1234-123456789012")
	c.Assert(desc.KeyMetadata.KeyUsage, check.Equals, "ENCRYPT_DECRYPT")
}

func (s *S) TestErrorCase(c *check.C) {
	testServer.Response(400, nil, ErrorExample)

	_, err := s.kms.DescribeKey(kms.DescribeKeyInfo{KeyId: "alias/test"})

	c.Assert(err, check.ErrorMatches, "Type: TestException, Code: 400, Message: This is a error test")
}
