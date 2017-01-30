//
// autoscaling: This package provides types and functions to interact with the AWS Auto Scale API
//
// Depends on https://wiki.ubuntu.com/goamz
//

package autoscaling

import (
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/goamz/goamz/aws"
)

const debug = false

var timeNow = time.Now

// AutoScaling contains the details of the AWS region to perform operations against.
type AutoScaling struct {
	aws.Auth
	aws.Region
}

// New creates a new AutoScaling Client.
func New(auth aws.Auth, region aws.Region) *AutoScaling {
	return &AutoScaling{auth, region}
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

// Error encapsulates an error returned by the AWS Auto Scaling API.
//
// See http://goo.gl/VZGuC for more details.
type Error struct {
	// HTTP status code (200, 403, ...)
	StatusCode int
	// AutoScaling error code ("UnsupportedOperation", ...)
	Code string
	// The error type
	Type string
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

type xmlErrors struct {
	RequestId string  `xml:"RequestId"`
	Errors    []Error `xml:"Error"`
}

func (as *AutoScaling) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2011-01-01"
	data := strings.NewReader(multimap(params).Encode())

	hreq, err := http.NewRequest("POST", as.Region.AutoScalingEndpoint+"/", data)
	if err != nil {
		return err
	}

	hreq.Header.Set("Content-Type", "application/x-www-form-urlencoded; param=value")

	token := as.Auth.Token()
	if token != "" {
		hreq.Header.Set("X-Amz-Security-Token", token)
	}

	signer := aws.NewV4Signer(as.Auth, "autoscaling", as.Region)
	signer.Sign(hreq)

	if debug {
		log.Printf("%v -> {\n", hreq)
	}
	r, err := http.DefaultClient.Do(hreq)

	if err != nil {
		log.Printf("Error calling Amazon %v", err)
		return err
	}

	defer r.Body.Close()

	if debug {
		dump, _ := httputil.DumpResponse(r, true)
		log.Printf("response:\n")
		log.Printf("%v\n}\n", string(dump))
	}
	if r.StatusCode != 200 {
		return buildError(r)
	}
	err = xml.NewDecoder(r.Body).Decode(resp)
	return err
}

func buildError(r *http.Response) error {
	var (
		err    Error
		errors xmlErrors
	)
	xml.NewDecoder(r.Body).Decode(&errors)
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

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
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
// Filtering helper.

// Filter builds filtering parameters to be used in an autoscaling query which supports
// filtering.  For example:
//
//     filter := NewFilter()
//     filter.Add("architecture", "i386")
//     filter.Add("launch-index", "0")
//     resp, err := as.DescribeTags(filter,nil,nil)
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
			prefix := "Filters.member." + strconv.Itoa(i+1)
			params[prefix+".Name"] = k
			for j, v := range f.m[k] {
				params[prefix+".Values.member."+strconv.Itoa(j+1)] = v
			}
		}
	}
}

// ----------------------------------------------------------------------------
// Auto Scaling base types and related functions.

// SimpleResp is the basic response from most actions.
type SimpleResp struct {
	XMLName   xml.Name
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// EnabledMetric encapsulates a metric associated with an Auto Scaling Group
//
// See http://goo.gl/hXiH17 for more details
type EnabledMetric struct {
	Granularity string `xml:"Granularity"` // The granularity of the enabled metric.
	Metric      string `xml:"Metric"`      // The name of the enabled metric.
}

// Instance encapsulates an instance type as returned by the Auto Scaling API
//
// See http://goo.gl/NwBxGh and http://goo.gl/OuoqhS for more details.
type Instance struct {
	// General instance information
	AutoScalingGroupName    string `xml:"AutoScalingGroupName"`
	AvailabilityZone        string `xml:"AvailabilityZone"`
	HealthStatus            string `xml:"HealthStatus"`
	InstanceId              string `xml:"InstanceId"`
	LaunchConfigurationName string `xml:"LaunchConfigurationName"`
	LifecycleState          string `xml:"LifecycleState"`
}

// SuspenedProcess encapsulates an Auto Scaling process that has been suspended
//
// See http://goo.gl/iObPgF for more details
type SuspendedProcess struct {
	ProcessName      string `xml:"ProcessName"`
	SuspensionReason string `xml:"SuspensionReason"`
}

// Tag encapsulates tag applied to an Auto Scaling group.
//
// See http://goo.gl/MG1hqs for more details
type Tag struct {
	Key               string `xml:"Key"`
	PropagateAtLaunch bool   `xml:"PropagateAtLaunch"` // Specifies whether the new tag will be applied to instances launched after the tag is created
	ResourceId        string `xml:"ResourceId"`        // the name of the Auto Scaling group - not required if creating ASG
	ResourceType      string `xml:"ResourceType"`      // currently only auto-scaling-group is supported - not required if creating ASG
	Value             string `xml:"Value"`
}

// AutoScalingGroup encapsulates an Auto Scaling Group object
//
// See http://goo.gl/fJdYhg for more details.
type AutoScalingGroup struct {
	AutoScalingGroupARN     string             `xml:"AutoScalingGroupARN"`
	AutoScalingGroupName    string             `xml:"AutoScalingGroupName"`
	AvailabilityZones       []string           `xml:"AvailabilityZones>member"`
	CreatedTime             time.Time          `xml:"CreatedTime"`
	DefaultCooldown         int                `xml:"DefaultCooldown"`
	DesiredCapacity         int                `xml:"DesiredCapacity"`
	EnabledMetrics          []EnabledMetric    `xml:"EnabledMetric>member"`
	HealthCheckGracePeriod  int                `xml:"HealthCheckGracePeriod"`
	HealthCheckType         string             `xml:"HealthCheckType"`
	Instances               []Instance         `xml:"Instances>member"`
	LaunchConfigurationName string             `xml:"LaunchConfigurationName"`
	LoadBalancerNames       []string           `xml:"LoadBalancerNames>member"`
	MaxSize                 int                `xml:"MaxSize"`
	MinSize                 int                `xml:"MinSize"`
	PlacementGroup          string             `xml:"PlacementGroup"`
	Status                  string             `xml:"Status"`
	SuspendedProcesses      []SuspendedProcess `xml:"SuspendedProcesses>member"`
	Tags                    []Tag              `xml:"Tags>member"`
	TerminationPolicies     []string           `xml:"TerminationPolicies>member"`
	VPCZoneIdentifier       string             `xml:"VPCZoneIdentifier"`
}

// CreateAutoScalingGroupParams type encapsulates options for the respective request.
//
// See http://goo.gl/3S13Bv for more details.
type CreateAutoScalingGroupParams struct {
	AutoScalingGroupName    string
	AvailabilityZones       []string
	DefaultCooldown         int
	DesiredCapacity         int
	HealthCheckGracePeriod  int
	HealthCheckType         string
	InstanceId              string
	LaunchConfigurationName string
	LoadBalancerNames       []string
	MaxSize                 int
	MinSize                 int
	PlacementGroup          string
	Tags                    []Tag
	TerminationPolicies     []string
	VPCZoneIdentifier       string
}

// AttachInstances Attach running instances to an autoscaling group
//
// See http://goo.gl/zDZbuQ for more details.
func (as *AutoScaling) AttachInstances(name string, instanceIds []string) (resp *SimpleResp, err error) {
	params := makeParams("AttachInstances")
	params["AutoScalingGroupName"] = name

	for i, id := range instanceIds {
		key := fmt.Sprintf("InstanceIds.member.%d", i+1)
		params[key] = id
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateAutoScalingGroup creates an Auto Scaling Group on AWS
//
// Required params: AutoScalingGroupName, MinSize, MaxSize
//
// See http://goo.gl/3S13Bv for more details.
func (as *AutoScaling) CreateAutoScalingGroup(options *CreateAutoScalingGroupParams) (
	resp *SimpleResp, err error) {
	params := makeParams("CreateAutoScalingGroup")

	params["AutoScalingGroupName"] = options.AutoScalingGroupName
	params["MaxSize"] = strconv.Itoa(options.MaxSize)
	params["MinSize"] = strconv.Itoa(options.MinSize)
	params["DesiredCapacity"] = strconv.Itoa(options.DesiredCapacity)

	if options.DefaultCooldown > 0 {
		params["DefaultCooldown"] = strconv.Itoa(options.DefaultCooldown)
	}
	if options.HealthCheckGracePeriod > 0 {
		params["HealthCheckGracePeriod"] = strconv.Itoa(options.HealthCheckGracePeriod)
	}
	if options.HealthCheckType != "" {
		params["HealthCheckType"] = options.HealthCheckType
	}
	if options.InstanceId != "" {
		params["InstanceId"] = options.InstanceId
	}
	if options.LaunchConfigurationName != "" {
		params["LaunchConfigurationName"] = options.LaunchConfigurationName
	}
	if options.PlacementGroup != "" {
		params["PlacementGroup"] = options.PlacementGroup
	}
	if options.VPCZoneIdentifier != "" {
		params["VPCZoneIdentifier"] = options.VPCZoneIdentifier
	}
	if len(options.LoadBalancerNames) > 0 {
		addParamsList(params, "LoadBalancerNames.member", options.LoadBalancerNames)
	}
	if len(options.AvailabilityZones) > 0 {
		addParamsList(params, "AvailabilityZones.member", options.AvailabilityZones)
	}
	if len(options.TerminationPolicies) > 0 {
		addParamsList(params, "TerminationPolicies.member", options.TerminationPolicies)
	}
	for i, t := range options.Tags {
		key := "Tags.member.%d.%s"
		index := i + 1
		params[fmt.Sprintf(key, index, "Key")] = t.Key
		params[fmt.Sprintf(key, index, "Value")] = t.Value
		params[fmt.Sprintf(key, index, "PropagateAtLaunch")] = strconv.FormatBool(t.PropagateAtLaunch)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// EBS represents the AWS EBS volume data type
//
// See http://goo.gl/nDUL2h for more details
type EBS struct {
	DeleteOnTermination bool   `xml:"DeleteOnTermination"`
	Iops                int    `xml:"Iops"`
	SnapshotId          string `xml:"SnapshotId"`
	VolumeSize          int    `xml:"VolumeSize"`
	VolumeType          string `xml:"VolumeType"`
}

// BlockDeviceMapping represents the association of a block device with ebs volume.
//
// See http://goo.gl/wEGwkU for more details.
type BlockDeviceMapping struct {
	DeviceName  string `xml:"DeviceName"`
	Ebs         EBS    `xml:"Ebs"`
	NoDevice    bool   `xml:"NoDevice"`
	VirtualName string `xml:"VirtualName"`
}

// InstanceMonitoring data type
//
// See http://goo.gl/TfaPwz for more details
type InstanceMonitoring struct {
	Enabled bool `xml:"Enabled"`
}

// LaunchConfiguration encapsulates the LaunchConfiguration Data Type
//
// See http://goo.gl/TOJunp
type LaunchConfiguration struct {
	AssociatePublicIpAddress bool                 `xml:"AssociatePublicIpAddress"`
	BlockDeviceMappings      []BlockDeviceMapping `xml:"BlockDeviceMappings>member"`
	CreatedTime              time.Time            `xml:"CreatedTime"`
	EbsOptimized             bool                 `xml:"EbsOptimized"`
	IamInstanceProfile       string               `xml:"IamInstanceProfile"`
	ImageId                  string               `xml:"ImageId"`
	InstanceId               string               `xml:"InstanceId"`
	InstanceMonitoring       InstanceMonitoring   `xml:"InstanceMonitoring"`
	InstanceType             string               `xml:"InstanceType"`
	KernelId                 string               `xml:"KernelId"`
	KeyName                  string               `xml:"KeyName"`
	LaunchConfigurationARN   string               `xml:"LaunchConfigurationARN"`
	LaunchConfigurationName  string               `xml:"LaunchConfigurationName"`
	RamdiskId                string               `xml:"RamdiskId"`
	SecurityGroups           []string             `xml:"SecurityGroups>member"`
	SpotPrice                string               `xml:"SpotPrice"`
	UserData                 string               `xml:"UserData"`
}

// CreateLaunchConfiguration creates a launch configuration
//
// Required params: AutoScalingGroupName, MinSize, MaxSize
//
// See http://goo.gl/8e0BSF for more details.
func (as *AutoScaling) CreateLaunchConfiguration(lc *LaunchConfiguration) (
	resp *SimpleResp, err error) {

	var b64 = base64.StdEncoding

	params := makeParams("CreateLaunchConfiguration")
	params["LaunchConfigurationName"] = lc.LaunchConfigurationName

	if lc.AssociatePublicIpAddress {
		params["AssociatePublicIpAddress"] = strconv.FormatBool(lc.AssociatePublicIpAddress)
	}
	if lc.EbsOptimized {
		params["EbsOptimized"] = strconv.FormatBool(lc.EbsOptimized)
	}
	if lc.IamInstanceProfile != "" {
		params["IamInstanceProfile"] = lc.IamInstanceProfile
	}
	if lc.ImageId != "" {
		params["ImageId"] = lc.ImageId
	}
	if lc.InstanceId != "" {
		params["InstanceId"] = lc.InstanceId
	}
	if lc.InstanceMonitoring != (InstanceMonitoring{}) {
		params["InstanceMonitoring.Enabled"] = strconv.FormatBool(lc.InstanceMonitoring.Enabled)
	}
	if lc.InstanceType != "" {
		params["InstanceType"] = lc.InstanceType
	}
	if lc.KernelId != "" {
		params["KernelId"] = lc.KernelId
	}
	if lc.KeyName != "" {
		params["KeyName"] = lc.KeyName
	}
	if lc.RamdiskId != "" {
		params["RamdiskId"] = lc.RamdiskId
	}
	if lc.SpotPrice != "" {
		params["SpotPrice"] = lc.SpotPrice
	}
	if lc.UserData != "" {
		params["UserData"] = b64.EncodeToString([]byte(lc.UserData))
	}

	// Add our block device mappings
	for i, bdm := range lc.BlockDeviceMappings {
		key := "BlockDeviceMappings.member.%d.%s"
		index := i + 1
		params[fmt.Sprintf(key, index, "DeviceName")] = bdm.DeviceName
		params[fmt.Sprintf(key, index, "VirtualName")] = bdm.VirtualName

		if bdm.NoDevice {
			params[fmt.Sprintf(key, index, "NoDevice")] = "true"
		}

		if bdm.Ebs != (EBS{}) {
			key := "BlockDeviceMappings.member.%d.Ebs.%s"

			// Defaults to true
			params[fmt.Sprintf(key, index, "DeleteOnTermination")] = strconv.FormatBool(bdm.Ebs.DeleteOnTermination)

			if bdm.Ebs.Iops > 0 {
				params[fmt.Sprintf(key, index, "Iops")] = strconv.Itoa(bdm.Ebs.Iops)
			}
			if bdm.Ebs.SnapshotId != "" {
				params[fmt.Sprintf(key, index, "SnapshotId")] = bdm.Ebs.SnapshotId
			}
			if bdm.Ebs.VolumeSize > 0 {
				params[fmt.Sprintf(key, index, "VolumeSize")] = strconv.Itoa(bdm.Ebs.VolumeSize)
			}
			if bdm.Ebs.VolumeType != "" {
				params[fmt.Sprintf(key, index, "VolumeType")] = bdm.Ebs.VolumeType
			}
		}
	}

	if len(lc.SecurityGroups) > 0 {
		addParamsList(params, "SecurityGroups.member", lc.SecurityGroups)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateOrUpdateTags creates or updates Auto Scaling Group Tags
//
// See http://goo.gl/e1UIXb for more details.
func (as *AutoScaling) CreateOrUpdateTags(tags []Tag) (resp *SimpleResp, err error) {
	params := makeParams("CreateOrUpdateTags")

	for i, t := range tags {
		key := "Tags.member.%d.%s"
		index := i + 1
		params[fmt.Sprintf(key, index, "Key")] = t.Key
		params[fmt.Sprintf(key, index, "Value")] = t.Value
		params[fmt.Sprintf(key, index, "PropagateAtLaunch")] = strconv.FormatBool(t.PropagateAtLaunch)
		params[fmt.Sprintf(key, index, "ResourceId")] = t.ResourceId
		if t.ResourceType != "" {
			params[fmt.Sprintf(key, index, "ResourceType")] = t.ResourceType
		} else {
			params[fmt.Sprintf(key, index, "ResourceType")] = "auto-scaling-group"
		}
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type CompleteLifecycleActionParams struct {
	AutoScalingGroupName  string
	LifecycleActionResult string
	LifecycleActionToken  string
	LifecycleHookName     string
}

// CompleteLifecycleAction completes the lifecycle action for the associated token initiated under the given lifecycle hook with the specified result.
//
// Part of the basic sequence for adding a lifecycle hook to an Auto Scaling group:
// 1) Create a notification target (SQS queue || SNS Topic)
// 2) Create an IAM role to allow the ASG topublish lifecycle notifications to the designated SQS queue or SNS topic
// 3) Create the lifecycle hook. You can create a hook that acts when instances launch or when instances terminate
// 4) If necessary, record the lifecycle action heartbeat to keep the instance in a pending state
// 5) ***Complete the lifecycle action***
//
// See http://goo.gl/k4fl0p for more details
func (as *AutoScaling) CompleteLifecycleAction(options *CompleteLifecycleActionParams) (
	resp *SimpleResp, err error) {
	params := makeParams("CompleteLifecycleAction")

	params["AutoScalingGroupName"] = options.AutoScalingGroupName
	params["LifecycleActionResult"] = options.LifecycleActionResult
	params["LifecycleActionToken"] = options.LifecycleActionToken
	params["LifecycleHookName"] = options.LifecycleHookName

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteAutoScalingGroup deletes an Auto Scaling Group
//
// See http://goo.gl/us7VSffor for more details.
func (as *AutoScaling) DeleteAutoScalingGroup(asgName string, forceDelete bool) (
	resp *SimpleResp, err error) {
	params := makeParams("DeleteAutoScalingGroup")
	params["AutoScalingGroupName"] = asgName

	if forceDelete {
		params["ForceDelete"] = "true"
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteLaunchConfiguration deletes a Launch Configuration
//
// See http://goo.gl/xksfyR for more details.
func (as *AutoScaling) DeleteLaunchConfiguration(name string) (resp *SimpleResp, err error) {
	params := makeParams("DeleteLaunchConfiguration")
	params["LaunchConfigurationName"] = name

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteLifecycleHook eletes the specified lifecycle hook.
// If there are any outstanding lifecycle actions, they are completed first
//
// See http://goo.gl/MwX1vG for more details.
func (as *AutoScaling) DeleteLifecycleHook(asgName, lifecycleHookName string) (resp *SimpleResp, err error) {
	params := makeParams("DeleteLifecycleHook")
	params["AutoScalingGroupName"] = asgName
	params["LifecycleHookName"] = lifecycleHookName

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteNotificationConfiguration deletes notifications created by PutNotificationConfiguration.
//
// See http://goo.gl/jTqoYz for more details
func (as *AutoScaling) DeleteNotificationConfiguration(asgName string, topicARN string) (
	resp *SimpleResp, err error) {
	params := makeParams("DeleteNotificationConfiguration")
	params["AutoScalingGroupName"] = asgName
	params["TopicARN"] = topicARN

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeletePolicy deletes a policy created by PutScalingPolicy.
//
// policyName might be the policy name or ARN
//
// See http://goo.gl/aOQPH2 for more details
func (as *AutoScaling) DeletePolicy(asgName string, policyName string) (resp *SimpleResp, err error) {
	params := makeParams("DeletePolicy")
	params["AutoScalingGroupName"] = asgName
	params["PolicyName"] = policyName

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteScheduledAction deletes a scheduled action previously created using the PutScheduledUpdateGroupAction.
//
// See http://goo.gl/Zss9CH for more details
func (as *AutoScaling) DeleteScheduledAction(asgName string, scheduledActionName string) (resp *SimpleResp, err error) {
	params := makeParams("DeleteScheduledAction")
	params["AutoScalingGroupName"] = asgName
	params["ScheduledActionName"] = scheduledActionName

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteTags deletes autoscaling group tags
//
// See http://goo.gl/o8HzAk for more details.
func (as *AutoScaling) DeleteTags(tags []Tag) (resp *SimpleResp, err error) {
	params := makeParams("DeleteTags")

	for i, t := range tags {
		key := "Tags.member.%d.%s"
		index := i + 1
		params[fmt.Sprintf(key, index, "Key")] = t.Key
		params[fmt.Sprintf(key, index, "Value")] = t.Value
		params[fmt.Sprintf(key, index, "PropagateAtLaunch")] = strconv.FormatBool(t.PropagateAtLaunch)
		params[fmt.Sprintf(key, index, "ResourceId")] = t.ResourceId
		params[fmt.Sprintf(key, index, "ResourceType")] = "auto-scaling-group"
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

//DescribeAccountLimits response wrapper
//
// See http://goo.gl/tKsMN0 for more details.
type DescribeAccountLimitsResp struct {
	MaxNumberOfAutoScalingGroups    int    `xml:"DescribeAccountLimitsResult>MaxNumberOfAutoScalingGroups"`
	MaxNumberOfLaunchConfigurations int    `xml:"DescribeAccountLimitsResult>MaxNumberOfLaunchConfigurations"`
	RequestId                       string `xml:"ResponseMetadata>RequestId"`
}

// DescribeAccountLimits - Returns the limits for the Auto Scaling resources currently allowed for your AWS account.
//
// See http://goo.gl/tKsMN0 for more details.
func (as *AutoScaling) DescribeAccountLimits() (resp *DescribeAccountLimitsResp, err error) {
	params := makeParams("DescribeAccountLimits")

	resp = new(DescribeAccountLimitsResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// AdjustmentType specifies whether the PutScalingPolicy ScalingAdjustment parameter is an absolute number or a percentage of the current capacity.
//
// See http://goo.gl/tCFqeL for more details
type AdjustmentType struct {
	AdjustmentType string //Valid values are ChangeInCapacity, ExactCapacity, and PercentChangeInCapacity.
}

//DescribeAdjustmentTypes response wrapper
//
// See http://goo.gl/hGx3Pc for more details.
type DescribeAdjustmentTypesResp struct {
	AdjustmentTypes []AdjustmentType `xml:"DescribeAdjustmentTypesResult>AdjustmentTypes>member"`
	RequestId       string           `xml:"ResponseMetadata>RequestId"`
}

// DescribeAdjustmentTypes returns policy adjustment types for use in the PutScalingPolicy action.
//
// See http://goo.gl/hGx3Pc for more details.
func (as *AutoScaling) DescribeAdjustmentTypes() (resp *DescribeAdjustmentTypesResp, err error) {
	params := makeParams("DescribeAdjustmentTypes")

	resp = new(DescribeAdjustmentTypesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeAutoScalingGroups response wrapper
//
// See http://goo.gl/nW74Ut for more details.
type DescribeAutoScalingGroupsResp struct {
	AutoScalingGroups []AutoScalingGroup `xml:"DescribeAutoScalingGroupsResult>AutoScalingGroups>member"`
	NextToken         string             `xml:"DescribeAutoScalingGroupsResult>NextToken"`
	RequestId         string             `xml:"ResponseMetadata>RequestId"`
}

// DescribeAutoScalingGroups returns a full description of each Auto Scaling group in the given list
// If no autoscaling groups are provided, returns the details of all autoscaling groups
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// See http://goo.gl/nW74Ut for more details.
func (as *AutoScaling) DescribeAutoScalingGroups(names []string, maxRecords int, nextToken string) (
	resp *DescribeAutoScalingGroupsResp, err error) {
	params := makeParams("DescribeAutoScalingGroups")

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(names) > 0 {
		addParamsList(params, "AutoScalingGroupNames.member", names)
	}

	resp = new(DescribeAutoScalingGroupsResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeAutoScalingInstances response wrapper
//
// See http://goo.gl/ckzORt for more details.
type DescribeAutoScalingInstancesResp struct {
	AutoScalingInstances []Instance `xml:"DescribeAutoScalingInstancesResult>AutoScalingInstances>member"`
	NextToken            string     `xml:"DescribeAutoScalingInstancesResult>NextToken"`
	RequestId            string     `xml:"ResponseMetadata>RequestId"`
}

// DescribeAutoScalingInstances returns a description of each Auto Scaling instance in the InstanceIds list.
// If a list is not provided, the service returns the full details of all instances up to a maximum of 50
// By default, the service returns a list of 20 items.
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// See http://goo.gl/ckzORt for more details.
func (as *AutoScaling) DescribeAutoScalingInstances(ids []string, maxRecords int, nextToken string) (
	resp *DescribeAutoScalingInstancesResp, err error) {
	params := makeParams("DescribeAutoScalingInstances")

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(ids) > 0 {
		addParamsList(params, "InstanceIds.member", ids)
	}

	resp = new(DescribeAutoScalingInstancesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeAutoScalingNotificationTypes response wrapper
//
// See http://goo.gl/pmLIoE for more details.
type DescribeAutoScalingNotificationTypesResp struct {
	AutoScalingNotificationTypes []string `xml:"DescribeAutoScalingNotificationTypesResult>AutoScalingNotificationTypes>member"`
	RequestId                    string   `xml:"ResponseMetadata>RequestId"`
}

// DescribeAutoScalingNotificationTypes returns a list of all notification types that are supported by Auto Scaling
//
// See http://goo.gl/pmLIoE for more details.
func (as *AutoScaling) DescribeAutoScalingNotificationTypes() (resp *DescribeAutoScalingNotificationTypesResp, err error) {
	params := makeParams("DescribeAutoScalingNotificationTypes")

	resp = new(DescribeAutoScalingNotificationTypesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeLaunchConfigurationResp defines the basic response structure for launch configuration
// requests
//
// See http://goo.gl/y31YYE for more details.
type DescribeLaunchConfigurationsResp struct {
	LaunchConfigurations []LaunchConfiguration `xml:"DescribeLaunchConfigurationsResult>LaunchConfigurations>member"`
	NextToken            string                `xml:"DescribeLaunchConfigurationsResult>NextToken"`
	RequestId            string                `xml:"ResponseMetadata>RequestId"`
}

// DescribeLaunchConfigurations returns details about the launch configurations supplied in
// the list. If the list is nil, information is returned about all launch configurations in the
// region.
//
// See http://goo.gl/y31YYE for more details.
func (as *AutoScaling) DescribeLaunchConfigurations(names []string, maxRecords int, nextToken string) (
	resp *DescribeLaunchConfigurationsResp, err error) {
	params := makeParams("DescribeLaunchConfigurations")

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(names) > 0 {
		addParamsList(params, "LaunchConfigurationNames.member", names)
	}

	resp = new(DescribeLaunchConfigurationsResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}

	return resp, nil
}

// DescribeLifecycleHookTypesResult wraps a DescribeLifecycleHookTypes response
//
// See http://goo.gl/qiAH31 for more details.
type DescribeLifecycleHookTypesResult struct {
	LifecycleHookTypes []string `xml:"DescribeLifecycleHookTypesResult>LifecycleHookTypes>member"`
	RequestId          string   `xml:"ResponseMetadata>RequestId"`
}

// DescribeLifecycleHookTypes describes the available types of lifecycle hooks
//
// See http://goo.gl/E9IBtY for more information
func (as *AutoScaling) DescribeLifecycleHookTypes() (
	resp *DescribeLifecycleHookTypesResult, err error) {
	params := makeParams("DescribeLifecycleHookTypes")

	resp = new(DescribeLifecycleHookTypesResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// LifecycleHook represents a lifecyclehook object
//
// See http://goo.gl/j62Iqu for more information
type LifecycleHook struct {
	AutoScalingGroupName  string `xml:"AutoScalingGroupName"`
	DefaultResult         string `xml:"DefaultResult"`
	GlobalTimeout         int    `xml:"GlobalTimeout"`
	HeartbeatTimeout      int    `xml:"HeartbeatTimeout"`
	LifecycleHookName     string `xml:"LifecycleHookName"`
	LifecycleTransition   string `xml:"LifecycleTransition"`
	NotificationMetadata  string `xml:"NotificationMetadata"`
	NotificationTargetARN string `xml:"NotificationTargetARN"`
	RoleARN               string `xml:"RoleARN"`
}

// DescribeLifecycleHooks wraps a DescribeLifecycleHooks response
//
// See http://goo.gl/wQkWiz for more details.
type DescribeLifecycleHooksResult struct {
	LifecycleHooks []string `xml:"DescribeLifecycleHooksResult>LifecycleHooks>member"`
	RequestId      string   `xml:"ResponseMetadata>RequestId"`
}

// DescribeLifecycleHooks describes the lifecycle hooks that currently belong to the specified Auto Scaling group
//
// See http://goo.gl/wQkWiz for more information
func (as *AutoScaling) DescribeLifecycleHooks(asgName string, hookNames []string) (
	resp *DescribeLifecycleHooksResult, err error) {
	params := makeParams("DescribeLifecycleHooks")
	params["AutoScalingGroupName"] = asgName

	if len(hookNames) > 0 {
		addParamsList(params, "LifecycleHookNames.member", hookNames)
	}

	resp = new(DescribeLifecycleHooksResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// MetricGranularity encapsulates the MetricGranularityType
//
// See http://goo.gl/WJ82AA for more details
type MetricGranularity struct {
	Granularity string `xml:"Granularity"`
}

//MetricCollection encapsulates the MetricCollectionType
//
// See http://goo.gl/YrEG6h for more details
type MetricCollection struct {
	Metric string `xml:"Metric"`
}

// DescribeMetricCollectionTypesResp response wrapper
//
// See http://goo.gl/UyYc3i for more details.
type DescribeMetricCollectionTypesResp struct {
	Granularities []MetricGranularity `xml:"DescribeMetricCollectionTypesResult>Granularities>member"`
	Metrics       []MetricCollection  `xml:"DescribeMetricCollectionTypesResult>Metrics>member"`
	RequestId     string              `xml:"ResponseMetadata>RequestId"`
}

// DescribeMetricCollectionTypes returns a list of metrics and a corresponding list of granularities for each metric
//
// See http://goo.gl/UyYc3i for more details.
func (as *AutoScaling) DescribeMetricCollectionTypes() (resp *DescribeMetricCollectionTypesResp, err error) {
	params := makeParams("DescribeMetricCollectionTypes")

	resp = new(DescribeMetricCollectionTypesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// NotificationConfiguration encapsulates the NotificationConfigurationType
//
// See http://goo.gl/M8xYOQ for more details
type NotificationConfiguration struct {
	AutoScalingGroupName string `xml:"AutoScalingGroupName"`
	NotificationType     string `xml:"NotificationType"`
	TopicARN             string `xml:"TopicARN"`
}

// DescribeNotificationConfigurations response wrapper
//
// See http://goo.gl/qiAH31 for more details.
type DescribeNotificationConfigurationsResp struct {
	NotificationConfigurations []NotificationConfiguration `xml:"DescribeNotificationConfigurationsResult>NotificationConfigurations>member"`
	NextToken                  string                      `xml:"DescribeNotificationConfigurationsResult>NextToken"`
	RequestId                  string                      `xml:"ResponseMetadata>RequestId"`
}

// DescribeNotificationConfigurations returns a list of notification actions associated with Auto Scaling groups for specified events.
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// http://goo.gl/qiAH31 for more details.
func (as *AutoScaling) DescribeNotificationConfigurations(asgNames []string, maxRecords int, nextToken string) (
	resp *DescribeNotificationConfigurationsResp, err error) {
	params := makeParams("DescribeNotificationConfigurations")

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(asgNames) > 0 {
		addParamsList(params, "AutoScalingGroupNames.member", asgNames)
	}

	resp = new(DescribeNotificationConfigurationsResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Alarm encapsulates the Alarm data type.
//
// See http://goo.gl/Q0uPAB for more details
type Alarm struct {
	AlarmARN  string `xml:"AlarmARN"`
	AlarmName string `xml:"AlarmName"`
}

// ScalingPolicy encapsulates the ScalingPolicyType
//
// See http://goo.gl/BYAT18 for more details
type ScalingPolicy struct {
	AdjustmentType       string  `xml:"AdjustmentType"` // ChangeInCapacity, ExactCapacity, and PercentChangeInCapacity
	Alarms               []Alarm `xml:"Alarms>member"`  // A list of CloudWatch Alarms related to the policy
	AutoScalingGroupName string  `xml:"AutoScalingGroupName"`
	Cooldown             int     `xml:"Cooldown"`
	MinAdjustmentStep    int     `xml:"MinAdjustmentStep"` // Changes the DesiredCapacity of ASG by at least the specified number of instances.
	PolicyARN            string  `xml:"PolicyARN"`
	PolicyName           string  `xml:"PolicyName"`
	ScalingAdjustment    int     `xml:"ScalingAdjustment"`
}

// DescribePolicies response wrapper
//
// http://goo.gl/bN7A9T for more details.
type DescribePoliciesResp struct {
	ScalingPolicies []ScalingPolicy `xml:"DescribePoliciesResult>ScalingPolicies>member"`
	NextToken       string          `xml:"DescribePoliciesResult>NextToken"`
	RequestId       string          `xml:"ResponseMetadata>RequestId"`
}

// DescribePolicies returns descriptions of what each policy does.
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// http://goo.gl/bN7A9Tfor more details.
func (as *AutoScaling) DescribePolicies(asgName string, policyNames []string, maxRecords int, nextToken string) (
	resp *DescribePoliciesResp, err error) {
	params := makeParams("DescribePolicies")

	if asgName != "" {
		params["AutoScalingGroupName"] = asgName
	}
	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(policyNames) > 0 {
		addParamsList(params, "PolicyNames.member", policyNames)
	}

	resp = new(DescribePoliciesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Activity encapsulates the Activity data type
//
// See http://goo.gl/fRaVi1 for more details
type Activity struct {
	ActivityId           string    `xml:"ActivityId"`
	AutoScalingGroupName string    `xml:"AutoScalingGroupName"`
	Cause                string    `xml:"Cause"`
	Description          string    `xml:"Description"`
	Details              string    `xml:"Details"`
	EndTime              time.Time `xml:"EndTime"`
	Progress             int       `xml:"Progress"`
	StartTime            time.Time `xml:"StartTime"`
	StatusCode           string    `xml:"StatusCode"`
	StatusMessage        string    `xml:"StatusMessage"`
}

// DescribeScalingActivities response wrapper
//
// http://goo.gl/noOXIC for more details.
type DescribeScalingActivitiesResp struct {
	Activities []Activity `xml:"DescribeScalingActivitiesResult>Activities>member"`
	NextToken  string     `xml:"DescribeScalingActivitiesResult>NextToken"`
	RequestId  string     `xml:"ResponseMetadata>RequestId"`
}

// DescribeScalingActivities returns the scaling activities for the specified Auto Scaling group.
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// http://goo.gl/noOXIC more details.
func (as *AutoScaling) DescribeScalingActivities(asgName string, activityIds []string, maxRecords int, nextToken string) (
	resp *DescribeScalingActivitiesResp, err error) {
	params := makeParams("DescribeScalingActivities")

	if asgName != "" {
		params["AutoScalingGroupName"] = asgName
	}
	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}
	if len(activityIds) > 0 {
		addParamsList(params, "ActivityIds.member", activityIds)
	}

	resp = new(DescribeScalingActivitiesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ProcessType encapsulates the Auto Scaling process data type
//
// See http://goo.gl/9BvNik for more details.
type ProcessType struct {
	ProcessName string `xml:"ProcessName"`
}

// DescribeScalingProcessTypes response wrapper
//
// See http://goo.gl/rkp2tw for more details.
type DescribeScalingProcessTypesResp struct {
	Processes []ProcessType `xml:"DescribeScalingProcessTypesResult>Processes>member"`
	RequestId string        `xml:"ResponseMetadata>RequestId"`
}

// DescribeScalingProcessTypes returns scaling process types for use in the ResumeProcesses and SuspendProcesses actions.
//
// See http://goo.gl/rkp2tw for more details.
func (as *AutoScaling) DescribeScalingProcessTypes() (resp *DescribeScalingProcessTypesResp, err error) {
	params := makeParams("DescribeScalingProcessTypes")

	resp = new(DescribeScalingProcessTypesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ScheduledUpdateGroupAction contains the information to be used in a scheduled update to an
// AutoScalingGroup
//
// See http://goo.gl/z2Kfxe for more details
type ScheduledUpdateGroupAction struct {
	AutoScalingGroupName string    `xml:"AutoScalingGroupName"`
	DesiredCapacity      int       `xml:"DesiredCapacity"`
	EndTime              time.Time `xml:"EndTime"`
	MaxSize              int       `xml:"MaxSize"`
	MinSize              int       `xml:"MinSize"`
	Recurrence           string    `xml:"Recurrence"`
	ScheduledActionARN   string    `xml:"ScheduledActionARN"`
	ScheduledActionName  string    `xml:"ScheduledActionName"`
	StartTime            time.Time `xml:"StartTime"`
	Time                 time.Time `xml:"Time"`
}

// DescribeScheduledActionsResult contains the response from a DescribeScheduledActions.
//
// See http://goo.gl/zqrJLx for more details.
type DescribeScheduledActionsResult struct {
	ScheduledUpdateGroupActions []ScheduledUpdateGroupAction `xml:"DescribeScheduledActionsResult>ScheduledUpdateGroupActions>member"`
	NextToken                   string                       `xml:"DescribeScheduledActionsResult>NextToken"`
	RequestId                   string                       `xml:"ResponseMetadata>RequestId"`
}

// ScheduledActionsRequestParams contains the items that can be specified when making
// a ScheduledActions request
type DescribeScheduledActionsParams struct {
	AutoScalingGroupName string
	EndTime              time.Time
	MaxRecords           int
	ScheduledActionNames []string
	StartTime            time.Time
	NextToken            string
}

// DescribeScheduledActions returns a list of the current scheduled actions. If the
// AutoScalingGroup name is provided it will list all the scheduled actions for that group.
//
// See http://goo.gl/zqrJLx for more details.
func (as *AutoScaling) DescribeScheduledActions(options *DescribeScheduledActionsParams) (
	resp *DescribeScheduledActionsResult, err error) {
	params := makeParams("DescribeScheduledActions")

	if options.AutoScalingGroupName != "" {
		params["AutoScalingGroupName"] = options.AutoScalingGroupName
	}
	if !options.StartTime.IsZero() {
		params["StartTime"] = options.StartTime.Format(time.RFC3339)
	}
	if !options.EndTime.IsZero() {
		params["EndTime"] = options.EndTime.Format(time.RFC3339)
	}
	if options.MaxRecords > 0 {
		params["MaxRecords"] = strconv.Itoa(options.MaxRecords)
	}
	if options.NextToken != "" {
		params["NextToken"] = options.NextToken
	}
	if len(options.ScheduledActionNames) > 0 {
		addParamsList(params, "ScheduledActionNames.member", options.ScheduledActionNames)
	}

	resp = new(DescribeScheduledActionsResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeTags response wrapper
//
// See http://goo.gl/ZTEU3G for more details.
type DescribeTagsResp struct {
	Tags      []Tag  `xml:"DescribeTagsResult>Tags>member"`
	NextToken string `xml:"DescribeTagsResult>NextToken"`
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// DescribeTags lists the Auto Scaling group tags.
// Supports pagination by using the returned "NextToken" parameter for subsequent calls
//
// See http://goo.gl/ZTEU3G for more details.
func (as *AutoScaling) DescribeTags(filter *Filter, maxRecords int, nextToken string) (
	resp *DescribeTagsResp, err error) {
	params := makeParams("DescribeTags")

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	filter.addParams(params)

	resp = new(DescribeTagsResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeTerminationPolicyTypes response wrapper
//
// See http://goo.gl/ZTEU3G for more details.
type DescribeTerminationPolicyTypesResp struct {
	TerminationPolicyTypes []string `xml:"DescribeTerminationPolicyTypesResult>TerminationPolicyTypes>member"`
	RequestId              string   `xml:"ResponseMetadata>RequestId"`
}

// DescribeTerminationPolicyTypes returns a list of all termination policies supported by Auto Scaling
//
// See http://goo.gl/ZTEU3G for more details.
func (as *AutoScaling) DescribeTerminationPolicyTypes() (resp *DescribeTerminationPolicyTypesResp, err error) {
	params := makeParams("DescribeTerminationPolicyTypes")

	resp = new(DescribeTerminationPolicyTypesResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DetachInstancesResult wraps a DetachInstances response
type DetachInstancesResult struct {
	Activities []Activity `xml:"DetachInstancesResult>Activities>member"`
	RequestId  string     `xml:"ResponseMetadata>RequestId"`
}

// DetachInstances removes an instance from an Auto Scaling group
//
// See http://goo.gl/cNwrqF for more details
func (as *AutoScaling) DetachInstances(asgName string, instanceIds []string, decrementCapacity bool) (
	resp *DetachInstancesResult, err error) {
	params := makeParams("DetachInstances")
	params["AutoScalingGroupName"] = asgName
	params["ShouldDecrementDesiredCapacity"] = strconv.FormatBool(decrementCapacity)

	if len(instanceIds) > 0 {
		addParamsList(params, "InstanceIds.member", instanceIds)
	}

	resp = new(DetachInstancesResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DisableMetricsCollection disables monitoring of group metrics for the Auto Scaling group specified in asgName.
// You can specify the list of affected metrics with the metrics parameter. If no metrics are specified, all metrics are disabled
//
// See http://goo.gl/kAvzQw for more details.
func (as *AutoScaling) DisableMetricsCollection(asgName string, metrics []string) (
	resp *SimpleResp, err error) {
	params := makeParams("DisableMetricsCollection")
	params["AutoScalingGroupName"] = asgName

	if len(metrics) > 0 {
		addParamsList(params, "Metrics.member", metrics)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// EnableMetricsCollection enables monitoring of group metrics for the Auto Scaling group specified in asNmae.
// You can specify the list of affected metrics with the metrics parameter.
// Auto Scaling metrics collection can be turned on only if the InstanceMonitoring flag is set to true.
// Currently, the only legal granularity is "1Minute".
//
// See http://goo.gl/UcVDWn for more details.
func (as *AutoScaling) EnableMetricsCollection(asgName string, metrics []string, granularity string) (
	resp *SimpleResp, err error) {
	params := makeParams("EnableMetricsCollection")
	params["AutoScalingGroupName"] = asgName
	params["Granularity"] = granularity

	if len(metrics) > 0 {
		addParamsList(params, "Metrics.member", metrics)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// EnterStandbyResult wraps an EnterStandby response
type EnterStandbyResult struct {
	Activities []Activity `xml:"EnterStandbyResult>Activities>member"`
	RequestId  string     `xml:"ResponseMetadata>RequestId"`
}

// EnterStandby moves instances in an Auto Scaling group into a Standby mode.
//
// See http://goo.gl/BJ3lXs for more information
func (as *AutoScaling) EnterStandby(asgName string, instanceIds []string, decrementCapacity bool) (
	resp *EnterStandbyResult, err error) {
	params := makeParams("EnterStandby")
	params["AutoScalingGroupName"] = asgName
	params["ShouldDecrementDesiredCapacity"] = strconv.FormatBool(decrementCapacity)

	if len(instanceIds) > 0 {
		addParamsList(params, "InstanceIds.member", instanceIds)
	}

	resp = new(EnterStandbyResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ExecutePolicy executes the specified policy.
//
// See http://goo.gl/BxHpFc for more details.
func (as *AutoScaling) ExecutePolicy(policyName string, asgName string, honorCooldown bool) (
	resp *SimpleResp, err error) {
	params := makeParams("ExecutePolicy")
	params["PolicyName"] = policyName

	if asgName != "" {
		params["AutoScalingGroupName"] = asgName
	}
	if honorCooldown {
		params["HonorCooldown"] = strconv.FormatBool(honorCooldown)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ExitStandbyResult wraps an ExitStandby response
type ExitStandbyResult struct {
	Activities []Activity `xml:"ExitStandbyResult>Activities>member"`
	RequestId  string     `xml:"ResponseMetadata>RequestId"`
}

// ExitStandby moves an instance out of Standby mode.
//
// See http://goo.gl/9zQV4G for more information
func (as *AutoScaling) ExitStandby(asgName string, instanceIds []string) (
	resp *ExitStandbyResult, err error) {
	params := makeParams("ExitStandby")
	params["AutoScalingGroupName"] = asgName

	if len(instanceIds) > 0 {
		addParamsList(params, "InstanceIds.member", instanceIds)
	}

	resp = new(ExitStandbyResult)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// PutLifecycleHookParams wraps a PutLifecycleHook request
//
// See http://goo.gl/zsNqp5 for more details
type PutLifecycleHookParams struct {
	AutoScalingGroupName  string
	DefaultResult         string
	HeartbeatTimeout      int
	LifecycleHookName     string
	LifecycleTransition   string
	NotificationMetadata  string
	NotificationTargetARN string
	RoleARN               string
}

// PutLifecycleHook Creates or updates a lifecycle hook for an Auto Scaling Group.
//
// Part of the basic sequence for adding a lifecycle hook to an Auto Scaling group:
// 1) Create a notification target (SQS queue || SNS Topic)
// 2) Create an IAM role to allow the ASG topublish lifecycle notifications to the designated SQS queue or SNS topic
// 3) *** Create the lifecycle hook. You can create a hook that acts when instances launch or when instances terminate***
// 4) If necessary, record the lifecycle action heartbeat to keep the instance in a pending state
// 5) Complete the lifecycle action
//
// See http://goo.gl/9XrROq for more details.
func (as *AutoScaling) PutLifecycleHook(options *PutLifecycleHookParams) (
	resp *SimpleResp, err error) {
	params := makeParams("PutLifecycleHook")
	params["AutoScalingGroupName"] = options.AutoScalingGroupName
	params["LifecycleHookName"] = options.LifecycleHookName

	if options.DefaultResult != "" {
		params["DefaultResult"] = options.DefaultResult
	}
	if options.HeartbeatTimeout != 0 {
		params["HeartbeatTimeout"] = strconv.Itoa(options.HeartbeatTimeout)
	}
	if options.LifecycleTransition != "" {
		params["LifecycleTransition"] = options.LifecycleTransition
	}
	if options.NotificationMetadata != "" {
		params["NotificationMetadata"] = options.NotificationMetadata
	}
	if options.NotificationTargetARN != "" {
		params["NotificationTargetARN"] = options.NotificationTargetARN
	}
	if options.RoleARN != "" {
		params["RoleARN"] = options.RoleARN
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// PutNotificationConfiguration configures an Auto Scaling group to send notifications when specified events take place.
//
// See http://goo.gl/9XrROq for more details.
func (as *AutoScaling) PutNotificationConfiguration(asgName string, notificationTypes []string, topicARN string) (
	resp *SimpleResp, err error) {
	params := makeParams("PutNotificationConfiguration")
	params["AutoScalingGroupName"] = asgName
	params["TopicARN"] = topicARN

	if len(notificationTypes) > 0 {
		addParamsList(params, "NotificationTypes.member", notificationTypes)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// PutScalingPolicyParams wraps a PutScalingPolicyParams request
//
// See http://goo.gl/o0E8hl for more details.
type PutScalingPolicyParams struct {
	AutoScalingGroupName string
	PolicyName           string
	ScalingAdjustment    int
	AdjustmentType       string
	Cooldown             int
	MinAdjustmentStep    int
}

// PutScalingPolicy response wrapper
//
// See http://goo.gl/o0E8hl for more details.
type PutScalingPolicyResp struct {
	PolicyARN string `xml:"PutScalingPolicyResult>PolicyARN"`
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// PutScalingPolicy creates or updates a policy for an Auto Scaling group
//
// See http://goo.gl/o0E8hl for more details.
func (as *AutoScaling) PutScalingPolicy(options *PutScalingPolicyParams) (
	resp *PutScalingPolicyResp, err error) {
	params := makeParams("PutScalingPolicy")
	params["AutoScalingGroupName"] = options.AutoScalingGroupName
	params["PolicyName"] = options.PolicyName
	params["ScalingAdjustment"] = strconv.Itoa(options.ScalingAdjustment)
	params["AdjustmentType"] = options.AdjustmentType

	if options.Cooldown != 0 {
		params["Cooldown"] = strconv.Itoa(options.Cooldown)
	}
	if options.MinAdjustmentStep != 0 {
		params["MinAdjustmentStep"] = strconv.Itoa(options.MinAdjustmentStep)
	}

	resp = new(PutScalingPolicyResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// PutScheduledUpdateGroupActionParams contains the details of the ScheduledAction to be added.
//
// See http://goo.gl/sLPi0d for more details
type PutScheduledUpdateGroupActionParams struct {
	AutoScalingGroupName string
	DesiredCapacity      int
	EndTime              time.Time
	MaxSize              int
	MinSize              int
	Recurrence           string
	ScheduledActionName  string
	StartTime            time.Time
}

// PutScheduledUpdateGroupAction creates or updates a scheduled scaling action for an
// AutoScaling group. Scheduled actions can be made up to thirty days in advance. When updating
// a scheduled scaling action, if you leave a parameter unspecified, the corresponding value
// remains unchanged in the affected AutoScaling group.
//
// Auto Scaling supports the date and time expressed in "YYYY-MM-DDThh:mm:ssZ" format in UTC/GMT
// only.
//
// See http://goo.gl/sLPi0d for more details.
func (as *AutoScaling) PutScheduledUpdateGroupAction(options *PutScheduledUpdateGroupActionParams) (
	resp *SimpleResp, err error) {
	params := makeParams("PutScheduledUpdateGroupAction")
	params["AutoScalingGroupName"] = options.AutoScalingGroupName
	params["ScheduledActionName"] = options.ScheduledActionName
	params["MinSize"] = strconv.Itoa(options.MinSize)
	params["MaxSize"] = strconv.Itoa(options.MaxSize)
	params["DesiredCapacity"] = strconv.Itoa(options.DesiredCapacity)

	if !options.StartTime.IsZero() {
		params["StartTime"] = options.StartTime.Format(time.RFC3339)
	}
	if !options.EndTime.IsZero() {
		params["EndTime"] = options.EndTime.Format(time.RFC3339)
	}
	if options.Recurrence != "" {
		params["Recurrence"] = options.Recurrence
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// RecordLifecycleActionHeartbeat ecords a heartbeat for the lifecycle action associated with a specific token.
// This extends the timeout by the length of time defined by the HeartbeatTimeout parameter of the
// PutLifecycleHook operation.
//
// Part of the basic sequence for adding a lifecycle hook to an Auto Scaling group:
// 1) Create a notification target (SQS queue || SNS Topic)
// 2) Create an IAM role to allow the ASG topublish lifecycle notifications to the designated SQS queue or SNS topic
// 3) Create the lifecycle hook. You can create a hook that acts when instances launch or when instances terminate
// 4) ***If necessary, record the lifecycle action heartbeat to keep the instance in a pending state***
// 5) Complete the lifecycle action
//
// See http://goo.gl/jc70xp for more details.
func (as *AutoScaling) RecordLifecycleActionHeartbeat(asgName, lifecycleActionToken, hookName string) (
	resp *SimpleResp, err error) {
	params := makeParams("RecordLifecycleActionHeartbeat")
	params["AutoScalingGroupName"] = asgName
	params["LifecycleActionToken"] = lifecycleActionToken
	params["LifecycleHookName"] = hookName

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ResumeProcesses resumes the scaling processes for the scaling group. If no processes are
// provided, all processes are resumed.
//
// See http://goo.gl/XWIIg1 for more details.
func (as *AutoScaling) ResumeProcesses(asgName string, processes []string) (
	resp *SimpleResp, err error) {
	params := makeParams("ResumeProcesses")
	params["AutoScalingGroupName"] = asgName

	if len(processes) > 0 {
		addParamsList(params, "ScalingProcesses.member", processes)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// SetDesiredCapacity changes the DesiredCapacity of an AutoScaling group.
//
// See http://goo.gl/3WGZbI for more details.
func (as *AutoScaling) SetDesiredCapacity(asgName string, desiredCapacity int, honorCooldown bool) (
	resp *SimpleResp, err error) {
	params := makeParams("SetDesiredCapacity")
	params["AutoScalingGroupName"] = asgName
	params["DesiredCapacity"] = strconv.Itoa(desiredCapacity)
	params["HonorCooldown"] = strconv.FormatBool(honorCooldown)

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// SetInstanceHealth sets the health status of a specified instance that belongs to any of your Auto Scaling groups.
//
// See http://goo.gl/j4ZRxh for more details.
func (as *AutoScaling) SetInstanceHealth(id string, healthStatus string, respectGracePeriod bool) (
	resp *SimpleResp, err error) {
	params := makeParams("SetInstanceHealth")
	params["HealthStatus"] = healthStatus
	params["InstanceId"] = id
	// Default is true
	params["ShouldRespectGracePeriod"] = strconv.FormatBool(respectGracePeriod)

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// SuspendProcesses suspends the processes for the autoscaling group. If no processes are
// provided, all processes are suspended.
//
// If you suspend either of the two primary processes (Launch or Terminate), this can prevent other
// process types from functioning properly.
//
// See http://goo.gl/DUJpQy for more details.
func (as *AutoScaling) SuspendProcesses(asgName string, processes []string) (
	resp *SimpleResp, err error) {
	params := makeParams("SuspendProcesses")
	params["AutoScalingGroupName"] = asgName

	if len(processes) > 0 {
		addParamsList(params, "ScalingProcesses.member", processes)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// TerminateInstanceInAutoScalingGroupResp response wrapper
//
// See http://goo.gl/ki5hMh for more details.
type TerminateInstanceInAutoScalingGroupResp struct {
	Activity  Activity `xml:"TerminateInstanceInAutoScalingGroupResult>Activity"`
	RequestId string   `xml:"ResponseMetadata>RequestId"`
}

// TerminateInstanceInAutoScalingGroup terminates the specified instance.
// Optionally, the desired group size can be adjusted by setting decrCap to true
//
// See http://goo.gl/ki5hMh for more details.
func (as *AutoScaling) TerminateInstanceInAutoScalingGroup(id string, decrCap bool) (
	resp *TerminateInstanceInAutoScalingGroupResp, err error) {
	params := makeParams("TerminateInstanceInAutoScalingGroup")
	params["InstanceId"] = id
	params["ShouldDecrementDesiredCapacity"] = strconv.FormatBool(decrCap)

	resp = new(TerminateInstanceInAutoScalingGroupResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateAutoScalingGroup updates the scaling group.
//
// To update an auto scaling group with a launch configuration that has the InstanceMonitoring
// flag set to False, you must first ensure that collection of group metrics is disabled.
// Otherwise calls to UpdateAutoScalingGroup will fail.
//
// See http://goo.gl/rqrmxy for more details.
func (as *AutoScaling) UpdateAutoScalingGroup(asg *AutoScalingGroup) (resp *SimpleResp, err error) {
	params := makeParams("UpdateAutoScalingGroup")

	params["AutoScalingGroupName"] = asg.AutoScalingGroupName
	params["MaxSize"] = strconv.Itoa(asg.MaxSize)
	params["MinSize"] = strconv.Itoa(asg.MinSize)
	params["DesiredCapacity"] = strconv.Itoa(asg.DesiredCapacity)

	if asg.DefaultCooldown > 0 {
		params["DefaultCooldown"] = strconv.Itoa(asg.DefaultCooldown)
	}
	if asg.HealthCheckGracePeriod > 0 {
		params["HealthCheckGracePeriod"] = strconv.Itoa(asg.HealthCheckGracePeriod)
	}
	if asg.HealthCheckType != "" {
		params["HealthCheckType"] = asg.HealthCheckType
	}
	if asg.LaunchConfigurationName != "" {
		params["LaunchConfigurationName"] = asg.LaunchConfigurationName
	}
	if asg.PlacementGroup != "" {
		params["PlacementGroup"] = asg.PlacementGroup
	}
	if asg.VPCZoneIdentifier != "" {
		params["VPCZoneIdentifier"] = asg.VPCZoneIdentifier
	}

	if len(asg.AvailabilityZones) > 0 {
		addParamsList(params, "AvailabilityZones.member", asg.AvailabilityZones)
	}
	if len(asg.TerminationPolicies) > 0 {
		addParamsList(params, "TerminationPolicies.member", asg.TerminationPolicies)
	}

	resp = new(SimpleResp)
	if err := as.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}
