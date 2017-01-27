package ec2

// RouteTable describes a route table which contains a set of rules, called routes
// that are used to determine where network traffic is directed.
//
// See http://goo.gl/bI9hkg for more details.
type RouteTable struct {
	Id              string                  `xml:"routeTableId"`
	VpcId           string                  `xml:"vpcId"`
	Routes          []Route                 `xml:"routeSet>item"`
	Associations    []RouteTableAssociation `xml:"associationSet>item"`
	PropagatingVgws []PropagatingVgw        `xml:"propagatingVgwSet>item"`
	Tags            []Tag                   `xml:"tagSet>item"`
}

// Route describes a route in a route table.
//
// See http://goo.gl/hE5Kxe for more details.
type Route struct {
	DestinationCidrBlock   string `xml:"destinationCidrBlock"`   // The CIDR block used for the destination match.
	GatewayId              string `xml:"gatewayId"`              // The ID of a gateway attached to your VPC.
	InstanceId             string `xml:"instanceId"`             // The ID of a NAT instance in your VPC.
	InstanceOwnerId        string `xml:"instanceOwnerId"`        // The AWS account ID of the owner of the instance.
	NetworkInterfaceId     string `xml:"networkInterfaceId"`     // The ID of the network interface.
	State                  string `xml:"state"`                  // The state of the route. Valid values: active | blackhole
	Origin                 string `xml:"origin"`                 // Describes how the route was created. Valid values: Valid values: CreateRouteTable | CreateRoute | EnableVgwRoutePropagation
	VpcPeeringConnectionId string `xml:"vpcPeeringConnectionId"` // The ID of the VPC peering connection.
}

// RouteTableAssociation describes an association between a route table and a subnet.
//
// See http://goo.gl/BZB8o8 for more details.
type RouteTableAssociation struct {
	Id           string `xml:"routeTableAssociationId"` // The ID of the association between a route table and a subnet.
	RouteTableId string `xml:"routeTableId"`            // The ID of the route table.
	SubnetId     string `xml:"subnetId"`                // The ID of the subnet.
	Main         bool   `xml:"main"`                    // Indicates whether this is the main route table.
}

// PropagatingVgw describes a virtual private gateway propagating route.
//
// See http://goo.gl/myGQtG for more details.
type PropagatingVgw struct {
	GatewayId string `xml:"gatewayID"`
}

// CreateRouteTableResp represents a response from a CreateRouteTable request
//
// See http://goo.gl/LD0TqP for more details.
type CreateRouteTableResp struct {
	RequestId  string     `xml:"requestId"`
	RouteTable RouteTable `xml:"routeTable"`
}

// CreateRouteTable creates a route table for the specified VPC.
// After you create a route table, you can add routes and associate the table with a subnet.
//
// See http://goo.gl/V9h6gE for more details..
func (ec2 *EC2) CreateRouteTable(vpcId string) (resp *CreateRouteTableResp, err error) {
	params := makeParams("CreateRouteTable")
	params["VpcId"] = vpcId
	resp = &CreateRouteTableResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DescribeRouteTablesResp represents a response from a DescribeRouteTables call
//
// See http://goo.gl/T3tVsg for more details.
type DescribeRouteTablesResp struct {
	RequestId   string       `xml:"requestId"`
	RouteTables []RouteTable `xml:"routeTableSet>item"`
}

// DescribeRouteTables describes one or more of your route tables
//
// See http://goo.gl/S0RVos for more details.
func (ec2 *EC2) DescribeRouteTables(routeTableIds []string, filter *Filter) (resp *DescribeRouteTablesResp, err error) {
	params := makeParams("DescribeRouteTables")
	addParamsList(params, "RouteTableId", routeTableIds)
	filter.addParams(params)
	resp = &DescribeRouteTablesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// AssociateRouteTableResp represents a response from an AssociateRouteTable call
//
// See http://goo.gl/T4KlYk for more details.
type AssociateRouteTableResp struct {
	RequestId     string `xml:"requestId"`
	AssociationId string `xml:"associationId"`
}

// AssociateRouteTable associates a subnet with a route table.
//
// The subnet and route table must be in the same VPC. This association causes
// traffic originating from the subnet to be routed according to the routes
// in the route table. The action returns an association ID, which you need in
// order to disassociate the route table from the subnet later.
// A route table can be associated with multiple subnets.
//
// See http://goo.gl/bfnONU for more details.
func (ec2 *EC2) AssociateRouteTable(routeTableId, subnetId string) (resp *AssociateRouteTableResp, err error) {
	params := makeParams("AssociateRouteTable")
	params["RouteTableId"] = routeTableId
	params["SubnetId"] = subnetId
	resp = &AssociateRouteTableResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DisassociateRouteTableResp represents the response from a DisassociateRouteTable request
//
// See http://goo.gl/1v4reT for more details.
type DisassociateRouteTableResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"` // True if the request succeeds
}

// DisassociateRouteTable disassociates a subnet from a route table.
//
// See http://goo.gl/A4NJum for more details.
func (ec2 *EC2) DisassociateRouteTable(associationId string) (resp *DisassociateRouteTableResp, err error) {
	params := makeParams("DisassociateRouteTable")
	params["AssociationId"] = associationId
	resp = &DisassociateRouteTableResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// ReplaceRouteTableAssociationResp represents a response from a ReplaceRouteTableAssociation call
//
// See http://goo.gl/VhILGe for more details.
type ReplaceRouteTableAssociationResp struct {
	RequestId        string `xml:"requestId"`
	NewAssociationId string `xml:"newAssociationId"`
}

// ReplaceRouteTableAssociation changes the route table associated with a given subnet in a VPC.
//
// See http://goo.gl/kiit8j for more details.
func (ec2 *EC2) ReplaceRouteTableAssociation(associationId, routeTableId string) (resp *ReplaceRouteTableAssociationResp, err error) {
	params := makeParams("ReplaceRouteTableAssociation")
	params["AssociationId"] = associationId
	params["RouteTableId"] = routeTableId
	resp = &ReplaceRouteTableAssociationResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DeleteRouteTableResp represents a response from a DeleteRouteTable request
//
// See http://goo.gl/b8usig for more details.
type DeleteRouteTableResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"` // True if the request succeeds
}

// DeleteRouteTable deletes the specified route table.
// You must disassociate the route table from any subnets before you can delete it.
// You can't delete the main route table.
//
// See http://goo.gl/crHxT2 for more details.
func (ec2 *EC2) DeleteRouteTable(routeTableId string) (resp *DeleteRouteTableResp, err error) {
	params := makeParams("DeleteRouteTable")
	params["RouteTableId"] = routeTableId
	resp = &DeleteRouteTableResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// VPC describes a VPC.
//
// See http://goo.gl/WjX0Es for more details.
type VPC struct {
	CidrBlock       string `xml:"cidrBlock"`
	DHCPOptionsID   string `xml:"dhcpOptionsId"`
	State           string `xml:"state"`
	VpcId           string `xml:"vpcId"`
	InstanceTenancy string `xml:"instanceTenancy"`
	IsDefault       bool   `xml:"isDefault"`
	Tags            []Tag  `xml:"tagSet>item"`
}

// CreateVpcResp represents a response from a CreateVpcResp request
//
// See http://goo.gl/QoK11F for more details.
type CreateVpcResp struct {
	RequestId string `xml:"requestId"`
	VPC       VPC    `xml:"vpc"` // Information about the VPC.
}

// CreateVpc creates a VPC with the specified CIDR block.
//
// The smallest VPC you can create uses a /28 netmask (16 IP addresses),
// and the largest uses a /16 netmask (65,536 IP addresses).
//
// By default, each instance you launch in the VPC has the default DHCP options,
// which includes only a default DNS server that Amazon provides (AmazonProvidedDNS).
//
// See http://goo.gl/QoK11F for more details.
func (ec2 *EC2) CreateVpc(cidrBlock, instanceTenancy string) (resp *CreateVpcResp, err error) {
	params := makeParams("CreateVpc")
	params["CidrBlock"] = cidrBlock

	if instanceTenancy != "" {
		params["InstanceTenancy"] = instanceTenancy
	}

	resp = &CreateVpcResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}

	return
}

// DeleteVpcResp represents a response from a DeleteVpc request
//
// See http://goo.gl/qawyrz for more details.
type DeleteVpcResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"` // True if the request succeeds
}

// DeleteVpc deletes the specified VPC.
//
// You must detach or delete all gateways and resources that are associated with
// the VPC before you can delete it. For example, you must terminate all
// instances running in the VPC, delete all security groups associated with
// the VPC (except the default one), delete all route tables associated with
// the VPC (except the default one), and so on.
//
// See http://goo.gl/qawyrz for more details.
func (ec2 *EC2) DeleteVpc(vpcId string) (resp *DeleteVpcResp, err error) {
	params := makeParams("DeleteVpc")
	params["VpcId"] = vpcId

	resp = &DeleteVpcResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DescribeVpcsResp represents a response from a DescribeVpcs request
//
// See http://goo.gl/DWQWvZ for more details.
type DescribeVpcsResp struct {
	RequestId string `xml:"requestId"`
	VPCs      []VPC  `xml:"vpcSet>item"` // Information about one or more VPCs.
}

// DescribeVpcs describes one or more of your VPCs.
//
// See http://goo.gl/DWQWvZ for more details.
func (ec2 *EC2) DescribeVpcs(vpcIds []string, filter *Filter) (resp *DescribeVpcsResp, err error) {
	params := makeParams("DescribeVpcs")
	addParamsList(params, "VpcId", vpcIds)
	filter.addParams(params)
	resp = &DescribeVpcsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}

	return
}

// DeleteRouteResp represents a response from a DeleteRoute request
//
// See http://goo.gl/Uqyt3w for more details.
type DeleteRouteResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"` // True if the request succeeds
}

// DeleteRoute deletes the specified route from the specified route table.
//
// See http://goo.gl/Uqyt3w for more details.
func (ec2 *EC2) DeleteRoute(routeTableId, destinationCidrBlock string) (resp *DeleteRouteResp, err error) {
	params := makeParams("DeleteRoute")
	params["RouteTableId"] = routeTableId
	params["DestinationCidrBlock"] = destinationCidrBlock
	resp = &DeleteRouteResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// CreateRouteResp represents a response from a CreateRoute request
//
// See http://goo.gl/c6Bg7e for more details.
type CreateRouteResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"` // True if the request succeeds
}

// CreateRoute structure contains the options for a CreateRoute API call.
type CreateRoute struct {
	DestinationCidrBlock   string
	GatewayId              string
	InstanceId             string
	NetworkInterfaceId     string
	VpcPeeringConnectionId string
}

// CreateRoute creates a route in a route table within a VPC.
// You must specify one of the following targets: Internet gateway or virtual
// private gateway, NAT instance, VPC peering connection, or network interface.
//
// See http://goo.gl/c6Bg7e for more details.
func (ec2 *EC2) CreateRoute(routeTableId string, options *CreateRoute) (resp *CreateRouteResp, err error) {
	params := makeParams("CreateRoute")
	params["RouteTableId"] = routeTableId
	if options.DestinationCidrBlock != "" {
		params["DestinationCidrBlock"] = options.DestinationCidrBlock
	}
	if options.GatewayId != "" {
		params["GatewayId"] = options.GatewayId
	}
	if options.InstanceId != "" {
		params["InstanceId"] = options.InstanceId
	}
	if options.NetworkInterfaceId != "" {
		params["NetworkInterfaceId"] = options.NetworkInterfaceId
	}
	if options.VpcPeeringConnectionId != "" {
		params["VpcPeeringConnectionId"] = options.VpcPeeringConnectionId
	}
	resp = &CreateRouteResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// Subnet describes a subnet
//
// See http://goo.gl/bifW4R
type Subnet struct {
	AvailabilityZone        string `xml:"availabilityZone"`
	AvailableIpAddressCount int    `xml:"availableIpAddressCount"`
	CidrBlock               string `xml:"cidrBlock"`
	DefaultForAZ            bool   `xml:"defaultForAz"`
	MapPublicIpOnLaunch     bool   `xml:"mapPublicIpOnLaunch"`
	State                   string `xml:"state"`
	SubnetId                string `xml:"subnetId"`
	Tags                    []Tag  `xml:"tagSet>item"`
	VpcId                   string `xml:"vpcId"`
}

// DescribeSubnetsResp represents a response from a DescribeSubnets request
//
// See https://goo.gl/1s0UQd for more details.
type DescribeSubnetsResp struct {
	RequestId string   `xml:"requestId"`
	Subnets   []Subnet `xml:"subnetSet>item"`
}

// DescribeSubnets describes one or more Subnets.
//
// See https://goo.gl/1s0UQd for more details.
func (ec2 *EC2) DescribeSubnets(subnetIds []string, filter *Filter) (resp *DescribeSubnetsResp, err error) {
	params := makeParams("DescribeSubnets")
	addParamsList(params, "SubnetId", subnetIds)
	filter.addParams(params)
	resp = &DescribeSubnetsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}

	return
}
