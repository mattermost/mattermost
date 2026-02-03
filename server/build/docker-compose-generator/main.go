// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/goccy/go-yaml"
)

type DockerCompose struct {
	Services map[string]*Container `yaml:"services"`
}

type Container struct {
	Command   string   `yaml:"command,omitempty"`
	Image     string   `yaml:"image,omitempty"`
	Network   []string `yaml:"networks,omitempty"`
	DependsOn []string `yaml:"depends_on,omitempty"`
}

func main() {
	validServices := map[string]int{
		"postgres":      5432,
		"minio":         9000,
		"inbucket":      9001,
		"openldap":      389,
		"elasticsearch": 9200,
		"opensearch":    9201,
		"redis":         6379,
		"dejavu":        1358,
		"keycloak":      8080,
		"prometheus":    9090,
		"grafana":       3000,
		"loki":          3100,
		"promtail":      3180,
	}
	command := []string{}
	for _, arg := range os.Args[1:] {
		port, ok := validServices[arg]
		if !ok {
			panic(fmt.Sprintf("Unknown service %s", arg))
		}
		command = append(command, fmt.Sprintf("%s:%d", arg, port))
	}

	var dockerCompose DockerCompose
	dockerCompose.Services = map[string]*Container{}
	dockerCompose.Services["start_dependencies"] = &Container{
		Image:     "mattermost/mattermost-wait-for-dep:latest",
		Network:   []string{"mm-test"},
		DependsOn: os.Args[1:],
		Command:   strings.Join(command, " "),
	}
	resultData, err := yaml.Marshal(dockerCompose)
	if err != nil {
		panic(fmt.Sprintf("Unable to serialize the docker-compose file: %s.", err.Error()))
	}
	fmt.Println(string(resultData))
}
