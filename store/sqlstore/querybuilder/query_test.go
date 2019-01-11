// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package querybuilder_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/store/sqlstore/querybuilder"
)

func TestSelect(t *testing.T) {
	var q1, q2, q3, q4 *querybuilder.Query

	t.Run("empty query", func(t *testing.T) {
		q1 = &querybuilder.Query{}
		assert.Equal(t, "", q1.String())
	})

	t.Run("single select statement q1", func(t *testing.T) {
		q2 = q1.Select("u.*")
		assert.Equal(t, "SELECT u.*", q2.String())
	})

	t.Run("append select statement to q1", func(t *testing.T) {
		q3 = q1.Select("FALSE AS IsBot")
		assert.Equal(t, "SELECT FALSE AS IsBot", q3.String())
	})

	t.Run("append select statement to q2", func(t *testing.T) {
		q4 = q2.Select("q.UserId IS NOT NULL AS IsBot")
		assert.Equal(t, "SELECT u.*, q.UserId IS NOT NULL AS IsBot", q4.String())
	})

	t.Run("global", func(t *testing.T) {
		q := querybuilder.Select("u.*")
		assert.Equal(t, "SELECT u.*", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "", q1.String())
		assert.Equal(t, "SELECT u.*", q2.String())
		assert.Equal(t, "SELECT FALSE AS IsBot", q3.String())
		assert.Equal(t, "SELECT u.*, q.UserId IS NOT NULL AS IsBot", q4.String())
	})
}

func TestFrom(t *testing.T) {
	var q1, q2 *querybuilder.Query

	t.Run("single from statement", func(t *testing.T) {
		q1 = querybuilder.Select("u.*").From("Users u")
		assert.Equal(t, "SELECT u.* FROM Users u", q1.String())
	})

	t.Run("append select statement to q1", func(t *testing.T) {
		q2 = q1.From("Status s")
		assert.Equal(t, "SELECT u.* FROM Users u, Status s", q2.String())
	})

	t.Run("global", func(t *testing.T) {
		q := querybuilder.From("Users u").Select("u.*")
		assert.Equal(t, "SELECT u.* FROM Users u", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT u.* FROM Users u", q1.String())
		assert.Equal(t, "SELECT u.* FROM Users u, Status s", q2.String())
	})
}

func TestJoin(t *testing.T) {
	var q1, q2, q3 *querybuilder.Query

	t.Run("single join statement", func(t *testing.T) {
		q1 = querybuilder.Select("u.*").From("Users u").Join("UserProps up ON ( up.UserId = u.Id )")
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id )", q1.String())
	})

	t.Run("append left join statement to q1", func(t *testing.T) {
		q2 = q1.LeftJoin("Status s ON ( s.UserId = u.Id )")
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id ) LEFT JOIN Status s ON ( s.UserId = u.Id )", q2.String())
	})

	t.Run("append right join statement to q1", func(t *testing.T) {
		q3 = q1.RightJoin("ChannelMember cm ON ( cm.UserId = u.Id )")
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id ) RIGHT JOIN ChannelMember cm ON ( cm.UserId = u.Id )", q3.String())
	})

	t.Run("global, join", func(t *testing.T) {
		q := querybuilder.Join("UserProps up ON ( up.UserId = u.Id )").From("Users u").Select("u.*")
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id )", q.String())
	})

	t.Run("global, left join", func(t *testing.T) {
		q := querybuilder.LeftJoin("Status s ON ( s.UserId = u.Id )").Join("UserProps up ON ( up.UserId = u.Id )").From("Users u").Select("u.*")
		assert.Equal(t, "SELECT u.* FROM Users u LEFT JOIN Status s ON ( s.UserId = u.Id ) INNER JOIN UserProps up ON ( up.UserId = u.Id )", q.String())
	})

	t.Run("global, right join", func(t *testing.T) {
		q := querybuilder.RightJoin("ChannelMember cm ON ( cm.UserId = u.Id )").Select("u.*").From("Users u").Join("UserProps up ON ( up.UserId = u.Id )")
		assert.Equal(t, "SELECT u.* FROM Users u RIGHT JOIN ChannelMember cm ON ( cm.UserId = u.Id ) INNER JOIN UserProps up ON ( up.UserId = u.Id )", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id )", q1.String())
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id ) LEFT JOIN Status s ON ( s.UserId = u.Id )", q2.String())
		assert.Equal(t, "SELECT u.* FROM Users u INNER JOIN UserProps up ON ( up.UserId = u.Id ) RIGHT JOIN ChannelMember cm ON ( cm.UserId = u.Id )", q3.String())
	})
}

func TestWhere(t *testing.T) {
	var q1, q2 *querybuilder.Query

	t.Run("single where statement", func(t *testing.T) {
		q1 = querybuilder.Select("u.*").From("Users u").Where("u.Id = :Id")
		assert.Equal(t, "SELECT u.* FROM Users u WHERE u.Id = :Id", q1.String())
	})

	t.Run("append where statement to q1", func(t *testing.T) {
		q2 = q1.Where("u.Username = :Username")
		assert.Equal(t, "SELECT u.* FROM Users u WHERE u.Id = :Id AND u.Username = :Username", q2.String())
	})

	t.Run("global", func(t *testing.T) {
		q := querybuilder.Where("u.Username = :Username").Select("u.*").From("Users u")
		assert.Equal(t, "SELECT u.* FROM Users u WHERE u.Username = :Username", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT u.* FROM Users u WHERE u.Id = :Id", q1.String())
		assert.Equal(t, "SELECT u.* FROM Users u WHERE u.Id = :Id AND u.Username = :Username", q2.String())
	})
}

func TestOrderBy(t *testing.T) {
	var q1, q2 *querybuilder.Query

	t.Run("single order by statement", func(t *testing.T) {
		q1 = querybuilder.Select("u.*").From("Users u").OrderBy("u.Username ASC")
		assert.Equal(t, "SELECT u.* FROM Users u ORDER BY u.Username ASC", q1.String())
	})

	t.Run("append order by statement to q1", func(t *testing.T) {
		q2 = q1.OrderBy("u.Id DESC")
		assert.Equal(t, "SELECT u.* FROM Users u ORDER BY u.Username ASC, u.Id DESC", q2.String())
	})

	t.Run("global", func(t *testing.T) {
		q := querybuilder.OrderBy("u.Username ASC").Select("u.*").From("Users u")
		assert.Equal(t, "SELECT u.* FROM Users u ORDER BY u.Username ASC", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT u.* FROM Users u ORDER BY u.Username ASC", q1.String())
		assert.Equal(t, "SELECT u.* FROM Users u ORDER BY u.Username ASC, u.Id DESC", q2.String())
	})
}

func TestOffsetLimit(t *testing.T) {
	var q1, q2, q3 *querybuilder.Query

	t.Run("offset 0, no limit", func(t *testing.T) {
		q1 = querybuilder.Select("u.*").From("Users u").Offset(0)
		assert.Equal(t, "SELECT u.* FROM Users u OFFSET 0", q1.String())
	})

	t.Run("no offset, limit 100", func(t *testing.T) {
		q2 = querybuilder.Select("u.*").From("Users u").Limit(100)
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100", q2.String())
	})

	t.Run("offset 300, limit 100, replacing q1", func(t *testing.T) {
		q3 = q1.Offset(300).Limit(100)
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100 OFFSET 300", q3.String())
	})

	t.Run("global offset", func(t *testing.T) {
		q := querybuilder.Offset(300).Limit(100).Select("u.*").From("Users u")
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100 OFFSET 300", q.String())
	})

	t.Run("global offset", func(t *testing.T) {
		q := querybuilder.Limit(100).Offset(300).Select("u.*").From("Users u")
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100 OFFSET 300", q.String())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT u.* FROM Users u OFFSET 0", q1.String())
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100", q2.String())
		assert.Equal(t, "SELECT u.* FROM Users u LIMIT 100 OFFSET 300", q3.String())
	})
}

func TestBind(t *testing.T) {
	var q1, q2, q3, q4, q5 *querybuilder.Query

	t.Run("bind string", func(t *testing.T) {
		q1 = querybuilder.Select("*").
			From("Users").
			Where("Id = :Id").
			Bind("Id", "1")
		assert.Equal(t, "SELECT * FROM Users WHERE Id = :Id", q1.String())
		assert.Equal(t, map[string]interface{}{
			"Id": "1",
		}, q1.Args())
	})

	t.Run("replace integer to q1", func(t *testing.T) {
		q2 = q1.Bind("Id", 1)
		assert.Equal(t, "SELECT * FROM Users WHERE Id = :Id", q2.String())
		assert.Equal(t, map[string]interface{}{
			"Id": 1,
		}, q2.Args())
	})

	t.Run("bind multiple", func(t *testing.T) {
		q3 = querybuilder.Select("*").
			From("Users").
			Where("Id IN (:Id1, :Id2)").
			Bind("Id1", 1).Bind("Id2", 2)
		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Id1, :Id2)", q3.String())
		assert.Equal(t, map[string]interface{}{
			"Id1": 1,
			"Id2": 2,
		}, q3.Args())
	})

	t.Run("array with multiple string elements", func(t *testing.T) {
		q4 = querybuilder.Select("*").
			From("Users").
			Where("Id IN (:Ids)").
			Bind("Ids", []string{"id1", "id2", "id3"})
		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Ids_0, :Ids_1, :Ids_2)", q4.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0": "id1",
			"Ids_1": "id2",
			"Ids_2": "id3",
		}, q4.Args())
	})

	t.Run("array with multiple integer elements", func(t *testing.T) {
		q5 = querybuilder.Select("*").
			From("Users").
			Where("Count IN (:Ids)").
			Bind("Ids", []int{1, 2, 3})
		assert.Equal(t, "SELECT * FROM Users WHERE Count IN (:Ids_0, :Ids_1, :Ids_2)", q5.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0": 1,
			"Ids_1": 2,
			"Ids_2": 3,
		}, q5.Args())
	})

	t.Run("array with multiple string elements, prefix matches a non-array", func(t *testing.T) {
		q := querybuilder.Select("*").
			From("Users").
			Where("Id IN (:Ids)").
			Bind("Ids", []string{"id1", "id2", "id3"}).
			Where("Id != :Idsomething").
			Bind(":Idsomething", "x")
		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Ids_0, :Ids_1, :Ids_2) AND Id != :Idsomething", q.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0":       "id1",
			"Ids_1":       "id2",
			"Ids_2":       "id3",
			"Idsomething": "x",
		}, q.Args())
	})

	t.Run("array with multiple replacements", func(t *testing.T) {
		q := querybuilder.Select("*").
			From("Users").
			Where("Id IN (:Ids)").
			Where("Id NOT IN (:Ids)").
			Bind("Ids", []string{"id1", "id2", "id3"})
		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Ids_0, :Ids_1, :Ids_2) AND Id NOT IN (:Ids_0, :Ids_1, :Ids_2)", q.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0": "id1",
			"Ids_1": "id2",
			"Ids_2": "id3",
		}, q.Args())
	})

	t.Run("global bind", func(t *testing.T) {
		q := querybuilder.Bind("Id", "a").Select("*").From("Users").Where("Id = :Id")
		assert.Equal(t, "SELECT * FROM Users WHERE Id = :Id", q.String())
		assert.Equal(t, map[string]interface{}{
			"Id": "a",
		}, q.Args())
	})

	t.Run("immutable", func(t *testing.T) {
		assert.Equal(t, "SELECT * FROM Users WHERE Id = :Id", q1.String())
		assert.Equal(t, map[string]interface{}{
			"Id": "1",
		}, q1.Args())

		assert.Equal(t, "SELECT * FROM Users WHERE Id = :Id", q2.String())
		assert.Equal(t, map[string]interface{}{
			"Id": 1,
		}, q2.Args())

		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Id1, :Id2)", q3.String())
		assert.Equal(t, map[string]interface{}{
			"Id1": 1,
			"Id2": 2,
		}, q3.Args())

		assert.Equal(t, "SELECT * FROM Users WHERE Id IN (:Ids_0, :Ids_1, :Ids_2)", q4.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0": "id1",
			"Ids_1": "id2",
			"Ids_2": "id3",
		}, q4.Args())

		assert.Equal(t, "SELECT * FROM Users WHERE Count IN (:Ids_0, :Ids_1, :Ids_2)", q5.String())
		assert.Equal(t, map[string]interface{}{
			"Ids_0": 1,
			"Ids_1": 2,
			"Ids_2": 3,
		}, q5.Args())
	})
}
