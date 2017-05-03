package dynamodb

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

type COP string
type msi map[string]interface{}
type UntypedQuery struct {
	buffer msi
	table  *Table
}

const (
	COP_AND COP = "AND"
	COP_OR  COP = "OR"
)

func NewEmptyQuery() *UntypedQuery {
	return &UntypedQuery{msi{}, nil}
}

func NewQuery(t *Table) *UntypedQuery {
	q := &UntypedQuery{msi{}, t}
	q.addTable(t)
	return q
}

// This way of specifing the key is used when doing a Get.
// If rangeKey is "", it is assumed to not want to be used
func (q *UntypedQuery) AddKey(key *Key) error {
	if q.table == nil {
		return errors.New("Table is nil")
	}
	k := q.table.Key
	keymap := msi{
		k.KeyAttribute.Name: msi{
			k.KeyAttribute.Type: key.HashKey},
	}
	if k.HasRange() {
		keymap[k.RangeAttribute.Name] = msi{k.RangeAttribute.Type: key.RangeKey}
	}

	q.buffer["Key"] = keymap
	return nil
}

func (q *UntypedQuery) AddExclusiveStartKey(key StartKey) error {
	if q.table == nil {
		return errors.New("Table is nil")
	}
	q.buffer["ExclusiveStartKey"] = key
	return nil
}

func (q *UntypedQuery) AddExclusiveStartTableName(table string) error {
	if table != "" {
		q.buffer["ExclusiveStartTableName"] = table
	}
	return nil
}

func keyAttributes(t *Table, key *Key) msi {
	k := t.Key

	out := msi{}
	out[k.KeyAttribute.Name] = msi{k.KeyAttribute.Type: key.HashKey}
	if k.HasRange() {
		out[k.RangeAttribute.Name] = msi{k.RangeAttribute.Type: key.RangeKey}
	}
	return out
}

func (q *UntypedQuery) AddAttributesToGet(attributes []string) {
	if len(attributes) == 0 {
		return
	}

	q.buffer["AttributesToGet"] = attributes
}

func (q *UntypedQuery) SetConsistentRead(c bool) error {
	if c == true {
		q.buffer["ConsistentRead"] = "true" //String "true", not bool true
	}
	return nil
}

func (q *UntypedQuery) SetConditionalOperator(op COP) {
	q.buffer["ConditionalOperator"] = string(op)
}

func (q *UntypedQuery) AddGetRequestItems(tableKeys map[*Table][]Key) {
	requestitems := msi{}
	for table, keys := range tableKeys {
		keyslist := []msi{}
		for _, key := range keys {
			keyslist = append(keyslist, keyAttributes(table, &key))
		}
		requestitems[table.Name] = msi{"Keys": keyslist}
	}
	q.buffer["RequestItems"] = requestitems
}

func (q *UntypedQuery) AddWriteRequestItems(tableItems map[*Table]map[string][][]Attribute) {
	b := q.buffer

	b["RequestItems"] = func() msi {
		out := msi{}
		for table, itemActions := range tableItems {
			out[table.Name] = func() interface{} {
				out2 := []interface{}{}

				// here breaks an order of array....
				// For now, we iterate over sorted key by action for stable testing
				keys := []string{}
				for k := range itemActions {
					keys = append(keys, k)
				}
				sort.Strings(keys)

				for ki := range keys {
					action := keys[ki]
					items := itemActions[action]
					for _, attributes := range items {
						Item_or_Key := map[bool]string{true: "Item", false: "Key"}[action == "Put"]
						out2 = append(out2, msi{action + "Request": msi{Item_or_Key: attributeList(attributes)}})
					}
				}
				return out2
			}()
		}
		return out
	}()
}

func (q *UntypedQuery) AddCreateRequestTable(description TableDescriptionT) {
	b := q.buffer

	attDefs := []interface{}{}
	for _, attr := range description.AttributeDefinitions {
		attDefs = append(attDefs, msi{
			"AttributeName": attr.Name,
			"AttributeType": attr.Type,
		})
	}
	b["AttributeDefinitions"] = attDefs
	b["KeySchema"] = description.KeySchema
	b["TableName"] = description.TableName
	b["ProvisionedThroughput"] = msi{
		"ReadCapacityUnits":  int(description.ProvisionedThroughput.ReadCapacityUnits),
		"WriteCapacityUnits": int(description.ProvisionedThroughput.WriteCapacityUnits),
	}

	localSecondaryIndexes := []interface{}{}

	for _, ind := range description.LocalSecondaryIndexes {
		localSecondaryIndexes = append(localSecondaryIndexes, msi{
			"IndexName":  ind.IndexName,
			"KeySchema":  ind.KeySchema,
			"Projection": ind.Projection,
		})
	}

	if len(localSecondaryIndexes) > 0 {
		b["LocalSecondaryIndexes"] = localSecondaryIndexes
	}

	globalSecondaryIndexes := []interface{}{}

	for _, ind := range description.GlobalSecondaryIndexes {
		globalSecondaryIndexes = append(globalSecondaryIndexes, msi{
			"IndexName":  ind.IndexName,
			"KeySchema":  ind.KeySchema,
			"Projection": ind.Projection,
			"ProvisionedThroughput": msi{
				"ReadCapacityUnits":  int(ind.ProvisionedThroughput.ReadCapacityUnits),
				"WriteCapacityUnits": int(ind.ProvisionedThroughput.WriteCapacityUnits),
			},
		})
	}

	if len(globalSecondaryIndexes) > 0 {
		b["GlobalSecondaryIndexes"] = globalSecondaryIndexes
	}
}

func (q *UntypedQuery) AddDeleteRequestTable(description TableDescriptionT) {
	b := q.buffer
	b["TableName"] = description.TableName
}

func (q *UntypedQuery) AddKeyConditions(comparisons []AttributeComparison) {
	q.buffer["KeyConditions"] = buildComparisons(comparisons)
}

func (q *UntypedQuery) AddQueryFilter(comparisons []AttributeComparison) {
	q.buffer["QueryFilter"] = buildComparisons(comparisons)
}

func (q *UntypedQuery) AddLimit(limit int64) {
	q.buffer["Limit"] = limit
}

func (q *UntypedQuery) AddSelect(value string) {
	q.buffer["Select"] = value
}

func (q *UntypedQuery) AddIndex(value string) {
	q.buffer["IndexName"] = value
}

func (q *UntypedQuery) AddScanIndexForward(val bool) {
	if val {
		q.buffer["ScanIndexForward"] = "true"
	} else {
		q.buffer["ScanIndexForward"] = "false"
	}
}

/*
   "ScanFilter":{
       "AttributeName1":{"AttributeValueList":[{"S":"AttributeValue"}],"ComparisonOperator":"EQ"}
   },
*/
func (q *UntypedQuery) AddScanFilter(comparisons []AttributeComparison) {
	q.buffer["ScanFilter"] = buildComparisons(comparisons)
}

func (q *UntypedQuery) AddParallelScanConfiguration(segment int, totalSegments int) {
	q.buffer["Segment"] = segment
	q.buffer["TotalSegments"] = totalSegments
}

func buildComparisons(comparisons []AttributeComparison) msi {
	out := msi{}

	for _, c := range comparisons {
		avlist := []interface{}{}
		for _, attributeValue := range c.AttributeValueList {
			avlist = append(avlist, msi{attributeValue.Type: attributeValue.Value})
		}
		out[c.AttributeName] = msi{
			"AttributeValueList": avlist,
			"ComparisonOperator": c.ComparisonOperator,
		}
	}

	return out
}

// The primary key must be included in attributes.
func (q *UntypedQuery) AddItem(attributes []Attribute) {
	q.buffer["Item"] = attributeList(attributes)
}

// New syntax for conditions, filtering, and projection:
// http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.html
// Replaces the legacy conditional parameters:
// http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.html
//
// Note that some DynamoDB actions can take two kinds of expression;
// for example, UpdateItem can have both a ConditionalExpression and UpdateExpression,
// while Scan can have both a FilterExpression and ProjectionExpression,
// so the Add*Expression() functions need to share the ExpressionAttributeNames
// and ExpressionAttribute values query attributes.
type Expression struct {
	Text            string
	AttributeNames  map[string]string
	AttributeValues []Attribute
}

func (q *UntypedQuery) addExpressionAttributeNames(e *Expression) {
	expressionAttributeNames := msi{}
	if existing, ok := q.buffer["ExpressionAttributeNames"]; ok {
		for k, v := range existing.(msi) {
			expressionAttributeNames[k] = v
		}
	}
	for k, v := range e.AttributeNames {
		expressionAttributeNames[k] = v
	}
	if len(expressionAttributeNames) > 0 {
		q.buffer["ExpressionAttributeNames"] = expressionAttributeNames
	}
}

func (q *UntypedQuery) addExpressionAttributeValues(e *Expression) {
	expressionAttributeValues := msi{}
	if existing, ok := q.buffer["ExpressionAttributeValues"]; ok {
		for k, v := range existing.(msi) {
			expressionAttributeValues[k] = v
		}
	}
	for k, v := range attributeList(e.AttributeValues) {
		expressionAttributeValues[k] = v
	}
	if len(expressionAttributeValues) > 0 {
		q.buffer["ExpressionAttributeValues"] = expressionAttributeValues
	}
}

func (q *UntypedQuery) AddConditionExpression(e *Expression) {
	q.buffer["ConditionExpression"] = e.Text
	q.addExpressionAttributeNames(e)
	q.addExpressionAttributeValues(e)
}

func (q *UntypedQuery) AddFilterExpression(e *Expression) {
	q.buffer["FilterExpression"] = e.Text
	q.addExpressionAttributeNames(e)
	q.addExpressionAttributeValues(e)
}

func (q *UntypedQuery) AddProjectionExpression(e *Expression) {
	q.buffer["ProjectionExpression"] = e.Text
	q.addExpressionAttributeNames(e)
	// projection expressions don't have expression attribute values
}

func (q *UntypedQuery) AddUpdateExpression(e *Expression) {
	q.buffer["UpdateExpression"] = e.Text
	q.addExpressionAttributeNames(e)
	q.addExpressionAttributeValues(e)
}

func (q *UntypedQuery) AddUpdates(attributes []Attribute, action string) {
	// You can't mix expressions and older mechanisms,
	// so this reimplements AttributeUpdates using UpdateExpression.
	e := &Expression{
		AttributeNames: map[string]string{},
	}
	sections := map[string][]string{
		"SET":    []string{},
		"ADD":    []string{},
		"DELETE": []string{},
		"REMOVE": []string{},
	}
	attrIndex := 0
	for _, a := range attributes {
		namePlaceholder := fmt.Sprintf("#Updates%d", attrIndex)
		valuePlaceholder := fmt.Sprintf(":Updates%d", attrIndex)
		attrIndex++

		e.AttributeNames[namePlaceholder] = a.Name
		renamedAttr := a
		renamedAttr.Name = valuePlaceholder

		section := ""
		update := ""
		switch action {
		case "PUT":
			section = "SET"
			update = fmt.Sprintf("%s=%s", namePlaceholder, valuePlaceholder)
			e.AttributeValues = append(e.AttributeValues, renamedAttr)
		case "ADD":
			section = "ADD"
			update = fmt.Sprintf("%s %s", namePlaceholder, valuePlaceholder)
			e.AttributeValues = append(e.AttributeValues, renamedAttr)
		case "DELETE":
			if a.SetType() {
				section = "DELETE"
				update = fmt.Sprintf("%s %s", namePlaceholder, valuePlaceholder)
				e.AttributeValues = append(e.AttributeValues, renamedAttr)
			} else {
				section = "REMOVE"
				update = namePlaceholder
			}
		default:
			panic("Unsupported action: " + action)
		}
		sections[section] = append(sections[section], update)
	}
	sectionText := []string{}
	for section, updates := range sections {
		if len(updates) > 0 {
			sectionText = append(sectionText, fmt.Sprintf("%s %s", section, strings.Join(updates, ", ")))
		}
	}
	e.Text = strings.Join(sectionText, " ")
	q.AddUpdateExpression(e)
}

func (q *UntypedQuery) AddExpected(attributes []Attribute) {
	// You can't mix expressions and older mechanisms,
	// so this reimplements Expected using ConditionExpression.
	e := &Expression{
		AttributeNames: map[string]string{},
	}
	terms := []string{}
	attrIndex := 0
	for _, a := range attributes {
		namePlaceholder := fmt.Sprintf("#Expected%d", attrIndex)
		valuePlaceholder := fmt.Sprintf(":Expected%d", attrIndex)
		attrIndex++
		e.AttributeNames[namePlaceholder] = a.Name

		term := ""
		if a.Exists == "false" {
			term = fmt.Sprintf("attribute_not_exists (%s)", namePlaceholder)
		} else {
			term = fmt.Sprintf("%s = %s", namePlaceholder, valuePlaceholder)
			renamedAttr := a
			renamedAttr.Name = valuePlaceholder
			e.AttributeValues = append(e.AttributeValues, renamedAttr)
		}
		terms = append(terms, term)
	}
	e.Text = strings.Join(terms, " AND ")
	q.AddConditionExpression(e)
}

func attributeList(attributes []Attribute) msi {
	b := msi{}
	for _, a := range attributes {
		b[a.Name] = a.valueMsi()
	}
	return b
}

func (q *UntypedQuery) addTable(t *Table) {
	q.addTableByName(t.Name)
}

func (q *UntypedQuery) addTableByName(tableName string) {
	q.buffer["TableName"] = tableName
}

func (q *UntypedQuery) Marshal() ([]byte, error) {
	return json.Marshal(q.buffer)
}

func (q *UntypedQuery) String() string {
	bytes, _ := q.Marshal()
	return string(bytes)
}
