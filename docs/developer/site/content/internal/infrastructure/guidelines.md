---
title: Guidelines for New Infrastructure
heading: "Guidelines for New Infrastructure - Mattermost"
description: "Building or deploying new infrastructure? Make sure it follows these guidelines."
date: 2017-11-06T19:30:07-05:00
weight: 100
---

## All new infrastructure should meet these requirements.

### Authentication should be centralized.

OneLogin, LDAP, IAM Groups, GitHub, or even Mattermost should define the level of access granted to a person. We want to minimize the number of steps required to onboard or offboard new team members and don't want to have to grant or revoke access service-by-service.

For example, new machines in AWS should be created without a keypair and use Vault+OneLogin to control SSH access.

### Credentials should be revocable.

It should be possible to remove a person's access to resources without disrupting operations or others' access.

For example, each service that requires an AWS access token should use its own instead of sharing a token with other services or employees.

### Follow the principle of least privilege.

If a service doesn't require access to a given resource, it shouldn't have access to that resource.

### Configuration and provisioning should be reproducible.

Usually this means everything you do should be reviewed and committed as code to a repo. The only thing you should have to do manually to deploy is `aws cloudformation deploy`, `serverless deploy`, `kubectl apply`, etc.

If there's a good reason you can't define everything as code, create thorough step-by-step documentation of everything you do.
