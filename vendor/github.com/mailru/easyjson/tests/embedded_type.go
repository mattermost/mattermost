package tests

//easyjson:json
type EmbeddedType struct {
	EmbeddedInnerType
	Inner struct {
		EmbeddedInnerType
	}
	Field2 int
}

type EmbeddedInnerType struct {
	Field1 int
}

var embeddedTypeValue EmbeddedType

func init() {
	embeddedTypeValue.Field1 = 1
	embeddedTypeValue.Field2 = 2
	embeddedTypeValue.Inner.Field1 = 3
}

var embeddedTypeValueString = `{"Inner":{"Field1":3},"Field2":2,"Field1":1}`
