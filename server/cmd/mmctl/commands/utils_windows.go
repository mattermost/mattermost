// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"fmt"
	"os"
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

	return nil
}

func getConfirmation(question string, dbConfirmation bool) error {
	if err := checkInteractiveTerminal(); err != nil {
		return fmt.Errorf("could not proceed, either enable --confirm flag or use an interactive shell to complete operation: %w", err)
	}

	var confirm string
	if dbConfirmation {
		fmt.Println("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("aborted: You did not answer YES exactly, in all capitals")
		}
	}

	fmt.Println(question + " (YES/NO): ")
	fmt.Scanln(&confirm)
	if confirm != "YES" {
		return errors.New("aborted: You did not answer YES exactly, in all capitals")
	}

	return nil
}
