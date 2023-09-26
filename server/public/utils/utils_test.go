// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils_test

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/utils"
)

func TestContains(t *testing.T) {
	testCasesStr := []struct {
		name     string
		slice    []string
		item     string
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []string{},
			item:     "foo",
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []string{"foo"},
			item:     "foo",
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []string{"bar"},
			item:     "foo",
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []string{"foo", "bar"},
			item:     "foo",
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []string{"foo", "bar"},
			item:     "baz",
			expected: false,
		},
	}

	for _, tc := range testCasesStr {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesInt := []struct {
		name     string
		slice    []int
		item     int
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []int{},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []int{1},
			item:     1,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []int{2},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []int{1, 2},
			item:     1,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []int{1, 2},
			item:     3,
			expected: false,
		},
	}

	for _, tc := range testCasesInt {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesFloat := []struct {
		name     string
		slice    []float64
		item     float64
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []float64{},
			item:     1.0,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []float64{1.0},
			item:     1.0,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []float64{2.0},
			item:     1.0,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []float64{1.0, 2.0},
			item:     1.0,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []float64{1.0, 2.0},
			item:     3.0,
			expected: false,
		},
	}

	for _, tc := range testCasesFloat {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesBool := []struct {
		name     string
		slice    []bool
		item     bool
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []bool{},
			item:     true,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []bool{true},
			item:     true,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []bool{false},
			item:     true,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []bool{true, false},
			item:     true,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []bool{true, false},
			item:     false,
			expected: true,
		},
	}

	for _, tc := range testCasesBool {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesByte := []struct {
		name     string
		slice    []byte
		item     byte
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []byte{},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []byte{1},
			item:     1,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []byte{2},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []byte{1, 2},
			item:     1,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []byte{1, 2},
			item:     3,
			expected: false,
		},
	}

	for _, tc := range testCasesByte {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesRune := []struct {
		name     string
		slice    []rune
		item     rune
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []rune{},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []rune{1},
			item:     1,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []rune{2},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []rune{1, 2},
			item:     1,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []rune{1, 2},
			item:     3,
			expected: false,
		},
	}

	for _, tc := range testCasesRune {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesComplex := []struct {
		name     string
		slice    []complex128
		item     complex128
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []complex128{},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []complex128{1},
			item:     1,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []complex128{2},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []complex128{1, 2},
			item:     1,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []complex128{1, 2},
			item:     3,
			expected: false,
		},
	}

	for _, tc := range testCasesComplex {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}

	testCasesUint := []struct {
		name     string
		slice    []uint
		item     uint
		expected bool
	}{
		{
			name:     "empty slice",
			slice:    []uint{},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with item",
			slice:    []uint{1},
			item:     1,
			expected: true,
		},
		{
			name:     "slice without item",
			slice:    []uint{2},
			item:     1,
			expected: false,
		},
		{
			name:     "slice with multiple items",
			slice:    []uint{1, 2},
			item:     1,
			expected: true,
		},
		{
			name:     "slice with multiple items without item",
			slice:    []uint{1, 2},
			item:     3,
			expected: false,
		},
	}

	for _, tc := range testCasesUint {
		t.Run(tc.name, func(t *testing.T) {
			actual := utils.Contains(tc.slice, tc.item)
			if actual != tc.expected {
				t.Errorf("Expected Contains(%v, %v) to be %v, but got %v", tc.slice, tc.item, tc.expected, actual)
			}
		})
	}
}
