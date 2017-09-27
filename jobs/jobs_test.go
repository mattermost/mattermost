package jobs

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"testing"
	"github.com/mattermost/mattermost-server/store/sqlstore"
)

func TestGetMostRecentJob(t *testing.T) {
	Srv.Store = sqlstore.Setup()

	job, err := CreateJob(model.JOB_TYPE_ACTIANCE_EXPORT, nil)
	assert.Nil(t, err)

	// a fake job type should always fail
	_, err = GetMostRecentJob("FakeJobType", model.JOB_STATUS_PENDING)
	assert.NotNil(t, err)

	// same goes for a fake status
	_, err = GetMostRecentJob(model.JOB_TYPE_ACTIANCE_EXPORT, "FakeJobStatus")
	assert.NotNil(t, err)

	// but querying the correct type and status will return the expected job
	foundJob, err := GetMostRecentJob(model.JOB_TYPE_ACTIANCE_EXPORT, model.JOB_STATUS_PENDING)
	assert.Equal(t, job.Id, foundJob.Id)
}
