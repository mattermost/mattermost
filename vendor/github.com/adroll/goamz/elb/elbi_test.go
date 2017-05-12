package elb_test

import (
	"flag"
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/ec2"
	"github.com/AdRoll/goamz/elb"
	"gopkg.in/check.v1"
)

var amazon = flag.Bool("amazon", false, "Enable tests against amazon server")

// AmazonServer represents an Amazon AWS server.
type AmazonServer struct {
	auth aws.Auth
}

func (s *AmazonServer) SetUp(c *check.C) {
	auth, err := aws.EnvAuth()
	if err != nil {
		c.Fatal(err)
	}
	s.auth = auth
}

var _ = check.Suite(&AmazonClientSuite{})

// AmazonClientSuite tests the client against a live AWS server.
type AmazonClientSuite struct {
	srv AmazonServer
	ClientTests
}

// ClientTests defines integration tests designed to test the client.
// It is not used as a test suite in itself, but embedded within
// another type.
type ClientTests struct {
	elb *elb.ELB
	ec2 *ec2.EC2
}

func (s *AmazonClientSuite) SetUpSuite(c *check.C) {
	if !*amazon {
		c.Skip("AmazonClientSuite tests not enabled")
	}
	s.srv.SetUp(c)
	s.elb = elb.New(s.srv.auth, aws.USEast)
	s.ec2 = ec2.New(s.srv.auth, aws.USEast)
}

func (s *ClientTests) TestCreateAndDeleteLoadBalancer(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	resp, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	defer s.elb.DeleteLoadBalancer(createLBReq.Name)
	c.Assert(resp.DNSName, check.Not(check.Equals), "")
	deleteResp, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
	c.Assert(err, check.IsNil)
	c.Assert(deleteResp.RequestId, check.Not(check.Equals), "")
}

func (s *ClientTests) TestCreateLoadBalancerError(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Subnets:           []string{"subnetid-1"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	resp, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	e, ok := err.(*elb.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(e.Message, check.Matches, "Only one of .* or .* may be specified")
	c.Assert(e.Code, check.Equals, "ValidationError")
}

func (s *ClientTests) createInstanceAndLB(c *check.C) (*elb.CreateLoadBalancer, string) {
	options := ec2.RunInstancesOptions{
		ImageId:          "ami-ccf405a5",
		InstanceType:     "t1.micro",
		AvailabilityZone: "us-east-1c",
	}
	resp1, err := s.ec2.RunInstances(&options)
	c.Assert(err, check.IsNil)
	instId := resp1.Instances[0].InstanceId
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1c"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	_, err = s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	return &createLBReq, instId
}

// Cost: 0.02 USD
func (s *ClientTests) TestCreateRegisterAndDeregisterInstanceWithLoadBalancer(c *check.C) {
	createLBReq, instId := s.createInstanceAndLB(c)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
		_, err = s.ec2.TerminateInstances([]string{instId})
		c.Check(err, check.IsNil)
	}()
	resp, err := s.elb.RegisterInstancesWithLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, check.IsNil)
	c.Assert(resp.InstanceIds, check.DeepEquals, []string{instId})
	resp2, err := s.elb.DeregisterInstancesFromLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, check.IsNil)
	c.Assert(resp2, check.Not(check.Equals), "")
}

func (s *ClientTests) TestDescribeLoadBalancers(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	_, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
	}()
	resp, err := s.elb.DescribeLoadBalancers()
	c.Assert(err, check.IsNil)
	c.Assert(len(resp.LoadBalancerDescriptions) > 0, check.Equals, true)
	c.Assert(resp.LoadBalancerDescriptions[0].AvailabilityZones, check.DeepEquals, []string{"us-east-1a"})
	c.Assert(resp.LoadBalancerDescriptions[0].LoadBalancerName, check.Equals, "testlb")
	c.Assert(resp.LoadBalancerDescriptions[0].Scheme, check.Equals, "internet-facing")
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "TCP:80",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	c.Assert(resp.LoadBalancerDescriptions[0].HealthCheck, check.DeepEquals, hc)
	ld := []elb.ListenerDescription{
		{
			Listener: elb.Listener{
				Protocol:         "HTTP",
				LoadBalancerPort: 80,
				InstanceProtocol: "HTTP",
				InstancePort:     80,
			},
		},
	}
	c.Assert(resp.LoadBalancerDescriptions[0].ListenerDescriptions, check.DeepEquals, ld)
	ssg := elb.SourceSecurityGroup{
		GroupName:  "amazon-elb-sg",
		OwnerAlias: "amazon-elb",
	}
	c.Assert(resp.LoadBalancerDescriptions[0].SourceSecurityGroup, check.DeepEquals, ssg)
}

func (s *ClientTests) TestDescribeLoadBalancersBadRequest(c *check.C) {
	resp, err := s.elb.DescribeLoadBalancers("absentlb")
	c.Assert(err, check.NotNil)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.ErrorMatches, ".*(LoadBalancerNotFound).*")
}

func (s *ClientTests) TestDescribeInstanceHealth(c *check.C) {
	createLBReq, instId := s.createInstanceAndLB(c)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
		_, err = s.ec2.TerminateInstances([]string{instId})
		c.Check(err, check.IsNil)
	}()
	_, err := s.elb.RegisterInstancesWithLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, check.IsNil)
	resp, err := s.elb.DescribeInstanceHealth(createLBReq.Name, instId)
	c.Assert(err, check.IsNil)
	c.Assert(len(resp.InstanceStates) > 0, check.Equals, true)
	c.Assert(resp.InstanceStates[0].Description, check.Equals, "Instance is in pending state.")
	c.Assert(resp.InstanceStates[0].InstanceId, check.Equals, instId)
	c.Assert(resp.InstanceStates[0].State, check.Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, check.Equals, "Instance")
}

func (s *ClientTests) TestDescribeInstanceHealthBadRequest(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	_, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
	}()
	resp, err := s.elb.DescribeInstanceHealth(createLBReq.Name, "i-foo")
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	c.Assert(err, check.ErrorMatches, ".*i-foo.*(InvalidInstance).*")
}

func (s *ClientTests) TestConfigureHealthCheck(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	_, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
	}()
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80/",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck(createLBReq.Name, &hc)
	c.Assert(err, check.IsNil)
	c.Assert(resp.HealthCheck.HealthyThreshold, check.Equals, 10)
	c.Assert(resp.HealthCheck.Interval, check.Equals, 30)
	c.Assert(resp.HealthCheck.Target, check.Equals, "HTTP:80/")
	c.Assert(resp.HealthCheck.Timeout, check.Equals, 5)
	c.Assert(resp.HealthCheck.UnhealthyThreshold, check.Equals, 2)
}

func (s *ClientTests) TestConfigureHealthCheckBadRequest(c *check.C) {
	createLBReq := elb.CreateLoadBalancer{
		Name:              "testlb",
		AvailabilityZones: []string{"us-east-1a"},
		Listeners: []elb.Listener{
			{
				InstancePort:     80,
				InstanceProtocol: "http",
				LoadBalancerPort: 80,
				Protocol:         "http",
			},
		},
	}
	_, err := s.elb.CreateLoadBalancer(&createLBReq)
	c.Assert(err, check.IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, check.IsNil)
	}()
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck(createLBReq.Name, &hc)
	c.Assert(resp, check.IsNil)
	c.Assert(err, check.NotNil)
	expected := "HealthCheck HTTP Target must specify a port followed by a path that begins with a slash. e.g. HTTP:80/ping/this/path (ValidationError)"
	c.Assert(err.Error(), check.Equals, expected)
}
