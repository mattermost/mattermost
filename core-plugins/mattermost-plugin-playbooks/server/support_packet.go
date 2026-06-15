// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"path/filepath"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type SupportPacket struct {
	Version string `yaml:"version"`
	// The total number of playbooks.
	TotalPlaybooks int64 `yaml:"total_playbooks"`
	// The number of active playbooks.
	ActivePlaybooks int64 `yaml:"active_playbooks"`
	// The total number of playbook runs.
	TotalPlaybookRuns int64 `yaml:"total_playbook_runs"`
}

func (p *Plugin) GenerateSupportData(_ *plugin.Context) ([]*model.FileData, error) {
	var result *multierror.Error

	playbooks, err := p.playbookService.GetPlaybooks()
	if err != nil {
		result = multierror.Append(result, errors.Wrap(err, "Failed to get total number of playbooks for Support Packet"))
	}

	activePlaybooks, err := p.playbookService.GetActivePlaybooks()
	if err != nil {
		result = multierror.Append(result, errors.Wrap(err, "Failed to get number of active playbooks for Support Packet"))
	}

	playbookRuns, err := p.playbookRunService.GetPlaybookRuns(app.RequesterInfo{IsAdmin: true}, app.PlaybookRunFilterOptions{SkipExtras: true})
	if err != nil {
		result = multierror.Append(result, errors.Wrap(err, "Failed to get total number of playbook runs for Support Packet"))
	}

	diagnostics := SupportPacket{
		Version:           manifest.Version,
		TotalPlaybooks:    int64(len(playbooks)),
		ActivePlaybooks:   int64(len(activePlaybooks)),
		TotalPlaybookRuns: int64(playbookRuns.TotalCount),
	}
	body, err := yaml.Marshal(diagnostics)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to marshal diagnostics")
	}

	return []*model.FileData{{
		Filename: filepath.Join(manifest.Id, "diagnostics.yaml"),
		Body:     body,
	}}, result.ErrorOrNil()
}
