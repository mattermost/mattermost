---
title: "Automating Nodes Rotation Using Gitlab Pipelines"
heading: "Automating Nodes Rotation"
description: "This blog post describes our journey to automate our nodes rotation process when we have a new AMI release, and the open source tools we built on this."
slug: automating-nodes-rotation
date: 2021-04-19T00:00:00-04:00
author: Stavros Foteinopoulos
github: stafot
community: stavros.foteinopoulos
---

#### Overview

In the daily life of a Site Reliability Engineer the main goal is to reduce all the work we call toil. But what is toil? Toil is the kind of work tied to running a production service that tends to be manual, repetitive, automatable, tactical, devoid of enduring value, and that scales linearly as a service grows.
This blog post describes our journey to automate our nodes rotation process when we have a new AMI release, and the open source tools we built on this.

#### Problems

Apart from toil elimination we had specific problems that we needed to solve by building our tooling around:
- Our first problem is the limited way in which Kubernetes Operations (kops) rolls out node changes. It does it sequentially, one by one and in a specific window of time. We needed a much more flexible way of rotation, to avoid stretching our workloads or hitting any limits on our infrastructure. Each environment might need different handling to be more efficient and as reliable as possible during this process.
- The second problem is that AWS EKS clusters have no automated way rolling out new nodes after a new AMI is released. To build this ability is essential, especially when it comes to releases which are related to security patches and should be in place as soon as possible.

#### Solution

To solve the above-mentioned problems we combined existing tooling that we had in place such as our cloud provisioner and our GitLab Pipelines with the new tools we implemented. Below are the steps we took to achieve this.
- Implemented a new library (rotator) that improved nodes rotation functionality. It provided us with a much more flexible, configurable, and reliable way to rotate nodes.
- Added it as a module on our cloud provisioner of our workloads (kops) clusters.
- Created a cli tool for rotator (rotatorctl) to use it from our local machines and our GitLab pipelines to rotate EKS clusters.
- Created GitLab  pipelines to release new AMIs for kops clusters using cloud provisioner with rotator module and its improved capabilities in-place.
- Created GitLab pipelines for releasing new AMIs on EKS clusters using rotatorctl.

{{< figure src="/blog/2021-04-19-nodes-automation-image/kops-flow.png" alt="Kops Pipeline Flow">}}

The flow of node rotation for our kops clusters

{{< figure src="/blog/2021-04-19-nodes-automation-image/eks-flow.png" alt="EKS Pipeline Flow">}}

The flow of node rotation for our AWS EKS clusters

#### Why is this important?

As we stated initially, all this work helped our team to get rid of a significant amount of toil work. By automating and improving these processes saved a lot of valuable time for the SRE team, before putting them in place there were cases that 2 or 3 people needed to participate and closely monitor these tasks. 

Especially in the case of kops clusters, which rotate their nodes, this is a time-consuming task (2 to 8 hours depending on the cluster size and the environment) so investing on tooling over toil was a great choice. 

This choice gave to our team the ability to roll out more regular AMI changes, which has resulted in a more secure and better performing underlying infrastructure. This way we can focus on what really matters, which is to serve a reliable and more secure cloud offering for our customers.
These tools are not only useful for our team but for the wider community, as they solve a problem that many Operations and SRE teams are facing. Offering back tooling to the Open Source community for managing their infrastructure and their workloads is a core principle in our team.

#### Resources

- {{< newtabref href="https://github.com/mattermost/mattermost-cloud/pull/423" title="Add rotation ability to mattermost-cloud provisioner" >}}
- {{< newtabref href="https://github.com/mattermost/rotator" title="Rotator Library" >}}

- {{< newtabref href="https://github.com/mattermost/rotatorctl" title="Rotator CLI" >}}

#### References

- {{< newtabref href="https://sre.google/sre-book/eliminating-toil/" title="Eliminating Toil" >}}
