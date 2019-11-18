package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMapStringsToQueryParams(t *testing.T) {
	t.Run("one item", func(t *testing.T) {
		input := []string{"apple"}

		keys, params := MapStringsToQueryParams(input, "Fruit")

		require.Len(t, params, 1, "returned incorrect params", params)
		require.Equal(t, "apple", params["Fruit0"], "returned incorrect params", params)
		require.Equal(t, "(:Fruit0)", keys, "returned incorrect query", keys)
	})

	t.Run("multiple items", func(t *testing.T) {
		input := []string{"carrot", "tomato", "potato"}

		keys, params := MapStringsToQueryParams(input, "Vegetable")

		require.Len(t, params, 3, "returned incorrect params", params)
		require.Equal(t, "carrot", params["Vegetable0"], "returned incorrect params", params)
		require.Equal(t, "tomato", params["Vegetable1"], "returned incorrect params", params)
		require.Equal(t, "potato", params["Vegetable2"], "returned incorrect params", params)
		require.Equal(t, "(:Vegetable0,:Vegetable1,:Vegetable2)", keys, "returned incorrect query", keys)
	})
}

func TestSanitizeSearchTerm(t *testing.T) {
	term := "test"
	result := sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, term)

	term = "%%%"
	expected := "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%\\%\\%"
	expected = "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%_test_%"
	expected = "\\%\\_test\\_\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "**test_%"
	expected = "test*_*%"
	result = sanitizeSearchTerm(term, "*")
	require.Equal(t, result, expected)
}
