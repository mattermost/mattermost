package rds_test

import (
	"testing"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/rds"
	"github.com/goamz/goamz/testutil"
	. "gopkg.in/check.v1"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	rds *rds.RDS
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *C) {
	var err error
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.rds, err = rds.New(auth, aws.Region{RDSEndpoint: aws.ServiceInfo{testServer.URL, aws.V2Signature}})
	c.Assert(err, IsNil)
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func (s *S) TestDescribeDBInstancesExample1(c *C) {
	testServer.Response(200, nil, DescribeDBInstancesExample1)

	resp, err := s.rds.DescribeDBInstances("simcoprod01", 0, "")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"DescribeDBInstances"})
	c.Assert(req.Form["DBInstanceIdentifier"], DeepEquals, []string{"simcoprod01"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "9135fff3-8509-11e0-bd9b-a7b1ece36d51")
	c.Assert(resp.DBInstances, HasLen, 1)

	db0 := resp.DBInstances[0]
	c.Assert(db0.AllocatedStorage, Equals, 10)
	c.Assert(db0.AutoMinorVersionUpgrade, Equals, true)
	c.Assert(db0.AvailabilityZone, Equals, "us-east-1a")
	c.Assert(db0.BackupRetentionPeriod, Equals, 1)

	c.Assert(db0.DBInstanceClass, Equals, "db.m1.large")
	c.Assert(db0.DBInstanceIdentifier, Equals, "simcoprod01")
	c.Assert(db0.DBInstanceStatus, Equals, "available")
	c.Assert(db0.DBName, Equals, "simcoprod")

	c.Assert(db0.Endpoint.Address, Equals, "simcoprod01.cu7u2t4uz396.us-east-1.rds.amazonaws.com")
	c.Assert(db0.Endpoint.Port, Equals, 3306)
	c.Assert(db0.Engine, Equals, "mysql")
	c.Assert(db0.EngineVersion, Equals, "5.1.50")
	c.Assert(db0.InstanceCreateTime, Equals, "2011-05-23T06:06:43.110Z")

	c.Assert(db0.LatestRestorableTime, Equals, "2011-05-23T06:50:00Z")
	c.Assert(db0.LicenseModel, Equals, "general-public-license")
	c.Assert(db0.MasterUsername, Equals, "master")
	c.Assert(db0.MultiAZ, Equals, false)
	c.Assert(db0.OptionGroupMemberships, HasLen, 1)
	c.Assert(db0.OptionGroupMemberships[0].Name, Equals, "default.mysql5.1")
	c.Assert(db0.OptionGroupMemberships[0].Status, Equals, "in-sync")

	c.Assert(db0.PreferredBackupWindow, Equals, "00:00-00:30")
	c.Assert(db0.PreferredMaintenanceWindow, Equals, "sat:07:30-sat:08:00")
	c.Assert(db0.PubliclyAccessible, Equals, false)
}
