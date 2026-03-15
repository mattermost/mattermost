---
title: AWS
heading: "Mattermost Infrastructure on AWS"
description: "The majority of Mattermost's infrastructure is hosted in Amazon Web Services."
date: 2017-11-06T19:30:07-05:00
weight: 40
---

Most of our infrastructure is hosted in AWS.

## Accessing AWS

You can sign into the web console for the master AWS account at this URL:

https://mattermost.signin.aws.amazon.com/console

After signing into the master account, you can access other accounts within the organization through role switching. This can be done from the dropdown on the right side of the console's menu bar, or you can use this link to switch to the developer account:

https://signin.aws.amazon.com/switchrole?account=mattermost-dev&roleName=DeveloperRole&displayName=mattermost-dev

This will require you to have signed in using MFA (When you first enable MFA, you'll have to sign out and back in again.).

Once you switch to another account for the first time, you can quickly switch back and forth through the menu bar dropdown.

## Enabling MFA (Multi-Factor Authentication)

All developers that access AWS are required to enable MFA on their account(s). To enable MFA, follow these instructions:

1. Download Authy, Google Authenticator, or any other MFA app for your smartphone of choice
2. Sign in to the AWS console with your username/password
3. From the 'Services' dropdown in the top-left corner of the AWS Console, choose 'IAM' from the 'Security, Identity, and Compliance' section
4. Click on 'Users' in the left-most column of the page
5. Find your username in the list of users in the centre of the page and click on it
6. Click on the 'Security Credentials' tab on the 'Summary' page that appears
7. Click on the pencil icon beside the 'Assigned MFA device' label in the 'Sign-in credentials' section
8. Follow the on-screen instructions to activate MFA on your device
9. Sign out of the AWS Console and sign back in

## Accessing the Machines on AWS

Most of the machines at the time of writing use an SSH key. If the description for the machine says it uses a key such as "mm-admin", "mm-ci", or "mm-dev", you'll need to get that key from someone else.

If the machine does not have an SSH key associated with it, you'll need to generate an SSH key and have it signed by [Vault](../vault/).

## Creating Machines on AWS

Unless the machine is for your personal use only, use [Vault](../vault/) to control access to it: Create it *without* a key, then give it the following user data.

```yaml
#cloud-config
bootcmd:
  - cloud-init-per once ssh-users-ca echo "TrustedUserCAKeys /etc/ssh/trusted_ca_keys.pub" >> /etc/ssh/sshd_config
write_files:
  - path: /etc/ssh/trusted_ca_keys.pub
    content: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDHDwQhQ3eRiW4CV5RKAJb0n9P/07aHrku5hAVc+M59ejZHPVD/4sEfSaKvIXNTcY5TsrudzEhY3nVBsJDcJjb5qC5ayy+JNGFNnF05JoZ4E3tggJm5HQv3Znm/N6s65ZMA0HsZojCvEf+K8P0AKdJWiZbZGF095+N3WL9bUQIxBmCIBVPAOQSTCo8QKeorFfxhw/XcmH3s/KDV52/hEt6RWTxaDup03r7y8fbVo81F4QJ2ItmHgL3vGSpJk/nkLB2RWxT6zp4JIEo7PZ6S2Gm/2jaW+B5DftUd0gI8GKo9+vhtWjEEbOdu/mz92/GHLHW+s3TnftLeXVs7a8UYwdh/qJ4P64U3wlA//igo7ToXONsZ4TwmcKg6FD9JAq+LKTC0+prx/Gulx5esiPS+bgnkM/CMuoWMtucLoXaNz9ELBmeb6QSj1a7T/4LFzBiefT977OIhglORnEsKvY0HXvzX66a73Lm3bC9mUXxi1HSJNTDdLOmnVK+ipVjViy2/C9KJmKL3ePwBQSJ9d9IK76W4SGXTGT4mTVBSSF6j+/2a4tXq9c3NCuEWyXgPJRP1t6Iib42oAosxPoZ4zeBZM05BHbveD2b0G/bmeaZRgsEaZ3Qjnr50a6Wke7Vr9q3QGjn3+8QEdUdrnCTN8dlloLYhwY9pgh1JEYDaCdPHSP1ppw==
```

## Best Practices

* Do not configure services to use access keys that are associated with a human IAM user. Create separate IAM users for each service and write strict access policies for them.
* Do not create multiple IAM users for yourself. There are extremely few legitimate reasons for a human to need a second IAM user.
* Do not use access tokens if you can use IAM roles instead. For example, services running on an EC2 instance should almost never use tokens.
* We can create new AWS accounts within seconds. Don't be afraid to ask for a clean one. New production services can be placed in their own account for increased security and isolation. If you need to dirty up an account with experiments or testing, you can also do so in a dedicated account.
