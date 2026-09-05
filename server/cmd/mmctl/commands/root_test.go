// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

// captureStderr redirects os.Stderr for the duration of fn and returns what was written.
func captureStderr(t *testing.T, fn func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	require.NoError(t, err)
	orig := os.Stderr
	os.Stderr = w
	fn()
	w.Close()
	os.Stderr = orig
	var buf bytes.Buffer
	_, err = io.Copy(&buf, r)
	require.NoError(t, err)
	return buf.String()
}

// executeRoot runs RootCmd with the given args and reuses Run()'s
// finishExecute logic without re-registering persistent flags (which would
// panic on a second call in the same test binary).
func executeRoot(args []string) error {
	RootCmd.SetArgs(args)
	err := RootCmd.ExecuteContext(context.Background())
	return finishExecute(err)
}

func TestRunContextCanceledSuppressed(t *testing.T) {
	cmd := &cobra.Command{
		Use:           "cancel-test",
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return context.Canceled
		},
	}
	RootCmd.AddCommand(cmd)
	defer RootCmd.RemoveCommand(cmd)

	stderr := captureStderr(t, func() {
		err := executeRoot([]string{"cancel-test"})
		assert.ErrorIs(t, err, context.Canceled)
	})

	assert.Empty(t, stderr, "context.Canceled should not produce error output")
}

func TestRunOtherErrorsPrinted(t *testing.T) {
	sentinelErr := errors.New("something went wrong")
	cmd := &cobra.Command{
		Use:           "error-test",
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return sentinelErr
		},
	}
	RootCmd.AddCommand(cmd)
	defer RootCmd.RemoveCommand(cmd)

	stderr := captureStderr(t, func() {
		err := executeRoot([]string{"error-test"})
		assert.ErrorIs(t, err, sentinelErr)
	})

	assert.Contains(t, stderr, "Error: something went wrong")
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
