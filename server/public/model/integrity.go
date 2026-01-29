// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
)

type NameIntegrityCheckData struct {
	RelName string   `json:"rel_name"`
	Names   []string `json:"names"`
}

type OrphanedRecord struct {
	ParentId *string `json:"parent_id"`
	ChildId  *string `json:"child_id"`
}

type RelationalIntegrityCheckData struct {
	ParentName   string           `json:"parent_name"`
	ChildName    string           `json:"child_name"`
	ParentIdAttr string           `json:"parent_id_attr"`
	ChildIdAttr  string           `json:"child_id_attr"`
	Records      []OrphanedRecord `json:"records"`
}

type IntegrityCheckResult struct {
	Data any   `json:"data"`
	Err  error `json:"err"`
}

func (r *IntegrityCheckResult) UnmarshalJSON(b []byte) error {
	var data map[string]any
	if err := json.Unmarshal(b, &data); err != nil {
		return err
	}
	if d, ok := data["data"]; ok && d != nil {
		m := d.(map[string]any)

		if records, ok := m["records"].([]any); ok { // data is RelationalIntegrityCheckData
			var rdata RelationalIntegrityCheckData
			if _, ok := m["parent_name"]; ok {
				rdata.ParentName = m["parent_name"].(string)
			}
			if _, ok := m["child_name"]; ok {
				rdata.ChildName = m["child_name"].(string)
			}
			if _, ok := m["parent_id_attr"]; ok {
				rdata.ParentIdAttr = m["parent_id_attr"].(string)
			}
			if _, ok := m["child_id_attr"]; ok {
				rdata.ChildIdAttr = m["child_id_attr"].(string)
			}
			for _, recData := range records {
				var record OrphanedRecord
				m := recData.(map[string]any)
				if val := m["parent_id"]; val != nil {
					record.ParentId = NewPointer(val.(string))
				}
				if val := m["child_id"]; val != nil {
					record.ChildId = NewPointer(val.(string))
				}
				rdata.Records = append(rdata.Records, record)
			}

			r.Data = rdata
		} else if names, ok := m["names"].([]string); ok { // data is NameIntegrityCheckData
			var ndata NameIntegrityCheckData
			ndata.RelName = m["rel_name"].(string)
			for _, name := range names {
				ndata.Names = append(ndata.Names, name)
			}
			r.Data = ndata
		}
	}
	if err, ok := data["err"]; ok && err != nil {
		r.Err = errors.New(data["err"].(string))
	}
	return nil
}
