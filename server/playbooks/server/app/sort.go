package app

// SortField enumerates the available fields we can sort on.
type SortField string

const (
	// SortByTitle sorts by the title field of a playbook.
	SortByTitle SortField = "title"

	// SortByStages sorts by the number of checklists in a playbook.
	SortByStages SortField = "stages"

	// SortBySteps sorts by the number of steps in a playbook.
	SortBySteps SortField = "steps"

	// SortByRuns sorts by the number of times a playbook has been run.
	SortByRuns SortField = "runs"

	// SortByCreateAt sorts by the created time of a playbook or playbook run.
	SortByCreateAt SortField = "create_at"

	// SortByID sorts by the primary key of a playbook or playbook run.
	SortByID SortField = "id"

	// SortByName sorts by the name of a playbook run.
	SortByName SortField = "name"

	// SortByOwnerUserID sorts by the user id of the owner of a playbook run.
	SortByOwnerUserID SortField = "owner_user_id"

	// SortByTeamID sorts by the team id of a playbook or playbook run.
	SortByTeamID SortField = "team_id"

	// SortByEndAt sorts by the end time of a playbook run.
	SortByEndAt SortField = "end_at"

	// SortByStatus sorts by the status of a playbook run.
	SortByStatus SortField = "status"

	// SortByLastStatusUpdateAt sorts by when the playbook run was last updated.
	SortByLastStatusUpdateAt SortField = "last_status_update_at"

	// SortByLastStatusUpdateAt sorts by when the playbook was last run.
	SortByLastRunAt SortField = "last_run_at"

	// SortByActiveRuns sorts by number of active runs in the playbook.
	SortByActiveRuns SortField = "active_runs"

	// SortByMetric0 ..3 sorts by the playbook's metric index
	SortByMetric0 SortField = "metric0"
	SortByMetric1 SortField = "metric1"
	SortByMetric2 SortField = "metric2"
	SortByMetric3 SortField = "metric3"
)

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// DirectionDesc is descending order.
	DirectionDesc SortDirection = "DESC"

	// DirectionAsc is ascending order.
	DirectionAsc SortDirection = "ASC"
)

func IsValidDirection(direction SortDirection) bool {
	return direction == DirectionAsc || direction == DirectionDesc
}
