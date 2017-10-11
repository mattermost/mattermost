package model

import (
	"testing"
	"github.com/stretchr/testify/assert"
	"time"
)

func TestIsValid(t *testing.T) {
	job:= &Job{
		Id: "ThisIdIsTooShort",
		CreateAt: 0,
		Status: "FakeStatus",
		Type: "FakeType",
	}
	assert.NotNil(t, job.IsValid())

	job.Id = NewId()
	assert.NotNil(t, job.IsValid())

	job.CreateAt = time.Now().Unix()
	assert.NotNil(t, job.IsValid())

	job.Status = JOB_STATUS_SUCCESS
	assert.NotNil(t, job.IsValid())

	job.Type = JOB_TYPE_ELASTICSEARCH_POST_INDEXING
	assert.Nil(t, job.IsValid())
}

func TestIsValidJobStatus(t *testing.T) {
	assert.True(t, IsValidJobStatus(JOB_STATUS_CANCEL_REQUESTED))
	assert.True(t, IsValidJobStatus(JOB_STATUS_CANCELED))
	assert.True(t, IsValidJobStatus(JOB_STATUS_ERROR))
	assert.True(t, IsValidJobStatus(JOB_STATUS_IN_PROGRESS))
	assert.True(t, IsValidJobStatus(JOB_STATUS_PENDING))
	assert.True(t, IsValidJobStatus(JOB_STATUS_SUCCESS))
	assert.False(t, IsValidJobStatus("SomeFakeJobStatusThatDoesntExist"))
}

func TestIsValidJobType(t *testing.T) {
	assert.True(t, IsValidJobType(JOB_TYPE_ACTIANCE_EXPORT))
	assert.True(t, IsValidJobType(JOB_TYPE_DATA_RETENTION))
	assert.True(t, IsValidJobType(JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION))
	assert.True(t, IsValidJobType(JOB_TYPE_ELASTICSEARCH_POST_INDEXING))
	assert.True(t, IsValidJobType(JOB_TYPE_LDAP_SYNC))
	assert.False(t, IsValidJobType("SomeFakeJobTypeThatDoesntExist"))
}
