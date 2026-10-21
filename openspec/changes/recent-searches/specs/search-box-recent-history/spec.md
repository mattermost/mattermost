# Spec Delta

## Purpose

Shows recent message and file searches in the search popover so the user can rerun or clear them without retyping.

## ADDED Requirements

### Requirement: Show recent searches in the popover
When the search popover opens, the client MUST load the current user's recent searches. It MUST render at most five entries below the search hints, newest first. The list container MUST have a maximum height of 550px. If there are no entries, the client MUST NOT show an empty list chrome. A load failure MUST leave the rest of the search box usable.

#### Scenario: Entries appear under hints
- **WHEN** the user opens the search popover and history has one or more entries
- **THEN** those entries appear below the search hints, newest first, at most five

#### Scenario: Empty history hides the list
- **WHEN** the user opens the popover and history is empty
- **THEN** the usual hints remain and no empty recent-search list is shown

#### Scenario: Load error does not block search
- **WHEN** loading history fails
- **THEN** the user can still type and confirm a search

### Requirement: Persist on confirm only
The client MUST request a history write only after a confirmed `messages` or `files` search from the search box. Typing, choosing a suggestion, or paging results MUST NOT write history. The client MUST NOT wait for the write before showing search results.

#### Scenario: Confirm writes after search starts
- **WHEN** the user confirms a non-empty messages or files search
- **THEN** results are shown immediately and a history write is requested without blocking the UI

#### Scenario: Suggestion click does not write
- **WHEN** the user selects a suggestion without confirming a search
- **THEN** the client MUST NOT request a history write

### Requirement: Rerun a recent search
Selecting an entry MUST rerun the existing search flow with that entry's terms, type, and team scope. Original operators MUST be preserved. If a stored team is no longer available to the user and is not the all-teams scope, the client MUST inform the user and MUST NOT silently switch team.

#### Scenario: Selecting an entry reruns it
- **WHEN** the user activates a recent-search entry whose team is still available
- **THEN** the search box runs that terms/type/team combination through the existing search flow

#### Scenario: Missing team is visible
- **WHEN** the user activates an entry whose team they can no longer access
- **THEN** the client shows an error and MUST NOT change the active team silently

### Requirement: Clear one entry
Hover or keyboard focus MUST reveal a Clear control with accessible name matching the "Clear" tooltip. Activating Clear MUST delete only that entry and MUST NOT run the search. If delete fails, the client MUST show an error and restore a consistent list.

#### Scenario: Clear removes one row
- **WHEN** the user activates Clear on one entry
- **THEN** that entry disappears and no search runs

#### Scenario: Failed clear is reported
- **WHEN** delete fails
- **THEN** the client shows an error and the list remains consistent with server state

### Requirement: Keyboard and assistive access
List entries and Clear MUST be operable by keyboard. Clear MUST be visible when the row has focus. After a successful delete, focus MUST move to a valid, predictable control. Escape MUST still dismiss the popover. Visible strings MUST use the app translation catalog and theme tokens.

#### Scenario: Keyboard clear
- **WHEN** the user focuses a recent-search row and activates Clear with the keyboard
- **THEN** that entry is deleted and focus remains in a valid control

#### Scenario: Escape still closes
- **WHEN** the popover is open and the user presses Escape
- **THEN** the popover closes using the existing search-box dismiss behavior
