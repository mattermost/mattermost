package ec2_test

import (
	"github.com/goamz/goamz/ec2"
	. "gopkg.in/check.v1"
)

func (s *S) TestCreateRouteTable(c *C) {
	testServer.Response(200, nil, CreateRouteTableExample)

	resp, err := s.ec2.CreateRouteTable("vpc-11ad4878")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"CreateRouteTable"})
	c.Assert(req.Form["VpcId"], DeepEquals, []string{"vpc-11ad4878"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "59abcd43-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.RouteTable.Id, Equals, "rtb-f9ad4890")
	c.Assert(resp.RouteTable.VpcId, Equals, "vpc-11ad4878")
	c.Assert(resp.RouteTable.Routes, HasLen, 1)
	c.Assert(resp.RouteTable.Routes[0], DeepEquals, ec2.Route{
		DestinationCidrBlock: "10.0.0.0/22",
		GatewayId:            "local",
		State:                "active",
	})
	c.Assert(resp.RouteTable.Associations, HasLen, 0)
	c.Assert(resp.RouteTable.Tags, HasLen, 0)
}

func (s *S) TestDescribeRouteTables(c *C) {
	testServer.Response(200, nil, DescribeRouteTablesExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeRouteTables([]string{"rt1", "rt2"}, nil)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"DescribeRouteTables"})
	c.Assert(req.Form["RouteTableId.1"], DeepEquals, []string{"rt1"})
	c.Assert(req.Form["RouteTableId.2"], DeepEquals, []string{"rt2"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "6f570b0b-9c18-4b07-bdec-73740dcf861aEXAMPLE")
	c.Assert(resp.RouteTables, HasLen, 2)

	rt1 := resp.RouteTables[0]
	c.Assert(rt1.Id, Equals, "rtb-13ad487a")
	c.Assert(rt1.VpcId, Equals, "vpc-11ad4878")
	c.Assert(rt1.Routes, DeepEquals, []ec2.Route{
		{DestinationCidrBlock: "10.0.0.0/22", GatewayId: "local", State: "active", Origin: "CreateRouteTable"},
	})
	c.Assert(rt1.Associations, DeepEquals, []ec2.RouteTableAssociation{
		{Id: "rtbassoc-12ad487b", RouteTableId: "rtb-13ad487a", Main: true},
	})

	rt2 := resp.RouteTables[1]
	c.Assert(rt2.Id, Equals, "rtb-f9ad4890")
	c.Assert(rt2.VpcId, Equals, "vpc-11ad4878")
	c.Assert(rt2.Routes, DeepEquals, []ec2.Route{
		{DestinationCidrBlock: "10.0.0.0/22", GatewayId: "local", State: "active", Origin: "CreateRouteTable"},
		{DestinationCidrBlock: "0.0.0.0/0", GatewayId: "igw-eaad4883", State: "active"},
	})
	c.Assert(rt2.Associations, DeepEquals, []ec2.RouteTableAssociation{
		{Id: "rtbassoc-faad4893", RouteTableId: "rtb-f9ad4890", SubnetId: "subnet-15ad487c"},
	})
}

func (s *S) TestAssociateRouteTable(c *C) {
	testServer.Response(200, nil, AssociateRouteTableExample)

	resp, err := s.ec2.AssociateRouteTable("rtb-e4ad488d", "subnet-15ad487c")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"AssociateRouteTable"})
	c.Assert(req.Form["RouteTableId"], DeepEquals, []string{"rtb-e4ad488d"})
	c.Assert(req.Form["SubnetId"], DeepEquals, []string{"subnet-15ad487c"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.AssociationId, Equals, "rtbassoc-f8ad4891")
}

func (s *S) TestDisassociateRouteTable(c *C) {
	testServer.Response(200, nil, DisassociateRouteTableExample)

	resp, err := s.ec2.DisassociateRouteTable("rtbassoc-f8ad4891")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"DisassociateRouteTable"})
	c.Assert(req.Form["AssociationId"], DeepEquals, []string{"rtbassoc-f8ad4891"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, Equals, true)
}

func (s *S) TestReplaceRouteTableAssociation(c *C) {
	testServer.Response(200, nil, ReplaceRouteTableAssociationExample)

	resp, err := s.ec2.ReplaceRouteTableAssociation("rtbassoc-f8ad4891", "rtb-f9ad4890")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"ReplaceRouteTableAssociation"})
	c.Assert(req.Form["RouteTableId"], DeepEquals, []string{"rtb-f9ad4890"})
	c.Assert(req.Form["AssociationId"], DeepEquals, []string{"rtbassoc-f8ad4891"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "59dbff89-35bd-4eac-88ed-be587EXAMPLE")
	c.Assert(resp.NewAssociationId, Equals, "rtbassoc-faad2958")
}

func (s *S) TestDeleteRouteTable(c *C) {
	testServer.Response(200, nil, DeleteRouteTableExample)

	resp, err := s.ec2.DeleteRouteTable("rtb-f9ad4890")

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"DeleteRouteTable"})
	c.Assert(req.Form["RouteTableId"], DeepEquals, []string{"rtb-f9ad4890"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "49dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, Equals, true)
}

func (s *S) TestDescribeVpcs(c *C) {
	testServer.Response(200, nil, DescribeVpcsExample)

	filter := ec2.NewFilter()
	filter.Add("key1", "value1")
	filter.Add("key2", "value2", "value3")

	resp, err := s.ec2.DescribeVpcs([]string{"id1", "id2"}, filter)

	req := testServer.WaitRequest()
	c.Assert(req.Form["Action"], DeepEquals, []string{"DescribeVpcs"})
	c.Assert(req.Form["VpcId.1"], DeepEquals, []string{"id1"})
	c.Assert(req.Form["VpcId.2"], DeepEquals, []string{"id2"})
	c.Assert(req.Form["VpcId.3"], IsNil)
	c.Assert(req.Form["Filter.1.Name"], DeepEquals, []string{"key1"})
	c.Assert(req.Form["Filter.1.Value.1"], DeepEquals, []string{"value1"})
	c.Assert(req.Form["Filter.1.Value.2"], IsNil)
	c.Assert(req.Form["Filter.2.Name"], DeepEquals, []string{"key2"})
	c.Assert(req.Form["Filter.2.Value.1"], DeepEquals, []string{"value2"})
	c.Assert(req.Form["Filter.2.Value.2"], DeepEquals, []string{"value3"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.VPCs[0].VpcId, Equals, "vpc-1a2b3c4d")
	c.Assert(resp.VPCs, HasLen, 1)
}

func (s *S) TestCreateVpc(c *C) {
	testServer.Response(200, nil, CreateVpcExample)

	resp, err := s.ec2.CreateVpc("foo", "bar")

	req := testServer.WaitRequest()
	c.Assert(req.Form["CidrBlock"], DeepEquals, []string{"foo"})
	c.Assert(req.Form["InstanceTenancy"], DeepEquals, []string{"bar"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
	c.Assert(resp.VPC.VpcId, Equals, "vpc-1a2b3c4d")
	c.Assert(resp.VPC.State, Equals, "pending")
	c.Assert(resp.VPC.CidrBlock, Equals, "10.0.0.0/16")
	c.Assert(resp.VPC.DHCPOptionsID, Equals, "dopt-1a2b3c4d2")
	c.Assert(resp.VPC.InstanceTenancy, Equals, "default")
}

func (s *S) TestDeleteVpc(c *C) {
	testServer.Response(200, nil, DeleteVpcExample)

	resp, err := s.ec2.DeleteVpc("id1")

	req := testServer.WaitRequest()
	c.Assert(req.Form["VpcId"], DeepEquals, []string{"id1"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "7a62c49f-347e-4fc4-9331-6e8eEXAMPLE")
}

func (s *S) TestCreateRoute(c *C) {
	testServer.Response(200, nil, CreateRouteExample)

	options := ec2.CreateRoute{
		DestinationCidrBlock:   "12.34.56.78/90",
		GatewayId:              "foo",
		InstanceId:             "i-bar",
		NetworkInterfaceId:     "foobar",
		VpcPeeringConnectionId: "barfoo",
	}

	resp, err := s.ec2.CreateRoute("rtb-deadbeef", &options)

	req := testServer.WaitRequest()
	c.Assert(req.Form["RouteTableId"], DeepEquals, []string{"rtb-deadbeef"})
	c.Assert(req.Form["DestinationCidrBlock"], DeepEquals, []string{"12.34.56.78/90"})
	c.Assert(req.Form["GatewayId"], DeepEquals, []string{"foo"})
	c.Assert(req.Form["InstanceId"], DeepEquals, []string{"i-bar"})
	c.Assert(req.Form["NetworkInterfaceId"], DeepEquals, []string{"foobar"})
	c.Assert(req.Form["VpcPeeringConnectionId"], DeepEquals, []string{"barfoo"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "b4998629-3000-437f-b382-cc96fEXAMPLE")
	c.Assert(resp.Return, Equals, true)
}

func (s *S) TestDeleteRoute(c *C) {
	testServer.Response(200, nil, DeleteRouteExample)

	resp, err := s.ec2.DeleteRoute("rtb-baddcafe", "foobar")

	req := testServer.WaitRequest()
	c.Assert(req.Form["RouteTableId"], DeepEquals, []string{"rtb-baddcafe"})
	c.Assert(req.Form["DestinationCidrBlock"], DeepEquals, []string{"foobar"})

	c.Assert(err, IsNil)
	c.Assert(resp.RequestId, Equals, "59dbff89-35bd-4eac-99ed-be587EXAMPLE")
	c.Assert(resp.Return, Equals, true)
}
