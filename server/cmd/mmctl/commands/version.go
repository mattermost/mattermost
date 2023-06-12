// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"runtime"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

var (
	Version = model.CurrentVersion
	// SHA1 from git, output of $(git rev-parse HEAD)
	gitCommit = "dev mode"
	// State of git tree, either "clean" or "dirty"
	gitTreeState = "unknown"
	// Build date in ISO8601 format, output of $(date -u +'%Y-%m-%dT%H:%M:%SZ')
	buildDate = "unknown"
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
	v := getVersionInfo()
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

func getVersionInfo() Info {
	return Info{
		Version:      Version,
		GitCommit:    gitCommit,
		GitTreeState: gitTreeState,
		BuildDate:    buildDate,
		GoVersion:    runtime.Version(),
		Compiler:     runtime.Compiler,
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
	}
}
