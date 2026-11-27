// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestOptionsCoveredBy(t *testing.T) {
	th := Setup(t)

	type options struct {
		field *model.PropertyField
		ids   map[string]string
	}
	of := func(o *options, names ...string) []string {
		ids := make([]string, 0, len(names))
		for _, name := range names {
			ids = append(ids, o.ids[name])
		}
		return ids
	}
	newOptions := func(t *testing.T, fieldType model.PropertyFieldType, spec map[string]any) *options {
		t.Helper()
		o := &options{ids: map[string]string{}}
		list := make([]any, 0, len(spec))
		for name, rank := range spec {
			o.ids[name] = model.NewId()
			option := map[string]any{"id": o.ids[name], "name": name}
			if rank != nil {
				option["rank"] = rank
			}
			list = append(list, option)
		}
		o.field = th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Coverage-" + model.NewId(),
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": list},
		})
		return o
	}
	// Direct store creates skip rank validation, so "Unranked" can be planted.
	newRank := func(t *testing.T) *options {
		return newOptions(t, model.PropertyFieldTypeRank, map[string]any{
			"Internal": 1, "Secret": 2, "Top Secret": 3, "Unranked": nil,
		})
	}
	covers := func(t *testing.T, o *options, candidates, holders []string) map[string]bool {
		t.Helper()
		got, err := th.service.OptionsCoveredBy(th.Context, o.field, candidates, holders)
		require.NoError(t, err)
		named := map[string]bool{}
		for name, id := range o.ids {
			if covered, asked := got[id]; asked {
				named[name] = covered
			}
		}
		require.Len(t, got, len(candidates), "every candidate has an entry")
		return named
	}

	t.Run("rank covers at or below the highest held rank", func(t *testing.T) {
		o := newRank(t)
		all := of(o, "Internal", "Secret", "Top Secret")
		for _, tc := range []struct {
			holder string
			want   map[string]bool
		}{
			{"Top Secret", map[string]bool{"Internal": true, "Secret": true, "Top Secret": true}},
			{"Secret", map[string]bool{"Internal": true, "Secret": true, "Top Secret": false}},
			{"Internal", map[string]bool{"Internal": true, "Secret": false, "Top Secret": false}},
		} {
			require.Equal(t, tc.want, covers(t, o, all, of(o, tc.holder)), "holder %s", tc.holder)
		}
	})

	t.Run("rank never covers an unranked candidate", func(t *testing.T) {
		o := newRank(t)
		require.Equal(t, map[string]bool{"Unranked": false, "Internal": true},
			covers(t, o, of(o, "Unranked", "Internal"), of(o, "Top Secret")))
		require.Equal(t, map[string]bool{"Unranked": false},
			covers(t, o, of(o, "Unranked"), of(o, "Unranked", "Top Secret")))
	})

	t.Run("rank ignores an unranked holder", func(t *testing.T) {
		o := newRank(t)
		require.Equal(t, map[string]bool{"Internal": false, "Unranked": false},
			covers(t, o, of(o, "Internal", "Unranked"), of(o, "Unranked")))
	})

	t.Run("rank uses the highest of several holders", func(t *testing.T) {
		o := newRank(t)
		require.Equal(t, map[string]bool{"Internal": true, "Secret": true, "Top Secret": true},
			covers(t, o, of(o, "Internal", "Secret", "Top Secret"), of(o, "Internal", "Top Secret")))
	})

	t.Run("rank: a deleted option is neither covered nor covering", func(t *testing.T) {
		o := newRank(t)
		require.NoError(t, th.dbStore.PropertyField().DeleteOptions(o.field.GroupID, o.field.ID, 0, of(o, "Top Secret")))
		require.Equal(t, map[string]bool{"Internal": false, "Top Secret": false},
			covers(t, o, of(o, "Internal", "Top Secret"), of(o, "Top Secret")))
		require.Equal(t, map[string]bool{"Top Secret": false},
			covers(t, o, of(o, "Top Secret"), of(o, "Secret", "Top Secret")))
	})

	t.Run("rank: a field linked to a rank template answers by the template's ranks", func(t *testing.T) {
		template := newRank(t)
		linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:       template.field.GroupID,
			Name:          "CoverageLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeRank,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.field.ID,
		})
		o := &options{field: linked, ids: template.ids}
		require.Equal(t, map[string]bool{"Internal": true, "Secret": true, "Top Secret": false},
			covers(t, o, of(o, "Internal", "Secret", "Top Secret"), of(o, "Secret")))
	})

	for _, fieldType := range []model.PropertyFieldType{model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect} {
		t.Run(string(fieldType)+" covers by exact membership", func(t *testing.T) {
			o := newOptions(t, fieldType, map[string]any{"A": nil, "B": nil, "C": nil})
			require.Equal(t, map[string]bool{"A": true, "B": false, "C": true},
				covers(t, o, of(o, "A", "B", "C"), of(o, "A", "C")))
		})
	}

	t.Run("graph agrees with CoveredBy", func(t *testing.T) {
		graph := setupWorkedExample(t, th)
		got, err := th.service.OptionsCoveredBy(th.Context, graph.field, graph.of("A", "B", "C", "D"), graph.of("B"))
		require.NoError(t, err)
		require.Equal(t, map[string]bool{
			graph.ids["A"]: false, graph.ids["B"]: true, graph.ids["C"]: true, graph.ids["D"]: false,
		}, got)
	})

	t.Run("no holders cover nothing", func(t *testing.T) {
		rank := newRank(t)
		sel := newOptions(t, model.PropertyFieldTypeSelect, map[string]any{"A": nil})
		graph := setupWorkedExample(t, th)
		for _, holders := range [][]string{nil, {}} {
			require.Equal(t, map[string]bool{"Secret": false}, covers(t, rank, of(rank, "Secret"), holders))
			require.Equal(t, map[string]bool{"A": false}, covers(t, sel, of(sel, "A"), holders))
			got, err := th.service.OptionsCoveredBy(th.Context, graph.field, graph.of("B"), holders)
			require.NoError(t, err)
			require.Equal(t, map[string]bool{graph.ids["B"]: false}, got)
		}
	})

	t.Run("no candidates give an empty map", func(t *testing.T) {
		o := newRank(t)
		got, err := th.service.OptionsCoveredBy(th.Context, o.field, nil, of(o, "Secret"))
		require.NoError(t, err)
		require.Empty(t, got)
	})

	t.Run("a field without options is an error", func(t *testing.T) {
		text := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "CoverageText-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		got, err := th.service.OptionsCoveredBy(th.Context, text, []string{model.NewId()}, []string{model.NewId()})
		require.Error(t, err)
		require.Nil(t, got)

		_, err = th.service.OptionsCoveredBy(th.Context, nil, nil, nil)
		require.Error(t, err)
	})
}
