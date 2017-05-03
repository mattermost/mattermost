package rds_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/rds"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	rds *rds.RDS
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	var err error
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.rds, err = rds.New(auth, aws.Region{RDSEndpoint: aws.ServiceInfo{testServer.URL, aws.V2Signature}})
	c.Assert(err, check.IsNil)
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestDescribeDBInstancesExample1(c *check.C) {
	testServer.Response(200, nil, DescribeDBInstancesExample1)

	resp, err := s.rds.DescribeDBInstances("simcoprod01", 0, "")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeDBInstances"})
	c.Assert(req.Form["DBInstanceIdentifier"], check.DeepEquals, []string{"simcoprod01"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "9135fff3-8509-11e0-bd9b-a7b1ece36d51")
	c.Assert(resp.DBInstances, check.HasLen, 1)

	db0 := resp.DBInstances[0]
	c.Assert(db0.AllocatedStorage, check.Equals, 10)
	c.Assert(db0.AutoMinorVersionUpgrade, check.Equals, true)
	c.Assert(db0.AvailabilityZone, check.Equals, "us-east-1a")
	c.Assert(db0.BackupRetentionPeriod, check.Equals, 1)

	c.Assert(db0.DBInstanceClass, check.Equals, "db.m1.large")
	c.Assert(db0.DBInstanceIdentifier, check.Equals, "simcoprod01")
	c.Assert(db0.DBInstanceStatus, check.Equals, "available")
	c.Assert(db0.DBName, check.Equals, "simcoprod")

	c.Assert(db0.Endpoint.Address, check.Equals, "simcoprod01.cu7u2t4uz396.us-east-1.rds.amazonaws.com")
	c.Assert(db0.Endpoint.Port, check.Equals, 3306)
	c.Assert(db0.Engine, check.Equals, "mysql")
	c.Assert(db0.EngineVersion, check.Equals, "5.1.50")
	c.Assert(db0.InstanceCreateTime, check.Equals, "2011-05-23T06:06:43.110Z")

	c.Assert(db0.LatestRestorableTime, check.Equals, "2011-05-23T06:50:00Z")
	c.Assert(db0.LicenseModel, check.Equals, "general-public-license")
	c.Assert(db0.MasterUsername, check.Equals, "master")
	c.Assert(db0.MultiAZ, check.Equals, false)
	c.Assert(db0.OptionGroupMemberships, check.HasLen, 1)
	c.Assert(db0.OptionGroupMemberships[0].Name, check.Equals, "default.mysql5.1")
	c.Assert(db0.OptionGroupMemberships[0].Status, check.Equals, "in-sync")

	c.Assert(db0.PreferredBackupWindow, check.Equals, "00:00-00:30")
	c.Assert(db0.PreferredMaintenanceWindow, check.Equals, "sat:07:30-sat:08:00")
	c.Assert(db0.PubliclyAccessible, check.Equals, false)
}
