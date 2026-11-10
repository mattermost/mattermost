package assert

import (
	"testing"
)

func Error(t *testing.T, err error, msgAndArgs ...interface{})                  {}
func Errorf(t *testing.T, err error, msg string, args ...interface{})           {}
func NoError(t *testing.T, err error, msgAndArgs ...interface{})                {}
func NoErrorf(t *testing.T, err error, msg string, args ...interface{})         {}
func Nil(t *testing.T, object interface{}, msgAndArgs ...interface{})           {}
func NotNil(t *testing.T, object interface{}, msgAndArgs ...interface{})        {}
func Nilf(t *testing.T, object interface{}, msg string, args ...interface{})    {}
func NotNilf(t *testing.T, object interface{}, msg string, args ...interface{}) {}
