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

// Version defaults to model.CurrentVersion. buildDate, gitCommit,
// gitTreeState, and commitDate are set via -X ldflags at build time.
// See MMCTL_LDFLAGS in the Makefile.
var (
	Version      = model.CurrentVersion
	buildDate    = "dev"
	gitCommit    = "dev"
	gitTreeState = "dev"
	commitDate   = "dev"
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
	printer.PrintT("mmctl:\nVersion:\t{{.Version}}\nBuiltDate:\t{{.BuildDate}}\nCommitDate:\t{{.CommitDate}}\nGitCommit:\t{{.GitCommit}}"+
		"\nGitTreeState:\t{{.GitTreeState}}\nGoVersion:\t{{.GoVersion}}"+
		"\nCompiler:\t{{.Compiler}}\nPlatform:\t{{.Platform}}", getVersionInfo())
	return nil
}

type Info struct {
	Version      string
	BuildDate    string
	CommitDate   string
	GitCommit    string
	GitTreeState string
	GoVersion    string
	Compiler     string
	Platform     string
}

func getVersionInfo() *Info {
	return &Info{
		Version:      Version,
		BuildDate:    buildDate,
		CommitDate:   commitDate,
		GitCommit:    gitCommit,
		GitTreeState: gitTreeState,
		GoVersion:    runtime.Version(),
		Compiler:     runtime.Compiler,
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
	}
}
