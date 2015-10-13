## System Console Settings

The System Console user interface lets system administrators manage a Mattermost server and multiple teams from a web-based user interface. The first user added to a new Mattermost install is assigned the system administrator role and can access the System Console from the main menu of any team. Setting changes in the System Console are stored in `config.json`. 

### Service Settings

General settings to configure the listening address, login security, testing, webhooks and service integration of Mattermost. 

#### System

```"ListenAddress": ":8065"```  
The IP address on which to listen and the port on which to bind. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065". Changing this will require a server restart before taking effect.

```"MaximumLoginAttempts": 10```  
Failed login attempts allowed before a user is locked out and required to reset their password via email.

```"SegmentDeveloperKey": ""```  
For users running SaaS services, signup for a key at Segment.com to track metrics.

```"GoogleDeveloperKey": ""```  
Set this key to enable embedding of YouTube video previews based on hyperlinks appearing in messages or comments. Instructions to obtain a key available at https://www.youtube.com/watch?v=Im69kzhpR3I. Leaving the field blank disables the automatic generation of YouTube video previews from links.

```"EnableTesting": false```  
"true": `/loadtest` slash command is enabled to load test accounts and test data.

```"EnableSecurityFixAlert": true```  
”true”: System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.

#### Webhooks

```"EnableIncomingWebhooks": true```  
Developers building integrations can create webhook URLs for channels and private groups. Please see http://mattermost.org/webhooks to learn about creating webhooks, view samples, and to let the community know about integrations you have built. "true": Incoming webhooks will be allowed. To manage incoming webhooks, go to Account Settings -> Integrations. The webhook URLs created in Account Settings can be used by external applications to create posts in any channels or private groups that you have access to; “false”: The Integrations tab of Account Settings is hidden and incoming webhooks are disabled.

Security note: By enabling this feature, users may be able to perform [phishing attacks](https://en.wikipedia.org/wiki/Phishing) by attempting to impersonate other users. To combat these attacks, a BOT tag appears next to all posts from a webhook. Enable at your own risk.

```"EnablePostUsernameOverride": false```  
"true": Webhooks will be allowed to change the username they are posting as; “false”: Webhooks can only post as the username they were set up with. See http://mattermost.org/webhooks for more details.

```"EnablePostIconOverride": false```  
"true": Webhooks will be allowed to change the icon they post with; “false”: Webhooks can only post with the profile picture of the account they were set up with. See http://mattermost.org/webhooks for more details.

### Team Settings

Settings to configure the appearance, size, and access options for teams.

```"SiteName": "Mattermost"```  
Name of service shown in login screens and UI.

```"MaxUsersPerTeam": 50```  
Maximum number of users per team, including both active and inactive users.

```"EnableTeamCreation": true```  
"true": Ability to create a new team is enabled for all users; “false”: the ability to create teams is disabled. The Create A New Team button is hidden in the main menu UI.

```"EnableUserCreation": true```  
"true": Ability to create new accounts is enabled via inviting new members or sharing the team invite link; “false”: the ability to create accounts is disabled. The create account button displays an error when trying to signup via an email invite or team invite link.

```"RestrictCreationToDomains": ""```  
Teams can only be created by a verified email from this list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.org").


### SQL Settings

Settings to configure the data sources, connections, and encryption of SQL databases. Changing properties in this section will require a server restart before taking effect. 

```"DriverName": "mysql"```  
"mysql": enables driver to MySQL database; "postgres": enables driver to PostgreSQL database. This setting can only be changed from config.json file, it cannot be changed from the System Console user interface.

```"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8"```  
This is the connection string to the master database. When **DriverName**="postgres" then use a connection string in the form “postgres://mmuser:password@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10”. This setting can only be changed from config.json file, it cannot be changed from the System Console user interface.

```"DataSourceReplicas": []```  
This is a list of connection strings pointing to read replicas of MySQL or PostgreSQL database.  If running a single server, set to DataSource. This setting can only be changed from config.json file, it cannot be changed from the System Console user interface.

```"MaxIdleConns": 10```  
Maximum number of idle connections held open to the database.

```"MaxOpenConns": 10```  
Maximum number of open connections held open to the database.

```"Trace": false```  
"true": Executing SQL statements are written to the log for development.

```"AtRestEncryptKey": "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QVg"```  
32-character (to be randomly generated via Admin Console) salt available to encrypt and decrypt sensitive fields in database.


### Email Settings

Settings to configure email signup, notifications, security, and SMTP options. 

#### Signup

```"EnableSignUpWithEmail": true```  
"true": Allow team creation and account signup using email and password; “false”: Email signup is disabled and users are not able to invite new members. This limits signup to single-sign-on services like OAuth or LDAP.

#### Notifications

```"SendEmailNotifications": false```  
"true": Enables sending of email notifications. “false”: Disables email notifications for developers who may want to skip email setup for faster development.

```"RequireEmailVerification": false```  
"true": Require email verification after account creation prior to allowing login; “false”: Users do not need to verify their email address prior to login. Developers may set this field to false so skip sending verification emails for faster development.

```"FeedbackName": ""```  
Name displayed on email account used when sending notification emails from Mattermost system.

```"FeedbackEmail": ""```  
Address displayed on email account used when sending notification emails from Mattermost system.

#### SMTP

```"SMTPUsername": ""```  
Obtain this credential from the administrator setting up your email server.

```"SMTPPassword": ""```  
Obtain this credential from the administrator setting up your email server.

```"SMTPServer": ""```  
Location of SMTP email server.

```"SMTPPort": ""```  
Port of SMTP email server.

#### Security

```"ConnectionSecurity": ""```  
"none": Send email over an unsecure connection; "TLS": Communication between Mattermost and your email server is encrypted; “STARTTLS”: Attempts to upgrade an existing insecure connection to a secure connection using TLS.

```"InviteSalt": "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9YoS"```  
32-character (to be randomly generated via Admin Console) salt added to signing of email invites.


```"PasswordResetSalt": "vZ4DcKyVVRlKHHJpexcuXzojkE5PZ5eL"```  
32-character (to be randomly generated via Admin Console) salt added to signing of password reset emails.


### File Settings

Settings to configure storage, appearance, and security of files and images.

#### File Storage

```"DriverName": "local"```  
System used for file storage. “local”: Files and images are stored on the local file system. “amazons3”: Files and images are stored on Amazon S3 based on the provided access key, bucket and region fields.

```"Directory": "./data/"```  
Directory to which files are written. If blank, directory will be set to ./data/.

```"AmazonS3AccessKeyId": ""```  
Obtain this credential from your Amazon EC2 administrator.

```"AmazonS3SecretAccessKey": ""```  
Obtain this credential from your Amazon EC2 administrator.

```"AmazonS3Bucket": ""```  
Name you selected for your S3 bucket in AWS.

```"AmazonS3Region": ""```  
AWS region you selected for creating your S3 bucket. Refer to [AWS Reference Documentation](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region) and choose this variable from the Region column.

#### Image Settings

```"ThumbnailWidth": 120```  
Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.

```"ThumbnailHeight": 100```  
Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.

```"PreviewWidth": 1024```  
Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.

```"PreviewHeight": 0```  
Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.

```"ProfileWidth": 128```  
The width to which profile pictures are resized after being uploaded via Account Settings.

```"ProfileHeight": 128```  
The height to which profile pictures are resized after being uploaded via Account Settings.

```"EnablePublicLink": true```  
”true”: Allow users to share public links to files and images when previewing; “false”: The Get Public Link option is hidden from the image preview user interface.

```"PublicLinkSalt": "A705AklYF8MFDOfcwh3I488G8vtLlVip"```  
32-character (to be randomly generated via Admin Console) salt added to signing of public image links.


### Log Settings

Settings to configure the console and log file output, detail level, format and location of error messages.

#### Console Settings

```"EnableConsole": true```  
“true”: Output log messages to the console based on **ConsoleLevel** option. The server writes messages to the standard output stream (stdout).

```"ConsoleLevel": "DEBUG"```  
Level of detail at which log events are written to the console when **EnableConsole**=true. ”ERROR”: Outputs only error messages; “INFO”: Outputs error messages and information around startup and initialization; “DEBUG”: Prints high detail for developers debugging issues.

#### Log File Settings

```"EnableFile": true```  
”true”:  Log files are written to files specified in **FileLocation**.

```"FileLevel": "INFO"```  
Level of detail at which log events are written to log files when **EnableFile**=true. “ERROR”: Outputs only error messages; “INFO”: Outputs error messages and information around startup and initialization; “DEBUG”: Prints high detail for developers debugging issues.

```"FileFormat": ""```  
Format of log message output. If blank, **FileFormat** = "[%D %T] [%L] (%S) %M", where: 
  
    %T		Time (15:04:05 MST) 
    %t		Time (15:04) 
    %D		Date (2006/01/02) 
    %d		Date (01/02/06) 
    %L		Level (FNST, FINE, DEBG, TRAC, WARN, EROR, CRIT) 
    %S		Source 
    %M		Message

```"FileLocation": ""```  
Directory to which log files are written. If blank, log files write to ./logs/mattermost/mattermost.log. Log rotation is enabled and every 10,000 lines of log information is written to new files stored in the same directory, for example mattermost.2015-09-23.001, mattermost.2015-09-23.002, and so forth.

### Rate Limit Settings

Settings to enable API rate limiting and configure requests per second, user sessions and variables for rate limiting. Changing properties in this section will require a server restart before taking effect.

```"EnableRateLimiter": true```  
”true”: APIs are throttled at the rate specified by **PerSec**.

```"PerSec": 10```  
Throttle API at this number of requests per second if **EnableRateLimiter**=true.

```"MemoryStoreSize": 10000```  
Maximum number of user sessions connected to the system as determined by **VaryByRemoteAddr** and **VaryByHeader** variables.

```"VaryByRemoteAddr": true```  
"true": Rate limit API access by IP address.

```"VaryByHeader": ""```  
Vary rate limiting by HTTP header field specified (e.g. when configuring Ngnix set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").

### Privacy Settings

Settings to configure the name and email privacy of users on your system.  

```"ShowEmailAddress": true```  
“true”: Show email address of all users; "false": Hide email address of users from other users in the user interface, including team owners and team administrators. This is designed for managing teams where users choose to keep their contact information private.

```"ShowFullName": true```  
”true”: Show full name of all users; “false”: hide full name of users from other users including team owner and team administrators.

### GitLab Settings

Settings to configure account and team creation using GitLab OAuth.

```"Enable": false```  
“true”: Allow team creation and account signup using GitLab OAuth. To configure, input the **Secret** and **Id** credentials. 

```"Secret": ""```  
Obtain this value by logging into your GitLab account. Go to Profile Settings -> Applications -> New Application, enter a Name, then enter Redirect URLs "https://<your-mattermost-url>/login/gitlab/complete" (example: https://example.com:8065/login/gitlab/complete) and "https://<your-mattermost-url>/signup/gitlab/complete".

```"Id": ""```  
Obtain this value by logging into your GitLab account. Go to Profile Settings -> Applications -> New Application, enter a Name, then enter Redirect URLs "https://<your-mattermost-url>/login/gitlab/complete" (example: https://example.com:8065/login/gitlab/complete) and "https://<your-mattermost-url>/signup/gitlab/complete".

```"AuthEndpoint": ""```  
Enter https://<your-gitlab-url>/oauth/authorize (example: https://example.com:3000/oauth/authorize). Use HTTP or HTTPS depending on how your server is configured.

```"TokenEndpoint": ""```  
Enter https://<your-gitlab-url>/oauth/authorize (example: https://example.com:3000/oauth/token). Use HTTP or HTTPS depending on how your server is configured.

```"UserApiEndpoint": ""```  
Enter https://<your-gitlab-url>/oauth/authorize (example: https://example.com:3000/api/v3/user). Use HTTP or HTTPS depending on how your server is configured.

## Config.json Settings Not in System Console

System Console allows an IT Admin to update settings defined in `config.json`. However there are a number of settings in `config.json` unavailable in the System Console and require update from the file itself. We describe them here: 

### Service Settings

```"EnableOAuthServiceProvider": false```  
”true”: Allow Mattermost to function as an OAuth provider, allowing 3rd party apps access to your user store for authentication.

### Push Notification Settings

```"ApplePushServer": ""```  
Setting for features in development.

```"ApplePushCertPublic": ""```  
Setting for features in development.

```"ApplePushCertPrivate": ""```  
Setting for features in development.

### File Settings

```"InitialFont": "luximbi.ttf"```  
Font used in auto-generated profile pics with colored backgrounds.

### GitLab Settings

```"Scope": ""```  
Standard setting for OAuth to determine the scope of information shared with OAuth client. Not currently supported by GitLab OAuth.
