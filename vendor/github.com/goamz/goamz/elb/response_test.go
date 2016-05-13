package elb_test

var CreateLoadBalancer = `
<CreateLoadBalancerResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <CreateLoadBalancerResult>
        <DNSName>testlb-339187009.us-east-1.elb.amazonaws.com</DNSName>
    </CreateLoadBalancerResult>
    <ResponseMetadata>
        <RequestId>0c3a8e29-490e-11e2-8647-e14ad5151f1f</RequestId>
    </ResponseMetadata>
</CreateLoadBalancerResponse>
`

var CreateLoadBalancerBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>ValidationError</Code>
        <Message>Only one of SubnetIds or AvailabilityZones may be specified</Message>
    </Error>
    <RequestId>159253fc-49dc-11e2-a47d-cde463c91a3c</RequestId>
</ErrorResponse>
`

var DeleteLoadBalancer = `
<DeleteLoadBalancerResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <DeleteLoadBalancerResult/>
    <ResponseMetadata>
        <RequestId>8d7223db-49d7-11e2-bba9-35ba56032fe1</RequestId>
    </ResponseMetadata>
</DeleteLoadBalancerResponse>
`

var RegisterInstancesWithLoadBalancer = `
<RegisterInstancesWithLoadBalancerResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <RegisterInstancesWithLoadBalancerResult>
        <Instances>
            <member>
                <InstanceId>i-b44db8ca</InstanceId>
            </member>
            <member>
                <InstanceId>i-461ecf38</InstanceId>
            </member>
        </Instances>
    </RegisterInstancesWithLoadBalancerResult>
    <ResponseMetadata>
        <RequestId>0fc82478-49e1-11e2-b947-8768f15220aa</RequestId>
    </ResponseMetadata>
</RegisterInstancesWithLoadBalancerResponse>
`

var RegisterInstancesWithLoadBalancerBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>LoadBalancerNotFound</Code>
        <Message>There is no ACTIVE Load Balancer named 'absentLB'</Message>
    </Error>
    <RequestId>19a0bb97-49f7-11e2-90b4-6bb9ec8331bf</RequestId>
</ErrorResponse>
`

var DeregisterInstancesFromLoadBalancer = `
<DeregisterInstancesFromLoadBalancerResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <DeregisterInstancesFromLoadBalancerResult>
        <Instances/>
    </DeregisterInstancesFromLoadBalancerResult>
    <ResponseMetadata>
        <RequestId>d6490837-49fd-11e2-bba9-35ba56032fe1</RequestId>
    </ResponseMetadata>
</DeregisterInstancesFromLoadBalancerResponse>
`

var DeregisterInstancesFromLoadBalancerBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>LoadBalancerNotFound</Code>
        <Message>There is no ACTIVE Load Balancer named 'absentlb'</Message>
    </Error>
    <RequestId>498e2b4a-4aa1-11e2-8839-d19a879f2eec</RequestId>
</ErrorResponse>
`

var DescribeLoadBalancers = `
<DescribeLoadBalancersResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <DescribeLoadBalancersResult>
        <LoadBalancerDescriptions>
            <member>
                <SecurityGroups/>
                <CreatedTime>2012-12-27T11:51:52.970Z</CreatedTime>
                <LoadBalancerName>testlb</LoadBalancerName>
                <HealthCheck>
                    <Interval>30</Interval>
                    <Target>TCP:80</Target>
                    <HealthyThreshold>10</HealthyThreshold>
                    <Timeout>5</Timeout>
                    <UnhealthyThreshold>2</UnhealthyThreshold>
                </HealthCheck>
                <ListenerDescriptions>
                    <member>
                        <PolicyNames/>
                        <Listener>
                            <Protocol>HTTP</Protocol>
                            <LoadBalancerPort>80</LoadBalancerPort>
                            <InstanceProtocol>HTTP</InstanceProtocol>
                            <InstancePort>80</InstancePort>
                        </Listener>
                    </member>
                </ListenerDescriptions>
                <Instances/>
                <Policies>
                    <AppCookieStickinessPolicies/>
                    <OtherPolicies/>
                    <LBCookieStickinessPolicies/>
                </Policies>
                <AvailabilityZones>
                    <member>us-east-1a</member>
                </AvailabilityZones>
                <CanonicalHostedZoneName>testlb-2087227216.us-east-1.elb.amazonaws.com</CanonicalHostedZoneName>
                <CanonicalHostedZoneNameID>Z3DZXE0Q79N41H</CanonicalHostedZoneNameID>
                <Scheme>internet-facing</Scheme>
                <SourceSecurityGroup>
                    <OwnerAlias>amazon-elb</OwnerAlias>
                    <GroupName>amazon-elb-sg</GroupName>
                </SourceSecurityGroup>
                <DNSName>testlb-2087227216.us-east-1.elb.amazonaws.com</DNSName>
                <BackendServerDescriptions/>
                <Subnets/>
            </member>
        </LoadBalancerDescriptions>
    </DescribeLoadBalancersResult>
    <ResponseMetadata>
    <RequestId>e2e81963-5055-11e2-99c7-434205631d9b</RequestId>
    </ResponseMetadata>
</DescribeLoadBalancersResponse>
`

var DescribeLoadBalancersBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>LoadBalancerNotFound</Code>
        <Message>Cannot find Load Balancer absentlb</Message>
    </Error>
    <RequestId>f14f348e-50f7-11e2-9831-f770dd71c209</RequestId>
</ErrorResponse>
`

var DescribeInstanceHealth = `
<DescribeInstanceHealthResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <DescribeInstanceHealthResult>
        <InstanceStates>
            <member>
                <Description>Instance registration is still in progress.</Description>
                <InstanceId>i-b44db8ca</InstanceId>
                <State>OutOfService</State>
                <ReasonCode>ELB</ReasonCode>
            </member>
        </InstanceStates>
    </DescribeInstanceHealthResult>
    <ResponseMetadata>
        <RequestId>da0d0f9e-5669-11e2-9f81-319facce7423</RequestId>
    </ResponseMetadata>
</DescribeInstanceHealthResponse>
`

var DescribeInstanceHealthBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>InvalidInstance</Code>
        <Message>Could not find EC2 instance i-foooo.</Message>
    </Error>
    <RequestId>352e00d6-566c-11e2-a46d-313272bbb522</RequestId>
</ErrorResponse>
`

var ConfigureHealthCheck = `
<ConfigureHealthCheckResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <ConfigureHealthCheckResult>
        <HealthCheck>
            <Interval>30</Interval>
            <Target>HTTP:80/</Target>
            <HealthyThreshold>10</HealthyThreshold>
            <Timeout>5</Timeout>
            <UnhealthyThreshold>2</UnhealthyThreshold>
        </HealthCheck>
    </ConfigureHealthCheckResult>
    <ResponseMetadata>
    <RequestId>a882d12c-5694-11e2-b647-594652c9487c</RequestId>
    </ResponseMetadata>
</ConfigureHealthCheckResponse>
`

var ConfigureHealthCheckBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>LoadBalancerNotFound</Code>
        <Message>There is no ACTIVE Load Balancer named 'foolb'</Message>
    </Error>
    <RequestId>2d9fe4a5-5697-11e2-9415-e325c02171d7</RequestId>
</ErrorResponse>
`

var AddTagsSuccessResponse = `
<AddTagsResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06- 01/">
  <AddTagsResult/>
  <ResponseMetadata>
    <RequestId>360e81f7-1100-11e4-b6ed-0f30SOME-SAUCY-EXAMPLE</RequestId>
  </ResponseMetadata>
</AddTagsResponse>
`

var TagsBadRequest = `
<ErrorResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
    <Error>
        <Type>Sender</Type>
        <Code>InvalidParameterValue</Code>
        <Message>An invalid or out-of-range value was supplied for the input parameter.</Message>
    </Error>
    <RequestId>terrible-request-id</RequestId>
</ErrorResponse>
`

var RemoveTagsSuccessResponse = `
<RemoveTagsResponse xmlns="http://elasticloadbalancing.amazonaws.com/doc/2012-06-01/">
  <RemoveTagsResult/>
  <ResponseMetadata>
    <RequestId>83c88b9d-12b7-11e3-8b82-87b12DIFFEXAMPLE</RequestId>
  </ResponseMetadata>
</RemoveTagsResponse>
`
