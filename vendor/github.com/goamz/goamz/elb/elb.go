// This package provides types and functions to interact Elastic Load Balancing service
package elb

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/goamz/goamz/aws"
)

type ELB struct {
	aws.Auth
	aws.Region
}

func New(auth aws.Auth, region aws.Region) *ELB {
	return &ELB{auth, region}
}

// The CreateLoadBalancer type encapsulates options for the respective request in AWS.
// The creation of a Load Balancer may differ inside EC2 and VPC.
//
// See http://goo.gl/4QFKi for more details.
type CreateLoadBalancer struct {
	Name              string
	AvailabilityZones []string
	Listeners         []Listener
	Scheme            string
	SecurityGroups    []string
	Subnets           []string
}

// Listener to configure in Load Balancer.
//
// See http://goo.gl/NJQCj for more details.
type Listener struct {
	InstancePort     int
	InstanceProtocol string
	LoadBalancerPort int
	Protocol         string
	SSLCertificateId string
}

// Response to a CreateLoadBalance request.
//
// See http://goo.gl/4QFKi for more details.
type CreateLoadBalancerResp struct {
	DNSName string `xml:"CreateLoadBalancerResult>DNSName"`
}

type SimpleResp struct {
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// Creates a Load Balancer in Amazon.
//
// See http://goo.gl/4QFKi for more details.
func (elb *ELB) CreateLoadBalancer(options *CreateLoadBalancer) (resp *CreateLoadBalancerResp, err error) {
	params := makeCreateParams(options)
	resp = new(CreateLoadBalancerResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return
}

// Deletes a Load Balancer.
//
// See http://goo.gl/sDmPp for more details.
func (elb *ELB) DeleteLoadBalancer(name string) (resp *SimpleResp, err error) {
	params := map[string]string{
		"Action":           "DeleteLoadBalancer",
		"LoadBalancerName": name,
	}
	resp = new(SimpleResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type RegisterInstancesResp struct {
	InstanceIds []string `xml:"RegisterInstancesWithLoadBalancerResult>Instances>member>InstanceId"`
}

// Register N instances with a given Load Balancer.
//
// See http://goo.gl/x9hru for more details.
func (elb *ELB) RegisterInstancesWithLoadBalancer(instanceIds []string, lbName string) (resp *RegisterInstancesResp, err error) {
	// TODO: change params order and use ..., e.g (lbName string, instanceIds ...string)
	params := map[string]string{
		"Action":           "RegisterInstancesWithLoadBalancer",
		"LoadBalancerName": lbName,
	}
	for i, instanceId := range instanceIds {
		key := fmt.Sprintf("Instances.member.%d.InstanceId", i+1)
		params[key] = instanceId
	}
	resp = new(RegisterInstancesResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Deregister N instances from a given Load Balancer.
//
// See http://goo.gl/Hgo4U for more details.
func (elb *ELB) DeregisterInstancesFromLoadBalancer(instanceIds []string, lbName string) (resp *SimpleResp, err error) {
	// TODO: change params order and use ..., e.g (lbName string, instanceIds ...string)
	params := map[string]string{
		"Action":           "DeregisterInstancesFromLoadBalancer",
		"LoadBalancerName": lbName,
	}
	for i, instanceId := range instanceIds {
		key := fmt.Sprintf("Instances.member.%d.InstanceId", i+1)
		params[key] = instanceId
	}
	resp = new(SimpleResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type DescribeLoadBalancerResp struct {
	LoadBalancerDescriptions []LoadBalancerDescription `xml:"DescribeLoadBalancersResult>LoadBalancerDescriptions>member"`
}

type LoadBalancerDescription struct {
	AvailabilityZones         []string                    `xml:"AvailabilityZones>member"`
	BackendServerDescriptions []BackendServerDescriptions `xml:"BackendServerDescriptions>member"`
	CanonicalHostedZoneName   string                      `xml:"CanonicalHostedZoneName"`
	CanonicalHostedZoneNameId string                      `xml:"CanonicalHostedZoneNameID"`
	CreatedTime               time.Time                   `xml:"CreatedTime"`
	DNSName                   string                      `xml:"DNSName"`
	HealthCheck               HealthCheck                 `xml:"HealthCheck"`
	Instances                 []Instance                  `xml:"Instances>member"`
	ListenerDescriptions      []ListenerDescription       `xml:"ListenerDescriptions>member"`
	LoadBalancerName          string                      `xml:"LoadBalancerName"`
	Policies                  Policies                    `xml:"Policies"`
	Scheme                    string                      `xml:"Scheme"`
	SecurityGroups            []string                    `xml:"SecurityGroups>member"` //vpc only
	SourceSecurityGroup       SourceSecurityGroup         `xml:"SourceSecurityGroup"`
	Subnets                   []string                    `xml:"Subnets>member"`
	VPCId                     string                      `xml:"VPCId"`
}

// Describe Load Balancers.
// It can be used to describe all Load Balancers or specific ones.
//
// See http://goo.gl/wofJA for more details.
func (elb *ELB) DescribeLoadBalancers(names ...string) (*DescribeLoadBalancerResp, error) {
	params := map[string]string{"Action": "DescribeLoadBalancers"}
	for i, name := range names {
		index := fmt.Sprintf("LoadBalancerNames.member.%d", i+1)
		params[index] = name
	}
	resp := new(DescribeLoadBalancerResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type BackendServerDescriptions struct {
	InstancePort int      `xml:"InstancePort"`
	PolicyNames  []string `xml:"PolicyNames>member"`
}

type HealthCheck struct {
	HealthyThreshold   int    `xml:"HealthyThreshold"`
	Interval           int    `xml:"Interval"`
	Target             string `xml:"Target"`
	Timeout            int    `xml:"Timeout"`
	UnhealthyThreshold int    `xml:"UnhealthyThreshold"`
}

type Instance struct {
	InstanceId string `xml:"InstanceId"`
}

type ListenerDescription struct {
	Listener    Listener `xml:"Listener"`
	PolicyNames []string `xml:"PolicyNames>member"`
}

type Policies struct {
	AppCookieStickinessPolicies []AppCookieStickinessPolicies `xml:"AppCookieStickinessPolicies>member"`
	LBCookieStickinessPolicies  []LBCookieStickinessPolicies  `xml:"LBCookieStickinessPolicies>member"`
	OtherPolicies               []string                      `xml:"OtherPolicies>member"`
}

// see http://goo.gl/clXGV for more information.
type AppCookieStickinessPolicies struct {
	CookieName string `xml:"CookieName"`
	PolicyName string `xml:"PolicyName"`
}

type LBCookieStickinessPolicies struct {
	CookieExpirationPeriod int    `xml:"CookieExpirationPeriod"`
	PolicyName             string `xml:"PolicyName"`
}

type SourceSecurityGroup struct {
	GroupName  string `xml:"GroupName"`
	OwnerAlias string `xml:"OwnerAlias"`
}

// Represents a XML response for DescribeInstanceHealth action
//
// See http://goo.gl/ovIB1 for more information.
type DescribeInstanceHealthResp struct {
	InstanceStates []InstanceState `xml:"DescribeInstanceHealthResult>InstanceStates>member"`
}

// See http://goo.gl/dzWfP for more information.
type InstanceState struct {
	Description string `xml:"Description"`
	InstanceId  string `xml:"InstanceId"`
	ReasonCode  string `xml:"ReasonCode"`
	State       string `xml:"State"`
}

// Describe instance health.
//
// See http://goo.gl/ovIB1 for more information.
func (elb *ELB) DescribeInstanceHealth(lbName string, instanceIds ...string) (*DescribeInstanceHealthResp, error) {
	params := map[string]string{
		"Action":           "DescribeInstanceHealth",
		"LoadBalancerName": lbName,
	}
	for i, iId := range instanceIds {
		key := fmt.Sprintf("Instances.member.%d.InstanceId", i+1)
		params[key] = iId
	}
	resp := new(DescribeInstanceHealthResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type HealthCheckResp struct {
	HealthCheck *HealthCheck `xml:"ConfigureHealthCheckResult>HealthCheck"`
}

// Configure health check for a LB
//
// See http://goo.gl/2HE6a for more information
func (elb *ELB) ConfigureHealthCheck(lbName string, healthCheck *HealthCheck) (*HealthCheckResp, error) {
	params := map[string]string{
		"Action":                         "ConfigureHealthCheck",
		"LoadBalancerName":               lbName,
		"HealthCheck.HealthyThreshold":   strconv.Itoa(healthCheck.HealthyThreshold),
		"HealthCheck.Interval":           strconv.Itoa(healthCheck.Interval),
		"HealthCheck.Target":             healthCheck.Target,
		"HealthCheck.Timeout":            strconv.Itoa(healthCheck.Timeout),
		"HealthCheck.UnhealthyThreshold": strconv.Itoa(healthCheck.UnhealthyThreshold),
	}
	resp := new(HealthCheckResp)
	if err := elb.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Add tags to the named ELB
//
// Note that AWS only accepts one ELB name at a time (even though it is sent as a list)
//
// See http://goo.gl/6JW4Wf for the rest of the details
func (elb *ELB) AddTags(elbName string, tags map[string]string) (*SimpleResp, error) {
	var sortedKeys []string
	params := make(map[string]string)
	response := &SimpleResp{}

	for tagKey := range tags {
		sortedKeys = append(sortedKeys, tagKey)
	}

	sort.Strings(sortedKeys)

	for _, key := range sortedKeys {
		number := len(tags)
		params[fmt.Sprintf("Tags.member.%d.Key", number)] = key
		params[fmt.Sprintf("Tags.member.%d.Value", number)] = tags[key]
		delete(tags, key)
	}

	params["Action"] = "AddTags"
	params["LoadBalancerNames.member.1"] = elbName

	if err := elb.query(params, response); err != nil {
		return nil, err
	}

	return response, nil
}

// Remove tags from the named ELB
//
// Note that AWS only accepts one ELB name at a time (even though it is sent as a list)
//
// see http://goo.gl/ochFqo for more details

func (elb *ELB) RemoveTags(elbName string, tagKeys []string) (*SimpleResp, error) {
	response := &SimpleResp{}
	params := make(map[string]string)

	params["Action"] = "RemoveTags"
	params["LoadBalancerNames.member.1"] = elbName

	for i, tagKey := range tagKeys {
		params[fmt.Sprintf("Tags.member.%d.Key", i+1)] = tagKey
	}

	if err := elb.query(params, response); err != nil {
		return nil, err
	}

	return response, nil
}

func (elb *ELB) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2012-06-01"
	params["Timestamp"] = time.Now().In(time.UTC).Format(time.RFC3339)
	data := strings.NewReader(multimap(params).Encode())
	hreq, err := http.NewRequest("GET", elb.Region.ELBEndpoint+"/", data)
	if err != nil {
		return err
	}

	hreq.URL.RawQuery = multimap(params).Encode()
	token := elb.Auth.Token()
	if token != "" {
		hreq.Header.Set("X-Amz-Security-Token", token)
	}

	signer := aws.NewV4Signer(elb.Auth, "elasticloadbalancing", elb.Region)
	signer.Sign(hreq)

	r, err := http.DefaultClient.Do(hreq)

	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return buildError(r)
	}
	return xml.NewDecoder(r.Body).Decode(resp)
}

// Error encapsulates an error returned by ELB.
type Error struct {
	// HTTP status code
	StatusCode int
	// AWS error code
	Code string
	// The human-oriented error message
	Message string
}

func (err *Error) Error() string {
	if err.Code == "" {
		return err.Message
	}

	return fmt.Sprintf("%s (%s)", err.Message, err.Code)
}

type xmlErrors struct {
	Errors []Error `xml:"Error"`
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

func makeCreateParams(createLB *CreateLoadBalancer) map[string]string {
	params := make(map[string]string)
	params["LoadBalancerName"] = createLB.Name
	params["Action"] = "CreateLoadBalancer"
	if createLB.Scheme != "" {
		params["Scheme"] = createLB.Scheme
	}
	for i, s := range createLB.SecurityGroups {
		key := fmt.Sprintf("SecurityGroups.member.%d", i+1)
		params[key] = s
	}
	for i, s := range createLB.Subnets {
		key := fmt.Sprintf("Subnets.member.%d", i+1)
		params[key] = s
	}
	for i, l := range createLB.Listeners {
		key := "Listeners.member.%d.%s"
		index := i + 1
		params[fmt.Sprintf(key, index, "InstancePort")] = strconv.Itoa(l.InstancePort)
		params[fmt.Sprintf(key, index, "InstanceProtocol")] = l.InstanceProtocol
		params[fmt.Sprintf(key, index, "Protocol")] = l.Protocol
		params[fmt.Sprintf(key, index, "LoadBalancerPort")] = strconv.Itoa(l.LoadBalancerPort)
	}
	for i, az := range createLB.AvailabilityZones {
		key := fmt.Sprintf("AvailabilityZones.member.%d", i+1)
		params[key] = az
	}
	return params
}
