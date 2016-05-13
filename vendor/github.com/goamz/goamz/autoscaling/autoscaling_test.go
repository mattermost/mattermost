package autoscaling

import (
	"testing"
	"time"

	. "gopkg.in/check.v1"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/testutil"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	as *AutoScaling
}

var testServer = testutil.NewHTTPServer()

var mockTest bool

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.as = New(auth, aws.Region{AutoScalingEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func TestBasicGroupRequest(t *testing.T) {
	var as *AutoScaling
	awsAuth, err := aws.EnvAuth()
	if err != nil {
		mockTest = true
		t.Log("Running mock tests as AWS environment variables are not set")
		awsAuth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
		as = New(awsAuth, aws.Region{AutoScalingEndpoint: testServer.URL})
		testServer.Start()
		go testServer.WaitRequest()
		testServer.Response(200, nil, BasicGroupResponse)
	} else {
		as = New(awsAuth, aws.USWest2)
	}

	groupResp, err := as.DescribeAutoScalingGroups(nil, 10, "")

	if err != nil {
		t.Fatal(err)
	}
	if len(groupResp.AutoScalingGroups) > 0 {
		firstGroup := groupResp.AutoScalingGroups[0]
		if len(firstGroup.AutoScalingGroupName) > 0 {
			t.Logf("Found AutoScaling group %s\n",
				firstGroup.AutoScalingGroupName)
		}
	}
	testServer.Flush()
}

func TestAutoScalingGroup(t *testing.T) {
	var as *AutoScaling
	// Launch configuration test config
	lc := new(LaunchConfiguration)
	lc.LaunchConfigurationName = "LConf1"
	lc.ImageId = "ami-03e47533" // Octave debian ami
	lc.KernelId = "aki-98e26fa8"
	lc.KeyName = "testAWS" // Replace with valid key for your account
	lc.InstanceType = "m1.small"

	// CreateAutoScalingGroup params test config
	asgReq := new(CreateAutoScalingGroupParams)
	asgReq.AutoScalingGroupName = "ASGTest1"
	asgReq.LaunchConfigurationName = lc.LaunchConfigurationName
	asgReq.DefaultCooldown = 300
	asgReq.HealthCheckGracePeriod = 300
	asgReq.DesiredCapacity = 1
	asgReq.MinSize = 1
	asgReq.MaxSize = 5
	asgReq.AvailabilityZones = []string{"us-west-2a"}

	asg := new(AutoScalingGroup)
	asg.AutoScalingGroupName = "ASGTest1"
	asg.LaunchConfigurationName = lc.LaunchConfigurationName
	asg.DefaultCooldown = 300
	asg.HealthCheckGracePeriod = 300
	asg.DesiredCapacity = 1
	asg.MinSize = 1
	asg.MaxSize = 5
	asg.AvailabilityZones = []string{"us-west-2a"}

	awsAuth, err := aws.EnvAuth()
	if err != nil {
		mockTest = true
		t.Log("Running mock tests as AWS environment variables are not set")
		awsAuth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
		as = New(awsAuth, aws.Region{AutoScalingEndpoint: testServer.URL})
	} else {
		as = New(awsAuth, aws.USWest2)
	}

	// Create the launch configuration
	if mockTest {
		testServer.Response(200, nil, CreateLaunchConfigurationResponse)
	}
	_, err = as.CreateLaunchConfiguration(lc)
	if err != nil {
		t.Fatal(err)
	}

	// Check that we can get the launch configuration details
	if mockTest {
		testServer.Response(200, nil, DescribeLaunchConfigurationsResponse)
	}
	_, err = as.DescribeLaunchConfigurations([]string{lc.LaunchConfigurationName}, 10, "")
	if err != nil {
		t.Fatal(err)
	}

	// Create the AutoScalingGroup
	if mockTest {
		testServer.Response(200, nil, CreateAutoScalingGroupResponse)
	}
	_, err = as.CreateAutoScalingGroup(asgReq)
	if err != nil {
		t.Fatal(err)
	}

	// Check that we can get the autoscaling group details
	if mockTest {
		testServer.Response(200, nil, DescribeAutoScalingGroupsResponse)
	}
	_, err = as.DescribeAutoScalingGroups(nil, 10, "")
	if err != nil {
		t.Fatal(err)
	}

	// Suspend the scaling processes for the test AutoScalingGroup
	if mockTest {
		testServer.Response(200, nil, SuspendProcessesResponse)
	}
	_, err = as.SuspendProcesses(asg.AutoScalingGroupName, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Resume scaling processes for the test AutoScalingGroup
	if mockTest {
		testServer.Response(200, nil, ResumeProcessesResponse)
	}
	_, err = as.ResumeProcesses(asg.AutoScalingGroupName, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Change the desired capacity from 1 to 2. This will launch a second instance
	if mockTest {
		testServer.Response(200, nil, SetDesiredCapacityResponse)
	}
	_, err = as.SetDesiredCapacity(asg.AutoScalingGroupName, 2, false)
	if err != nil {
		t.Fatal(err)
	}

	// Change the desired capacity from 2 to 1. This will terminate one of the instances
	if mockTest {
		testServer.Response(200, nil, SetDesiredCapacityResponse)
	}

	_, err = as.SetDesiredCapacity(asg.AutoScalingGroupName, 1, false)
	if err != nil {
		t.Fatal(err)
	}

	// Update the max capacity for the scaling group
	if mockTest {
		testServer.Response(200, nil, UpdateAutoScalingGroupResponse)
	}
	asg.MinSize = 1
	asg.MaxSize = 6
	asg.DesiredCapacity = 1
	_, err = as.UpdateAutoScalingGroup(asg)
	if err != nil {
		t.Fatal(err)
	}

	// Add a scheduled action to the group
	psar := new(PutScheduledUpdateGroupActionParams)
	psar.AutoScalingGroupName = asg.AutoScalingGroupName
	psar.MaxSize = 4
	psar.ScheduledActionName = "SATest1"
	psar.Recurrence = "30 0 1 1,6,12 *"
	if mockTest {
		testServer.Response(200, nil, PutScheduledUpdateGroupActionResponse)
	}
	_, err = as.PutScheduledUpdateGroupAction(psar)
	if err != nil {
		t.Fatal(err)
	}

	// List the scheduled actions for the group
	sar := new(DescribeScheduledActionsParams)
	sar.AutoScalingGroupName = asg.AutoScalingGroupName
	if mockTest {
		testServer.Response(200, nil, DescribeScheduledActionsResponse)
	}
	_, err = as.DescribeScheduledActions(sar)
	if err != nil {
		t.Fatal(err)
	}

	// Delete the test scheduled action from the group
	if mockTest {
		testServer.Response(200, nil, DeleteScheduledActionResponse)
	}
	_, err = as.DeleteScheduledAction(asg.AutoScalingGroupName, psar.ScheduledActionName)
	if err != nil {
		t.Fatal(err)
	}
	testServer.Flush()
}

// --------------------------------------------------------------------------
// Detailed Unit Tests

func (s *S) TestAttachInstances(c *C) {
	testServer.Response(200, nil, AttachInstancesResponse)
	resp, err := s.as.AttachInstances("my-test-asg", []string{"i-21321afs", "i-baaffg23"})
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "AttachInstances")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("InstanceIds.member.1"), Equals, "i-21321afs")
	c.Assert(values.Get("InstanceIds.member.2"), Equals, "i-baaffg23")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestCreateAutoScalingGroup(c *C) {
	testServer.Response(200, nil, CreateAutoScalingGroupResponse)
	testServer.Response(200, nil, DeleteAutoScalingGroupResponse)

	createAS := &CreateAutoScalingGroupParams{
		AutoScalingGroupName:    "my-test-asg",
		AvailabilityZones:       []string{"us-east-1a", "us-east-1b"},
		MinSize:                 3,
		MaxSize:                 3,
		DefaultCooldown:         600,
		DesiredCapacity:         0,
		LaunchConfigurationName: "my-test-lc",
		LoadBalancerNames:       []string{"elb-1", "elb-2"},
		Tags: []Tag{
			{
				Key:   "foo",
				Value: "bar",
			},
			{
				Key:   "baz",
				Value: "qux",
			},
		},
		VPCZoneIdentifier: "subnet-610acd08,subnet-530fc83a",
	}
	resp, err := s.as.CreateAutoScalingGroup(createAS)
	c.Assert(err, IsNil)
	defer s.as.DeleteAutoScalingGroup(createAS.AutoScalingGroupName, true)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "CreateAutoScalingGroup")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("AvailabilityZones.member.1"), Equals, "us-east-1a")
	c.Assert(values.Get("AvailabilityZones.member.2"), Equals, "us-east-1b")
	c.Assert(values.Get("MinSize"), Equals, "3")
	c.Assert(values.Get("MaxSize"), Equals, "3")
	c.Assert(values.Get("DefaultCooldown"), Equals, "600")
	c.Assert(values.Get("DesiredCapacity"), Equals, "0")
	c.Assert(values.Get("LaunchConfigurationName"), Equals, "my-test-lc")
	c.Assert(values.Get("LoadBalancerNames.member.1"), Equals, "elb-1")
	c.Assert(values.Get("LoadBalancerNames.member.2"), Equals, "elb-2")
	c.Assert(values.Get("Tags.member.1.Key"), Equals, "foo")
	c.Assert(values.Get("Tags.member.1.Value"), Equals, "bar")
	c.Assert(values.Get("Tags.member.2.Key"), Equals, "baz")
	c.Assert(values.Get("Tags.member.2.Value"), Equals, "qux")
	c.Assert(values.Get("VPCZoneIdentifier"), Equals, "subnet-610acd08,subnet-530fc83a")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestCreateLaunchConfiguration(c *C) {
	testServer.Response(200, nil, CreateLaunchConfigurationResponse)
	testServer.Response(200, nil, DeleteLaunchConfigurationResponse)

	launchConfig := &LaunchConfiguration{
		LaunchConfigurationName:  "my-test-lc",
		AssociatePublicIpAddress: true,
		EbsOptimized:             true,
		SecurityGroups:           []string{"sec-grp1", "sec-grp2"},
		UserData:                 "1234",
		KeyName:                  "secretKeyPair",
		ImageId:                  "ami-0078da69",
		InstanceType:             "m1.small",
		SpotPrice:                "0.03",
		BlockDeviceMappings: []BlockDeviceMapping{
			{
				DeviceName:  "/dev/sda1",
				VirtualName: "ephemeral0",
			},
			{
				DeviceName:  "/dev/sdb",
				VirtualName: "ephemeral1",
			},
			{
				DeviceName: "/dev/sdf",
				Ebs: EBS{
					DeleteOnTermination: true,
					SnapshotId:          "snap-2a2b3c4d",
					VolumeSize:          100,
				},
			},
		},
		InstanceMonitoring: InstanceMonitoring{
			Enabled: true,
		},
	}
	resp, err := s.as.CreateLaunchConfiguration(launchConfig)
	c.Assert(err, IsNil)
	defer s.as.DeleteLaunchConfiguration(launchConfig.LaunchConfigurationName)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "CreateLaunchConfiguration")
	c.Assert(values.Get("LaunchConfigurationName"), Equals, "my-test-lc")
	c.Assert(values.Get("AssociatePublicIpAddress"), Equals, "true")
	c.Assert(values.Get("EbsOptimized"), Equals, "true")
	c.Assert(values.Get("SecurityGroups.member.1"), Equals, "sec-grp1")
	c.Assert(values.Get("SecurityGroups.member.2"), Equals, "sec-grp2")
	c.Assert(values.Get("UserData"), Equals, "MTIzNA==")
	c.Assert(values.Get("KeyName"), Equals, "secretKeyPair")
	c.Assert(values.Get("ImageId"), Equals, "ami-0078da69")
	c.Assert(values.Get("InstanceType"), Equals, "m1.small")
	c.Assert(values.Get("SpotPrice"), Equals, "0.03")
	c.Assert(values.Get("BlockDeviceMappings.member.1.DeviceName"), Equals, "/dev/sda1")
	c.Assert(values.Get("BlockDeviceMappings.member.1.VirtualName"), Equals, "ephemeral0")
	c.Assert(values.Get("BlockDeviceMappings.member.2.DeviceName"), Equals, "/dev/sdb")
	c.Assert(values.Get("BlockDeviceMappings.member.2.VirtualName"), Equals, "ephemeral1")
	c.Assert(values.Get("BlockDeviceMappings.member.3.DeviceName"), Equals, "/dev/sdf")
	c.Assert(values.Get("BlockDeviceMappings.member.3.Ebs.DeleteOnTermination"), Equals, "true")
	c.Assert(values.Get("BlockDeviceMappings.member.3.Ebs.SnapshotId"), Equals, "snap-2a2b3c4d")
	c.Assert(values.Get("BlockDeviceMappings.member.3.Ebs.VolumeSize"), Equals, "100")
	c.Assert(values.Get("InstanceMonitoring.Enabled"), Equals, "true")
	c.Assert(resp.RequestId, Equals, "7c6e177f-f082-11e1-ac58-3714bEXAMPLE")
}

func (s *S) TestCreateOrUpdateTags(c *C) {
	testServer.Response(200, nil, CreateOrUpdateTagsResponse)
	tags := []Tag{
		{
			Key:        "foo",
			Value:      "bar",
			ResourceId: "my-test-asg",
		},
		{
			Key:               "baz",
			Value:             "qux",
			ResourceId:        "my-test-asg",
			PropagateAtLaunch: true,
		},
	}
	resp, err := s.as.CreateOrUpdateTags(tags)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "CreateOrUpdateTags")
	c.Assert(values.Get("Tags.member.1.Key"), Equals, "foo")
	c.Assert(values.Get("Tags.member.1.Value"), Equals, "bar")
	c.Assert(values.Get("Tags.member.1.ResourceId"), Equals, "my-test-asg")
	c.Assert(values.Get("Tags.member.2.Key"), Equals, "baz")
	c.Assert(values.Get("Tags.member.2.Value"), Equals, "qux")
	c.Assert(values.Get("Tags.member.2.ResourceId"), Equals, "my-test-asg")
	c.Assert(values.Get("Tags.member.2.PropagateAtLaunch"), Equals, "true")
	c.Assert(resp.RequestId, Equals, "b0203919-bf1b-11e2-8a01-13263EXAMPLE")
}

func (s *S) TestDeleteAutoScalingGroup(c *C) {
	testServer.Response(200, nil, DeleteAutoScalingGroupResponse)
	resp, err := s.as.DeleteAutoScalingGroup("my-test-asg", true)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DeleteAutoScalingGroup")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(resp.RequestId, Equals, "70a76d42-9665-11e2-9fdf-211deEXAMPLE")
}

func (s *S) TestDeleteAutoScalingGroupWithExistingInstances(c *C) {
	testServer.Response(400, nil, DeleteAutoScalingGroupErrorResponse)
	resp, err := s.as.DeleteAutoScalingGroup("my-test-asg", false)
	testServer.WaitRequest()
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	e, ok := err.(*Error)
	if !ok {
		c.Errorf("Unable to unmarshal error into AWS Autoscaling Error")
	}
	c.Assert(ok, Equals, true)
	c.Assert(e.Message, Equals, "You cannot delete an AutoScalingGroup while there are instances or pending Spot instance request(s) still in the group.")
	c.Assert(e.Code, Equals, "ResourceInUse")
	c.Assert(e.StatusCode, Equals, 400)
	c.Assert(e.RequestId, Equals, "70a76d42-9665-11e2-9fdf-211deEXAMPLE")
}

func (s *S) TestDeleteLaunchConfiguration(c *C) {
	testServer.Response(200, nil, DeleteLaunchConfigurationResponse)
	resp, err := s.as.DeleteLaunchConfiguration("my-test-lc")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DeleteLaunchConfiguration")
	c.Assert(values.Get("LaunchConfigurationName"), Equals, "my-test-lc")
	c.Assert(resp.RequestId, Equals, "7347261f-97df-11e2-8756-35eEXAMPLE")
}

func (s *S) TestDeleteLaunchConfigurationInUse(c *C) {
	testServer.Response(400, nil, DeleteLaunchConfigurationInUseResponse)
	resp, err := s.as.DeleteLaunchConfiguration("my-test-lc")
	testServer.WaitRequest()
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	e, ok := err.(*Error)
	if !ok {
		c.Errorf("Unable to unmarshal error into AWS Autoscaling Error")
	}
	c.Logf("%v %v %v", e.Code, e.Message, e.RequestId)
	c.Assert(ok, Equals, true)
	c.Assert(e.Message, Equals, "Cannot delete launch configuration my-test-lc because it is attached to AutoScalingGroup test")
	c.Assert(e.Code, Equals, "ResourceInUse")
	c.Assert(e.StatusCode, Equals, 400)
	c.Assert(e.RequestId, Equals, "7347261f-97df-11e2-8756-35eEXAMPLE")
}

func (s *S) TestDeleteTags(c *C) {
	testServer.Response(200, nil, DeleteTagsResponse)
	tags := []Tag{
		{
			Key:        "foo",
			Value:      "bar",
			ResourceId: "my-test-asg",
		},
		{
			Key:               "baz",
			Value:             "qux",
			ResourceId:        "my-test-asg",
			PropagateAtLaunch: true,
		},
	}
	resp, err := s.as.DeleteTags(tags)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DeleteTags")
	c.Assert(values.Get("Tags.member.1.Key"), Equals, "foo")
	c.Assert(values.Get("Tags.member.1.Value"), Equals, "bar")
	c.Assert(values.Get("Tags.member.1.ResourceId"), Equals, "my-test-asg")
	c.Assert(values.Get("Tags.member.2.Key"), Equals, "baz")
	c.Assert(values.Get("Tags.member.2.Value"), Equals, "qux")
	c.Assert(values.Get("Tags.member.2.ResourceId"), Equals, "my-test-asg")
	c.Assert(values.Get("Tags.member.2.PropagateAtLaunch"), Equals, "true")
	c.Assert(resp.RequestId, Equals, "b0203919-bf1b-11e2-8a01-13263EXAMPLE")
}

func (s *S) TestDescribeAccountLimits(c *C) {
	testServer.Response(200, nil, DescribeAccountLimitsResponse)

	resp, err := s.as.DescribeAccountLimits()
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeAccountLimits")
	c.Assert(resp.RequestId, Equals, "a32bd184-519d-11e3-a8a4-c1c467cbcc3b")
	c.Assert(resp.MaxNumberOfAutoScalingGroups, Equals, 20)
	c.Assert(resp.MaxNumberOfLaunchConfigurations, Equals, 100)

}

func (s *S) TestDescribeAdjustmentTypes(c *C) {
	testServer.Response(200, nil, DescribeAdjustmentTypesResponse)
	resp, err := s.as.DescribeAdjustmentTypes()
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeAdjustmentTypes")
	c.Assert(resp.RequestId, Equals, "cc5f0337-b694-11e2-afc0-6544dEXAMPLE")
	c.Assert(resp.AdjustmentTypes, DeepEquals, []AdjustmentType{{"ChangeInCapacity"}, {"ExactCapacity"}, {"PercentChangeInCapacity"}})
}

func (s *S) TestDescribeAutoScalingGroups(c *C) {
	testServer.Response(200, nil, DescribeAutoScalingGroupsResponse)
	resp, err := s.as.DescribeAutoScalingGroups([]string{"my-test-asg-lbs"}, 0, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	t, _ := time.Parse(time.RFC3339, "2013-05-06T17:47:15.107Z")
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeAutoScalingGroups")
	c.Assert(values.Get("AutoScalingGroupNames.member.1"), Equals, "my-test-asg-lbs")

	expected := &DescribeAutoScalingGroupsResp{
		AutoScalingGroups: []AutoScalingGroup{
			{
				AutoScalingGroupName: "my-test-asg-lbs",
				Tags: []Tag{
					{
						Key:               "foo",
						Value:             "bar",
						ResourceId:        "my-test-asg-lbs",
						PropagateAtLaunch: true,
						ResourceType:      "auto-scaling-group",
					},
					{
						Key:               "baz",
						Value:             "qux",
						ResourceId:        "my-test-asg-lbs",
						PropagateAtLaunch: true,
						ResourceType:      "auto-scaling-group",
					},
				},
				Instances: []Instance{
					{
						AvailabilityZone:        "us-east-1b",
						HealthStatus:            "Healthy",
						InstanceId:              "i-zb1f313",
						LaunchConfigurationName: "my-test-lc",
						LifecycleState:          "InService",
					},
					{
						AvailabilityZone:        "us-east-1a",
						HealthStatus:            "Healthy",
						InstanceId:              "i-90123adv",
						LaunchConfigurationName: "my-test-lc",
						LifecycleState:          "InService",
					},
				},
				HealthCheckType:         "ELB",
				CreatedTime:             t,
				LaunchConfigurationName: "my-test-lc",
				DesiredCapacity:         2,
				AvailabilityZones:       []string{"us-east-1b", "us-east-1a"},
				LoadBalancerNames:       []string{"my-test-asg-loadbalancer"},
				MinSize:                 2,
				MaxSize:                 10,
				VPCZoneIdentifier:       "subnet-32131da1,subnet-1312dad2",
				HealthCheckGracePeriod:  120,
				DefaultCooldown:         300,
				AutoScalingGroupARN:     "arn:aws:autoscaling:us-east-1:803981987763:autoScalingGroup:ca861182-c8f9-4ca7-b1eb-cd35505f5ebb:autoScalingGroupName/my-test-asg-lbs",
				TerminationPolicies:     []string{"Default"},
			},
		},
		RequestId: "0f02a07d-b677-11e2-9eb0-dd50EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeAutoScalingInstances(c *C) {
	testServer.Response(200, nil, DescribeAutoScalingInstancesResponse)
	resp, err := s.as.DescribeAutoScalingInstances([]string{"i-78e0d40b"}, 0, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeAutoScalingInstances")
	c.Assert(resp.RequestId, Equals, "df992dc3-b72f-11e2-81e1-750aa6EXAMPLE")
	c.Assert(resp.AutoScalingInstances, DeepEquals, []Instance{
		{
			AutoScalingGroupName:    "my-test-asg",
			AvailabilityZone:        "us-east-1a",
			HealthStatus:            "Healthy",
			InstanceId:              "i-78e0d40b",
			LaunchConfigurationName: "my-test-lc",
			LifecycleState:          "InService",
		},
	})
}

func (s *S) TestDescribeLaunchConfigurations(c *C) {
	testServer.Response(200, nil, DescribeLaunchConfigurationsResponse)
	resp, err := s.as.DescribeLaunchConfigurations([]string{"my-test-lc"}, 0, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	t, _ := time.Parse(time.RFC3339, "2013-01-21T23:04:42.200Z")
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeLaunchConfigurations")
	c.Assert(values.Get("LaunchConfigurationNames.member.1"), Equals, "my-test-lc")
	expected := &DescribeLaunchConfigurationsResp{
		LaunchConfigurations: []LaunchConfiguration{
			{
				AssociatePublicIpAddress: true,
				BlockDeviceMappings: []BlockDeviceMapping{
					{
						DeviceName:  "/dev/sdb",
						VirtualName: "ephemeral0",
					},
					{
						DeviceName: "/dev/sdf",
						Ebs: EBS{
							SnapshotId:          "snap-XXXXYYY",
							VolumeSize:          100,
							Iops:                50,
							VolumeType:          "io1",
							DeleteOnTermination: true,
						},
					},
				},
				EbsOptimized:            false,
				CreatedTime:             t,
				LaunchConfigurationName: "my-test-lc",
				InstanceType:            "m1.small",
				ImageId:                 "ami-514ac838",
				InstanceMonitoring:      InstanceMonitoring{Enabled: true},
				LaunchConfigurationARN:  "arn:aws:autoscaling:us-east-1:803981987763:launchConfiguration:9dbbbf87-6141-428a-a409-0752edbe6cad:launchConfigurationName/my-test-lc",
			},
		},
		RequestId: "d05a22f8-b690-11e2-bf8e-2113fEXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeMetricCollectionTypes(c *C) {
	testServer.Response(200, nil, DescribeMetricCollectionTypesResponse)
	resp, err := s.as.DescribeMetricCollectionTypes()
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeMetricCollectionTypes")
	c.Assert(resp.RequestId, Equals, "07f3fea2-bf3c-11e2-9b6f-f3cdbb80c073")
	c.Assert(resp.Metrics, DeepEquals, []MetricCollection{
		{
			Metric: "GroupMinSize",
		},
		{
			Metric: "GroupMaxSize",
		},
		{
			Metric: "GroupDesiredCapacity",
		},
		{
			Metric: "GroupInServiceInstances",
		},
		{
			Metric: "GroupPendingInstances",
		},
		{
			Metric: "GroupTerminatingInstances",
		},
		{
			Metric: "GroupTotalInstances",
		},
	})
	c.Assert(resp.Granularities, DeepEquals, []MetricGranularity{
		{
			Granularity: "1Minute",
		},
	})
}

func (s *S) TestDescribeNotificationConfigurations(c *C) {
	testServer.Response(200, nil, DescribeNotificationConfigurationsResponse)
	resp, err := s.as.DescribeNotificationConfigurations([]string{"i-78e0d40b"}, 0, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeNotificationConfigurations")
	c.Assert(resp.RequestId, Equals, "07f3fea2-bf3c-11e2-9b6f-f3cdbb80c073")
	c.Assert(resp.NotificationConfigurations, DeepEquals, []NotificationConfiguration{
		{
			AutoScalingGroupName: "my-test-asg",
			NotificationType:     "autoscaling: EC2_INSTANCE_LAUNCH",
			TopicARN:             "vajdoafj231j41231/topic",
		},
	})
}

func (s *S) TestDescribePolicies(c *C) {
	testServer.Response(200, nil, DescribePoliciesResponse)
	resp, err := s.as.DescribePolicies("my-test-asg", []string{}, 2, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribePolicies")
	c.Assert(values.Get("MaxRecords"), Equals, "2")
	expected := &DescribePoliciesResp{
		RequestId: "ec3bffad-b739-11e2-b38d-15fbEXAMPLE",
		NextToken: "3ef417fe-9202-12-8ddd-d13e1313413",
		ScalingPolicies: []ScalingPolicy{
			{
				PolicyARN:            "arn:aws:autoscaling:us-east-1:803981987763:scalingPolicy:c322761b-3172-4d56-9a21-0ed9d6161d67:autoScalingGroupName/my-test-asg:policyName/MyScaleDownPolicy",
				AdjustmentType:       "ChangeInCapacity",
				ScalingAdjustment:    -1,
				PolicyName:           "MyScaleDownPolicy",
				AutoScalingGroupName: "my-test-asg",
				Cooldown:             60,
				Alarms: []Alarm{
					{
						AlarmName: "TestQueue",
						AlarmARN:  "arn:aws:cloudwatch:us-east-1:803981987763:alarm:TestQueue",
					},
				},
			},
			{
				PolicyARN:            "arn:aws:autoscaling:us-east-1:803981987763:scalingPolicy:c55a5cdd-9be0-435b-b60b-a8dd313159f5:autoScalingGroupName/my-test-asg:policyName/MyScaleUpPolicy",
				AdjustmentType:       "ChangeInCapacity",
				ScalingAdjustment:    1,
				PolicyName:           "MyScaleUpPolicy",
				AutoScalingGroupName: "my-test-asg",
				Cooldown:             60,
				Alarms: []Alarm{
					{
						AlarmName: "TestQueue",
						AlarmARN:  "arn:aws:cloudwatch:us-east-1:803981987763:alarm:TestQueue",
					},
				},
			},
		},
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeScalingActivities(c *C) {
	testServer.Response(200, nil, DescribeScalingActivitiesResponse)
	resp, err := s.as.DescribeScalingActivities("my-test-asg", []string{}, 1, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeScalingActivities")
	c.Assert(values.Get("MaxRecords"), Equals, "1")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	st, _ := time.Parse(time.RFC3339, "2012-04-12T17:32:07.882Z")
	et, _ := time.Parse(time.RFC3339, "2012-04-12T17:32:08Z")
	expected := &DescribeScalingActivitiesResp{
		RequestId: "7a641adc-84c5-11e1-a8a5-217ebEXAMPLE",
		NextToken: "3ef417fe-9202-12-8ddd-d13e1313413",
		Activities: []Activity{
			{
				StatusCode:           "Failed",
				Progress:             0,
				ActivityId:           "063308ae-aa22-4a9b-94f4-9faeEXAMPLE",
				StartTime:            st,
				AutoScalingGroupName: "my-test-asg",
				Details:              "{}",
				Cause:                "At 2012-04-12T17:31:30Z a user request created an AutoScalingGroup changing the desired capacity from 0 to 1.  At 2012-04-12T17:32:07Z an instance was started in response to a difference between desired and actual capacity, increasing the capacity from 0 to 1.",
				Description:          "Launching a new EC2 instance.  Status Reason: The image id 'ami-4edb0327' does not exist. Launching EC2 instance failed.",
				EndTime:              et,
				StatusMessage:        "The image id 'ami-4edb0327' does not exist. Launching EC2 instance failed.",
			},
		},
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDescribeScalingProcessTypes(c *C) {
	testServer.Response(200, nil, DescribeScalingProcessTypesResponse)
	resp, err := s.as.DescribeScalingProcessTypes()
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeScalingProcessTypes")
	c.Assert(resp.RequestId, Equals, "27f2eacc-b73f-11e2-ad99-c7aba3a9c963")
	c.Assert(resp.Processes, DeepEquals, []ProcessType{
		{"AZRebalance"},
		{"AddToLoadBalancer"},
		{"AlarmNotification"},
		{"HealthCheck"},
		{"Launch"},
		{"ReplaceUnhealthy"},
		{"ScheduledActions"},
		{"Terminate"},
	})
}

func (s *S) TestDescribeScheduledActions(c *C) {
	testServer.Response(200, nil, DescribeScheduledActionsResponse)
	st, _ := time.Parse(time.RFC3339, "2014-06-01T00:30:00Z")
	request := &DescribeScheduledActionsParams{
		AutoScalingGroupName: "ASGTest1",
		MaxRecords:           1,
		StartTime:            st,
	}
	resp, err := s.as.DescribeScheduledActions(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeScheduledActions")
	c.Assert(resp.RequestId, Equals, "0eb4217f-8421-11e3-9233-7100ef811766")
	c.Assert(resp.ScheduledUpdateGroupActions, DeepEquals, []ScheduledUpdateGroupAction{
		{
			AutoScalingGroupName: "ASGTest1",
			ScheduledActionARN:   "arn:aws:autoscaling:us-west-2:193024542802:scheduledUpdateGroupAction:61f68b2c-bde3-4316-9a81-eb95dc246509:autoScalingGroupName/ASGTest1:scheduledActionName/SATest1",
			ScheduledActionName:  "SATest1",
			Recurrence:           "30 0 1 1,6,12 *",
			MaxSize:              4,
			StartTime:            st,
			Time:                 st,
		},
	})
}

func (s *S) TestDescribeTags(c *C) {
	testServer.Response(200, nil, DescribeTagsResponse)
	filter := NewFilter()
	filter.Add("auto-scaling-group", "my-test-asg")
	resp, err := s.as.DescribeTags(filter, 1, "")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeTags")
	c.Assert(values.Get("MaxRecords"), Equals, "1")
	c.Assert(values.Get("Filters.member.1.Name"), Equals, "auto-scaling-group")
	c.Assert(values.Get("Filters.member.1.Values.member.1"), Equals, "my-test-asg")
	c.Assert(resp.RequestId, Equals, "086265fd-bf3e-11e2-85fc-fbb1EXAMPLE")
	c.Assert(resp.Tags, DeepEquals, []Tag{
		{
			Key:               "version",
			Value:             "1.0",
			ResourceId:        "my-test-asg",
			PropagateAtLaunch: true,
			ResourceType:      "auto-scaling-group",
		},
	})
}

func (s *S) TestDescribeTerminationPolicyTypes(c *C) {
	testServer.Response(200, nil, DescribeTerminationPolicyTypesResponse)
	resp, err := s.as.DescribeTerminationPolicyTypes()
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DescribeTerminationPolicyTypes")
	c.Assert(resp.RequestId, Equals, "d9a05827-b735-11e2-a40c-c79a5EXAMPLE")
	c.Assert(resp.TerminationPolicyTypes, DeepEquals, []string{"ClosestToNextInstanceHour", "Default", "NewestInstance", "OldestInstance", "OldestLaunchConfiguration"})
}

func (s *S) TestDetachInstances(c *C) {
	testServer.Response(200, nil, DetachInstancesResponse)
	resp, err := s.as.DetachInstances("my-asg", []string{"i-5f2e8a0d"}, true)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DetachInstances")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-asg")
	c.Assert(values.Get("ShouldDecrementDesiredCapacity"), Equals, "true")
	c.Assert(values.Get("InstanceIds.member.1"), Equals, "i-5f2e8a0d")
	st, _ := time.Parse(time.RFC3339, "2014-06-14T00:07:30.280Z")
	expected := &DetachInstancesResult{
		RequestId: "e04f3b11-f357-11e3-a434-7f10009d5849",
		Activities: []Activity{
			{
				StatusCode:           "InProgress",
				Progress:             50,
				ActivityId:           "e54ff599-bf05-4076-8b95-a0f090ed90bb",
				StartTime:            st,
				AutoScalingGroupName: "my-asg",
				Details:              "{\"Availability Zone\":\"us-east-1a\"}",
				Cause:                "At 2014-06-14T00:07:30Z instance i-5f2e8a0d was detached in response to a user request, shrinking the capacity from 4 to 3.",
				Description:          "Detaching EC2 instance: i-5f2e8a0d",
			},
		},
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestDisableMetricsCollection(c *C) {
	testServer.Response(200, nil, DisableMetricsCollectionResponse)
	resp, err := s.as.DisableMetricsCollection("my-test-asg", []string{"GroupMinSize"})
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "DisableMetricsCollection")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("Metrics.member.1"), Equals, "GroupMinSize")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestEnableMetricsCollection(c *C) {
	testServer.Response(200, nil, DisableMetricsCollectionResponse)
	resp, err := s.as.EnableMetricsCollection("my-test-asg", []string{"GroupMinSize", "GroupMaxSize"}, "1Minute")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "EnableMetricsCollection")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("Granularity"), Equals, "1Minute")
	c.Assert(values.Get("Metrics.member.1"), Equals, "GroupMinSize")
	c.Assert(values.Get("Metrics.member.2"), Equals, "GroupMaxSize")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestEnterStandby(c *C) {
	testServer.Response(200, nil, EnterStandbyResponse)
	resp, err := s.as.EnterStandby("my-asg", []string{"i-5b73d709"}, true)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "EnterStandby")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-asg")
	c.Assert(values.Get("ShouldDecrementDesiredCapacity"), Equals, "true")
	c.Assert(values.Get("InstanceIds.member.1"), Equals, "i-5b73d709")
	st, _ := time.Parse(time.RFC3339, "2014-06-13T22:35:50.884Z")
	expected := &EnterStandbyResult{
		RequestId: "126f2f31-f34b-11e3-bc51-b35178f0274f",
		Activities: []Activity{
			{
				StatusCode:           "InProgress",
				Progress:             50,
				ActivityId:           "462b4bc3-ad3b-4e67-a58d-96cd00f02f9e",
				StartTime:            st,
				AutoScalingGroupName: "my-asg",
				Details:              "{\"Availability Zone\":\"us-east-1a\"}",
				Cause:                "At 2014-06-13T22:35:50Z instance i-5b73d709 was moved to standby in response to a user request, shrinking the capacity from 4 to 3.",
				Description:          "Moving EC2 instance to Standby: i-5b73d709",
			},
		},
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestExecutePolicy(c *C) {
	testServer.Response(200, nil, ExecutePolicyResponse)
	resp, err := s.as.ExecutePolicy("my-scaleout-policy", "my-test-asg", true)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "ExecutePolicy")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("PolicyName"), Equals, "my-scaleout-policy")
	c.Assert(values.Get("HonorCooldown"), Equals, "true")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestExitStandby(c *C) {
	testServer.Response(200, nil, ExitStandbyResponse)
	resp, err := s.as.ExitStandby("my-asg", []string{"i-5b73d709"})
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "ExitStandby")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-asg")
	c.Assert(values.Get("InstanceIds.member.1"), Equals, "i-5b73d709")
	st, _ := time.Parse(time.RFC3339, "2014-06-13T22:43:53.523Z")
	expected := &ExitStandbyResult{
		RequestId: "321a11c8-f34c-11e3-a434-7f10009d5849",
		Activities: []Activity{
			{
				StatusCode:           "PreInService",
				Progress:             30,
				ActivityId:           "dca4efcf-eea6-4844-8064-cab1fecd1aa2",
				StartTime:            st,
				AutoScalingGroupName: "my-asg",
				Details:              "{\"Availability Zone\":\"us-east-1a\"}",
				Cause:                "At 2014-06-13T22:43:53Z instance i-5b73d709 was moved out of standby in response to a user request, increasing the capacity from 3 to 4.",
				Description:          "Moving EC2 instance out of Standby: i-5b73d709",
			},
		},
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestPutLifecycleHook(c *C) {
	testServer.Response(200, nil, PutLifecycleHookResponse)
	request := &PutLifecycleHookParams{
		AutoScalingGroupName:  "my-asg",
		LifecycleHookName:     "ReadyForSoftwareInstall",
		LifecycleTransition:   "autoscaling:EC2_INSTANCE_LAUNCHING",
		NotificationTargetARN: "arn:aws:sqs:us-east-1:896650972448:lifecyclehookqueue",
		RoleARN:               "arn:aws:iam::896650972448:role/AutoScaling",
	}
	resp, err := s.as.PutLifecycleHook(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "PutLifecycleHook")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-asg")
	c.Assert(values.Get("LifecycleHookName"), Equals, "ReadyForSoftwareInstall")
	c.Assert(values.Get("RoleARN"), Equals, "arn:aws:iam::896650972448:role/AutoScaling")
	c.Assert(values.Get("LifecycleTransition"), Equals, "autoscaling:EC2_INSTANCE_LAUNCHING")
	c.Assert(values.Get("NotificationTargetARN"), Equals, "arn:aws:sqs:us-east-1:896650972448:lifecyclehookqueue")
	c.Assert(values.Get("DefaultResult"), Equals, "")
	c.Assert(values.Get("HeartbeatTimeout"), Equals, "")
	c.Assert(values.Get("NotificationMetadata"), Equals, "")
	c.Assert(resp.RequestId, Equals, "1952f458-f645-11e3-bc51-b35178f0274f")
}

func (s *S) TestPutNotificationConfiguration(c *C) {
	testServer.Response(200, nil, PutNotificationConfigurationResponse)
	resp, err := s.as.PutNotificationConfiguration("my-test-asg", []string{"autoscaling:EC2_INSTANCE_LAUNCH", "autoscaling:EC2_INSTANCE_LAUNCH_ERROR"}, "myTopicARN")
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "PutNotificationConfiguration")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("TopicARN"), Equals, "myTopicARN")
	c.Assert(values.Get("NotificationTypes.member.1"), Equals, "autoscaling:EC2_INSTANCE_LAUNCH")
	c.Assert(values.Get("NotificationTypes.member.2"), Equals, "autoscaling:EC2_INSTANCE_LAUNCH_ERROR")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestPutScalingPolicy(c *C) {
	testServer.Response(200, nil, PutScalingPolicyResponse)
	request := &PutScalingPolicyParams{
		AutoScalingGroupName: "my-test-asg",
		PolicyName:           "my-scaleout-policy",
		ScalingAdjustment:    30,
		AdjustmentType:       "PercentChangeInCapacity",
		Cooldown:             0,
		MinAdjustmentStep:    0,
	}
	resp, err := s.as.PutScalingPolicy(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "PutScalingPolicy")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("PolicyName"), Equals, "my-scaleout-policy")
	c.Assert(values.Get("AdjustmentType"), Equals, "PercentChangeInCapacity")
	c.Assert(values.Get("ScalingAdjustment"), Equals, "30")
	c.Assert(resp.RequestId, Equals, "3cfc6fef-c08b-11e2-a697-2922EXAMPLE")
	c.Assert(resp.PolicyARN, Equals, "arn:aws:autoscaling:us-east-1:803981987763:scalingPolicy:b0dcf5e8-02e6-4e31-9719-0675d0dc31ae:autoScalingGroupName/my-test-asg:policyName/my-scaleout-policy")
}

func (s *S) TestPutScheduledUpdateGroupAction(c *C) {
	testServer.Response(200, nil, PutScheduledUpdateGroupActionResponse)
	st, _ := time.Parse(time.RFC3339, "2013-05-25T08:00:00Z")
	request := &PutScheduledUpdateGroupActionParams{
		AutoScalingGroupName: "my-test-asg",
		DesiredCapacity:      3,
		ScheduledActionName:  "ScaleUp",
		StartTime:            st,
	}
	resp, err := s.as.PutScheduledUpdateGroupAction(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "PutScheduledUpdateGroupAction")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("ScheduledActionName"), Equals, "ScaleUp")
	c.Assert(values.Get("DesiredCapacity"), Equals, "3")
	c.Assert(values.Get("StartTime"), Equals, "2013-05-25T08:00:00Z")
	c.Assert(resp.RequestId, Equals, "3bc8c9bc-6a62-11e2-8a51-4b8a1EXAMPLE")
}

func (s *S) TestPutScheduledUpdateGroupActionCron(c *C) {
	testServer.Response(200, nil, PutScheduledUpdateGroupActionResponse)
	st, _ := time.Parse(time.RFC3339, "2013-05-25T08:00:00Z")
	request := &PutScheduledUpdateGroupActionParams{
		AutoScalingGroupName: "my-test-asg",
		DesiredCapacity:      3,
		ScheduledActionName:  "scaleup-schedule-year",
		StartTime:            st,
		Recurrence:           "30 0 1 1,6,12 *",
	}
	resp, err := s.as.PutScheduledUpdateGroupAction(request)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "PutScheduledUpdateGroupAction")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("ScheduledActionName"), Equals, "scaleup-schedule-year")
	c.Assert(values.Get("DesiredCapacity"), Equals, "3")
	c.Assert(values.Get("Recurrence"), Equals, "30 0 1 1,6,12 *")
	c.Assert(resp.RequestId, Equals, "3bc8c9bc-6a62-11e2-8a51-4b8a1EXAMPLE")

}

func (s *S) TestResumeProcesses(c *C) {
	testServer.Response(200, nil, ResumeProcessesResponse)
	resp, err := s.as.ResumeProcesses("my-test-asg", []string{"Launch", "Terminate"})
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "ResumeProcesses")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("ScalingProcesses.member.1"), Equals, "Launch")
	c.Assert(values.Get("ScalingProcesses.member.2"), Equals, "Terminate")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")

}

func (s *S) TestSetDesiredCapacity(c *C) {
	testServer.Response(200, nil, SetDesiredCapacityResponse)
	resp, err := s.as.SetDesiredCapacity("my-test-asg", 3, true)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "SetDesiredCapacity")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("HonorCooldown"), Equals, "true")
	c.Assert(values.Get("DesiredCapacity"), Equals, "3")
	c.Assert(resp.RequestId, Equals, "9fb7e2db-6998-11e2-a985-57c82EXAMPLE")
}

func (s *S) TestSetInstanceHealth(c *C) {
	testServer.Response(200, nil, SetInstanceHealthResponse)
	resp, err := s.as.SetInstanceHealth("i-baha3121", "Unhealthy", false)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "SetInstanceHealth")
	c.Assert(values.Get("HealthStatus"), Equals, "Unhealthy")
	c.Assert(values.Get("InstanceId"), Equals, "i-baha3121")
	c.Assert(values.Get("ShouldRespectGracePeriod"), Equals, "false")
	c.Assert(resp.RequestId, Equals, "9fb7e2db-6998-11e2-a985-57c82EXAMPLE")
}

func (s *S) TestSuspendProcesses(c *C) {
	testServer.Response(200, nil, SuspendProcessesResponse)
	resp, err := s.as.SuspendProcesses("my-test-asg", []string{"Launch", "Terminate"})
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "SuspendProcesses")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("ScalingProcesses.member.1"), Equals, "Launch")
	c.Assert(values.Get("ScalingProcesses.member.2"), Equals, "Terminate")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestTerminateInstanceInAutoScalingGroup(c *C) {
	testServer.Response(200, nil, TerminateInstanceInAutoScalingGroupResponse)
	st, _ := time.Parse(time.RFC3339, "2014-01-26T14:08:30.560Z")
	resp, err := s.as.TerminateInstanceInAutoScalingGroup("i-br234123", false)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "TerminateInstanceInAutoScalingGroup")
	c.Assert(values.Get("InstanceId"), Equals, "i-br234123")
	c.Assert(values.Get("ShouldDecrementDesiredCapacity"), Equals, "false")
	expected := &TerminateInstanceInAutoScalingGroupResp{
		Activity: Activity{
			ActivityId:  "cczc44a87-7d04-dsa15-31-d27c219864c5",
			Cause:       "At 2014-01-26T14:08:30Z instance i-br234123 was taken out of service in response to a user request.",
			Description: "Terminating EC2 instance: i-br234123",
			Details:     "{\"Availability Zone\":\"us-east-1b\"}",
			Progress:    0,
			StartTime:   st,
			StatusCode:  "InProgress",
		},
		RequestId: "8d798a29-f083-11e1-bdfb-cb223EXAMPLE",
	}
	c.Assert(resp, DeepEquals, expected)
}

func (s *S) TestUpdateAutoScalingGroup(c *C) {
	testServer.Response(200, nil, UpdateAutoScalingGroupResponse)

	asg := &AutoScalingGroup{
		AutoScalingGroupName:    "my-test-asg",
		AvailabilityZones:       []string{"us-east-1a", "us-east-1b"},
		MinSize:                 3,
		MaxSize:                 3,
		DefaultCooldown:         600,
		DesiredCapacity:         3,
		LaunchConfigurationName: "my-test-lc",
		VPCZoneIdentifier:       "subnet-610acd08,subnet-530fc83a",
	}
	resp, err := s.as.UpdateAutoScalingGroup(asg)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2011-01-01")
	c.Assert(values.Get("Action"), Equals, "UpdateAutoScalingGroup")
	c.Assert(values.Get("AutoScalingGroupName"), Equals, "my-test-asg")
	c.Assert(values.Get("AvailabilityZones.member.1"), Equals, "us-east-1a")
	c.Assert(values.Get("AvailabilityZones.member.2"), Equals, "us-east-1b")
	c.Assert(values.Get("MinSize"), Equals, "3")
	c.Assert(values.Get("MaxSize"), Equals, "3")
	c.Assert(values.Get("DefaultCooldown"), Equals, "600")
	c.Assert(values.Get("DesiredCapacity"), Equals, "3")
	c.Assert(values.Get("LaunchConfigurationName"), Equals, "my-test-lc")
	c.Assert(values.Get("VPCZoneIdentifier"), Equals, "subnet-610acd08,subnet-530fc83a")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}
