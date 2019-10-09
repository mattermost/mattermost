package stringutils

import (
	"fmt"
)

func Stringify(objects []interface{}) []string {
	stringified := make([]string, len(objects), len(objects))
	for i, object := range objects {
		if object == nil {
			stringified[i] = ""
			continue
		}
		if str, isString := object.(string); isString {
			stringified[i] = str
			continue
		}
		if str, isStringer := object.(fmt.Stringer); isStringer {
			stringified[i] = str.String()
			continue
		}
		if err, isError := object.(error); isError {
			stringified[i] = err.Error()
			continue
		}
		stringified[i] = fmt.Sprintf("%+v", object)
	}
	return stringified
}

func ToObjects(strings []string) []interface{} {
	if strings == nil {
		return nil
	}
	objects := make([]interface{}, len(strings))
	for i, string := range strings {
		objects[i] = string
	}
	return objects
}

func StringifyToObjects(objects []interface{}) []interface{} {
	return ToObjects(Stringify(objects))
}
