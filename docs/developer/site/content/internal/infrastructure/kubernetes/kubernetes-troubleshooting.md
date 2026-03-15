---
title: "Kubernetes Maintenance"
heading: "Troubleshooting Kubernetes at Mattermost"
description: "This page helps developers access and perform any type of maintenance in the Production Mattermost Kubernetes Cluster."
date: 2018-11-07T15:24:42+01:00
weight: 10
---

This page helps developers access and perform any type of maintenance in the Production Mattermost Kubernetes Cluster, which is running on AWS using EKS.

## Set up a local environment to access Kubernetes (K8s)

1. Make sure you have `kubectl` version 1.10 or later installed. If not, follow [these instructions](https://kubernetes.io/docs/tasks/tools/install-kubectl/).

2. Use your OneLogin account to retrieve AWS Keys for the main Mattermost AWS account following [these instructions](../../onelogin-aws/) to install onelogin-aws command line application.

Steps:

- run `onelogin-aws-login` in the command line, it will ask your username, password and the two-factor auth.
- select `arn:aws:iam::521493210219:role/OneLoginPowerUsers`
- export the environment variable `AWS_PROFILE` which will be something like `521493210219/OneLoginPowerUsers/YOUR_EMAIL`

3. Install `aws-iam-authenticator` following [these instructions](https://docs.aws.amazon.com/eks/latest/userguide/getting-started.html#eks-prereqs) section `To install aws-iam-authenticator for Amazon EKS`.

4. Get the kubeconfig

Cluster Name: `mattermost-prod-k8s`

```Bash
$ aws eks update-kubeconfig --name mattermost-prod-k8s --region us-east-1
```

5. Confirm the set up is correct by checking if the puds are running in the K8s cluster:

```Bash
$ kubectl get po -n community
NAME                                              READY   STATUS    RESTARTS   AGE
mattermost-community-0                            1/1     Running   0          5h
mattermost-community-1                            1/1     Running   0          23h
mattermost-community-jobserver-65985bfc47-88qq9   1/1     Running   0          5h

$ kubectl get po -n community-daily
NAME                                                    READY   STATUS    RESTARTS   AGE
mattermost-community-daily-0                            1/1     Running   0          3h
mattermost-community-daily-1                            1/1     Running   0          3h
mattermost-community-daily-jobserver-78f7cbf756-wls4f   1/1     Running   0          2h
```

If one or more pods show a status other than `Running`, use `kubectl describe` and `kubectl logs` to troubleshoot:

```Bash
$ kubectl describe pods ${POD_NAME} -n ${NAMESPACE}
```

```Bash
$ kubectl logs pods ${POD_NAME} -n ${NAMESPACE}
```

## Namespaces

We are using two namespaces to deploy Mattermost

    - `community` namespace holds the Mattermost deployment which uses the Release Branch or a stable release. The ingress is points to `https://community.mattermost.com/` and `https://pre-release.mattermost.com/`
    - `community-daily` namespace holds the Mattermost deployment which uses the `master` branch. The ingress points to `https://community-daily.mattermost.com/`

## Troubleshooting

This section will be populated nas we run into issues and find solutions to them.
