//
// ecs: This package provides types and functions to interact with the AWS EC2 Container Service API
//
// Depends on https://github.com/goamz/goamz
//
// Author Boyan Dimitrov <boyann@gmail.com>
//

package ecs

import (
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/goamz/goamz/aws"
)

const debug = false

var timeNow = time.Now

// ECS contains the details of the AWS region to perform operations against.
type ECS struct {
	aws.Auth
	aws.Region
}

// New creates a new ECS Client.
func New(auth aws.Auth, region aws.Region) *ECS {
	return &ECS{auth, region}
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

// Error encapsulates an error returned by the AWS ECS API.
//
// See http://goo.gl/VZGuC for more details.
type Error struct {
	// HTTP status code (200, 403, ...)
	StatusCode int
	// ECS error code ("UnsupportedOperation", ...)
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

func (e *ECS) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2014-11-13"
	data := strings.NewReader(multimap(params).Encode())

	hreq, err := http.NewRequest("POST", e.Region.ECSEndpoint+"/", data)
	if err != nil {
		return err
	}

	hreq.Header.Set("Content-Type", "application/x-www-form-urlencoded; param=value")

	token := e.Auth.Token()
	if token != "" {
		hreq.Header.Set("X-Amz-Security-Token", token)
	}

	signer := aws.NewV4Signer(e.Auth, "ecs", e.Region)
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
// ECS types and related functions.

// SimpleResp is the beic response from most actions.
type SimpleResp struct {
	XMLName   xml.Name
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// Cluster encapsulates the cluster datatype
//
// See
type Cluster struct {
	ClusterArn  string `xml:"clusterArn"`
	ClusterName string `xml:"clusterName"`
	Status      string `xml:"status"`
}

// CreateClusterReq encapsulates the createcluster req params
type CreateClusterReq struct {
	ClusterName string
}

// CreateClusterResp encapsulates the createcluster response
type CreateClusterResp struct {
	Cluster   Cluster `xml:"CreateClusterResult>cluster"`
	RequestId string  `xml:"ResponseMetadata>RequestId"`
}

// CreateCluster creates a new Amazon ECS cluster. By default, your account
// will receive a default cluster when you launch your first container instance
func (e *ECS) CreateCluster(req *CreateClusterReq) (resp *CreateClusterResp, err error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("CreateCluster")
	params["clusterName"] = req.ClusterName

	resp = new(CreateClusterResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Resource describes the resources available for a container instance.
type Resource struct {
	DoubleValue    float64  `xml:"doubleValue"`
	IntegerValue   int32    `xml:"integerValue"`
	LongValue      int64    `xml:"longValue"`
	Name           string   `xml:"name"`
	StringSetValue []string `xml:"stringSetValue>member"`
	Type           string   `xml:"type"`
}

// ContainerInstance represents n Amazon EC2 instance that is running
// the Amazon ECS agent and has been registered with a cluster
type ContainerInstance struct {
	AgentConnected       bool       `xml:"agentConnected"`
	ContainerInstanceArn string     `xml:"containerInstanceArn"`
	Ec2InstanceId        string     `xml:"ec2InstanceId"`
	RegisteredResources  []Resource `xml:"registeredResources>member"`
	RemainingResources   []Resource `xml:"remainingResources>member"`
	Status               string     `xml:"status"`
}

// DeregisterContainerInstanceReq encapsulates DeregisterContainerInstance request params
type DeregisterContainerInstanceReq struct {
	Cluster string
	// arn:aws:ecs:region:aws_account_id:container-instance/container_instance_UUID.
	ContainerInstance string
	Force             bool
}

// DeregisterContainerInstanceResp encapsulates DeregisterContainerInstance response
type DeregisterContainerInstanceResp struct {
	ContainerInstance ContainerInstance `xml:"DeregisterContainerInstanceResult>containerInstance"`
	RequestId         string            `xml:"ResponseMetadata>RequestId"`
}

// DeregisterContainerInstance deregisters an Amazon ECS container instance from the specified cluster
func (e *ECS) DeregisterContainerInstance(req *DeregisterContainerInstanceReq) (
	resp *DeregisterContainerInstanceResp, err error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DeregisterContainerInstance")
	params["containerInstance"] = req.ContainerInstance
	params["force"] = strconv.FormatBool(req.Force)

	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}

	resp = new(DeregisterContainerInstanceResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// PortMapping encapsulates the PortMapping data type
type PortMapping struct {
	ContainerPort int32 `xml:containerPort`
	HostPort      int32 `xml:hostPort`
}

// KeyValuePair encapsulates the KeyValuePair data type
type KeyValuePair struct {
	Name  string `xml:"name"`
	Value string `xml:"value"`
}

// MountPoint encapsulates the MountPoint data type
type MountPoint struct {
	ContainerPath string `xml:"containerPath"`
	ReadOnly      bool   `xml:"readOnly"`
	SourceVolume  string `xml:"sourceVolume"`
}

// VolumeFrom encapsulates the VolumeFrom data type
type VolumeFrom struct {
	ReadOnly        bool   `xml:"readOnly"`
	SourceContainer string `xml:"sourceContainer"`
}

// HostVolumeProperties encapsulates the HostVolumeProperties data type
type HostVolumeProperties struct {
	SourcePath string `xml:"sourcePath"`
}

// Volume encapsulates the Volume data type
type Volume struct {
	Host HostVolumeProperties `xml:"host"`
	Name string               `xml:"name"`
}

// ContainerDefinition encapsulates the container definition type
// Container definitions are used in task definitions to describe
// the different containers that are launched as part of a task
type ContainerDefinition struct {
	Command      []string       `xml:"command>member"`
	Cpu          int32          `xml:"cpu"`
	EntryPoint   []string       `xml:"entryPoint>member"`
	Environment  []KeyValuePair `xml:"environment>member"`
	Essential    bool           `xml:"essential"`
	Image        string         `xml:"image"`
	Links        []string       `xml:"links>member"`
	Memory       int32          `xml:"memory"`
	MountPoints  []MountPoint   `xml:"mountPoints>member"`
	Name         string         `xml:"name"`
	PortMappings []PortMapping  `xml:"portMappings>member"`
	VolumesFrom  []VolumeFrom   `xml:"volumesFrom>member"`
}

// TaskDefinition encapsulates the task definition type
type TaskDefinition struct {
	ContainerDefinitions []ContainerDefinition `xml:"containerDefinitions>member"`
	Family               string                `xml:"family"`
	Revision             int32                 `xml:"revision"`
	TaskDefinitionArn    string                `xml:"taskDefinitionArn"`
	Status               string                `xml:"status"`
	Volumes              []Volume              `xml:"volumes>member"`
}

// DeregisterTaskDefinitionReq encapsulates DeregisterTaskDefinition req params
type DeregisterTaskDefinitionReq struct {
	TaskDefinition string
}

// DeregisterTaskDefinitionResp encapsuates the DeregisterTaskDefinition response
type DeregisterTaskDefinitionResp struct {
	TaskDefinition TaskDefinition `xml:"DeregisterTaskDefinitionResult>taskDefinition"`
	RequestId      string         `xml:"ResponseMetadata>RequestId"`
}

// DeregisterTaskDefinition deregisters the specified task definition
func (e *ECS) DeregisterTaskDefinition(req *DeregisterTaskDefinitionReq) (
	*DeregisterTaskDefinitionResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DeregisterTaskDefinition")
	params["taskDefinition"] = req.TaskDefinition

	resp := new(DeregisterTaskDefinitionResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Failure encapsulates the failure type
type Failure struct {
	Arn    string `xml:"arn"`
	Reason string `xml:"reason"`
}

// DescribeClustersReq encapsulates DescribeClusters req params
type DescribeClustersReq struct {
	Clusters []string
}

// DescribeClustersResp encapsuates the DescribeClusters response
type DescribeClustersResp struct {
	Clusters  []Cluster `xml:"DescribeClustersResult>clusters>member"`
	Failures  []Failure `xml:"DescribeClustersResult>failures>member"`
	RequestId string    `xml:"ResponseMetadata>RequestId"`
}

// DescribeClusters describes one or more of your clusters
func (e *ECS) DescribeClusters(req *DescribeClustersReq) (*DescribeClustersResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DescribeClusters")
	if len(req.Clusters) > 0 {
		addParamsList(params, "clusters.member", req.Clusters)
	}

	resp := new(DescribeClustersResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeContainerInstancesReq ecapsulates DescribeContainerInstances req params
type DescribeContainerInstancesReq struct {
	Cluster            string
	ContainerInstances []string
}

// DescribeContainerInstancesResp ecapsulates DescribeContainerInstances response
type DescribeContainerInstancesResp struct {
	ContainerInstances []ContainerInstance `xml:"DescribeContainerInstancesResult>containerInstances>member"`
	Failures           []Failure           `xml:"DescribeContainerInstancesResult>failures>member"`
	RequestId          string              `xml:"ResponseMetadata>RequestId"`
}

// DescribeContainerInstances describes Amazon EC2 Container Service container instances
// Returns metadata about registered and remaining resources on each container instance requested
func (e *ECS) DescribeContainerInstances(req *DescribeContainerInstancesReq) (
	*DescribeContainerInstancesResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DescribeContainerInstances")
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if len(req.ContainerInstances) > 0 {
		addParamsList(params, "containerInstances.member", req.ContainerInstances)
	}

	resp := new(DescribeContainerInstancesResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DescribeTaskDefinitionReq encapsulates DescribeTaskDefinition req params
type DescribeTaskDefinitionReq struct {
	TaskDefinition string
}

// DescribeTaskDefinitionResp encapsuates the DescribeTaskDefinition response
type DescribeTaskDefinitionResp struct {
	TaskDefinition TaskDefinition `xml:"DescribeTaskDefinitionResult>taskDefinition"`
	RequestId      string         `xml:"ResponseMetadata>RequestId"`
}

// DescribeTaskDefinition describes a task definition
func (e *ECS) DescribeTaskDefinition(req *DescribeTaskDefinitionReq) (
	*DescribeTaskDefinitionResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DescribeTaskDefinition")
	params["taskDefinition"] = req.TaskDefinition

	resp := new(DescribeTaskDefinitionResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// NetworkBinding encapsulates the network binding data type
type NetworkBinding struct {
	BindIp        string `xml:"bindIp"`
	ContainerPort int32  `xml:"containerPort"`
	HostPort      int32  `xml:"hostPort"`
}

// Container encapsulates the container data type
type Container struct {
	ContainerArn    string           `xml:"containerArn"`
	ExitCode        int32            `xml:"exitCode"`
	LastStatus      string           `xml:"lastStatus"`
	Name            string           `xml:"name"`
	NetworkBindings []NetworkBinding `xml:"networkBindings>member"`
	Reason          string           `xml:"reason"`
	TaskArn         string           `xml:"taskArn"`
}

// ContainerOverride encapsulates the container override data type
type ContainerOverride struct {
	Command     []string       `xml:"command>member"`
	Environment []KeyValuePair `xml:"environment>member"`
	Name        string         `xml:"name"`
}

// TaskOverride encapsulates the task override data type
type TaskOverride struct {
	ContainerOverrides []ContainerOverride `xml:"containerOverrides>member"`
}

// Task encapsulates the task data type
type Task struct {
	ClusterArn           string       `xml:"clusterArn"`
	ContainerInstanceArn string       `xml:"containerInstanceArn"`
	Containers           []Container  `xml:"containers>member"`
	DesiredStatus        string       `xml:"desiredStatus"`
	LastStatus           string       `xml:"lastStatus"`
	Overrides            TaskOverride `xml:"overrides"`
	TaskArn              string       `xml:"taskArn"`
	TaskDefinitionArn    string       `xml:"taskDefinitionArn"`
}

// DescribeTasksReq encapsulates DescribeTasks req params
type DescribeTasksReq struct {
	Cluster string
	Tasks   []string
}

// DescribeTasksResp encapsuates the DescribeTasks response
type DescribeTasksResp struct {
	Tasks     []Task    `xml:"DescribeTasksResult>tasks>member"`
	Failures  []Failure `xml:"DescribeTasksResult>failures>member"`
	RequestId string    `xml:"ResponseMetadata>RequestId"`
}

// DescribeTasks describes a task definition
func (e *ECS) DescribeTasks(req *DescribeTasksReq) (*DescribeTasksResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DescribeTasks")
	if len(req.Tasks) > 0 {
		addParamsList(params, "tasks.member", req.Tasks)
	}
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}

	resp := new(DescribeTasksResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DiscoverPollEndpointReq encapsulates DiscoverPollEndpoint req params
type DiscoverPollEndpointReq struct {
	ContainerInstance string
}

// DiscoverPollEndpointResp encapsuates the DiscoverPollEndpoint response
type DiscoverPollEndpointResp struct {
	Endpoint  string `xml:"DiscoverPollEndpointResult>endpoint"`
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// DiscoverPollEndpoint returns an endpoint for the Amazon EC2 Container Service agent
// to poll for updates
func (e *ECS) DiscoverPollEndpoint(req *DiscoverPollEndpointReq) (
	*DiscoverPollEndpointResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("DiscoverPollEndpoint")
	if req.ContainerInstance != "" {
		params["containerInstance"] = req.ContainerInstance
	}

	resp := new(DiscoverPollEndpointResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ListClustersReq encapsulates ListClusters req params
type ListClustersReq struct {
	MaxResults int32
	NextToken  string
}

// ListClustersResp encapsuates the ListClusters response
type ListClustersResp struct {
	ClusterArns []string `xml:"ListClustersResult>clusterArns>member"`
	NextToken   string   `xml:"ListClustersResult>nextToken"`
	RequestId   string   `xml:"ResponseMetadata>RequestId"`
}

// ListClusters returns a list of existing clusters
func (e *ECS) ListClusters(req *ListClustersReq) (
	*ListClustersResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("ListClusters")
	if req.MaxResults > 0 {
		params["maxResults"] = strconv.Itoa(int(req.MaxResults))
	}
	if req.NextToken != "" {
		params["nextToken"] = req.NextToken
	}

	resp := new(ListClustersResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ListContainerInstancesReq encapsulates ListContainerInstances req params
type ListContainerInstancesReq struct {
	Cluster    string
	MaxResults int32
	NextToken  string
}

// ListContainerInstancesResp encapsuates the ListContainerInstances response
type ListContainerInstancesResp struct {
	ContainerInstanceArns []string `xml:"ListContainerInstancesResult>containerInstanceArns>member"`
	NextToken             string   `xml:"ListContainerInstancesResult>nextToken"`
	RequestId             string   `xml:"ResponseMetadata>RequestId"`
}

// ListContainerInstances returns a list of container instances in a specified cluster.
func (e *ECS) ListContainerInstances(req *ListContainerInstancesReq) (
	*ListContainerInstancesResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("ListContainerInstances")
	if req.MaxResults > 0 {
		params["maxResults"] = strconv.Itoa(int(req.MaxResults))
	}
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.NextToken != "" {
		params["nextToken"] = req.NextToken
	}

	resp := new(ListContainerInstancesResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ListTaskDefinitionsReq encapsulates ListTaskDefinitions req params
type ListTaskDefinitionsReq struct {
	FamilyPrefix string
	MaxResults   int32
	NextToken    string
}

// ListTaskDefinitionsResp encapsuates the ListTaskDefinitions response
type ListTaskDefinitionsResp struct {
	TaskDefinitionArns []string `xml:"ListTaskDefinitionsResult>taskDefinitionArns>member"`
	NextToken          string   `xml:"ListTaskDefinitionsResult>nextToken"`
	RequestId          string   `xml:"ResponseMetadata>RequestId"`
}

// ListTaskDefinitions Returns a list of task definitions that are registered to your account.
func (e *ECS) ListTaskDefinitions(req *ListTaskDefinitionsReq) (
	*ListTaskDefinitionsResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("ListTaskDefinitions")
	if req.MaxResults > 0 {
		params["maxResults"] = strconv.Itoa(int(req.MaxResults))
	}
	if req.FamilyPrefix != "" {
		params["familyPrefix"] = req.FamilyPrefix
	}
	if req.NextToken != "" {
		params["nextToken"] = req.NextToken
	}

	resp := new(ListTaskDefinitionsResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ListTasksReq encapsulates ListTasks req params
type ListTasksReq struct {
	Cluster           string
	ContainerInstance string
	Family            string
	MaxResults        int32
	NextToken         string
}

// ListTasksResp encapsuates the ListTasks response
type ListTasksResp struct {
	TaskArns  []string `xml:"ListTasksResult>taskArns>member"`
	NextToken string   `xml:"ListTasksResult>nextToken"`
	RequestId string   `xml:"ResponseMetadata>RequestId"`
}

// ListTasks Returns a list of tasks for a specified cluster.
// You can filter the results by family name or by a particular container instance
// with the family and containerInstance parameters.
func (e *ECS) ListTasks(req *ListTasksReq) (
	*ListTasksResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("ListTasks")
	if req.MaxResults > 0 {
		params["maxResults"] = strconv.Itoa(int(req.MaxResults))
	}
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.ContainerInstance != "" {
		params["containerInstance"] = req.ContainerInstance
	}
	if req.Family != "" {
		params["family"] = req.Family
	}
	if req.NextToken != "" {
		params["nextToken"] = req.NextToken
	}

	resp := new(ListTasksResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// RegisterContainerInstanceReq encapsulates RegisterContainerInstance req params
type RegisterContainerInstanceReq struct {
	Cluster                           string
	InstanceIdentityDocument          string
	InstanceIdentityDocumentSignature string
	TotalResources                    []Resource
}

// DeregisterContainerInstanceResp encapsulates RegisterContainerInstance response
type RegisterContainerInstanceResp struct {
	ContainerInstance ContainerInstance `xml:"RegisterContainerInstanceResult>containerInstance"`
	RequestId         string            `xml:"ResponseMetadata>RequestId"`
}

// RegisterContainerInstance registers an Amazon EC2 instance into the specified cluster.
// This instance will become available to place containers on.
func (e *ECS) RegisterContainerInstance(req *RegisterContainerInstanceReq) (
	resp *RegisterContainerInstanceResp, err error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("RegisterContainerInstance")
	if req.InstanceIdentityDocument != "" {
		params["instanceIdentityDocument"] = req.InstanceIdentityDocument
	}
	if req.InstanceIdentityDocumentSignature != "" {
		params["instanceIdentityDocumentSignature"] = req.InstanceIdentityDocumentSignature
	}
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	// Marshal Resources
	for i, r := range req.TotalResources {
		key := fmt.Sprintf("totalResources.member.%d", i+1)
		params[fmt.Sprintf("%s.doubleValue", key)] = strconv.FormatFloat(r.DoubleValue, 'f', 1, 64)
		params[fmt.Sprintf("%s.integerValue", key)] = strconv.Itoa(int(r.IntegerValue))
		params[fmt.Sprintf("%s.longValue", key)] = strconv.Itoa(int(r.LongValue))
		params[fmt.Sprintf("%s.name", key)] = r.Name
		params[fmt.Sprintf("%s.type", key)] = r.Type
		for k, sv := range r.StringSetValue {
			params[fmt.Sprintf("%s.stringSetValue.member.%d", key, k+1)] = sv
		}
	}

	resp = new(RegisterContainerInstanceResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// RegisterTaskDefinitionReq encapsulates RegisterTaskDefinition req params
type RegisterTaskDefinitionReq struct {
	Family               string
	ContainerDefinitions []ContainerDefinition
	Volumes              []Volume
}

// RegisterTaskDefinitionResp encapsulates RegisterTaskDefinition response
type RegisterTaskDefinitionResp struct {
	TaskDefinition TaskDefinition `xml:"RegisterTaskDefinitionResult>taskDefinition"`
	RequestId      string         `xml:"ResponseMetadata>RequestId"`
}

// RegisterTaskDefinition registers a new task definition from the supplied family and containerDefinitions.
func (e *ECS) RegisterTaskDefinition(req *RegisterTaskDefinitionReq) (
	resp *RegisterTaskDefinitionResp, err error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}
	params := makeParams("RegisterTaskDefinition")
	if req.Family != "" {
		params["family"] = req.Family
	}

	// Marshal Container Definitions
	for i, c := range req.ContainerDefinitions {
		key := fmt.Sprintf("containerDefinitions.member.%d", i+1)
		params[fmt.Sprintf("%s.cpu", key)] = strconv.Itoa(int(c.Cpu))
		params[fmt.Sprintf("%s.essential", key)] = strconv.FormatBool(c.Essential)
		params[fmt.Sprintf("%s.image", key)] = c.Image
		params[fmt.Sprintf("%s.memory", key)] = strconv.Itoa(int(c.Memory))
		params[fmt.Sprintf("%s.name", key)] = c.Name

		for k, cmd := range c.Command {
			params[fmt.Sprintf("%s.command.member.%d", key, k+1)] = cmd
		}
		for k, ep := range c.EntryPoint {
			params[fmt.Sprintf("%s.entryPoint.member.%d", key, k+1)] = ep
		}
		for k, env := range c.Environment {
			params[fmt.Sprintf("%s.environment.member.%d.name", key, k+1)] = env.Name
			params[fmt.Sprintf("%s.environment.member.%d.value", key, k+1)] = env.Value
		}
		for k, l := range c.Links {
			params[fmt.Sprintf("%s.links.member.%d", key, k+1)] = l
		}
		for k, p := range c.PortMappings {
			params[fmt.Sprintf("%s.portMappings.member.%d.containerPort", key, k+1)] = strconv.Itoa(int(p.ContainerPort))
			params[fmt.Sprintf("%s.portMappings.member.%d.hostPort", key, k+1)] = strconv.Itoa(int(p.HostPort))
		}
		for k, m := range c.MountPoints {
			params[fmt.Sprintf("%s.mountPoints.member.%d.containerPath", key, k+1)] = m.ContainerPath
			params[fmt.Sprintf("%s.mountPoints.member.%d.readOnly", key, k+1)] = strconv.FormatBool(m.ReadOnly)
			params[fmt.Sprintf("%s.mountPoints.member.%d.sourceVolume", key, k+1)] = m.SourceVolume
		}
		for k, v := range c.VolumesFrom {
			params[fmt.Sprintf("%s.volumesFrom.member.%d.readOnly", key, k+1)] = strconv.FormatBool(v.ReadOnly)
			params[fmt.Sprintf("%s.volumesFrom.member.%d.sourceContainer", key, k+1)] = v.SourceContainer
		}
	}

	for k, v := range req.Volumes {
		params[fmt.Sprintf("volumes.member.%d.name", k+1)] = v.Name
		params[fmt.Sprintf("volumes.member.%d.host.sourcePath", k+1)] = v.Host.SourcePath
	}

	resp = new(RegisterTaskDefinitionResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// RunTaskReq encapsulates RunTask req params
type RunTaskReq struct {
	Cluster        string
	Count          int32
	Overrides      TaskOverride
	TaskDefinition string
}

// RunTaskResp encapsuates the RunTask response
type RunTaskResp struct {
	Tasks     []Task    `xml:"RunTaskResult>tasks>member"`
	Failures  []Failure `xml:"RunTaskResult>failures>member"`
	RequestId string    `xml:"ResponseMetadata>RequestId"`
}

// RunTask Start a task using random placement and the default Amazon ECS scheduler.
// If you want to use your own scheduler or place a task on a specific container instance,
// use StartTask instead.
func (e *ECS) RunTask(req *RunTaskReq) (*RunTaskResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("RunTask")
	if req.Count > 0 {
		params["count"] = strconv.Itoa(int(req.Count))
	}
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.TaskDefinition != "" {
		params["taskDefinition"] = req.TaskDefinition
	}

	for i, co := range req.Overrides.ContainerOverrides {
		key := fmt.Sprintf("overrides.containerOverrides.member.%d", i+1)
		params[fmt.Sprintf("%s.name", key)] = co.Name
		for k, cmd := range co.Command {
			params[fmt.Sprintf("%s.command.member.%d", key, k+1)] = cmd
		}
		for k, env := range co.Environment {
			params[fmt.Sprintf("%s.environment.member.%d.name", key, k+1)] = env.Name
			params[fmt.Sprintf("%s.environment.member.%d.value", key, k+1)] = env.Value
		}
	}

	resp := new(RunTaskResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// StartTaskReq encapsulates StartTask req params
type StartTaskReq struct {
	Cluster            string
	ContainerInstances []string
	Overrides          TaskOverride
	TaskDefinition     string
}

// StartTaskResp encapsuates the StartTask response
type StartTaskResp struct {
	Tasks     []Task    `xml:"StartTaskResult>tasks>member"`
	Failures  []Failure `xml:"StartTaskResult>failures>member"`
	RequestId string    `xml:"ResponseMetadata>RequestId"`
}

// StartTask Starts a new task from the specified task definition on the specified
// container instance or instances. If you want to use the default Amazon ECS scheduler
// to place your task, use RunTask instead.
func (e *ECS) StartTask(req *StartTaskReq) (*StartTaskResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("StartTask")
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.TaskDefinition != "" {
		params["taskDefinition"] = req.TaskDefinition
	}
	for i, ci := range req.ContainerInstances {
		params[fmt.Sprintf("containerInstances.member.%d", i+1)] = ci
	}
	for i, co := range req.Overrides.ContainerOverrides {
		key := fmt.Sprintf("overrides.containerOverrides.member.%d", i+1)
		params[fmt.Sprintf("%s.name", key)] = co.Name
		for k, cmd := range co.Command {
			params[fmt.Sprintf("%s.command.member.%d", key, k+1)] = cmd
		}
	}

	resp := new(StartTaskResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// StopTaskReq encapsulates StopTask req params
type StopTaskReq struct {
	Cluster string
	Task    string
}

// StopTaskResp encapsuates the StopTask response
type StopTaskResp struct {
	Task      Task   `xml:"StopTaskResult>task"`
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// StopTask stops a running task
func (e *ECS) StopTask(req *StopTaskReq) (*StopTaskResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("StopTask")
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.Task != "" {
		params["task"] = req.Task
	}

	resp := new(StopTaskResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// SubmitContainerStateChangeReq encapsulates SubmitContainerStateChange req params
type SubmitContainerStateChangeReq struct {
	Cluster         string
	ContainerName   string
	ExitCode        int32
	NetworkBindings []NetworkBinding
	Reason          string
	Status          string
	Task            string
}

// SubmitContainerStateChangeResp encapsuates the SubmitContainerStateChange response
type SubmitContainerStateChangeResp struct {
	Acknowledgment string `xml:"SubmitContainerStateChangeResult>acknowledgment"`
	RequestId      string `xml:"ResponseMetadata>RequestId"`
}

// SubmitContainerStateChange is used to acknowledge that a container changed states.
// Note: This action is only used by the Amazon EC2 Container Service agent,
// and it is not intended for use outside of the agent.
func (e *ECS) SubmitContainerStateChange(req *SubmitContainerStateChangeReq) (
	*SubmitContainerStateChangeResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("SubmitContainerStateChange")
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}
	if req.ContainerName != "" {
		params["containerName"] = req.ContainerName
	}
	if req.Reason != "" {
		params["reason"] = req.Reason
	}
	if req.Status != "" {
		params["status"] = req.Status
	}
	if req.Task != "" {
		params["task"] = req.Task
	}
	for i, nb := range req.NetworkBindings {
		key := fmt.Sprintf("networkBindings.member.%d", i+1)
		params[fmt.Sprintf("%s.bindIp", key)] = nb.BindIp
		params[fmt.Sprintf("%s.containerPort", key)] = strconv.Itoa(int(nb.ContainerPort))
		params[fmt.Sprintf("%s.hostPort", key)] = strconv.Itoa(int(nb.HostPort))
	}
	params["exitCode"] = strconv.Itoa(int(req.ExitCode))

	resp := new(SubmitContainerStateChangeResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// SubmitTaskStateChangeReq encapsulates SubmitTaskStateChange req params
type SubmitTaskStateChangeReq struct {
	Cluster string
	Reason  string
	Status  string
	Task    string
}

// SubmitTaskStateChangeResp encapsuates the SubmitTaskStateChange response
type SubmitTaskStateChangeResp struct {
	Acknowledgment string `xml:"SubmitTaskStateChangeResult>acknowledgment"`
	RequestId      string `xml:"ResponseMetadata>RequestId"`
}

// SubmitTaskStateChange is used to acknowledge that a task changed states.
// Note: This action is only used by the Amazon EC2 Container Service agent,
// and it is not intended for use outside of the agent.
func (e *ECS) SubmitTaskStateChange(req *SubmitTaskStateChangeReq) (
	*SubmitTaskStateChangeResp, error) {
	if req == nil {
		return nil, fmt.Errorf("The req params cannot be nil")
	}

	params := makeParams("SubmitTaskStateChange")
	if req.Cluster != "" {
		params["cluster"] = req.Cluster
	}

	if req.Reason != "" {
		params["reason"] = req.Reason
	}
	if req.Status != "" {
		params["status"] = req.Status
	}
	if req.Task != "" {
		params["task"] = req.Task
	}

	resp := new(SubmitTaskStateChangeResp)
	if err := e.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}
