package a

import sq "github.com/Masterminds/squirrel"

type store struct{}

func (s store) getBuilder() sq.StatementBuilderType {
	return sq.StatementBuilder
}

func example() {
	// These should trigger warnings
	_ = "SELECT * FROM users" // want `do not use SELECT \*: explicitly select the needed columns instead`
	_ = "select * from table" // want `do not use SELECT \*: explicitly select the needed columns instead`
	_ = "SELECT a.* FROM users a" // want `do not use SELECT \*: explicitly select the needed columns instead`
	_ = "SELECT users.* FROM users" // want `do not use SELECT \*: explicitly select the needed columns instead`

	// These should not trigger warnings
	_ = "SELECT id, name FROM users"
	_ = "Just a * by itself"
	_ = "SELECT"
	_ = "SELECT COUNT(*) FROM users"
	_ = "SELECT COUNT( * ) FROM users"
	_ = "SELECT id, COUNT(*) FROM users GROUP BY id"
	_ = "SELECT Count(*) FROM users"
	_ = "SELECT COUNT(*) FROM users WHERE name LIKE '%*%'"
	_ = "SELECT coUNt(*) FROM users"
	_ = "SELECT id, CoUnT(*) FROM users GROUP BY id"

	// These should trigger warnings for Select function
	var s store
	s.getBuilder().Select("*").From("Channels").Where(sq.Eq{"Id": "id"})                                                 // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("Id", "*").From("Channels")                                                                    // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("id", "*").From("Channels").Where(sq.Eq{"Id": "id"})                                           // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("id", "*", "name").From("Channels").Where(sq.Eq{"Id": "id"})                                   // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("id", "name", "*").From("Channels").Where(sq.Eq{"Id": "id"})                                   // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("*").From("Channels").Where(sq.Eq{"Id": "id"})                                        // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("id").Column("*").From("Channels").Where(sq.Eq{"Id": "id"})                           // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("id").Column("*").Column("name").From("Channels").Where(sq.Eq{"Id": "id"})            // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("id").Column("name").Column("*").From("Channels").Where(sq.Eq{"Id": "id"})            // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("*").From("Channels").Where(sq.Eq{"Id": "id"})                                       // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("id", "*").From("Channels").Where(sq.Eq{"Id": "id"})                                 // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("id", "*", "name").From("Channels").Where(sq.Eq{"Id": "id"})                         // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("id", "name", "*").From("Channels").Where(sq.Eq{"Id": "id"})                         // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("id", "name").From("Channels").Where(sq.Eq{"Id": s.getBuilder().Select("*").From("ValidIds")}) // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("*", "count(*)").From("Channels")                                                              // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("count(*)").Column("*").From("Channels")                                              // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("count(*)", "*").From("Channels")                                                    // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("c.*").From("Channels c")                                                                      // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select("Channels.*").From("Channels")                                                                 // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Column("c.*").From("Channels c")                                                             // want `do not use SELECT \*: explicitly select the needed columns instead`
	s.getBuilder().Select().Columns("Channels.*").From("Channels")                                                       // want `do not use SELECT \*: explicitly select the needed columns instead`

	// These should not trigger warnings for Select function
	s.getBuilder().Select("").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select("id", "name").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select("id", "name", "email").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Column("").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Column("id").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Column("id").Column("name").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Columns("").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Columns("id").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select().Columns("id", "name").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select("id", "name").From("Channels").Where(sq.Eq{"Id": s.getBuilder().Select("Id").From("ValidIds")})
	s.getBuilder().Select("COUNT(*)").From("Channels")
	s.getBuilder().Select("COUNT( * )").From("Channels")
	s.getBuilder().Select("id", "COUNT(*)").From("Channels")
	s.getBuilder().Select().Column("COUNT(*)").From("Channels")
	s.getBuilder().Select().Columns("id", "COUNT(*)").From("Channels")
	s.getBuilder().Select("Count(*)").From("Channels")
	s.getBuilder().Select("coUNt( * )").From("Channels")
	s.getBuilder().Select("id", "CoUnT(*)").From("Channels")
	s.getBuilder().Select().Column("cOuNt(*)").From("Channels")
	s.getBuilder().Select().Columns("id", "COunt(*)").From("Channels")
}
