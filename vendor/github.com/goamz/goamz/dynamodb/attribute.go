package dynamodb

import (
	"strconv"
)

const (
	TYPE_STRING = "S"
	TYPE_NUMBER = "N"
	TYPE_BINARY = "B"

	TYPE_STRING_SET = "SS"
	TYPE_NUMBER_SET = "NS"
	TYPE_BINARY_SET = "BS"

	COMPARISON_EQUAL                    = "EQ"
	COMPARISON_NOT_EQUAL                = "NE"
	COMPARISON_LESS_THAN_OR_EQUAL       = "LE"
	COMPARISON_LESS_THAN                = "LT"
	COMPARISON_GREATER_THAN_OR_EQUAL    = "GE"
	COMPARISON_GREATER_THAN             = "GT"
	COMPARISON_ATTRIBUTE_EXISTS         = "NOT_NULL"
	COMPARISON_ATTRIBUTE_DOES_NOT_EXIST = "NULL"
	COMPARISON_CONTAINS                 = "CONTAINS"
	COMPARISON_DOES_NOT_CONTAIN         = "NOT_CONTAINS"
	COMPARISON_BEGINS_WITH              = "BEGINS_WITH"
	COMPARISON_IN                       = "IN"
	COMPARISON_BETWEEN                  = "BETWEEN"
)

type Key struct {
	HashKey  string
	RangeKey string
}

type PrimaryKey struct {
	KeyAttribute   *Attribute
	RangeAttribute *Attribute
}

type Attribute struct {
	Type      string
	Name      string
	Value     string
	SetValues []string
	Exists    string // exists on dynamodb? Values: "true", "false", or ""
}

type AttributeComparison struct {
	AttributeName      string
	ComparisonOperator string
	AttributeValueList []Attribute // contains attributes with only types and names (value ignored)
}

func NewEqualInt64AttributeComparison(attributeName string, equalToValue int64) *AttributeComparison {
	numeric := NewNumericAttribute(attributeName, strconv.FormatInt(equalToValue, 10))
	return &AttributeComparison{attributeName,
		COMPARISON_EQUAL,
		[]Attribute{*numeric},
	}
}

func NewEqualStringAttributeComparison(attributeName string, equalToValue string) *AttributeComparison {
	str := NewStringAttribute(attributeName, equalToValue)
	return &AttributeComparison{attributeName,
		COMPARISON_EQUAL,
		[]Attribute{*str},
	}
}

func NewStringAttributeComparison(attributeName string, comparisonOperator string, value string) *AttributeComparison {
	valueToCompare := NewStringAttribute(attributeName, value)
	return &AttributeComparison{attributeName,
		comparisonOperator,
		[]Attribute{*valueToCompare},
	}
}

func NewNumericAttributeComparison(attributeName string, comparisonOperator string, value int64) *AttributeComparison {
	valueToCompare := NewNumericAttribute(attributeName, strconv.FormatInt(value, 10))
	return &AttributeComparison{attributeName,
		comparisonOperator,
		[]Attribute{*valueToCompare},
	}
}

func NewBinaryAttributeComparison(attributeName string, comparisonOperator string, value bool) *AttributeComparison {
	valueToCompare := NewBinaryAttribute(attributeName, strconv.FormatBool(value))
	return &AttributeComparison{attributeName,
		comparisonOperator,
		[]Attribute{*valueToCompare},
	}
}

func NewStringAttribute(name string, value string) *Attribute {
	return &Attribute{
		Type:  TYPE_STRING,
		Name:  name,
		Value: value,
	}
}

func NewNumericAttribute(name string, value string) *Attribute {
	return &Attribute{
		Type:  TYPE_NUMBER,
		Name:  name,
		Value: value,
	}
}

func NewBinaryAttribute(name string, value string) *Attribute {
	return &Attribute{
		Type:  TYPE_BINARY,
		Name:  name,
		Value: value,
	}
}

func NewStringSetAttribute(name string, values []string) *Attribute {
	return &Attribute{
		Type:      TYPE_STRING_SET,
		Name:      name,
		SetValues: values,
	}
}

func NewNumericSetAttribute(name string, values []string) *Attribute {
	return &Attribute{
		Type:      TYPE_NUMBER_SET,
		Name:      name,
		SetValues: values,
	}
}

func NewBinarySetAttribute(name string, values []string) *Attribute {
	return &Attribute{
		Type:      TYPE_BINARY_SET,
		Name:      name,
		SetValues: values,
	}
}

func (a *Attribute) SetType() bool {
	switch a.Type {
	case TYPE_BINARY_SET, TYPE_NUMBER_SET, TYPE_STRING_SET:
		return true
	}
	return false
}

func (a *Attribute) SetExists(exists bool) *Attribute {
	if exists {
		a.Exists = "true"
	} else {
		a.Exists = "false"
	}
	return a
}

func (k *PrimaryKey) HasRange() bool {
	return k.RangeAttribute != nil
}

// Useful when you may have many goroutines using a primary key, so they don't fuxor up your values.
func (k *PrimaryKey) Clone(h string, r string) []Attribute {
	pk := &Attribute{
		Type:  k.KeyAttribute.Type,
		Name:  k.KeyAttribute.Name,
		Value: h,
	}

	result := []Attribute{*pk}

	if k.HasRange() {
		rk := &Attribute{
			Type:  k.RangeAttribute.Type,
			Name:  k.RangeAttribute.Name,
			Value: r,
		}

		result = append(result, *rk)
	}

	return result
}
