// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
)

func executeRawCommand(root *cobra.Command, args string) (c *cobra.Command, output string, err error) {
	actual := new(bytes.Buffer)
	RootCmd.SetOut(actual)
	RootCmd.SetErr(actual)
	RootCmd.SetArgs(strings.Split(args, " "))
	c, err = RootCmd.ExecuteC()
	return c, actual.String(), err
}

func TestRootRecover(t *testing.T) {
	printPanic("some panic")

	lines := printer.GetErrorLines()
	assert.Equal(t, "Uh oh! Something unexpected happened :( Would you mind reporting it?", lines[0])
	assert.True(t, strings.HasPrefix(lines[1], "https://github.com/mattermost/mattermost/issues/new?body="))
	assert.Equal(t, "some panic", lines[2])
	assert.True(t, strings.HasPrefix(lines[3], "goroutine "))
}

func (s *MmctlUnitTestSuite) TestArgumentsHaveWhitespaceTrimmed() {
	arguments := []string{"value_1", "value_2"}
	lineEndings := []string{"\n", "\r", "\r\n"}
	prettyNames := []string{"-n", "-r", "-r-n"}
	commandCalled := false

	for i, lineEnding := range lineEndings {
		testName := fmt.Sprintf("Commands have their arguments stripped of whitespace[%s]", prettyNames[i])
		s.Run(testName, func() {
			commandCalled = false
			commandFunction := func(command *cobra.Command, args []string) {
				commandCalled = true
				s.Equal(arguments, args, "Expected arguments to have their whitespace trimmed")
			}
			mockCommand := &cobra.Command{Use: "test", Run: commandFunction}
			commandString := strings.Join([]string{"test", " ", arguments[0], lineEnding, " ", arguments[1], lineEnding}, "")
			RootCmd.AddCommand(mockCommand)
			_, _, err := executeRawCommand(RootCmd, commandString)
			s.Require().NoError(err)
			s.Require().True(commandCalled, "Expected mock command to be called")
		})
	}
}
