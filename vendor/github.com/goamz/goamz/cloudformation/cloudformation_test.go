package cloudformation_test

import (
	"testing"
	"time"

	. "gopkg.in/check.v1"

	"github.com/goamz/goamz/aws"
	cf "github.com/goamz/goamz/cloudformation"
	"github.com/goamz/goamz/testutil"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	cf *cf.CloudFormation
}

var testServer = testutil.NewHTTPServer()

var mockTest bool

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.cf = cf.New(auth, aws.Region{CloudFormationEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func (s *S) TestCancelUpdateStack(c *C) {
	testServer.Response(200, nil, CancelUpdateStackResponse)

	resp, err := s.cf.CancelUpdateStack("foo")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "CancelUpdateStack")
	c.Assert(values.Get("StackName"), Equals, "foo")
	// Response test
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestCreateStack(c *C) {
	testServer.Response(200, nil, CreateStackResponse)

	stackParams := &cf.CreateStackParams{
		NotificationARNs: []string{"arn:aws:sns:us-east-1:1234567890:my-topic"},
		Parameters: []cf.Parameter{
			{
				ParameterKey:   "AvailabilityZone",
				ParameterValue: "us-east-1a",
			},
		},
		StackName:    "MyStack",
		TemplateBody: "[Template Document]",
	}
	resp, err := s.cf.CreateStack(stackParams)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "CreateStack")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NotificationARNs.member.1"), Equals, "arn:aws:sns:us-east-1:1234567890:my-topic")
	c.Assert(values.Get("TemplateBody"), Equals, "[Template Document]")
	c.Assert(values.Get("Parameters.member.1.ParameterKey"), Equals, "AvailabilityZone")
	c.Assert(values.Get("Parameters.member.1.ParameterValue"), Equals, "us-east-1a")
	// Response test
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
	c.Assert(resp.StackId, Equals, "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83")
}

func (s *S) TestCreateStackWithInvalidParams(c *C) {
	testServer.Response(400, nil, CreateStackWithInvalidParamsResponse)
	//testServer.Response(200, nil, DeleteAutoScalingGroupResponse)

	cfTemplate := `
{
  "AWSTemplateFormatVersion" : "2010-09-09",
  "Description" : "Sample template",
  "Parameters" : {
    "KeyName" : {
      "Description" : "key pair",
      "Type" : "String"
    }
  },
  "Resources" : {
    "Ec2Instance" : {
      "Type" : "AWS::EC2::Instance",
      "Properties" : {
        "KeyName" : { "Ref" : "KeyName" },
        "ImageId" : "ami-7f418316",
        "UserData" : { "Fn::Base64" : "80" }
      }
    }
  },
  "Outputs" : {
    "InstanceId" : {
      "Description" : "InstanceId of the newly created EC2 instance",
      "Value" : { "Ref" : "Ec2Instance" }
    }
}`

	stackParams := &cf.CreateStackParams{
		Capabilities:    []string{"CAPABILITY_IAM"},
		DisableRollback: true,
		NotificationARNs: []string{
			"arn:aws:sns:us-east-1:1234567890:my-topic",
			"arn:aws:sns:us-east-1:1234567890:my-topic2",
		},
		OnFailure: "ROLLBACK",
		Parameters: []cf.Parameter{
			{
				ParameterKey:   "AvailabilityZone",
				ParameterValue: "us-east-1a",
			},
		},
		StackName:       "MyStack",
		StackPolicyBody: "{PolicyBody}",
		StackPolicyURL:  "http://stack-policy-url",
		Tags: []cf.Tag{
			{
				Key:   "TagKey",
				Value: "TagValue",
			},
		},
		TemplateBody:     cfTemplate,
		TemplateURL:      "http://url",
		TimeoutInMinutes: 20,
	}
	resp, err := s.cf.CreateStack(stackParams)
	c.Assert(err, NotNil)
	c.Assert(resp, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "CreateStack")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NotificationARNs.member.1"), Equals, "arn:aws:sns:us-east-1:1234567890:my-topic")
	c.Assert(values.Get("NotificationARNs.member.2"), Equals, "arn:aws:sns:us-east-1:1234567890:my-topic2")
	c.Assert(values.Get("Capabilities.member.1"), Equals, "CAPABILITY_IAM")
	c.Assert(values.Get("TemplateBody"), Equals, cfTemplate)
	c.Assert(values.Get("TemplateURL"), Equals, "http://url")
	c.Assert(values.Get("StackPolicyBody"), Equals, "{PolicyBody}")
	c.Assert(values.Get("StackPolicyURL"), Equals, "http://stack-policy-url")
	c.Assert(values.Get("OnFailure"), Equals, "ROLLBACK")
	c.Assert(values.Get("DisableRollback"), Equals, "true")
	c.Assert(values.Get("Tags.member.1.Key"), Equals, "TagKey")
	c.Assert(values.Get("Tags.member.1.Value"), Equals, "TagValue")
	c.Assert(values.Get("Parameters.member.1.ParameterKey"), Equals, "AvailabilityZone")
	c.Assert(values.Get("Parameters.member.1.ParameterValue"), Equals, "us-east-1a")
	c.Assert(values.Get("TimeoutInMinutes"), Equals, "20")

	// Response test
	c.Assert(err.(*cf.Error).RequestId, Equals, "70a76d42-9665-11e2-9fdf-211deEXAMPLE")
	c.Assert(err.(*cf.Error).Message, Equals, "Either Template URL or Template Body must be specified.")
	c.Assert(err.(*cf.Error).Type, Equals, "Sender")
	c.Assert(err.(*cf.Error).Code, Equals, "ValidationError")
	c.Assert(err.(*cf.Error).StatusCode, Equals, 400)

}

func (s *S) TestDeleteStack(c *C) {
	testServer.Response(200, nil, DeleteStackResponse)

	resp, err := s.cf.DeleteStack("foo")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "DeleteStack")
	c.Assert(values.Get("StackName"), Equals, "foo")
	// Response test
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestDescribeStackEvents(c *C) {
	testServer.Response(200, nil, DescribeStackEventsResponse)

	resp, err := s.cf.DescribeStackEvents("MyStack", "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	t1, _ := time.Parse(time.RFC3339, "2010-07-27T22:26:28Z")
	t2, _ := time.Parse(time.RFC3339, "2010-07-27T22:27:28Z")
	t3, _ := time.Parse(time.RFC3339, "2010-07-27T22:28:28Z")
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "DescribeStackEvents")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NextToken"), Equals, "")

	// Response test
	expected := &cf.DescribeStackEventsResponse{
		StackEvents: []cf.StackEvent{
			{
				EventId:              "Event-1-Id",
				StackId:              "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:            "MyStack",
				LogicalResourceId:    "MyStack",
				PhysicalResourceId:   "MyStack_One",
				ResourceType:         "AWS::CloudFormation::Stack",
				Timestamp:            t1,
				ResourceStatus:       "CREATE_IN_PROGRESS",
				ResourceStatusReason: "User initiated",
			},
			{
				EventId:            "Event-2-Id",
				StackId:            "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:          "MyStack",
				LogicalResourceId:  "MyDBInstance",
				PhysicalResourceId: "MyStack_DB1",
				ResourceType:       "AWS::SecurityGroup",
				Timestamp:          t2,
				ResourceStatus:     "CREATE_IN_PROGRESS",
				ResourceProperties: "{\"GroupDescription\":...}",
			},
			{
				EventId:            "Event-3-Id",
				StackId:            "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:          "MyStack",
				LogicalResourceId:  "MySG1",
				PhysicalResourceId: "MyStack_SG1",
				ResourceType:       "AWS::SecurityGroup",
				Timestamp:          t3,
				ResourceStatus:     "CREATE_COMPLETE",
			},
		},
		NextToken: "",
		RequestId: "4af14eec-350e-11e4-b260-EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeStackResource(c *C) {
	testServer.Response(200, nil, DescribeStackResourceResponse)

	resp, err := s.cf.DescribeStackResource("MyStack", "MyDBInstance")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "DescribeStackResource")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("LogicalResourceId"), Equals, "MyDBInstance")
	t, _ := time.Parse(time.RFC3339, "2011-07-07T22:27:28Z")
	// Response test
	expected := &cf.DescribeStackResourceResponse{
		StackResourceDetail: cf.StackResourceDetail{
			StackId:              "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
			StackName:            "MyStack",
			LogicalResourceId:    "MyDBInstance",
			PhysicalResourceId:   "MyStack_DB1",
			ResourceType:         "AWS::RDS::DBInstance",
			LastUpdatedTimestamp: t,
			ResourceStatus:       "CREATE_COMPLETE",
		},
		RequestId: "4af14eec-350e-11e4-b260-EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeStackResources(c *C) {
	testServer.Response(200, nil, DescribeStackResourcesResponse)

	resp, err := s.cf.DescribeStackResources("MyStack", "", "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	t1, _ := time.Parse(time.RFC3339, "2010-07-27T22:27:28Z")
	t2, _ := time.Parse(time.RFC3339, "2010-07-27T22:28:28Z")
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "DescribeStackResources")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("PhysicalResourceId"), Equals, "")
	c.Assert(values.Get("LogicalResourceId"), Equals, "")

	// Response test
	expected := &cf.DescribeStackResourcesResponse{
		StackResources: []cf.StackResource{
			{
				StackId:            "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:          "MyStack",
				LogicalResourceId:  "MyDBInstance",
				PhysicalResourceId: "MyStack_DB1",
				ResourceType:       "AWS::DBInstance",
				Timestamp:          t1,
				ResourceStatus:     "CREATE_COMPLETE",
			},
			{
				StackId:            "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:          "MyStack",
				LogicalResourceId:  "MyAutoScalingGroup",
				PhysicalResourceId: "MyStack_ASG1",
				ResourceType:       "AWS::AutoScalingGroup",
				Timestamp:          t2,
				ResourceStatus:     "CREATE_IN_PROGRESS",
			},
		},
		RequestId: "4af14eec-350e-11e4-b260-EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeStacks(c *C) {
	testServer.Response(200, nil, DescribeStacksResponse)

	resp, err := s.cf.DescribeStacks("MyStack", "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	t, _ := time.Parse(time.RFC3339, "2010-07-27T22:28:28Z")
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "DescribeStacks")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NextToken"), Equals, "")

	// Response test
	expected := &cf.DescribeStacksResponse{
		Stacks: []cf.Stack{
			{
				StackId:          "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83",
				StackName:        "MyStack",
				Description:      "My Description",
				Capabilities:     []string{"CAPABILITY_IAM"},
				NotificationARNs: []string{"arn:aws:sns:region-name:account-name:topic-name"},
				Parameters: []cf.Parameter{
					{
						ParameterKey:   "MyKey",
						ParameterValue: "MyValue",
					},
				},
				Tags: []cf.Tag{
					{
						Key:   "MyTagKey",
						Value: "MyTagValue",
					},
				},
				CreationTime:    t,
				StackStatus:     "CREATE_COMPLETE",
				DisableRollback: false,
				Outputs: []cf.Output{
					{
						Description: "ServerUrl",
						OutputKey:   "StartPage",
						OutputValue: "http://my-load-balancer.amazonaws.com:80/index.html",
					},
				},
			},
		},
		NextToken: "",
		RequestId: "4af14eec-350e-11e4-b260-EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestEstimateTemplateCost(c *C) {
	testServer.Response(200, nil, EstimateTemplateCostResponse)

	resp, err := s.cf.EstimateTemplateCost(nil, "", "https://s3.amazonaws.com/cloudformation-samples-us-east-1/Drupal_Simple.template")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "EstimateTemplateCost")
	c.Assert(values.Get("TemplateBody"), Equals, "")
	c.Assert(values.Get("TemplateURL"), Equals, "https://s3.amazonaws.com/cloudformation-samples-us-east-1/Drupal_Simple.template")
	// Response test
	c.Assert(resp.Url, Equals, "http://calculator.s3.amazonaws.com/calc5.html?key=cf-2e351785-e821-450c-9d58-625e1e1ebfb6")
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestGetStackPolicy(c *C) {
	testServer.Response(200, nil, GetStackPolicyResponse)

	resp, err := s.cf.GetStackPolicy("MyStack")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "GetStackPolicy")

	c.Assert(values.Get("StackName"), Equals, "MyStack")
	// Response test
	policy := `{
      "Statement" : [
        {
          "Effect" : "Deny",
          "Action" : "Update:*",
          "Principal" : "*",
          "Resource" : "LogicalResourceId/ProductionDatabase"
        },
        {
          "Effect" : "Allow",
          "Action" : "Update:*",
          "Principal" : "*",
          "Resource" : "*"
        }
      ]
    }`
	c.Assert(resp.StackPolicyBody, Equals, policy)
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestGetTemplate(c *C) {
	testServer.Response(200, nil, GetTemplateResponse)

	resp, err := s.cf.GetTemplate("MyStack")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "GetTemplate")

	c.Assert(values.Get("StackName"), Equals, "MyStack")
	// Response test
	templateBody := `{
      "AWSTemplateFormatVersion" : "2010-09-09",
      "Description" : "Simple example",
      "Resources" : {
        "MySQS" : {
           "Type" : "AWS::SQS::Queue",
           "Properties" : {
            }
         }
        }
      }`
	c.Assert(resp.TemplateBody, Equals, templateBody)
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestListStackResources(c *C) {
	testServer.Response(200, nil, ListStackResourcesResponse)

	resp, err := s.cf.ListStackResources("MyStack", "4dad1-32131da-d-31")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "ListStackResources")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NextToken"), Equals, "4dad1-32131da-d-31")

	// Response test
	t1, _ := time.Parse(time.RFC3339, "2011-06-21T20:15:58Z")
	t2, _ := time.Parse(time.RFC3339, "2011-06-21T20:25:57Z")
	t3, _ := time.Parse(time.RFC3339, "2011-06-21T20:26:12Z")
	t4, _ := time.Parse(time.RFC3339, "2011-06-21T20:28:48Z")
	t5, _ := time.Parse(time.RFC3339, "2011-06-21T20:29:06Z")
	t6, _ := time.Parse(time.RFC3339, "2011-06-21T20:29:23Z")

	expected := &cf.ListStackResourcesResponse{
		StackResourceSummaries: []cf.StackResourceSummary{
			{
				LogicalResourceId:    "DBSecurityGroup",
				PhysicalResourceId:   "gmarcteststack-dbsecuritygroup-1s5m0ez5lkk6w",
				ResourceType:         "AWS::RDS::DBSecurityGroup",
				LastUpdatedTimestamp: t1,
				ResourceStatus:       "CREATE_COMPLETE",
			},
			{
				LogicalResourceId:    "SampleDB",
				PhysicalResourceId:   "MyStack-sampledb-ycwhk1v830lx",
				ResourceType:         "AWS::RDS::DBInstance",
				LastUpdatedTimestamp: t2,
				ResourceStatus:       "CREATE_COMPLETE",
			},
			{
				LogicalResourceId:    "SampleApplication",
				PhysicalResourceId:   "MyStack-SampleApplication-1MKNASYR3RBQL",
				ResourceType:         "AWS::ElasticBeanstalk::Application",
				LastUpdatedTimestamp: t3,
				ResourceStatus:       "CREATE_COMPLETE",
			},
			{
				LogicalResourceId:    "SampleEnvironment",
				PhysicalResourceId:   "myst-Samp-1AGU6ERZX6M3Q",
				ResourceType:         "AWS::ElasticBeanstalk::Environment",
				LastUpdatedTimestamp: t4,
				ResourceStatus:       "CREATE_COMPLETE",
			},
			{
				LogicalResourceId:    "AlarmTopic",
				PhysicalResourceId:   "arn:aws:sns:us-east-1:803981987763:MyStack-AlarmTopic-SW4IQELG7RPJ",
				ResourceType:         "AWS::SNS::Topic",
				LastUpdatedTimestamp: t5,
				ResourceStatus:       "CREATE_COMPLETE",
			},
			{
				LogicalResourceId:    "CPUAlarmHigh",
				PhysicalResourceId:   "MyStack-CPUAlarmHigh-POBWQPDJA81F",
				ResourceType:         "AWS::CloudWatch::Alarm",
				LastUpdatedTimestamp: t6,
				ResourceStatus:       "CREATE_COMPLETE",
			},
		},
		NextToken: "",
		RequestId: "2d06e36c-ac1d-11e0-a958-f9382b6eb86b",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestListStacks(c *C) {
	testServer.Response(200, nil, ListStacksResponse)

	resp, err := s.cf.ListStacks([]string{"CREATE_IN_PROGRESS", "DELETE_COMPLETE"}, "4dad1-32131da-d-31")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "ListStacks")
	c.Assert(values.Get("StackStatusFilter.member.1"), Equals, "CREATE_IN_PROGRESS")
	c.Assert(values.Get("StackStatusFilter.member.2"), Equals, "DELETE_COMPLETE")
	c.Assert(values.Get("NextToken"), Equals, "4dad1-32131da-d-31")

	// Response test
	c1, _ := time.Parse(time.RFC3339, "2011-05-23T15:47:44Z")
	c2, _ := time.Parse(time.RFC3339, "2011-03-05T19:57:58Z")
	d2, _ := time.Parse(time.RFC3339, "2011-03-10T16:20:51Z")

	expected := &cf.ListStacksResponse{
		StackSummaries: []cf.StackSummary{
			{
				StackId:             "arn:aws:cloudformation:us-east-1:1234567:stack/TestCreate1/aaaaa",
				StackName:           "vpc1",
				StackStatus:         "CREATE_IN_PROGRESS",
				CreationTime:        c1,
				TemplateDescription: "Creates one EC2 instance and a load balancer.",
			},
			{
				StackId:             "arn:aws:cloudformation:us-east-1:1234567:stack/TestDelete2/bbbbb",
				StackName:           "WP1",
				StackStatus:         "DELETE_COMPLETE",
				CreationTime:        c2,
				DeletionTime:        d2,
				TemplateDescription: "A simple basic Cloudformation Template.",
			},
		},
		NextToken: "",
		RequestId: "2d06e36c-ac1d-11e0-a958-f9382b6eb86b",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestSetStackPolicy(c *C) {
	testServer.Response(200, nil, SetStackPolicyResponse)

	resp, err := s.cf.SetStackPolicy("MyStack", "[Stack Policy Document]", "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "SetStackPolicy")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("StackPolicyBody"), Equals, "[Stack Policy Document]")
	c.Assert(values.Get("StackPolicyUrl"), Equals, "")
	// Response test
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
}

func (s *S) TestUpdateStack(c *C) {
	testServer.Response(200, nil, UpdateStackResponse)

	stackParams := &cf.UpdateStackParams{
		Capabilities:                []string{"CAPABILITY_IAM"},
		NotificationARNs:            []string{"arn:aws:sns:us-east-1:1234567890:my-topic"},
		StackPolicyBody:             "{PolicyBody}",
		StackPolicyDuringUpdateBody: "{PolicyDuringUpdateBody}",
		Parameters: []cf.Parameter{
			{
				ParameterKey:   "AvailabilityZone",
				ParameterValue: "us-east-1a",
			},
		},
		UsePreviousTemplate: true,
		StackName:           "MyStack",
		TemplateBody:        "[Template Document]",
	}
	resp, err := s.cf.UpdateStack(stackParams)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "UpdateStack")
	c.Assert(values.Get("StackName"), Equals, "MyStack")
	c.Assert(values.Get("NotificationARNs.member.1"), Equals, "arn:aws:sns:us-east-1:1234567890:my-topic")
	c.Assert(values.Get("TemplateBody"), Equals, "[Template Document]")
	c.Assert(values.Get("Parameters.member.1.ParameterKey"), Equals, "AvailabilityZone")
	c.Assert(values.Get("Parameters.member.1.ParameterValue"), Equals, "us-east-1a")
	c.Assert(values.Get("Capabilities.member.1"), Equals, "CAPABILITY_IAM")
	c.Assert(values.Get("StackPolicyBody"), Equals, "{PolicyBody}")
	c.Assert(values.Get("StackPolicyDuringUpdateBody"), Equals, "{PolicyDuringUpdateBody}")
	c.Assert(values.Get("UsePreviousTemplate"), Equals, "true")

	// Response test
	c.Assert(resp.RequestId, Equals, "4af14eec-350e-11e4-b260-EXAMPLE")
	c.Assert(resp.StackId, Equals, "arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83")
}

func (s *S) TestValidateTemplate(c *C) {
	testServer.Response(200, nil, ValidateTemplateResponse)

	resp, err := s.cf.ValidateTemplate("", "http://myTemplateRepository/TemplateOne.template")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm

	// Post request test
	c.Assert(values.Get("Version"), Equals, "2010-05-15")
	c.Assert(values.Get("Action"), Equals, "ValidateTemplate")
	c.Assert(values.Get("TemplateURL"), Equals, "http://myTemplateRepository/TemplateOne.template")
	c.Assert(values.Get("TemplateBody"), Equals, "")

	// Response test
	expected := &cf.ValidateTemplateResponse{
		Description:  "Test",
		Capabilities: []string{"CAPABILITY_IAM"},
		Parameters: []cf.TemplateParameter{
			{
				NoEcho:       false,
				ParameterKey: "InstanceType",
				Description:  "Type of instance to launch",
				DefaultValue: "m1.small",
			},
			{
				NoEcho:       false,
				ParameterKey: "WebServerPort",
				Description:  "The TCP port for the Web Server",
				DefaultValue: "8888",
			},
			{
				NoEcho:       false,
				ParameterKey: "KeyName",
				Description:  "Name of an existing EC2 KeyPair to enable SSH access into the server",
			},
		},
		RequestId: "0be7b6e8-e4a0-11e0-a5bd-9f8d5a7dbc91",
	}
	c.Assert(resp, DeepEquals, expected)
}
