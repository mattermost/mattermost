// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// PlaybookRunService handles communication with the playbook run related
// methods of the Playbooks API.
type PlaybookRunService struct {
	client *Client
}

// Get a playbook run.
func (s *PlaybookRunService) Get(ctx context.Context, playbookRunID string) (*PlaybookRun, error) {
	playbookRunURL := fmt.Sprintf("runs/%s", playbookRunID)
	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// GetByChannelID gets a playbook run by ChannelID.
func (s *PlaybookRunService) GetByChannelID(ctx context.Context, channelID string) (*PlaybookRun, error) {
	channelURL := fmt.Sprintf("runs/channel/%s", channelID)
	req, err := s.client.newRequest(http.MethodGet, channelURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// Get a playbook run's metadata.
func (s *PlaybookRunService) GetMetadata(ctx context.Context, playbookRunID string) (*Metadata, error) {
	playbookRunURL := fmt.Sprintf("runs/%s/metadata", playbookRunID)
	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, err
	}

	playbookRun := new(Metadata)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbookRun, nil
}

// Get all playbook status updates.
func (s *PlaybookRunService) GetStatusUpdates(ctx context.Context, playbookRunID string) ([]StatusPostComplete, error) {
	playbookRunURL := fmt.Sprintf("runs/%s/status-updates", playbookRunID)
	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, err
	}

	var statusUpdates []StatusPostComplete
	resp, err := s.client.do(ctx, req, &statusUpdates)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return statusUpdates, nil
}

// List the playbook runs.
func (s *PlaybookRunService) List(ctx context.Context, page, perPage int, opts PlaybookRunListOptions) (*GetPlaybookRunsResults, error) {
	playbookRunURL := "runs"
	playbookRunURL, err := addOptions(playbookRunURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}
	playbookRunURL, err = addPaginationOptions(playbookRunURL, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to build pagination options: %w", err)
	}

	req, err := s.client.newRequest(http.MethodGet, playbookRunURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetPlaybookRunsResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create a playbook run.
func (s *PlaybookRunService) Create(ctx context.Context, opts PlaybookRunCreateOptions) (*PlaybookRun, error) {
	playbookRunURL := "runs"
	req, err := s.client.newRequest(http.MethodPost, playbookRunURL, opts)
	if err != nil {
		return nil, err
	}

	playbookRun := new(PlaybookRun)
	resp, err := s.client.do(ctx, req, playbookRun)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return playbookRun, nil
}

func (s *PlaybookRunService) UpdateStatus(ctx context.Context, playbookRunID string, message string, reminderInSeconds int64) error {
	updateURL := fmt.Sprintf("runs/%s/status", playbookRunID)
	opts := StatusUpdateOptions{
		Message:  message,
		Reminder: time.Duration(reminderInSeconds),
	}
	req, err := s.client.newRequest(http.MethodPost, updateURL, opts)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return nil
}

func (s *PlaybookRunService) RequestUpdate(ctx context.Context, playbookRunID, userID string) error {
	requestURL := fmt.Sprintf("runs/%s/request-update", playbookRunID)
	req, err := s.client.newRequest(http.MethodPost, requestURL, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return err
}

func (s *PlaybookRunService) Finish(ctx context.Context, playbookRunID string) error {
	finishURL := fmt.Sprintf("runs/%s/finish", playbookRunID)
	req, err := s.client.newRequest(http.MethodPut, finishURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

func (s *PlaybookRunService) CreateChecklist(ctx context.Context, playbookRunID string, checklist Checklist) error {
	createURL := fmt.Sprintf("runs/%s/checklists", playbookRunID)
	req, err := s.client.newRequest(http.MethodPost, createURL, checklist)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) RemoveChecklist(ctx context.Context, playbookRunID string, checklistNumber int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodDelete, createURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) RenameChecklist(ctx context.Context, playbookRunID string, checklistNumber int, newTitle string) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/rename", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodPut, createURL, struct{ Title string }{newTitle})
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) AddChecklistItem(ctx context.Context, playbookRunID string, checklistNumber int, checklistItem ChecklistItem) error {
	addURL := fmt.Sprintf("runs/%s/checklists/%d/add", playbookRunID, checklistNumber)
	req, err := s.client.newRequest(http.MethodPost, addURL, checklistItem)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) MoveChecklist(ctx context.Context, playbookRunID string, sourceChecklistIdx, destChecklistIdx int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/move", playbookRunID)
	body := struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
	}{sourceChecklistIdx, destChecklistIdx}

	req, err := s.client.newRequest(http.MethodPost, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) MoveChecklistItem(ctx context.Context, playbookRunID string, sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/move-item", playbookRunID)
	body := struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		SourceItemIdx      int `json:"source_item_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
		DestItemIdx        int `json:"dest_item_idx"`
	}{sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx}

	req, err := s.client.newRequest(http.MethodPost, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

// UpdateRetrospective updates the run's retrospective info
func (s *PlaybookRunService) UpdateRetrospective(ctx context.Context, playbookRunID, userID string, retroUpdate RetrospectiveUpdate) error {
	createURL := fmt.Sprintf("runs/%s/retrospective", playbookRunID)
	req, err := s.client.newRequest(http.MethodPost, createURL, retroUpdate)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return err
}

// PublishRetrospective publishes the run's retrospective
func (s *PlaybookRunService) PublishRetrospective(ctx context.Context, playbookRunID, userID string, retroUpdate RetrospectiveUpdate) error {
	createURL := fmt.Sprintf("runs/%s/retrospective/publish", playbookRunID)
	req, err := s.client.newRequest(http.MethodPost, createURL, retroUpdate)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return err
}

func (s *PlaybookRunService) SetItemAssignee(ctx context.Context, playbookRunID string, checklistIdx int, itemIdx int, assigneeID string) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/item/%d/assignee", playbookRunID, checklistIdx, itemIdx)
	body := struct {
		AssigneeID string `json:"assignee_id"`
	}{assigneeID}

	req, err := s.client.newRequest(http.MethodPut, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) SetItemCommand(ctx context.Context, playbookRunID string, checklistIdx int, itemIdx int, newCommand string) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/item/%d/command", playbookRunID, checklistIdx, itemIdx)
	body := struct {
		Command string `json:"command"`
	}{newCommand}

	req, err := s.client.newRequest(http.MethodPut, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) RunItemCommand(ctx context.Context, playbookRunID string, checklistIdx int, itemIdx int) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/item/%d/run", playbookRunID, checklistIdx, itemIdx)

	req, err := s.client.newRequest(http.MethodPost, createURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

func (s *PlaybookRunService) SetItemDueDate(ctx context.Context, playbookRunID string, checklistIdx int, itemIdx int, duedate int64) error {
	createURL := fmt.Sprintf("runs/%s/checklists/%d/item/%d/duedate", playbookRunID, checklistIdx, itemIdx)
	body := struct {
		DueDate int64 `json:"due_date"`
	}{duedate}

	req, err := s.client.newRequest(http.MethodPut, createURL, body)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	return err
}

// Get a playbook run.
func (s *PlaybookRunService) GetOwners(ctx context.Context) ([]OwnerInfo, error) {
	req, err := s.client.newRequest(http.MethodGet, "runs/owners", nil)
	if err != nil {
		return nil, err
	}

	owners := make([]OwnerInfo, 0)
	resp, err := s.client.do(ctx, req, &owners)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return owners, nil
}
