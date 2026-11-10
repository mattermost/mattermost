package squirrel

type StatementBuilderType struct{}

var StatementBuilder StatementBuilderType

func (s StatementBuilderType) PlaceholderFormat(format interface{}) StatementBuilderType {
	return StatementBuilderType{}
}

func (s StatementBuilderType) Select(columns ...string) StatementBuilderType {
	return StatementBuilderType{}
}

func (s StatementBuilderType) From(table string) StatementBuilderType {
	return StatementBuilderType{}
}

func (s StatementBuilderType) Where(pred interface{}) StatementBuilderType {
	return StatementBuilderType{}
}

func (s StatementBuilderType) Column(column string) StatementBuilderType {
	return StatementBuilderType{}
}

func (s StatementBuilderType) Columns(columns ...string) StatementBuilderType {
	return StatementBuilderType{}
}

type Eq map[string]interface{}
