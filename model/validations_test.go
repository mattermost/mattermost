package model

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestIsValidId(t *testing.T) {
	cases := []struct {
		Input  string
		Result bool
	}{
		{
			Input:  NewId(),
			Result: true,
		},
		{
			Input:  "",
			Result: false,
		},
		{
			Input:  "junk",
			Result: false,
		},
		{
			Input:  "qwertyuiop1234567890asdfg{",
			Result: false,
		},
		{
			Input:  NewId() + "}",
			Result: false,
		},
	}

	for _, tc := range cases {
		actual := IsValidId(tc.Input)
		require.Equalf(t, actual, tc.Result, "case: %v\tshould returned: %#v", tc, tc.Result)
	}
}
