package elb_test

import (
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/elb"
	"github.com/goamz/goamz/elb/elbtest"
	. "gopkg.in/check.v1"
)

// LocalServer represents a local elbtest fake server.
type LocalServer struct {
	auth   aws.Auth
	region aws.Region
	srv    *elbtest.Server
}

func (s *LocalServer) SetUp(c *C) {
	srv, err := elbtest.NewServer()
	c.Assert(err, IsNil)
	c.Assert(srv, NotNil)
	s.srv = srv
	s.region = aws.Region{ELBEndpoint: srv.URL()}
}

// LocalServerSuite defines tests that will run
// against the local elbtest server. It includes
// selected tests from ClientTests;
// when the elbtest functionality is sufficient, it should
// include all of them, and ClientTests can be simply embedded.
type LocalServerSuite struct {
	srv LocalServer
	ServerTests
	clientTests ClientTests
}

// ServerTests defines a set of tests designed to test
// the elbtest local fake elb server.
// It is not used as a test suite in itself, but embedded within
// another type.
type ServerTests struct {
	elb *elb.ELB
}

// AmazonServerSuite runs the elbtest server tests against a live ELB server.
// It will only be activated if the -all flag is specified.
type AmazonServerSuite struct {
	srv AmazonServer
	ServerTests
}

var _ = Suite(&AmazonServerSuite{})

func (s *AmazonServerSuite) SetUpSuite(c *C) {
	if !*amazon {
		c.Skip("AmazonServerSuite tests not enabled")
	}
	s.srv.SetUp(c)
	s.ServerTests.elb = elb.New(s.srv.auth, aws.USEast)
}

var _ = Suite(&LocalServerSuite{})

func (s *LocalServerSuite) SetUpSuite(c *C) {
	s.srv.SetUp(c)
	s.ServerTests.elb = elb.New(s.srv.auth, s.srv.region)
	s.clientTests.elb = elb.New(s.srv.auth, s.srv.region)
}

func (s *LocalServerSuite) TestCreateLoadBalancer(c *C) {
	s.clientTests.TestCreateAndDeleteLoadBalancer(c)
}

func (s *LocalServerSuite) TestCreateLoadBalancerError(c *C) {
	s.clientTests.TestCreateLoadBalancerError(c)
}

func (s *LocalServerSuite) TestDescribeLoadBalancer(c *C) {
	s.clientTests.TestDescribeLoadBalancers(c)
}

func (s *LocalServerSuite) TestDescribeLoadBalancerListsAddedByNewLoadbalancerFunc(c *C) {
	srv := s.srv.srv
	srv.NewLoadBalancer("wierdlb")
	defer srv.RemoveLoadBalancer("wierdlb")
	resp, err := s.clientTests.elb.DescribeLoadBalancers()
	c.Assert(err, IsNil)
	isPresent := false
	for _, desc := range resp.LoadBalancerDescriptions {
		if desc.LoadBalancerName == "wierdlb" {
			isPresent = true
		}
	}
	c.Assert(isPresent, Equals, true)
}

func (s *LocalServerSuite) TestDescribeLoadBalancerListsInstancesAddedByRegisterInstancesFunc(c *C) {
	srv := s.srv.srv
	lbName := "somelb"
	srv.NewLoadBalancer(lbName)
	defer srv.RemoveLoadBalancer(lbName)
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.RegisterInstance(instId, lbName) // no need to deregister, since we're removing the lb
	resp, err := s.clientTests.elb.DescribeLoadBalancers()
	c.Assert(err, IsNil)
	c.Assert(len(resp.LoadBalancerDescriptions) > 0, Equals, true)
	c.Assert(len(resp.LoadBalancerDescriptions[0].Instances) > 0, Equals, true)
	c.Assert(resp.LoadBalancerDescriptions[0].Instances, DeepEquals, []elb.Instance{{InstanceId: instId}})
	srv.DeregisterInstance(instId, lbName)
	resp, err = s.clientTests.elb.DescribeLoadBalancers()
	c.Assert(err, IsNil)
	c.Assert(resp.LoadBalancerDescriptions[0].Instances, DeepEquals, []elb.Instance(nil))
}

func (s *LocalServerSuite) TestDescribeLoadBalancersBadRequest(c *C) {
	s.clientTests.TestDescribeLoadBalancersBadRequest(c)
}

func (s *LocalServerSuite) TestRegisterInstanceWithLoadBalancer(c *C) {
	srv := s.srv.srv
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	resp, err := s.clientTests.elb.RegisterInstancesWithLoadBalancer([]string{instId}, "testlb")
	c.Assert(err, IsNil)
	c.Assert(resp.InstanceIds, DeepEquals, []string{instId})
}

func (s *LocalServerSuite) TestRegisterInstanceWithLoadBalancerWithAbsentInstance(c *C) {
	srv := s.srv.srv
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	resp, err := s.clientTests.elb.RegisterInstancesWithLoadBalancer([]string{"i-212"}, "testlb")
	c.Assert(err, NotNil)
	c.Assert(err, ErrorMatches, `^InvalidInstance found in \[i-212\]. Invalid id: "i-212" \(InvalidInstance\)$`)
	c.Assert(resp, IsNil)
}

func (s *LocalServerSuite) TestRegisterInstanceWithLoadBalancerWithAbsentLoadBalancer(c *C) {
	// the verification if the lb exists is done before the instances, so there is no need to create
	// fixture instances for this test, it'll never get that far
	resp, err := s.clientTests.elb.RegisterInstancesWithLoadBalancer([]string{"i-212"}, "absentlb")
	c.Assert(err, NotNil)
	c.Assert(err, ErrorMatches, `^There is no ACTIVE Load Balancer named 'absentlb' \(LoadBalancerNotFound\)$`)
	c.Assert(resp, IsNil)
}

func (s *LocalServerSuite) TestDeregisterInstanceWithLoadBalancer(c *C) {
	// there is no need to register the instance first, amazon returns the same response
	// in both cases (instance registered or not)
	srv := s.srv.srv
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	resp, err := s.clientTests.elb.DeregisterInstancesFromLoadBalancer([]string{instId}, "testlb")
	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Not(Equals), "")
}

func (s *LocalServerSuite) TestDeregisterInstanceWithLoadBalancerWithAbsentLoadBalancer(c *C) {
	resp, err := s.clientTests.elb.DeregisterInstancesFromLoadBalancer([]string{"i-212"}, "absentlb")
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	c.Assert(err, ErrorMatches, `^There is no ACTIVE Load Balancer named 'absentlb' \(LoadBalancerNotFound\)$`)
}

func (s *LocalServerSuite) TestDeregisterInstancewithLoadBalancerWithAbsentInstance(c *C) {
	srv := s.srv.srv
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	resp, err := s.clientTests.elb.DeregisterInstancesFromLoadBalancer([]string{"i-212"}, "testlb")
	c.Assert(resp, IsNil)
	c.Assert(err, NotNil)
	c.Assert(err, ErrorMatches, `^InvalidInstance found in \[i-212\]. Invalid id: "i-212" \(InvalidInstance\)$`)
}

func (s *LocalServerSuite) TestDescribeInstanceHealth(c *C) {
	srv := s.srv.srv
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	resp, err := s.clientTests.elb.DescribeInstanceHealth("testlb", instId)
	c.Assert(err, IsNil)
	c.Assert(len(resp.InstanceStates) > 0, Equals, true)
	c.Assert(resp.InstanceStates[0].Description, Equals, "Instance is in pending state.")
	c.Assert(resp.InstanceStates[0].InstanceId, Equals, instId)
	c.Assert(resp.InstanceStates[0].State, Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, Equals, "Instance")
}

func (s *LocalServerSuite) TestDescribeInstanceHealthBadRequest(c *C) {
	s.clientTests.TestDescribeInstanceHealthBadRequest(c)
}

func (s *LocalServerSuite) TestDescribeInstanceHealthWithoutSpecifyingInstances(c *C) {
	srv := s.srv.srv
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.NewLoadBalancer("testlb")
	defer srv.RemoveLoadBalancer("testlb")
	srv.RegisterInstance(instId, "testlb")
	resp, err := s.clientTests.elb.DescribeInstanceHealth("testlb")
	c.Assert(err, IsNil)
	c.Assert(len(resp.InstanceStates) > 0, Equals, true)
	c.Assert(resp.InstanceStates[0].Description, Equals, "Instance is in pending state.")
	c.Assert(resp.InstanceStates[0].InstanceId, Equals, instId)
	c.Assert(resp.InstanceStates[0].State, Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, Equals, "Instance")
}

func (s *LocalServerSuite) TestDescribeInstanceHealthChangingIt(c *C) {
	srv := s.srv.srv
	instId := srv.NewInstance()
	defer srv.RemoveInstance(instId)
	srv.NewLoadBalancer("somelb")
	defer srv.RemoveLoadBalancer("somelb")
	srv.RegisterInstance(instId, "somelb")
	state := elb.InstanceState{
		Description: "Instance has failed at least the UnhealthyThreshold number of health checks consecutively",
		InstanceId:  instId,
		State:       "OutOfService",
		ReasonCode:  "Instance",
	}
	srv.ChangeInstanceState("somelb", state)
	resp, err := s.clientTests.elb.DescribeInstanceHealth("somelb")
	c.Assert(err, IsNil)
	c.Assert(len(resp.InstanceStates) > 0, Equals, true)
	c.Assert(resp.InstanceStates[0].Description, Equals, "Instance has failed at least the UnhealthyThreshold number of health checks consecutively")
	c.Assert(resp.InstanceStates[0].InstanceId, Equals, instId)
	c.Assert(resp.InstanceStates[0].State, Equals, "OutOfService")
	c.Assert(resp.InstanceStates[0].ReasonCode, Equals, "Instance")
}

func (s *LocalServerSuite) TestConfigureHealthCheck(c *C) {
	s.clientTests.TestConfigureHealthCheck(c)
}

func (s *LocalServerSuite) TestConfigureHealthCheckBadRequest(c *C) {
	s.clientTests.TestConfigureHealthCheckBadRequest(c)
}
