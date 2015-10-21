### Mattermost Email Troubleshooting

#### Update Email Settings in System Console
* Login to Mattermost with an account that has the `system admin` role
* Open the System Console by clicking on **...** > **System Console** > **Email Settings*
    * Change **Send Email Notifications** to **true**
    * Change **Require Email Verification** to **true**
* Set **Notification Email Address** must be set and must be a valid email allowed as the **FROM** field on the email server.  Some email servers will only allow certian accounts to send emails.
* Set the **SMTP** fields based on your email service.  Some known good samples are listed below.
* If you fill in **SMTP Username** and **SMTP Password** then you must set **Connection Security** to **TLS** or to **STARTTLS**
* Once you've filled in all the information please make sure to **Test Connection**
* If the test failed please look in **OTHER** > **Logs** for any errors that look like `[EROR] /api/v1/admin/test_email ...`

#### Known Good Sample Settings

##### Amazon SES
* Set **SMTP Username** to **AKIASKLDSKDIWEOWE**
* Set **SMTP Password** to **AdskfjAKLSDJShflsdfjkakldADkjkjdfKAJDSlkjweiqQIWEOU**
* Set **SMTP Server** to **email-smtp.us-east-1.amazonaws.com**
* Set **SMTP Port** to **465**
* Set **Connection Security** to **TLS**

##### Postfix
* Make sure Postfix is installed on the machine where Mattermost is installed
* Set **SMTP Username** to **<empty>**
* Set **SMTP Password** to **<empty>**
* Set **SMTP Server** to **localhost**
* Set **SMTP Port** to **25**
* Set **Connection Security** to **<empty>**

##### Gmail
* Information needed

##### Office 365
* Information needed

##### Hotmail
* Information needed


test connection
check error logs
search for specific smtp errors like '555' with your provider.

Adv Email trouble shooting
from the machine (if docker then exec)
run telnet to make sure host/port is correct
issue ELHO cmd to see if you can see stuff like STARTTSL

