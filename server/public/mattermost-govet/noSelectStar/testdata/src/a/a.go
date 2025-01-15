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

	// These should not trigger warnings
	_ = "SELECT id, name FROM users"
	_ = "Just a * by itself"
	_ = "SELECT"

	// These should trigger warnings for Select function
	var s store
	s.getBuilder().Select("*").From("Channels").Where(sq.Eq{"Id": "id"})                                                 // want `do not use SELECT \*: explicitly select the needed columns instead`
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
	s.getBuilder().Select().Columns("id", "name").From("Channels").Where(sq.Eq{"Id": "id"})
	s.getBuilder().Select("id", "name").From("Channels").Where(sq.Eq{"Id": s.getBuilder().Select("Id").From("ValidIds")})
}
