
## SMTP Email Setup

In some product evaluation setups, email is intentionally bypassed by setting `SendEmailNotifications=false`. This option allows account creation and system operation without having to set up an email service (e.g. no email verification is required for account creation). This also means neither email notifications nor password reset by email are available.

To enable email, turn this option on by setting `SendEmailNotifications=true` and configuring an SMTP email service as follows: 

1.  **Set up an SMTP email sending service.** (If you already have credentials for a SMTP server you can skip this step.)
	1. [Setup Amazon Simple Email Service](https://console.aws.amazon.com/ses)
	2. From the `SMTP Settings` menu click `Create My SMTP Credentials`
	3. Copy the `Server Name`, `Port`, `SMTP Username`, and `SMTP Password`
	4. From the `Domains` menu setup and verify a new domain. It it also a good practice to enable `Generate DKIM Settings` for this domain.
	5. Choose an email address like `mattermost@example.com` for Mattermost to send emails from.
	6. Test sending an email from `mattermost@example.com` by clicking the `Send a Test Email` button and verify everything appears to be working correctly.
2.  **Modify the Mattermost configuration file config.json or config_docker.json with the SMTP information.**
	1. If you're running Mattermost on Amazon Beanstalk you can shell into the instance with the following commands
	2. `ssh ec2-user@[domain for the docker instance]`
	3. `sudo gpasswd -a ec2-user docker`
	4. Retrieve the name of the container with `sudo docker ps`
	5. `sudo docker exec -ti container_name /bin/bash`
3.  **Edit the config file `vi /config_docker.json` with the settings you captured from the step above.**
	1.  See an example below and notice `SendEmailNotifications` has been set to `true`
	```
	"EmailSettings": {
        	"EnableSignUpWithEmail": true,
        	"SendEmailNotifications": true,
        	"RequireEmailVerification": true,
        	"FeedbackName": "No-Reply",
        	"FeedbackEmail": "mattermost@example.com",
        	"SMTPUsername": "AFIADTOVDKDLGERR",
        	"SMTPPassword": "DFKJoiweklsjdflkjOIGHLSDFJewiskdjf",
        	"SMTPServer": "email-smtp.us-east-1.amazonaws.com",
        	"SMTPPort": "465",
        	"ConnectionSecurity": "TLS",
        	"InviteSalt": "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9YoS",
        	"PasswordResetSalt": "vZ4DcKyVVRlKHHJpexcuXzojkE5PZ5eL",
        	"ApplePushServer": "",
        	"ApplePushCertPublic": "",
        	"ApplePushCertPrivate": ""
	},
	```
4.  **Restart Mattermost**
	1. Find the process id with `ps -A` and look for the process named `platform`
	2. Kill the process `kill pid`
	3. The service should restart automatically. Verify the Mattermost service is running with `ps -A`
	4. Current logged in users will not be affected, but upon logging out or session expiration users will be required to verify their email address.
