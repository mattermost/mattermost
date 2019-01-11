// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package querybuilder_test

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/store/sqlstore/querybuilder"
)

func ExampleSelect_simple() {
	query := querybuilder.
		Select("u.*").
		From("Users u").
		Where("Id = :UserId").Bind("UserId", "id")

	fmt.Println(query.String())
	args, _ := json.Marshal(query.Args())
	fmt.Printf("%+s\n", string(args))

	// Output: SELECT u.* FROM Users u WHERE Id = :UserId
	// {"UserId":"id"}
}

func ExampleSelect_complex() {
	query := querybuilder.
		Select("u.*").
		Select("q.UserId IS NOT NULL AS IsBot").
		From("Users u").
		LeftJoin("Bots b ON ( q.UserId = u.Id )").
		RightJoin("Admins a ON ( a.UserId = u.Id )").
		Join("Status s ON ( s.UserId = u.Id )").
		Where("Id NOT IN (:BadUserIds)").Bind("BadUserIds", []string{"badid1", "badid2"}).
		Where("s.Status = :Status").Bind("Status", "OFFLINE").
		OrderBy("u.Username ASC").
		OrderBy("u.Id DESC").
		Offset(40).
		Limit(10)

	fmt.Println(query.String())
	args, _ := json.Marshal(query.Args())
	fmt.Printf("%+s\n", string(args))

	// Output: SELECT u.*, q.UserId IS NOT NULL AS IsBot FROM Users u LEFT JOIN Bots b ON ( q.UserId = u.Id ) RIGHT JOIN Admins a ON ( a.UserId = u.Id ) INNER JOIN Status s ON ( s.UserId = u.Id ) WHERE Id NOT IN (:BadUserIds_0, :BadUserIds_1) AND s.Status = :Status ORDER BY u.Username ASC, u.Id DESC LIMIT 10 OFFSET 40
	// {"BadUserIds_0":"badid1","BadUserIds_1":"badid2","Status":"OFFLINE"}
}
