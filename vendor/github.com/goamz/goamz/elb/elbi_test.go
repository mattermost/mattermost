package elb_test

import (
	"flag"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/ec2"
	"github.com/goamz/goamz/elb"
	. "gopkg.in/check.v1"
)

var amazon = flag.Bool("amazon", false, "Enable tests against amazon server")

// AmazonServer represents an Amazon AWS server.
type AmazonServer struct {
	auth aws.Auth
}

func (s *AmazonServer) SetUp(c *C) {
	auth, err := aws.EnvAuth()
	if err != nil {
		c.Fatal(err)
	}
	s.auth = auth
}

var _ = Suite(&AmazonClientSuite{})

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

func (s *AmazonClientSuite) SetUpSuite(c *C) {
	if !*amazon {
		c.Skip("AmazonClientSuite tests not enabled")
	}
	s.srv.SetUp(c)
	s.elb = elb.New(s.srv.auth, aws.USEast)
	s.ec2 = ec2.New(s.srv.auth, aws.USEast)
}

func (s *ClientTests) TestCreateAndDeleteLoadBalancer(c *C) {
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
	c.Assert(err, IsNil)
	defer s.elb.DeleteLoadBalancer(createLBReq.Name)
	c.Assert(resp.DNSName, Not(Equals), "")
	deleteResp, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
	c.Assert(err, IsNil)
	c.Assert(deleteResp.RequestId, Not(Equals), "")
}

func (s *ClientTests) TestCreateLoadBalancerError(c *C) {
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
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	e, ok := err.(*elb.Error)
	c.Assert(ok, Equals, true)
	c.Assert(e.Message, Matches, "Only one of .* or .* may be specified")
	c.Assert(e.Code, Equals, "ValidationError")
}

func (s *ClientTests) createInstanceAndLB(c *C) (*elb.CreateLoadBalancer, string) {
	options := ec2.RunInstancesOptions{
		ImageId:          "ami-ccf405a5",
		InstanceType:     "t1.micro",
		AvailabilityZone: "us-east-1c",
	}
	resp1, err := s.ec2.RunInstances(&options)
	c.Assert(err, IsNil)
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
	c.Assert(err, IsNil)
	return &createLBReq, instId
}

// Cost: 0.02 USD
func (s *ClientTests) TestCreateRegisterAndDeregisterInstanceWithLoadBalancer(c *C) {
	createLBReq, instId := s.createInstanceAndLB(c)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
		_, err = s.ec2.TerminateInstances([]string{instId})
		c.Check(err, IsNil)
	}()
	resp, err := s.elb.RegisterInstancesWithLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, IsNil)
	c.Assert(resp.InstanceIds, DeepEquals, []string{instId})
	resp2, err := s.elb.DeregisterInstancesFromLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, IsNil)
	c.Assert(resp2, Not(Equals), "")
}

func (s *ClientTests) TestDescribeLoadBalancers(c *C) {
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
	c.Assert(err, IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
	}()
	resp, err := s.elb.DescribeLoadBalancers()
	c.Assert(err, IsNil)
	c.Assert(len(resp.LoadBalancerDescriptions) > 0, Equals, true)
	c.Assert(resp.LoadBalancerDescriptions[0].AvailabilityZones, DeepEquals, []string{"us-east-1a"})
	c.Assert(resp.LoadBalancerDescriptions[0].LoadBalancerName, Equals, "testlb")
	c.Assert(resp.LoadBalancerDescriptions[0].Scheme, Equals, "internet-facing")
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "TCP:80",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	c.Assert(resp.LoadBalancerDescriptions[0].HealthCheck, DeepEquals, hc)
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
	c.Assert(resp.LoadBalancerDescriptions[0].ListenerDescriptions, DeepEquals, ld)
	ssg := elb.SourceSecurityGroup{
		GroupName:  "amazon-elb-sg",
		OwnerAlias: "amazon-elb",
	}
	c.Assert(resp.LoadBalancerDescriptions[0].SourceSecurityGroup, DeepEquals, ssg)
}

func (s *ClientTests) TestDescribeLoadBalancersBadRequest(c *C) {
	resp, err := s.elb.DescribeLoadBalancers("absentlb")
	c.Assert(err, NotNil)
	c.Assert(resp, IsNil)
	c.Assert(err, ErrorMatches, ".*(LoadBalancerNotFound).*")
}

func (s *ClientTests) TestDescribeInstanceHealth(c *C) {
	createLBReq, instId := s.createInstanceAndLB(c)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
		_, err = s.ec2.TerminateInstances([]string{instId})
		c.Check(err, IsNil)
	}()
	_, err := s.elb.RegisterInstancesWithLoadBalancer([]string{instId}, createLBReq.Name)
	c.Assert(err, IsNil)
	resp, err := s.elb.DescribeInstanceHealth(createLBReq.Name, instId)
	c.Assert(err, IsNil)
	c.Assert(len(resp.InstanceStates) > 0, Equals, true)
	c.Assert(resp.InstanceStates[0].Description, Equals, "Instance is in pending state.")
	c.Assert(resp.InstanceStates[0].InstanceId, Equals, instId)
	c.Assert(resp.InstanceStates[0].State, Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, Equals, "Instance")
}

func (s *ClientTests) TestDescribeInstanceHealthBadRequest(c *C) {
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
	c.Assert(err, IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
	}()
	resp, err := s.elb.DescribeInstanceHealth(createLBReq.Name, "i-foo")
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	c.Assert(err, ErrorMatches, ".*i-foo.*(InvalidInstance).*")
}

func (s *ClientTests) TestConfigureHealthCheck(c *C) {
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
	c.Assert(err, IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
	}()
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80/",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck(createLBReq.Name, &hc)
	c.Assert(err, IsNil)
	c.Assert(resp.HealthCheck.HealthyThreshold, Equals, 10)
	c.Assert(resp.HealthCheck.Interval, Equals, 30)
	c.Assert(resp.HealthCheck.Target, Equals, "HTTP:80/")
	c.Assert(resp.HealthCheck.Timeout, Equals, 5)
	c.Assert(resp.HealthCheck.UnhealthyThreshold, Equals, 2)
}

func (s *ClientTests) TestConfigureHealthCheckBadRequest(c *C) {
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
	c.Assert(err, IsNil)
	defer func() {
		_, err := s.elb.DeleteLoadBalancer(createLBReq.Name)
		c.Check(err, IsNil)
	}()
	hc := elb.HealthCheck{
		HealthyThreshold:   10,
		Interval:           30,
		Target:             "HTTP:80",
		Timeout:            5,
		UnhealthyThreshold: 2,
	}
	resp, err := s.elb.ConfigureHealthCheck(createLBReq.Name, &hc)
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	expected := "HealthCheck HTTP Target must specify a port followed by a path that begins with a slash. e.g. HTTP:80/ping/this/path (ValidationError)"
	c.Assert(err.Error(), Equals, expected)
}
