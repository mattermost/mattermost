package iam_test

import (
	"strings"
	"testing"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/iam"
	"github.com/goamz/goamz/testutil"
	. "gopkg.in/check.v1"
)

func Test(t *testing.T) {
	TestingT(t)
}

type S struct {
	iam *iam.IAM
}

var _ = Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.iam = iam.NewWithClient(auth, aws.Region{IAMEndpoint: testServer.URL}, testutil.DefaultClient)
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func (s *S) TestCreateUser(c *C) {
	testServer.Response(200, nil, CreateUserExample)
	resp, err := s.iam.CreateUser("Bob", "/division_abc/subdivision_xyz/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "CreateUser")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(values.Get("Path"), Equals, "/division_abc/subdivision_xyz/")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	expected := iam.User{
		Path: "/division_abc/subdivision_xyz/",
		Name: "Bob",
		Id:   "AIDACKCEVSQ6C2EXAMPLE",
		Arn:  "arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob",
	}
	c.Assert(resp.User, DeepEquals, expected)
}

func (s *S) TestCreateUserConflict(c *C) {
	testServer.Response(409, nil, DuplicateUserExample)
	resp, err := s.iam.CreateUser("Bob", "/division_abc/subdivision_xyz/")
	testServer.WaitRequest()
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	e, ok := err.(*iam.Error)
	c.Assert(ok, Equals, true)
	c.Assert(e.Message, Equals, "User with name Bob already exists.")
	c.Assert(e.Code, Equals, "EntityAlreadyExists")
}

func (s *S) TestGetUser(c *C) {
	testServer.Response(200, nil, GetUserExample)
	resp, err := s.iam.GetUser("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "GetUser")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	expected := iam.User{
		Path: "/division_abc/subdivision_xyz/",
		Name: "Bob",
		Id:   "AIDACKCEVSQ6C2EXAMPLE",
		Arn:  "arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob",
	}
	c.Assert(resp.User, DeepEquals, expected)
}

func (s *S) TestDeleteUser(c *C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteUser("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteUser")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestCreateGroup(c *C) {
	testServer.Response(200, nil, CreateGroupExample)
	resp, err := s.iam.CreateGroup("Admins", "/admins/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "CreateGroup")
	c.Assert(values.Get("GroupName"), Equals, "Admins")
	c.Assert(values.Get("Path"), Equals, "/admins/")
	c.Assert(err, IsNil)
	c.Assert(resp.Group.Path, Equals, "/admins/")
	c.Assert(resp.Group.Name, Equals, "Admins")
	c.Assert(resp.Group.Id, Equals, "AGPACKCEVSQ6C2EXAMPLE")
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestCreateGroupWithoutPath(c *C) {
	testServer.Response(200, nil, CreateGroupExample)
	_, err := s.iam.CreateGroup("Managers", "")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "CreateGroup")
	c.Assert(err, IsNil)
	_, ok := map[string][]string(values)["Path"]
	c.Assert(ok, Equals, false)
}

func (s *S) TestDeleteGroup(c *C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteGroup("Admins")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteGroup")
	c.Assert(values.Get("GroupName"), Equals, "Admins")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestListGroups(c *C) {
	testServer.Response(200, nil, ListGroupsExample)
	resp, err := s.iam.Groups("/division_abc/")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "ListGroups")
	c.Assert(values.Get("PathPrefix"), Equals, "/division_abc/")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
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
	c.Assert(resp.Groups, DeepEquals, expected)
}

func (s *S) TestListGroupsWithoutPathPrefix(c *C) {
	testServer.Response(200, nil, ListGroupsExample)
	_, err := s.iam.Groups("")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "ListGroups")
	c.Assert(err, IsNil)
	_, ok := map[string][]string(values)["PathPrefix"]
	c.Assert(ok, Equals, false)
}

func (s *S) TestCreateAccessKey(c *C) {
	testServer.Response(200, nil, CreateAccessKeyExample)
	resp, err := s.iam.CreateAccessKey("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "CreateAccessKey")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.AccessKey.UserName, Equals, "Bob")
	c.Assert(resp.AccessKey.Id, Equals, "AKIAIOSFODNN7EXAMPLE")
	c.Assert(resp.AccessKey.Secret, Equals, "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY")
	c.Assert(resp.AccessKey.Status, Equals, "Active")
}

func (s *S) TestDeleteAccessKey(c *C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteAccessKey("ysa8hasdhasdsi", "Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteAccessKey")
	c.Assert(values.Get("AccessKeyId"), Equals, "ysa8hasdhasdsi")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestDeleteAccessKeyBlankUserName(c *C) {
	testServer.Response(200, nil, RequestIdExample)
	_, err := s.iam.DeleteAccessKey("ysa8hasdhasdsi", "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteAccessKey")
	c.Assert(values.Get("AccessKeyId"), Equals, "ysa8hasdhasdsi")
	_, ok := map[string][]string(values)["UserName"]
	c.Assert(ok, Equals, false)
}

func (s *S) TestAccessKeys(c *C) {
	testServer.Response(200, nil, ListAccessKeyExample)
	resp, err := s.iam.AccessKeys("Bob")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "ListAccessKeys")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.AccessKeys, HasLen, 2)
	c.Assert(resp.AccessKeys[0].Id, Equals, "AKIAIOSFODNN7EXAMPLE")
	c.Assert(resp.AccessKeys[0].UserName, Equals, "Bob")
	c.Assert(resp.AccessKeys[0].Status, Equals, "Active")
	c.Assert(resp.AccessKeys[1].Id, Equals, "AKIAI44QH8DHBEXAMPLE")
	c.Assert(resp.AccessKeys[1].UserName, Equals, "Bob")
	c.Assert(resp.AccessKeys[1].Status, Equals, "Inactive")
}

func (s *S) TestAccessKeysBlankUserName(c *C) {
	testServer.Response(200, nil, ListAccessKeyExample)
	_, err := s.iam.AccessKeys("")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "ListAccessKeys")
	_, ok := map[string][]string(values)["UserName"]
	c.Assert(ok, Equals, false)
}

func (s *S) TestGetUserPolicy(c *C) {
	testServer.Response(200, nil, GetUserPolicyExample)
	resp, err := s.iam.GetUserPolicy("Bob", "AllAccessPolicy")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "GetUserPolicy")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(values.Get("PolicyName"), Equals, "AllAccessPolicy")
	c.Assert(err, IsNil)
	c.Assert(resp.Policy.UserName, Equals, "Bob")
	c.Assert(resp.Policy.Name, Equals, "AllAccessPolicy")
	c.Assert(strings.TrimSpace(resp.Policy.Document), Equals, `{"Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}`)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestPutUserPolicy(c *C) {
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
	c.Assert(req.Method, Equals, "POST")
	c.Assert(req.FormValue("Action"), Equals, "PutUserPolicy")
	c.Assert(req.FormValue("PolicyName"), Equals, "AllAccessPolicy")
	c.Assert(req.FormValue("UserName"), Equals, "Bob")
	c.Assert(req.FormValue("PolicyDocument"), Equals, document)
	c.Assert(req.FormValue("Version"), Equals, "2010-05-08")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestDeleteUserPolicy(c *C) {
	testServer.Response(200, nil, RequestIdExample)
	resp, err := s.iam.DeleteUserPolicy("Bob", "AllAccessPolicy")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteUserPolicy")
	c.Assert(values.Get("PolicyName"), Equals, "AllAccessPolicy")
	c.Assert(values.Get("UserName"), Equals, "Bob")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestAddUserToGroup(c *C) {
	testServer.Response(200, nil, AddUserToGroupExample)
	resp, err := s.iam.AddUserToGroup("admin1", "Admins")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "AddUserToGroup")
	c.Assert(values.Get("GroupName"), Equals, "Admins")
	c.Assert(values.Get("UserName"), Equals, "admin1")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestListAccountAliases(c *C) {
	testServer.Response(200, nil, ListAccountAliasesExample)
	resp, err := s.iam.ListAccountAliases()
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "ListAccountAliases")
	c.Assert(err, IsNil)
	c.Assert(resp.AccountAliases[0], Equals, "foocorporation")
	c.Assert(resp.RequestId, Equals, "c5a076e9-f1b0-11df-8fbe-45274EXAMPLE")
}

func (s *S) TestCreateAccountAlias(c *C) {
	testServer.Response(200, nil, CreateAccountAliasExample)
	resp, err := s.iam.CreateAccountAlias("foobaz")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "CreateAccountAlias")
	c.Assert(values.Get("AccountAlias"), Equals, "foobaz")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "36b5db08-f1b0-11df-8fbe-45274EXAMPLE")
}

func (s *S) TestDeleteAccountAlias(c *C) {
	testServer.Response(200, nil, DeleteAccountAliasExample)
	resp, err := s.iam.DeleteAccountAlias("foobaz")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), Equals, "DeleteAccountAlias")
	c.Assert(values.Get("AccountAlias"), Equals, "foobaz")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestUploadServerCertificate(c *C) {
	testServer.Response(200, nil, UploadServerCertificateExample)

	certificateBody := `
-----BEGIN CERTIFICATE-----
MIICdzCCAeCgAwIBAgIGANc+Ha2wMA0GCSqGSIb3DQEBBQUAMFMxCzAJBgNVBAYT
AlVTMRMwEQYDVQQKEwpBbWF6b24uY29tMQwwCgYDVQQLEwNBV1MxITAfBgNVBAMT
GEFXUyBMaW1pdGVkLUFzc3VyYW5jZSBDQTAeFw0wOTAyMDQxNzE5MjdaFw0xMDAy
MDQxNzE5MjdaMFIxCzAJBgNVBAYTAlVTMRMwEQYDVQQKEwpBbWF6b24uY29tMRcw
FQYDVQQLEw5BV1MtRGV2ZWxvcGVyczEVMBMGA1UEAxMMNTdxNDl0c3ZwYjRtMIGf
MA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCpB/vsOwmT/O0td1RqzKjttSBaPjbr
dqwNe9BrOyB08fw2+Ch5oonZYXfGUrT6mkYXH5fQot9HvASrzAKHO596FdJA6DmL
ywdWe1Oggk7zFSXO1Xv+3vPrJtaYxYo3eRIp7w80PMkiOv6M0XK8ubcTouODeJbf
suDqcLnLDxwsvwIDAQABo1cwVTAOBgNVHQ8BAf8EBAMCBaAwFgYDVR0lAQH/BAww
CgYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQULGNaBphBumaKbDRK
CAi0mH8B3mowDQYJKoZIhvcNAQEFBQADgYEAuKxhkXaCLGcqDuweKtO/AEw9ZePH
wr0XqsaIK2HZboqruebXEGsojK4Ks0WzwgrEynuHJwTn760xe39rSqXWIOGrOBaX
wFpWHVjTFMKk+tSDG1lssLHyYWWdFFU4AnejRGORJYNaRHgVTKjHphc5jEhHm0BX
AEaHzTpmEXAMPLE=
-----END CERTIFICATE-----
`
	privateKey := `
-----BEGIN DSA PRIVATE KEY-----
MIIBugIBTTKBgQD33xToSXPJ6hr37L3+KNi3/7DgywlBcvlFPPSHIw3ORuO/22mT
8Cy5fT89WwNvZ3BPKWU6OZ38TQv3eWjNc/3U3+oqVNG2poX5nCPOtO1b96HYX2mR
3FTdH6FRKbQEhpDzZ6tRrjTHjMX6sT3JRWkBd2c4bGu+HUHO1H7QvrCTeQIVTKMs
TCKCyrLiGhUWuUGNJUMU6y6zToGTHl84Tz7TPwDGDXuy/Dk5s4jTVr+xibROC/gS
Qrs4Dzz3T1ze6lvU8S1KT9UsOB5FUJNTTPCPey+Lo4mmK6b23XdTyCIT8e2fsm2j
jHHC1pIPiTkdLS3j6ZYjF8LY6TENFng+LDY/xwPOl7TJVoD3J/WXC2J9CEYq9o34
kq6WWn3CgYTuo54nXUgnoCb3xdG8COFrg+oTbIkHTSzs3w5o/GGgKK7TDF3UlJjq
vHNyJQ6kWBrQRR1Xp5KYQ4c/Dm5kef+62mH53HpcCELguWVcffuVQpmq3EWL9Zp9
jobTJQ2VHjb5IVxiO6HRSd27di3njyrzUuJCyHSDTqwLJmTThpd6OTIUTL3Tc4m2
62TITdw53KWJEXAMPLE=
-----END DSA PRIVATE KEY-----
`
	params := &iam.UploadServerCertificateParams{
		ServerCertificateName: "ProdServerCert",
		Path:            "/company/servercerts/",
		PrivateKey:      privateKey,
		CertificateBody: certificateBody,
	}

	resp, err := s.iam.UploadServerCertificate(params)
	req := testServer.WaitRequest()
	c.Assert(req.Method, Equals, "POST")
	c.Assert(req.FormValue("Action"), Equals, "UploadServerCertificate")
	c.Assert(req.FormValue("CertificateBody"), Equals, certificateBody)
	c.Assert(req.FormValue("PrivateKey"), Equals, privateKey)
	c.Assert(req.FormValue("ServerCertificateName"), Equals, "ProdServerCert")
	c.Assert(req.FormValue("CertificateChain"), Equals, "")
	c.Assert(req.FormValue("Path"), Equals, "/company/servercerts/")
	c.Assert(req.FormValue("Version"), Equals, "2010-05-08")
	c.Assert(err, IsNil)

	ud, _ := time.Parse(time.RFC3339, "2010-05-08T01:02:03.004Z")
	exp, _ := time.Parse(time.RFC3339, "2012-05-08T01:02:03.004Z")
	expected := iam.ServerCertificateMetadata{
		Arn: "arn:aws:iam::123456789012:server-certificate/company/servercerts/ProdServerCert",
		ServerCertificateName: "ProdServerCert",
		ServerCertificateId:   "ASCACKCEVSQ6C2EXAMPLE",
		Path:                  "/company/servercerts/",
		UploadDate:            ud,
		Expiration:            exp,
	}
	c.Assert(resp.ServerCertificateMetadata, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestListServerCertificates(c *C) {
	testServer.Response(200, nil, ListServerCertificatesExample)
	params := &iam.ListServerCertificatesParams{
		Marker:     "my-fake-marker",
		PathPrefix: "/some/fake/path",
	}

	resp, err := s.iam.ListServerCertificates(params)
	req := testServer.WaitRequest()

	c.Assert(err, IsNil)
	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.FormValue("Action"), Equals, "ListServerCertificates")
	c.Assert(req.FormValue("Marker"), Equals, "my-fake-marker")
	c.Assert(req.FormValue("PathPrefix"), Equals, "/some/fake/path")
	c.Assert(req.FormValue("Version"), Equals, "2010-05-08")

	uploadDate, _ := time.Parse(time.RFC3339, "2010-05-08T01:02:03.004Z")
	expirationDate, _ := time.Parse(time.RFC3339, "2012-05-08T01:02:03.004Z")
	expected := []iam.ServerCertificateMetadata{
		{
			Arn: "arn:aws:iam::123456789012:server-certificate/company/servercerts/ProdServerCert",
			ServerCertificateName: "ProdServerCert",
			ServerCertificateId:   "ASCACKCEVSQ6C2EXAMPLE1",
			Path:                  "/some/fake/path",
			UploadDate:            uploadDate,
			Expiration:            expirationDate,
		},
		{
			Arn: "arn:aws:iam::123456789012:server-certificate/company/servercerts/BetaServerCert",
			ServerCertificateName: "BetaServerCert",
			ServerCertificateId:   "ASCACKCEVSQ6C2EXAMPLE2",
			Path:                  "/some/fake/path",
			UploadDate:            uploadDate,
			Expiration:            expirationDate,
		},
		{
			Arn: "arn:aws:iam::123456789012:server-certificate/company/servercerts/TestServerCert",
			ServerCertificateName: "TestServerCert",
			ServerCertificateId:   "ASCACKCEVSQ6C2EXAMPLE3",
			Path:                  "/some/fake/path",
			UploadDate:            uploadDate,
			Expiration:            expirationDate,
		},
	}

	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eTHISDIFFERENTTEST")
	c.Assert(resp.IsTruncated, Equals, false)
	c.Assert(resp.ServerCertificates, DeepEquals, expected)
}

func (s *S) TestDeleteServerCertificate(c *C) {
	testServer.Response(200, nil, DeleteServerCertificateExample)
	resp, err := s.iam.DeleteServerCertificate("ProdServerCert")
	req := testServer.WaitRequest()
	c.Assert(req.FormValue("Action"), Equals, "DeleteServerCertificate")
	c.Assert(req.FormValue("ServerCertificateName"), Equals, "ProdServerCert")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}
