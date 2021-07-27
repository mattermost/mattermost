package common

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
