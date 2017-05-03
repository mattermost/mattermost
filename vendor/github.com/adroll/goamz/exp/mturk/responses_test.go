package mturk_test

var BasicHitResponse = `<?xml version="1.0"?>
<CreateHITResponse><OperationRequest><RequestId>643b794b-66b6-4427-bb8a-4d3df5c9a20e</RequestId></OperationRequest><HIT><Request><IsValid>True</IsValid></Request><HITId>28J4IXKO2L927XKJTHO34OCDNASCDW</HITId><HITTypeId>2XZ7D1X3V0FKQVW7LU51S7PKKGFKDF</HITTypeId></HIT></CreateHITResponse>
`

var SearchHITResponse = `<?xml version="1.0"?>
<SearchHITsResponse><OperationRequest><RequestId>38862d9c-f015-4177-a2d3-924110a9d6f2</RequestId></OperationRequest><SearchHITsResult><Request><IsValid>True</IsValid></Request><NumResults>1</NumResults><TotalNumResults>1</TotalNumResults><PageNumber>1</PageNumber><HIT><HITId>2BU26DG67D1XTE823B3OQ2JF2XWF83</HITId><HITTypeId>22OWJ5OPB0YV6IGL5727KP9U38P5XR</HITTypeId><CreationTime>2011-12-28T19:56:20Z</CreationTime><Title>test hit</Title><Description>please disregard, testing only</Description><HITStatus>Reviewable</HITStatus><MaxAssignments>1</MaxAssignments><Reward><Amount>0.01</Amount><CurrencyCode>USD</CurrencyCode><FormattedPrice>$0.01</FormattedPrice></Reward><AutoApprovalDelayInSeconds>2592000</AutoApprovalDelayInSeconds><Expiration>2011-12-28T19:56:50Z</Expiration><AssignmentDurationInSeconds>30</AssignmentDurationInSeconds><NumberOfAssignmentsPending>0</NumberOfAssignmentsPending><NumberOfAssignmentsAvailable>1</NumberOfAssignmentsAvailable><NumberOfAssignmentsCompleted>0</NumberOfAssignmentsCompleted></HIT></SearchHITsResult></SearchHITsResponse>
`

var GetAssignmentsForHITNoAnswerResponse = `<?xml version="1.0"?>
<GetAssignmentsForHITResponse><OperationRequest><RequestId>536934be-a35b-4e4e-9822-72fbf36d5862</RequestId></OperationRequest><GetAssignmentsForHITResult><Request><IsValid>True</IsValid></Request><NumResults>0</NumResults><TotalNumResults>0</TotalNumResults><PageNumber>1</PageNumber></GetAssignmentsForHITResult></GetAssignmentsForHITResponse>
`

var GetAssignmentsForHITAnswerResponse = `<?xml version="1.0"?>
<GetAssignmentsForHITResponse><OperationRequest><RequestId>2f113bdf-2e3e-4c5a-a396-3ed01384ecb9</RequestId></OperationRequest><GetAssignmentsForHITResult><Request><IsValid>True</IsValid></Request><NumResults>1</NumResults><TotalNumResults>1</TotalNumResults><PageNumber>1</PageNumber><Assignment><AssignmentId>2QKNTL0XULRGFAQWUWDD05FP94V2O3</AssignmentId><WorkerId>A1ZUQ2YDM61713</WorkerId><HITId>2W36VCPWZ9RN5DX1MBJ7VN3D6WEPAM</HITId><AssignmentStatus>Submitted</AssignmentStatus><AutoApprovalTime>2014-02-26T09:39:48Z</AutoApprovalTime><AcceptTime>2014-01-27T09:39:38Z</AcceptTime><SubmitTime>2014-01-27T09:39:48Z</SubmitTime><Answer>&lt;?xml version="1.0" encoding="UTF-8" standalone="no"?&gt;
&lt;QuestionFormAnswers xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionFormAnswers.xsd"&gt;
&lt;Answer&gt;
&lt;QuestionIdentifier&gt;tags&lt;/QuestionIdentifier&gt;
&lt;FreeText&gt;asd&lt;/FreeText&gt;
&lt;/Answer&gt;
&lt;Answer&gt;
&lt;QuestionIdentifier&gt;text_in_image&lt;/QuestionIdentifier&gt;
&lt;FreeText&gt;asd&lt;/FreeText&gt;
&lt;/Answer&gt;
&lt;Answer&gt;
&lt;QuestionIdentifier&gt;is_pattern&lt;/QuestionIdentifier&gt;
&lt;FreeText&gt;yes&lt;/FreeText&gt;
&lt;/Answer&gt;
&lt;Answer&gt;
&lt;QuestionIdentifier&gt;is_map&lt;/QuestionIdentifier&gt;
&lt;FreeText&gt;yes&lt;/FreeText&gt;
&lt;/Answer&gt;
&lt;/QuestionFormAnswers&gt;
</Answer></Assignment></GetAssignmentsForHITResult></GetAssignmentsForHITResponse>
`
