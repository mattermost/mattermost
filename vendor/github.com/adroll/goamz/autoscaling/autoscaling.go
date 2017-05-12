package autoscaling

import (
	"encoding/xml"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"time"
)

const debug = false

var timeNow = time.Now

// AutoScaling contains the details of the AWS region to perform operations against.
type AutoScaling struct {
	aws.Auth
	aws.Region
}

type xmlErrors struct {
	RequestId string  `xml:"RequestID"`
	Errors    []Error `xml:"Error"`
}

// Error contains pertinent information from the failed operation.
type Error struct {
	// HTTP status code (200, 403, ...)
	StatusCode int
	// AutoScaling error code ("UnsupportedOperation", ...)
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

// New creates a new AutoScaling
func New(auth aws.Auth, region aws.Region) *AutoScaling {
	return &AutoScaling{auth, region}
}

func (as *AutoScaling) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2011-01-01"
	params["Timestamp"] = timeNow().In(time.UTC).Format(time.RFC3339)
	endpoint, err := url.Parse(as.Region.AutoScalingEndpoint)
	if err != nil {
		return err
	}
	sign(as.Auth, "GET", endpoint.Path, params, endpoint.Host)
	endpoint.RawQuery = multimap(params).Encode()
	if debug {
		log.Printf("get { %v } -> {\n", endpoint.String())
	}
	r, err := http.Get(endpoint.String())
	if err != nil {
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

// ----------------------------------------------------------------------------
// Auto Scaling base types and related functions.

type AutoScalingGroup struct {
	AutoScalingGroupARN     string     `xml:"AutoScalingGroupARN"`
	AutoScalingGroupName    string     `xml:"AutoScalingGroupName"`
	AvailabilityZones       []string   `xml:"AvailabilityZones>member"`
	CreatedTime             string     `xml:"CreatedTime"`
	DefaultCooldown         int64      `xml:"DefaultCooldown"`
	DesiredCapacity         int64      `xml:"DesiredCapacity"`
	HealthCheckGracePeriod  int64      `xml:"HealthCheckGracePeriod"`
	HealthCheckType         string     `xml:"HealthCheckType"`
	Instances               []Instance `xml:"Instances>member"`
	LaunchConfigurationName string     `xml:"LaunchConfigurationName"`
	LoadBalancerNames       []string   `xml:"LoadBalancerNames>member"`
	MaxSize                 int64      `xml:"MaxSize"`
	MinSize                 int64      `xml:"MinSize"`
	TerminationPolicies     []string   `xml:"TerminationPolicies>member"`
	VPCZoneIdentifier       string     `xml:"VPCZoneIdentifier"`
	Tags                    []Tag      `xml:"Tags>member"`
	SuspendedProcesses      []string   `xml:"SuspendedProcesses>member"`
}

type Instance struct {
	InstanceId              string `xml:"InstanceId"`
	HealthStatus            string `xml:"HealthStatus"`
	AvailabilityZone        string `xml:"AvailabilityZone"`
	LaunchConfigurationName string `xml:"LaunchConfigurationName"`
	LifecycleState          string `xml:"LifecycleState"`
}

type LaunchConfiguration struct {
	AssociatePublicIpAddress bool     `xml:"AssociatePublicIpAddress"`
	CreatedTime              string   `xml:"CreatedTime"`
	EbsOptimized             bool     `xml:"EbsOptimized"`
	LaunchConfigurationARN   string   `xml:"LaunchConfigurationARN"`
	LaunchConfigurationName  string   `xml:"LaunchConfigurationName"`
	IamInstanceProfile       string   `xml:"IamInstanceProfile"`
	ImageId                  string   `xml:"ImageId"`
	InstanceType             string   `xml:"InstanceType"`
	KernelId                 string   `xml:"KernelId"`
	SecurityGroups           []string `xml:"SecurityGroups>member"`
	KeyName                  string   `xml:"KeyName"`
	UserData                 string   `xml:"UserData"`
	InstanceMonitoring       string   `xml:"InstanceMonitoring"`
}

type Tag struct {
	Key               string `xml:"Key"`
	PropagateAtLaunch bool   `xml:"PropagateAtLaunch"`
	ResourceId        string `xml:"ResourceId"`
	ResourceType      string `xml:"ResourceType"`
	Value             string `xml:"Value"`
}

// AutoScalingGroupsResp defines the basic response structure.
type AutoScalingGroupsResp struct {
	RequestId         string             `xml:"ResponseMetadata>RequestId"`
	AutoScalingGroups []AutoScalingGroup `xml:"DescribeAutoScalingGroupsResult>AutoScalingGroups>member"`
}

// LaunchConfigurationResp defines the basic response structure for launch configuration
// requests
type LaunchConfigurationResp struct {
	RequestId            string                `xml:"ResponseMetadata>RequestId"`
	LaunchConfigurations []LaunchConfiguration `xml:"DescribeLaunchConfigurationsResult>LaunchConfigurations>member"`
}

// SimpleResp is the basic response from most actions.
type SimpleResp struct {
	XMLName   xml.Name
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// CreateLaunchConfigurationResp is returned from the CreateLaunchConfiguration request.
type CreateLaunchConfigurationResp struct {
	LaunchConfiguration
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// SetDesiredCapacityRequestParams contains the details for the SetDesiredCapacity action.
type SetDesiredCapacityRequestParams struct {
	AutoScalingGroupName string
	DesiredCapacity      int64
	HonorCooldown        bool
}

// DescribeAutoScalingGroups returns details about the groups provided in the list. If the list is nil
// information is returned about all the groups in the region.
func (as *AutoScaling) DescribeAutoScalingGroups(groupnames []string) (
	resp *AutoScalingGroupsResp, err error) {
	params := makeParams("DescribeAutoScalingGroups")
	addParamsList(params, "AutoScalingGroupNames.member", groupnames)
	resp = &AutoScalingGroupsResp{}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateAutoScalingGroup creates a new autoscaling group.
func (as *AutoScaling) CreateAutoScalingGroup(ag AutoScalingGroup) (
	resp *AutoScalingGroupsResp, err error) {
	resp = &AutoScalingGroupsResp{}
	params := makeParams("CreateAutoScalingGroup")
	params["AutoScalingGroupName"] = ag.AutoScalingGroupName
	params["MaxSize"] = strconv.FormatInt(ag.MaxSize, 10)
	params["MinSize"] = strconv.FormatInt(ag.MinSize, 10)
	params["LaunchConfigurationName"] = ag.LaunchConfigurationName
	addParamsList(params, "AvailabilityZones.member", ag.AvailabilityZones)
	if len(ag.LoadBalancerNames) > 0 {
		addParamsList(params, "LoadBalancerNames.member", ag.LoadBalancerNames)
	}
	if ag.DefaultCooldown > 0 {
		params["DefaultCooldown"] = strconv.FormatInt(ag.DefaultCooldown, 10)
	}
	if ag.DesiredCapacity > 0 {
		params["DesiredCapacity"] = strconv.FormatInt(ag.DesiredCapacity, 10)
	}
	if ag.HealthCheckGracePeriod > 0 {
		params["HealthCheckGracePeriod"] = strconv.FormatInt(ag.HealthCheckGracePeriod, 10)
	}
	if ag.HealthCheckType == "ELB" {
		params["HealthCheckType"] = ag.HealthCheckType
	}
	if len(ag.VPCZoneIdentifier) > 0 {
		params["VPCZoneIdentifier"] = ag.VPCZoneIdentifier
	}
	if len(ag.TerminationPolicies) > 0 {
		addParamsList(params, "TerminationPolicies.member", ag.TerminationPolicies)
	}
	// TODO(JP) : Implement Tags
	//if len(ag.Tags) > 0 {
	//	addParamsList(params, "Tags", ag.Tags)
	//}

	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeLaunchConfigurations returns details about the launch configurations supplied in
// the list. If the list is nil, information is returned about all launch configurations in the
// region.
func (as *AutoScaling) DescribeLaunchConfigurations(confnames []string) (
	resp *LaunchConfigurationResp, err error) {
	params := makeParams("DescribeLaunchConfigurations")
	addParamsList(params, "LaunchConfigurationNames.member", confnames)
	resp = &LaunchConfigurationResp{}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateLaunchConfiguration creates a new launch configuration.
func (as *AutoScaling) CreateLaunchConfiguration(lc LaunchConfiguration) (
	resp *CreateLaunchConfigurationResp, err error) {
	resp = &CreateLaunchConfigurationResp{}
	params := makeParams("CreateLaunchConfiguration")
	params["LaunchConfigurationName"] = lc.LaunchConfigurationName
	if len(lc.ImageId) > 0 {
		params["ImageId"] = lc.ImageId
		params["InstanceType"] = lc.InstanceType
	}
	if len(lc.IamInstanceProfile) > 0 {
		params["IamInstanceProfile"] = lc.IamInstanceProfile
	}
	if lc.AssociatePublicIpAddress {
		params["AssociatePublicIpAddress"] = "true"
	}
	if len(lc.SecurityGroups) > 0 {
		addParamsList(params, "SecurityGroups.member", lc.SecurityGroups)
	}
	if len(lc.KeyName) > 0 {
		params["KeyName"] = lc.KeyName
	}
	if len(lc.KernelId) > 0 {
		params["KernelId"] = lc.KernelId
	}
	if lc.InstanceMonitoring == "false" {
		params["InstanceMonitoring.Enabled"] = "false"
	}
	err = as.query(params, resp)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// SuspendProcesses suspends the processes for the autoscaling group. If no processes are
// provided, all processes are suspended.
//
// If you suspend either of the two primary processes (Launch or Terminate), this can prevent other
// process types from functioning properly.
func (as *AutoScaling) SuspendProcesses(ag AutoScalingGroup, processes []string) (
	resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("SuspendProcesses")
	params["AutoScalingGroupName"] = ag.AutoScalingGroupName
	if len(processes) > 0 {
		addParamsList(params, "ScalingProcesses.member", processes)
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ResumeProcesses resumes the scaling processes for the scaling group. If no processes are
// provided, all processes are resumed.
func (as *AutoScaling) ResumeProcesses(ag AutoScalingGroup, processes []string) (
	resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("ResumeProcesses")
	params["AutoScalingGroupName"] = ag.AutoScalingGroupName
	if len(processes) > 0 {
		addParamsList(params, "ScalingProcesses.member", processes)
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateAutoScalingGroup updates the scaling group.
//
// To update an auto scaling group with a launch configuration that has the InstanceMonitoring
// flag set to False, you must first ensure that collection of group metrics is disabled.
// Otherwise calls to UpdateAutoScalingGroup will fail.
func (as *AutoScaling) UpdateAutoScalingGroup(ag AutoScalingGroup) (resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("UpdateAutoScalingGroup")
	params["AutoScalingGroupName"] = ag.AutoScalingGroupName
	addParamsList(params, "AvailabilityZones.member", ag.AvailabilityZones)
	if ag.DefaultCooldown > 0 {
		params["DefaultCooldown"] = strconv.FormatInt(ag.DefaultCooldown, 10)
	}
	if ag.HealthCheckGracePeriod > 0 {
		params["HealthCheckGracePeriod"] = strconv.FormatInt(ag.HealthCheckGracePeriod, 10)
	}
	if ag.HealthCheckType == "ELB" {
		params["HealthCheckType"] = ag.HealthCheckType
	}
	if ag.MaxSize > -1 {
		params["MaxSize"] = strconv.FormatInt(ag.MaxSize, 10)
	}
	if ag.MinSize > -1 {
		params["MinSize"] = strconv.FormatInt(ag.MinSize, 10)
	}
	if ag.DesiredCapacity > -1 {
		params["DesiredCapacity"] = strconv.FormatInt(ag.DesiredCapacity, 10)
	}
	if len(ag.LaunchConfigurationName) > 0 {
		params["LaunchConfigurationName"] = ag.LaunchConfigurationName
	}
	if len(ag.TerminationPolicies) > 0 {
		addParamsList(params, "TerminationPolicies.member", ag.TerminationPolicies)
	}
	if len(ag.VPCZoneIdentifier) > 0 {
		params["VPCZoneIdentifier"] = ag.VPCZoneIdentifier
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// SetDesiredCapacity changes the DesiredCapacity of an AutoScaling group.
func (as *AutoScaling) SetDesiredCapacity(rp SetDesiredCapacityRequestParams) (resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("SetDesiredCapacity")
	params["AutoScalingGroupName"] = rp.AutoScalingGroupName
	params["DesiredCapacity"] = strconv.FormatInt(rp.DesiredCapacity, 10)
	if rp.HonorCooldown {
		params["HonorCooldown"] = "true"
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ----------------------------------------------------------------------------
// Autoscaling scheduled actions types and methods

// ScheduledUpdateGroupAction contains the information to be used in a scheduled update to an
// AutoScalingGroup
type ScheduledUpdateGroupAction struct {
	AutoScalingGroupName string `xml:"AutoScalingGroupName"`
	DesiredCapacity      int64  `xml:"DesiredCapacity"`
	EndTime              string `xml:"EndTime"`
	MaxSize              int64  `xml:"MaxSize"`
	MinSize              int64  `xml:"MinSize"`
	Recurrence           string `xml:"Recurrence"`
	ScheduledActionARN   string `xml:"ScheduledActionARN"`
	ScheduledActionName  string `xml:"ScheduledActionName"`
	StartTime            string `xml:"StartTime"`
}

// DescribeScheduledActionsResult contains the response from a DescribeScheduledActions.
type DescribeScheduledActionsResult struct {
	NextToken                   string                       `xml:"NextToken"`
	ScheduledUpdateGroupActions []ScheduledUpdateGroupAction `xml:"DescribeScheduledActions>ScheduledUpdateGroups>member"`
}

// ScheduledActionsRequestParams contains the items that can be specified when making
// a ScheduledActions request
type ScheduledActionsRequestParams struct {
	AutoScalingGroupName string
	EndTime              string
	MaxRecords           int64
	ScheduledActionNames []string
	StartTime            string
}

// PutScheduledActionRequestParams contains the details of the ScheduledAction to be added.
type PutScheduledActionRequestParams struct {
	AutoScalingGroupName string
	DesiredCapacity      int64
	EndTime              string
	MaxSize              int64
	MinSize              int64
	Recurrence           string
	ScheduledActionName  string
	StartTime            string
}

// DeleteScheduledActionRequestParams contains the details of the scheduled action to delete.
type DeleteScheduledActionRequestParams struct {
	AutoScalingGroupName string
	ScheduledActionName  string
}

// DescribeScheduledActions returns a list of the current scheduled actions. If the
// AutoScalingGroup name is provided it will list all the scheduled actions for that group.
func (as *AutoScaling) DescribeScheduledActions(rp ScheduledActionsRequestParams) (
	resp *DescribeScheduledActionsResult, err error) {
	resp = &DescribeScheduledActionsResult{}
	params := makeParams("DescribeScheduledActions")
	if rp.AutoScalingGroupName != "" {
		params["AutoScalingGroupName"] = rp.AutoScalingGroupName
	}
	if rp.StartTime != "" {
		params["StartTime"] = rp.StartTime
	}
	if rp.EndTime != "" {
		params["EndTime"] = rp.EndTime
	}
	if rp.MaxRecords > 0 {
		params["MaxRecords"] = strconv.FormatInt(rp.MaxRecords, 10)
	}
	if len(rp.ScheduledActionNames) > 0 {
		addParamsList(params, "ScheduledActionNames.member", rp.ScheduledActionNames)
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// PutScheduledUpdateGroupAction creates or updates a scheduled scaling action for an
// AutoScaling group. Scheduled actions can be made up to thirty days in advance. When updating
// a scheduled scaling action, if you leave a parameter unspecified, the corresponding value
// remains unchanged in the affected AutoScaling group.
//
// Auto Scaling supports the date and time expressed in "YYYY-MM-DDThh:mm:ssZ" format in UTC/GMT
// only.
func (as *AutoScaling) PutScheduledUpdateGroupAction(rp PutScheduledActionRequestParams) (
	resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("PutScheduledUpdateGroupAction")
	params["AutoScalingGroupName"] = rp.AutoScalingGroupName
	params["ScheduledActionName"] = rp.ScheduledActionName
	if len(rp.EndTime) > 0 {
		params["EndTime"] = rp.EndTime
	}
	if len(rp.StartTime) > 0 {
		params["StartTime"] = rp.StartTime
	}
	if rp.MaxSize > 0 {
		params["MaxSize"] = strconv.FormatInt(rp.MaxSize, 10)
	}
	if rp.MinSize > 0 {
		params["MinSize"] = strconv.FormatInt(rp.MinSize, 10)
	}
	if len(rp.Recurrence) > 0 {
		params["Recurrence"] = rp.Recurrence
	}
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteScheduledAction deletes a scheduled action.
func (as *AutoScaling) DeleteScheduledAction(rp DeleteScheduledActionRequestParams) (
	resp *SimpleResp, err error) {
	resp = &SimpleResp{}
	params := makeParams("DeleteScheduledAction")
	params["AutoScalingGroupName"] = rp.AutoScalingGroupName
	params["ScheduledActionName"] = rp.ScheduledActionName
	err = as.query(params, resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
