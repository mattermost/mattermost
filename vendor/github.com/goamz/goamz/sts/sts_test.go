package sts_test

import (
	"testing"
	"time"

	. "gopkg.in/check.v1"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/sts"
	"github.com/goamz/goamz/testutil"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	sts *sts.STS
}

var testServer = testutil.NewHTTPServer()

var mockTest bool

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.sts = sts.New(auth, aws.Region{STSEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func (s *S) TestAssumeRole(c *C) {
	testServer.Response(200, nil, AssumeRoleResponse)
	request := &sts.AssumeRoleParams{
		DurationSeconds: 3600,
		ExternalId:      "123ABC",
		Policy:          `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`,
		RoleArn:         "arn:aws:iam::123456789012:role/demo",
		RoleSessionName: "Bob",
	}
	resp, err := s.sts.AssumeRole(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2011-06-15")
	c.Assert(values.Get("Action"), Equals, "AssumeRole")
	c.Assert(values.Get("DurationSeconds"), Equals, "3600")
	c.Assert(values.Get("ExternalId"), Equals, "123ABC")
	c.Assert(values.Get("Policy"), Equals, `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`)
	c.Assert(values.Get("RoleArn"), Equals, "arn:aws:iam::123456789012:role/demo")
	c.Assert(values.Get("RoleSessionName"), Equals, "Bob")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-15T23:28:33.359Z")
	c.Assert(resp.RequestId, Equals, "c6104cbe-af31-11e0-8154-cbc7ccf896c7")
	c.Assert(resp.PackedPolicySize, Equals, 6)
	c.Assert(resp.AssumedRoleUser, DeepEquals, sts.AssumedRoleUser{
		Arn:           "arn:aws:sts::123456789012:assumed-role/demo/Bob",
		AssumedRoleId: "ARO123EXAMPLE123:Bob",
	})
	c.Assert(resp.Credentials, DeepEquals, sts.Credentials{
		SessionToken: `
       AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW
       LWsKWHGBuFqwAeMicRXmxfpSPfIeoIYRqTflfKD8YUuwthAx7mSEI/qkPpKPi/kMcGd
       QrmGdeehM4IC1NtBmUpp2wUE8phUZampKsburEDy0KPkyQDYwT7WZ0wq5VSXDvp75YU
       9HFvlRd8Tx6q6fE8YQcHNVXAkiY9q6d+xo0rKwT38xVqr7ZD0u0iPPkUL64lIZbqBAz
       +scqKmlzm8FDrypNC9Yjc8fPOLn9FX9KSYvKTr4rvx3iSIlTJabIQwj2ICCR/oLxBA==
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}

func (s *S) TestGetFederationToken(c *C) {
	testServer.Response(200, nil, GetFederationTokenResponse)
	resp, err := s.sts.GetFederationToken(
		"Bob",
		`{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`,
		3600,
	)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2011-06-15")
	c.Assert(values.Get("Action"), Equals, "GetFederationToken")
	c.Assert(values.Get("DurationSeconds"), Equals, "3600")
	c.Assert(values.Get("Policy"), Equals, `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`)
	c.Assert(values.Get("Name"), Equals, "Bob")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-15T23:28:33.359Z")
	c.Assert(resp.RequestId, Equals, "c6104cbe-af31-11e0-8154-cbc7ccf896c7")
	c.Assert(resp.PackedPolicySize, Equals, 6)
	c.Assert(resp.FederatedUser, DeepEquals, sts.FederatedUser{
		Arn:             "arn:aws:sts::123456789012:federated-user/Bob",
		FederatedUserId: "123456789012:Bob",
	})
	c.Assert(resp.Credentials, DeepEquals, sts.Credentials{
		SessionToken: `
       AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW
       LWsKWHGBuFqwAeMicRXmxfpSPfIeoIYRqTflfKD8YUuwthAx7mSEI/qkPpKPi/kMcGd
       QrmGdeehM4IC1NtBmUpp2wUE8phUZampKsburEDy0KPkyQDYwT7WZ0wq5VSXDvp75YU
       9HFvlRd8Tx6q6fE8YQcHNVXAkiY9q6d+xo0rKwT38xVqr7ZD0u0iPPkUL64lIZbqBAz
       +scqKmlzm8FDrypNC9Yjc8fPOLn9FX9KSYvKTr4rvx3iSIlTJabIQwj2ICCR/oLxBA==
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}

func (s *S) TestGetSessionToken(c *C) {
	testServer.Response(200, nil, GetSessionTokenResponse)
	resp, err := s.sts.GetSessionToken(3600, "YourMFADeviceSerialNumber", "123456")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2011-06-15")
	c.Assert(values.Get("Action"), Equals, "GetSessionToken")
	c.Assert(values.Get("DurationSeconds"), Equals, "3600")
	c.Assert(values.Get("SerialNumber"), Equals, "YourMFADeviceSerialNumber")
	c.Assert(values.Get("TokenCode"), Equals, "123456")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-11T19:55:29.611Z")
	c.Assert(resp.RequestId, Equals, "58c5dbae-abef-11e0-8cfe-09039844ac7d")
	c.Assert(resp.Credentials, DeepEquals, sts.Credentials{
		SessionToken: `
       AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT+FvwqnKwRcOIfrRh3c/L
       To6UDdyJwOOvEVPvLXCrrrUtdnniCEXAMPLE/IvU1dYUg2RVAJBanLiHb4IgRmpRV3z
       rkuWJOgQs8IZZaIv2BXIa2R4OlgkBN9bkUDNCJiBeb/AXlzBBko7b15fjrBs2+cTQtp
       Z3CYWFXG8C5zqx37wnOE49mRl/+OtkIKGO7fAE
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}
