package sqlstore

import (
	"fmt"
	"strings"
)

const (
	ActionUpdate = "UPDATE"
	ActionDelete = "DELETE"
)

type SqlBuilder struct {
	action          string
	table           string
	setStatements   []string
	whereConditions []string
	bindings        map[string]interface{}
}

func NewSqlBuilder() *SqlBuilder {
	return &SqlBuilder{
		bindings: make(map[string]interface{}),
	}
}

func (s *SqlBuilder) Delete(table string) *SqlBuilder {
	s.action = ActionUpdate
	s.table = table

	return s
}

func (s *SqlBuilder) Update(table string) *SqlBuilder {
	s.action = ActionUpdate
	s.table = table

	return s
}

func (s *SqlBuilder) Set(field string, value interface{}) *SqlBuilder {
	s.setStatements = append(s.setStatements, fmt.Sprintf("%s = :%s", field, field))
	s.Bind(field, value)

	return s
}

func (s *SqlBuilder) SetAll(fields map[string]interface{}) *SqlBuilder {
	for field, value := range fields {
		s.Set(field, value)
	}

	return s
}

func (s *SqlBuilder) Where(field string, value interface{}) *SqlBuilder {
	s.whereConditions = append(s.whereConditions, fmt.Sprintf("%s = :%s", field, field))
	s.Bind(field, value)

	return s
}

func (s *SqlBuilder) WhereAll(expressions map[string]interface{}) *SqlBuilder {
	for field, value := range expressions {
		s.Where(field, value)
	}

	return s
}

func (s *SqlBuilder) Bind(key string, value interface{}) *SqlBuilder {
	s.bindings[key] = value

	return s
}

func (s *SqlBuilder) String() string {
	var result = []string{}

	switch s.action {
	case ActionUpdate:
		result = append(result, ActionUpdate)
		result = append(result, s.table)
		result = append(result, "SET")

		result = append(result, strings.Join(s.setStatements, ","))
		for i, whereCondition := range s.whereConditions {
			if i == 0 {
				result = append(result, "WHERE")
			} else {
				result = append(result, "AND")
			}

			result = append(result, whereCondition)
		}
	case ActionDelete:
		result = append(result, ActionUpdate)
		result = append(result, "FROM")
		result = append(result, s.table)
		for i, whereCondition := range s.whereConditions {
			if i == 0 {
				result = append(result, "WHERE")
			} else {
				result = append(result, "AND")
			}

			result = append(result, whereCondition)
		}
	}

	return strings.Join(result, " ")
}

func (s *SqlBuilder) Bindings() map[string]interface{} {
	return s.bindings
}
