// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func executeRawCommand(root *cobra.Command, args string) (c *cobra.Command, output string, err error) {

	actual := new(bytes.Buffer)
	RootCmd.SetOut(actual)
	RootCmd.SetErr(actual)
	RootCmd.SetArgs(strings.Split(args, " "))
	c, err = RootCmd.ExecuteC()
	return c, actual.String(), err
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
			executeRawCommand(RootCmd, commandString)
			s.Require().True(commandCalled, "Expected mock command to be called")
		})
	}

}
