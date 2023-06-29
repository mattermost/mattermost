// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux || darwin
// +build linux darwin

package commands

import (
	"fmt"
	"os"
	"os/user"
	"syscall"

	"github.com/isacikgoz/prompt"
	"github.com/pkg/errors"
)

func checkValidSocket(socketPath string) error {
	// check file mode and permissions
	fi, err := os.Stat(socketPath)
	if err != nil && os.IsNotExist(err) {
		return fmt.Errorf("socket file %q doesn't exists, please check the server configuration for local mode", socketPath)
	} else if err != nil {
		return err
	}
	if fi.Mode() != expectedSocketMode {
		return fmt.Errorf("invalid file mode for file %q, it must be a socket with 0600 permissions", socketPath)
	}

	// check matching user
	cUser, err := user.Current()
	if err != nil {
		return err
	}
	s, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return fmt.Errorf("cannot get owner of the file %q", socketPath)
	}
	// if user id is "0", they are root and we should avoid this check
	if fmt.Sprint(s.Uid) != cUser.Uid && cUser.Uid != "0" {
		return fmt.Errorf("owner of the file %q must be the same user running mmctl", socketPath)
	}

	return nil
}

func getConfirmation(question string, dbConfirmation bool) error {
	if err := checkInteractiveTerminal(); err != nil {
		return fmt.Errorf("could not proceed, either enable --confirm flag or use an interactive shell to complete operation: %w", err)
	}

	if dbConfirmation {
		s, err := prompt.NewSelection("Have you performed a database backup?", []string{"no", "yes"}, "", 2)
		if err != nil {
			return fmt.Errorf("could not initiate prompt: %w", err)
		}
		ans, err := s.Run()
		if err != nil {
			return fmt.Errorf("error running prompt: %w", err)
		}
		if ans != "yes" {
			return errors.New("aborted")
		}
	}

	s, err := prompt.NewSelection(question, []string{"no", "yes"}, "WARNING: This operation is not reversible.", 2)
	if err != nil {
		return fmt.Errorf("could not initiate prompt: %w", err)
	}
	ans, err := s.Run()
	if err != nil {
		return fmt.Errorf("error running prompt: %w", err)
	}
	if ans != "yes" {
		return errors.New("aborted")
	}

	return nil
}
