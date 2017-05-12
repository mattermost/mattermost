package s3_test

var PutCopyResultDump = `
<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult>
  <LastModified>2009-10-28T22:32:00</LastModified>
  <ETag>&quot;9b2cf535f27731c974343645a3985328&quot;</ETag>
</CopyObjectResult>
`

var GetObjectErrorDump = `
<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message>
<BucketName>non-existent-bucket</BucketName><RequestId>3F1B667FAD71C3D8</RequestId>
<HostId>L4ee/zrm1irFXY5F45fKXIRdOf9ktsKY/8TDVawuMK2jWRb1RF84i1uBzkdNqS5D</HostId></Error>
`

var GetListResultDump1 = `
<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01">
  <Name>quotes</Name>
  <Prefix>N</Prefix>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>Nelson</Key>
    <LastModified>2006-01-01T12:00:00.000Z</LastModified>
    <ETag>&quot;828ef3fdfa96f00ad9f27c383fc9ac7f&quot;</ETag>
    <Size>5</Size>
    <StorageClass>STANDARD</StorageClass>
    <Owner>
      <ID>bcaf161ca5fb16fd081034f</ID>
      <DisplayName>webfile</DisplayName>
     </Owner>
  </Contents>
  <Contents>
    <Key>Neo</Key>
    <LastModified>2006-01-01T12:00:00.000Z</LastModified>
    <ETag>&quot;828ef3fdfa96f00ad9f27c383fc9ac7f&quot;</ETag>
    <Size>4</Size>
    <StorageClass>STANDARD</StorageClass>
     <Owner>
      <ID>bcaf1ffd86a5fb16fd081034f</ID>
      <DisplayName>webfile</DisplayName>
    </Owner>
 </Contents>
</ListBucketResult>
`

var GetListResultDump2 = `
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>example-bucket</Name>
  <Prefix>photos/2006/</Prefix>
  <Marker>some-marker</Marker>
  <MaxKeys>1000</MaxKeys>
  <Delimiter>/</Delimiter>
  <IsTruncated>false</IsTruncated>

  <CommonPrefixes>
    <Prefix>photos/2006/feb/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>photos/2006/jan/</Prefix>
  </CommonPrefixes>
</ListBucketResult>
`

var InitMultiResultDump = `
<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>sample</Bucket>
  <Key>multi</Key>
  <UploadId>JNbR_cMdwnGiD12jKAd6WK2PUkfj2VxA7i4nCwjE6t71nI9Tl3eVDPFlU0nOixhftH7I17ZPGkV3QA.l7ZD.QQ--</UploadId>
</InitiateMultipartUploadResult>
`

var ListPartsResultDump1 = `
<?xml version="1.0" encoding="UTF-8"?>
<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>sample</Bucket>
  <Key>multi</Key>
  <UploadId>JNbR_cMdwnGiD12jKAd6WK2PUkfj2VxA7i4nCwjE6t71nI9Tl3eVDPFlU0nOixhftH7I17ZPGkV3QA.l7ZD.QQ--</UploadId>
  <Initiator>
    <ID>bb5c0f63b0b25f2d099c</ID>
    <DisplayName>joe</DisplayName>
  </Initiator>
  <Owner>
    <ID>bb5c0f63b0b25f2d099c</ID>
    <DisplayName>joe</DisplayName>
  </Owner>
  <StorageClass>STANDARD</StorageClass>
  <PartNumberMarker>0</PartNumberMarker>
  <NextPartNumberMarker>2</NextPartNumberMarker>
  <MaxParts>2</MaxParts>
  <IsTruncated>true</IsTruncated>
  <Part>
    <PartNumber>1</PartNumber>
    <LastModified>2013-01-30T13:45:51.000Z</LastModified>
    <ETag>&quot;ffc88b4ca90a355f8ddba6b2c3b2af5c&quot;</ETag>
    <Size>5</Size>
  </Part>
  <Part>
    <PartNumber>2</PartNumber>
    <LastModified>2013-01-30T13:45:52.000Z</LastModified>
    <ETag>&quot;d067a0fa9dc61a6e7195ca99696b5a89&quot;</ETag>
    <Size>5</Size>
  </Part>
</ListPartsResult>
`

var ListPartsResultDump2 = `
<?xml version="1.0" encoding="UTF-8"?>
<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>sample</Bucket>
  <Key>multi</Key>
  <UploadId>JNbR_cMdwnGiD12jKAd6WK2PUkfj2VxA7i4nCwjE6t71nI9Tl3eVDPFlU0nOixhftH7I17ZPGkV3QA.l7ZD.QQ--</UploadId>
  <Initiator>
    <ID>bb5c0f63b0b25f2d099c</ID>
    <DisplayName>joe</DisplayName>
  </Initiator>
  <Owner>
    <ID>bb5c0f63b0b25f2d099c</ID>
    <DisplayName>joe</DisplayName>
  </Owner>
  <StorageClass>STANDARD</StorageClass>
  <PartNumberMarker>2</PartNumberMarker>
  <NextPartNumberMarker>3</NextPartNumberMarker>
  <MaxParts>2</MaxParts>
  <IsTruncated>false</IsTruncated>
  <Part>
    <PartNumber>3</PartNumber>
    <LastModified>2013-01-30T13:46:50.000Z</LastModified>
    <ETag>&quot;49dcd91231f801159e893fb5c6674985&quot;</ETag>
    <Size>5</Size>
  </Part>
</ListPartsResult>
`

var ListMultiResultDump = `
<?xml version="1.0"?>
<ListMultipartUploadsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>goamz-test-bucket-us-east-1-akiajk3wyewhctyqbf7a</Bucket>
  <KeyMarker/>
  <UploadIdMarker/>
  <NextKeyMarker>multi1</NextKeyMarker>
  <NextUploadIdMarker>iUVug89pPvSswrikD72p8uO62EzhNtpDxRmwC5WSiWDdK9SfzmDqe3xpP1kMWimyimSnz4uzFc3waVM5ufrKYQ--</NextUploadIdMarker>
  <Delimiter>/</Delimiter>
  <MaxUploads>1000</MaxUploads>
  <IsTruncated>false</IsTruncated>
  <Upload>
    <Key>multi1</Key>
    <UploadId>iUVug89pPvSswrikD</UploadId>
    <Initiator>
      <ID>bb5c0f63b0b25f2d0</ID>
      <DisplayName>gustavoniemeyer</DisplayName>
    </Initiator>
    <Owner>
      <ID>bb5c0f63b0b25f2d0</ID>
      <DisplayName>gustavoniemeyer</DisplayName>
    </Owner>
    <StorageClass>STANDARD</StorageClass>
    <Initiated>2013-01-30T18:15:47.000Z</Initiated>
  </Upload>
  <Upload>
    <Key>multi2</Key>
    <UploadId>DkirwsSvPp98guVUi</UploadId>
    <Initiator>
      <ID>bb5c0f63b0b25f2d0</ID>
      <DisplayName>joe</DisplayName>
    </Initiator>
    <Owner>
      <ID>bb5c0f63b0b25f2d0</ID>
      <DisplayName>joe</DisplayName>
    </Owner>
    <StorageClass>STANDARD</StorageClass>
    <Initiated>2013-01-30T18:15:47.000Z</Initiated>
  </Upload>
  <CommonPrefixes>
    <Prefix>a/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>b/</Prefix>
  </CommonPrefixes>
</ListMultipartUploadsResult>
`

var NoSuchUploadErrorDump = `
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchUpload</Code>
  <Message>Not relevant</Message>
  <BucketName>sample</BucketName>
  <RequestId>3F1B667FAD71C3D8</RequestId>
  <HostId>kjhwqk</HostId>
</Error>
`

var MultiCompleteDump = `
<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Location>http://Example-Bucket.s3.amazonaws.com/Example-Object</Location>
  <Bucket>Example-Bucket</Bucket>
  <Key>Example-Object</Key>
  <ETag>"3858f62230ac3c915f300c664312c11f-9"</ETag>
</CompleteMultipartUploadResult>
`

var InternalErrorDump = `
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InternalError</Code>
  <Message>Not relevant</Message>
  <BucketName>sample</BucketName>
  <RequestId>3F1B667FAD71C3D8</RequestId>
  <HostId>kjhwqk</HostId>
</Error>
`

var GetServiceDump = `
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01">
  <Owner>
    <ID>bcaf1ffd86f461ca5fb16fd081034f</ID>
    <DisplayName>webfile</DisplayName>
  </Owner>
  <Buckets>
    <Bucket>
      <Name>quotes</Name>
      <CreationDate>2006-02-03T16:45:09.000Z</CreationDate>
    </Bucket>
    <Bucket>
      <Name>samples</Name>
      <CreationDate>2006-02-03T16:41:58.000Z</CreationDate>
    </Bucket>
  </Buckets>
</ListAllMyBucketsResult>
`

var GetLocationUsStandard = `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>
`

var GetLocationUsWest1 = `
<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-west-1</LocationConstraint>
`

var BucketWebsiteConfigurationDump = `<?xml version="1.0" encoding="UTF-8"?>
<WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><RedirectAllRequestsTo><HostName>example.com</HostName></RedirectAllRequestsTo></WebsiteConfiguration>`
