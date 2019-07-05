// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost-server/store"
	"github.com/spf13/cobra"
)

var IntegrityCmd = &cobra.Command{
	Use:   "integrity",
	Short: "Check database data integrity",
	RunE:  integrityCmdF,
}

func init() {
	RootCmd.AddCommand(IntegrityCmd)
}

func printIntegrityCheckResult(result store.IntegrityCheckResult) {
	fmt.Println(fmt.Sprintf("Found %d records of relation %s orphans of relation %s", len(result.Records), result.ChildName, result.ParentName))
	for _, record := range result.Records {
		fmt.Println(fmt.Sprintf("	Child %s is orphan of Parent %s", record.ChildId, record.ParentId))
	}
}

func integrityCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	results := a.Srv.Store.CheckIntegrity()
	for result := range results {
		printIntegrityCheckResult(result)
	}
	return nil
}
