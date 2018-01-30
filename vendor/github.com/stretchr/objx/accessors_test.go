package objx

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAccessorsAccessGetSingleField(t *testing.T) {
	current := Map{"name": "Tyler"}

	assert.Equal(t, "Tyler", current.Get("name").Data())
}

func TestAccessorsAccessGetSingleFieldInt(t *testing.T) {
	current := Map{"name": 10}

	assert.Equal(t, 10, current.Get("name").Data())
}

func TestAccessorsAccessGetDeep(t *testing.T) {
	current := Map{
		"name": Map{
			"first": "Tyler",
			"last":  "Bunnell",
		},
	}

	assert.Equal(t, "Tyler", current.Get("name.first").Data())
	assert.Equal(t, "Bunnell", current.Get("name.last").Data())
}

func TestAccessorsAccessGetDeepDeep(t *testing.T) {
	current := Map{
		"one": Map{
			"two": Map{
				"three": Map{
					"four": 4,
				},
			},
		},
	}

	assert.Equal(t, 4, current.Get("one.two.three.four").Data())
}

func TestAccessorsAccessGetInsideArray(t *testing.T) {
	current := Map{
		"names": []interface{}{
			Map{
				"first": "Tyler",
				"last":  "Bunnell",
			},
			Map{
				"first": "Capitol",
				"last":  "Bollocks",
			},
		},
	}

	assert.Equal(t, "Tyler", current.Get("names[0].first").Data())
	assert.Equal(t, "Bunnell", current.Get("names[0].last").Data())
	assert.Equal(t, "Capitol", current.Get("names[1].first").Data())
	assert.Equal(t, "Bollocks", current.Get("names[1].last").Data())

	assert.Nil(t, current.Get("names[2]").Data())
}

func TestAccessorsAccessGetFromArrayWithInt(t *testing.T) {
	current := []interface{}{
		map[string]interface{}{
			"first": "Tyler",
			"last":  "Bunnell",
		},
		map[string]interface{}{
			"first": "Capitol",
			"last":  "Bollocks",
		},
	}
	one := access(current, 0, nil, false)
	two := access(current, 1, nil, false)
	three := access(current, 2, nil, false)

	assert.Equal(t, "Tyler", one.(map[string]interface{})["first"])
	assert.Equal(t, "Capitol", two.(map[string]interface{})["first"])
	assert.Nil(t, three)
}

func TestAccessorsAccessGetFromArrayWithIntTypes(t *testing.T) {
	current := []interface{}{
		"abc",
		"def",
	}
	assert.Equal(t, "abc", access(current, 0, nil, false))
	assert.Equal(t, "def", access(current, 1, nil, false))
	assert.Nil(t, access(current, 2, nil, false))

	assert.Equal(t, "abc", access(current, int8(0), nil, false))
	assert.Equal(t, "def", access(current, int8(1), nil, false))
	assert.Nil(t, access(current, int8(2), nil, false))

	assert.Equal(t, "abc", access(current, int16(0), nil, false))
	assert.Equal(t, "def", access(current, int16(1), nil, false))
	assert.Nil(t, access(current, int16(2), nil, false))

	assert.Equal(t, "abc", access(current, int32(0), nil, false))
	assert.Equal(t, "def", access(current, int32(1), nil, false))
	assert.Nil(t, access(current, int32(2), nil, false))

	assert.Equal(t, "abc", access(current, int64(0), nil, false))
	assert.Equal(t, "def", access(current, int64(1), nil, false))
	assert.Nil(t, access(current, int64(2), nil, false))

	assert.Equal(t, "abc", access(current, uint(0), nil, false))
	assert.Equal(t, "def", access(current, uint(1), nil, false))
	assert.Nil(t, access(current, uint(2), nil, false))

	assert.Equal(t, "abc", access(current, uint8(0), nil, false))
	assert.Equal(t, "def", access(current, uint8(1), nil, false))
	assert.Nil(t, access(current, uint8(2), nil, false))

	assert.Equal(t, "abc", access(current, uint16(0), nil, false))
	assert.Equal(t, "def", access(current, uint16(1), nil, false))
	assert.Nil(t, access(current, uint16(2), nil, false))

	assert.Equal(t, "abc", access(current, uint32(0), nil, false))
	assert.Equal(t, "def", access(current, uint32(1), nil, false))
	assert.Nil(t, access(current, uint32(2), nil, false))

	assert.Equal(t, "abc", access(current, uint64(0), nil, false))
	assert.Equal(t, "def", access(current, uint64(1), nil, false))
	assert.Nil(t, access(current, uint64(2), nil, false))
}

func TestAccessorsAccessGetFromArrayWithIntError(t *testing.T) {
	current := Map{"name": "Tyler"}

	assert.Nil(t, access(current, 0, nil, false))
}

func TestAccessorsGet(t *testing.T) {
	current := Map{"name": "Tyler"}

	assert.Equal(t, "Tyler", current.Get("name").Data())
}

func TestAccessorsAccessSetSingleField(t *testing.T) {
	current := Map{"name": "Tyler"}

	current.Set("name", "Mat")
	current.Set("age", 29)

	assert.Equal(t, current["name"], "Mat")
	assert.Equal(t, current["age"], 29)
}

func TestAccessorsAccessSetSingleFieldNotExisting(t *testing.T) {
	current := Map{
		"first": "Tyler",
		"last":  "Bunnell",
	}

	current.Set("name", "Mat")

	assert.Equal(t, current["name"], "Mat")
}

func TestAccessorsAccessSetDeep(t *testing.T) {
	current := Map{
		"name": Map{
			"first": "Tyler",
			"last":  "Bunnell",
		},
	}

	current.Set("name.first", "Mat")
	current.Set("name.last", "Ryer")

	assert.Equal(t, "Mat", current.Get("name.first").Data())
	assert.Equal(t, "Ryer", current.Get("name.last").Data())
}

func TestAccessorsAccessSetDeepDeep(t *testing.T) {
	current := Map{
		"one": Map{
			"two": Map{
				"three": Map{
					"four": 4},
			},
		},
	}

	current.Set("one.two.three.four", 5)

	assert.Equal(t, 5, current.Get("one.two.three.four").Data())
}

func TestAccessorsAccessSetArray(t *testing.T) {
	current := Map{
		"names": []interface{}{"Tyler"},
	}
	current.Set("names[0]", "Mat")

	assert.Equal(t, "Mat", current.Get("names[0]").Data())
}

func TestAccessorsAccessSetInsideArray(t *testing.T) {
	current := Map{
		"names": []interface{}{
			Map{
				"first": "Tyler",
				"last":  "Bunnell",
			},
			Map{
				"first": "Capitol",
				"last":  "Bollocks",
			},
		},
	}

	current.Set("names[0].first", "Mat")
	current.Set("names[0].last", "Ryer")
	current.Set("names[1].first", "Captain")
	current.Set("names[1].last", "Underpants")

	assert.Equal(t, "Mat", current.Get("names[0].first").Data())
	assert.Equal(t, "Ryer", current.Get("names[0].last").Data())
	assert.Equal(t, "Captain", current.Get("names[1].first").Data())
	assert.Equal(t, "Underpants", current.Get("names[1].last").Data())
}

func TestAccessorsSet(t *testing.T) {
	current := Map{"name": "Tyler"}

	current.Set("name", "Mat")

	assert.Equal(t, "Mat", current.Get("name").data)
}
