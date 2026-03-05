---
title: CanSecWest and Encryption in Mattermost
heading: "CanSecWest and Encryption in Mattermost"
description: "Check out these takeaways from CanSecWest 2019, which was full of exploits and interesting anecdotes."
slug: cansecwest-2019-encryption
date: 2019-04-25T12:00:00-04:00
author: Christopher Speller
github: crspeller
community: christopher
---

This year I had the opportunity to attend the security conference {{< newtabref href="https://cansecwest.com/" title="CanSecWest" >}} in Vancouver, BC. Like any security conference, it was full of exploits and interesting anecdotes. There were plenty of interesting talks, but this post focuses on a talk by Zhiniang Peng and Minrui Yang on the dangers of homomorphic encryption. This post gives a high level overview and avoids giving too much technical detail.

#### What is Homomorphic Encryption?

Homomorphic encryption is defined as an encryption scheme which allows computations to be performed on ciphertext that, when decrypted, match the result of the operation as if it was applied to the plain text. For example, let's say we have plaintext "5" and "7" and we encrypted them to ciphertexts "x" and "y". We then perform a multiplication operation on ciphertexts "x" and "y" to get ciphertext "z". If we used a homomorphic encryption scheme and a multiplication operation, then the plaintext corresponding ciphertext "z" would be "35" after decryption.

#### Why is this useful?

The use of homomorphic encryption allows a receiving party that does not have a decryption key to perform operation on the ciphertext. One interesting application of this is zero trust computation services. A user of such a service would not have to reveal the contents of the data to the service, as they will encrypt the contents before sending them to the service. The service could then perform whatever operations the user has requested on the data and return the data, still encrypted, to the user. In case the service is compromised, it could not see the contents of the user's data as the plaintext was never sent to it.

Imagine an image storage service. If the service client used regular encryption, it would not be able to perform many useful operations you might want it to do like editing and searching. However, if the service client used homomorphic encryption, the service would be able to edit, search and even perform machine learning on the image data.

#### What about Mattermost?

Implementing a homomorphic encryption scheme for Mattermost could theoretically allow for a zero trust Mattermost server without loss of features. Ignoring the problems with key exchange and channel join/leave (which deserve blog posts of their own), a user could encrypt their messages using a homomorphic scheme before passing them to the Mattermost server. Then the Mattermost server could perform whatever operations it needs to on the encrypted data. As part of a more full solution, a homomorphic encryption scheme would remove the Mattermost application server as a single point of failure in your communication system.

#### The talk was called dangers...

Homomorphic encryption is not ready for prime time. While there are {{< newtabref href="https://github.com/Microsoft/SEAL" title="libraries" >}} that implement homomorphic encryption and that have made great strides in recent years in terms of performance, they are not turnkey solutions to many problems the way a well-developed cryptography library might be. One of the issues that was pointed out in the talk is that homomorphic encryption does not currently have some of the security guarantees we are used to having from other encryption schemes. For example, it does not guarantee indistinguishability under a chosen ciphertext attack, which means if an attacker can force a decryption of a ciphertext of their choice, they can recover your private key.

#### Conclusion

For now, homomorphic encryption is in the realm of cryptographers. As concluded by Zhiniang Peng, using homomorphic encryption is extremely dangerous without a cryptography expert. While it would be really useful for a service such as Mattermost to provide better security guarantees, there is little point in implementing an experimental cryptosystem that can't reliably provide them. However, the field of homomorphic encryption is rapidly evolving and is certainly something we will be keeping our eye on at Mattermost.

