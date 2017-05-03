package iam_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/iam"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"strings"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

type S struct {
	iam *iam.IAM
}

var _ = check.Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.iam = iam.New(auth, aws.Region{IAMEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestCreateUser(c *check.C) {
	testServer.Response(200, nil, CreateUserExample)
	resp, err := s.iam.CreateUser("Bob", "/division_abc/subdivision_xyz/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "CreateUser")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(values.Get("Path"), check.Equals, "/division_abc/subdivision_xyz/")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	expected := iam.User{
		Path: "/division_abc/subdivision_xyz/",
		Name: "Bob",
		Id:   "AIDACKCEVSQ6C2EXAMPLE",
		Arn:  "arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob",
	}
	c.Assert(resp.User, check.DeepEquals, expected)
}

func (s *S) TestCreateUserConflict(c *check.C) {
	testServer.Response(409, nil, DuplicateUserExample)
	resp, err := s.iam.CreateUser("Bob", "/division_abc/subdivision_xyz/")
	testServer.WaitRequest()
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	e, ok := err.(*iam.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(e.Message, check.Equals, "User with name Bob already exists.")
	c.Assert(e.Code, check.Equals, "EntityAlreadyExists")
}

func (s *S) TestGetUser(c *check.C) {
	testServer.Response(200, nil, GetUserExample)
	resp, err := s.iam.GetUser("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "GetUser")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	expected := iam.User{
		Path: "/division_abc/subdivision_xyz/",
		Name: "Bob",
		Id:   "AIDACKCEVSQ6C2EXAMPLE",
		Arn:  "arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob",
	}
	c.Assert(resp.User, check.DeepEquals, expected)
}

func (s *S) TestDeleteUser(c *check.C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteUser("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DeleteUser")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestCreateGroup(c *check.C) {
	testServer.Response(200, nil, CreateGroupExample)
	resp, err := s.iam.CreateGroup("Admins", "/admins/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "CreateGroup")
	c.Assert(values.Get("GroupName"), check.Equals, "Admins")
	c.Assert(values.Get("Path"), check.Equals, "/admins/")
	c.Assert(err, check.IsNil)
	c.Assert(resp.Group.Path, check.Equals, "/admins/")
	c.Assert(resp.Group.Name, check.Equals, "Admins")
	c.Assert(resp.Group.Id, check.Equals, "AGPACKCEVSQ6C2EXAMPLE")
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestCreateGroupWithoutPath(c *check.C) {
	testServer.Response(200, nil, CreateGroupExample)
	_, err := s.iam.CreateGroup("Managers", "")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "CreateGroup")
	c.Assert(err, check.IsNil)
	_, ok := map[string][]string(values)["Path"]
	c.Assert(ok, check.Equals, false)
}

func (s *S) TestDeleteGroup(c *check.C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteGroup("Admins")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DeleteGroup")
	c.Assert(values.Get("GroupName"), check.Equals, "Admins")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestListGroups(c *check.C) {
	testServer.Response(200, nil, ListGroupsExample)
	resp, err := s.iam.Groups("/division_abc/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "ListGroups")
	c.Assert(values.Get("PathPrefix"), check.Equals, "/division_abc/")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	expected := []iam.Group{
		{
			Path: "/division_abc/subdivision_xyz/",
			Name: "Admins",
			Id:   "AGPACKCEVSQ6C2EXAMPLE",
			Arn:  "arn:aws:iam::123456789012:group/Admins",
		},
		{
			Path: "/division_abc/subdivision_xyz/product_1234/engineering/",
			Name: "Test",
			Id:   "AGP2MAB8DPLSRHEXAMPLE",
			Arn:  "arn:aws:iam::123456789012:group/division_abc/subdivision_xyz/product_1234/engineering/Test",
		},
		{
			Path: "/division_abc/subdivision_xyz/product_1234/",
			Name: "Managers",
			Id:   "AGPIODR4TAW7CSEXAMPLE",
			Arn:  "arn:aws:iam::123456789012:group/division_abc/subdivision_xyz/product_1234/Managers",
		},
	}
	c.Assert(resp.Groups, check.DeepEquals, expected)
}

func (s *S) TestListGroupsWithoutPathPrefix(c *check.C) {
	testServer.Response(200, nil, ListGroupsExample)
	_, err := s.iam.Groups("")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "ListGroups")
	c.Assert(err, check.IsNil)
	_, ok := map[string][]string(values)["PathPrefix"]
	c.Assert(ok, check.Equals, false)
}

func (s *S) TestCreateAccessKey(c *check.C) {
	testServer.Response(200, nil, CreateAccessKeyExample)
	resp, err := s.iam.CreateAccessKey("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "CreateAccessKey")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.AccessKey.UserName, check.Equals, "Bob")
	c.Assert(resp.AccessKey.Id, check.Equals, "AKIAIOSFODNN7EXAMPLE")
	c.Assert(resp.AccessKey.Secret, check.Equals, "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY")
	c.Assert(resp.AccessKey.Status, check.Equals, "Active")
}

func (s *S) TestDeleteAccessKey(c *check.C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteAccessKey("ysa8hasdhasdsi", "Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DeleteAccessKey")
	c.Assert(values.Get("AccessKeyId"), check.Equals, "ysa8hasdhasdsi")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestDeleteAccessKeyBlankUserName(c *check.C) {
	testServer.Response(200, nil, RequestIdExample)
	_, err := s.iam.DeleteAccessKey("ysa8hasdhasdsi", "")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DeleteAccessKey")
	c.Assert(values.Get("AccessKeyId"), check.Equals, "ysa8hasdhasdsi")
	_, ok := map[string][]string(values)["UserName"]
	c.Assert(ok, check.Equals, false)
}

func (s *S) TestAccessKeys(c *check.C) {
	testServer.Response(200, nil, ListAccessKeyExample)
	resp, err := s.iam.AccessKeys("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "ListAccessKeys")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.AccessKeys, check.HasLen, 2)
	c.Assert(resp.AccessKeys[0].Id, check.Equals, "AKIAIOSFODNN7EXAMPLE")
	c.Assert(resp.AccessKeys[0].UserName, check.Equals, "Bob")
	c.Assert(resp.AccessKeys[0].Status, check.Equals, "Active")
	c.Assert(resp.AccessKeys[1].Id, check.Equals, "AKIAI44QH8DHBEXAMPLE")
	c.Assert(resp.AccessKeys[1].UserName, check.Equals, "Bob")
	c.Assert(resp.AccessKeys[1].Status, check.Equals, "Inactive")
}

func (s *S) TestAccessKeysBlankUserName(c *check.C) {
	testServer.Response(200, nil, ListAccessKeyExample)
	_, err := s.iam.AccessKeys("")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "ListAccessKeys")
	_, ok := map[string][]string(values)["UserName"]
	c.Assert(ok, check.Equals, false)
}

func (s *S) TestGetUserPolicy(c *check.C) {
	testServer.Response(200, nil, GetUserPolicyExample)
	resp, err := s.iam.GetUserPolicy("Bob", "AllAccessPolicy")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "GetUserPolicy")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(values.Get("PolicyName"), check.Equals, "AllAccessPolicy")
	c.Assert(err, check.IsNil)
	c.Assert(resp.Policy.UserName, check.Equals, "Bob")
	c.Assert(resp.Policy.Name, check.Equals, "AllAccessPolicy")
	c.Assert(strings.TrimSpace(resp.Policy.Document), check.Equals, `{"Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}`)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestPutUserPolicy(c *check.C) {
	document := `{
		"Statement": [
		{
			"Action": [
				"s3:*"
			],
			"Effect": "Allow",
			"Resource": [
				"arn:aws:s3:::8shsns19s90ajahadsj/*",
				"arn:aws:s3:::8shsns19s90ajahadsj"
			]
		}]
	}`
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.PutUserPolicy("Bob", "AllAccessPolicy", document)
	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.FormValue("Action"), check.Equals, "PutUserPolicy")
	c.Assert(req.FormValue("PolicyName"), check.Equals, "AllAccessPolicy")
	c.Assert(req.FormValue("UserName"), check.Equals, "Bob")
	c.Assert(req.FormValue("PolicyDocument"), check.Equals, document)
	c.Assert(req.FormValue("Version"), check.Equals, "2010-05-08")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestDeleteUserPolicy(c *check.C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteUserPolicy("Bob", "AllAccessPolicy")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DeleteUserPolicy")
	c.Assert(values.Get("PolicyName"), check.Equals, "AllAccessPolicy")
	c.Assert(values.Get("UserName"), check.Equals, "Bob")
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}
