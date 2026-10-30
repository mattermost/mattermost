// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"encoding/csv"
	"io"
	"strings"
	"sync"
)

// UsernameRemap tracks source→dest username mappings built during user processing.
// When auth_data matching finds a user whose username changed on the dest, the
// mapping is recorded here so post/reply/reaction processing can attribute content
// to the correct account even when the post line references the old source username.
type UsernameRemap struct {
	mu sync.RWMutex
	m  map[string]string // lowercase src username → current dest username
}

func (r *UsernameRemap) Add(srcUsername, destUsername string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.m == nil {
		r.m = make(map[string]string)
	}
	r.m[strings.ToLower(srcUsername)] = destUsername
}

func (r *UsernameRemap) Lookup(srcUsername string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	v, ok := r.m[strings.ToLower(srcUsername)]
	return v, ok
}

// UnmatchedUserAction describes what a scoped import did with a user referenced by
// the export who could not be matched to an existing account on the destination.
type UnmatchedUserAction string

const (
	// UnmatchedUserCreatedActive: a shell account was created and left able to sign in
	// (--imported-users=active). Posts are preserved and the account is usable.
	UnmatchedUserCreatedActive UnmatchedUserAction = "created_active"
	// UnmatchedUserCreatedInactive: a shell account was created but deactivated
	// (--imported-users=inactive), pending administrator review.
	UnmatchedUserCreatedInactive UnmatchedUserAction = "created_inactive"
	// UnmatchedUserMembershipSkipped: a membership was skipped because the referenced
	// destination team or channel did not exist (deleted/renamed between runs).
	UnmatchedUserMembershipSkipped UnmatchedUserAction = "membership_skipped"
)

// UnmatchedUser is one entry in the scoped-import report: a user from the export who
// was not found as an existing account on the destination server, plus what the
// import did about it. This is the data behind the operator-facing "which users were
// not matched on the new server" log.
type UnmatchedUser struct {
	Username    string              `json:"username"`
	AuthService string              `json:"auth_service,omitempty"`
	Team        string              `json:"team,omitempty"`
	Channel     string              `json:"channel,omitempty"`
	Reason      string              `json:"reason"`
	Action      UnmatchedUserAction `json:"action"`
}

// unmatchedUsers is a concurrency-safe accumulator; import workers run in parallel.
type unmatchedUsers struct {
	mu sync.Mutex
	s  []UnmatchedUser
}

func (u *unmatchedUsers) Add(rec UnmatchedUser) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.s = append(u.s, rec)
}

// All returns a copy of the accumulated entries, safe to read after the import.
func (u *unmatchedUsers) All() []UnmatchedUser {
	u.mu.Lock()
	defer u.mu.Unlock()
	out := make([]UnmatchedUser, len(u.s))
	copy(out, u.s)
	return out
}

// ImportReport is threaded through the import pipeline to carry the UsernameRemap and
// the outcome log for users that could not be matched on the destination server.
type ImportReport struct {
	// Remap is populated during user processing and consumed during post processing.
	// It is safe for concurrent use independently.
	Remap UsernameRemap

	// UnmatchedUsers accumulates one entry per user from the export who was not found
	// as an existing account on the destination, with the action the import took.
	UnmatchedUsers unmatchedUsers

	// missingTeams memoizes team names confirmed absent on the destination during a
	// scoped import. getTeamsByNames consults it so a team referenced by many users
	// isn't re-resolved against the store once per user. Teams are imported before
	// users and posts, so a name's absence is stable for the rest of the run.
	missingTeamsMu sync.Mutex
	missingTeams   map[string]struct{}
}

// MarkTeamMissing records teamName as absent on the destination for the rest of the run.
func (r *ImportReport) MarkTeamMissing(teamName string) {
	r.missingTeamsMu.Lock()
	defer r.missingTeamsMu.Unlock()
	if r.missingTeams == nil {
		r.missingTeams = make(map[string]struct{})
	}
	r.missingTeams[strings.ToLower(teamName)] = struct{}{}
}

// IsTeamKnownMissing reports whether teamName was already confirmed absent this run.
func (r *ImportReport) IsTeamKnownMissing(teamName string) bool {
	r.missingTeamsMu.Lock()
	defer r.missingTeamsMu.Unlock()
	_, ok := r.missingTeams[strings.ToLower(teamName)]
	return ok
}

// unmatchedUsersCSVHeader is the column order for WriteUnmatchedUsersCSV. Kept as a
// package var so tests can assert against it without duplicating the literal.
var unmatchedUsersCSVHeader = []string{"username", "auth_service", "team", "channel", "reason", "action"}

// WriteUnmatchedUsersCSV writes the unmatched-user log as CSV (with a header row) and
// returns the number of data rows written. It writes nothing and returns 0 when there
// are no entries, so callers can skip creating an empty report file.
func (r *ImportReport) WriteUnmatchedUsersCSV(w io.Writer) (int, error) {
	rows := r.UnmatchedUsers.All()
	if len(rows) == 0 {
		return 0, nil
	}

	cw := csv.NewWriter(w)
	if err := cw.Write(unmatchedUsersCSVHeader); err != nil {
		return 0, err
	}
	for _, rec := range rows {
		if err := cw.Write([]string{
			rec.Username,
			rec.AuthService,
			rec.Team,
			rec.Channel,
			rec.Reason,
			string(rec.Action),
		}); err != nil {
			return 0, err
		}
	}
	cw.Flush()
	if err := cw.Error(); err != nil {
		return 0, err
	}
	return len(rows), nil
}
