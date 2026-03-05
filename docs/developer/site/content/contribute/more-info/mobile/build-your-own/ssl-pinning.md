---
title: "Enable SSL Pinning certificates"
heading: "Enable SSL Pinning certificates"
description: "Learn how to build your own Mattermost mobile app and pin your SSL Certificates."
date: 2018-05-20T11:35:32-04:00
weight: 2
aliases:
  - /contribute/mobile/ssl-pinning
---

##### What is SSL Pinning?

SSL (Secure Sockets Layer) pinning is a technique used in mobile app development to ensure that the app communicates only with a server that has a specific certificate. This is done by embedding the server’s certificate in the app itself and then validating the server’s certificate against this embedded certificate during communication. If the server's certificate does not match the pinned certificate, the connection is rejected.

##### Advantages of SSL Pinning

1. **Increased Security**: Protects against man-in-the-middle (MITM) attacks by ensuring that the app only communicates with trusted servers.
2. **Trustworthiness**: Guarantees that the data sent and received is from the expected server.
3. **Prevention of Certificate Spoofing**: Ensures that the server’s certificate is exactly what is expected, preventing spoofing attempts.

##### Disadvantages of SSL Pinning

1. **Certificate Management**: Requires regular updates to the app when the server’s certificate is renewed or changed.
2. **Deployment Complexity**: Coordination between development and deployment teams is necessary to avoid disruptions during certificate rotations.
3. **Maintenance Overhead**: Adds additional steps and complexity to the app’s maintenance process.

{{<note "Important Note:">}}
SSL pinning requires that both development and deployment teams understand and follow best practices for cryptographic key management, certificate rotation, and incident response. 
- Coordinating the timing of certificate updates and app updates is crucial to minimize impact on end-users. When the server's SSL certificate is renewed or rotated, the hardcoded public key in the app no longer matches the server's new certificate, leading to connection failures until the app is updated with the new key.
- Both development and deployment teams need to align on a deployment window that considers factors like user downtime, mobile app store review timelines, and peak usage times, as well as a coordinated rollback plan.
{{</note>}}

### Steps to Enable SSL Pinning in Your Mobile App

#### 1. Obtain the Certificate from the Server

Use `openssl` to retrieve the certificate from your server and save it to a file. This can be done with the following command:

```sh
openssl s_client -connect yourserver.com:443 -showcerts < /dev/null | openssl x509 -outform DER -out yourserver.cer
```

Alternatively, to save it in PEM format:

```sh
openssl s_client -connect yourserver.com:443 -showcerts < /dev/null | openssl x509 -outform PEM -out yourserver.crt
```

#### 2. Naming the Certificate Files

Name the certificate files using the domain name as the filename with either `.cer` or `.crt` as the extension. For example, if your server’s domain is `example.com`, your files should be named `example.com.cer` and/or `example.com.crt`.

Optionally you can have both file types (`.cer` and `.crt`) to match the server trust and to ensure continued app functionality during certificate rotations. **Coordinate certificate rotations with the deployment teams** to avoid disruptions between the app and the server.

#### 3. Copy the Certificate Files to the Assets Folder

Place the certificate files in the `assets/certs` folder of your project. This is necessary for the app to access and use the certificates during runtime.

#### 4. Build Your App
Follow the instructions in the [Build the iOS app]({{< ref "/contribute/more-info/mobile/build-your-own/ios" >}}) or [Build the Android app]({{< ref "/contribute/more-info/mobile/build-your-own/android" >}}) sections to build your app with SSL pinning enabled.
