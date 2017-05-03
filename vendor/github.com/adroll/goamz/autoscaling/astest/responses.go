package astest

var BasicGroupResponse = `
<DescribeAutoScalingGroupsResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <DescribeAutoScalingGroupsResult>
    <AutoScalingGroups/>
  </DescribeAutoScalingGroupsResult>
  <ResponseMetadata>
    <RequestId>08c3bedc-8421-11e3-9bb5-bfa219b29cce</RequestId>
  </ResponseMetadata>
</DescribeAutoScalingGroupsResponse>

`

var CreateLaunchConfigurationResponse = `
<CreateLaunchConfigurationResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>091bc9f4-8421-11e3-9bb5-bfa219b29cce</RequestId>
  </ResponseMetadata>
</CreateLaunchConfigurationResponse>
`

var DescribeLaunchConfigurationResponse = `
<DescribeLaunchConfigurationsResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <DescribeLaunchConfigurationsResult>
    <LaunchConfigurations>
      <member>
        <SecurityGroups/>
        <CreatedTime>2014-01-23T11:25:17.400Z</CreatedTime>
        <KernelId>aki-98e26fa8</KernelId>
        <LaunchConfigurationName>LConf1</LaunchConfigurationName>
        <UserData/>
        <LaunchConfigurationARN>arn:aws:autoscaling:us-west-2:193024542802:launchConfiguration:8e3a3c65-51c2-4fae-9076-b1b9694da5ca:launchConfigurationName/LConf1</LaunchConfigurationARN>
        <InstanceType>m1.small</InstanceType>
        <BlockDeviceMappings/>
        <ImageId>ami-03e47533</ImageId>
        <KeyName>testAWS</KeyName>
        <RamdiskId/>
        <InstanceMonitoring>
          <Enabled>true</Enabled>
        </InstanceMonitoring>
        <EbsOptimized>false</EbsOptimized>
      </member>
    </LaunchConfigurations>
  </DescribeLaunchConfigurationsResult>
  <ResponseMetadata>
    <RequestId>09864be1-8421-11e3-a1ae-3535916f8b77</RequestId>
  </ResponseMetadata>
</DescribeLaunchConfigurationsResponse>
`

var CreateAutoScalingGroupResponse = `
<CreateAutoScalingGroupResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>09f51269-8421-11e3-8bb2-e90ca1044a3b</RequestId>
  </ResponseMetadata>
</CreateAutoScalingGroupResponse>
`

var DescribeAutoScalingGroupResponse = `
<DescribeAutoScalingGroupsResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <DescribeAutoScalingGroupsResult>
    <AutoScalingGroups>
      <member>
        <Tags>
          <member>
            <ResourceId>the-name</ResourceId>
            <PropagateAtLaunch>true</PropagateAtLaunch>
            <Value>the-name</Value>
            <Key>Name</Key>
            <ResourceType>auto-scaling-group</ResourceType>
          </member>
	</Tags>
        <SuspendedProcesses/>
        <AutoScalingGroupName>ASGTest1</AutoScalingGroupName>
        <HealthCheckType>EC2</HealthCheckType>
        <CreatedTime>2014-01-23T11:25:18.759Z</CreatedTime>
        <EnabledMetrics/>
        <LaunchConfigurationName>LConf1</LaunchConfigurationName>
        <Instances/>
        <DesiredCapacity>1</DesiredCapacity>
        <AvailabilityZones>
          <member>us-west-2a</member>
        </AvailabilityZones>
        <LoadBalancerNames/>
        <MinSize>1</MinSize>
        <VPCZoneIdentifier/>
        <HealthCheckGracePeriod>300</HealthCheckGracePeriod>
        <DefaultCooldown>300</DefaultCooldown>
        <AutoScalingGroupARN>arn:aws:autoscaling:us-west-2:193024542802:autoScalingGroup:5e4ab94b-b6ba-40b4-9b17-93555b710563:autoScalingGroupName/ASGTest1</AutoScalingGroupARN>
        <TerminationPolicies>
          <member>Default</member>
        </TerminationPolicies>
        <MaxSize>5</MaxSize>
      </member>
    </AutoScalingGroups>
  </DescribeAutoScalingGroupsResult>
  <ResponseMetadata>
    <RequestId>0a716f29-8421-11e3-9bb5-bfa219b29cce</RequestId>
  </ResponseMetadata>
</DescribeAutoScalingGroupsResponse>
`

var SuspendProcessesResponse = `
<SuspendProcessesResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0acf45f1-8421-11e3-af3d-17c9d79e3312</RequestId>
  </ResponseMetadata>
</SuspendProcessesResponse>
`

var ResumeProcessesResponse = `
<ResumeProcessesResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0b76d0b6-8421-11e3-8bb2-e90ca1044a3b</RequestId>
  </ResponseMetadata>
</ResumeProcessesResponse>
`

var SetDesiredCapacityResponse = `
<SetDesiredCapacityResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0c00c13f-8421-11e3-af3d-17c9d79e3312</RequestId>
  </ResponseMetadata>
</SetDesiredCapacityResponse>
`

var UpdateAutoScalingGroupResponse = `
<UpdateAutoScalingGroupResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0dc30ad7-8421-11e3-9450-d938606c0668</RequestId>
  </ResponseMetadata>
</UpdateAutoScalingGroupResponse>
`

var PutScheduledUpdateGroupActionResponse = `
<PutScheduledUpdateGroupActionResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0e3c0b90-8421-11e3-a1ae-3535916f8b77</RequestId>
  </ResponseMetadata>
</PutScheduledUpdateGroupActionResponse>
`

var DescribeScheduledActionsResponse = `
<DescribeScheduledActionsResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <DescribeScheduledActionsResult>
    <ScheduledUpdateGroupActions>
      <member>
        <ScheduledActionName>SATest1</ScheduledActionName>
        <StartTime>2014-06-01T00:30:00Z</StartTime>
        <Time>2014-06-01T00:30:00Z</Time>
        <ScheduledActionARN>arn:aws:autoscaling:us-west-2:193024542802:scheduledUpdateGroupAction:61f68b2c-bde3-4316-9a81-eb95dc246509:autoScalingGroupName/ASGTest1:scheduledActionName/SATest1</ScheduledActionARN>
        <AutoScalingGroupName>ASGTest1</AutoScalingGroupName>
        <Recurrence>30 0 1 1,6,12 *</Recurrence>
        <MaxSize>4</MaxSize>
      </member>
    </ScheduledUpdateGroupActions>
  </DescribeScheduledActionsResult>
  <ResponseMetadata>
    <RequestId>0eb4217f-8421-11e3-9233-7100ef811766</RequestId>
  </ResponseMetadata>
</DescribeScheduledActionsResponse>
`

var DeleteScheduledActionResponse = `
<DeleteScheduledActionResponse xmlns="http://autoscaling.amazonaws.com/doc/2011-01-01/">
  <ResponseMetadata>
    <RequestId>0f38bb02-8421-11e3-9bb5-bfa219b29cce</RequestId>
  </ResponseMetadata>
</DeleteScheduledActionResponse>
`
