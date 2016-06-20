package dynamodb

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"

	simplejson "github.com/bitly/go-simplejson"
)

type Stream struct {
	Server *Server
	Arn    string
}

type StreamListItemT struct {
	StreamArn   string
	StreamLabel string
	TableName   string
}

type SequenceNumberRangeT struct {
	EndingSequenceNumber   string
	StartingSequenceNumber string
}

type ShardT struct {
	ParentShardId       string
	SequenceNumberRange SequenceNumberRangeT
	ShardId             string
}

type StreamDescriptionT struct {
	CreationDateTime     float64
	KeySchema            []KeySchemaT
	LastEvaluatedShardId string
	Shards               []ShardT
	StreamArn            string
	StreamLabel          string
	StreamStatus         string
	StreamViewType       string
	TableName            string
}

type RecordT struct {
	AwsRegion    string
	EventID      string
	EventName    string
	EventSource  string
	EventVersion string
	StreamRecord *StreamRecordT
}

type StreamRecordT struct {
	Keys           map[string]*Attribute
	NewImage       map[string]*Attribute
	OldImage       map[string]*Attribute
	SequenceNumber string
	StreamViewType string
	SizeBytes      int64
}

type listStreamsResponse struct {
	Streams []StreamListItemT
}

type describeStreamResponse struct {
	StreamDescription StreamDescriptionT
}

var ErrNoRecords = errors.New("No records")

func (s *Server) ListStreams(startArn string) ([]StreamListItemT, error) {
	return s.LimitedListTableStreams("", startArn, 0)
}

func (s *Server) LimitedListStreams(startArn string, limit int64) ([]StreamListItemT, error) {
	return s.LimitedListTableStreams("", startArn, limit)
}

func (s *Server) ListTableStreams(table, startArn string) ([]StreamListItemT, error) {
	return s.LimitedListTableStreams(table, startArn, 0)
}

func (s *Server) LimitedListTableStreams(table, startArn string, limit int64) ([]StreamListItemT, error) {
	query := NewEmptyQuery()

	if len(table) != 0 {
		query.addTableByName(table)
	}

	if len(startArn) != 0 {
		query.AddExclusiveStartStreamArn(startArn)
	}

	if limit > 0 {
		query.AddLimit(limit)
	}

	jsonResponse, err := s.queryServer(streamsTarget("ListStreams"), query)
	if err != nil {
		return nil, err
	}

	var r listStreamsResponse
	err = json.Unmarshal(jsonResponse, &r)
	if err != nil {
		return nil, err
	}

	return r.Streams, nil
}

func (s *Server) DescribeStream(arn, startShardId string) (*StreamDescriptionT, error) {
	return s.LimitedDescribeStream(arn, startShardId, 0)
}

func (s *Server) LimitedDescribeStream(arn, startShardId string, limit int64) (*StreamDescriptionT, error) {
	query := NewEmptyQuery()
	query.AddStreamArn(arn)

	if len(startShardId) != 0 {
		query.AddExclusiveStartShardId(startShardId)
	}

	if limit > 0 {
		query.AddLimit(limit)
	}

	jsonResponse, err := s.queryServer(streamsTarget("DescribeStream"), query)
	if err != nil {
		return nil, err
	}

	var r describeStreamResponse
	err = json.Unmarshal(jsonResponse, &r)
	if err != nil {
		return nil, err
	}

	return &r.StreamDescription, nil
}

func (s *Server) NewStream(streamArn string) *Stream {
	return &Stream{s, streamArn}
}

func (s *Stream) DescribeStream(startShardId string) (*StreamDescriptionT, error) {
	return s.Server.DescribeStream(s.Arn, startShardId)
}

func (s *Stream) LimitedDescribeStream(startShardId string, limit int64) (*StreamDescriptionT, error) {
	return s.Server.LimitedDescribeStream(s.Arn, startShardId, limit)
}

func (s *Server) GetShardIterator(streamArn, shardId, shardIteratorType, sequenceNumber string) (string, error) {
	query := NewEmptyQuery()
	query.AddStreamArn(streamArn)
	query.AddShardId(shardId)
	query.AddShardIteratorType(shardIteratorType)

	if len(sequenceNumber) != 0 {
		query.AddSequenceNumber(sequenceNumber)
	}

	jsonResponse, err := s.queryServer(streamsTarget("GetShardIterator"), query)

	if err != nil {
		return "unknown", err
	}

	json, err := simplejson.NewJson(jsonResponse)

	if err != nil {
		return "unknown", err
	}

	return json.Get("ShardIterator").MustString(), nil
}

func (s *Stream) GetShardIterator(shardId, shardIteratorType, sequenceNumber string) (string, error) {
	return s.Server.GetShardIterator(s.Arn, shardId, shardIteratorType, sequenceNumber)
}

func (s *Server) GetRecords(shardIterator string) (string, []*RecordT, error) {
	return s.LimitedGetRecords(shardIterator, 0)
}

func (s *Server) LimitedGetRecords(shardIterator string, limit int64) (string, []*RecordT, error) {
	query := NewEmptyQuery()
	query.AddShardIterator(shardIterator)

	if limit > 0 {
		query.AddLimit(limit)
	}

	jsonResponse, err := s.queryServer(streamsTarget("GetRecords"), query)
	if err != nil {
		return "", nil, err
	}

	jsonParsed, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return "", nil, err
	}

	nextShardIt := ""
	nextShardItJson, ok := jsonParsed.CheckGet("NextShardIterator")
	if ok {
		nextShardIt, err = nextShardItJson.String()
		if err != nil {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return "", nil, errors.New(message)
		}
	}

	recordsJson, ok := jsonParsed.CheckGet("Records")
	if !ok {
		return nextShardIt, nil, ErrNoRecords
	}

	recordsArray, err := recordsJson.Array()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nextShardIt, nil, errors.New(message)
	}

	var records []*RecordT
	for _, record := range recordsArray {
		if recordMap, ok := record.(map[string]interface{}); ok {
			r := parseRecord(recordMap)
			records = append(records, r)
		}
	}

	return nextShardIt, records, nil
}

func (s *Stream) GetRecords(shardIterator string) (string, []*RecordT, error) {
	return s.Server.GetRecords(shardIterator)
}

func (s *Stream) LimitedGetRecords(shardIterator string, limit int64) (string, []*RecordT, error) {
	return s.Server.LimitedGetRecords(shardIterator, limit)
}

func parseRecord(r map[string]interface{}) *RecordT {
	record := RecordT{}
	rValue := reflect.ValueOf(&record)

	keys := []string{"awsRegion", "eventID", "eventName", "eventSource", "eventVersion"}
	for i, key := range keys {
		if value, ok := r[key]; ok {
			if valueStr, ok := value.(string); ok {
				rValue.Elem().Field(i).SetString(valueStr)
			}
		}
	}

	if streamRecord, ok := r["dynamodb"]; ok {
		if streamRecordMap, ok := streamRecord.(map[string]interface{}); ok {
			record.StreamRecord = parseStreamRecord(streamRecordMap)
		}
	}

	return &record
}

func parseStreamRecord(s map[string]interface{}) *StreamRecordT {
	sr := StreamRecordT{}
	rValue := reflect.ValueOf(&sr)

	attrKeys := []string{"Keys", "NewImage", "OldImage"}
	numAttrKeys := len(attrKeys)
	for i, key := range attrKeys {
		if value, ok := s[key]; ok {
			if valueMap, ok := value.(map[string]interface{}); ok {
				attrs := parseAttributes(valueMap)
				rValue.Elem().Field(i).Set(reflect.ValueOf(attrs))
			}
		}
	}

	strKeys := []string{"SequenceNumber", "StreamViewType"}
	numStrKeys := len(strKeys)
	for i, key := range strKeys {
		if value, ok := s[key]; ok {
			if valueStr, ok := value.(string); ok {
				rValue.Elem().Field(i + numAttrKeys).SetString(valueStr)
			}
		}
	}

	intKeys := []string{"SizeBytes"}
	for i, key := range intKeys {
		if value, ok := s[key]; ok {
			if valueNumber, ok := value.(json.Number); ok {
				if valueInt, err := valueNumber.Int64(); err == nil {
					rValue.Elem().Field(i + numAttrKeys + numStrKeys).SetInt(valueInt)
				}
			}
		}
	}

	return &sr
}
