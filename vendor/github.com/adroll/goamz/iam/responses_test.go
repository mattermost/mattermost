package iam_test

// http://goo.gl/EUIvl
var CreateUserExample = `
<CreateUserResponse>
   <CreateUserResult>
      <User>
         <Path>/division_abc/subdivision_xyz/</Path>
         <UserName>Bob</UserName>
         <UserId>AIDACKCEVSQ6C2EXAMPLE</UserId>
         <Arn>arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob</Arn>
     </User>
   </CreateUserResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</CreateUserResponse>
`

var DuplicateUserExample = `
<ErrorResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <Error>
    <Type>Sender</Type>
    <Code>EntityAlreadyExists</Code>
    <Message>User with name Bob already exists.</Message>
  </Error>
  <RequestId>1d5f5000-1316-11e2-a60f-91a8e6fb6d21</RequestId>
</ErrorResponse>
`

var GetUserExample = `
<GetUserResponse>
   <GetUserResult>
      <User>
         <Path>/division_abc/subdivision_xyz/</Path>
         <UserName>Bob</UserName>
         <UserId>AIDACKCEVSQ6C2EXAMPLE</UserId>
         <Arn>arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob</Arn>
      </User>
   </GetUserResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</GetUserResponse>
`

var CreateGroupExample = `
<CreateGroupResponse>
   <CreateGroupResult>
      <Group>
         <Path>/admins/</Path>
         <GroupName>Admins</GroupName>
         <GroupId>AGPACKCEVSQ6C2EXAMPLE</GroupId>
         <Arn>arn:aws:iam::123456789012:group/Admins</Arn>
      </Group>
   </CreateGroupResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</CreateGroupResponse>
`

var ListGroupsExample = `
<ListGroupsResponse>
   <ListGroupsResult>
      <Groups>
         <member>
            <Path>/division_abc/subdivision_xyz/</Path>
            <GroupName>Admins</GroupName>
            <GroupId>AGPACKCEVSQ6C2EXAMPLE</GroupId>
            <Arn>arn:aws:iam::123456789012:group/Admins</Arn>
         </member>
         <member>
            <Path>/division_abc/subdivision_xyz/product_1234/engineering/</Path>
            <GroupName>Test</GroupName>
            <GroupId>AGP2MAB8DPLSRHEXAMPLE</GroupId>
            <Arn>arn:aws:iam::123456789012:group/division_abc/subdivision_xyz/product_1234/engineering/Test</Arn>
         </member>
         <member>
            <Path>/division_abc/subdivision_xyz/product_1234/</Path>
            <GroupName>Managers</GroupName>
            <GroupId>AGPIODR4TAW7CSEXAMPLE</GroupId>
            <Arn>arn:aws:iam::123456789012:group/division_abc/subdivision_xyz/product_1234/Managers</Arn>
         </member>
      </Groups>
      <IsTruncated>false</IsTruncated>
   </ListGroupsResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</ListGroupsResponse>
`

var RequestIdExample = `
<AddUserToGroupResponse>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</AddUserToGroupResponse>
`

var CreateAccessKeyExample = `
<CreateAccessKeyResponse>
   <CreateAccessKeyResult>
     <AccessKey>
         <UserName>Bob</UserName>
         <AccessKeyId>AKIAIOSFODNN7EXAMPLE</AccessKeyId>
         <Status>Active</Status>
         <SecretAccessKey>wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY</SecretAccessKey>
      </AccessKey>
   </CreateAccessKeyResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</CreateAccessKeyResponse>
`

var ListAccessKeyExample = `
<ListAccessKeysResponse>
   <ListAccessKeysResult>
      <UserName>Bob</UserName>
      <AccessKeyMetadata>
         <member>
            <UserName>Bob</UserName>
            <AccessKeyId>AKIAIOSFODNN7EXAMPLE</AccessKeyId>
            <Status>Active</Status>
         </member>
         <member>
            <UserName>Bob</UserName>
            <AccessKeyId>AKIAI44QH8DHBEXAMPLE</AccessKeyId>
            <Status>Inactive</Status>
         </member>
      </AccessKeyMetadata>
      <IsTruncated>false</IsTruncated>
   </ListAccessKeysResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</ListAccessKeysResponse>
`

var GetUserPolicyExample = `
<GetUserPolicyResponse>
   <GetUserPolicyResult>
      <UserName>Bob</UserName>
      <PolicyName>AllAccessPolicy</PolicyName>
      <PolicyDocument>
      {"Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}
      </PolicyDocument>
   </GetUserPolicyResult>
   <ResponseMetadata>
      <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
   </ResponseMetadata>
</GetUserPolicyResponse>
`
