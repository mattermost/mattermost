// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
)

// SectionErrors records each node section that was collected, with the error if collecting it
// failed. In JSON, which nodes send each other for a health check, errors travel as strings,
// since error values do not serialize; a section that collected cleanly maps to "".
type SectionErrors map[NodeSection]error

// NodeDiagnostics is one node's diagnostics. SupportPacketDiagnostics has yaml tags only, so in
// JSON its fields use the Go names; every node in a cluster runs the same build, so they agree.
type NodeDiagnostics struct {
	Diagnostics *SupportPacketDiagnostics `json:"diagnostics"`
	Errors      SectionErrors             `json:"errors"`
}

func (e SectionErrors) MarshalJSON() ([]byte, error) {
	errs := make(map[NodeSection]string, len(e))
	for section, sectionErr := range e {
		errs[section] = ""
		if sectionErr != nil {
			errs[section] = sectionErr.Error()
		}
	}

	return json.Marshal(errs)
}

func (e *SectionErrors) UnmarshalJSON(data []byte) error {
	var raw map[NodeSection]string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	errs := make(SectionErrors, len(raw))
	for section, sectionErr := range raw {
		errs[section] = nil
		if sectionErr != "" {
			errs[section] = errors.New(sectionErr)
		}
	}

	*e = errs
	return nil
}
