// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
)

type SectionErrors map[NodeSection]error

type NodeDiagnostics struct {
	Diagnostics *SupportPacketDiagnostics
	Errors      SectionErrors
}

// nodeDiagnosticsJSON is the JSON form of NodeDiagnostics, which nodes send each other for a
// health check. SupportPacketDiagnostics has yaml tags only, so its JSON uses the Go field
// names; every node in a cluster runs the same build, so they agree on them. Section errors
// travel as strings, since error values do not serialize; a section that collected cleanly
// maps to "".
type nodeDiagnosticsJSON struct {
	Diagnostics *SupportPacketDiagnostics `json:"diagnostics"`
	Errors      map[NodeSection]string    `json:"errors"`
}

func (d NodeDiagnostics) MarshalJSON() ([]byte, error) {
	errs := make(map[NodeSection]string, len(d.Errors))
	for section, sectionErr := range d.Errors {
		errs[section] = ""
		if sectionErr != nil {
			errs[section] = sectionErr.Error()
		}
	}

	return json.Marshal(nodeDiagnosticsJSON{Diagnostics: d.Diagnostics, Errors: errs})
}

func (d *NodeDiagnostics) UnmarshalJSON(data []byte) error {
	var raw nodeDiagnosticsJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	errs := make(SectionErrors, len(raw.Errors))
	for section, sectionErr := range raw.Errors {
		errs[section] = nil
		if sectionErr != "" {
			errs[section] = errors.New(sectionErr)
		}
	}

	*d = NodeDiagnostics{Diagnostics: raw.Diagnostics, Errors: errs}
	return nil
}
