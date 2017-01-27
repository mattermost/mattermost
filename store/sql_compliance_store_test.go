// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
	"time"
)

func TestSqlComplianceStore(t *testing.T) {
	Setup()

	compliance1 := &model.Compliance{Desc: "Audit for federal subpoena case #22443", UserId: model.NewId(), Status: model.COMPLIANCE_STATUS_FAILED, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.COMPLIANCE_TYPE_ADHOC}
	Must(store.Compliance().Save(compliance1))
	time.Sleep(100 * time.Millisecond)

	compliance2 := &model.Compliance{Desc: "Audit for federal subpoena case #11458", UserId: model.NewId(), Status: model.COMPLIANCE_STATUS_RUNNING, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.COMPLIANCE_TYPE_ADHOC}
	Must(store.Compliance().Save(compliance2))
	time.Sleep(100 * time.Millisecond)

	c := store.Compliance().GetAll()
	result := <-c
	compliances := result.Data.(model.Compliances)

	if compliances[0].Status != model.COMPLIANCE_STATUS_RUNNING && compliance2.Id != compliances[0].Id {
		t.Fatal()
	}

	compliance2.Status = model.COMPLIANCE_STATUS_FAILED
	Must(store.Compliance().Update(compliance2))

	c = store.Compliance().GetAll()
	result = <-c
	compliances = result.Data.(model.Compliances)

	if compliances[0].Status != model.COMPLIANCE_STATUS_FAILED && compliance2.Id != compliances[0].Id {
		t.Fatal()
	}

	rc2 := (<-store.Compliance().Get(compliance2.Id)).Data.(*model.Compliance)
	if rc2.Status != compliance2.Status {
		t.Fatal()
	}
}

func TestComplianceExport(t *testing.T) {
	Setup()

	time.Sleep(100 * time.Millisecond)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "a" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = Must(store.Team().Save(t1)).(*model.Team)

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	u1 = Must(store.User().Save(u1)).(*model.User)
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Username = model.NewId()
	u2 = Must(store.User().Save(u2)).(*model.User)
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u2.Id}))

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = Must(store.Channel().Save(c1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.CreateAt = model.GetMillis()
	o1.Message = "a" + model.NewId() + "b"
	o1 = Must(store.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = u1.Id
	o1a.CreateAt = o1.CreateAt + 10
	o1a.Message = "a" + model.NewId() + "b"
	o1a = Must(store.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = "a" + model.NewId() + "b"
	o2 = Must(store.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = "a" + model.NewId() + "b"
	o2a = Must(store.Post().Save(o2a)).(*model.Post)

	time.Sleep(100 * time.Millisecond)

	cr1 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1}
	if r1 := <-store.Compliance().ComplianceExport(cr1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 4 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[3].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr2 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email}
	if r1 := <-store.Compliance().ComplianceExport(cr2); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 1 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr3 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email}
	if r1 := <-store.Compliance().ComplianceExport(cr3); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 4 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[3].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr4 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message}
	if r1 := <-store.Compliance().ComplianceExport(cr4); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 1 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr5 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message + " " + o1.Message}
	if r1 := <-store.Compliance().ComplianceExport(cr5); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 2 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr6 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email, Keywords: o2a.Message + " " + o1.Message}
	if r1 := <-store.Compliance().ComplianceExport(cr6); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 2 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[1].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}
}
