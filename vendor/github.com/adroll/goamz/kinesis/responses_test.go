package kinesis_test

var describeStream string = `
{
  "StreamDescription": {
    "HasMoreShards": false,
    "Shards": [
      {
        "HashKeyRange": {
          "EndingHashKey": "113427455640312821154458202477256070484",
          "StartingHashKey": "0"
        },
        "SequenceNumberRange": {
          "EndingSequenceNumber": "21269319989741826081360214168359141376",
          "StartingSequenceNumber": "21267647932558653966460912964485513216"
        },
        "ShardId": "shardId-000000000000"
      },
      {
        "HashKeyRange": {
          "EndingHashKey": "226854911280625642308916404954512140969",
          "StartingHashKey": "113427455640312821154458202477256070485"
        },
        "SequenceNumberRange": {
          "StartingSequenceNumber": "21267647932558653966460912964485513217"
        },
        "ShardId": "shardId-000000000001"
      },
      {
        "HashKeyRange": {
          "EndingHashKey": "340282366920938463463374607431768211455",
          "StartingHashKey": "226854911280625642308916404954512140970"
        },
        "SequenceNumberRange": {
          "StartingSequenceNumber": "21267647932558653966460912964485513218"
        },
        "ShardId": "shardId-000000000002"
      }
    ],
    "StreamARN": "arn:aws:kinesis:us-east-1:052958737983:exampleStreamName",
    "StreamName": "exampleStreamName",
    "StreamStatus": "ACTIVE"
  }
}`

var getRecords string = `{
  "NextShardIterator": "AAAAAAAAAAHsW8zCWf9164uy8Epue6WS3w6wmj4a4USt+CNvMd6uXQ+HL5vAJMznqqC0DLKsIjuoiTi1BpT6nW0LN2M2D56zM5H8anHm30Gbri9ua+qaGgj+3XTyvbhpERfrezgLHbPB/rIcVpykJbaSj5tmcXYRmFnqZBEyHwtZYFmh6hvWVFkIwLuMZLMrpWhG5r5hzkE=",
  "Records": [
    {
      "Data": "XzxkYXRhPl8w",
      "PartitionKey": "partitionKey",
      "SequenceNumber": "21269319989652663814458848515492872193"
    }
  ] 
}`

var getShardIterator string = `{
  "ShardIterator": "AAAAAAAAAAETYyAYzd665+8e0X7JTsASDM/Hr2rSwc0X2qz93iuA3udrjTH+ikQvpQk/1ZcMMLzRdAesqwBGPnsthzU0/CBlM/U8/8oEqGwX3pKw0XyeDNRAAZyXBo3MqkQtCpXhr942BRTjvWKhFz7OmCb2Ncfr8Tl2cBktooi6kJhr+djN5WYkB38Rr3akRgCl9qaU4dY="  
}`

var listStreams string = `{
  "HasMoreStreams": false,
  "StreamNames": [
    "exampleStreamName"
  ]
}`

var putRecord string = `{
  "SequenceNumber": "21269319989653637946712965403778482177",
  "ShardId": "shardId-000000000001"
}`

var putRecords string = `{
  "FailedRecordCount": 0,
  "Records": [
    {
      "SequenceNumber": "49543463076548007577105092703039560359975228518395019266",
      "ShardId": "shardId-000000000000"
    }
  ]
}`
