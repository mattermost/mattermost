package ec2_test

import (
	"crypto/rand"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/ec2"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
)

// AmazonServer represents an Amazon EC2 server.
type AmazonServer struct {
	auth aws.Auth
}

func (s *AmazonServer) SetUp(c *check.C) {
	auth, err := aws.EnvAuth()
	if err != nil {
		c.Fatal(err.Error())
	}
	s.auth = auth
}

// Suite cost per run: 0.02 USD
var _ = check.Suite(&AmazonClientSuite{})

// AmazonClientSuite tests the client against a live EC2 server.
type AmazonClientSuite struct {
	srv AmazonServer
	ClientTests
}

func (s *AmazonClientSuite) SetUpSuite(c *check.C) {
	if !testutil.Amazon {
		c.Skip("AmazonClientSuite tests not enabled")
	}
	s.srv.SetUp(c)
	s.ec2 = ec2.New(s.srv.auth, aws.USEast)
}

// ClientTests defines integration tests designed to test the client.
// It is not used as a test suite in itself, but embedded within
// another type.
type ClientTests struct {
	ec2 *ec2.EC2
}

var imageId = "ami-ccf405a5" // Ubuntu Maverick, i386, EBS store

// Cost: 0.00 USD
func (s *ClientTests) TestRunInstancesError(c *check.C) {
	options := ec2.RunInstancesOptions{
		ImageId:      "ami-a6f504cf", // Ubuntu Maverick, i386, instance store
		InstanceType: "t1.micro",     // Doesn't work with micro, results in 400.
	}

	resp, err := s.ec2.RunInstances(&options)

	c.Assert(resp, check.IsNil)
	c.Assert(err, check.ErrorMatches, "AMI.*root device.*not supported.*")

	ec2err, ok := err.(*ec2.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(ec2err.StatusCode, check.Equals, 400)
	c.Assert(ec2err.Code, check.Equals, "UnsupportedOperation")
	c.Assert(ec2err.Message, check.Matches, "AMI.*root device.*not supported.*")
	c.Assert(ec2err.RequestId, check.Matches, ".+")
}

// Cost: 0.02 USD
func (s *ClientTests) TestRunAndTerminate(c *check.C) {
	options := ec2.RunInstancesOptions{
		ImageId:      imageId,
		InstanceType: "t1.micro",
	}
	resp1, err := s.ec2.RunInstances(&options)
	c.Assert(err, check.IsNil)
	c.Check(resp1.ReservationId, check.Matches, "r-[0-9a-f]*")
	c.Check(resp1.OwnerId, check.Matches, "[0-9]+")
	c.Check(resp1.Instances, check.HasLen, 1)
	c.Check(resp1.Instances[0].InstanceType, check.Equals, "t1.micro")

	instId := resp1.Instances[0].InstanceId

	resp2, err := s.ec2.DescribeInstances([]string{instId}, nil)
	c.Assert(err, check.IsNil)
	if c.Check(resp2.Reservations, check.HasLen, 1) && c.Check(len(resp2.Reservations[0].Instances), check.Equals, 1) {
		inst := resp2.Reservations[0].Instances[0]
		c.Check(inst.InstanceId, check.Equals, instId)
	}

	resp3, err := s.ec2.TerminateInstances([]string{instId})
	c.Assert(err, check.IsNil)
	c.Check(resp3.StateChanges, check.HasLen, 1)
	c.Check(resp3.StateChanges[0].InstanceId, check.Equals, instId)
	c.Check(resp3.StateChanges[0].CurrentState.Name, check.Equals, "shutting-down")
	c.Check(resp3.StateChanges[0].CurrentState.Code, check.Equals, 32)
}

// Cost: 0.00 USD
func (s *ClientTests) TestSecurityGroups(c *check.C) {
	name := "goamz-test"
	descr := "goamz security group for tests"

	// Clean it up, if a previous test left it around and avoid leaving it around.
	s.ec2.DeleteSecurityGroup(ec2.SecurityGroup{Name: name})
	defer s.ec2.DeleteSecurityGroup(ec2.SecurityGroup{Name: name})

	resp1, err := s.ec2.CreateSecurityGroup(name, descr)
	c.Assert(err, check.IsNil)
	c.Assert(resp1.RequestId, check.Matches, ".+")
	c.Assert(resp1.Name, check.Equals, name)
	c.Assert(resp1.Id, check.Matches, ".+")

	resp1, err = s.ec2.CreateSecurityGroup(name, descr)
	ec2err, _ := err.(*ec2.Error)
	c.Assert(resp1, check.IsNil)
	c.Assert(ec2err, check.NotNil)
	c.Assert(ec2err.Code, check.Equals, "InvalidGroup.Duplicate")

	perms := []ec2.IPPerm{{
		Protocol:  "tcp",
		FromPort:  0,
		ToPort:    1024,
		SourceIPs: []string{"127.0.0.1/24"},
	}}

	resp2, err := s.ec2.AuthorizeSecurityGroup(ec2.SecurityGroup{Name: name}, perms)
	c.Assert(err, check.IsNil)
	c.Assert(resp2.RequestId, check.Matches, ".+")

	resp3, err := s.ec2.SecurityGroups(ec2.SecurityGroupNames(name), nil)
	c.Assert(err, check.IsNil)
	c.Assert(resp3.RequestId, check.Matches, ".+")
	c.Assert(resp3.Groups, check.HasLen, 1)

	g0 := resp3.Groups[0]
	c.Assert(g0.Name, check.Equals, name)
	c.Assert(g0.Description, check.Equals, descr)
	c.Assert(g0.IPPerms, check.HasLen, 1)
	c.Assert(g0.IPPerms[0].Protocol, check.Equals, "tcp")
	c.Assert(g0.IPPerms[0].FromPort, check.Equals, 0)
	c.Assert(g0.IPPerms[0].ToPort, check.Equals, 1024)
	c.Assert(g0.IPPerms[0].SourceIPs, check.DeepEquals, []string{"127.0.0.1/24"})

	resp2, err = s.ec2.DeleteSecurityGroup(ec2.SecurityGroup{Name: name})
	c.Assert(err, check.IsNil)
	c.Assert(resp2.RequestId, check.Matches, ".+")
}

var sessionId = func() string {
	buf := make([]byte, 8)
	// if we have no randomness, we'll just make do, so ignore the error.
	rand.Read(buf)
	return fmt.Sprintf("%x", buf)
}()

// sessionName reutrns a name that is probably
// unique to this test session.
func sessionName(prefix string) string {
	return prefix + "-" + sessionId
}

var allRegions = []aws.Region{
	aws.USEast,
	aws.USWest,
	aws.EUWest,
	aws.APSoutheast,
	aws.APNortheast,
}

// Communicate with all EC2 endpoints to see if they are alive.
func (s *ClientTests) TestRegions(c *check.C) {
	name := sessionName("goamz-region-test")
	perms := []ec2.IPPerm{{
		Protocol:  "tcp",
		FromPort:  80,
		ToPort:    80,
		SourceIPs: []string{"127.0.0.1/32"},
	}}
	errs := make(chan error, len(allRegions))
	for _, region := range allRegions {
		go func(r aws.Region) {
			e := ec2.New(s.ec2.Auth, r)
			_, err := e.AuthorizeSecurityGroup(ec2.SecurityGroup{Name: name}, perms)
			errs <- err
		}(region)
	}
	for _ = range allRegions {
		err := <-errs
		if err != nil {
			ec2_err, ok := err.(*ec2.Error)
			if ok {
				c.Check(ec2_err.Code, check.Matches, "InvalidGroup.NotFound")
			} else {
				c.Errorf("Non-EC2 error: %s", err)
			}
		} else {
			c.Errorf("Test should have errored but it seems to have succeeded")
		}
	}
}
