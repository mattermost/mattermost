
## SMTP Email Setup

In product evaluation setups with single-container Docker instances, email is intentionally disabled. This allows account creation and system operation without having to set up email, but it also means email notification and password reset functionality aren't available. 

### How to enable email 

To enable email, configure an SMTP email service as follows: 

1.  **Set up an SMTP email sending service** (if you don't yet have an SMTP service with credentials) 
	1. Any SMTP email service can be used, you just need the following information: `Server Name`, `Port`, `SMTP Username`, and `SMTP Password`. 
	     2. If you don't have an SMTP service, here are simple instructions to set one up with [Amazon Simple Email Service (SES)](https://aws.amazon.com/ses/):
	         2. Go to [Amazon SES console](https://console.aws.amazon.com/ses) then `SMTP Settings > Create My SMTP Credentials`
	         3. Copy the `Server Name`, `Port`, `SMTP Username`, and `SMTP Password` for Step 2 below. 
	         4. From the `Domains` menu set up and verify a new domain, then enable `Generate DKIM Settings` for the domain.
	         5. Choose an sender address like `mattermost@example.com` and click `Send a Test Email` to verify setup is working correctly. 
2.  **Configure SMTP settings** 
	1.  Open the **System Console** by logging into an existing team and accessing "System Console" from the main menu.
	     1.  Alternatively, if a team doesn't yet exist, go to `http://dockerhost:8065/` in your browser, create a team, then from the main menu click **System Console**
	2.  Go to the **Email Settings** tab and configure the following:  
	       1. **Allow Sign Up With Email:** `true`
	       2. **Send Email Notifications:** `true`
	       3. **Require Email Verification:** `true`
	       4. **Notification Display Name:** Display name on email account sending notifications
	       5. **Notification Email Address:** Email address displayed on email account used to send notifications
	       6. **SMTP Username**: `SMTP Username` from Step 1
	       7. **SMTP Password**: `SMTP Password` from Step 1
	       8. **SMTP Server**: `SMTP Server` from Step 1
	       9. **SMTP Port**: `SMTP Port` from Step 1
	       10. **Connection Security**: `TLS (Recommended)`
	       11. Then click **Save**

3.  **Restart Mattermost**
	1. Use `ps -A`  to find the process ID ("pid") for service named `platform` and stop it using `kill [pid]`
	2. The service should restart automatically. Run `ps -A` to verify the `platform` is running again 
	3. Use the reset password page (E.g. _example.com/teamname/reset_password_) to test that email is now working by entering your email and clicking **Reset my password**.
	4. Note: The next time users log out, or when their session tokens expire, each will be required to verify their email address.

### Troubleshooting SMTP

If you have issues with your SMTP install, from your Mattermost team site go to the main menu and open **System Console -> Logs** to look for error messages related to your setup. You can do a search for the error code to narrow down the issue. Sometimes ISPs require nuanced setups for SMTP and error codes can hint at how to make the proper adjustments. 

For example, if **System Console -> Logs** has an error code reading: 

```
Connection unsuccessful: Failed to add to email address - 554 5.7.1 <unknown[IP-ADDRESS]>: Client host rejected: Access denied
```

Search for `554 5.7.1 error` and `Client host rejected: Access denied`.


