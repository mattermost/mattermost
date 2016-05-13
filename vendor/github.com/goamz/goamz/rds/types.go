package rds

// AvailabilityZone contains Availability Zone information
// See http://goo.gl/GWF4zF for more details.
type AvailabilityZone struct {
	Name                   string `xml:"Name"`
	ProvisionedIopsCapable bool   `xml:"ProvisionedIopsCapable"`
}

// CharacterSet represents a character set used by a Database Engine
// See http://goo.gl/0BXwFp for more details.
type CharacterSet struct {
	Name        string `xml:"CharacterSetName"`
	Description string `xml:"CharacterSetDescription"`
}

// DBEngineVersion describes a version of a Database Engine
// See http://goo.gl/a5l6cv for more details.
type DBEngineVersion struct {
	DBEngineDescription        string         `xml:"DBEngineDescription"`        // The description of the database engine
	DBEngineVersionDescription string         `xml:"DBEngineVersionDescription"` // The description of the database engine version
	DBParameterGroupFamily     string         `xml:"DBParameterGroupFamily"`     // The name of the DB parameter group family for the database engine
	DefaultCharacterSet        CharacterSet   `xml:"DefaultCharacterSet"`        // The default character set for new instances of this engine version, if the CharacterSetName parameter of the CreateDBInstance API is not specified
	Engine                     string         `xml:"Engine"`                     // The name of the database engine
	EngineVersion              string         `xml:"EngineVersion"`              // The version number of the database engine
	SupportedCharacterSets     []CharacterSet `xml:"SupportedCharacterSets"`     // A list of the character sets supported by this engine for the CharacterSetName parameter of the CreateDBInstance API
}

// DBInstance encapsulates an instance of a Database
// See http://goo.gl/rQFpAe for more details.
type DBInstance struct {
	AllocatedStorage                      int                          `xml:"AllocatedStorage"`                             // Specifies the allocated storage size specified in gigabytes.
	AutoMinorVersionUpgrade               bool                         `xml:"AutoMinorVersionUpgrade"`                      // Indicates that minor version patches are applied automatically.
	AvailabilityZone                      string                       `xml:"AvailabilityZone"`                             // Specifies the name of the Availability Zone the DB instance is located in.
	BackupRetentionPeriod                 int                          `xml:"BackupRetentionPeriod"`                        // Specifies the number of days for which automatic DB snapshots are retained.
	CharacterSetName                      string                       `xml:"CharacterSetName"`                             // If present, specifies the name of the character set that this instance is associated with.
	DBInstanceClass                       string                       `xml:"DBInstanceClass"`                              // Contains the name of the compute and memory capacity class of the DB instance.
	DBInstanceIdentifier                  string                       `xml:"DBInstanceIdentifier"`                         // Contains a user-supplied database identifier. This is the unique key that identifies a DB instance.
	DBInstanceStatus                      string                       `xml:"DBInstanceStatus"`                             // Specifies the current state of this database.
	DBName                                string                       `xml:"DBName"`                                       // The meaning of this parameter differs according to the database engine you use.
	DBParameterGroups                     []DBParameterGroupStatus     `xml:"DBParameterGroups>DBParameterGroup"`           // Provides the list of DB parameter groups applied to this DB instance.
	DBSecurityGroups                      []DBSecurityGroupMembership  `xml:"DBSecurityGroups>DBSecurityGroup"`             // Provides List of DB security group elements containing only DBSecurityGroup.Name and DBSecurityGroup.Status subelements.
	DBSubnetGroup                         DBSubnetGroup                `xml:"DBSubnetGroup"`                                // Specifies information on the subnet group associated with the DB instance, including the name, description, and subnets in the subnet group.
	Endpoint                              Endpoint                     `xml:"Endpoint"`                                     // Specifies the connection endpoint.
	Engine                                string                       `xml:"Engine"`                                       // Provides the name of the database engine to be used for this DB instance.
	EngineVersion                         string                       `xml:"EngineVersion"`                                // Indicates the database engine version.
	InstanceCreateTime                    string                       `xml:"InstanceCreateTime"`                           // Provides the date and time the DB instance was created.
	Iops                                  int                          `xml:"Iops"`                                         // Specifies the Provisioned IOPS (I/O operations per second) value.
	LatestRestorableTime                  string                       `xml:"LatestRestorableTime"`                         // Specifies the latest time to which a database can be restored with point-in-time restore.
	LicenseModel                          string                       `xml:"LicenseModel"`                                 // License model information for this DB instance.
	MasterUsername                        string                       `xml:"MasterUsername"`                               // Contains the master username for the DB instance.
	MultiAZ                               bool                         `xml:"MultiAZ"`                                      // Specifies if the DB instance is a Multi-AZ deployment.
	OptionGroupMemberships                []OptionGroupMembership      `xml:"OptionGroupMemberships>OptionGroupMembership"` // Provides the list of option group memberships for this DB instance.
	PendingModifiedValues                 PendingModifiedValues        `xml:"PendingModifiedValues"`                        // Specifies that changes to the DB instance are pending. This element is only included when changes are pending. Specific changes are identified by subelements.
	PreferredBackupWindow                 string                       `xml:"PreferredBackupWindow"`                        // Specifies the daily time range during which automated backups are created if automated backups are enabled, as determined by the BackupRetentionPeriod.
	PreferredMaintenanceWindow            string                       `xml:"PreferredMaintenanceWindow"`                   // Specifies the weekly time range (in UTC) during which system maintenance can occur.
	PubliclyAccessible                    bool                         `xml:"PubliclyAccessible"`                           // Specifies the accessibility options for the DB instance. A value of true specifies an Internet-facing instance with a publicly resolvable DNS name, which resolves to a public IP address. A value of false specifies an internal instance with a DNS name that resolves to a private IP address.
	ReadReplicaDBInstanceIdentifiers      []string                     `xml:"ReadReplicaDBInstanceIdentifiers"`             // Contains one or more identifiers of the read replicas associated with this DB instance.
	ReadReplicaSourceDBInstanceIdentifier string                       `xml:"ReadReplicaSourceDBInstanceIdentifier"`        // Contains the identifier of the source DB instance if this DB instance is a read replica.
	SecondaryAvailabilityZone             string                       `xml:"SecondaryAvailabilityZone"`                    // If present, specifies the name of the secondary Availability Zone for a DB instance with multi-AZ support.
	StatusInfos                           []DBInstanceStatusInfo       `xml:"StatusInfos"`                                  // The status of a read replica. If the instance is not a read replica, this will be blank.
	VpcSecurityGroups                     []VpcSecurityGroupMembership `xml:"VpcSecurityGroups"`                            // Provides List of VPC security group elements that the DB instance belongs to.
}

// DBInstanceStatusInfo provides a list of status information for a DB instance
// See http://goo.gl/WuePdz for more details.
type DBInstanceStatusInfo struct {
	Message    string `xml:"Message"`    // Details of the error if there is an error for the instance. If the instance is not in an error state, this value is blank.
	Normal     bool   `xml:"Normal"`     // Boolean value that is true if the instance is operating normally, or false if the instance is in an error state.
	Status     string `xml:"Status"`     // Status of the DB instance. For a StatusType of read replica, the values can be replicating, error, stopped, or terminated.
	StatusType string `xml:"StatusType"` // This value is currently "read replication."
}

// DBParameterGroup contains the result of a successful invocation of the CreateDBParameterGroup action
// See http://goo.gl/a8BCTy for more details.
type DBParameterGroup struct {
	Name        string `xml:"DBParameterGroupName"`
	Description string `xml:"Description"`
	Family      string `xml:"DBParameterGroupFamily"`
}

// DBParameterGroupStatus represents the status of the DB parameter group
// See http://goo.gl/X318cI for more details.
type DBParameterGroupStatus struct {
	Name   string `xml:"DBParameterGroupName"`
	Status string `xml:"ParameterApplyStatus"`
}

// DBSecurityGroup represents a RDS DB Security Group which controls network access to a DB instance that is not inside a VPC
// See http://goo.gl/JF5oJy for more details.
type DBSecurityGroup struct {
	Name              string             `xml:"DBSecurityGroupName"`
	Description       string             `xml:"DBSecurityGroupDescription"`
	EC2SecurityGroups []EC2SecurityGroup `xml:"EC2SecurityGroups"`
	IPRanges          []IPRange          `xml:"IPRanges"`
	OwnerId           string             `xml:"OwnerId"`
	VpcId             string             `xml:"VpcId"`
}

// DBSecurityGroupMembership represents a DBSecurityGroup which a Database Instance belongs to
// See http://goo.gl/QjTK0b for more details.
type DBSecurityGroupMembership struct {
	Name   string `xml:"DBSecurityGroupName"`
	Status string `xml:"Status"`
}

// DBSnapshot represents a snapshot of a Database (a backup of the Instance data)
// See http://goo.gl/wkf0L9 for more details.
type DBSnapshot struct {
	AllocatedStorage     int    `xml:"AllocatedStorage"` // Specifies the allocated storage size in gigabytes (GB)
	AvailabilityZone     string `xml:"AvailabilityZone"`
	DBInstanceIdentifier string `xml:"DBInstanceIdentifier"`
	DBSnapshotIdentifier string `xml:"DBSnapshotIdentifier"`
	Engine               string `xml:"Engine"`
	EngineVersion        string `xml:"EngineVersion"`
	InstanceCreateTime   string `xml:"InstanceCreateTime"`
	Iops                 int    `xml:"Iops"`
	LicenseModel         string `xml:"LicenseModel"`
	MasterUsername       string `xml:"MasterUsername"`
	OptionGroupName      string `xml:"OptionGroupName"`
	PercentProgress      int    `xml:"PercentProgress"`
	Port                 int    `xml:"Port"`
	SnapshotCreateTime   string `xml:"SnapshotCreateTime"`
	SnapshotType         string `xml:"SnapshotType"`
	SourceRegion         string `xml:"SourceRegion"`
	Status               string `xml:"Status"`
	VpcId                string `xml:"VpcId"`
}

// DBSubnetGroup is a collection of subnets that is designated for an RDS DB Instance in a VPC
// See http://goo.gl/8vMPkE for more details.
type DBSubnetGroup struct {
	Name        string   `xml:"DBSubnetGroupName"`
	Description string   `xml:"DBSubnetGroupDescription"`
	Status      string   `xml:"SubnetGroupStatus"`
	Subnets     []Subnet `xml:"Subnets>Subnet"`
	VpcId       string   `xml:"VpcId"`
}

// EC2SecurityGroup a standard EC2 Security Group which can be assigned to a DB Instance
// See http://goo.gl/AWavZ2 for more details.
type EC2SecurityGroup struct {
	Id      string `xml:"EC2SecurityGroupId"`
	Name    string `xml:"EC2SecurityGroupName"`
	OwnerId string `xml:"EC2SecurityGroupOwnerId"` // The AWS ID of the owner of the EC2 security group
	Status  string `xml:"Status"`                  // Status can be "authorizing", "authorized", "revoking", and "revoked"
}

// Endpoint encapsulates the connection endpoint for a DB Instance
// See http://goo.gl/jefsJ4 for more details.
type Endpoint struct {
	Address string `xml:"Address"`
	Port    int    `xml:"Port"`
}

// EngineDefaults describes the system parameter information for a given database engine
// See http://goo.gl/XFy7Wv for more details.
type EngineDefaults struct {
	DBParameterGroupFamily string      `xml:"DBParameterGroupFamily"`
	Marker                 string      `xml:"Marker"`
	Parameters             []Parameter `xml:"Parameters"`
}

// Event encapsulates events related to DB instances, DB security groups, DB snapshots, and DB parameter groups
// See http://goo.gl/6fUQow for more details.
type Event struct {
	Date             string   `xml:"Date"`             // Specifies the date and time of the event
	EventCategories  []string `xml:"EventCategories"`  // Specifies the category for the event
	Message          string   `xml:"Message"`          // Provides the text of this event
	SourceIdentifier string   `xml:"SourceIdentifier"` // Provides the identifier for the source of the event
	SourceType       string   `xml:"SourceType"`       // Valid Values: db-instance | db-parameter-group | db-security-group | db-snapshot
}

// EventCategoriesMap encapsulates event categories for the specified source type
// See http://goo.gl/9VY3aS for more details.
type EventCategoriesMap struct {
	EventCategories []string `xml:"EventCategories"`
	SourceType      string   `xml:"SourceType"`
}

// EventSubscription describes a subscription, for a customer account, to a series of events
// See http://goo.gl/zgNdXw for more details.
type EventSubscription struct {
	CustSubscriptionId       string   `xml:"CustSubscriptionId"`       // The RDS event notification subscription Id
	CustomerAwsId            string   `xml:"CustomerAwsId"`            // The AWS customer account associated with the RDS event notification subscription
	Enabled                  bool     `xml:"Enabled"`                  // True indicates the subscription is enabled
	EventCategoriesList      []string `xml:"EventCategoriesList"`      // A list of event categories for the RDS event notification subscription
	SnsTopicArn              string   `xml:"SnsTopicArn"`              // The topic ARN of the RDS event notification subscription
	SourceIdsList            []string `xml:"SourceIdsList"`            // A list of source Ids for the RDS event notification subscription
	SourceType               string   `xml:"SourceType"`               // The source type for the RDS event notification subscription
	Status                   string   `xml:"Status"`                   // Can be one of the following: creating | modifying | deleting | active | no-permission | topic-not-exist
	SubscriptionCreationTime string   `xml:"SubscriptionCreationTime"` // The time the RDS event notification subscription was created
}

// IPRange encapsulates an IP range (and its status) used by a DB Security Group
// See http://goo.gl/VfntNm for more details.
type IPRange struct {
	CIDRIP string `xml:"CIDRIP"`
	Status string `xml:"Status"` // Specifies the status of the IP range. Status can be "authorizing", "authorized", "revoking", and "revoked".
}

// Option describes a feature available for an RDS instance along with any settings applicable to it
// See http://goo.gl/8DYY0J for more details.
type Option struct {
	Name                        string                       `xml:"OptionName"`
	Description                 string                       `xml:"OptionDescription"`
	Settings                    []OptionSetting              `xml:"OptionSettings"`
	Permanent                   bool                         `xml:"Permanent"`
	Persistent                  bool                         `xml:"Persistent"`
	Port                        int                          `xml:"Port"`
	DBSecurityGroupMemberships  []DBSecurityGroupMembership  `xml:"DBSecurityGroupMemberships"`  // If the option requires access to a port, then this DB security group allows access to the port
	VpcSecurityGroupMemberships []VpcSecurityGroupMembership `xml:"VpcSecurityGroupMemberships"` // If the option requires access to a port, then this VPC security group allows access to the port
}

// OptionConfiguration is a list of all available options
// See http://goo.gl/kkEzw1 for more details.
type OptionConfiguration struct {
	OptionName                  string          `xml:"OptionName"`
	OptionSettings              []OptionSetting `xml:"OptionSettings"`
	Port                        int             `xml:"Port"`
	DBSecurityGroupMemberships  []string        `xml:"DBSecurityGroupMemberships"`
	VpcSecurityGroupMemberships []string        `xml:"VpcSecurityGroupMemberships"`
}

// OptionGroup represents a set of features, called options, that are available for a particular Amazon RDS DB instance
// See http://goo.gl/NedBJl for more details.
type OptionGroup struct {
	Name                                  string   `xml:"OptionGroupName"`
	Description                           string   `xml:"OptionGroupDescription"`
	VpcId                                 string   `xml:"VpcId"`
	AllowsVpcAndNonVpcInstanceMemberships bool     `xml:"AllowsVpcAndNonVpcInstanceMemberships"`
	EngineName                            string   `xml:"EngineName"`
	MajorEngineVersion                    string   `xml:"MajorEngineVersion"`
	Options                               []Option `xml:"Options"`
}

// OptionGroupMembership provides information on the option groups the DB instance is a member of
// See http://goo.gl/XBW6j4 for more details.
type OptionGroupMembership struct {
	Name   string `xml:"OptionGroupName"` // The name of the option group that the instance belongs to
	Status string `xml:"Status"`          // The status of the option group membership, e.g. in-sync, pending, pending-maintenance, applying
}

// OptionGroupOption represents an option within an option group
// See http://goo.gl/jQYL0U for more details.
type OptionGroupOption struct {
	DefaultPort                       int                        `xml:"DefaultPort"`
	Description                       string                     `xml:"Description"`
	EngineName                        string                     `xml:"EngineName"`
	MajorEngineVersion                string                     `xml:"MajorEngineVersion"`
	MinimumRequiredMinorEngineVersion string                     `xml:"MinimumRequiredMinorEngineVersion"`
	Name                              string                     `xml:"Name"`
	OptionGroupOptionSettings         []OptionGroupOptionSetting `xml:"OptionGroupOptionSettings"`
	OptionsDependedOn                 string                     `xml:"OptionsDependedOn"`
	Permanent                         bool                       `xml:"Permanent"`
	Persistent                        bool                       `xml:"Persistent"`
	PortRequired                      bool                       `xml:"PortRequired"`
}

// OptionGroupOptionSetting are used to display settings available for each option with their default values and other information
// See http://goo.gl/9aIwNX for more details.
type OptionGroupOptionSetting struct {
	AllowedValues      string `xml:"AllowedValues"`
	ApplyType          string `xml:"ApplyType"`
	DefaultValue       string `xml:"DefaultValue"`
	IsModifiable       bool   `xml:"IsModifiable"`
	SettingDescription string `xml:"SettingDescription"`
	SettingName        string `xml:"SettingName"`
}

// OptionSetting encapsulates modifiable settings for a particular option (a feature available for a Database Instance)
// See http://goo.gl/VjOJmW for more details.
type OptionSetting struct {
	Name          string `xml:"Name"`
	Value         string `xml:"Value"`
	Description   string `xml:"Description"`
	AllowedValues string `xml:"AllowedValues"`
	ApplyType     string `xml:"ApplyType"`
	DataType      string `xml:"DataType"`
	DefaultValue  string `xml:"DefaultValue"`
	IsCollection  bool   `xml:"IsCollection"`
	IsModifiable  bool   `xml:"IsModifiable"`
}

// OrderableDBInstanceOption contains a list of available options for a DB instance
// See http://goo.gl/FVPeVC for more details.
type OrderableDBInstanceOption struct {
	AvailabilityZones  []AvailabilityZone `xml:"AvailabilityZones"`
	DBInstanceClass    string             `xml:"DBInstanceClass"`
	Engine             string             `xml:"Engine"`
	EngineVersion      string             `xml:"EngineVersion"`
	LicenseModel       string             `xml:"LicenseModel"`
	MultiAZCapable     bool               `xml:"MultiAZCapable"`
	ReadReplicaCapable bool               `xml:"ReadReplicaCapable"`
	Vpc                bool               `xml:"Vpc"`
}

// Parameter is used as a request parameter in various actions
// See http://goo.gl/cJmvVT for more details.
type Parameter struct {
	AllowedValues        string `xml:"AllowedValues"`
	ApplyMethod          string `xml:"ApplyMethod"` // Valid Values: immediate | pending-reboot
	ApplyType            string `xml:"ApplyType"`
	DataType             string `xml:"DataType"`
	Description          string `xml:"Description"`
	IsModifiable         bool   `xml:"IsModifiable"`
	MinimumEngineVersion string `xml:"MinimumEngineVersion"`
	ParameterName        string `xml:"ParameterName"`
	ParameterValue       string `xml:"ParameterValue"`
	Source               string `xml:"Source"`
}

// PendingModifiedValues represents values modified in a ModifyDBInstance action
// See http://goo.gl/UoXhLH for more details.
type PendingModifiedValues struct {
	AllocatedStorage      int    `xml:"AllocatedStorage"`
	BackupRetentionPeriod int    `xml:"BackupRetentionPeriod"`
	DBInstanceClass       string `xml:"DBInstanceClass"`
	DBInstanceIdentifier  string `xml:"DBInstanceIdentifier"`
	EngineVersion         string `xml:"EngineVersion"`
	Iops                  int    `xml:"Iops"`
	MasterUserPassword    string `xml:"MasterUserPassword"`
	MultiAZ               bool   `xml:"MultiAZ"`
	Port                  string `xml:"Port"`
}

// RecurringCharge describes an amount that will be charged on a recurring basis with a given frequency
// See http://goo.gl/3GDplh for more details.
type RecurringCharge struct {
	Amount    float64 `xml:"RecurringChargeAmount"`
	Frequency string  `xml:"RecurringChargeFrequency"`
}

// ReservedDBInstance encapsulates a reserved Database Instance
// See http://goo.gl/mjLhNI for more details.
type ReservedDBInstance struct {
	CurrencyCode                  string            `xml:"CurrencyCode"`
	DBInstanceClass               string            `xml:"DBInstanceClass"`
	DBInstanceCount               int               `xml:"DBInstanceCount"`
	Duration                      int               `xml:"Duration"`
	FixedPrice                    float64           `xml:"FixedPrice"`
	MultiAZ                       bool              `xml:"MultiAZ"`
	OfferingType                  string            `xml:"OfferingType"`
	ProductDescription            string            `xml:"ProductDescription"`
	RecurringCharges              []RecurringCharge `xml:"RecurringCharges"`
	ReservedDBInstanceId          string            `xml:"ReservedDBInstanceId"`
	ReservedDBInstancesOfferingId string            `xml:"ReservedDBInstancesOfferingId"`
	StartTime                     string            `xml:"StartTime"`
	State                         string            `xml:"State"`
	UsagePrice                    float64           `xml:"UsagePrice"`
}

// ReservedDBInstancesOffering describes an available Reserved DB instance offering which can be purchased
// See http://goo.gl/h5s8e6 for more details.
type ReservedDBInstancesOffering struct {
	CurrencyCode                  string            `xml:"CurrencyCode"`
	DBInstanceClass               string            `xml:"DBInstanceClass"`
	Duration                      int               `xml:"Duration"`
	FixedPrice                    float64           `xml:"FixedPrice"`
	MultiAZ                       bool              `xml:"MultiAZ"`
	OfferingType                  string            `xml:"OfferingType"`
	ProductDescription            string            `xml:"ProductDescription"`
	RecurringCharges              []RecurringCharge `xml:"RecurringCharges"`
	ReservedDBInstancesOfferingId string            `xml:"ReservedDBInstancesOfferingId"`
	UsagePrice                    float64           `xml:"UsagePrice"`
}

// Subnet describes an EC2 subnet, along with its status and location
// See http://goo.gl/Nc8ymd for more details.
type Subnet struct {
	Id               string           `xml:"SubnetIdentifier"`
	Status           string           `xml:"SubnetStatus"`
	AvailabilityZone AvailabilityZone `xml:"SubnetAvailabilityZone"`
}

// Tag represents metadata assigned to an Amazon RDS resource consisting of a key-value pair
// See http://goo.gl/YnXRrE for more details.
type Tag struct {
	Key   string `xml:"Key"`
	Value string `xml:"Value"`
}

// VpcSecurityGroupMembership describes a standard VPC Security Group which has been assigned to a DB Instance located in a VPC
// See http://goo.gl/UIvmlS for more details.
type VpcSecurityGroupMembership struct {
	Id     string `xml:"VpcSecurityGroupId"`
	Status string `xml:"Status"`
}
