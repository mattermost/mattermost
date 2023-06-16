// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"runtime/debug"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/pkg/errors"

	"github.com/spf13/cobra"
)

var (
	Version = model.CurrentVersion
)

var VersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Prints the version of mmctl.",
	RunE:  versionCmdF,
}

func init() {
	RootCmd.AddCommand(VersionCmd)
}

func versionCmdF(cmd *cobra.Command, args []string) error {
	v, err := getVersionInfo()
	if err != nil {
		return err
	}

	printer.PrintT("mmctl:\nVersion:\t{{.Version}}\nGitCommit:\t{{.GitCommit}}"+
		"\nGitTreeState:\t{{.GitTreeState}}\nBuildDate:\t{{.BuildDate}}\nGoVersion:\t{{.GoVersion}}"+
		"\nCompiler:\t{{.Compiler}}\nPlatform:\t{{.Platform}}", v)
	return nil
}

type Info struct {
	Version      string
	GitCommit    string
	GitTreeState string
	BuildDate    string
	GoVersion    string
	Compiler     string
	Platform     string
}

func getVersionInfo() (*Info, error) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return nil, errors.New("failed to get build info")
	}

	var (
		revision     = "dev"
		gitTreeState = "dev"
		buildTime    = "dev"

		os       string
		arch     string
		compiler string
	)

	for _, s := range info.Settings {
		switch s.Key {
		case "vcs.revision":
			revision = s.Value
		case "vcs.time":
			buildTime = s.Value
		case "vcs.modified":
			if s.Value == "true" {
				gitTreeState = "dirty"
			} else {
				gitTreeState = "clean"
			}
		case "GOOS":
			os = s.Value
		case "GOARCH":
			arch = s.Value
		case "-compiler":
			compiler = s.Value
		}
	}

	return &Info{
		Version:      Version,
		GitCommit:    revision,
		GitTreeState: gitTreeState,
		BuildDate:    buildTime,
		GoVersion:    info.GoVersion,
		Compiler:     compiler,
		Platform:     fmt.Sprintf("%s/%s", arch, os),
	}, nil
}
