package errorAssertions

import (
	"testing"

	"assert"
	"model"
	"require"
)

func TestError(t *testing.T) {
	var err error
	assert.Error(t, err)
	assert.Errorf(t, err, "%s", "foo")
	assert.NoError(t, err)
	assert.NoErrorf(t, err, "%s", "foo")
	assert.Nil(t, err)                  // want `calling assert.Nil on error, please use assert.NoError instead`
	assert.Nilf(t, err, "%s", "foo")    // want `calling assert.Nilf on error, please use assert.NoErrorf instead`
	assert.NotNil(t, err)               // want `calling assert.NotNil on error, please use assert.Error instead`
	assert.NotNilf(t, err, "%s", "foo") // want `calling assert.NotNilf on error, please use assert.Errorf instead`

	require.Error(t, err)
	require.Errorf(t, err, "%s", "foo")
	require.NoError(t, err)
	require.NoErrorf(t, err, "%s", "foo")
	require.Nil(t, err)                  // want `calling require.Nil on error, please use require.NoError instead`
	require.Nilf(t, err, "%s", "foo")    // want `calling require.Nilf on error, please use require.NoErrorf instead`
	require.NotNil(t, err)               // want `calling require.NotNil on error, please use require.Error instead`
	require.NotNilf(t, err, "%s", "foo") // want `calling require.NotNilf on error, please use require.Errorf instead`
}

func TestModelAppError(t *testing.T) {
	var appErr *model.AppError
	assert.Error(t, appErr)                 // want `calling assert.Error on \*model.AppError, please use assert.NotNil instead`
	assert.Errorf(t, appErr, "%s", "foo")   // want `calling assert.Errorf on \*model.AppError, please use assert.NotNilf instead`
	assert.NoError(t, appErr)               // want `calling assert.NoError on \*model.AppError, please use assert.Nil instead`
	assert.NoErrorf(t, appErr, "%s", "foo") // want `calling assert.NoErrorf on \*model.AppError, please use assert.Nilf instead`
	assert.Nil(t, appErr)
	assert.Nilf(t, appErr, "%s", "foo")
	assert.NotNil(t, appErr)
	assert.NotNilf(t, appErr, "%s", "foo")

	require.Error(t, appErr)                 // want `calling require.Error on \*model.AppError, please use require.NotNil instead`
	require.Errorf(t, appErr, "%s", "foo")   // want `calling require.Errorf on \*model.AppError, please use require.NotNilf instead`
	require.NoError(t, appErr)               // want `calling require.NoError on \*model.AppError, please use require.Nil instead`
	require.NoErrorf(t, appErr, "%s", "foo") // want `calling require.NoErrorf on \*model.AppError, please use require.Nilf instead`
	require.Nil(t, appErr)
	require.Nilf(t, appErr, "%s", "foo")
	require.NotNil(t, appErr)
	require.NotNilf(t, appErr, "%s", "foo")
}
