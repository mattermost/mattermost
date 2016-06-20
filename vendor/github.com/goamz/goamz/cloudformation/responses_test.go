package cloudformation_test

var CancelUpdateStackResponse = `
<CancelUpdateStackResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <CancelUpdateStackResult/>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</CancelUpdateStackResponse>
`

var CreateStackResponse = `
<CreateStackResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
<CreateStackResult>
  <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
</CreateStackResult>
 <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</CreateStackResponse>
`

var CreateStackWithInvalidParamsResponse = `
<ErrorResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <Error>
    <Type>Sender</Type>
    <Code>ValidationError</Code>
    <Message>Either Template URL or Template Body must be specified.</Message>
  </Error>
  <RequestId>70a76d42-9665-11e2-9fdf-211deEXAMPLE</RequestId>
</ErrorResponse>
`

var DeleteStackResponse = `
<DeleteStackResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <DeleteStackResult/>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</DeleteStackResponse>
`
var DescribeStackEventsResponse = `
<DescribeStackEventsResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <DescribeStackEventsResult>
    <StackEvents>
      <member>
        <EventId>Event-1-Id</EventId>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackName>MyStack</StackName>
        <LogicalResourceId>MyStack</LogicalResourceId>
        <PhysicalResourceId>MyStack_One</PhysicalResourceId>
        <ResourceType>AWS::CloudFormation::Stack</ResourceType>
        <Timestamp>2010-07-27T22:26:28Z</Timestamp>
        <ResourceStatus>CREATE_IN_PROGRESS</ResourceStatus>
        <ResourceStatusReason>User initiated</ResourceStatusReason>
      </member>
      <member>
        <EventId>Event-2-Id</EventId>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackName>MyStack</StackName>
        <LogicalResourceId>MyDBInstance</LogicalResourceId>
        <PhysicalResourceId>MyStack_DB1</PhysicalResourceId>
        <ResourceType>AWS::SecurityGroup</ResourceType>
        <Timestamp>2010-07-27T22:27:28Z</Timestamp>
        <ResourceStatus>CREATE_IN_PROGRESS</ResourceStatus>
        <ResourceProperties>{"GroupDescription":...}</ResourceProperties>
      </member>
      <member>
        <EventId>Event-3-Id</EventId>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackName>MyStack</StackName>
        <LogicalResourceId>MySG1</LogicalResourceId>
        <PhysicalResourceId>MyStack_SG1</PhysicalResourceId>
        <ResourceType>AWS::SecurityGroup</ResourceType>
        <Timestamp>2010-07-27T22:28:28Z</Timestamp>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
      </member>
    </StackEvents>
    <NextToken/>
  </DescribeStackEventsResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</DescribeStackEventsResponse>
`

var DescribeStackResourceResponse = `
<DescribeStackResourceResponse>
 <DescribeStackResourceResult>
  <StackResourceDetail>
      <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
      <StackName>MyStack</StackName>
      <LogicalResourceId>MyDBInstance</LogicalResourceId>
      <PhysicalResourceId>MyStack_DB1</PhysicalResourceId>
      <ResourceType>AWS::RDS::DBInstance</ResourceType>
      <LastUpdatedTimestamp>2011-07-07T22:27:28Z</LastUpdatedTimestamp>
      <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
  </StackResourceDetail>
 </DescribeStackResourceResult>
 <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
 </ResponseMetadata>
</DescribeStackResourceResponse>
`
var DescribeStackResourcesResponse = `
<DescribeStackResourcesResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <DescribeStackResourcesResult>
    <StackResources>
      <member>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackName>MyStack</StackName>
        <LogicalResourceId>MyDBInstance</LogicalResourceId>
        <PhysicalResourceId>MyStack_DB1</PhysicalResourceId>
        <ResourceType>AWS::DBInstance</ResourceType>
        <Timestamp>2010-07-27T22:27:28Z</Timestamp>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
      </member>
      <member>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackName>MyStack</StackName>
        <LogicalResourceId>MyAutoScalingGroup</LogicalResourceId>
        <PhysicalResourceId>MyStack_ASG1</PhysicalResourceId>
        <ResourceType>AWS::AutoScalingGroup</ResourceType>
        <Timestamp>2010-07-27T22:28:28Z</Timestamp>
        <ResourceStatus>CREATE_IN_PROGRESS</ResourceStatus>
      </member>
    </StackResources>
  </DescribeStackResourcesResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</DescribeStackResourcesResponse>
`

var DescribeStacksResponse = `
<DescribeStacksResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <DescribeStacksResult>
    <Stacks>
      <member>
        <StackName>MyStack</StackName>
        <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
        <StackStatusReason/>
        <Description>My Description</Description>
        <Capabilities>
          <member>CAPABILITY_IAM</member>
        </Capabilities>
        <NotificationARNs>
          <member>arn:aws:sns:region-name:account-name:topic-name</member>
        </NotificationARNs>
        <Parameters>
          <member>
            <ParameterValue>MyValue</ParameterValue>
            <ParameterKey>MyKey</ParameterKey>
          </member>
        </Parameters>
        <Tags>
          <member>
            <Key>MyTagKey</Key>
            <Value>MyTagValue</Value>
          </member>
        </Tags>
        <CreationTime>2010-07-27T22:28:28Z</CreationTime>
        <StackStatus>CREATE_COMPLETE</StackStatus>
        <DisableRollback>false</DisableRollback>
        <Outputs>
          <member>
            <Description>ServerUrl</Description>
            <OutputKey>StartPage</OutputKey>
            <OutputValue>http://my-load-balancer.amazonaws.com:80/index.html</OutputValue>
          </member>
        </Outputs>
      </member>
    </Stacks>
    <NextToken/>
  </DescribeStacksResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</DescribeStacksResponse>
`

var EstimateTemplateCostResponse = `
<EstimateTemplateCostResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <EstimateTemplateCostResult>
    <Url>http://calculator.s3.amazonaws.com/calc5.html?key=cf-2e351785-e821-450c-9d58-625e1e1ebfb6</Url>
  </EstimateTemplateCostResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</EstimateTemplateCostResponse>
`

var GetStackPolicyResponse = `
<GetStackPolicyResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
    <GetStackPolicyResult>
      <StackPolicyBody>{
      "Statement" : [
        {
          "Effect" : "Deny",
          "Action" : "Update:*",
          "Principal" : "*",
          "Resource" : "LogicalResourceId/ProductionDatabase"
        },
        {
          "Effect" : "Allow",
          "Action" : "Update:*",
          "Principal" : "*",
          "Resource" : "*"
        }
      ]
    }</StackPolicyBody>
  </GetStackPolicyResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</GetStackPolicyResponse>
`

var GetTemplateResponse = `
<GetTemplateResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
    <GetTemplateResult>
      <TemplateBody>{
      "AWSTemplateFormatVersion" : "2010-09-09",
      "Description" : "Simple example",
      "Resources" : {
        "MySQS" : {
           "Type" : "AWS::SQS::Queue",
           "Properties" : {
            }
         }
        }
      }</TemplateBody>
    </GetTemplateResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</GetTemplateResponse>
`

var ListStackResourcesResponse = `
<ListStackResourcesResponse>
  <ListStackResourcesResult>
    <StackResourceSummaries>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>DBSecurityGroup</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:15:58Z</LastUpdatedTimestamp>
        <PhysicalResourceId>gmarcteststack-dbsecuritygroup-1s5m0ez5lkk6w</PhysicalResourceId>
        <ResourceType>AWS::RDS::DBSecurityGroup</ResourceType>
      </member>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>SampleDB</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:25:57Z</LastUpdatedTimestamp>
        <PhysicalResourceId>MyStack-sampledb-ycwhk1v830lx</PhysicalResourceId>
        <ResourceType>AWS::RDS::DBInstance</ResourceType>
      </member>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>SampleApplication</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:26:12Z</LastUpdatedTimestamp>
        <PhysicalResourceId>MyStack-SampleApplication-1MKNASYR3RBQL</PhysicalResourceId>
        <ResourceType>AWS::ElasticBeanstalk::Application</ResourceType>
      </member>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>SampleEnvironment</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:28:48Z</LastUpdatedTimestamp>
        <PhysicalResourceId>myst-Samp-1AGU6ERZX6M3Q</PhysicalResourceId>
        <ResourceType>AWS::ElasticBeanstalk::Environment</ResourceType>
      </member>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>AlarmTopic</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:29:06Z</LastUpdatedTimestamp>
        <PhysicalResourceId>arn:aws:sns:us-east-1:803981987763:MyStack-AlarmTopic-SW4IQELG7RPJ</PhysicalResourceId>
        <ResourceType>AWS::SNS::Topic</ResourceType>
      </member>
      <member>
        <ResourceStatus>CREATE_COMPLETE</ResourceStatus>
        <LogicalResourceId>CPUAlarmHigh</LogicalResourceId>
        <LastUpdatedTimestamp>2011-06-21T20:29:23Z</LastUpdatedTimestamp>
        <PhysicalResourceId>MyStack-CPUAlarmHigh-POBWQPDJA81F</PhysicalResourceId>
        <ResourceType>AWS::CloudWatch::Alarm</ResourceType>
      </member>
    </StackResourceSummaries>
  </ListStackResourcesResult>
  <ResponseMetadata>
    <RequestId>2d06e36c-ac1d-11e0-a958-f9382b6eb86b</RequestId>
  </ResponseMetadata>
</ListStackResourcesResponse>
`

var ListStacksResponse = `
<ListStacksResponse>
 <ListStacksResult>
  <StackSummaries>
    <member>
        <StackId>arn:aws:cloudformation:us-east-1:1234567:stack/TestCreate1/aaaaa</StackId>
        <StackStatus>CREATE_IN_PROGRESS</StackStatus>
        <StackName>vpc1</StackName>
        <CreationTime>2011-05-23T15:47:44Z</CreationTime>
        <TemplateDescription>Creates one EC2 instance and a load balancer.</TemplateDescription>
    </member>
    <member>
        <StackId>arn:aws:cloudformation:us-east-1:1234567:stack/TestDelete2/bbbbb</StackId>
        <StackStatus>DELETE_COMPLETE</StackStatus>
        <DeletionTime>2011-03-10T16:20:51Z</DeletionTime>
        <StackName>WP1</StackName>
        <CreationTime>2011-03-05T19:57:58Z</CreationTime>
        <TemplateDescription>A simple basic Cloudformation Template.</TemplateDescription>
    </member>
  </StackSummaries>
 </ListStacksResult>
  <ResponseMetadata>
    <RequestId>2d06e36c-ac1d-11e0-a958-f9382b6eb86b</RequestId>
  </ResponseMetadata>
</ListStacksResponse>
`

var SetStackPolicyResponse = `
<SetStackPolicyResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <SetStackPolicyResponse/>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</SetStackPolicyResponse>
`

var UpdateStackResponse = `
<UpdateStackResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <UpdateStackResult>
    <StackId>arn:aws:cloudformation:us-east-1:123456789:stack/MyStack/aaf549a0-a413-11df-adb3-5081b3858e83</StackId>
  </UpdateStackResult>
  <ResponseMetadata>
    <RequestId>4af14eec-350e-11e4-b260-EXAMPLE</RequestId>
  </ResponseMetadata>
</UpdateStackResponse>
`
var ValidateTemplateResponse = `
<ValidateTemplateResponse xmlns="http://cloudformation.amazonaws.com/doc/2010-05-15/">
  <ValidateTemplateResult>
    <Description>Test</Description>
    <Capabilities>
      <member>CAPABILITY_IAM</member>
    </Capabilities>
    <Parameters>
      <member>
        <NoEcho>false</NoEcho>
        <ParameterKey>InstanceType</ParameterKey>
        <Description>Type of instance to launch</Description>
        <DefaultValue>m1.small</DefaultValue>
      </member>
      <member>
        <NoEcho>false</NoEcho>
        <ParameterKey>WebServerPort</ParameterKey>
        <Description>The TCP port for the Web Server</Description>
        <DefaultValue>8888</DefaultValue>
      </member>
      <member>
        <NoEcho>false</NoEcho>
        <ParameterKey>KeyName</ParameterKey>
        <Description>Name of an existing EC2 KeyPair to enable SSH access into the server</Description>
      </member>
    </Parameters>
  </ValidateTemplateResult>
  <ResponseMetadata>
    <RequestId>0be7b6e8-e4a0-11e0-a5bd-9f8d5a7dbc91</RequestId>
  </ResponseMetadata>
</ValidateTemplateResponse>
`
