package common

// StringRef returns ref
func StringRef(str string) *string {
	return &str
}

// StringFromRef returns original value if not empty. Default otherwise.
func StringFromRef(str *string) string {
	if str == nil {
		return ""
	}
	return *str
}

// IntRef returns ref
func IntRef(number int) *int {
	return &number
}

// IntFromRef returns 0 if nil, dereferenced value otherwhise.
func IntFromRef(ref *int) int {
	if ref == nil {
		return 0
	}
	return *ref
}

// Int64Ref returns ref
func Int64Ref(number int64) *int64 {
	return &number
}

// Int64FromRef returns value
func Int64FromRef(number *int64) int64 {
	if number == nil {
		return 0
	}
	return *number
}

// Int64Value kept to prevent breaking change. TODO: Deprecate in v4
func Int64Value(number *int64) int64 {
	return Int64FromRef(number)
}

// Float64Ref returns ref
func Float64Ref(number float64) *float64 {
	return &number
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
