---
title: "VPN(CLOUD)"
heading: "Setting up VPN Access on Pritunl"
description: "Learn how to use a VPN service with Mattermost to enjoy additional layers of protection."
date: 2018-06-05T16:08:19+02:00
weight: 20
---

Table of contents
- [Setup VPN access on Pritunl](#setup-vpn-access-on-pritunl)
  - [Viscosity client](#viscosity-client)
  - [Pritunl client](#pritunl-client)
- [Gnome VPN Client](#gnome-vpn-client)
- [Older Setup of VPN access on OpenVPN](#older-setup-of-vpn-access-on-openvpn)

## Setup VPN access on Pritunl

### Viscosity client
1. Install a VPN client that supports DNS settings such as Visocity.

```bash
brew cask install viscosity
```

2. Go to the [VPN server](https://pritunl.core.cloud.mattermost.com) and select **Sign in with OneLogin**.
Then connect with your OneLogin username and password and when prompt put the OTP (One Time Password).
Select `Show More` and hit `Download Profile`
<span style="display:block;text-align:center;width:40%">![Pritunl User Profiles](/img/vpn_cloud_4.png)</span>


3. Open the Viscosity application or your preferred VPN client and go to settings/preferences.

4. Click + to import the profile you downloaded from the VPN server on the step 1
    <span style="display:block;text-align:center;width:50%">![Viscosity Profile Add](/img/vpn_cloud_2.png)</span>

5. After your profile is imported, select to edit the entry,

- On the General tab update the Address of the Remote Server to be: `pritunl.core.cloud.mattermost.com` as shown below:
   <span style="display:block;text-align:center;width:50%">![General settings Viscosity](/img/vpn_cloud_5.jpg)</span>

- Go to Networking tab and update the DNS settings.
   * Select for the Mode to be `Full DNS`.
   * As `Servers` put: `pritunl.core.cloud.mattermost.com` which is VPN's server IP.
   * In `Domains` put: `cloud.mattermost.com`, this will split traffic for those domains
    <span style="display:block;text-align:center;width:50%">![Network settings Viscosity](/img/vpn_cloud_6.jpg)</span>

6. Add, if it is not there, in your `/etc/resolv.conf`:
    `nameserver 10.247.0.2`

    For MacOS, first check what CIDR was in the resolv.conf with `cat /etc/resolv.conf` and then you will need to run
    `sudo networksetup -setdnsservers Wi-Fi 10.247.0.2 8.8.8.8 X.X.X.X` with your extra CIDRs that they were already in
    your resolv.conf. Also check if you are connected with Wi-Fi, or to find your available devices by running
    `networksetup -listallnetworkservices` and to replace it in the above command.

7. After following these steps you should be able to connect to VPN and then to resolve private DNS entries.


### Pritunl client
1. Go to the [VPN server](https://pritunl.core.cloud.mattermost.com) and select **Sign in with OneLogin**
Then connect with your OneLogin username and password and when prompt put the OTP (One Time Password).

2. Select `Download Client` which will redirect you to download the Pritunl Client.

    Select your OS, download and install the appropriate client.
<span style="display:block;text-align:center;width:40%">![Pritunl Download Client](/img/vpn_cloud_7.jpg)</span>

1. Go back to browser and copy the `Profile URI link`
<span style="display:block;text-align:center;width:40%">![Pritunl Download Client](/img/vpn_cloud_8.jpg)</span>

4. Open the Pritunl client and paste the `Profile URI link` from previous step
   into `Import Profile URI`
   <span style="display:block;text-align:center;width:40%">![Pritunl import URI](/img/vpn_cloud_9.jpg)</span>


5. Click the burger button on the newly imported profile and select `Edit Config`
    <span style="display:block;text-align:center;width:40%">![Pritunl Config](/img/vpn_cloud_10.jpg)</span>

6. On the config change the line that says:

    `remote X.XXX.XXX.XX 1194 udp` to be:

    `remote pritunl.core.cloud.mattermost.com 1194 udp`

    {{<note "NOTE:">}}
    Do NOT change the port, it will be either 1194, 1195 or something else
   <span style="display:block;text-align:center;width:50%">![Pritunl Config remote](/img/vpn_cloud_11.jpg)</span>
    {{</note>}}

7. Add, if it is not there, in your `/etc/resolv.conf`:
    `nameserver 10.247.0.2`

    For MacOS, first check what CIDR was in the resolv.conf with `cat /etc/resolv.conf` and then you will need to run
    `sudo networksetup -setdnsservers Wi-Fi 10.247.0.2 8.8.8.8 X.X.X.X` with your extra CIDRs that they were already in
    your resolv.conf. Also check if you are connected with Wi-Fi, or to find your available devices by running
    `networksetup -listallnetworkservices` and to replace it in the above command.

8. After following these steps you should be able to connect to VPN and resolve private DNS entries.

## Gnome VPN Client
1. Go to the [VPN server](https://pritunl.core.cloud.mattermost.com) and select **Sign in with OneLogin**.

2. Connect with your OneLogin username and password and when prompted input the OTP (One Time Password).

3. Click `Download Profiles` and save the `.tar` file to your filesystem.

4. Extract the `.tar` file (`tar xf yourusername.tar`) and note the location of the `.ovpn` file.

5. Open the Gnome Settings manager and navigate to **Network > VPN**. Click the `+` to create a new VPN connection.

6. Choose **Import from file...**.

7. Select the `.ovpn` file downloaded earlier through the file picker.

8. Open the **IPv4** tab and select **Use this connection only for resources on its network**.

9. Open the **IPv6** tab and select **Use this connection only for resources on its network**.

10. If desired, rename the VPN to something friendlier in **Identity > Name**.

11. Choose **Add** to save the configuration.

12. From now on, enable the VPN through the taskbar picker in the upper right corner of Gnome.

## Older Setup of VPN access on OpenVPN


1. Login to the [VPN server](https://vpn.cloud.mattermost.com) using your mattermost email and OneLogin password. Please select `connect` instead of `login` on the drop down menu.
   * If login fails, ask Cloud team to check if your username is in the correct group

2. Please refresh the page if it says:  *Please click here to continue to download OpenVPN Connect.
You will be automatically connected after the installation has finished.*

3. Download the user-locked profile.
    <span style="display:block;text-align:center">![VPN HomePage](/img/vpn_cloud_1.png)</span>

4. Install a VPN client that supports DNS settings such as Visocity.

```bash
brew cask install viscosity
```

5. Open the Viscosity application or your preferred VPN client and go to settings/preferences.

6. Click + to import the profile you downloaded from the VPN server on the step 1
    <span style="display:block;text-align:center">![Viscosity Profile Add](/img/vpn_cloud_2.png)</span>

7. After your profile is imported, select to edit the entry, go to Networking tab and update the DNS settings.
   * Select for the Mode to be `Split DNS`.
   * As a Server IP put: `10.247.4.47` which is VPN's server IP.
   * In Domains put: `cloud.mattermost.com`, this will split traffic for those domains
    <span style="display:block;text-align:center">![Viscosity VPN CIDR](/img/vpn_cloud_3_new.png)</span>

8. After following these steps you should be able to connect to VPN and then to resolve private DNS entries.
