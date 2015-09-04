
## SMTP Email Setup

In some product evaluation setups email is intentionally bypassed using a `ByPassEmail=true` option. This option allows account creation and system operation without having to set up an email service (email verification is bypassed). 

To enable email, turn this option off by setting `ByPassEmail=false` and configuring an SMTP email service as follows: 

1.  **Set up an SMTP email sending service.** (If you already have credentials for a SMTP server you can skip this step.)
	1. [Setup Amazon Simple Email Service](https://console.aws.amazon.com/ses)
	2. From the `SMTP Settings` menu click `Create My SMTP Credentials`
	3. Copy the `Server Name`, `Port`, `SMTP Username`, and `SMTP Password`
	4. From the `Domains` menu setup and verify a new domain. It it also a good practice to enable `Generate DKIM Settings` for this domain.
	5. Choose an email address like `feedback@example.com` for Mattermost to send emails from.
	6. Test sending an email from `feedback@example.com` by clicking the `Send a Test Email` button and verify everything appears to be working correctly.
2.  **Modify the Mattermost configuration file config.json or config_docker.json with the SMTP information.**
	1. If you're running Mattermost on Amazon Beanstalk you can shell into the instance with the following commands
	2. `ssh ec2-user@[domain for the docker instance]`
	3. `sudo gpasswd -a ec2-user docker`
	4. Retrieve the name of the container with `sudo docker ps`
	5. `sudo docker exec -ti container_name /bin/bash`
3.  **Edit the config file `vi /config_docker.json` with the settings you captured from the step above.**
	1.  See an example below and notice `ByPassEmail` has been set to `false`
	``` bash
	"EmailSettings": { 
		"ByPassEmail" : false, 
		"SMTPUsername": "AKIADTOVBGERKLCBV", 
		"SMTPPassword": "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY", 
		"SMTPServer": "email-smtp.us-east-1.amazonaws.com:465", 
		"UseTLS": true, 
		"FeedbackEmail": "feedback@example.com", 
		"FeedbackName": "Feedback", 
		"ApplePushServer": "", 
		"ApplePushCertPublic": "", 
		"ApplePushCertPrivate": ""
	}
	```
4.  **Restart Mattermost**
	1. Find the process id with `ps -A` and look for the process named `platform`
	2. Kill the process `kill pid`
	3. The service should restart automatically. Verify the Mattermost service is running with `ps -A`
	4. Current logged in users will not be affected, but upon logging out or session expiration users will be required to verify their email address.
