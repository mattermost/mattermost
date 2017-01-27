package ecs

import (
	"testing"

	. "gopkg.in/check.v1"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/testutil"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	ecs *ECS
}

var testServer = testutil.NewHTTPServer()

var mockTest bool

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.ecs = New(auth, aws.Region{ECSEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

// --------------------------------------------------------------------------
// Detailed Unit Tests

func (s *S) TestCreateCluster(c *C) {
	testServer.Response(200, nil, CreateClusterResponse)
	req := &CreateClusterReq{
		ClusterName: "default",
	}
	resp, err := s.ecs.CreateCluster(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "CreateCluster")
	c.Assert(values.Get("clusterName"), Equals, "default")

	c.Assert(resp.Cluster.ClusterArn, Equals, "arn:aws:ecs:region:aws_account_id:cluster/default")
	c.Assert(resp.Cluster.ClusterName, Equals, "default")
	c.Assert(resp.Cluster.Status, Equals, "ACTIVE")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDeregisterContainerInstance(c *C) {
	testServer.Response(200, nil, DeregisterContainerInstanceResponse)
	req := &DeregisterContainerInstanceReq{
		Cluster:           "default",
		ContainerInstance: "uuid",
		Force:             true,
	}
	resp, err := s.ecs.DeregisterContainerInstance(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DeregisterContainerInstance")
	c.Assert(values.Get("cluster"), Equals, "default")
	c.Assert(values.Get("containerInstance"), Equals, "uuid")
	c.Assert(values.Get("force"), Equals, "true")

	expectedResource := []Resource{
		{
			DoubleValue:  0.0,
			IntegerValue: 2048,
			LongValue:    0,
			Name:         "CPU",
			Type:         "INTEGER",
		},
		{
			DoubleValue:  0.0,
			IntegerValue: 3955,
			LongValue:    0,
			Name:         "MEMORY",
			Type:         "INTEGER",
		},
		{
			DoubleValue:    0.0,
			IntegerValue:   0,
			LongValue:      0,
			Name:           "PORTS",
			StringSetValue: []string{"2376", "22", "51678", "2375"},
			Type:           "STRINGSET",
		},
	}

	c.Assert(resp.ContainerInstance.AgentConnected, Equals, false)
	c.Assert(resp.ContainerInstance.ContainerInstanceArn, Equals, "arn:aws:ecs:us-east-1:aws_account_id:container-instance/container_instance_UUID")
	c.Assert(resp.ContainerInstance.Status, Equals, "INACTIVE")
	c.Assert(resp.ContainerInstance.Ec2InstanceId, Equals, "instance_id")
	c.Assert(resp.ContainerInstance.RegisteredResources, DeepEquals, expectedResource)
	c.Assert(resp.ContainerInstance.RemainingResources, DeepEquals, expectedResource)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDeregisterTaskDefinition(c *C) {
	testServer.Response(200, nil, DeregisterTaskDefinitionResponse)
	req := &DeregisterTaskDefinitionReq{
		TaskDefinition: "sleep360:2",
	}
	resp, err := s.ecs.DeregisterTaskDefinition(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DeregisterTaskDefinition")
	c.Assert(values.Get("taskDefinition"), Equals, "sleep360:2")

	expected := TaskDefinition{
		Family:            "sleep360",
		Revision:          2,
		TaskDefinitionArn: "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		ContainerDefinitions: []ContainerDefinition{
			{
				Command:    []string{"sleep", "360"},
				Cpu:        10,
				EntryPoint: []string{"/bin/sh"},
				Environment: []KeyValuePair{
					{
						Name:  "envVar",
						Value: "foo",
					},
				},
				Essential: true,
				Image:     "busybox",
				Memory:    10,
				Name:      "sleep",
			},
		},
	}

	c.Assert(resp.TaskDefinition, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDescribeClusters(c *C) {
	testServer.Response(200, nil, DescribeClustersResponse)
	req := &DescribeClustersReq{
		Clusters: []string{"test", "default"},
	}
	resp, err := s.ecs.DescribeClusters(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DescribeClusters")
	c.Assert(values.Get("clusters.member.1"), Equals, "test")
	c.Assert(values.Get("clusters.member.2"), Equals, "default")

	expected := []Cluster{
		{
			ClusterName: "test",
			ClusterArn:  "arn:aws:ecs:us-east-1:aws_account_id:cluster/test",
			Status:      "ACTIVE",
		},
		{
			ClusterName: "default",
			ClusterArn:  "arn:aws:ecs:us-east-1:aws_account_id:cluster/default",
			Status:      "ACTIVE",
		},
	}

	c.Assert(resp.Clusters, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDescribeContainerInstances(c *C) {
	testServer.Response(200, nil, DescribeContainerInstancesResponse)
	req := &DescribeContainerInstancesReq{
		Cluster:            "test",
		ContainerInstances: []string{"arn:aws:ecs:us-east-1:aws_account_id:container-instance/container_instance_UUID"},
	}
	resp, err := s.ecs.DescribeContainerInstances(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DescribeContainerInstances")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("containerInstances.member.1"),
		Equals, "arn:aws:ecs:us-east-1:aws_account_id:container-instance/container_instance_UUID")

	expected := []ContainerInstance{
		ContainerInstance{
			AgentConnected:       true,
			ContainerInstanceArn: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/container_instance_UUID",
			Status:               "ACTIVE",
			Ec2InstanceId:        "instance_id",
			RegisteredResources: []Resource{
				{
					DoubleValue:  0.0,
					IntegerValue: 2048,
					LongValue:    0,
					Name:         "CPU",
					Type:         "INTEGER",
				},
				{
					DoubleValue:  0.0,
					IntegerValue: 3955,
					LongValue:    0,
					Name:         "MEMORY",
					Type:         "INTEGER",
				},
				{
					DoubleValue:    0.0,
					IntegerValue:   0,
					LongValue:      0,
					Name:           "PORTS",
					StringSetValue: []string{"2376", "22", "51678", "2375"},
					Type:           "STRINGSET",
				},
			},
			RemainingResources: []Resource{
				{
					DoubleValue:  0.0,
					IntegerValue: 2048,
					LongValue:    0,
					Name:         "CPU",
					Type:         "INTEGER",
				},
				{
					DoubleValue:  0.0,
					IntegerValue: 3955,
					LongValue:    0,
					Name:         "MEMORY",
					Type:         "INTEGER",
				},
				{
					DoubleValue:    0.0,
					IntegerValue:   0,
					LongValue:      0,
					Name:           "PORTS",
					StringSetValue: []string{"2376", "22", "51678", "2375"},
					Type:           "STRINGSET",
				},
			},
		},
	}

	c.Assert(resp.ContainerInstances, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDescribeTaskDefinition(c *C) {
	testServer.Response(200, nil, DescribeTaskDefinitionResponse)
	req := &DescribeTaskDefinitionReq{
		TaskDefinition: "sleep360:2",
	}
	resp, err := s.ecs.DescribeTaskDefinition(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DescribeTaskDefinition")
	c.Assert(values.Get("taskDefinition"), Equals, "sleep360:2")

	expected := TaskDefinition{
		Family:            "sleep360",
		Revision:          2,
		TaskDefinitionArn: "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		ContainerDefinitions: []ContainerDefinition{
			{
				Command:    []string{"sleep", "360"},
				Cpu:        10,
				EntryPoint: []string{"/bin/sh"},
				Environment: []KeyValuePair{
					{
						Name:  "envVar",
						Value: "foo",
					},
				},
				Essential: true,
				Image:     "busybox",
				Memory:    10,
				Name:      "sleep",
			},
		},
	}

	c.Assert(resp.TaskDefinition, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDescribeTasks(c *C) {
	testServer.Response(200, nil, DescribeTasksResponse)
	req := &DescribeTasksReq{
		Cluster: "test",
		Tasks:   []string{"arn:aws:ecs:us-east-1:aws_account_id:task/UUID"},
	}
	resp, err := s.ecs.DescribeTasks(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DescribeTasks")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("tasks.member.1"),
		Equals, "arn:aws:ecs:us-east-1:aws_account_id:task/UUID")

	expected := []Task{
		Task{
			Containers: []Container{
				{
					TaskArn:      "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
					Name:         "sleep",
					ContainerArn: "arn:aws:ecs:us-east-1:aws_account_id:container/UUID",
					LastStatus:   "RUNNING",
				},
			},
			Overrides: TaskOverride{
				ContainerOverrides: []ContainerOverride{
					{
						Name: "sleep",
					},
				},
			},
			DesiredStatus:        "RUNNING",
			TaskArn:              "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
			ContainerInstanceArn: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID",
			LastStatus:           "RUNNING",
			TaskDefinitionArn:    "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		},
	}

	c.Assert(resp.Tasks, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestDiscoverPollEndpoint(c *C) {
	testServer.Response(200, nil, DiscoverPollEndpointResponse)
	req := &DiscoverPollEndpointReq{
		ContainerInstance: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID",
	}
	resp, err := s.ecs.DiscoverPollEndpoint(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "DiscoverPollEndpoint")
	c.Assert(values.Get("containerInstance"),
		Equals, "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID")

	c.Assert(resp.Endpoint, Equals, "https://ecs-x-1.us-east-1.amazonaws.com/")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestListClusters(c *C) {
	testServer.Response(200, nil, ListClustersResponse)
	req := &ListClustersReq{
		MaxResults: 2,
		NextToken:  "Token_UUID",
	}
	resp, err := s.ecs.ListClusters(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "ListClusters")
	c.Assert(values.Get("maxResults"), Equals, "2")
	c.Assert(values.Get("nextToken"), Equals, "Token_UUID")

	c.Assert(resp.ClusterArns, DeepEquals, []string{"arn:aws:ecs:us-east-1:aws_account_id:cluster/default",
		"arn:aws:ecs:us-east-1:aws_account_id:cluster/test"})
	c.Assert(resp.NextToken, Equals, "token_UUID")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestListContainerInstances(c *C) {
	testServer.Response(200, nil, ListContainerInstancesResponse)
	req := &ListContainerInstancesReq{
		MaxResults: 2,
		NextToken:  "Token_UUID",
		Cluster:    "test",
	}
	resp, err := s.ecs.ListContainerInstances(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "ListContainerInstances")
	c.Assert(values.Get("maxResults"), Equals, "2")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("nextToken"), Equals, "Token_UUID")

	c.Assert(resp.ContainerInstanceArns, DeepEquals, []string{
		"arn:aws:ecs:us-east-1:aws_account_id:container-instance/uuid-1",
		"arn:aws:ecs:us-east-1:aws_account_id:container-instance/uuid-2"})
	c.Assert(resp.NextToken, Equals, "token_UUID")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestListTaskDefinitions(c *C) {
	testServer.Response(200, nil, ListTaskDefinitionsResponse)
	req := &ListTaskDefinitionsReq{
		MaxResults:   2,
		NextToken:    "Token_UUID",
		FamilyPrefix: "sleep360",
	}
	resp, err := s.ecs.ListTaskDefinitions(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "ListTaskDefinitions")
	c.Assert(values.Get("maxResults"), Equals, "2")
	c.Assert(values.Get("familyPrefix"), Equals, "sleep360")
	c.Assert(values.Get("nextToken"), Equals, "Token_UUID")

	c.Assert(resp.TaskDefinitionArns, DeepEquals, []string{
		"arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:1",
		"arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2"})
	c.Assert(resp.NextToken, Equals, "token_UUID")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestListTasks(c *C) {
	testServer.Response(200, nil, ListTasksResponse)
	req := &ListTasksReq{
		MaxResults:        2,
		NextToken:         "Token_UUID",
		Family:            "sleep360",
		Cluster:           "test",
		ContainerInstance: "container_uuid",
	}
	resp, err := s.ecs.ListTasks(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "ListTasks")
	c.Assert(values.Get("maxResults"), Equals, "2")
	c.Assert(values.Get("family"), Equals, "sleep360")
	c.Assert(values.Get("containerInstance"), Equals, "container_uuid")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("nextToken"), Equals, "Token_UUID")

	c.Assert(resp.TaskArns, DeepEquals, []string{
		"arn:aws:ecs:us-east-1:aws_account_id:task/uuid_1",
		"arn:aws:ecs:us-east-1:aws_account_id:task/uuid_2"})
	c.Assert(resp.NextToken, Equals, "token_UUID")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestRegisterContainerInstance(c *C) {
	testServer.Response(200, nil, RegisterContainerInstanceResponse)

	resources := []Resource{
		{
			DoubleValue:  0.0,
			IntegerValue: 2048,
			LongValue:    0,
			Name:         "CPU",
			Type:         "INTEGER",
		},
		{
			DoubleValue:  0.0,
			IntegerValue: 3955,
			LongValue:    0,
			Name:         "MEMORY",
			Type:         "INTEGER",
		},
		{
			DoubleValue:    0.0,
			IntegerValue:   0,
			LongValue:      0,
			Name:           "PORTS",
			StringSetValue: []string{"2376", "22", "51678", "2375"},
			Type:           "STRINGSET",
		},
	}

	req := &RegisterContainerInstanceReq{
		Cluster:                           "default",
		InstanceIdentityDocument:          "foo",
		InstanceIdentityDocumentSignature: "baz",
		TotalResources:                    resources,
	}

	resp, err := s.ecs.RegisterContainerInstance(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "RegisterContainerInstance")
	c.Assert(values.Get("cluster"), Equals, "default")
	c.Assert(values.Get("instanceIdentityDocument"), Equals, "foo")
	c.Assert(values.Get("instanceIdentityDocumentSignature"), Equals, "baz")
	c.Assert(values.Get("totalResources.member.1.doubleValue"), Equals, "0.0")
	c.Assert(values.Get("totalResources.member.1.integerValue"), Equals, "2048")
	c.Assert(values.Get("totalResources.member.1.longValue"), Equals, "0")
	c.Assert(values.Get("totalResources.member.1.name"), Equals, "CPU")
	c.Assert(values.Get("totalResources.member.1.type"), Equals, "INTEGER")
	c.Assert(values.Get("totalResources.member.2.doubleValue"), Equals, "0.0")
	c.Assert(values.Get("totalResources.member.2.integerValue"), Equals, "3955")
	c.Assert(values.Get("totalResources.member.2.longValue"), Equals, "0")
	c.Assert(values.Get("totalResources.member.2.name"), Equals, "MEMORY")
	c.Assert(values.Get("totalResources.member.2.type"), Equals, "INTEGER")
	c.Assert(values.Get("totalResources.member.3.doubleValue"), Equals, "0.0")
	c.Assert(values.Get("totalResources.member.3.integerValue"), Equals, "0")
	c.Assert(values.Get("totalResources.member.3.longValue"), Equals, "0")
	c.Assert(values.Get("totalResources.member.3.name"), Equals, "PORTS")
	c.Assert(values.Get("totalResources.member.3.stringSetValue.member.1"), Equals, "2376")
	c.Assert(values.Get("totalResources.member.3.stringSetValue.member.2"), Equals, "22")
	c.Assert(values.Get("totalResources.member.3.stringSetValue.member.3"), Equals, "51678")
	c.Assert(values.Get("totalResources.member.3.stringSetValue.member.4"), Equals, "2375")
	c.Assert(values.Get("totalResources.member.3.type"), Equals, "STRINGSET")

	c.Assert(resp.ContainerInstance.AgentConnected, Equals, true)
	c.Assert(resp.ContainerInstance.ContainerInstanceArn, Equals, "arn:aws:ecs:us-east-1:aws_account_id:container-instance/container_instance_UUID")
	c.Assert(resp.ContainerInstance.Status, Equals, "ACTIVE")
	c.Assert(resp.ContainerInstance.Ec2InstanceId, Equals, "instance_id")
	c.Assert(resp.ContainerInstance.RegisteredResources, DeepEquals, resources)
	c.Assert(resp.ContainerInstance.RemainingResources, DeepEquals, resources)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestRegisterTaskDefinition(c *C) {
	testServer.Response(200, nil, RegisterTaskDefinitionResponse)

	CDefinitions := []ContainerDefinition{
		{
			Command:    []string{"sleep", "360"},
			Cpu:        10,
			EntryPoint: []string{"/bin/sh"},
			Environment: []KeyValuePair{
				{
					Name:  "envVar",
					Value: "foo",
				},
			},
			Essential: true,
			Image:     "busybox",
			Memory:    10,
			Name:      "sleep",
			MountPoints: []MountPoint{
				{
					ContainerPath: "/tmp/myfile",
					ReadOnly:      false,
					SourceVolume:  "/srv/myfile",
				},
				{
					ContainerPath: "/tmp/myfile2",
					ReadOnly:      true,
					SourceVolume:  "/srv/myfile2",
				},
			},
			VolumesFrom: []VolumeFrom{
				{
					ReadOnly:        true,
					SourceContainer: "foo",
				},
			},
		},
	}

	req := &RegisterTaskDefinitionReq{
		Family:               "sleep360",
		ContainerDefinitions: CDefinitions,
		Volumes: []Volume{
			{
				Name: "/srv/myfile",
				Host: HostVolumeProperties{
					SourcePath: "/srv/myfile",
				},
			},
		},
	}
	resp, err := s.ecs.RegisterTaskDefinition(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "RegisterTaskDefinition")
	c.Assert(values.Get("containerDefinitions.member.1.command.member.1"), Equals, "sleep")
	c.Assert(values.Get("containerDefinitions.member.1.command.member.2"), Equals, "360")
	c.Assert(values.Get("containerDefinitions.member.1.cpu"), Equals, "10")
	c.Assert(values.Get("containerDefinitions.member.1.memory"), Equals, "10")
	c.Assert(values.Get("containerDefinitions.member.1.entryPoint.member.1"), Equals, "/bin/sh")
	c.Assert(values.Get("containerDefinitions.member.1.environment.member.1.name"), Equals, "envVar")
	c.Assert(values.Get("containerDefinitions.member.1.environment.member.1.value"), Equals, "foo")
	c.Assert(values.Get("containerDefinitions.member.1.essential"), Equals, "true")
	c.Assert(values.Get("containerDefinitions.member.1.image"), Equals, "busybox")
	c.Assert(values.Get("containerDefinitions.member.1.memory"), Equals, "10")
	c.Assert(values.Get("containerDefinitions.member.1.name"), Equals, "sleep")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.1.containerPath"), Equals, "/tmp/myfile")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.1.readOnly"), Equals, "false")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.1.sourceVolume"), Equals, "/srv/myfile")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.2.containerPath"), Equals, "/tmp/myfile2")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.2.readOnly"), Equals, "true")
	c.Assert(values.Get("containerDefinitions.member.1.mountPoints.member.2.sourceVolume"), Equals, "/srv/myfile2")
	c.Assert(values.Get("containerDefinitions.member.1.volumesFrom.member.1.readOnly"), Equals, "true")
	c.Assert(values.Get("containerDefinitions.member.1.volumesFrom.member.1.sourceContainer"), Equals, "foo")

	c.Assert(values.Get("family"), Equals, "sleep360")
	c.Assert(values.Get("volumes.member.1.name"), Equals, "/srv/myfile")
	c.Assert(values.Get("volumes.member.1.host.sourcePath"), Equals, "/srv/myfile")

	expected := TaskDefinition{
		Family:               "sleep360",
		Revision:             2,
		TaskDefinitionArn:    "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		ContainerDefinitions: CDefinitions,
		Volumes: []Volume{
			{
				Name: "/srv/myfile",
				Host: HostVolumeProperties{
					SourcePath: "/srv/myfile",
				},
			},
		},
	}

	c.Assert(resp.TaskDefinition, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestRunTask(c *C) {
	testServer.Response(200, nil, RunTaskResponse)
	req := &RunTaskReq{
		Cluster:        "test",
		Count:          1,
		TaskDefinition: "sleep360:2",
	}
	resp, err := s.ecs.RunTask(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "RunTask")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("count"), Equals, "1")
	c.Assert(values.Get("taskDefinition"), Equals, "sleep360:2")

	expected := []Task{
		Task{
			Containers: []Container{
				{
					TaskArn:      "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
					Name:         "sleep",
					ContainerArn: "arn:aws:ecs:us-east-1:aws_account_id:container/UUID",
					LastStatus:   "RUNNING",
				},
			},
			Overrides: TaskOverride{
				ContainerOverrides: []ContainerOverride{
					{
						Name: "sleep",
					},
				},
			},
			DesiredStatus:        "RUNNING",
			TaskArn:              "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
			ContainerInstanceArn: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID",
			LastStatus:           "PENDING",
			TaskDefinitionArn:    "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		},
	}

	c.Assert(resp.Tasks, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestStartTask(c *C) {
	testServer.Response(200, nil, StartTaskResponse)
	req := &StartTaskReq{
		Cluster:            "test",
		ContainerInstances: []string{"containerUUID"},
		TaskDefinition:     "sleep360:2",
	}
	resp, err := s.ecs.StartTask(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "StartTask")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("taskDefinition"), Equals, "sleep360:2")
	c.Assert(values.Get("containerInstances.member.1"), Equals, "containerUUID")

	expected := []Task{
		Task{
			Containers: []Container{
				{
					TaskArn:      "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
					Name:         "sleep",
					ContainerArn: "arn:aws:ecs:us-east-1:aws_account_id:container/UUID",
					LastStatus:   "RUNNING",
				},
			},
			Overrides: TaskOverride{
				ContainerOverrides: []ContainerOverride{
					{
						Name: "sleep",
					},
				},
			},
			DesiredStatus:        "RUNNING",
			TaskArn:              "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
			ContainerInstanceArn: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID",
			LastStatus:           "PENDING",
			TaskDefinitionArn:    "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
		},
	}

	c.Assert(resp.Tasks, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestStopTask(c *C) {
	testServer.Response(200, nil, StopTaskResponse)
	req := &StopTaskReq{
		Cluster: "test",
		Task:    "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
	}
	resp, err := s.ecs.StopTask(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "StopTask")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("task"), Equals, "arn:aws:ecs:us-east-1:aws_account_id:task/UUID")

	expected := Task{
		Containers: []Container{
			{
				TaskArn:      "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
				Name:         "sleep",
				ContainerArn: "arn:aws:ecs:us-east-1:aws_account_id:container/UUID",
				LastStatus:   "RUNNING",
			},
		},
		Overrides: TaskOverride{
			ContainerOverrides: []ContainerOverride{
				{
					Name: "sleep",
				},
			},
		},
		DesiredStatus:        "STOPPED",
		TaskArn:              "arn:aws:ecs:us-east-1:aws_account_id:task/UUID",
		ContainerInstanceArn: "arn:aws:ecs:us-east-1:aws_account_id:container-instance/UUID",
		LastStatus:           "RUNNING",
		TaskDefinitionArn:    "arn:aws:ecs:us-east-1:aws_account_id:task-definition/sleep360:2",
	}

	c.Assert(resp.Task, DeepEquals, expected)
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestSubmitContainerStateChange(c *C) {
	testServer.Response(200, nil, SubmitContainerStateChangeResponse)
	networkBindings := []NetworkBinding{
		{
			BindIp:        "127.0.0.1",
			ContainerPort: 80,
			HostPort:      80,
		},
	}
	req := &SubmitContainerStateChangeReq{
		Cluster:         "test",
		ContainerName:   "container",
		ExitCode:        0,
		Reason:          "reason",
		Status:          "status",
		Task:            "taskUUID",
		NetworkBindings: networkBindings,
	}

	resp, err := s.ecs.SubmitContainerStateChange(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "SubmitContainerStateChange")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("containerName"), Equals, "container")
	c.Assert(values.Get("exitCode"), Equals, "0")
	c.Assert(values.Get("reason"), Equals, "reason")
	c.Assert(values.Get("status"), Equals, "status")
	c.Assert(values.Get("task"), Equals, "taskUUID")
	c.Assert(values.Get("networkBindings.member.1.bindIp"), Equals, "127.0.0.1")
	c.Assert(values.Get("networkBindings.member.1.containerPort"), Equals, "80")
	c.Assert(values.Get("networkBindings.member.1.hostPort"), Equals, "80")

	c.Assert(resp.Acknowledgment, Equals, "ACK")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}

func (s *S) TestSubmitTaskStateChange(c *C) {
	testServer.Response(200, nil, SubmitTaskStateChangeResponse)
	req := &SubmitTaskStateChangeReq{
		Cluster: "test",
		Reason:  "reason",
		Status:  "status",
		Task:    "taskUUID",
	}

	resp, err := s.ecs.SubmitTaskStateChange(req)
	c.Assert(err, IsNil)
	values := testServer.WaitRequest().PostForm
	c.Assert(values.Get("Version"), Equals, "2014-11-13")
	c.Assert(values.Get("Action"), Equals, "SubmitTaskStateChange")
	c.Assert(values.Get("cluster"), Equals, "test")
	c.Assert(values.Get("reason"), Equals, "reason")
	c.Assert(values.Get("status"), Equals, "status")
	c.Assert(values.Get("task"), Equals, "taskUUID")

	c.Assert(resp.Acknowledgment, Equals, "ACK")
	c.Assert(resp.RequestId, Equals, "8d798a29-f083-11e1-bdfb-cb223EXAMPLE")
}
