package ec2_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/ec2"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	ec2 *ec2.EC2
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.ec2 = ec2.New(auth, aws.Region{EC2Endpoint: aws.ServiceInfo{Endpoint: testServer.URL, Signer: aws.V2Signature}})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestRunInstancesErrorDump(c *check.C) {
	testServer.Response(400, nil, ErrorDump)

	options := ec2.RunInstancesOptions{
		ImageId:      "ami-a6f504cf", // Ubuntu Maverick, i386, instance store
		InstanceType: "t1.micro",     // Doesn't work with micro, results in 400.
	}

	msg := `AMIs with an instance-store root device are not supported for the instance type 't1\.micro'\.`

	resp, err := s.ec2.RunInstances(&options)

	testServer.WaitRequest()

	c.Assert(resp, check.IsNil)
	c.Assert(err, check.ErrorMatches, msg+` \(UnsupportedOperation\)`)

	ec2err, ok := err.(*ec2.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(ec2err.StatusCode, check.Equals, 400)
	c.Assert(ec2err.Code, check.Equals, "UnsupportedOperation")
	c.Assert(ec2err.Message, check.Matches, msg)
	c.Assert(ec2err.RequestId, check.Equals, "0503f4e9-bbd6-483c-b54f-c4ae9f3b30f4")
}

func (s *S) TestRunInstancesErrorWithoutXML(c *check.C) {
	testServer.Response(500, nil, "")
	options := ec2.RunInstancesOptions{ImageId: "image-id"}

	resp, err := s.ec2.RunInstances(&options)

	testServer.WaitRequest()

	c.Assert(resp, check.IsNil)
	c.Assert(err, check.ErrorMatches, "500 Internal Server Error")

	ec2err, ok := err.(*ec2.Error)
	c.Assert(ok, check.Equals, true)
	c.Assert(ec2err.StatusCode, check.Equals, 500)
	c.Assert(ec2err.Code, check.Equals, "")
	c.Assert(ec2err.Message, check.Equals, "500 Internal Server Error")
	c.Assert(ec2err.RequestId, check.Equals, "")
}

func (s *S) TestRunInstancesExample(c *check.C) {
	testServer.Response(200, nil, RunInstancesExample)

	options := ec2.RunInstancesOptions{
		KeyName:               "my-keys",
		ImageId:               "image-id",
		InstanceType:          "inst-type",
		SecurityGroups:        []ec2.SecurityGroup{{Name: "g1"}, {Id: "g2"}, {Name: "g3"}, {Id: "g4"}},
		UserData:              []byte("1234"),
		KernelId:              "kernel-id",
		RamdiskId:             "ramdisk-id",
		AvailabilityZone:      "zone",
		PlacementGroupName:    "group",
		Monitoring:            true,
		SubnetId:              "subnet-id",
		DisableAPITermination: true,
		ShutdownBehavior:      "terminate",
		PrivateIPAddress:      "10.0.0.25",
	}
	resp, err := s.ec2.RunInstances(&options)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"RunInstances"})
	c.Assert(req.Form["ImageId"], check.DeepEquals, []string{"image-id"})
	c.Assert(req.Form["MinCount"], check.DeepEquals, []string{"1"})
	c.Assert(req.Form["MaxCount"], check.DeepEquals, []string{"1"})
	c.Assert(req.Form["KeyName"], check.DeepEquals, []string{"my-keys"})
	c.Assert(req.Form["InstanceType"], check.DeepEquals, []string{"inst-type"})
	c.Assert(req.Form["SecurityGroup.1"], check.DeepEquals, []string{"g1"})
	c.Assert(req.Form["SecurityGroup.2"], check.DeepEquals, []string{"g3"})
	c.Assert(req.Form["SecurityGroupId.1"], check.DeepEquals, []string{"g2"})
	c.Assert(req.Form["SecurityGroupId.2"], check.DeepEquals, []string{"g4"})
	c.Assert(req.Form["UserData"], check.DeepEquals, []string{"MTIzNA=="})
	c.Assert(req.Form["KernelId"], check.DeepEquals, []string{"kernel-id"})
	c.Assert(req.Form["RamdiskId"], check.DeepEquals, []string{"ramdisk-id"})
	c.Assert(req.Form["Placement.AvailabilityZone"], check.DeepEquals, []string{"zone"})
	c.Assert(req.Form["Placement.GroupName"], check.DeepEquals, []string{"group"})
	c.Assert(req.Form["Monitoring.Enabled"], check.DeepEquals, []string{"true"})
	c.Assert(req.Form["SubnetId"], check.DeepEquals, []string{"subnet-id"})
	c.Assert(req.Form["DisableApiTermination"], check.DeepEquals, []string{"true"})
	c.Assert(req.Form["InstanceInitiatedShutdownBehavior"], check.DeepEquals, []string{"terminate"})
	c.Assert(req.Form["PrivateIpAddress"], check.DeepEquals, []string{"10.0.0.25"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.ReservationId, check.Equals, "r-47a5402e")
	c.Assert(resp.OwnerId, check.Equals, "999988887777")
	c.Assert(resp.SecurityGroups, check.DeepEquals, []ec2.SecurityGroup{{Name: "default", Id: "sg-67ad940e"}})
	c.Assert(resp.Instances, check.HasLen, 3)

	i0 := resp.Instances[0]
	c.Assert(i0.InstanceId, check.Equals, "i-2ba64342")
	c.Assert(i0.InstanceType, check.Equals, "m1.small")
	c.Assert(i0.ImageId, check.Equals, "ami-60a54009")
	c.Assert(i0.Monitoring, check.Equals, "enabled")
	c.Assert(i0.KeyName, check.Equals, "example-key-name")
	c.Assert(i0.AMILaunchIndex, check.Equals, 0)
	c.Assert(i0.VirtualizationType, check.Equals, "paravirtual")
	c.Assert(i0.Hypervisor, check.Equals, "xen")

	i1 := resp.Instances[1]
	c.Assert(i1.InstanceId, check.Equals, "i-2bc64242")
	c.Assert(i1.InstanceType, check.Equals, "m1.small")
	c.Assert(i1.ImageId, check.Equals, "ami-60a54009")
	c.Assert(i1.Monitoring, check.Equals, "enabled")
	c.Assert(i1.KeyName, check.Equals, "example-key-name")
	c.Assert(i1.AMILaunchIndex, check.Equals, 1)
	c.Assert(i1.VirtualizationType, check.Equals, "paravirtual")
	c.Assert(i1.Hypervisor, check.Equals, "xen")

	i2 := resp.Instances[2]
	c.Assert(i2.InstanceId, check.Equals, "i-2be64332")
	c.Assert(i2.InstanceType, check.Equals, "m1.small")
	c.Assert(i2.ImageId, check.Equals, "ami-60a54009")
	c.Assert(i2.Monitoring, check.Equals, "enabled")
	c.Assert(i2.KeyName, check.Equals, "example-key-name")
	c.Assert(i2.AMILaunchIndex, check.Equals, 2)
	c.Assert(i2.VirtualizationType, check.Equals, "paravirtual")
	c.Assert(i2.Hypervisor, check.Equals, "xen")
}

func (s *S) TestTerminateInstancesExample(c *check.C) {
	testServer.Response(200, nil, TerminateInstancesExample)

	resp, err := s.ec2.TerminateInstances([]string{"i-1", "i-2"})

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"TerminateInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-1"})
	c.Assert(req.Form["InstanceId.2"], check.DeepEquals, []string{"i-2"})
	c.Assert(req.Form["UserData"], check.IsNil)
	c.Assert(req.Form["KernelId"], check.IsNil)
	c.Assert(req.Form["RamdiskId"], check.IsNil)
	c.Assert(req.Form["Placement.AvailabilityZone"], check.IsNil)
	c.Assert(req.Form["Placement.GroupName"], check.IsNil)
	c.Assert(req.Form["Monitoring.Enabled"], check.IsNil)
	c.Assert(req.Form["SubnetId"], check.IsNil)
	c.Assert(req.Form["DisableApiTermination"], check.IsNil)
	c.Assert(req.Form["InstanceInitiatedShutdownBehavior"], check.IsNil)
	c.Assert(req.Form["PrivateIpAddress"], check.IsNil)

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.StateChanges, check.HasLen, 1)
	c.Assert(resp.StateChanges[0].InstanceId, check.Equals, "i-3ea74257")
	c.Assert(resp.StateChanges[0].CurrentState.Code, check.Equals, 32)
	c.Assert(resp.StateChanges[0].CurrentState.Name, check.Equals, "shutting-down")
	c.Assert(resp.StateChanges[0].PreviousState.Code, check.Equals, 16)
	c.Assert(resp.StateChanges[0].PreviousState.Name, check.Equals, "running")
}

func (s *S) TestDescribeInstancesExample1(c *check.C) {
	testServer.Response(200, nil, DescribeInstancesExample1)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeInstances([]string{"i-1", "i-2"}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-1"})
	c.Assert(req.Form["InstanceId.2"], check.DeepEquals, []string{"i-2"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "98e3c9a4-848c-4d6d-8e8a-b1bdEXAMPLE")
	c.Assert(resp.Reservations, check.HasLen, 2)

	r0 := resp.Reservations[0]
	c.Assert(r0.ReservationId, check.Equals, "r-b27e30d9")
	c.Assert(r0.OwnerId, check.Equals, "999988887777")
	c.Assert(r0.RequesterId, check.Equals, "854251627541")
	c.Assert(r0.SecurityGroups, check.DeepEquals, []ec2.SecurityGroup{{Name: "default", Id: "sg-67ad940e"}})
	c.Assert(r0.Instances, check.HasLen, 1)

	r0i := r0.Instances[0]
	c.Assert(r0i.InstanceId, check.Equals, "i-c5cd56af")
	c.Assert(r0i.PrivateDNSName, check.Equals, "domU-12-31-39-10-56-34.compute-1.internal")
	c.Assert(r0i.DNSName, check.Equals, "ec2-174-129-165-232.compute-1.amazonaws.com")
	c.Assert(r0i.AvailabilityZone, check.Equals, "us-east-1b")
	c.Assert(r0i.IPAddress, check.Equals, "174.129.165.232")
	c.Assert(r0i.PrivateIPAddress, check.Equals, "10.198.85.190")
}

func (s *S) TestDescribeInstancesExample2(c *check.C) {
	testServer.Response(200, nil, DescribeInstancesExample2)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeInstances([]string{"i-1", "i-2"}, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-1"})
	c.Assert(req.Form["InstanceId.2"], check.DeepEquals, []string{"i-2"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"value1"})
	c.Assert(req.Form["Filter.1.Value.2"], check.IsNil)
	c.Assert(req.Form["Filter.2.Name"], check.DeepEquals, []string{"key2"})
	c.Assert(req.Form["Filter.2.Value.1"], check.DeepEquals, []string{"value2"})
	c.Assert(req.Form["Filter.2.Value.2"], check.DeepEquals, []string{"value3"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Reservations, check.HasLen, 1)

	r0 := resp.Reservations[0]
	r0i := r0.Instances[0]
	c.Assert(r0i.State.Code, check.Equals, 16)
	c.Assert(r0i.State.Name, check.Equals, "running")

	r0t0 := r0i.Tags[0]
	r0t1 := r0i.Tags[1]
	c.Assert(r0t0.Key, check.Equals, "webserver")
	c.Assert(r0t0.Value, check.Equals, "")
	c.Assert(r0t1.Key, check.Equals, "stack")
	c.Assert(r0t1.Value, check.Equals, "Production")
}

func (s *S) TestDescribeAddressesPublicIPExample(c *check.C) {
	testServer.Response(200, nil, DescribeAddressesExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeAddresses([]string{"192.0.2.1", "198.51.100.2", "203.0.113.41"}, []string{}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeAddresses"})
	c.Assert(req.Form["PublicIp.1"], check.DeepEquals, []string{"192.0.2.1"})
	c.Assert(req.Form["PublicIp.2"], check.DeepEquals, []string{"198.51.100.2"})
	c.Assert(req.Form["PublicIp.3"], check.DeepEquals, []string{"203.0.113.41"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Addresses, check.HasLen, 3)

	r0 := resp.Addresses[0]
	c.Assert(r0.PublicIp, check.Equals, "192.0.2.1")
	c.Assert(r0.Domain, check.Equals, "standard")
	c.Assert(r0.InstanceId, check.Equals, "i-f15ebb98")

	r0i := resp.Addresses[1]
	c.Assert(r0i.PublicIp, check.Equals, "198.51.100.2")
	c.Assert(r0i.Domain, check.Equals, "standard")
	c.Assert(r0i.InstanceId, check.Equals, "")

	r0ii := resp.Addresses[2]
	c.Assert(r0ii.PublicIp, check.Equals, "203.0.113.41")
	c.Assert(r0ii.Domain, check.Equals, "vpc")
	c.Assert(r0ii.InstanceId, check.Equals, "i-64600030")
	c.Assert(r0ii.AssociationId, check.Equals, "eipassoc-f0229899")
	c.Assert(r0ii.AllocationId, check.Equals, "eipalloc-08229861")
	c.Assert(r0ii.NetworkInterfaceOwnerId, check.Equals, "053230519467")
	c.Assert(r0ii.NetworkInterfaceId, check.Equals, "eni-ef229886")
	c.Assert(r0ii.PrivateIpAddress, check.Equals, "10.0.0.228")
}

func (s *S) TestDescribeAddressesAllocationIDExample(c *check.C) {
	testServer.Response(200, nil, DescribeAddressesAllocationIdExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeAddresses([]string{}, []string{"eipalloc-08229861", "eipalloc-08364752"}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeAddresses"})
	c.Assert(req.Form["AllocationId.1"], check.DeepEquals, []string{"eipalloc-08229861"})
	c.Assert(req.Form["AllocationId.2"], check.DeepEquals, []string{"eipalloc-08364752"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Addresses, check.HasLen, 2)

	r0 := resp.Addresses[0]
	c.Assert(r0.PublicIp, check.Equals, "203.0.113.41")
	c.Assert(r0.AllocationId, check.Equals, "eipalloc-08229861")
	c.Assert(r0.Domain, check.Equals, "vpc")
	c.Assert(r0.InstanceId, check.Equals, "i-64600030")
	c.Assert(r0.AssociationId, check.Equals, "eipassoc-f0229899")
	c.Assert(r0.NetworkInterfaceId, check.Equals, "eni-ef229886")
	c.Assert(r0.NetworkInterfaceOwnerId, check.Equals, "053230519467")
	c.Assert(r0.PrivateIpAddress, check.Equals, "10.0.0.228")

	r1 := resp.Addresses[1]
	c.Assert(r1.PublicIp, check.Equals, "146.54.2.230")
	c.Assert(r1.AllocationId, check.Equals, "eipalloc-08364752")
	c.Assert(r1.Domain, check.Equals, "vpc")
	c.Assert(r1.InstanceId, check.Equals, "i-64693456")
	c.Assert(r1.AssociationId, check.Equals, "eipassoc-f0348693")
	c.Assert(r1.NetworkInterfaceId, check.Equals, "eni-da764039")
	c.Assert(r1.NetworkInterfaceOwnerId, check.Equals, "053230519467")
	c.Assert(r1.PrivateIpAddress, check.Equals, "10.0.0.102")
}

func (s *S) TestAllocateAddressExample(c *check.C) {
	testServer.Response(200, nil, AllocateAddressExample)

	resp, err := s.ec2.AllocateAddress("vpc")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"AllocateAddress"})
	c.Assert(req.Form["Domain"], check.DeepEquals, []string{"vpc"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.PublicIp, check.Equals, "198.51.100.1")
	c.Assert(resp.Domain, check.Equals, "vpc")
	c.Assert(resp.AllocationId, check.Equals, "eipalloc-5723d13e")
}

func (s *S) TestReleaseAddressExample(c *check.C) {
	testServer.Response(200, nil, ReleaseAddressExample)

	resp, err := s.ec2.ReleaseAddress("192.0.2.1", "")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"ReleaseAddress"})
	c.Assert(req.Form["PublicIp"], check.DeepEquals, []string{"192.0.2.1"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, check.Equals, true)
}

func (s *S) TestAssociateAddressExample(c *check.C) {
	testServer.Response(200, nil, AssociateAddressExample)

	options := ec2.AssociateAddressOptions{
		PublicIp:   "192.0.2.1",
		InstanceId: "i-2ea64347",
	}

	resp, err := s.ec2.AssociateAddress(&options)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"AssociateAddress"})
	c.Assert(req.Form["PublicIp"], check.DeepEquals, []string{"192.0.2.1"})
	c.Assert(req.Form["InstanceId"], check.DeepEquals, []string{"i-2ea64347"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, check.Equals, true)
	c.Assert(resp.AssociationId, check.Equals, "eipassoc-fc5ca095")
}

func (s *S) TestDiassociateAddressExample(c *check.C) {
	testServer.Response(200, nil, DiassociateAddressExample)

	resp, err := s.ec2.DiassociateAddress("192.0.2.1", "")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DiassociateAddress"})
	c.Assert(req.Form["PublicIp"], check.DeepEquals, []string{"192.0.2.1"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, check.Equals, true)
}

func (s *S) TestDescribeImagesExample(c *check.C) {
	testServer.Response(200, nil, DescribeImagesExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.Images([]string{"ami-1", "ami-2"}, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeImages"})
	c.Assert(req.Form["ImageId.1"], check.DeepEquals, []string{"ami-1"})
	c.Assert(req.Form["ImageId.2"], check.DeepEquals, []string{"ami-2"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"value1"})
	c.Assert(req.Form["Filter.1.Value.2"], check.IsNil)
	c.Assert(req.Form["Filter.2.Name"], check.DeepEquals, []string{"key2"})
	c.Assert(req.Form["Filter.2.Value.1"], check.DeepEquals, []string{"value2"})
	c.Assert(req.Form["Filter.2.Value.2"], check.DeepEquals, []string{"value3"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "4a4a27a2-2e7c-475d-b35b-ca822EXAMPLE")
	c.Assert(resp.Images, check.HasLen, 1)

	i0 := resp.Images[0]
	c.Assert(i0.Id, check.Equals, "ami-a2469acf")
	c.Assert(i0.Type, check.Equals, "machine")
	c.Assert(i0.Name, check.Equals, "example-marketplace-amzn-ami.1")
	c.Assert(i0.Description, check.Equals, "Amazon Linux AMI i386 EBS")
	c.Assert(i0.Location, check.Equals, "aws-marketplace/example-marketplace-amzn-ami.1")
	c.Assert(i0.State, check.Equals, "available")
	c.Assert(i0.Public, check.Equals, true)
	c.Assert(i0.OwnerId, check.Equals, "123456789999")
	c.Assert(i0.OwnerAlias, check.Equals, "aws-marketplace")
	c.Assert(i0.Architecture, check.Equals, "i386")
	c.Assert(i0.KernelId, check.Equals, "aki-805ea7e9")
	c.Assert(i0.RootDeviceType, check.Equals, "ebs")
	c.Assert(i0.RootDeviceName, check.Equals, "/dev/sda1")
	c.Assert(i0.VirtualizationType, check.Equals, "paravirtual")
	c.Assert(i0.Hypervisor, check.Equals, "xen")

	c.Assert(i0.Tags, check.HasLen, 1)
	c.Assert(i0.Tags[0].Key, check.Equals, "Purpose")
	c.Assert(i0.Tags[0].Value, check.Equals, "EXAMPLE")

	c.Assert(i0.BlockDevices, check.HasLen, 1)
	c.Assert(i0.BlockDevices[0].DeviceName, check.Equals, "/dev/sda1")
	c.Assert(i0.BlockDevices[0].SnapshotId, check.Equals, "snap-787e9403")
	c.Assert(i0.BlockDevices[0].VolumeSize, check.Equals, int64(8))
	c.Assert(i0.BlockDevices[0].DeleteOnTermination, check.Equals, true)
}

func (s *S) TestCreateSnapshotExample(c *check.C) {
	testServer.Response(200, nil, CreateSnapshotExample)

	resp, err := s.ec2.CreateSnapshot("vol-4d826724", "Daily Backup")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"CreateSnapshot"})
	c.Assert(req.Form["VolumeId"], check.DeepEquals, []string{"vol-4d826724"})
	c.Assert(req.Form["Description"], check.DeepEquals, []string{"Daily Backup"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Snapshot.Id, check.Equals, "snap-78a54011")
	c.Assert(resp.Snapshot.VolumeId, check.Equals, "vol-4d826724")
	c.Assert(resp.Snapshot.Status, check.Equals, "pending")
	c.Assert(resp.Snapshot.StartTime, check.Equals, "2008-05-07T12:51:50.000Z")
	c.Assert(resp.Snapshot.Progress, check.Equals, "60%")
	c.Assert(resp.Snapshot.OwnerId, check.Equals, "111122223333")
	c.Assert(resp.Snapshot.VolumeSize, check.Equals, "10")
	c.Assert(resp.Snapshot.Description, check.Equals, "Daily Backup")
}

func (s *S) TestDeleteSnapshotsExample(c *check.C) {
	testServer.Response(200, nil, DeleteSnapshotExample)

	resp, err := s.ec2.DeleteSnapshots("snap-78a54011")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DeleteSnapshot"})
	c.Assert(req.Form["SnapshotId.1"], check.DeepEquals, []string{"snap-78a54011"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestDescribeSnapshotsExample(c *check.C) {
	testServer.Response(200, nil, DescribeSnapshotsExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.Snapshots([]string{"snap-1", "snap-2"}, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeSnapshots"})
	c.Assert(req.Form["SnapshotId.1"], check.DeepEquals, []string{"snap-1"})
	c.Assert(req.Form["SnapshotId.2"], check.DeepEquals, []string{"snap-2"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"value1"})
	c.Assert(req.Form["Filter.1.Value.2"], check.IsNil)
	c.Assert(req.Form["Filter.2.Name"], check.DeepEquals, []string{"key2"})
	c.Assert(req.Form["Filter.2.Value.1"], check.DeepEquals, []string{"value2"})
	c.Assert(req.Form["Filter.2.Value.2"], check.DeepEquals, []string{"value3"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Snapshots, check.HasLen, 1)

	s0 := resp.Snapshots[0]
	c.Assert(s0.Id, check.Equals, "snap-1a2b3c4d")
	c.Assert(s0.VolumeId, check.Equals, "vol-8875daef")
	c.Assert(s0.VolumeSize, check.Equals, "15")
	c.Assert(s0.Status, check.Equals, "pending")
	c.Assert(s0.StartTime, check.Equals, "2010-07-29T04:12:01.000Z")
	c.Assert(s0.Progress, check.Equals, "30%")
	c.Assert(s0.OwnerId, check.Equals, "111122223333")
	c.Assert(s0.Description, check.Equals, "Daily Backup")

	c.Assert(s0.Tags, check.HasLen, 1)
	c.Assert(s0.Tags[0].Key, check.Equals, "Purpose")
	c.Assert(s0.Tags[0].Value, check.Equals, "demo_db_14_backup")
}

func (s *S) TestDescribeSubnetsExample(c *check.C) {
	testServer.Response(200, nil, DescribeSubnetsExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.Subnets([]string{"subnet-1", "subnet-2"}, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeSubnets"})
	c.Assert(req.Form["SubnetId.1"], check.DeepEquals, []string{"subnet-1"})
	c.Assert(req.Form["SubnetId.2"], check.DeepEquals, []string{"subnet-2"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"value1"})
	c.Assert(req.Form["Filter.1.Value.2"], check.IsNil)
	c.Assert(req.Form["Filter.2.Name"], check.DeepEquals, []string{"key2"})
	c.Assert(req.Form["Filter.2.Value.1"], check.DeepEquals, []string{"value2"})
	c.Assert(req.Form["Filter.2.Value.2"], check.DeepEquals, []string{"value3"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "a5266c3e-2b7a-4434-971e-317b6EXAMPLE")
	c.Assert(resp.Subnets, check.HasLen, 3)

	s0 := resp.Subnets[0]
	c.Assert(s0.Id, check.Equals, "subnet-3e993755")
	c.Assert(s0.State, check.Equals, "available")
	c.Assert(s0.VpcId, check.Equals, "vpc-f84a9b93")
	c.Assert(s0.CidrBlock, check.Equals, "10.0.12.0/24")
	c.Assert(s0.AvailableIpAddressCount, check.Equals, 249)
	c.Assert(s0.AvailabilityZone, check.Equals, "us-west-2c")
	c.Assert(s0.DefaultForAz, check.Equals, false)
	c.Assert(s0.MapPublicIpOnLaunch, check.Equals, false)

	c.Assert(s0.Tags, check.HasLen, 2)
	c.Assert(s0.Tags[0].Key, check.Equals, "visibility")
	c.Assert(s0.Tags[0].Value, check.Equals, "private")
	c.Assert(s0.Tags[1].Key, check.Equals, "Name")
	c.Assert(s0.Tags[1].Value, check.Equals, "application")
}

func (s *S) TestCreateSecurityGroupExample(c *check.C) {
	testServer.Response(200, nil, CreateSecurityGroupExample)

	resp, err := s.ec2.CreateSecurityGroup("websrv", "Web Servers")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"CreateSecurityGroup"})
	c.Assert(req.Form["GroupName"], check.DeepEquals, []string{"websrv"})
	c.Assert(req.Form["GroupDescription"], check.DeepEquals, []string{"Web Servers"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Name, check.Equals, "websrv")
	c.Assert(resp.Id, check.Equals, "sg-67ad940e")
}

func (s *S) TestDescribeSecurityGroupsExample(c *check.C) {
	testServer.Response(200, nil, DescribeSecurityGroupsExample)

	resp, err := s.ec2.SecurityGroups([]ec2.SecurityGroup{{Name: "WebServers"}, {Name: "RangedPortsBySource"}}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeSecurityGroups"})
	c.Assert(req.Form["GroupName.1"], check.DeepEquals, []string{"WebServers"})
	c.Assert(req.Form["GroupName.2"], check.DeepEquals, []string{"RangedPortsBySource"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Groups, check.HasLen, 2)

	g0 := resp.Groups[0]
	c.Assert(g0.OwnerId, check.Equals, "999988887777")
	c.Assert(g0.Name, check.Equals, "WebServers")
	c.Assert(g0.Id, check.Equals, "sg-67ad940e")
	c.Assert(g0.Description, check.Equals, "Web Servers")
	c.Assert(g0.IPPerms, check.HasLen, 1)

	g0ipp := g0.IPPerms[0]
	c.Assert(g0ipp.Protocol, check.Equals, "tcp")
	c.Assert(g0ipp.FromPort, check.Equals, 80)
	c.Assert(g0ipp.ToPort, check.Equals, 80)
	c.Assert(g0ipp.SourceIPs, check.DeepEquals, []string{"0.0.0.0/0"})

	g1 := resp.Groups[1]
	c.Assert(g1.OwnerId, check.Equals, "999988887777")
	c.Assert(g1.Name, check.Equals, "RangedPortsBySource")
	c.Assert(g1.Id, check.Equals, "sg-76abc467")
	c.Assert(g1.Description, check.Equals, "Group A")
	c.Assert(g1.IPPerms, check.HasLen, 1)

	g1ipp := g1.IPPerms[0]
	c.Assert(g1ipp.Protocol, check.Equals, "tcp")
	c.Assert(g1ipp.FromPort, check.Equals, 6000)
	c.Assert(g1ipp.ToPort, check.Equals, 7000)
	c.Assert(g1ipp.SourceIPs, check.IsNil)
}

func (s *S) TestDescribeSecurityGroups(c *check.C) {
	testServer.Response(200, nil, SecurityGroupsVPCExample)

	expected := ec2.SecurityGroupsResp{
		RequestId: "59dbff89-35bd-4eac-99ed-be587EXAMPLE",
		Groups: []ec2.SecurityGroupInfo{
			ec2.SecurityGroupInfo{
				SecurityGroup: ec2.SecurityGroup{
					Id:   "sg-67ad940e",
					Name: "WebServers",
				},
				OwnerId:     "999988887777",
				Description: "Web Servers",
				IPPerms: []ec2.IPPerm{
					ec2.IPPerm{
						Protocol:     "tcp",
						FromPort:     80,
						ToPort:       80,
						SourceIPs:    []string{"0.0.0.0/0"},
						SourceGroups: nil,
					},
				},
				IPPermsEgress: []ec2.IPPerm{
					ec2.IPPerm{
						Protocol:     "tcp",
						FromPort:     22,
						ToPort:       22,
						SourceIPs:    []string{"10.0.0.0/8"},
						SourceGroups: nil,
					},
				},
			},
			ec2.SecurityGroupInfo{
				SecurityGroup: ec2.SecurityGroup{
					Id:   "sg-76abc467",
					Name: "RangedPortsBySource",
				},
				OwnerId:     "999988887777",
				Description: "Group A",
				IPPerms: []ec2.IPPerm{
					ec2.IPPerm{
						Protocol: "tcp",
						FromPort: 6000,
						ToPort:   7000,
					},
				},
				VpcId: "vpc-12345678",
				Tags: []ec2.Tag{
					ec2.Tag{
						Key:   "key",
						Value: "value",
					},
				},
			},
		},
	}

	resp, err := s.ec2.SecurityGroups([]ec2.SecurityGroup{{Name: "WebServers"}, {Name: "RangedPortsBySource"}}, nil)
	values := testServer.WaitRequest().URL.Query()
	c.Assert(values.Get("Action"), check.Equals, "DescribeSecurityGroups")
	c.Assert(values.Get("GroupName.1"), check.Equals, "WebServers")
	c.Assert(values.Get("GroupName.2"), check.Equals, "RangedPortsBySource")

	c.Assert(err, check.IsNil)
	c.Assert(*resp, check.DeepEquals, expected)
}

func (s *S) TestDescribeSecurityGroupsExampleWithFilter(c *check.C) {
	testServer.Response(200, nil, DescribeSecurityGroupsExample)

	filter := ec2.NewFilter()
	filter.Add("ip-permission.protocol", "tcp")
	filter.Add("ip-permission.from-port", "22")
	filter.Add("ip-permission.to-port", "22")
	filter.Add("ip-permission.group-name", "app_server_group", "database_group")

	_, err := s.ec2.SecurityGroups(nil, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeSecurityGroups"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"ip-permission.from-port"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"22"})
	c.Assert(req.Form["Filter.2.Name"], check.DeepEquals, []string{"ip-permission.group-name"})
	c.Assert(req.Form["Filter.2.Value.1"], check.DeepEquals, []string{"app_server_group"})
	c.Assert(req.Form["Filter.2.Value.2"], check.DeepEquals, []string{"database_group"})
	c.Assert(req.Form["Filter.3.Name"], check.DeepEquals, []string{"ip-permission.protocol"})
	c.Assert(req.Form["Filter.3.Value.1"], check.DeepEquals, []string{"tcp"})
	c.Assert(req.Form["Filter.4.Name"], check.DeepEquals, []string{"ip-permission.to-port"})
	c.Assert(req.Form["Filter.4.Value.1"], check.DeepEquals, []string{"22"})

	c.Assert(err, check.IsNil)
}

func (s *S) TestDescribeSecurityGroupsDumpWithGroup(c *check.C) {
	testServer.Response(200, nil, DescribeSecurityGroupsDump)

	resp, err := s.ec2.SecurityGroups(nil, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeSecurityGroups"})
	c.Assert(err, check.IsNil)
	c.Check(resp.Groups, check.HasLen, 1)
	c.Check(resp.Groups[0].IPPerms, check.HasLen, 2)

	ipp0 := resp.Groups[0].IPPerms[0]
	c.Assert(ipp0.SourceIPs, check.IsNil)
	c.Check(ipp0.Protocol, check.Equals, "icmp")
	c.Assert(ipp0.SourceGroups, check.HasLen, 1)
	c.Check(ipp0.SourceGroups[0].OwnerId, check.Equals, "12345")
	c.Check(ipp0.SourceGroups[0].Name, check.Equals, "default")
	c.Check(ipp0.SourceGroups[0].Id, check.Equals, "sg-67ad940e")

	ipp1 := resp.Groups[0].IPPerms[1]
	c.Check(ipp1.Protocol, check.Equals, "tcp")
	c.Assert(ipp0.SourceIPs, check.IsNil)
	c.Assert(ipp0.SourceGroups, check.HasLen, 1)
	c.Check(ipp1.SourceGroups[0].Id, check.Equals, "sg-76abc467")
	c.Check(ipp1.SourceGroups[0].OwnerId, check.Equals, "12345")
	c.Check(ipp1.SourceGroups[0].Name, check.Equals, "other")
}

func (s *S) TestDeleteSecurityGroupExample(c *check.C) {
	testServer.Response(200, nil, DeleteSecurityGroupExample)

	resp, err := s.ec2.DeleteSecurityGroup(ec2.SecurityGroup{Name: "websrv"})
	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DeleteSecurityGroup"})
	c.Assert(req.Form["GroupName"], check.DeepEquals, []string{"websrv"})
	c.Assert(req.Form["GroupId"], check.IsNil)
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestDeleteSecurityGroupExampleWithId(c *check.C) {
	testServer.Response(200, nil, DeleteSecurityGroupExample)

	// ignore return and error - we're only want to check the parameter handling.
	s.ec2.DeleteSecurityGroup(ec2.SecurityGroup{Id: "sg-67ad940e", Name: "ignored"})
	req := testServer.WaitRequest()

	c.Assert(req.Form["GroupName"], check.IsNil)
	c.Assert(req.Form["GroupId"], check.DeepEquals, []string{"sg-67ad940e"})
}

func (s *S) TestAuthorizeSecurityGroupExample1(c *check.C) {
	testServer.Response(200, nil, AuthorizeSecurityGroupIngressExample)

	perms := []ec2.IPPerm{{
		Protocol:  "tcp",
		FromPort:  80,
		ToPort:    80,
		SourceIPs: []string{"205.192.0.0/16", "205.159.0.0/16"},
	}}
	resp, err := s.ec2.AuthorizeSecurityGroup(ec2.SecurityGroup{Name: "websrv"}, perms)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"AuthorizeSecurityGroupIngress"})
	c.Assert(req.Form["GroupName"], check.DeepEquals, []string{"websrv"})
	c.Assert(req.Form["IpPermissions.1.IpProtocol"], check.DeepEquals, []string{"tcp"})
	c.Assert(req.Form["IpPermissions.1.FromPort"], check.DeepEquals, []string{"80"})
	c.Assert(req.Form["IpPermissions.1.ToPort"], check.DeepEquals, []string{"80"})
	c.Assert(req.Form["IpPermissions.1.IpRanges.1.CidrIp"], check.DeepEquals, []string{"205.192.0.0/16"})
	c.Assert(req.Form["IpPermissions.1.IpRanges.2.CidrIp"], check.DeepEquals, []string{"205.159.0.0/16"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestAuthorizeSecurityGroupExample1WithId(c *check.C) {
	testServer.Response(200, nil, AuthorizeSecurityGroupIngressExample)

	perms := []ec2.IPPerm{{
		Protocol:  "tcp",
		FromPort:  80,
		ToPort:    80,
		SourceIPs: []string{"205.192.0.0/16", "205.159.0.0/16"},
	}}
	// ignore return and error - we're only want to check the parameter handling.
	s.ec2.AuthorizeSecurityGroup(ec2.SecurityGroup{Id: "sg-67ad940e", Name: "ignored"}, perms)

	req := testServer.WaitRequest()

	c.Assert(req.Form["GroupName"], check.IsNil)
	c.Assert(req.Form["GroupId"], check.DeepEquals, []string{"sg-67ad940e"})
}

func (s *S) TestAuthorizeSecurityGroupExample2(c *check.C) {
	testServer.Response(200, nil, AuthorizeSecurityGroupIngressExample)

	perms := []ec2.IPPerm{{
		Protocol: "tcp",
		FromPort: 80,
		ToPort:   81,
		SourceGroups: []ec2.UserSecurityGroup{
			{OwnerId: "999988887777", Name: "OtherAccountGroup"},
			{Id: "sg-67ad940e"},
		},
	}}
	resp, err := s.ec2.AuthorizeSecurityGroup(ec2.SecurityGroup{Name: "websrv"}, perms)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"AuthorizeSecurityGroupIngress"})
	c.Assert(req.Form["GroupName"], check.DeepEquals, []string{"websrv"})
	c.Assert(req.Form["IpPermissions.1.IpProtocol"], check.DeepEquals, []string{"tcp"})
	c.Assert(req.Form["IpPermissions.1.FromPort"], check.DeepEquals, []string{"80"})
	c.Assert(req.Form["IpPermissions.1.ToPort"], check.DeepEquals, []string{"81"})
	c.Assert(req.Form["IpPermissions.1.Groups.1.UserId"], check.DeepEquals, []string{"999988887777"})
	c.Assert(req.Form["IpPermissions.1.Groups.1.GroupName"], check.DeepEquals, []string{"OtherAccountGroup"})
	c.Assert(req.Form["IpPermissions.1.Groups.2.UserId"], check.IsNil)
	c.Assert(req.Form["IpPermissions.1.Groups.2.GroupName"], check.IsNil)
	c.Assert(req.Form["IpPermissions.1.Groups.2.GroupId"], check.DeepEquals, []string{"sg-67ad940e"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestRevokeSecurityGroupExample(c *check.C) {
	// RevokeSecurityGroup is implemented by the same code as AuthorizeSecurityGroup
	// so there's no need to duplicate all the tests.
	testServer.Response(200, nil, RevokeSecurityGroupIngressExample)

	resp, err := s.ec2.RevokeSecurityGroup(ec2.SecurityGroup{Name: "websrv"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"RevokeSecurityGroupIngress"})
	c.Assert(req.Form["GroupName"], check.DeepEquals, []string{"websrv"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestCreateTags(c *check.C) {
	testServer.Response(200, nil, CreateTagsExample)

	resp, err := s.ec2.CreateTags([]string{"ami-1a2b3c4d", "i-7f4d3a2b"}, []ec2.Tag{{"webserver", ""}, {"stack", "Production"}})

	req := testServer.WaitRequest()
	c.Assert(req.Form["ResourceId.1"], check.DeepEquals, []string{"ami-1a2b3c4d"})
	c.Assert(req.Form["ResourceId.2"], check.DeepEquals, []string{"i-7f4d3a2b"})
	c.Assert(req.Form["Tag.1.Key"], check.DeepEquals, []string{"webserver"})
	c.Assert(req.Form["Tag.1.Value"], check.DeepEquals, []string{""})
	c.Assert(req.Form["Tag.2.Key"], check.DeepEquals, []string{"stack"})
	c.Assert(req.Form["Tag.2.Value"], check.DeepEquals, []string{"Production"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestDeleteTags(c *check.C) {
	testServer.Response(200, nil, DeleteTagsExample)

	resp, err := s.ec2.DeleteTags([]string{"ami-1a2b3c4d", "i-7f4d3a2b"}, []ec2.Tag{{"webserver", ""}, {"stack", ""}})

	req := testServer.WaitRequest()
	c.Assert(req.Form["ResourceId.1"], check.DeepEquals, []string{"ami-1a2b3c4d"})
	c.Assert(req.Form["ResourceId.2"], check.DeepEquals, []string{"i-7f4d3a2b"})
	c.Assert(req.Form["Tag.1.Key"], check.DeepEquals, []string{"webserver"})
	c.Assert(req.Form["Tag.2.Key"], check.DeepEquals, []string{"stack"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestDescribeTags(c *check.C) {
	testServer.Response(200, nil, DescribeTagsExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")

	resp, err := s.ec2.DescribeTags(filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeTags"})
	c.Assert(req.Form["Filter.1.Name"], check.DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], check.DeepEquals, []string{"value1"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.Tags, check.HasLen, 6)

	r0 := resp.Tags[0]
	c.Assert(r0.Key, check.Equals, "webserver")
	c.Assert(r0.Value, check.Equals, "")
	c.Assert(r0.ResourceId, check.Equals, "ami-1a2b3c4d")
	c.Assert(r0.ResourceType, check.Equals, "image")

	r1 := resp.Tags[1]
	c.Assert(r1.Key, check.Equals, "stack")
	c.Assert(r1.Value, check.Equals, "Production")
	c.Assert(r1.ResourceId, check.Equals, "ami-1a2b3c4d")
	c.Assert(r1.ResourceType, check.Equals, "image")
}

func (s *S) TestStartInstances(c *check.C) {
	testServer.Response(200, nil, StartInstancesExample)

	resp, err := s.ec2.StartInstances("i-10a64379")
	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"StartInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-10a64379"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")

	s0 := resp.StateChanges[0]
	c.Assert(s0.InstanceId, check.Equals, "i-10a64379")
	c.Assert(s0.CurrentState.Code, check.Equals, 0)
	c.Assert(s0.CurrentState.Name, check.Equals, "pending")
	c.Assert(s0.PreviousState.Code, check.Equals, 80)
	c.Assert(s0.PreviousState.Name, check.Equals, "stopped")
}

func (s *S) TestStopInstances(c *check.C) {
	testServer.Response(200, nil, StopInstancesExample)

	resp, err := s.ec2.StopInstances("i-10a64379")
	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"StopInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-10a64379"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")

	s0 := resp.StateChanges[0]
	c.Assert(s0.InstanceId, check.Equals, "i-10a64379")
	c.Assert(s0.CurrentState.Code, check.Equals, 64)
	c.Assert(s0.CurrentState.Name, check.Equals, "stopping")
	c.Assert(s0.PreviousState.Code, check.Equals, 16)
	c.Assert(s0.PreviousState.Name, check.Equals, "running")
}

func (s *S) TestRebootInstances(c *check.C) {
	testServer.Response(200, nil, RebootInstancesExample)

	resp, err := s.ec2.RebootInstances("i-10a64379")
	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"RebootInstances"})
	c.Assert(req.Form["InstanceId.1"], check.DeepEquals, []string{"i-10a64379"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestSignatureWithEndpointPath(c *check.C) {
	ec2.FakeTime(true)
	defer ec2.FakeTime(false)

	testServer.Response(200, nil, RebootInstancesExample)

	region := aws.Region{EC2Endpoint: aws.ServiceInfo{Endpoint: testServer.URL + "/services/Cloud", Signer: aws.V2Signature}}
	ec2 := ec2.New(s.ec2.Auth, region)

	_, err := ec2.RebootInstances("i-10a64379")
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Signature"], check.DeepEquals, []string{"VVoC6Y6xfES+KvZo+789thP8+tye4F6fOKBiKmXk4S4="})
}

func (s *S) TestDescribeReservedInstancesiExample(c *check.C) {
	testServer.Response(200, nil, DescribeReservedInstancesExample)

	resp, err := s.ec2.DescribeReservedInstances([]string{"i-1", "i-2"}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeReservedInstances"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.ReservedInstances, check.HasLen, 1)

	r0 := resp.ReservedInstances[0]
	c.Assert(r0.ReservedInstanceId, check.Equals, "e5a2ff3b-7d14-494f-90af-0b5d0EXAMPLE")

}

func (s *S) TestDeregisterImage(c *check.C) {
	testServer.Response(200, nil, DeregisterImageExample)

	resp, err := s.ec2.DeregisterImage("i-1")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DeregisterImage"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Response, check.Equals, true)

}

func (s *S) TestDescribeInstanceStatus(c *check.C) {
	testServer.Response(200, nil, DescribeInstanceStatusExample)

	resp, err := s.ec2.DescribeInstanceStatus([]string{"i-1a2b3c4d", "i-2a2b3c4d"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeInstanceStatus"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "3be1508e-c444-4fef-89cc-0b1223c4f02fEXAMPLE")
	c.Assert(resp.InstanceStatuses, check.HasLen, 4)
	r0 := resp.InstanceStatuses[0]
	c.Assert(r0.InstanceId, check.Equals, "i-1a2b3c4d")
	c.Assert(r0.InstanceState, check.Equals, "running")
	c.Assert(r0.SystemStatus.StatusName, check.Equals, "impaired")
	c.Assert(r0.SystemStatus.Status, check.Equals, "failed")
	c.Assert(r0.InstanceStatus.StatusName, check.Equals, "impaired")
}

func (s *S) TestDescribeVolumes(c *check.C) {
	testServer.Response(200, nil, DescribeVolumesExample)

	resp, err := s.ec2.DescribeVolumes([]string{"vol-1a2b3c4d"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeVolumes"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Volumes, check.HasLen, 1)
	v0 := resp.Volumes[0]
	c.Assert(v0.AvailabilityZone, check.Equals, "us-east-1a")
	c.Assert(v0.Size, check.Equals, 80)
	c.Assert(v0.Status, check.Equals, "in-use")
	c.Assert(v0.AttachmentSet.VolumeId, check.Equals, "vol-1a2b3c4d")
	c.Assert(v0.AttachmentSet.InstanceId, check.Equals, "i-1a2b3c4d")
	c.Assert(v0.AttachmentSet.Device, check.Equals, "/dev/sdh")
	c.Assert(v0.AttachmentSet.Status, check.Equals, "attached")
}

func (s *S) TestAttachVolume(c *check.C) {
	testServer.Response(200, nil, AttachVolumeExample)

	resp, err := s.ec2.AttachVolume("v-1", "i-1", "/dev/sdz")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"AttachVolume"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
}

func (s *S) TestCreateVolume(c *check.C) {
	testServer.Response(200, nil, CreateVolumeExample)

	resp, err := s.ec2.CreateVolume(ec2.CreateVolumeOptions{
		Size:             "1",
		AvailabilityZone: "us-east-1a",
	})

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"CreateVolume"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "0c67a4c9-d7ec-45ef-8016-bf666EXAMPLE")
	c.Assert(resp.Size, check.Equals, "1")
	c.Assert(resp.VolumeId, check.Equals, "vol-2a21e543")
	c.Assert(resp.AvailabilityZone, check.Equals, "us-east-1a")
	c.Assert(resp.SnapshotId, check.Equals, "")
	c.Assert(resp.Status, check.Equals, "creating")
	c.Assert(resp.CreateTime, check.Equals, "2009-12-28T05:42:53.000Z")
	c.Assert(resp.VolumeType, check.Equals, "standard")
	c.Assert(resp.IOPS, check.Equals, 0)
	c.Assert(resp.Encrypted, check.Equals, false)
}

func (s *S) TestDescribeVpcs(c *check.C) {
	testServer.Response(200, nil, DescribeVpcsExample)

	resp, err := s.ec2.DescribeVpcs([]string{"vpc-1a2b3c4d"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeVpcs"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.Vpcs, check.HasLen, 1)
	v0 := resp.Vpcs[0]
	c.Assert(v0.VpcId, check.Equals, "vpc-1a2b3c4d")
	c.Assert(v0.State, check.Equals, "available")
	c.Assert(v0.CidrBlock, check.Equals, "10.0.0.0/23")
	c.Assert(v0.DhcpOptionsId, check.Equals, "dopt-7a8b9c2d")
	c.Assert(v0.InstanceTenancy, check.Equals, "default")
	c.Assert(v0.IsDefault, check.Equals, false)
}

func (s *S) TestDescribeVpnConnections(c *check.C) {
	testServer.Response(200, nil, DescribeVpnConnectionsExample)

	resp, err := s.ec2.DescribeVpnConnections([]string{"vpn-44a8938f"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeVpnConnections"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.VpnConnections, check.HasLen, 1)
	v0 := resp.VpnConnections[0]
	c.Assert(v0.VpnConnectionId, check.Equals, "vpn-44a8938f")
	c.Assert(v0.State, check.Equals, "available")
	c.Assert(v0.Type, check.Equals, "ipsec.1")
	c.Assert(v0.CustomerGatewayId, check.Equals, "cgw-b4dc3961")
	c.Assert(v0.VpnGatewayId, check.Equals, "vgw-8db04f81")
}

func (s *S) TestDescribeVpnGateways(c *check.C) {
	testServer.Response(200, nil, DescribeVpnGatewaysExample)

	resp, err := s.ec2.DescribeVpnGateways([]string{"vgw-8db04f81"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeVpnGateways"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.VpnGateway, check.HasLen, 1)
	g0 := resp.VpnGateway[0]
	c.Assert(g0.VpnGatewayId, check.Equals, "vgw-8db04f81")
	c.Assert(g0.State, check.Equals, "available")
	c.Assert(g0.Type, check.Equals, "ipsec.1")
	c.Assert(g0.AvailabilityZone, check.Equals, "us-east-1a")
	c.Assert(g0.AttachedVpcId, check.Equals, "vpc-1a2b3c4d")
	c.Assert(g0.AttachState, check.Equals, "attached")
}

func (s *S) TestDescribeInternetGateways(c *check.C) {
	testServer.Response(200, nil, DescribeInternetGatewaysExample)

	resp, err := s.ec2.DescribeInternetGateways([]string{"igw-eaad4883EXAMPLE"}, nil)

	req := testServer.WaitRequest()

	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DescribeInternetGateways"})
	c.Assert(err, check.IsNil)
	c.Assert(resp.RequestId, check.Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.InternetGateway, check.HasLen, 1)
	g0 := resp.InternetGateway[0]
	c.Assert(g0.InternetGatewayId, check.Equals, "igw-eaad4883EXAMPLE")
	c.Assert(g0.AttachedVpcId, check.Equals, "vpc-11ad4878")
	c.Assert(g0.AttachState, check.Equals, "available")
}
