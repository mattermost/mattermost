package common

// StringRef returns ref
func StringRef(str string) *string {
	return &str
}

// IntRef returns ref
func IntRef(number int) *int {
	return &number
}

// Int64Ref returns ref
func Int64Ref(number int64) *int64 {
	return &number
}

// Float64Ref returns ref
func Float64Ref(number float64) *float64 {
	return &number
}

// Int64Value returns value
func Int64Value(number *int64) int64 {
	if number == nil {
		return 0
	}
	return *number
}

// IntRefOrNil returns ref
func IntRefOrNil(number int) *int {
	if number == 0 {
		return nil
	}
	return IntRef(number)
}

// Int64RefOrNil returns ref
func Int64RefOrNil(number int64) *int64 {
	if number == 0 {
		return nil
	}
	return Int64Ref(number)
}

// StringRefOrNil returns ref
func StringRefOrNil(str string) *string {
	if str == "" {
		return nil
	}
	return StringRef(str)
}

// AsIntOrNil returns ref
func AsIntOrNil(data interface{}) *int {
	if data == nil {
		return nil
	}

	number, ok := data.(int)
	if !ok {
		return nil
	}
	return IntRef(number)
}

// AsInt64OrNil returns ref
func AsInt64OrNil(data interface{}) *int64 {
	if data == nil {
		return nil
	}

	number, ok := data.(int64)
	if !ok {
		return nil
	}
	return Int64Ref(number)
}

// AsFloat64OrNil return ref
func AsFloat64OrNil(data interface{}) *float64 {
	if data == nil {
		return nil
	}

	number, ok := data.(float64)
	if !ok {
		return nil
	}
	return Float64Ref(number)
}

// AsStringOrNil returns ref
func AsStringOrNil(data interface{}) *string {
	if data == nil {
		return nil
	}

	str, ok := data.(string)
	if !ok {
		return nil
	}
	return StringRef(str)
}
