// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// OptionsCoveredBy reports, for each of the given options, whether the holders
// cover it. Every option asked about has an entry, so a false is an answer and
// not a gap.
//
// The answer depends only on the field's option list, the held options and the
// candidates -- never on who is asking -- so a caller that is not the masking
// hook can ask the same question, such as for a ceiling over a set of values.
// What "covers" means depends on the field's type:
//
//   - rank: a candidate is covered when it has a rank at or below the highest
//     rank among the holders. A candidate with no rank is never covered, and a
//     holder with no rank counts for nothing.
//   - graph: a holder at-or-above the candidate covers it (see CoveredBy).
//   - select and multiselect: a candidate is covered only when it is itself one
//     of the holders.
//
// Missing data denies and never grants: no holders cover nothing, and an option
// the field does not have (deleted, or never one of its options) has no rank, so
// it is not covered even when it is among the holders.
//
// A field with no option list is refused, because asking about one is a caller
// bug and not a "no". A failed lookup returns the error with a nil map, never a
// partial answer.
func (ps *PropertyService) OptionsCoveredBy(rctx request.CTX, field *model.PropertyField, optionIDs, holders []string) (map[string]bool, error) {
	if field == nil {
		return nil, errors.New("no property field to resolve options against")
	}
	if !field.Type.SupportsOptions() {
		return nil, errors.Errorf("property field %s is of type %s, which has no options", field.ID, field.Type)
	}
	if field.Type == model.PropertyFieldTypeGraph {
		return ps.CoveredBy(rctx, field, optionIDs, holders)
	}

	covered := make(map[string]bool, len(optionIDs))
	if field.Type != model.PropertyFieldTypeRank {
		for _, optionID := range optionIDs {
			covered[optionID] = false
		}
		for _, holder := range holders {
			if _, asked := covered[holder]; asked {
				covered[holder] = true
			}
		}
		return covered, nil
	}

	if len(holders) == 0 || len(optionIDs) == 0 {
		for _, optionID := range optionIDs {
			covered[optionID] = false
		}
		return covered, nil
	}

	// One rank read per call, for the candidates and the holders together.
	// Nothing memoizes ranks across calls, so a batch of values on one field pays
	// one read per value; memoize per field in maskingContext if batch reads such
	// as post lists show it.
	ranks, err := ps.fieldStore.GetOptionRanks(field, append(append([]string{}, optionIDs...), holders...))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the ranks of a rank property field's options")
	}

	ceiling, held := int64(0), false
	for _, holder := range holders {
		if rank, ok := ranks[holder]; ok && (!held || rank > ceiling) {
			ceiling, held = rank, true
		}
	}
	for _, optionID := range optionIDs {
		rank, ranked := ranks[optionID]
		covered[optionID] = held && ranked && rank <= ceiling
	}
	return covered, nil
}
