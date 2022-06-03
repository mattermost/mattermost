// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v2"
)

type DockerCompose struct {
	Version  string                `yaml:"version"`
	Services map[string]*Container `yaml:"services"`
}

type Container struct {
	Command   string   `yaml:"command,omitempty"`
	Image     string   `yaml:"image,omitempty"`
	Network   []string `yaml:"networks,omitempty"`
	DependsOn []string `yaml:"depends_on,omitempty"`
}

var validServices = map[string]int{
	"mysql":              3306,
	"postgres":           5432,
	"minio":              9000,
	"inbucket":           9001,
	"openldap":           389,
	"elasticsearch":      9200,
	"dejavu":             1358,
	"keycloak":           8080,
	"prometheus":         9090,
	"grafana":            3000,
	"mysql-read-replica": 3306, // FIXME: not recognizing the successfully running service on port 3307.
}

func main() {
	command, dependsOn := parseArgs(os.Args[1:])

	var dockerCompose DockerCompose
	dockerCompose.Version = "2.4"
	dockerCompose.Services = map[string]*Container{}
	dockerCompose.Services["start_dependencies"] = &Container{
		Image:     "mattermost/mattermost-wait-for-dep:latest",
		Network:   []string{"mm-test"},
		DependsOn: dependsOn,
		Command:   strings.Join(command, " "),
	}
	resultData, err := yaml.Marshal(dockerCompose)
	if err != nil {
		panic(fmt.Sprintf("Unable to serialize the docker-compose file: %s.", err.Error()))
	}
	fmt.Println(string(resultData))
}

func parseArgs(args []string) (command, dependsOn []string) {
	// first we search for skipped services
	var skipped []string
	if i := find(args, "--skip"); i >= 0 {
		skipped = args[i+1:]
		args = args[:i]
	}

	// then we create our command and dependencies lists
	for _, arg := range args {
		port, ok := validServices[arg]
		if !ok {
			panic(fmt.Sprintf("Unknown service %s", arg))
		}

		if find(skipped, arg) >= 0 {
			continue
		}

		command = append(command, fmt.Sprintf("%s:%d", arg, port))
		dependsOn = append(dependsOn, arg)
	}

	return command, dependsOn
}

func find(haystack []string, needle string) int {
	for i, s := range haystack {
		if s == needle {
			return i
		}
	}
	return -1
}
