package sqlstore

import (
	"testing"
)

func TestMapStringsToQueryParams(t *testing.T) {
	t.Run("one item", func(t *testing.T) {
		input := []string{"apple"}

		keys, params := MapStringsToQueryParams(input, "Fruit")

		if len(params) != 1 || params["Fruit0"] != "apple" {
			t.Fatal("returned incorrect params", params)
		} else if keys != "(:Fruit0)" {
			t.Fatal("returned incorrect query", keys)
		}
	})

	t.Run("multiple items", func(t *testing.T) {
		input := []string{"carrot", "tomato", "potato"}

		keys, params := MapStringsToQueryParams(input, "Vegetable")

		if len(params) != 3 || params["Vegetable0"] != "carrot" ||
			params["Vegetable1"] != "tomato" || params["Vegetable2"] != "potato" {
			t.Fatal("returned incorrect params", params)
		} else if keys != "(:Vegetable0,:Vegetable1,:Vegetable2)" {
			t.Fatal("returned incorrect query", keys)
		}
	})
}
