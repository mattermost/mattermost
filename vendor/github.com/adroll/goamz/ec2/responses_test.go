package ec2_test

var (
	ErrorDump = `
<?xml version="1.0" encoding="UTF-8"?>
<Response><Errors><Error><Code>UnsupportedOperation</Code>
<Message>AMIs with an instance-store root device are not supported for the instance type 't1.micro'.</Message>
</Error></Errors><RequestID>0503f4e9-bbd6-483c-b54f-c4ae9f3b30f4</RequestID></Response>
`

	// http://goo.gl/Mcm3b
	RunInstancesExample = `
<RunInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <reservationId>r-47a5402e</reservationId>
  <ownerId>999988887777</ownerId>
  <groupSet>
      <item>
          <groupId>sg-67ad940e</groupId>
          <groupName>default</groupName>
      </item>
  </groupSet>
  <instancesSet>
    <item>
      <instanceId>i-2ba64342</instanceId>
      <imageId>ami-60a54009</imageId>
      <instanceState>
        <code>0</code>
        <name>pending</name>
      </instanceState>
      <privateDnsName></privateDnsName>
      <dnsName></dnsName>
      <keyName>example-key-name</keyName>
      <amiLaunchIndex>0</amiLaunchIndex>
      <instanceType>m1.small</instanceType>
      <launchTime>2007-08-07T11:51:50.000Z</launchTime>
      <placement>
        <availabilityZone>us-east-1b</availabilityZone>
      </placement>
      <monitoring>
        <state>enabled</state>
      </monitoring>
      <virtualizationType>paravirtual</virtualizationType>
      <clientToken/>
      <tagSet/>
      <hypervisor>xen</hypervisor>
    </item>
    <item>
      <instanceId>i-2bc64242</instanceId>
      <imageId>ami-60a54009</imageId>
      <instanceState>
        <code>0</code>
        <name>pending</name>
      </instanceState>
      <privateDnsName></privateDnsName>
      <dnsName></dnsName>
      <keyName>example-key-name</keyName>
      <amiLaunchIndex>1</amiLaunchIndex>
      <instanceType>m1.small</instanceType>
      <launchTime>2007-08-07T11:51:50.000Z</launchTime>
      <placement>
         <availabilityZone>us-east-1b</availabilityZone>
      </placement>
      <monitoring>
        <state>enabled</state>
      </monitoring>
      <virtualizationType>paravirtual</virtualizationType>
      <clientToken/>
      <tagSet/>
      <hypervisor>xen</hypervisor>
    </item>
    <item>
      <instanceId>i-2be64332</instanceId>
      <imageId>ami-60a54009</imageId>
      <instanceState>
        <code>0</code>
        <name>pending</name>
      </instanceState>
      <privateDnsName></privateDnsName>
      <dnsName></dnsName>
      <keyName>example-key-name</keyName>
      <amiLaunchIndex>2</amiLaunchIndex>
      <instanceType>m1.small</instanceType>
      <launchTime>2007-08-07T11:51:50.000Z</launchTime>
      <placement>
         <availabilityZone>us-east-1b</availabilityZone>
      </placement>
      <monitoring>
        <state>enabled</state>
      </monitoring>
      <virtualizationType>paravirtual</virtualizationType>
      <clientToken/>
      <tagSet/>
      <hypervisor>xen</hypervisor>
    </item>
  </instancesSet>
</RunInstancesResponse>
`

	// http://goo.gl/3BKHj
	TerminateInstancesExample = `
<TerminateInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <instancesSet>
    <item>
      <instanceId>i-3ea74257</instanceId>
      <currentState>
        <code>32</code>
        <name>shutting-down</name>
      </currentState>
      <previousState>
        <code>16</code>
        <name>running</name>
      </previousState>
    </item>
  </instancesSet>
</TerminateInstancesResponse>
`

	// http://goo.gl/mLbmw
	DescribeInstancesExample1 = `
<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>98e3c9a4-848c-4d6d-8e8a-b1bdEXAMPLE</requestId>
  <reservationSet>
    <item>
      <reservationId>r-b27e30d9</reservationId>
      <ownerId>999988887777</ownerId>
      <groupSet>
        <item>
          <groupId>sg-67ad940e</groupId>
          <groupName>default</groupName>
        </item>
      </groupSet>
      <instancesSet>
        <item>
          <instanceId>i-c5cd56af</instanceId>
          <imageId>ami-1a2b3c4d</imageId>
          <instanceState>
            <code>16</code>
            <name>running</name>
          </instanceState>
          <privateDnsName>domU-12-31-39-10-56-34.compute-1.internal</privateDnsName>
          <dnsName>ec2-174-129-165-232.compute-1.amazonaws.com</dnsName>
          <reason/>
          <keyName>GSG_Keypair</keyName>
          <amiLaunchIndex>0</amiLaunchIndex>
          <productCodes/>
          <instanceType>m1.small</instanceType>
          <launchTime>2010-08-17T01:15:18.000Z</launchTime>
          <placement>
            <availabilityZone>us-east-1b</availabilityZone>
            <groupName/>
          </placement>
          <kernelId>aki-94c527fd</kernelId>
          <ramdiskId>ari-96c527ff</ramdiskId>
          <monitoring>
            <state>disabled</state>
          </monitoring>
          <privateIpAddress>10.198.85.190</privateIpAddress>
          <ipAddress>174.129.165.232</ipAddress>
          <architecture>i386</architecture>
          <rootDeviceType>ebs</rootDeviceType>
          <rootDeviceName>/dev/sda1</rootDeviceName>
          <blockDeviceMapping>
            <item>
              <deviceName>/dev/sda1</deviceName>
              <ebs>
                <volumeId>vol-a082c1c9</volumeId>
                <status>attached</status>
                <attachTime>2010-08-17T01:15:21.000Z</attachTime>
                <deleteOnTermination>false</deleteOnTermination>
              </ebs>
            </item>
          </blockDeviceMapping>
          <instanceLifecycle>spot</instanceLifecycle>
          <spotInstanceRequestId>sir-7a688402</spotInstanceRequestId>
          <virtualizationType>paravirtual</virtualizationType>
          <clientToken/>
          <tagSet/>
          <hypervisor>xen</hypervisor>
       </item>
      </instancesSet>
      <requesterId>854251627541</requesterId>
    </item>
    <item>
      <reservationId>r-b67e30dd</reservationId>
      <ownerId>999988887777</ownerId>
      <groupSet>
        <item>
          <groupId>sg-67ad940e</groupId>
          <groupName>default</groupName>
        </item>
      </groupSet>
      <instancesSet>
        <item>
          <instanceId>i-d9cd56b3</instanceId>
          <imageId>ami-1a2b3c4d</imageId>
          <instanceState>
            <code>16</code>
            <name>running</name>
          </instanceState>
          <privateDnsName>domU-12-31-39-10-54-E5.compute-1.internal</privateDnsName>
          <dnsName>ec2-184-73-58-78.compute-1.amazonaws.com</dnsName>
          <reason/>
          <keyName>GSG_Keypair</keyName>
          <amiLaunchIndex>0</amiLaunchIndex>
          <productCodes/>
          <instanceType>m1.large</instanceType>
          <launchTime>2010-08-17T01:15:19.000Z</launchTime>
          <placement>
            <availabilityZone>us-east-1b</availabilityZone>
            <groupName/>
          </placement>
          <kernelId>aki-94c527fd</kernelId>
          <ramdiskId>ari-96c527ff</ramdiskId>
          <monitoring>
            <state>disabled</state>
          </monitoring>
          <privateIpAddress>10.198.87.19</privateIpAddress>
          <ipAddress>184.73.58.78</ipAddress>
          <architecture>i386</architecture>
          <rootDeviceType>ebs</rootDeviceType>
          <rootDeviceName>/dev/sda1</rootDeviceName>
          <blockDeviceMapping>
            <item>
              <deviceName>/dev/sda1</deviceName>
              <ebs>
                <volumeId>vol-a282c1cb</volumeId>
                <status>attached</status>
                <attachTime>2010-08-17T01:15:23.000Z</attachTime>
                <deleteOnTermination>false</deleteOnTermination>
              </ebs>
            </item>
          </blockDeviceMapping>
          <instanceLifecycle>spot</instanceLifecycle>
          <spotInstanceRequestId>sir-55a3aa02</spotInstanceRequestId>
          <virtualizationType>paravirtual</virtualizationType>
          <clientToken/>
          <tagSet/>
          <hypervisor>xen</hypervisor>
       </item>
      </instancesSet>
      <requesterId>854251627541</requesterId>
    </item>
  </reservationSet>
</DescribeInstancesResponse>
`

	// http://goo.gl/mLbmw
	DescribeInstancesExample2 = `
<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <reservationSet>
    <item>
      <reservationId>r-bc7e30d7</reservationId>
      <ownerId>999988887777</ownerId>
      <groupSet>
        <item>
          <groupId>sg-67ad940e</groupId>
          <groupName>default</groupName>
        </item>
      </groupSet>
      <instancesSet>
        <item>
          <instanceId>i-c7cd56ad</instanceId>
          <imageId>ami-b232d0db</imageId>
          <instanceState>
            <code>16</code>
            <name>running</name>
          </instanceState>
          <privateDnsName>domU-12-31-39-01-76-06.compute-1.internal</privateDnsName>
          <dnsName>ec2-72-44-52-124.compute-1.amazonaws.com</dnsName>
          <keyName>GSG_Keypair</keyName>
          <amiLaunchIndex>0</amiLaunchIndex>
          <productCodes/>
          <instanceType>m1.small</instanceType>
          <launchTime>2010-08-17T01:15:16.000Z</launchTime>
          <placement>
              <availabilityZone>us-east-1b</availabilityZone>
          </placement>
          <kernelId>aki-94c527fd</kernelId>
          <ramdiskId>ari-96c527ff</ramdiskId>
          <monitoring>
              <state>disabled</state>
          </monitoring>
          <privateIpAddress>10.255.121.240</privateIpAddress>
          <ipAddress>72.44.52.124</ipAddress>
          <architecture>i386</architecture>
          <rootDeviceType>ebs</rootDeviceType>
          <rootDeviceName>/dev/sda1</rootDeviceName>
          <blockDeviceMapping>
              <item>
                 <deviceName>/dev/sda1</deviceName>
                 <ebs>
                    <volumeId>vol-a482c1cd</volumeId>
                    <status>attached</status>
                    <attachTime>2010-08-17T01:15:26.000Z</attachTime>
                    <deleteOnTermination>true</deleteOnTermination>
                </ebs>
             </item>
          </blockDeviceMapping>
          <virtualizationType>paravirtual</virtualizationType>
          <clientToken/>
          <tagSet>
              <item>
                    <key>webserver</key>
                    <value></value>
             </item>
              <item>
                    <key>stack</key>
                    <value>Production</value>
             </item>
          </tagSet>
          <hypervisor>xen</hypervisor>
        </item>
      </instancesSet>
    </item>
  </reservationSet>
</DescribeInstancesResponse>
`

	//http://goo.gl/zW7J4p
	DescribeAddressesExample = `
<DescribeAddressesResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <addressesSet>
      <item>
         <publicIp>192.0.2.1</publicIp>
         <domain>standard</domain>
         <instanceId>i-f15ebb98</instanceId>
      </item>
      <item>
         <publicIp>198.51.100.2</publicIp>
         <domain>standard</domain>
         <instanceId/>
      </item>
      <item>
         <publicIp>203.0.113.41</publicIp>
         <allocationId>eipalloc-08229861</allocationId>
         <domain>vpc</domain>
         <instanceId>i-64600030</instanceId>
         <associationId>eipassoc-f0229899</associationId>
         <networkInterfaceId>eni-ef229886</networkInterfaceId>
         <networkInterfaceOwnerId>053230519467</networkInterfaceOwnerId>
         <privateIpAddress>10.0.0.228</privateIpAddress>
     </item>
   </addressesSet>
</DescribeAddressesResponse>
`

	DescribeAddressesAllocationIdExample = `
<DescribeAddressesResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <addressesSet>
      <item>
         <publicIp>203.0.113.41</publicIp>
         <allocationId>eipalloc-08229861</allocationId>
         <domain>vpc</domain>
         <instanceId>i-64600030</instanceId>
         <associationId>eipassoc-f0229899</associationId>
         <networkInterfaceId>eni-ef229886</networkInterfaceId>
         <networkInterfaceOwnerId>053230519467</networkInterfaceOwnerId>
         <privateIpAddress>10.0.0.228</privateIpAddress>
     </item>
     <item>
         <publicIp>146.54.2.230</publicIp>
         <allocationId>eipalloc-08364752</allocationId>
         <domain>vpc</domain>
         <instanceId>i-64693456</instanceId>
         <associationId>eipassoc-f0348693</associationId>
         <networkInterfaceId>eni-da764039</networkInterfaceId>
         <networkInterfaceOwnerId>053230519467</networkInterfaceOwnerId>
         <privateIpAddress>10.0.0.102</privateIpAddress>
     </item>
   </addressesSet>
</DescribeAddressesResponse>
`

	//http://goo.gl/aLPmbm
	AllocateAddressExample = `
<AllocateAddressResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <publicIp>198.51.100.1</publicIp>
   <domain>vpc</domain>
   <allocationId>eipalloc-5723d13e</allocationId>
</AllocateAddressResponse>
`

	//http://goo.gl/Ciw2Z8
	ReleaseAddressExample = `
<ReleaseAddressResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</ReleaseAddressResponse>
`

	//http://goo.gl/hhj4z7
	AssociateAddressExample = `
<AssociateAddressResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <return>true</return>
   <associationId>eipassoc-fc5ca095</associationId>
</AssociateAddressResponse>
`

	//http://goo.gl/Dapkuz
	DiassociateAddressExample = `
<ReleaseAddressResponse xmlns="http://ec2.amazonaws.com/doc/2013-10-01/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</ReleaseAddressResponse>
`

	// http://goo.gl/V0U25
	DescribeImagesExample = `
<DescribeImagesResponse xmlns="http://ec2.amazonaws.com/doc/2012-08-15/">
         <requestId>4a4a27a2-2e7c-475d-b35b-ca822EXAMPLE</requestId>
    <imagesSet>
        <item>
            <imageId>ami-a2469acf</imageId>
            <imageLocation>aws-marketplace/example-marketplace-amzn-ami.1</imageLocation>
            <imageState>available</imageState>
            <imageOwnerId>123456789999</imageOwnerId>
            <isPublic>true</isPublic>
            <productCodes>
                <item>
                    <productCode>a1b2c3d4e5f6g7h8i9j10k11</productCode>
                    <type>marketplace</type>
                </item>
            </productCodes>
            <architecture>i386</architecture>
            <imageType>machine</imageType>
            <kernelId>aki-805ea7e9</kernelId>
            <imageOwnerAlias>aws-marketplace</imageOwnerAlias>
            <name>example-marketplace-amzn-ami.1</name>
            <description>Amazon Linux AMI i386 EBS</description>
            <rootDeviceType>ebs</rootDeviceType>
            <rootDeviceName>/dev/sda1</rootDeviceName>
            <blockDeviceMapping>
                <item>
                    <deviceName>/dev/sda1</deviceName>
                    <ebs>
                        <snapshotId>snap-787e9403</snapshotId>
                        <volumeSize>8</volumeSize>
                        <deleteOnTermination>true</deleteOnTermination>
                    </ebs>
                </item>
            </blockDeviceMapping>
            <virtualizationType>paravirtual</virtualizationType>
            <tagSet>
                <item>
                    <key>Purpose</key>
                    <value>EXAMPLE</value>
                </item>
            </tagSet>
            <hypervisor>xen</hypervisor>
        </item>
    </imagesSet>
</DescribeImagesResponse>
`

	// http://goo.gl/ttcda
	CreateSnapshotExample = `
<CreateSnapshotResponse xmlns="http://ec2.amazonaws.com/doc/2012-10-01/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <snapshotId>snap-78a54011</snapshotId>
  <volumeId>vol-4d826724</volumeId>
  <status>pending</status>
  <startTime>2008-05-07T12:51:50.000Z</startTime>
  <progress>60%</progress>
  <ownerId>111122223333</ownerId>
  <volumeSize>10</volumeSize>
  <description>Daily Backup</description>
</CreateSnapshotResponse>
`

	// http://goo.gl/vwU1y
	DeleteSnapshotExample = `
<DeleteSnapshotResponse xmlns="http://ec2.amazonaws.com/doc/2012-10-01/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</DeleteSnapshotResponse>
`

	// http://goo.gl/nkovs
	DescribeSnapshotsExample = `
<DescribeSnapshotsResponse xmlns="http://ec2.amazonaws.com/doc/2012-10-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <snapshotSet>
      <item>
         <snapshotId>snap-1a2b3c4d</snapshotId>
         <volumeId>vol-8875daef</volumeId>
         <status>pending</status>
         <startTime>2010-07-29T04:12:01.000Z</startTime>
         <progress>30%</progress>
         <ownerId>111122223333</ownerId>
         <volumeSize>15</volumeSize>
         <description>Daily Backup</description>
         <tagSet>
            <item>
               <key>Purpose</key>
               <value>demo_db_14_backup</value>
            </item>
         </tagSet>
      </item>
   </snapshotSet>
</DescribeSnapshotsResponse>
`

	DescribeSubnetsExample = `
<DescribeSubnetsResponse xmlns="http://ec2.amazonaws.com/doc/2014-02-01/">
    <requestId>a5266c3e-2b7a-4434-971e-317b6EXAMPLE</requestId>
    <subnetSet>
        <item>
            <subnetId>subnet-3e993755</subnetId>
            <state>available</state>
            <vpcId>vpc-f84a9b93</vpcId>
            <cidrBlock>10.0.12.0/24</cidrBlock>
            <availableIpAddressCount>249</availableIpAddressCount>
            <availabilityZone>us-west-2c</availabilityZone>
            <defaultForAz>false</defaultForAz>
            <mapPublicIpOnLaunch>false</mapPublicIpOnLaunch>
            <tagSet>
                <item>
                    <key>visibility</key>
                    <value>private</value>
                </item>
                <item>
                    <key>Name</key>
                    <value>application</value>
                </item>
            </tagSet>
        </item>
        <item>
            <subnetId>subnet-f44a8b9f</subnetId>
            <state>available</state>
            <vpcId>vpc-f84a9b93</vpcId>
            <cidrBlock>10.0.10.0/24</cidrBlock>
            <availableIpAddressCount>248</availableIpAddressCount>
            <availabilityZone>us-west-2a</availabilityZone>
            <defaultForAz>false</defaultForAz>
            <mapPublicIpOnLaunch>false</mapPublicIpOnLaunch>
            <tagSet>
                <item>
                    <key>Name</key>
                    <value>application</value>
                </item>
                <item>
                    <key>visibility</key>
                    <value>private</value>
                </item>
            </tagSet>
        </item>
        <item>
            <subnetId>subnet-7599371e</subnetId>
            <state>available</state>
            <vpcId>vpc-f84a1b93</vpcId>
            <cidrBlock>10.0.11.0/24</cidrBlock>
            <availableIpAddressCount>246</availableIpAddressCount>
            <availabilityZone>us-west-2b</availabilityZone>
            <defaultForAz>false</defaultForAz>
            <mapPublicIpOnLaunch>false</mapPublicIpOnLaunch>
            <tagSet>
                <item>
                    <key>visibility</key>
                    <value>private</value>
                </item>
                <item>
                    <key>Name</key>
                    <value>application</value>
                </item>
            </tagSet>
        </item>
    </subnetSet>
</DescribeSubnetsResponse>
`

	// http://goo.gl/Eo7Yl
	CreateSecurityGroupExample = `
<CreateSecurityGroupResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <return>true</return>
   <groupId>sg-67ad940e</groupId>
</CreateSecurityGroupResponse>
`

	// http://goo.gl/k12Uy
	DescribeSecurityGroupsExample = `
<DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <securityGroupInfo>
    <item>
      <ownerId>999988887777</ownerId>
      <groupName>WebServers</groupName>
      <groupId>sg-67ad940e</groupId>
      <groupDescription>Web Servers</groupDescription>
      <ipPermissions>
        <item>
           <ipProtocol>tcp</ipProtocol>
           <fromPort>80</fromPort>
           <toPort>80</toPort>
           <groups/>
           <ipRanges>
             <item>
               <cidrIp>0.0.0.0/0</cidrIp>
             </item>
           </ipRanges>
        </item>
      </ipPermissions>
    </item>
    <item>
      <ownerId>999988887777</ownerId>
      <groupName>RangedPortsBySource</groupName>
      <groupId>sg-76abc467</groupId>
      <groupDescription>Group A</groupDescription>
      <ipPermissions>
        <item>
           <ipProtocol>tcp</ipProtocol>
           <fromPort>6000</fromPort>
           <toPort>7000</toPort>
           <groups/>
           <ipRanges/>
        </item>
      </ipPermissions>
    </item>
  </securityGroupInfo>
</DescribeSecurityGroupsResponse>
`

	SecurityGroupsVPCExample = `
<DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <securityGroupInfo>
    <item>
      <ownerId>999988887777</ownerId>
      <groupName>WebServers</groupName>
      <groupId>sg-67ad940e</groupId>
      <groupDescription>Web Servers</groupDescription>
      <ipPermissions>
        <item>
           <ipProtocol>tcp</ipProtocol>
           <fromPort>80</fromPort>
           <toPort>80</toPort>
           <groups/>
           <ipRanges>
             <item>
               <cidrIp>0.0.0.0/0</cidrIp>
             </item>
           </ipRanges>
        </item>
      </ipPermissions>
      <ipPermissionsEgress>
        <item>
          <ipProtocol>tcp</ipProtocol>
           <fromPort>22</fromPort>
           <toPort>22</toPort>
           <groups/>
           <ipRanges>
             <item>
               <cidrIp>10.0.0.0/8</cidrIp>
             </item>
           </ipRanges>
        </item>
      </ipPermissionsEgress>
    </item>
    <item>
      <ownerId>999988887777</ownerId>
      <groupName>RangedPortsBySource</groupName>
      <groupId>sg-76abc467</groupId>
      <groupDescription>Group A</groupDescription>
      <ipPermissions>
        <item>
           <ipProtocol>tcp</ipProtocol>
           <fromPort>6000</fromPort>
           <toPort>7000</toPort>
           <groups/>
           <ipRanges/>
        </item>
      </ipPermissions>
      <vpcId>vpc-12345678</vpcId>
      <tagSet>
        <item>
          <key>key</key>
          <value>value</value>
        </item>
      </tagSet>
    </item>
  </securityGroupInfo>
</DescribeSecurityGroupsResponse>
`

	// A dump which includes groups within ip permissions.
	DescribeSecurityGroupsDump = `
<?xml version="1.0" encoding="UTF-8"?>
<DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
    <requestId>87b92b57-cc6e-48b2-943f-f6f0e5c9f46c</requestId>
    <securityGroupInfo>
        <item>
            <ownerId>12345</ownerId>
            <groupName>default</groupName>
            <groupDescription>default group</groupDescription>
            <ipPermissions>
                <item>
                    <ipProtocol>icmp</ipProtocol>
                    <fromPort>-1</fromPort>
                    <toPort>-1</toPort>
                    <groups>
                        <item>
                            <userId>12345</userId>
                            <groupName>default</groupName>
                            <groupId>sg-67ad940e</groupId>
                        </item>
                    </groups>
                    <ipRanges/>
                </item>
                <item>
                    <ipProtocol>tcp</ipProtocol>
                    <fromPort>0</fromPort>
                    <toPort>65535</toPort>
                    <groups>
                        <item>
                            <userId>12345</userId>
                            <groupName>other</groupName>
                            <groupId>sg-76abc467</groupId>
                        </item>
                    </groups>
                    <ipRanges/>
                </item>
            </ipPermissions>
        </item>
    </securityGroupInfo>
</DescribeSecurityGroupsResponse>
`

	// http://goo.gl/QJJDO
	DeleteSecurityGroupExample = `
<DeleteSecurityGroupResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <return>true</return>
</DeleteSecurityGroupResponse>
`

	// http://goo.gl/u2sDJ
	AuthorizeSecurityGroupIngressExample = `
<AuthorizeSecurityGroupIngressResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</AuthorizeSecurityGroupIngressResponse>
`

	// http://goo.gl/Mz7xr
	RevokeSecurityGroupIngressExample = `
<RevokeSecurityGroupIngressResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</RevokeSecurityGroupIngressResponse>
`

	// http://goo.gl/Vmkqc
	CreateTagsExample = `
<CreateTagsResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <return>true</return>
</CreateTagsResponse>
`

	// http://goo.gl/t6XvYh
	DeleteTagsExample = `
<DeleteTagsResponse xmlns="http://ec2.amazonaws.com/doc/2015-10-01/">
   <requestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</requestId>
   <return>true</return>
</DeleteTagsResponse>
`

	// http://goo.gl/hgJjO7
	DescribeTagsExample = `
<DescribeTagsResponse xmlns="http://ec2.amazonaws.com/doc/2014-06-15/">
   <requestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</requestId>
   <tagSet>
      <item>
         <resourceId>ami-1a2b3c4d</resourceId>
         <resourceType>image</resourceType>
         <key>webserver</key>
         <value/>
      </item>
       <item>
         <resourceId>ami-1a2b3c4d</resourceId>
         <resourceType>image</resourceType>
         <key>stack</key>
         <value>Production</value>
      </item>
      <item>
         <resourceId>i-5f4e3d2a</resourceId>
         <resourceType>instance</resourceType>
         <key>webserver</key>
         <value/>
      </item>
       <item>
         <resourceId>i-5f4e3d2a</resourceId>
         <resourceType>instance</resourceType>
         <key>stack</key>
         <value>Production</value>
      </item>
      <item>
         <resourceId>i-12345678</resourceId>
         <resourceType>instance</resourceType>
         <key>database_server</key>
         <value/>
      </item>
       <item>
         <resourceId>i-12345678</resourceId>
         <resourceType>instance</resourceType>
         <key>stack</key>
         <value>Test</value>
      </item>
    </tagSet>
</DescribeTagsResponse>
`

	// http://goo.gl/awKeF
	StartInstancesExample = `
<StartInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <instancesSet>
    <item>
      <instanceId>i-10a64379</instanceId>
      <currentState>
          <code>0</code>
          <name>pending</name>
      </currentState>
      <previousState>
          <code>80</code>
          <name>stopped</name>
      </previousState>
    </item>
  </instancesSet>
</StartInstancesResponse>
`

	// http://goo.gl/436dJ
	StopInstancesExample = `
<StopInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <instancesSet>
    <item>
      <instanceId>i-10a64379</instanceId>
      <currentState>
          <code>64</code>
          <name>stopping</name>
      </currentState>
      <previousState>
          <code>16</code>
          <name>running</name>
      </previousState>
    </item>
  </instancesSet>
</StopInstancesResponse>
`

	// http://goo.gl/baoUf
	RebootInstancesExample = `
<RebootInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2011-12-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</RebootInstancesResponse>
`

	DescribeReservedInstancesExample = `
<DescribeReservedInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2014-06-15/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <reservedInstancesSet>
      <item>
         <reservedInstancesId>e5a2ff3b-7d14-494f-90af-0b5d0EXAMPLE</reservedInstancesId>
         <instanceType>m1.xlarge</instanceType>
         <availabilityZone>us-east-1b</availabilityZone>
         <duration>31536000</duration>
         <fixedPrice>61.0</fixedPrice>
         <usagePrice>0.034</usagePrice>
         <instanceCount>3</instanceCount>
         <productDescription>Linux/UNIX</productDescription>
         <state>active</state>
         <instanceTenancy>default</instanceTenancy>
         <currencyCode>USD</currencyCode>
         <offeringType>Light Utilization</offeringType>
         <recurringCharges/>
      </item>
   </reservedInstancesSet>
</DescribeReservedInstancesResponse>
`
	DeregisterImageExample = `
<DeregisterImageResponse xmlns="http://ec2.amazonaws.com/doc/2014-06-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <return>true</return>
</DeregisterImageResponse>
`
	DescribeInstanceStatusExample = `
<DescribeInstanceStatusResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
    <requestId>3be1508e-c444-4fef-89cc-0b1223c4f02fEXAMPLE</requestId>
    <instanceStatusSet>
        <item>
            <instanceId>i-1a2b3c4d</instanceId>
            <availabilityZone>us-east-1d</availabilityZone>
            <instanceState>
                <code>16</code>
                <name>running</name>
            </instanceState>
            <systemStatus>
                <status>impaired</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>failed</status>
                        <impairedSince>YYYY-MM-DDTHH:MM:SS.000Z</impairedSince>
                    </item>
                </details>
            </systemStatus>
            <instanceStatus>
                <status>impaired</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>failed</status>
                        <impairedSince>YYYY-MM-DDTHH:MM:SS.000Z</impairedSince>
                    </item>
                </details>
            </instanceStatus>
            <eventsSet>
              <item>
                <code>instance-retirement</code>
                <description>The instance is running on degraded hardware</description>
                <notBefore>YYYY-MM-DDTHH:MM:SS+0000</notBefore>
                <notAfter>YYYY-MM-DDTHH:MM:SS+0000</notAfter>
              </item>
            </eventsSet>
        </item>
        <item>
            <instanceId>i-2a2b3c4d</instanceId>
            <availabilityZone>us-east-1d</availabilityZone>
            <instanceState>
                <code>16</code>
                <name>running</name>
            </instanceState>
            <systemStatus>
                <status>ok</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>passed</status>
                    </item>
                </details>
            </systemStatus>
            <instanceStatus>
                <status>ok</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>passed</status>
                    </item>
                </details>
            </instanceStatus>
            <eventsSet>
              <item>
                <code>instance-reboot</code>
                <description>The instance is scheduled for a reboot</description>
                <notBefore>YYYY-MM-DDTHH:MM:SS+0000</notBefore>
                <notAfter>YYYY-MM-DDTHH:MM:SS+0000</notAfter>
              </item>
            </eventsSet>
        </item>
        <item>
            <instanceId>i-3a2b3c4d</instanceId>
            <availabilityZone>us-east-1c</availabilityZone>
            <instanceState>
                <code>16</code>
                <name>running</name>
            </instanceState>
            <systemStatus>
                <status>ok</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>passed</status>
                    </item>
                </details>
            </systemStatus>
            <instanceStatus>
                <status>ok</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>passed</status>
                    </item>
                </details>
            </instanceStatus>
        </item>
        <item>
            <instanceId>i-4a2b3c4d</instanceId>
            <availabilityZone>us-east-1c</availabilityZone>
            <instanceState>
                <code>16</code>
                <name>running</name>
            </instanceState>
            <systemStatus>
                <status>ok</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>passed</status>
                    </item>
                </details>
            </systemStatus>
            <instanceStatus>
                <status>insufficient-data</status>
                <details>
                    <item>
                        <name>reachability</name>
                        <status>insufficient-data</status>
                    </item>
                </details>
            </instanceStatus>
         </item>
    </instanceStatusSet>
</DescribeInstanceStatusResponse>
`

	DescribeVolumesExample = `
<DescribeVolumesResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <volumeSet>
      <item>
         <volumeId>vol-1a2b3c4d</volumeId>
         <size>80</size>
         <snapshotId/>
         <availabilityZone>us-east-1a</availabilityZone>
         <status>in-use</status>
         <createTime>YYYY-MM-DDTHH:MM:SS.SSSZ</createTime>
         <attachmentSet>
            <item>
               <volumeId>vol-1a2b3c4d</volumeId>
               <instanceId>i-1a2b3c4d</instanceId>
               <device>/dev/sdh</device>
               <status>attached</status>
               <attachTime>YYYY-MM-DDTHH:MM:SS.SSSZ</attachTime>
               <deleteOnTermination>false</deleteOnTermination>
            </item>
         </attachmentSet>
         <volumeType>standard</volumeType>
         <encrypted>true</encrypted>
      </item>
   </volumeSet>
</DescribeVolumesResponse>
`

	AttachVolumeExample = `
<AttachVolumeResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <volumeId>vol-1a2b3c4d</volumeId>
  <instanceId>i-1a2b3c4d</instanceId>
  <device>/dev/sdh</device>
  <status>attaching</status>
  <attachTime>YYYY-MM-DDTHH:MM:SS.000Z</attachTime>
</AttachVolumeResponse>
`

	CreateVolumeExample = `
<CreateVolumeResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
	<requestId>0c67a4c9-d7ec-45ef-8016-bf666EXAMPLE</requestId>
	<volumeId>vol-2a21e543</volumeId>
	<size>1</size>
	<snapshotId/>
	<availabilityZone>us-east-1a</availabilityZone>
	<status>creating</status>
	<createTime>2009-12-28T05:42:53.000Z</createTime>
	<volumeType>standard</volumeType>
	<iops>0</iops>
	<encrypted>false</encrypted>
</CreateVolumeResponse>
`

	DescribeVpcsExample = `
<DescribeVpcsResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
  <requestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</requestId>
  <vpcSet>
    <item>
      <vpcId>vpc-1a2b3c4d</vpcId>
      <state>available</state>
      <cidrBlock>10.0.0.0/23</cidrBlock>
      <dhcpOptionsId>dopt-7a8b9c2d</dhcpOptionsId>
      <instanceTenancy>default</instanceTenancy>
      <isDefault>false</isDefault>
      <tagSet/>
    </item>
  </vpcSet>
</DescribeVpcsResponse>
`

	DescribeVpnConnectionsExample = `
<DescribeVpnConnectionsResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
  <requestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</requestId>
  <vpnConnectionSet>
    <item>
      <vpnConnectionId>vpn-44a8938f</vpnConnectionId>
      <state>available</state>
      <customerGatewayConfiguration>
          ...Customer gateway configuration data in escaped XML format...
      </customerGatewayConfiguration>
      <type>ipsec.1</type>
      <customerGatewayId>cgw-b4dc3961</customerGatewayId>
      <vpnGatewayId>vgw-8db04f81</vpnGatewayId>
      <tagSet/>
    </item>
  </vpnConnectionSet>
</DescribeVpnConnectionsResponse>
`

	DescribeVpnGatewaysExample = `
<DescribeVpnGatewaysResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
  <requestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</requestId>
  <vpnGatewaySet>
    <item>
      <vpnGatewayId>vgw-8db04f81</vpnGatewayId>
      <state>available</state>
      <type>ipsec.1</type>
      <availabilityZone>us-east-1a</availabilityZone>
      <attachments>
        <item>
          <vpcId>vpc-1a2b3c4d</vpcId>
          <state>attached</state>
        </item>
      </attachments>
      <tagSet/>
    </item>
  </vpnGatewaySet>
</DescribeVpnGatewaysResponse>
`

	DescribeInternetGatewaysExample = `
<DescribeInternetGatewaysResponse xmlns="http://ec2.amazonaws.com/doc/2014-09-01/">
   <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
   <internetGatewaySet>
      <item>
         <internetGatewayId>igw-eaad4883EXAMPLE</internetGatewayId>
         <attachmentSet>
            <item>
               <vpcId>vpc-11ad4878</vpcId>
               <state>available</state>
            </item>
         </attachmentSet>
         <tagSet/>
      </item>
   </internetGatewaySet>
</DescribeInternetGatewaysResponse>
`
)
