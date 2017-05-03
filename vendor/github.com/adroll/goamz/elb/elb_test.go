package elb_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/elb"
	"gopkg.in/check.v1"
	"time"
)

type S struct {
	HTTPSuite
	elb *elb.ELB
}

var _ = check.Suite(&S{})

func (s *S) SetUpSuite(c *check.C) {
	s.HTTPSuite.SetUpSuite(c)
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.elb = elb.New(auth, aws.Region{ELBEndpoint: testServer.URL})
}

func (s *S) TestCreateLoadBalancer(c *check.C) {
	testServer.PrepareResponse(200, nil, CreateLoadBalancer)
	createLB := &elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a", "us-east-1b"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				Protocol:         "http",
				LoadBalancerPort: 80,
			},
		},
	}
	resp, err := s.elb.CreateLoadBalancer(createLB)
	c.Assert(err, check.IsNil)
	defer s.elb.DeleteLoadBalancer(createLB.Name)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Action"), check.Equals, "CreateLoadBalancer")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(values.Get("AvailabilityZones.member.1"), check.Equals, "us-east-1a")
	c.Assert(values.Get("AvailabilityZones.member.2"), check.Equals, "us-east-1b")
	c.Assert(values.Get("Listeners.member.1.InstancePort"), check.Equals, "80")
	c.Assert(values.Get("Listeners.member.1.InstanceProtocol"), check.Equals, "http")
	c.Assert(values.Get("Listeners.member.1.Protocol"), check.Equals, "http")
	c.Assert(values.Get("Listeners.member.1.LoadBalancerPort"), check.Equals, "80")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(resp.DNSName, check.Equals, "testlb-339187009.us-east-1.elb.amazonaws.com")
}

func (s *S) TestCreateLoadBalancerWithSubnetsAndMoreListeners(c *check.C) {
	testServer.PrepareResponse(200, nil, CreateLoadBalancer)
	createLB := &elb.CreateLoadBalancer{
		Name: "testlb",
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				Protocol:         "http",
				LoadBalancerPort: 80,
			},
			{
				InstancePort:     8080,
				InstanceProtocol: "http",
				Protocol:         "http",
				LoadBalancerPort: 8080,
			},
		},
		Subnets:        []string{"subnetid-1", "subnetid-2"},
		SecurityGroups: []string{"sg-1", "sg-2"},
	}
	_, err := s.elb.CreateLoadBalancer(createLB)
	c.Assert(err, check.IsNil)
	defer s.elb.DeleteLoadBalancer(createLB.Name)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Listeners.member.1.InstancePort"), check.Equals, "80")
	c.Assert(values.Get("Listeners.member.1.LoadBalancerPort"), check.Equals, "80")
	c.Assert(values.Get("Listeners.member.2.InstancePort"), check.Equals, "8080")
	c.Assert(values.Get("Listeners.member.2.LoadBalancerPort"), check.Equals, "8080")
	c.Assert(values.Get("Subnets.member.1"), check.Equals, "subnetid-1")
	c.Assert(values.Get("Subnets.member.2"), check.Equals, "subnetid-2")
	c.Assert(values.Get("SecurityGroups.member.1"), check.Equals, "sg-1")
	c.Assert(values.Get("SecurityGroups.member.2"), check.Equals, "sg-2")
}

func (s *S) TestCreateLoadBalancerWithWrongParamsCombination(c *check.C) {
	testServer.PrepareResponse(400, nil, CreateLoadBalancerBadRequest)
	createLB := &elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a", "us-east-1b"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				Protocol:         "http",
				LoadBalancerPort: 80,
			},
		},
		Subnets: []string{"subnetid-1", "subnetid2"},
	}
	resp, err := s.elb.CreateLoadBalancer(createLB)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	e, ok := err.(*elb.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(e.Message, check.Equals, "Only one of SubnetIds or AvailabilityZones may be specified")
	c.Assert(e.Code, check.Equals, "ValidationError")
}

func (s *S) TestDeleteLoadBalancer(c *check.C) {
	testServer.PrepareResponse(200, nil, DeleteLoadBalancer)
	resp, err := s.elb.DeleteLoadBalancer("testlb")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DeleteLoadBalancer")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(resp.RequestId, check.Equals, "8d7223db-49d7-11e2-bba9-35ba56032fe1")
}

func (s *S) TestRegisterInstancesWithLoadBalancer(c *check.C) {
	testServer.PrepareResponse(200, nil, RegisterInstancesWithLoadBalancer)
	resp, err := s.elb.RegisterInstancesWithLoadBalancer([]string{"i-b44db8ca", "i-461ecf38"}, "testlb")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "RegisterInstancesWithLoadBalancer")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(values.Get("Instances.member.1.InstanceId"), check.Equals, "i-b44db8ca")
	c.Assert(values.Get("Instances.member.2.InstanceId"), check.Equals, "i-461ecf38")
	c.Assert(resp.InstanceIds, check.DeepEquals, []string{"i-b44db8ca", "i-461ecf38"})
}

func (s *S) TestRegisterInstancesWithLoadBalancerBadRequest(c *check.C) {
	testServer.PrepareResponse(400, nil, RegisterInstancesWithLoadBalancerBadRequest)
	resp, err := s.elb.RegisterInstancesWithLoadBalancer([]string{"i-b44db8ca", "i-461ecf38"}, "absentLB")
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	e, ok := err.(*elb.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(e.Message, check.Equals, "There is no ACTIVE Load Balancer named 'absentLB'")
	c.Assert(e.Code, check.Equals, "LoadBalancerNotFound")
}

func (s *S) TestDeregisterInstancesFromLoadBalancer(c *check.C) {
	testServer.PrepareResponse(200, nil, DeregisterInstancesFromLoadBalancer)
	resp, err := s.elb.DeregisterInstancesFromLoadBalancer([]string{"i-b44db8ca", "i-461ecf38"}, "testlb")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DeregisterInstancesFromLoadBalancer")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(values.Get("Instances.member.1.InstanceId"), check.Equals, "i-b44db8ca")
	c.Assert(values.Get("Instances.member.2.InstanceId"), check.Equals, "i-461ecf38")
	c.Assert(resp.RequestId, check.Equals, "d6490837-49fd-11e2-bba9-35ba56032fe1")
}

func (s *S) TestDeregisterInstancesFromLoadBalancerBadRequest(c *check.C) {
	testServer.PrepareResponse(400, nil, DeregisterInstancesFromLoadBalancerBadRequest)
	resp, err := s.elb.DeregisterInstancesFromLoadBalancer([]string{"i-b44db8ca", "i-461ecf38"}, "testlb")
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	e, ok := err.(*elb.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(e.Message, check.Equals, "There is no ACTIVE Load Balancer named 'absentlb'")
	c.Assert(e.Code, check.Equals, "LoadBalancerNotFound")
}

func (s *S) TestDescribeLoadBalancers(c *check.C) {
	testServer.PrepareResponse(200, nil, DescribeLoadBalancers)
	resp, err := s.elb.DescribeLoadBalancers()
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DescribeLoadBalancers")
	t, _ := time.Parse(time.RFC3339, "2012-12-27T11:51:52.970Z")
	expected := &elb.DescribeLoadBalancerResp{
		[]elb.LoadBalancerDescription{
			{
				AvailabilityZones:         []string{"us-east-1a"},
				BackendServerDescriptions: []elb.BackendServerDescriptions(nil),
				CanonicalHostedZoneName:   "testlb-2087227216.us-east-1.elb.amazonaws.com",
				CanonicalHostedZoneNameId: "Z3DZXE0Q79N41H",
				CreatedTime:               t,
				DNSName:                   "testlb-2087227216.us-east-1.elb.amazonaws.com",
				HealthCheck: elb.HealthCheck{
					HealthyThreshold:   10,
					Interval:           30,
					Target:             "TCP:80",
					Timeout:            5,
					UnhealthyThreshold: 2,
				},
				Instances: []elb.Instance(nil),
				ListenerDescriptions: []elb.ListenerDescription{
					{
						Listener: elb.Listener{
							Protocol:         "HTTP",
							LoadBalancerPort: 80,
							InstanceProtocol: "HTTP",
							InstancePort:     80,
						},
					},
				},
				LoadBalancerName: "testlb",
				//Policies:                  elb.Policies(nil),
				Scheme:         "internet-facing",
				SecurityGroups: []string(nil),
				SourceSecurityGroup: elb.SourceSecurityGroup{
					GroupName:  "amazon-elb-sg",
					OwnerAlias: "amazon-elb",
				},
				Subnets: []string(nil),
			},
		},
	}
	c.Assert(resp, check.DeepEquals, expected)
}

func (s *S) TestDescribeLoadBalancersByName(c *check.C) {
	testServer.PrepareResponse(200, nil, DescribeLoadBalancers)
	s.elb.DescribeLoadBalancers("somelb")
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DescribeLoadBalancers")
	c.Assert(values.Get("LoadBalancerNames.member.1"), check.Equals, "somelb")
}

func (s *S) TestDescribeLoadBalancersBadRequest(c *check.C) {
	testServer.PrepareResponse(400, nil, DescribeLoadBalancersBadRequest)
	resp, err := s.elb.DescribeLoadBalancers()
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	c.Assert(err, check.ErrorMatches, `^Cannot find Load Balancer absentlb \(LoadBalancerNotFound\)$`)
}

func (s *S) TestDescribeInstanceHealth(c *check.C) {
	testServer.PrepareResponse(200, nil, DescribeInstanceHealth)
	resp, err := s.elb.DescribeInstanceHealth("testlb", "i-b44db8ca")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DescribeInstanceHealth")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(values.Get("Instances.member.1.InstanceId"), check.Equals, "i-b44db8ca")
	c.Assert(len(resp.InstanceStates) > 0, check.Equals, true)
	c.Assert(resp.InstanceStates[0].Description, check.Equals, "Instance registration is still in progress.")
	c.Assert(resp.InstanceStates[0].InstanceId, check.Equals, "i-b44db8ca")
	c.Assert(resp.InstanceStates[0].State, check.Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, check.Equals, "ELB")
}

func (s *S) TestDescribeInstanceHealthBadRequest(c *check.C) {
	testServer.PrepareResponse(400, nil, DescribeInstanceHealthBadRequest)
	resp, err := s.elb.DescribeInstanceHealth("testlb", "i-foooo")
	c.Assert(err, check.NotNil)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.ErrorMatches, ".*i-foooo.*(InvalidInstance).*")
}

func (s *S) TestConfigureHealthCheck(c *check.C) {
	testServer.PrepareResponse(200, nil, ConfigureHealthCheck)
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80/",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck("testlb", &hc)
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "ConfigureHealthCheck")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "testlb")
	c.Assert(values.Get("HealthCheck.HealthyThreshold"), check.Equals, "10")
	c.Assert(values.Get("HealthCheck.Interval"), check.Equals, "30")
	c.Assert(values.Get("HealthCheck.Target"), check.Equals, "HTTP:80/")
	c.Assert(values.Get("HealthCheck.Timeout"), check.Equals, "5")
	c.Assert(values.Get("HealthCheck.UnhealthyThreshold"), check.Equals, "2")
	c.Assert(resp.HealthCheck.HealthyThreshold, check.Equals, 10)
	c.Assert(resp.HealthCheck.Interval, check.Equals, 30)
	c.Assert(resp.HealthCheck.Target, check.Equals, "HTTP:80/")
	c.Assert(resp.HealthCheck.Timeout, check.Equals, 5)
	c.Assert(resp.HealthCheck.UnhealthyThreshold, check.Equals, 2)
}

func (s *S) TestConfigureHealthCheckBadRequest(c *check.C) {
	testServer.PrepareResponse(400, nil, ConfigureHealthCheckBadRequest)
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80/",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck("foolb", &hc)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	c.Assert(err, check.ErrorMatches, ".*foolb.*(LoadBalancerNotFound).*")
}

func (s *S) TestDescribeLoadBalancerAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, DescribeLoadBalancerAttributes)
	resp, err := s.elb.DescribeLoadBalancerAttributes("my-test-loadbalancer")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Version"), check.Equals, "2012-06-01")
	c.Assert(values.Get("Signature"), check.Not(check.Equals), "")
	c.Assert(values.Get("Timestamp"), check.Not(check.Equals), "")
	c.Assert(values.Get("Action"), check.Equals, "DescribeLoadBalancerAttributes")
	c.Assert(values.Get("LoadBalancerName"), check.Equals, "my-test-loadbalancer")
	c.Assert(resp.AccessLogEnabled, check.Equals, true)
	c.Assert(resp.AccessLogS3Bucket, check.Equals, "my-loadbalancer-logs")
	c.Assert(resp.AccessLogS3Prefix, check.Equals, "testprefix")
	c.Assert(resp.AccessLogEmitInterval, check.Equals, 5)
	c.Assert(resp.IdleTimeout, check.Equals, 30)
	c.Assert(resp.CrossZoneLoadbalancing, check.Equals, true)
	c.Assert(resp.ConnectionDrainingTimeout, check.Equals, 60)
	c.Assert(resp.ConnectionDrainingEnabled, check.Equals, true)
}
