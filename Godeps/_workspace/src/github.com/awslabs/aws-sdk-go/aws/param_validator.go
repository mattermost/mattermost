package aws

import (
	"fmt"
	"reflect"
	"strings"
)

func ValidateParameters(r *Request) {
	if r.ParamsFilled() {
		v := validator{errors: []string{}}
		v.validateAny(reflect.ValueOf(r.Params), "")

		if count := len(v.errors); count > 0 {
			format := "%d validation errors:\n- %s"
			msg := fmt.Sprintf(format, count, strings.Join(v.errors, "\n- "))
			r.Error = APIError{Code: "InvalidParameter", Message: msg}
		}
	}
}

type validator struct {
	errors []string
}

func (v *validator) validateAny(value reflect.Value, path string) {
	value = reflect.Indirect(value)
	if !value.IsValid() {
		return
	}

	switch value.Kind() {
	case reflect.Struct:
		v.validateStruct(value, path)
	case reflect.Slice:
		for i := 0; i < value.Len(); i++ {
			v.validateAny(value.Index(i), path+fmt.Sprintf("[%d]", i))
		}
	case reflect.Map:
		for _, n := range value.MapKeys() {
			v.validateAny(value.MapIndex(n), path+fmt.Sprintf("[%q]", n.String()))
		}
	}
}

func (v *validator) validateStruct(value reflect.Value, path string) {
	prefix := "."
	if path == "" {
		prefix = ""
	}

	for i := 0; i < value.Type().NumField(); i++ {
		f := value.Type().Field(i)
		if strings.ToLower(f.Name[0:1]) == f.Name[0:1] {
			continue
		}
		fvalue := value.FieldByName(f.Name)

		notset := false
		if f.Tag.Get("required") != "" {
			switch fvalue.Kind() {
			case reflect.Ptr, reflect.Slice:
				if fvalue.IsNil() {
					notset = true
				}
			default:
				if !fvalue.IsValid() {
					notset = true
				}
			}
		}

		if notset {
			msg := "missing required parameter: " + path + prefix + f.Name
			v.errors = append(v.errors, msg)
		} else {
			v.validateAny(fvalue, path+prefix+f.Name)
		}
	}
}
