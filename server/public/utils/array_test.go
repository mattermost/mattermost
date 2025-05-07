// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"reflect"
	"sort"
	"testing"
	"time"
)

func TestFindExclusives(t *testing.T) {
	t.Run("integers", func(t *testing.T) {
		tests := []struct {
			name               string
			arr1, arr2         []int
			expectedExclusive1 []int
			expectedExclusive2 []int
			expectedCommon     []int
		}{
			// Basic test with non-overlapping elements
			{
				name:               "No overlap",
				arr1:               []int{1, 2, 3},
				arr2:               []int{4, 5, 6},
				expectedExclusive1: []int{1, 2, 3},
				expectedExclusive2: []int{4, 5, 6},
				expectedCommon:     nil,
			},
			// Fully overlapping arrays
			{
				name:               "Full overlap",
				arr1:               []int{1, 2, 3},
				arr2:               []int{1, 2, 3},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     []int{1, 2, 3},
			},
			// Partial overlap
			{
				name:               "Partial overlap",
				arr1:               []int{1, 2, 3, 4},
				arr2:               []int{3, 4, 5, 6},
				expectedExclusive1: []int{1, 2},
				expectedExclusive2: []int{5, 6},
				expectedCommon:     []int{3, 4},
			},
			// Duplicates within arrays
			{
				name:               "Duplicates in arr1",
				arr1:               []int{1, 2, 2, 3},
				arr2:               []int{2, 4, 4},
				expectedExclusive1: []int{1, 3},
				expectedExclusive2: []int{4},
				expectedCommon:     []int{2},
			},
			{
				name:               "Duplicates in arr2",
				arr1:               []int{1, 2, 3},
				arr2:               []int{2, 2, 3, 3},
				expectedExclusive1: []int{1},
				expectedExclusive2: nil,
				expectedCommon:     []int{2, 3},
			},
			// Edge cases
			{
				name:               "Both arrays nil",
				arr1:               nil,
				arr2:               nil,
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "Both arrays empty",
				arr1:               []int{},
				arr2:               []int{},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "One empty array",
				arr1:               []int{1, 2, 3},
				arr2:               nil,
				expectedExclusive1: []int{1, 2, 3},
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "One element in each array",
				arr1:               []int{1},
				arr2:               []int{2},
				expectedExclusive1: []int{1},
				expectedExclusive2: []int{2},
				expectedCommon:     nil,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				exclusive1, exclusive2, common := FindExclusives(tt.arr1, tt.arr2)

				sort.Ints(exclusive1)
				sort.Ints(exclusive2)
				sort.Ints(common)
				sort.Ints(tt.expectedExclusive1)
				sort.Ints(tt.expectedExclusive2)
				sort.Ints(tt.expectedCommon)

				if !reflect.DeepEqual(exclusive1, tt.expectedExclusive1) {
					t.Errorf("Exclusive to arr1: expected %v, got %v", tt.expectedExclusive1, exclusive1)
				}
				if !reflect.DeepEqual(exclusive2, tt.expectedExclusive2) {
					t.Errorf("Exclusive to arr2: expected %v, got %v", tt.expectedExclusive2, exclusive2)
				}
				if !reflect.DeepEqual(common, tt.expectedCommon) {
					t.Errorf("Common elements: expected %v, got %v", tt.expectedCommon, common)
				}
			})
		}
	})

	t.Run("strings", func(t *testing.T) {
		tests := []struct {
			name               string
			arr1, arr2         []string
			expectedExclusive1 []string
			expectedExclusive2 []string
			expectedCommon     []string
		}{
			// Basic test with non-overlapping elements
			{
				name:               "No overlap",
				arr1:               []string{"a", "b", "c"},
				arr2:               []string{"d", "e", "f"},
				expectedExclusive1: []string{"a", "b", "c"},
				expectedExclusive2: []string{"d", "e", "f"},
				expectedCommon:     nil,
			},
			// Fully overlapping arrays
			{
				name:               "Full overlap",
				arr1:               []string{"a", "b", "c"},
				arr2:               []string{"a", "b", "c"},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     []string{"a", "b", "c"},
			},
			// Partial overlap
			{
				name:               "Partial overlap",
				arr1:               []string{"a", "b", "c", "d"},
				arr2:               []string{"c", "d", "e", "f"},
				expectedExclusive1: []string{"a", "b"},
				expectedExclusive2: []string{"e", "f"},
				expectedCommon:     []string{"c", "d"},
			},
			// Duplicates within arrays
			{
				name:               "Duplicates in arr1",
				arr1:               []string{"a", "b", "b", "c"},
				arr2:               []string{"b", "d", "d"},
				expectedExclusive1: []string{"a", "c"},
				expectedExclusive2: []string{"d"},
				expectedCommon:     []string{"b"},
			},
			{
				name:               "Duplicates in arr2",
				arr1:               []string{"a", "b", "c"},
				arr2:               []string{"b", "b", "c", "c"},
				expectedExclusive1: []string{"a"},
				expectedExclusive2: nil,
				expectedCommon:     []string{"b", "c"},
			},
			// Edge cases
			{
				name:               "Both arrays nil",
				arr1:               nil,
				arr2:               nil,
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "Both arrays empty",
				arr1:               []string{},
				arr2:               []string{},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "One empty array",
				arr1:               []string{"a", "b", "c"},
				arr2:               nil,
				expectedExclusive1: []string{"a", "b", "c"},
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "One element in each array",
				arr1:               []string{"a"},
				arr2:               []string{"b"},
				expectedExclusive1: []string{"a"},
				expectedExclusive2: []string{"b"},
				expectedCommon:     nil,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				exclusive1, exclusive2, common := FindExclusives(tt.arr1, tt.arr2)

				sort.Strings(exclusive1)
				sort.Strings(exclusive2)
				sort.Strings(common)
				sort.Strings(tt.expectedExclusive1)
				sort.Strings(tt.expectedExclusive2)
				sort.Strings(tt.expectedCommon)

				if !reflect.DeepEqual(exclusive1, tt.expectedExclusive1) {
					t.Errorf("Exclusive to arr1: expected %v, got %v", tt.expectedExclusive1, exclusive1)
				}
				if !reflect.DeepEqual(exclusive2, tt.expectedExclusive2) {
					t.Errorf("Exclusive to arr2: expected %v, got %v", tt.expectedExclusive2, exclusive2)
				}
				if !reflect.DeepEqual(common, tt.expectedCommon) {
					t.Errorf("Common elements: expected %v, got %v", tt.expectedCommon, common)
				}
			})
		}
	})

	t.Run("dates", func(t *testing.T) {
		tests := []struct {
			name               string
			arr1, arr2         []time.Time
			expectedExclusive1 []time.Time
			expectedExclusive2 []time.Time
			expectedCommon     []time.Time
		}{
			// Basic test with non-overlapping elements
			{
				name: "No overlap",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 5, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 6, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: []time.Time{
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 5, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 6, 0, 0, 0, 0, time.UTC),
				},
				expectedCommon: nil,
			},
			// Fully overlapping arrays
			{
				name: "Full overlap",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
			},
			// Partial overlap
			{
				name: "Partial overlap",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 5, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 6, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: []time.Time{
					time.Date(2023, 1, 5, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 6, 0, 0, 0, 0, time.UTC),
				},
				expectedCommon: []time.Time{
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
				},
			},
			// Duplicates within arrays
			{
				name: "Duplicates in arr1",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: []time.Time{
					time.Date(2023, 1, 4, 0, 0, 0, 0, time.UTC),
				},
				expectedCommon: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
				},
			},
			{
				name: "Duplicates in arr2",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: nil,
				expectedCommon: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
			},
			// Edge cases
			{
				name:               "Both arrays nil",
				arr1:               nil,
				arr2:               nil,
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name:               "Both arrays empty",
				arr1:               []time.Time{},
				arr2:               []time.Time{},
				expectedExclusive1: nil,
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name: "One empty array",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				arr2: nil,
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
					time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: nil,
				expectedCommon:     nil,
			},
			{
				name: "One element in each array",
				arr1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				arr2: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive1: []time.Time{
					time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedExclusive2: []time.Time{
					time.Date(2023, 1, 2, 0, 0, 0, 0, time.UTC),
				},
				expectedCommon: nil,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				exclusive1, exclusive2, common := FindExclusives(tt.arr1, tt.arr2)

				sort.Slice(exclusive1, func(i, j int) bool {
					return exclusive1[i].Before(exclusive1[j])
				})
				sort.Slice(exclusive2, func(i, j int) bool {
					return exclusive2[i].Before(exclusive2[j])
				})
				sort.Slice(common, func(i, j int) bool {
					return common[i].Before(common[j])
				})
				sort.Slice(tt.expectedExclusive1, func(i, j int) bool {
					return tt.expectedExclusive1[i].Before(tt.expectedExclusive1[j])
				})
				sort.Slice(tt.expectedExclusive2, func(i, j int) bool {
					return tt.expectedExclusive2[i].Before(tt.expectedExclusive2[j])
				})
				sort.Slice(tt.expectedCommon, func(i, j int) bool {
					return tt.expectedCommon[i].Before(tt.expectedCommon[j])
				})

				if !reflect.DeepEqual(exclusive1, tt.expectedExclusive1) {
					t.Errorf("Exclusive to arr1: expected %v, got %v", tt.expectedExclusive1, exclusive1)
				}
				if !reflect.DeepEqual(exclusive2, tt.expectedExclusive2) {
					t.Errorf("Exclusive to arr2: expected %v, got %v", tt.expectedExclusive2, exclusive2)
				}
				if !reflect.DeepEqual(common, tt.expectedCommon) {
					t.Errorf("Common elements: expected %v, got %v", tt.expectedCommon, common)
				}
			})
		}
	})
}
