//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 Canonical Ltd.
//
// Written by Gustavo Niemeyer <gustavo.niemeyer@canonical.com>
//

package ec2

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sort"
	"strconv"
	"time"
)

const debug = false

// The EC2 type encapsulates operations with a specific EC2 region.
type EC2 struct {
	aws.Auth
	aws.Region
	private byte // Reserve the right of using private data.
}

// New creates a new EC2.
func New(auth aws.Auth, region aws.Region) *EC2 {
	return &EC2{auth, region, 0}
}

// ----------------------------------------------------------------------------
// Filtering helper.

// Filter builds filtering parameters to be used in an EC2 query which supports
// filtering.  For example:
//
//     filter := NewFilter()
//     filter.Add("architecture", "i386")
//     filter.Add("launch-index", "0")
//     resp, err := ec2.DescribeInstances(nil, filter)
//
type Filter struct {
	m map[string][]string
}

// NewFilter creates a new Filter.
func NewFilter() *Filter {
	return &Filter{make(map[string][]string)}
}

// Add appends a filtering parameter with the given name and value(s).
func (f *Filter) Add(name string, value ...string) {
	f.m[name] = append(f.m[name], value...)
}

func (f *Filter) addParams(params map[string]string) {
	if f != nil {
		a := make([]string, len(f.m))
		i := 0
		for k := range f.m {
			a[i] = k
			i++
		}
		sort.StringSlice(a).Sort()
		for i, k := range a {
			prefix := "Filter." + strconv.Itoa(i+1)
			params[prefix+".Name"] = k
			for j, v := range f.m[k] {
				params[prefix+".Value."+strconv.Itoa(j+1)] = v
			}
		}
	}
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

// Error encapsulates an error returned by EC2.
//
// See http://goo.gl/VZGuC for more details.
type Error struct {
	// HTTP status code (200, 403, ...)
	StatusCode int
	// EC2 error code ("UnsupportedOperation", ...)
	Code string
	// The human-oriented error message
	Message   string
	RequestId string `xml:"RequestID"`
}

func (err *Error) Error() string {
	if err.Code == "" {
		return err.Message
	}

	return fmt.Sprintf("%s (%s)", err.Message, err.Code)
}

// For now a single error inst is being exposed. In the future it may be useful
// to provide access to all of them, but rather than doing it as an array/slice,
// use a *next pointer, so that it's backward compatible and it continues to be
// easy to handle the first error, which is what most people will want.
type xmlErrors struct {
	RequestId string  `xml:"RequestID"`
	Errors    []Error `xml:"Errors>Error"`
}

var timeNow = time.Now

func (ec2 *EC2) query(params map[string]string, resp interface{}) error {
	values := multimap(params)
	values.Set("Version", "2014-02-01")
	values.Set("Timestamp", timeNow().In(time.UTC).Format(time.RFC3339))

	client := http.Client{}

	req, err := http.NewRequest("GET", ec2.Region.EC2Endpoint.Endpoint, nil)
	if err != nil {
		return err
	}

	if req.URL.Path == "" {
		req.URL.Path = "/"
	}

	req.URL.RawQuery = values.Encode()

	if ec2.Region.EC2Endpoint.Signer == aws.V2Signature {
		sgnr, err := aws.NewV2Signer(ec2.Auth, ec2.Region.EC2Endpoint)
		sgnr.SignRequest(req)
		if err != nil {
			return err
		}
	} else if ec2.Region.EC2Endpoint.Signer == aws.V4Signature {
		sgnr := aws.NewV4Signer(ec2.Auth, "ec2", ec2.Region)
		sgnr.SignRequest(req)
	} else {
		str := fmt.Sprintf("Unknown signature type specified for region '%v'", ec2.Region.Name)
		return errors.New(str)
	}

	r, err := client.Do(req)
	if err != nil {
		return err
	}

	if debug {
		dump, _ := httputil.DumpResponse(r, true)
		log.Printf("response:\n")
		log.Printf("%v\n}\n", string(dump))
	}

	defer r.Body.Close()

	if r.StatusCode != 200 {
		return buildError(r)
	}

	err = xml.NewDecoder(r.Body).Decode(resp)

	return err
}

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
}

func buildError(r *http.Response) error {
	errors := xmlErrors{}
	xml.NewDecoder(r.Body).Decode(&errors)
	var err Error
	if len(errors.Errors) > 0 {
		err = errors.Errors[0]
	}
	err.RequestId = errors.RequestId
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	return &err
}

func makeParams(action string) map[string]string {
	params := make(map[string]string)
	params["Action"] = action
	return params
}

func addParamsList(params map[string]string, label string, ids []string) {
	for i, id := range ids {
		params[label+"."+strconv.Itoa(i+1)] = id
	}
}

// ----------------------------------------------------------------------------
// Instance management functions and types.

// The RunInstances type encapsulates options for the respective request in EC2.
//
// See http://goo.gl/Mcm3b for more details.
type RunInstancesOptions struct {
	ImageId               string
	MinCount              int
	MaxCount              int
	KeyName               string
	InstanceType          string
	SecurityGroups        []SecurityGroup
	KernelId              string
	RamdiskId             string
	UserData              []byte
	AvailabilityZone      string
	PlacementGroupName    string
	Tenancy               string
	Monitoring            bool
	SubnetId              string
	DisableAPITermination bool
	ShutdownBehavior      string
	PrivateIPAddress      string
	IamInstanceProfile    IamInstanceProfile
	BlockDeviceMappings   []BlockDeviceMapping
	EbsOptimized          bool
	NetworkInterfaces     []NetworkInterface
}

// NetworkInterface is for creating and attaching to ec2 instances on launch
type NetworkInterface struct {
	AssociatePublicIpAddress bool
	SubnetId                 string
	Description              string
	SecurityGroups           []SecurityGroup
	DeleteOnTermination      bool
	PrivateIpAddress         string // primary private ip
	PrivateIpAddresses       []InstancePrivateIpAddress
}

// Response to a RunInstances request.
//
// See http://goo.gl/Mcm3b for more details.
type RunInstancesResp struct {
	RequestId      string          `xml:"requestId"`
	ReservationId  string          `xml:"reservationId"`
	OwnerId        string          `xml:"ownerId"`
	SecurityGroups []SecurityGroup `xml:"groupSet>item"`
	Instances      []Instance      `xml:"instancesSet>item"`
}

// Instance encapsulates a running instance in EC2.
//
// See http://goo.gl/OCH8a for more details.
type Instance struct {

	// General instance information
	InstanceId         string              `xml:"instanceId"`                 // The ID of the instance launched
	InstanceType       string              `xml:"instanceType"`               // The instance type eg. m1.small | m1.medium | m1.large etc
	AvailabilityZone   string              `xml:"placement>availabilityZone"` // The Availability Zone the instance is located in
	Tags               []Tag               `xml:"tagSet>item"`                // Any tags assigned to the resource
	State              InstanceState       `xml:"instanceState"`              // The current state of the instance
	Reason             string              `xml:"reason"`                     // The reason for the most recent state transition. This might be an empty string
	StateReason        InstanceStateReason `xml:"stateReason"`                // The reason for the most recent state transition
	ImageId            string              `xml:"imageId"`                    // The ID of the AMI used to launch the instance
	KeyName            string              `xml:"keyName"`                    // The key pair name, if this instance was launched with an associated key pair
	Monitoring         string              `xml:"monitoring>state"`           // Valid values: disabled | enabled | pending
	IamInstanceProfile IamInstanceProfile  `xml:"iamInstanceProfile"`         // The IAM instance profile associated with the instance
	LaunchTime         string              `xml:"launchTime"`                 // The time the instance was launched
	OwnerId            string              // This isn't currently returned in the response, and is taken from the parent reservation

	// More specific information
	Architecture          string        `xml:"architecture"`          // Valid values: i386 | x86_64
	Hypervisor            string        `xml:"hypervisor"`            // Valid values: ovm | xen
	KernelId              string        `xml:"kernelId"`              // The kernel associated with this instance
	RamDiskId             string        `xml:"ramdiskId"`             // The RAM disk associated with this instance
	Platform              string        `xml:"platform"`              // The value is Windows for Windows AMIs; otherwise blank
	VirtualizationType    string        `xml:"virtualizationType"`    // Valid values: paravirtual | hvm
	AMILaunchIndex        int           `xml:"amiLaunchIndex"`        // The AMI launch index, which can be used to find this instance in the launch group
	PlacementGroupName    string        `xml:"placement>groupName"`   // The name of the placement group the instance is in (for cluster compute instances)
	Tenancy               string        `xml:"placement>tenancy"`     // (VPC only) Valid values: default | dedicated
	InstanceLifecycle     string        `xml:"instanceLifecycle"`     // Spot instance? Valid values: "spot" or blank
	SpotInstanceRequestId string        `xml:"spotInstanceRequestId"` // The ID of the Spot Instance request
	ClientToken           string        `xml:"clientToken"`           // The idempotency token you provided when you launched the instance
	ProductCodes          []ProductCode `xml:"productCodes>item"`     // The product codes attached to this instance

	// Storage
	RootDeviceType string        `xml:"rootDeviceType"`          // Valid values: ebs | instance-store
	RootDeviceName string        `xml:"rootDeviceName"`          // The root device name (for example, /dev/sda1)
	BlockDevices   []BlockDevice `xml:"blockDeviceMapping>item"` // Any block device mapping entries for the instance
	EbsOptimized   bool          `xml:"ebsOptimized"`            // Indicates whether the instance is optimized for Amazon EBS I/O

	// Network
	DNSName          string          `xml:"dnsName"`          // The public DNS name assigned to the instance. This element remains empty until the instance enters the running state
	PrivateDNSName   string          `xml:"privateDnsName"`   // The private DNS name assigned to the instance. This DNS name can only be used inside the Amazon EC2 network. This element remains empty until the instance enters the running state
	IPAddress        string          `xml:"ipAddress"`        // The public IP address assigned to the instance
	PrivateIPAddress string          `xml:"privateIpAddress"` // The private IP address assigned to the instance
	SubnetId         string          `xml:"subnetId"`         // The ID of the subnet in which the instance is running
	VpcId            string          `xml:"vpcId"`            // The ID of the VPC in which the instance is running
	SecurityGroups   []SecurityGroup `xml:"groupSet>item"`    // A list of the security groups for the instance

	// Advanced Networking
	NetworkInterfaces []InstanceNetworkInterface `xml:"networkInterfaceSet>item"` // (VPC) One or more network interfaces for the instance
	SourceDestCheck   bool                       `xml:"sourceDestCheck"`          // Controls whether source/destination checking is enabled on the instance
	SriovNetSupport   string                     `xml:"sriovNetSupport"`          // Specifies whether enhanced networking is enabled. Valid values: simple
}

// isSpotInstance returns if the instance is a spot instance
func (i Instance) IsSpotInstance() bool {
	if i.InstanceLifecycle == "spot" {
		return true
	}
	return false
}

type BlockDevice struct {
	DeviceName string `xml:"deviceName"`
	EBS        EBS    `xml:"ebs"`
}

type EBS struct {
	VolumeId            string `xml:"volumeId"`
	Status              string `xml:"status"`
	AttachTime          string `xml:"attachTime"`
	DeleteOnTermination bool   `xml:"deleteOnTermination"`
}

// ProductCode represents a product code
// See http://goo.gl/hswmQm for more details.
type ProductCode struct {
	ProductCode string `xml:"productCode"` // The product code
	Type        string `xml:"type"`        // Valid values: devpay | marketplace
}

// InstanceNetworkInterface represents a network interface attached to an instance
// See http://goo.gl/9eW02N for more details.
type InstanceNetworkInterface struct {
	Id                 string                              `xml:"networkInterfaceId"`
	Description        string                              `xml:"description"`
	SubnetId           string                              `xml:"subnetId"`
	VpcId              string                              `xml:"vpcId"`
	OwnerId            string                              `xml:"ownerId"` // The ID of the AWS account that created the network interface.
	Status             string                              `xml:"status"`  // Valid values: available | attaching | in-use | detaching
	MacAddress         string                              `xml:"macAddress"`
	PrivateIPAddress   string                              `xml:"privateIpAddress"`
	PrivateDNSName     string                              `xml:"privateDnsName"`
	SourceDestCheck    bool                                `xml:"sourceDestCheck"`
	SecurityGroups     []SecurityGroup                     `xml:"groupSet>item"`
	Attachment         InstanceNetworkInterfaceAttachment  `xml:"attachment"`
	Association        InstanceNetworkInterfaceAssociation `xml:"association"`
	PrivateIPAddresses []InstancePrivateIpAddress          `xml:"privateIpAddressesSet>item"`
}

// InstanceNetworkInterfaceAttachment describes a network interface attachment to an instance
// See http://goo.gl/0ql0Cg for more details
type InstanceNetworkInterfaceAttachment struct {
	AttachmentID        string `xml:"attachmentID"`        // The ID of the network interface attachment.
	DeviceIndex         int32  `xml:"deviceIndex"`         // The index of the device on the instance for the network interface attachment.
	Status              string `xml:"status"`              // Valid values: attaching | attached | detaching | detached
	AttachTime          string `xml:"attachTime"`          // Time attached, as a Datetime
	DeleteOnTermination bool   `xml:"deleteOnTermination"` // Indicates whether the network interface is deleted when the instance is terminated.
}

// Describes association information for an Elastic IP address.
// See http://goo.gl/YCDdMe for more details
type InstanceNetworkInterfaceAssociation struct {
	PublicIP      string `xml:"publicIp"`      // The address of the Elastic IP address bound to the network interface
	PublicDNSName string `xml:"publicDnsName"` // The public DNS name
	IPOwnerId     string `xml:"ipOwnerId"`     // The ID of the owner of the Elastic IP address
}

// InstancePrivateIpAddress describes a private IP address
// See http://goo.gl/irN646 for more details
type InstancePrivateIpAddress struct {
	PrivateIPAddress string                              `xml:"privateIpAddress"` // The private IP address of the network interface
	PrivateDNSName   string                              `xml:"privateDnsName"`   // The private DNS name
	Primary          bool                                `xml:"primary"`          // Indicates whether this IP address is the primary private IP address of the network interface
	Association      InstanceNetworkInterfaceAssociation `xml:"association"`      // The association information for an Elastic IP address for the network interface
}

// IamInstanceProfile
// See http://goo.gl/PjyijL for more details
type IamInstanceProfile struct {
	ARN  string `xml:"arn"`
	Id   string `xml:"id"`
	Name string `xml:"name"`
}

// RunInstances starts new instances in EC2.
// If options.MinCount and options.MaxCount are both zero, a single instance
// will be started; otherwise if options.MaxCount is zero, options.MinCount
// will be used insteead.
//
// See http://goo.gl/Mcm3b for more details.
func (ec2 *EC2) RunInstances(options *RunInstancesOptions) (resp *RunInstancesResp, err error) {
	params := makeParams("RunInstances")
	params["ImageId"] = options.ImageId
	params["InstanceType"] = options.InstanceType
	var min, max int
	if options.MinCount == 0 && options.MaxCount == 0 {
		min = 1
		max = 1
	} else if options.MaxCount == 0 {
		min = options.MinCount
		max = min
	} else {
		min = options.MinCount
		max = options.MaxCount
	}
	params["MinCount"] = strconv.Itoa(min)
	params["MaxCount"] = strconv.Itoa(max)
	i, j := 1, 1
	for _, g := range options.SecurityGroups {
		if g.Id != "" {
			params["SecurityGroupId."+strconv.Itoa(i)] = g.Id
			i++
		} else {
			params["SecurityGroup."+strconv.Itoa(j)] = g.Name
			j++
		}
	}

	for i, d := range options.BlockDeviceMappings {
		if d.DeviceName != "" {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".DeviceName"] = d.DeviceName
		}
		if d.VirtualName != "" {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".VirtualName"] = d.VirtualName
		}
		if d.SnapshotId != "" {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".Ebs.SnapshotId"] = d.SnapshotId
		}
		if d.VolumeType != "" {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".Ebs.VolumeType"] = d.VolumeType
		}
		if d.VolumeSize != 0 {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".Ebs.VolumeSize"] = strconv.FormatInt(d.VolumeSize, 10)
		}
		if d.DeleteOnTermination {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".Ebs.DeleteOnTermination"] = "true"
		}
		if d.IOPS != 0 {
			params["BlockDeviceMapping."+strconv.Itoa(i)+".Ebs.Iops"] = strconv.FormatInt(d.IOPS, 10)
		}
	}

	token, err := clientToken()
	if err != nil {
		return nil, err
	}
	params["ClientToken"] = token

	if options.KeyName != "" {
		params["KeyName"] = options.KeyName
	}
	if options.KernelId != "" {
		params["KernelId"] = options.KernelId
	}
	if options.RamdiskId != "" {
		params["RamdiskId"] = options.RamdiskId
	}
	if options.UserData != nil {
		userData := make([]byte, base64.StdEncoding.EncodedLen(len(options.UserData)))
		base64.StdEncoding.Encode(userData, options.UserData)
		params["UserData"] = string(userData)
	}
	if options.AvailabilityZone != "" {
		params["Placement.AvailabilityZone"] = options.AvailabilityZone
	}
	if options.PlacementGroupName != "" {
		params["Placement.GroupName"] = options.PlacementGroupName
	}
	if options.Tenancy != "" {
		params["Placement.Tenancy"] = options.Tenancy
	}
	if options.Monitoring {
		params["Monitoring.Enabled"] = "true"
	}
	if options.SubnetId != "" {
		params["SubnetId"] = options.SubnetId
	}
	if options.DisableAPITermination {
		params["DisableApiTermination"] = "true"
	}
	if options.ShutdownBehavior != "" {
		params["InstanceInitiatedShutdownBehavior"] = options.ShutdownBehavior
	}
	if options.PrivateIPAddress != "" {
		params["PrivateIpAddress"] = options.PrivateIPAddress
	}
	if options.IamInstanceProfile.ARN != "" {
		params["IamInstanceProfile.Arn"] = options.IamInstanceProfile.ARN
	}
	if options.IamInstanceProfile.Name != "" {
		params["IamInstanceProfile.Name"] = options.IamInstanceProfile.Name
	}
	if options.EbsOptimized {
		params["EbsOptimized"] = "true"
	}

	if options.NetworkInterfaces != nil {
		for i, ni := range options.NetworkInterfaces {
			prefix := fmt.Sprintf("NetworkInterface.%d.", i+1)
			params[prefix+"DeviceIndex"] = strconv.Itoa(i)
			if ni.SubnetId != "" {
				params[prefix+"SubnetId"] = ni.SubnetId
			}
			if ni.Description != "" {
				params[prefix+"Description"] = ni.Description
			}
			if ni.AssociatePublicIpAddress {
				params[prefix+"AssociatePublicIpAddress"] = "true"
			}
			if ni.PrivateIpAddress != "" {
				params[prefix+"PrivateIpAddress"] = ni.PrivateIpAddress
			}
			if ni.SecurityGroups != nil {
				for secId, g := range ni.SecurityGroups {
					params[prefix+"SecurityGroupId."+strconv.Itoa(secId+1)] = g.Id
				}
			}
			if ni.DeleteOnTermination {
				params[prefix+"DeleteOnTermination"] = "true"
			}
			if ni.PrivateIpAddresses != nil {
				for pId, addy := range ni.PrivateIpAddresses {
					params[prefix+"PrivateIpAddresses."+strconv.Itoa(pId+1)+".PrivateIpAddress"] = addy.PrivateIPAddress
					if addy.Primary {
						params[prefix+"PrivateIpAddresses."+strconv.Itoa(pId+1)+".Primary"] = "true"
					}
				}
			}
		}
	}
	resp = &RunInstancesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

func clientToken() (string, error) {
	// Maximum EC2 client token size is 64 bytes.
	// Each byte expands to two when hex encoded.
	buf := make([]byte, 32)
	_, err := rand.Read(buf)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// Response to a TerminateInstances request.
//
// See http://goo.gl/3BKHj for more details.
type TerminateInstancesResp struct {
	RequestId    string                `xml:"requestId"`
	StateChanges []InstanceStateChange `xml:"instancesSet>item"`
}

// InstanceState encapsulates the state of an instance in EC2.
//
// See http://goo.gl/y3ZBq for more details.
type InstanceState struct {
	Code int    `xml:"code"` // Watch out, bits 15-8 have unpublished meaning.
	Name string `xml:"name"`
}

// InstanceStateChange informs of the previous and current states
// for an instance when a state change is requested.
type InstanceStateChange struct {
	InstanceId    string        `xml:"instanceId"`
	CurrentState  InstanceState `xml:"currentState"`
	PreviousState InstanceState `xml:"previousState"`
}

// InstanceStateReason describes a state change for an instance in EC2
//
// See http://goo.gl/KZkbXi for more details
type InstanceStateReason struct {
	Code    string `xml:"code"`
	Message string `xml:"message"`
}

// TerminateInstances requests the termination of instances when the given ids.
//
// See http://goo.gl/3BKHj for more details.
func (ec2 *EC2) TerminateInstances(instIds []string) (resp *TerminateInstancesResp, err error) {
	params := makeParams("TerminateInstances")
	addParamsList(params, "InstanceId", instIds)
	resp = &TerminateInstancesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// Response to a DescribeAddresses request.
//
// See http://goo.gl/zW7J4p for more details.
type DescribeAddressesResp struct {
	RequestId string    `xml:"requestId"`
	Addresses []Address `xml:"addressesSet>item"`
}

// Address represents an Elastic IP Address
// See http://goo.gl/uxCjp7 for more details
type Address struct {
	PublicIp                string `xml:"publicIp"`
	AllocationId            string `xml:"allocationId"`
	Domain                  string `xml:"domain"`
	InstanceId              string `xml:"instanceId"`
	AssociationId           string `xml:"associationId"`
	NetworkInterfaceId      string `xml:"networkInterfaceId"`
	NetworkInterfaceOwnerId string `xml:"networkInterfaceOwnerId"`
	PrivateIpAddress        string `xml:"privateIpAddress"`
}

// DescribeAddresses returns details about one or more
// Elastic IP Addresses. Returned addresses can be
// filtered by Public IP, Allocation ID or multiple filters
//
// See http://goo.gl/zW7J4p for more details.
func (ec2 *EC2) DescribeAddresses(publicIps []string, allocationIds []string, filter *Filter) (resp *DescribeAddressesResp, err error) {
	params := makeParams("DescribeAddresses")
	addParamsList(params, "PublicIp", publicIps)
	addParamsList(params, "AllocationId", allocationIds)
	filter.addParams(params)
	resp = &DescribeAddressesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

//Response to an AllocateAddress request
//
// See  http://goo.gl/aLPmbm for more details
type AllocateAddressResp struct {
	RequestId    string `xml:"requestId"`
	PublicIp     string `xml:"publicIp"`
	Domain       string `xml:"domain"`
	AllocationId string `xml:"allocationId"`
}

// Allocates a new Elastic ip address.
// The domain parameter is optional and is used for provisioning an ip address
// in EC2 or in VPC respectively
//
// See http://goo.gl/aLPmbm for more details
func (ec2 *EC2) AllocateAddress(domain string) (resp *AllocateAddressResp, err error) {
	params := makeParams("AllocateAddress")
	params["Domain"] = domain

	resp = &AllocateAddressResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a ReleaseAddress request
//
// See http://goo.gl/Ciw2Z8 for more details
type ReleaseAddressResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"`
}

// Release existing elastic ip address from the account
// PublicIp = Required for EC2
// AllocationId = Required for VPC
//
// See http://goo.gl/Ciw2Z8 for more details
func (ec2 *EC2) ReleaseAddress(publicIp, allocationId string) (resp *ReleaseAddressResp, err error) {
	params := makeParams("ReleaseAddress")

	if publicIp != "" {
		params["PublicIp"] = publicIp

	}
	if allocationId != "" {
		params["AllocationId"] = allocationId
	}

	resp = &ReleaseAddressResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Options set for AssociateAddress
//
// See http://goo.gl/hhj4z7 for more details
type AssociateAddressOptions struct {
	PublicIp           string
	InstanceId         string
	AllocationId       string
	NetworkInterfaceId string
	PrivateIpAddress   string
	AllowReassociation bool
}

// Response to an AssociateAddress request
//
// See http://goo.gl/hhj4z7 for more details
type AssociateAddressResp struct {
	RequestId     string `xml:"requestId"`
	Return        bool   `xml:"return"`
	AssociationId string `xml:"associationId"`
}

// Associate an Elastic ip address to an instance id or a network interface
//
// See http://goo.gl/hhj4z7 for more details
func (ec2 *EC2) AssociateAddress(options *AssociateAddressOptions) (resp *AssociateAddressResp, err error) {
	params := makeParams("AssociateAddress")
	params["InstanceId"] = options.InstanceId
	if options.PublicIp != "" {
		params["PublicIp"] = options.PublicIp
	}
	if options.AllocationId != "" {
		params["AllocationId"] = options.AllocationId
	}
	if options.NetworkInterfaceId != "" {
		params["NetworkInterfaceId"] = options.NetworkInterfaceId
	}
	if options.PrivateIpAddress != "" {
		params["PrivateIpAddress"] = options.PrivateIpAddress
	}
	if options.AllowReassociation {
		params["AllowReassociation"] = "true"
	}

	resp = &AssociateAddressResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a Diassociate request
//
// See http://goo.gl/Dapkuzfor more details
type DiassociateAddressResp struct {
	RequestId string `xml:"requestId"`
	Return    bool   `xml:"return"`
}

// Diassociate an elastic ip address from an instance
// PublicIp - Required for EC2
// AssociationId - Required for VPC
// See http://goo.gl/Dapkuz for more details
func (ec2 *EC2) DiassociateAddress(publicIp, associationId string) (resp *DiassociateAddressResp, err error) {
	params := makeParams("DiassociateAddress")
	if publicIp != "" {
		params["PublicIp"] = publicIp
	}
	if associationId != "" {
		params["AssociationId"] = associationId
	}

	resp = &DiassociateAddressResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a DescribeInstances request.
//
// See http://goo.gl/mLbmw for more details.
type DescribeInstancesResp struct {
	RequestId    string        `xml:"requestId"`
	Reservations []Reservation `xml:"reservationSet>item"`
}

// Reservation represents details about a reservation in EC2.
//
// See http://goo.gl/0ItPT for more details.
type Reservation struct {
	ReservationId  string          `xml:"reservationId"`
	OwnerId        string          `xml:"ownerId"`
	RequesterId    string          `xml:"requesterId"`
	SecurityGroups []SecurityGroup `xml:"groupSet>item"`
	Instances      []Instance      `xml:"instancesSet>item"`
}

// Instances returns details about instances in EC2.  Both parameters
// are optional, and if provided will limit the instances returned to those
// matching the given instance ids or filtering rules.
//
// See http://goo.gl/4No7c for more details.
func (ec2 *EC2) DescribeInstances(instIds []string, filter *Filter) (resp *DescribeInstancesResp, err error) {
	params := makeParams("DescribeInstances")
	addParamsList(params, "InstanceId", instIds)
	filter.addParams(params)
	resp = &DescribeInstancesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}

	// Add additional parameters to instances which aren't available in the response
	for i, rsv := range resp.Reservations {
		ownerId := rsv.OwnerId
		for j, inst := range rsv.Instances {
			inst.OwnerId = ownerId
			resp.Reservations[i].Instances[j] = inst
		}
	}

	return
}

// ----------------------------------------------------------------------------
// Image and snapshot management functions and types.

// Response to a DescribeImages request.
//
// See http://goo.gl/hLnyg for more details.
type ImagesResp struct {
	RequestId string  `xml:"requestId"`
	Images    []Image `xml:"imagesSet>item"`
}

// BlockDeviceMapping represents the association of a block device with an image.
//
// See http://goo.gl/wnDBf for more details.
type BlockDeviceMapping struct {
	DeviceName          string `xml:"deviceName"`
	VirtualName         string `xml:"virtualName"`
	SnapshotId          string `xml:"ebs>snapshotId"`
	VolumeType          string `xml:"ebs>volumeType"`
	VolumeSize          int64  `xml:"ebs>volumeSize"`
	DeleteOnTermination bool   `xml:"ebs>deleteOnTermination"`

	// The number of I/O operations per second (IOPS) that the volume supports.
	IOPS int64 `xml:"ebs>iops"`
}

// Image represents details about an image.
//
// See http://goo.gl/iSqJG for more details.
type Image struct {
	Id                 string               `xml:"imageId"`
	Name               string               `xml:"name"`
	Description        string               `xml:"description"`
	Type               string               `xml:"imageType"`
	State              string               `xml:"imageState"`
	Location           string               `xml:"imageLocation"`
	Public             bool                 `xml:"isPublic"`
	Architecture       string               `xml:"architecture"`
	Platform           string               `xml:"platform"`
	ProductCodes       []string             `xml:"productCode>item>productCode"`
	KernelId           string               `xml:"kernelId"`
	RamdiskId          string               `xml:"ramdiskId"`
	StateReason        string               `xml:"stateReason"`
	OwnerId            string               `xml:"imageOwnerId"`
	OwnerAlias         string               `xml:"imageOwnerAlias"`
	RootDeviceType     string               `xml:"rootDeviceType"`
	RootDeviceName     string               `xml:"rootDeviceName"`
	VirtualizationType string               `xml:"virtualizationType"`
	Tags               []Tag                `xml:"tagSet>item"`
	Hypervisor         string               `xml:"hypervisor"`
	BlockDevices       []BlockDeviceMapping `xml:"blockDeviceMapping>item"`
}

// Images returns details about available images.
// The ids and filter parameters, if provided, will limit the images returned.
// For example, to get all the private images associated with this account set
// the boolean filter "is-private" to true.
//
// Note: calling this function with nil ids and filter parameters will result in
// a very large number of images being returned.
//
// See http://goo.gl/SRBhW for more details.
func (ec2 *EC2) Images(ids []string, filter *Filter) (resp *ImagesResp, err error) {
	params := makeParams("DescribeImages")
	for i, id := range ids {
		params["ImageId."+strconv.Itoa(i+1)] = id
	}
	filter.addParams(params)

	resp = &ImagesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

type CreateImageResp struct {
	RequestId string `xml:"requestId"`
	ImageId   string `xml:"imageId"`
}

// CreateImage creates an Amazon EBS-backed AMI from an Amazon EBS-backed instance that
// is either running or stopped.
//
// see http://goo.gl/MnMunA for more details.
func (ec2 *EC2) CreateImage(instanceId, name, description string, noReboot bool) (resp *CreateImageResp, err error) {
	params := makeParams("CreateImage")
	params["InstanceId"] = instanceId
	params["Name"] = name
	params["Description"] = description
	if noReboot {
		params["NoReboot"] = "true"
	}

	resp = &CreateImageResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// CopyImage initiates the copy of an AMI from the specified source region to the current region.
//
// see http://docs.aws.amazon.com/AWSEC2/latest/APIReference/ApiReference-query-CopyImage.html for more details.
func (ec2 *EC2) CopyImage(sourceRegion aws.Region, imageId, name, description string) (resp *CreateImageResp, err error) {
	params := makeParams("CopyImage")
	params["SourceRegion"] = sourceRegion.Name
	params["SourceImageId"] = imageId
	params["Name"] = name
	params["Description"] = description

	resp = &CreateImageResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// Response to a CreateSnapshot request.
//
// See http://goo.gl/ttcda for more details.
type CreateSnapshotResp struct {
	RequestId string `xml:"requestId"`
	Snapshot
}

// CreateSnapshot creates a volume snapshot and stores it in S3.
//
// See http://goo.gl/ttcda for more details.
func (ec2 *EC2) CreateSnapshot(volumeId, description string) (resp *CreateSnapshotResp, err error) {
	params := makeParams("CreateSnapshot")
	params["VolumeId"] = volumeId
	params["Description"] = description

	resp = &CreateSnapshotResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DeleteSnapshots deletes the volume snapshots with the given ids.
//
// Note: If you make periodic snapshots of a volume, the snapshots are
// incremental so that only the blocks on the device that have changed
// since your last snapshot are incrementally saved in the new snapshot.
// Even though snapshots are saved incrementally, the snapshot deletion
// process is designed so that you need to retain only the most recent
// snapshot in order to restore the volume.
//
// See http://goo.gl/vwU1y for more details.
func (ec2 *EC2) DeleteSnapshots(ssid string) (resp *SimpleResp, err error) {
	params := makeParams("DeleteSnapshot")
	params["SnapshotId.1"] = ssid

	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}

	return
}

// Response to a DescribeSnapshots request.
//
// See http://goo.gl/nClDT for more details.
type SnapshotsResp struct {
	RequestId string     `xml:"requestId"`
	Snapshots []Snapshot `xml:"snapshotSet>item"`
}

// Snapshot represents details about a volume snapshot.
//
// See http://goo.gl/nkovs for more details.
type Snapshot struct {
	Id          string `xml:"snapshotId"`
	VolumeId    string `xml:"volumeId"`
	VolumeSize  string `xml:"volumeSize"`
	Status      string `xml:"status"`
	StartTime   string `xml:"startTime"`
	Description string `xml:"description"`
	Progress    string `xml:"progress"`
	OwnerId     string `xml:"ownerId"`
	OwnerAlias  string `xml:"ownerAlias"`
	Tags        []Tag  `xml:"tagSet>item"`
}

// Snapshots returns details about volume snapshots available to the user.
// The ids and filter parameters, if provided, limit the snapshots returned.
//
// See http://goo.gl/ogJL4 for more details.
func (ec2 *EC2) Snapshots(ids []string, filter *Filter) (resp *SnapshotsResp, err error) {
	params := makeParams("DescribeSnapshots")
	for i, id := range ids {
		params["SnapshotId."+strconv.Itoa(i+1)] = id
	}
	filter.addParams(params)

	resp = &SnapshotsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// DeregisterImage
//
type DeregisterImageResponse struct {
	RequestId string `xml:"requestId"`
	Response  bool   `xml:"return"`
}

// See
//
func (ec2 *EC2) DeregisterImage(imageId string) (resp *DeregisterImageResponse, err error) {
	params := makeParams("DeregisterImage")
	params["ImageId"] = imageId

	resp = &DeregisterImageResponse{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// ---------------------------------------------------------------------------
// Subnets

type SubnetsResp struct {
	RequestId string   `xml:"requestId"`
	Subnets   []Subnet `xml:"subnetSet>item"`
}

// Subnet represents details about a given VPC subnet
type Subnet struct {
	Id                      string `xml:"subnetId"`
	State                   string `xml:"state"`
	VpcId                   string `xml:"vpcId"`
	CidrBlock               string `xml:"cidrBlock"`
	AvailableIpAddressCount int    `xml:"availableIpAddressCount"`
	AvailabilityZone        string `xml:"availabilityZone"`
	DefaultForAz            bool   `xml:"defaultForAz"`
	MapPublicIpOnLaunch     bool   `xml:"mapPublicIpOnLaunch"`
	Tags                    []Tag  `xml:"tagSet>item"`
}

// Subnets returns details about VPC subnets.
// The ids are filter parameters, if provided, limit the subnets returned.
func (ec2 *EC2) Subnets(ids []string, filter *Filter) (resp *SubnetsResp, err error) {
	params := makeParams("DescribeSubnets")
	for i, id := range ids {
		params["SubnetId."+strconv.Itoa(i+1)] = id
	}
	filter.addParams(params)

	resp = &SubnetsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// ----------------------------------------------------------------------------
// Security group management functions and types.

// SimpleResp represents a response to an EC2 request which on success will
// return no other information besides a request id.
type SimpleResp struct {
	XMLName   xml.Name
	RequestId string `xml:"requestId"`
}

// CreateSecurityGroupResp represents a response to a CreateSecurityGroup request.
type CreateSecurityGroupResp struct {
	SecurityGroup
	RequestId string `xml:"requestId"`
}

// CreateSecurityGroup run a CreateSecurityGroup request in EC2, with the provided
// name and description.
//
// See http://goo.gl/Eo7Yl for more details.
func (ec2 *EC2) CreateSecurityGroup(name, description string) (resp *CreateSecurityGroupResp, err error) {
	params := makeParams("CreateSecurityGroup")
	params["GroupName"] = name
	params["GroupDescription"] = description

	resp = &CreateSecurityGroupResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	resp.Name = name
	return resp, nil
}

// SecurityGroupsResp represents a response to a DescribeSecurityGroups
// request in EC2.
//
// See http://goo.gl/k12Uy for more details.
type SecurityGroupsResp struct {
	RequestId string              `xml:"requestId"`
	Groups    []SecurityGroupInfo `xml:"securityGroupInfo>item"`
}

// SecurityGroup encapsulates details for a security group in EC2.
//
// See http://goo.gl/CIdyP for more details.
type SecurityGroupInfo struct {
	SecurityGroup
	OwnerId       string   `xml:"ownerId"`
	Description   string   `xml:"groupDescription"`
	IPPerms       []IPPerm `xml:"ipPermissions>item"`
	IPPermsEgress []IPPerm `xml:"ipPermissionsEgress>item"`
	VpcId         string   `xml:"vpcId"`
	Tags          []Tag    `xml:"tagSet>item"`
}

// IPPerm represents an allowance within an EC2 security group.
//
// See http://goo.gl/4oTxv for more details.
type IPPerm struct {
	Protocol     string              `xml:"ipProtocol"`
	FromPort     int                 `xml:"fromPort"`
	ToPort       int                 `xml:"toPort"`
	SourceIPs    []string            `xml:"ipRanges>item>cidrIp"`
	SourceGroups []UserSecurityGroup `xml:"groups>item"`
}

// UserSecurityGroup holds a security group and the owner
// of that group.
type UserSecurityGroup struct {
	Id      string `xml:"groupId"`
	Name    string `xml:"groupName"`
	OwnerId string `xml:"userId"`
}

// SecurityGroup represents an EC2 security group.
// If SecurityGroup is used as a parameter, then one of Id or Name
// may be empty. If both are set, then Id is used.
type SecurityGroup struct {
	Id   string `xml:"groupId"`
	Name string `xml:"groupName"`
}

// SecurityGroupNames is a convenience function that
// returns a slice of security groups with the given names.
func SecurityGroupNames(names ...string) []SecurityGroup {
	g := make([]SecurityGroup, len(names))
	for i, name := range names {
		g[i] = SecurityGroup{Name: name}
	}
	return g
}

// SecurityGroupNames is a convenience function that
// returns a slice of security groups with the given ids.
func SecurityGroupIds(ids ...string) []SecurityGroup {
	g := make([]SecurityGroup, len(ids))
	for i, id := range ids {
		g[i] = SecurityGroup{Id: id}
	}
	return g
}

// SecurityGroups returns details about security groups in EC2.  Both parameters
// are optional, and if provided will limit the security groups returned to those
// matching the given groups or filtering rules.
//
// See http://goo.gl/k12Uy for more details.
func (ec2 *EC2) SecurityGroups(groups []SecurityGroup, filter *Filter) (resp *SecurityGroupsResp, err error) {
	params := makeParams("DescribeSecurityGroups")
	i, j := 1, 1
	for _, g := range groups {
		if g.Id != "" {
			params["GroupId."+strconv.Itoa(i)] = g.Id
			i++
		} else {
			params["GroupName."+strconv.Itoa(j)] = g.Name
			j++
		}
	}
	filter.addParams(params)

	resp = &SecurityGroupsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteSecurityGroup removes the given security group in EC2.
//
// See http://goo.gl/QJJDO for more details.
func (ec2 *EC2) DeleteSecurityGroup(group SecurityGroup) (resp *SimpleResp, err error) {
	params := makeParams("DeleteSecurityGroup")
	if group.Id != "" {
		params["GroupId"] = group.Id
	} else {
		params["GroupName"] = group.Name
	}

	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AuthorizeSecurityGroup creates an allowance for clients matching the provided
// rules to access instances within the given security group.
//
// See http://goo.gl/u2sDJ for more details.
func (ec2 *EC2) AuthorizeSecurityGroup(group SecurityGroup, perms []IPPerm) (resp *SimpleResp, err error) {
	return ec2.authOrRevoke("AuthorizeSecurityGroupIngress", group, perms)
}

// RevokeSecurityGroup revokes permissions from a group.
//
// See http://goo.gl/ZgdxA for more details.
func (ec2 *EC2) RevokeSecurityGroup(group SecurityGroup, perms []IPPerm) (resp *SimpleResp, err error) {
	return ec2.authOrRevoke("RevokeSecurityGroupIngress", group, perms)
}

func (ec2 *EC2) authOrRevoke(op string, group SecurityGroup, perms []IPPerm) (resp *SimpleResp, err error) {
	params := makeParams(op)
	if group.Id != "" {
		params["GroupId"] = group.Id
	} else {
		params["GroupName"] = group.Name
	}

	for i, perm := range perms {
		prefix := "IpPermissions." + strconv.Itoa(i+1)
		params[prefix+".IpProtocol"] = perm.Protocol
		params[prefix+".FromPort"] = strconv.Itoa(perm.FromPort)
		params[prefix+".ToPort"] = strconv.Itoa(perm.ToPort)
		for j, ip := range perm.SourceIPs {
			params[prefix+".IpRanges."+strconv.Itoa(j+1)+".CidrIp"] = ip
		}
		for j, g := range perm.SourceGroups {
			subprefix := prefix + ".Groups." + strconv.Itoa(j+1)
			if g.OwnerId != "" {
				params[subprefix+".UserId"] = g.OwnerId
			}
			if g.Id != "" {
				params[subprefix+".GroupId"] = g.Id
			} else {
				params[subprefix+".GroupName"] = g.Name
			}
		}
	}

	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ResourceTag represents key-value metadata used to classify and organize
// EC2 instances.
//
// See http://goo.gl/bncl3 for more details
type Tag struct {
	Key   string `xml:"key"`
	Value string `xml:"value"`
}

// CreateTags adds or overwrites one or more tags for the specified instance ids.
//
// See http://goo.gl/Vmkqc for more details
func (ec2 *EC2) CreateTags(instIds []string, tags []Tag) (resp *SimpleResp, err error) {
	params := makeParams("CreateTags")
	addParamsList(params, "ResourceId", instIds)

	for j, tag := range tags {
		params["Tag."+strconv.Itoa(j+1)+".Key"] = tag.Key
		params["Tag."+strconv.Itoa(j+1)+".Value"] = tag.Value
	}

	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteTags deletes the specified set of tags from the specified set of resources.
//
// See http://goo.gl/t6XvYh for more details
func (ec2 *EC2) DeleteTags(instIds []string, tags []Tag) (resp *SimpleResp, err error) {
	params := makeParams("DeleteTags")
	addParamsList(params, "ResourceId", instIds)

	for j, tag := range tags {
		params["Tag."+strconv.Itoa(j+1)+".Key"] = tag.Key
	}

	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribedTag represents key-value metadata used to classify and organize EC2
// instances. Also includes the Resource ID and type the tag is attached to
//
// See http://goo.gl/hgJjO7 for more details.
type DescribedTag struct {
	ResourceId   string `xml:"resourceId"`
	ResourceType string `xml:"resourceType"`
	Key          string `xml:"key"`
	Value        string `xml:"value"`
}

// Response to a DescribeTags request.
//
// See http://goo.gl/hgJjO7 for more details.
type DescribeTagsResp struct {
	RequestId string         `xml:"requestId"`
	Tags      []DescribedTag `xml:"tagSet>item"`
}

// DescribeTags returns tags about one or more EC2 Resources. Returned tags can
// be filtered.
//
// See http://goo.gl/hgJjO7 for more details.
func (ec2 *EC2) DescribeTags(filter *Filter) (resp *DescribeTagsResp, err error) {
	params := makeParams("DescribeTags")
	filter.addParams(params)
	resp = &DescribeTagsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return
}

// Response to a StartInstances request.
//
// See http://goo.gl/awKeF for more details.
type StartInstanceResp struct {
	RequestId    string                `xml:"requestId"`
	StateChanges []InstanceStateChange `xml:"instancesSet>item"`
}

// Response to a StopInstances request.
//
// See http://goo.gl/436dJ for more details.
type StopInstanceResp struct {
	RequestId    string                `xml:"requestId"`
	StateChanges []InstanceStateChange `xml:"instancesSet>item"`
}

// StartInstances starts an Amazon EBS-backed AMI that you've previously stopped.
//
// See http://goo.gl/awKeF for more details.
func (ec2 *EC2) StartInstances(ids ...string) (resp *StartInstanceResp, err error) {
	params := makeParams("StartInstances")
	addParamsList(params, "InstanceId", ids)
	resp = &StartInstanceResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// StopInstances requests stopping one or more Amazon EBS-backed instances.
//
// See http://goo.gl/436dJ for more details.
func (ec2 *EC2) StopInstances(ids ...string) (resp *StopInstanceResp, err error) {
	params := makeParams("StopInstances")
	addParamsList(params, "InstanceId", ids)
	resp = &StopInstanceResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// RebootInstance requests a reboot of one or more instances. This operation is asynchronous;
// it only queues a request to reboot the specified instance(s). The operation will succeed
// if the instances are valid and belong to you.
//
// Requests to reboot terminated instances are ignored.
//
// See http://goo.gl/baoUf for more details.
func (ec2 *EC2) RebootInstances(ids ...string) (resp *SimpleResp, err error) {
	params := makeParams("RebootInstances")
	addParamsList(params, "InstanceId", ids)
	resp = &SimpleResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Reserved Instances

// Structures

// DescribeReservedInstancesResponse structure returned from a DescribeReservedInstances request.
//
// See
type DescribeReservedInstancesResponse struct {
	RequestId         string                          `xml:"requestId"`
	ReservedInstances []ReservedInstancesResponseItem `xml:"reservedInstancesSet>item"`
}

//
//
// See
type ReservedInstancesResponseItem struct {
	ReservedInstanceId string            `xml:"reservedInstancesId"`
	InstanceType       string            `xml:"instanceType"`
	AvailabilityZone   string            `xml:"availabilityZone"`
	Start              string            `xml:"start"`
	Duration           uint64            `xml:"duration"`
	End                string            `xml:"end"`
	FixedPrice         float32           `xml:"fixedPrice"`
	UsagePrice         float32           `xml:"usagePrice"`
	InstanceCount      int               `xml:"instanceCount"`
	ProductDescription string            `xml:"productDescription"`
	State              string            `xml:"state"`
	Tags               []Tag             `xml:"tagSet->item"`
	InstanceTenancy    string            `xml:"instanceTenancy"`
	CurrencyCode       string            `xml:"currencyCode"`
	OfferingType       string            `xml:"offeringType"`
	RecurringCharges   []RecurringCharge `xml:"recurringCharges>item"`
}

//
//
// See
type RecurringCharge struct {
	Frequency string  `xml:"frequency"`
	Amount    float32 `xml:"amount"`
}

// functions
// DescribeReservedInstances
//
// See
func (ec2 *EC2) DescribeReservedInstances(instIds []string, filter *Filter) (resp *DescribeReservedInstancesResponse, err error) {
	params := makeParams("DescribeReservedInstances")

	for i, id := range instIds {
		params["ReservedInstancesId."+strconv.Itoa(i+1)] = id
	}
	filter.addParams(params)

	resp = &DescribeReservedInstancesResponse{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

type SystemStateStruct struct {
	StatusName string `xml:"status"`
	Name       string `xml:"details>item>name"`
	Status     string `xml:"details>item>status"`
	Since      string `xml:"details>item>impairedSince"`
}
type EventSetStruct struct {
	EventCode   string `xml:"item>code"`
	Description string `xml:"item>description"`
	NotBefore   string `xml:"item>notBefore"`
	NotAfter    string `xml:"item>notAfter"`
}
type InstanceStatus struct {
	InstanceId       string            `xml:"instanceId"`
	AvailabilityZone string            `xml:"availabilityZone"`
	InstanceState    string            `xml:"instanceState>name"`
	InstanceStatus   SystemStateStruct `xml:"instanceStatus"`
	SystemStatus     SystemStateStruct `xml:"systemStatus"`
	EventDetails     EventSetStruct    `xml:"eventsSet"`
}
type DescribeInstanceStatusResponse struct {
	RequestId        string           `xml:"requestId"`
	InstanceStatuses []InstanceStatus `xml:"instanceStatusSet>item"`
}

func (ec2 *EC2) DescribeInstanceStatus(instIds []string, filter *Filter) (resp *DescribeInstanceStatusResponse, err error) {
	params := makeParams("DescribeInstanceStatus")
	addParamsList(params, "InstanceId", instIds)
	filter.addParams(params)
	resp = &DescribeInstanceStatusResponse{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type AttachmentSetStruct struct {
	VolumeId            string `xml:"volumeId"`
	InstanceId          string `xml:"instanceId"`
	Device              string `xml:"device"`
	Status              string `xml:"status"`
	AttachTime          string `xml:"attachTime"`
	DeleteOnTermination bool   `xml:"deleteOnTermination"`
}

type VolumeStruct struct {
	VolumeId         string              `xml:"volumeId"`
	Size             int                 `xml:"size"`
	SnapShotId       string              `xml:"snapshotId"`
	AvailabilityZone string              `xml:"availabilityZone"`
	Status           string              `xml:"status"`
	CreateTime       string              `xml:"createTime"`
	AttachmentSet    AttachmentSetStruct `xml:"attachmentSet>item"`
	VolumeType       string              `xml:"volumeType"`
	Encrypted        string              `xml:"encrypted"`
}

type DescribeVolumesResp struct {
	RequestId string         `xml:"requestId"`
	Volumes   []VolumeStruct `xml:"volumeSet>item"`
}

func (ec2 *EC2) DescribeVolumes(volIds []string, filter *Filter) (resp *DescribeVolumesResp, err error) {
	params := makeParams("DescribeVolumes")
	addParamsList(params, "VolumeId", volIds)
	filter.addParams(params)
	resp = &DescribeVolumesResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type AttachVolumeResp struct {
	RequestId  string `xml:"requestId"`
	VolumeId   string `xml:"volumeId"`
	InstanceId string `xml:"instanceId"`
	Device     string `xml:"device"`
	Status     string `xml:"status"`
	AttachTime string `xml:"attachTime"`
}

func (ec2 *EC2) AttachVolume(volId string, InstId string, devName string) (resp *AttachVolumeResp, err error) {
	params := makeParams("AttachVolume")
	params["VolumeId"] = volId
	params["InstanceId"] = InstId
	params["Device"] = devName

	resp = &AttachVolumeResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type CreateVolumeOptions struct {
	Size             string
	SnapshotId       string
	AvailabilityZone string
	VolumeType       string
	IOPS             int
	Encrypted        bool
	KmsKeyId         string
}

type CreateVolumeResp struct {
	RequestId        string `xml:"requestId"`
	VolumeId         string `xml:"volumeId"`
	Size             string `xml:"size"`
	SnapshotId       string `xml:"snapshotId"`
	AvailabilityZone string `xml:"availabilityZone"`
	Status           string `xml:"status"`
	CreateTime       string `xml:"createTime"`
	VolumeType       string `xml:"volumeType"`
	IOPS             int    `xml:"iops"`
	Encrypted        bool   `xml:"encrypted"`
	KmsKeyId         string `xml:"kmsKeyId"`
}

// CreateVolume creates an Amazon EBS volume that can be attached to an instance in the same Availability Zone.
//
// See http://goo.gl/DERo1w for more details.
func (ec2 *EC2) CreateVolume(options CreateVolumeOptions) (resp *CreateVolumeResp, err error) {
	params := makeParams("CreateVolume")
	params["AvailabilityZone"] = options.AvailabilityZone

	if options.Size != "" {
		params["Size"] = options.Size
	}
	if options.SnapshotId != "" {
		params["SnapshotId"] = options.SnapshotId
	}
	if options.VolumeType != "" {
		params["VolumeType"] = options.VolumeType
	}
	if options.IOPS > 0 {
		params["Iops"] = strconv.Itoa(options.IOPS)
	}
	if options.Encrypted {
		params["Encrypted"] = "true"
	}
	if options.KmsKeyId != "" {
		params["KmsKeyId"] = options.KmsKeyId
	}

	resp = &CreateVolumeResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type VpcStruct struct {
	VpcId           string `xml:"vpcId"`
	State           string `xml:"state"`
	CidrBlock       string `xml:"cidrBlock"`
	DhcpOptionsId   string `xml:"dhcpOptionsId"`
	InstanceTenancy string `xml:"instanceTenancy"`
	IsDefault       bool   `xml:"isDefault"`
}

type DescribeVpcsResp struct {
	RequestId string      `xml:"requestId"`
	Vpcs      []VpcStruct `xml:"vpcSet>item"`
}

func (ec2 *EC2) DescribeVpcs(vpcIds []string, filter *Filter) (resp *DescribeVpcsResp, err error) {
	params := makeParams("DescribeVpcs")
	addParamsList(params, "vpcId", vpcIds)
	filter.addParams(params)
	resp = &DescribeVpcsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type VpnConnectionStruct struct {
	VpnConnectionId   string `xml:"vpnConnectionId"`
	State             string `xml:"state"`
	Type              string `xml:"type"`
	CustomerGatewayId string `xml:"customerGatewayId"`
	VpnGatewayId      string `xml:"vpnGatewayId"`
}

type DescribeVpnConnectionsResp struct {
	RequestId      string                `xml:"requestId"`
	VpnConnections []VpnConnectionStruct `xml:"vpnConnectionSet>item"`
}

func (ec2 *EC2) DescribeVpnConnections(VpnConnectionIds []string, filter *Filter) (resp *DescribeVpnConnectionsResp, err error) {
	params := makeParams("DescribeVpnConnections")
	addParamsList(params, "VpnConnectionId", VpnConnectionIds)
	filter.addParams(params)
	resp = &DescribeVpnConnectionsResp{}
	err = ec2.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, err
}

type VpnGatewayStruct struct {
	VpnGatewayId     string `xml:"vpnGatewayId"`
	State            string `xml:"state"`
	Type             string `xml:"type"`
	AvailabilityZone string `xml:"availabilityZone"`
	AttachedVpcId    string `xml:"attachments>item>vpcId"`
	AttachState      string `xml:"attachments>item>state"`
}

type DescribeVpnGatewaysResp struct {
	RequestId  string             `xml:"requestId"`
	VpnGateway []VpnGatewayStruct `xml:"vpnGatewaySet>item"`
}

func (ec2 *EC2) DescribeVpnGateways(VpnGatewayIds []string, filter *Filter) (resp *DescribeVpnGatewaysResp, err error) {
	params := makeParams("DescribeVpnGateways")
	addParamsList(params, "VpnGatewayIds", VpnGatewayIds)
	filter.addParams(params)
	resp = &DescribeVpnGatewaysResp{}
	if err = ec2.query(params, resp); err != nil {
		return nil, err
	}
	return resp, err
}

type InternetGatewayStruct struct {
	InternetGatewayId string `xml:"internetGatewayId"`
	AttachedVpcId     string `xml:"attachmentSet>item>vpcId"`
	AttachState       string `xml:"attachmentSet>item>state"`
}

type DescribeInternetGatewaysResp struct {
	RequestId       string                  `xml:"requestId"`
	InternetGateway []InternetGatewayStruct `xml:"internetGatewaySet>item"`
}

func (ec2 *EC2) DescribeInternetGateways(InternetGatewayIds []string, filter *Filter) (resp *DescribeInternetGatewaysResp, err error) {
	params := makeParams("DescribeInternetGateways")
	addParamsList(params, "InternetGatewayId", InternetGatewayIds)
	filter.addParams(params)
	resp = &DescribeInternetGatewaysResp{}
	if err = ec2.query(params, resp); err != nil {
		return nil, err
	}
	return resp, err
}
