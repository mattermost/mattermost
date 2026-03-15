---
title: Offboarding
heading: "Information about Offboarding at Mattermost"
description: "Is someone leaving Mattermost? Here's a comprehensive list of what needs to be done to ensure successful offboarding."
date: 2018-03-19T14:59:29-05:00
weight: 30
---

When an employee leaves the company, any credentials they had should be revoked. The more things they had access to, the harder this is, so when onboarding, it's important to give them only the necessary privileges. It's also important to avoid shared secrets that cannot be revoked from one person.

The following is a list of things to do. It should be kept as complete and up-to-date as possible, but treated as non-comprehensive when offboarding someone.

* **Delete AWS IAM users** – Ideally, each employee only has one in the master account and uses role delegation to access other accounts. But all accounts should be checked just in case.

* **Rotate AWS access keys** – If the employee created IAM users and access keys for programmatic use in CI or other systems, they should be rotated.

* **Delete AWS accounts** – If the employee had their own AWS account created within the organization, it should be deleted. The default role of "OrganizationAccountAccessRole" should be present in the account and can be used to delete it.

* **Delete the user's LDAP account**

* **Remove OneLogin user from the organization**

* **Remove the user from the GitHub organization and repos** – Ideally, you would just need to remove the user from the organization, but they may have also been explicitly added as contributors to some repositories. As a quick check, a GitHub admin can use the following GraphQL to get an overview of Mattermost's repositories and collaborators (Mind the pagination, you may need multiple queries.):

    ```graphql
    {
      organization(login: "mattermost") {
        members(first: 100) {
          nodes {
            login
          }
        }
        repositories(first: 100) {
          nodes {
            name
            collaborators(first: 100) {
              edges {
                node {
                  login
                }
                permission
              }
              pageInfo {
                hasNextPage
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    }
    ```

* **Rotate GitHub access tokens** – Such as Mattermod's.

* **Revoke any secrets that may have been committed to Git repos** – Review [platform-private](https://github.com/mattermost/platform-private) for example. Once revoked, do not commit new secrets to Git. If you feel like you absolutely have to commit them, at least encrypt them with something like [AWS KMS](https://aws.amazon.com/kms/).

* **Revoke SSH keys** – If the user had access to our "mm-ci", "mm-admin", etc. keys, they should be revoked. It would be a great time to replace keys with [certificate-based access via Vault](/internal/infrastructure/vault/) so developers can just SSH in with OneLogin. Or better yet, install the AWS SSM agent and use [Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/execute-remote-commands.html) where possible instead of SSH.

* **Revoke Azure access**

* **Rotate Kubernetes key**

* **Remove the user from private Mattermost teams and channels**

* **Regenerate invite links for Mattermost teams**

* **Delete WordPress account for https://mattermost.com/**