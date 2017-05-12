package sns_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/sns"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	sns *sns.SNS
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	sns, _ := sns.New(auth, aws.Region{SNSEndpoint: testServer.URL})
	s.sns = sns
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestListTopicsOK(c *check.C) {
	testServer.Response(200, nil, TestListTopicsXmlOK)

	resp, err := s.sns.ListTopics("")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "bd10b26c-e30e-11e0-ba29-93c3aca2f103")
	c.Assert(err, check.IsNil)
}

func (s *S) TestCreateTopic(c *check.C) {
	testServer.Response(200, nil, TestCreateTopicXmlOK)

	resp, err := s.sns.CreateTopic("My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.Topic.TopicArn, check.Equals, "arn:aws:sns:us-east-1:123456789012:My-Topic")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "a8dec8b3-33a4-11df-8963-01868b7c937a")
	c.Assert(err, check.IsNil)
}

func (s *S) TestDeleteTopic(c *check.C) {
	testServer.Response(200, nil, TestDeleteTopicXmlOK)

	t := sns.Topic{"arn:aws:sns:us-east-1:123456789012:My-Topic"}
	resp, err := s.sns.DeleteTopic(t.TopicArn)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "f3aa9ac9-3c3d-11df-8235-9dab105e9c32")
	c.Assert(err, check.IsNil)
}

func (s *S) TestListSubscriptions(c *check.C) {
	testServer.Response(200, nil, TestListSubscriptionsXmlOK)

	resp, err := s.sns.ListSubscriptions("")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Subscriptions), check.Not(check.Equals), 0)
	c.Assert(resp.Subscriptions[0].Protocol, check.Equals, "email")
	c.Assert(resp.Subscriptions[0].Endpoint, check.Equals, "example@amazon.com")
	c.Assert(resp.Subscriptions[0].SubscriptionArn, check.Equals, "arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca")
	c.Assert(resp.Subscriptions[0].TopicArn, check.Equals, "arn:aws:sns:us-east-1:698519295917:My-Topic")
	c.Assert(resp.Subscriptions[0].Owner, check.Equals, "123456789012")
	c.Assert(err, check.IsNil)
}

func (s *S) TestGetTopicAttributes(c *check.C) {
	testServer.Response(200, nil, TestGetTopicAttributesXmlOK)

	resp, err := s.sns.GetTopicAttributes("arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Attributes), check.Not(check.Equals), 0)
	c.Assert(resp.Attributes[0].Key, check.Equals, "Owner")
	c.Assert(resp.Attributes[0].Value, check.Equals, "123456789012")
	c.Assert(resp.Attributes[1].Key, check.Equals, "Policy")
	c.Assert(resp.Attributes[1].Value, check.Equals, `{"Version":"2008-10-17","Id":"us-east-1/698519295917/test__default_policy_ID","Statement" : [{"Effect":"Allow","Sid":"us-east-1/698519295917/test__default_statement_ID","Principal" : {"AWS": "*"},"Action":["SNS:GetTopicAttributes","SNS:SetTopicAttributes","SNS:AddPermission","SNS:RemovePermission","SNS:DeleteTopic","SNS:Subscribe","SNS:ListSubscriptionsByTopic","SNS:Publish","SNS:Receive"],"Resource":"arn:aws:sns:us-east-1:698519295917:test","Condition" : {"StringLike" : {"AWS:SourceArn": "arn:aws:*:*:698519295917:*"}}}]}`)
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "057f074c-33a7-11df-9540-99d0768312d3")
	c.Assert(err, check.IsNil)
}

func (s *S) TestPublish(c *check.C) {
	testServer.Response(200, nil, TestPublishXmlOK)

	pubOpt := &sns.PublishOptions{"foobar", "", "subject", "", "arn:aws:sns:us-east-1:123456789012:My-Topic"}
	resp, err := s.sns.Publish(pubOpt)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.MessageId, check.Equals, "94f20ce6-13c5-43a0-9a9e-ca52d816e90b")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "f187a3c1-376f-11df-8963-01868b7c937a")
	c.Assert(err, check.IsNil)
}

func (s *S) TestSetTopicAttributes(c *check.C) {
	testServer.Response(200, nil, TestSetTopicAttributesXmlOK)

	resp, err := s.sns.SetTopicAttributes("DisplayName", "MyTopicName", "arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "a8763b99-33a7-11df-a9b7-05d48da6f042")
	c.Assert(err, check.IsNil)
}

func (s *S) TestSubscribe(c *check.C) {
	testServer.Response(200, nil, TestSubscribeXmlOK)

	resp, err := s.sns.Subscribe("example@amazon.com", "email", "arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.SubscriptionArn, check.Equals, "pending confirmation")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "a169c740-3766-11df-8963-01868b7c937a")
	c.Assert(err, check.IsNil)
}

func (s *S) TestUnsubscribe(c *check.C) {
	testServer.Response(200, nil, TestUnsubscribeXmlOK)

	resp, err := s.sns.Unsubscribe("arn:aws:sns:us-east-1:123456789012:My-Topic:a169c740-3766-11df-8963-01868b7c937a")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "18e0ac39-3776-11df-84c0-b93cc1666b84")
	c.Assert(err, check.IsNil)
}

func (s *S) TestConfirmSubscription(c *check.C) {
	testServer.Response(200, nil, TestConfirmSubscriptionXmlOK)

	resp, err := s.sns.ConfirmSubscription("arn:aws:sns:us-east-1:123456789012:My-Topic", "51b2ff3edb475b7d91550e0ab6edf0c1de2a34e6ebaf6", "")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.SubscriptionArn, check.Equals, "arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "7a50221f-3774-11df-a9b7-05d48da6f042")
	c.Assert(err, check.IsNil)
}

func (s *S) TestGetSubscriptionAttributes(c *check.C) {
	testServer.Response(200, nil, TestGetSubscriptionAttributesXmlOK)

	resp, err := s.sns.GetSubscriptionAttributes("arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Attributes), check.Not(check.Equals), 0)
	c.Assert(resp.Attributes[0].Key, check.Equals, "Owner")
	c.Assert(resp.Attributes[0].Value, check.Equals, "123456789012")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "95bfab85-1300-403f-a86e-2e78f095a05d")
	c.Assert(err, check.IsNil)
}

func (s *S) TestSetSubscriptionAttributes(c *check.C) {
	testServer.Response(200, nil, TestSetSubscriptionAttributesXmlOK)

	resp, err := s.sns.SetSubscriptionAttributes("arn:aws:sns:us-east-1:123456789012:My-Topic", "DeliveryPolicy", "")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "21382310-78db-4f88-bae0-a2c38ed5fe32")
	c.Assert(err, check.IsNil)
}

func (s *S) TestAddPermission(c *check.C) {
	testServer.Response(200, nil, TestAddPermissionXmlOK)
	perm := make([]sns.Permission, 2)
	perm[0].ActionName = "Publish"
	perm[1].ActionName = "GetTopicAttributes"
	perm[0].AccountId = "987654321000"
	perm[1].AccountId = "876543210000"

	resp, err := s.sns.AddPermission("NewPermission", "arn:aws:sns:us-east-1:123456789012:My-Topic", perm)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6a213e4e-33a8-11df-9540-99d0768312d3")
	c.Assert(err, check.IsNil)
}

func (s *S) TestRemovePermission(c *check.C) {
	testServer.Response(200, nil, TestRemovePermissionXmlOK)

	resp, err := s.sns.RemovePermission("NewPermission", "arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "d170b150-33a8-11df-995a-2d6fbe836cc1")
	c.Assert(err, check.IsNil)
}

func (s *S) TestListSubscriptionByTopic(c *check.C) {
	testServer.Response(200, nil, TestListSubscriptionsByTopicXmlOK)

	resp, err := s.sns.ListSubscriptionsByTopic("", "arn:aws:sns:us-east-1:123456789012:My-Topic")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Subscriptions), check.Not(check.Equals), 0)
	c.Assert(resp.Subscriptions[0].TopicArn, check.Equals, "arn:aws:sns:us-east-1:123456789012:My-Topic")
	c.Assert(resp.Subscriptions[0].SubscriptionArn, check.Equals, "arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca")
	c.Assert(resp.Subscriptions[0].Owner, check.Equals, "123456789012")
	c.Assert(resp.Subscriptions[0].Endpoint, check.Equals, "example@amazon.com")
	c.Assert(resp.Subscriptions[0].Protocol, check.Equals, "email")
	c.Assert(err, check.IsNil)
}
func (s *S) TestCreatePlatformApplication(c *check.C) {
	testServer.Response(200, nil, TestCreatePlatformApplicationXmlOK)

	attrs := []sns.Attribute{
		sns.Attribute{Key: "PlatformCredential", Value: "AIzaSyClE2lcV2zEKTLYYo645zfk2jhQPFeyxDo"},
		sns.Attribute{Key: "PlatformPrincipal", Value: "There is no principal for GCM"},
	}
	resp, err := s.sns.CreatePlatformApplication("gcmpushapp", "GCM", attrs)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.PlatformApplicationArn, check.Equals, "arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "b6f0e78b-e9d4-5a0e-b973-adc04e8a4ff9")

	c.Assert(err, check.IsNil)
}

func (s *S) TestCreatePlatformEndpoint(c *check.C) {
	testServer.Response(200, nil, TestCreatePlatformEndpointXmlOK)

	opt := &sns.PlatformEndpointOptions{PlatformApplicationArn: "arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp",
		CustomUserData: "UserId=27576823", Token: "APA91bGi7fFachkC1xjlqT66VYEucGHochmf1VQAr9k...jsM0PKPxKhddCzx6paEsyay9Zn3D4wNUJb8m6HZrBEXAMPLE"}

	resp, err := s.sns.CreatePlatformEndpoint(opt)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.EndpointArn, check.Equals, "arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6613341d-3e15-53f7-bf3c-7e56994ba278")

	c.Assert(err, check.IsNil)
}

func (s *S) TestDeleteEndpoint(c *check.C) {
	testServer.Response(200, nil, DeleteEndpointXmlOK)

	resp, err := s.sns.DeleteEndpoint("arn:aws:sns:us-west-2:123456789012:endpoint/GCM%/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "c1d2b191-353c-5a5f-8969-fbdd3900afa8")

	c.Assert(err, check.IsNil)
}

func (s *S) TestDeletePlatformApplication(c *check.C) {
	testServer.Response(200, nil, TestDeletePlatformApplicationXmlOK)

	resp, err := s.sns.DeletePlatformApplication("arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "097dac18-7a77-5823-a8dd-e65476dcb037")

	c.Assert(err, check.IsNil)
}

func (s *S) TestGetEndpointAttributes(c *check.C) {
	testServer.Response(200, nil, TestGetEndpointAttributesXmlOK)

	resp, err := s.sns.GetEndpointAttributes("arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Attributes), check.Equals, 3)
	c.Assert(resp.Attributes[0].Key, check.Equals, "Enabled")
	c.Assert(resp.Attributes[0].Value, check.Equals, "true")

	c.Assert(resp.Attributes[1].Key, check.Equals, "CustomUserData")
	c.Assert(resp.Attributes[1].Value, check.Equals, "UserId=01234567")

	c.Assert(resp.Attributes[2].Key, check.Equals, "Token")
	c.Assert(resp.Attributes[2].Value, check.Equals, "APA91bGi7fFachkC1xjlqT66VYEucGHochmf1VQAr9k...jsM0PKPxKhddCzx6paEsyay9Zn3D4wNUJb8m6HZrBEXAMPLE")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6c725a19-a142-5b77-94f9-1055a9ea04e7")

	c.Assert(err, check.IsNil)
}

func (s *S) TestGetPlatformApplicationAttributes(c *check.C) {
	testServer.Response(200, nil, TestGetPlatformApplicationAttributesXmlOK)

	resp, err := s.sns.GetPlatformApplicationAttributes("arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Attributes), check.Not(check.Equals), 0)
	c.Assert(resp.Attributes[0].Key, check.Equals, "AllowEndpointPolicies")
	c.Assert(resp.Attributes[0].Value, check.Equals, "false")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "74848df2-87f6-55ed-890c-c7be80442462")

	c.Assert(err, check.IsNil)
}

func (s *S) TestListEndpointsByPlatformApplication(c *check.C) {
	testServer.Response(200, nil, TestListEndpointsByPlatformApplicationXmlOK)

	resp, err := s.sns.ListEndpointsByPlatformApplication("arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp", "")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Endpoints), check.Not(check.Equals), 0)
	c.Assert(resp.Endpoints[0].EndpointArn, check.Equals, "arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3")
	c.Assert(len(resp.Endpoints[0].Attributes), check.Equals, 3)
	c.Assert(resp.Endpoints[0].Attributes[0].Key, check.Equals, "Enabled")
	c.Assert(resp.Endpoints[0].Attributes[0].Value, check.Equals, "true")
	c.Assert(resp.Endpoints[0].Attributes[1].Key, check.Equals, "CustomUserData")
	c.Assert(resp.Endpoints[0].Attributes[1].Value, check.Equals, "UserId=27576823")
	c.Assert(resp.Endpoints[0].Attributes[2].Key, check.Equals, "Token")
	c.Assert(resp.Endpoints[0].Attributes[2].Value, check.Equals, "APA91bGi7fFachkC1xjlqT66VYEucGHochmf1VQAr9k...jsM0PKPxKhddCzx6paEsyay9Zn3D4wNUJb8m6HZrBEXAMPLE")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "9a48768c-dac8-5a60-aec0-3cc27ea08d96")

	c.Assert(err, check.IsNil)
}

func (s *S) TestListPlatformApplications(c *check.C) {
	testServer.Response(200, nil, TestListPlatformApplicationsXmlOK)

	resp, err := s.sns.ListPlatformApplications("")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.PlatformApplications), check.Not(check.Equals), 0)

	c.Assert(resp.PlatformApplications[0].PlatformApplicationArn, check.Equals, "arn:aws:sns:us-west-2:123456789012:app/APNS_SANDBOX/apnspushapp")
	c.Assert(len(resp.PlatformApplications[0].Attributes), check.Equals, 1)
	c.Assert(resp.PlatformApplications[0].Attributes[0].Key, check.Equals, "AllowEndpointPolicies")
	c.Assert(resp.PlatformApplications[0].Attributes[0].Value, check.Equals, "false")

	c.Assert(resp.PlatformApplications[1].PlatformApplicationArn, check.Equals, "arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp")
	c.Assert(len(resp.PlatformApplications[1].Attributes), check.Equals, 1)
	c.Assert(resp.PlatformApplications[1].Attributes[0].Key, check.Equals, "AllowEndpointPolicies")
	c.Assert(resp.PlatformApplications[1].Attributes[0].Value, check.Equals, "false")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "315a335e-85d8-52df-9349-791283cbb529")

	c.Assert(err, check.IsNil)
}

func (s *S) TestSetEndpointAttributes(c *check.C) {
	testServer.Response(200, nil, TestSetEndpointAttributesXmlOK)

	attrs := []sns.Attribute{
		sns.Attribute{Key: "CustomUserData", Value: "My custom userdata"},
	}

	resp, err := s.sns.SetEndpointAttributes("arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3", attrs)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "2fe0bfc7-3e85-5ee5-a9e2-f58b35e85f6a")

	c.Assert(err, check.IsNil)
}

func (s *S) TestSetPlatformApplicationAttributes(c *check.C) {
	testServer.Response(200, nil, TestSetPlatformApplicationAttributesXmlOK)

	attrs := []sns.Attribute{
		sns.Attribute{Key: "EventEndpointCreated", Value: "arn:aws:sns:us-west-2:123456789012:topicarn"},
	}

	resp, err := s.sns.SetPlatformApplicationAttributes("arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp", attrs)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "cf577bcc-b3dc-5463-88f1-3180b9412395")

	c.Assert(err, check.IsNil)
}
