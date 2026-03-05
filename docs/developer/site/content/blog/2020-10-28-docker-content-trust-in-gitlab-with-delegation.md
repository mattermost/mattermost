---
title: "Docker Content Trust in GitLab's .gitlab-ci.yml with Delegation"
slug: docker-content-trust-in-gitlab-with-delegation
date: 2020-10-28
categories:
    - "devops"
    - "security"
    - "opensource"
author: Elisabeth Kulzer
github: metanerd
community: elisabeth.kulzer
canonicalUrl: https://developers.mattermost.com/blog/docker-content-trust-in-gitlab-with-delegation/
---

At the start of implementing Docker Content Trust in our workflow, I thought it shouldn't take so long.
I thought and of course I was wrong.
The following is the boiled down version of what I learned and wished for starting out.

## Prerequisites

- Docker version: 19.03.12
- root `*.key` + `passphrase` for the Docker Content Trust
- delegation/signer `private key *.key` + `public key *.pub` + passphrase for the delegated person/bot, who should sign the `repository/image:tag`
- Please make sure you have your keys backed up and versioned.

## Create a signed repository and add signer

This is not part of the automation process, because it requires the root key:
```
docker trust signer add --key public-key-of-signer.pub signer-name registry/company/repository
```
This will ask you for the root key passphrase and needs the encrypted root key locally in `$HOME/.docker/trust/private/ROOT_KEY_HASH.key`.
This command does two things when first run:
1. Upgrades the Docker repository to use Docker Content Trust and therefore creates a new key. You need to input a newly-generated passphrase (please back up and version).
1. Adds the signer named `signer-name` to be allowed to sign new tags pushed.

## Automation concept and quirks

- Use the passphrase to decrypt the encrypted keys which are encrypted at rest.
- The `DOCKER_CONTENT_TRUST_REPOSITORY_PASSPHRASE` environment variable to decrypt the key for automation usage is not just for the repository key, it's also for the signer key and root key.
- The keys can only be used one at a time (multiple keys cannot be loaded at the same time, as opposed to e.g. gpg keyring concept).
- The keys should be located in `$HOME/.docker/trust/private/*` otherwise automated loading of keys fails.
- Should you use `$` or `!` in the passphrases and use them as GitLab CI/CD secret variables, be aware that these characters need to be {{< newtabref href="https://stackoverflow.com/questions/48870664/escape-char-in-gitlab-secret-variables" title="escaped" >}}.

## Automation of pushing signed `image:tag` in GitLab

```yaml
dockerhub-edge:
  variables:
    URL: docker.io
    USERNAME: $DOCKER_HUB_USERNAME # GitLab CI variable type variable
    TOKEN: $DOCKER_HUB_TOKEN # GitLab CI variable type variable
    IMAGE: $URL/mattermost/${CI_PROJECT_NAME}
    TAG: edge
  before_script:
    - echo $TOKEN | docker login --username $USERNAME $URL --password-stdin
  script:
    - docker build --tag ${IMAGE}:${TAG} .
    - export DOCKER_CONTENT_TRUST=1
    - SIGNER_KEY_NAME="CHANGE_TO_SIGNER_KEY_HASH" # change this to your hash
    - PATH_KEYS=$HOME/.docker/trust/private
    - mkdir -p $PATH_KEYS
    - chmod 600 $DCT_SIGNER_PRIV_KEY
    - cp $DCT_SIGNER_PRIV_KEY $PATH_KEYS/$SIGNER_KEY_NAME.key # GitLab CI variable type file

    - export DOCKER_CONTENT_TRUST_REPOSITORY_PASSPHRASE=$DCT_SIGNER_PASS # GitLab CI variable type variable
    - docker trust key load $PATH_KEYS/$SIGNER_KEY_NAME.key
    - docker trust sign ${IMAGE}:${TAG}
    - docker push ${IMAGE}:${TAG}
    - docker trust inspect --pretty ${IMAGE}:${TAG}
  after_script:
    - docker logout
    - SIGNER_KEY_NAME="CHANGE_TO_SIGNER_KEY_HASH" # change this to your hash
    - PATH_KEYS=$HOME/.docker/trust/private
    - rm $PATH_KEYS/$SIGNER_KEY_NAME.key
  tags:
    - docker
  only:
    - master
```

## Advanced image signing features

If you are looking for advanced features, you might consider looking at {{< newtabref href="https://github.com/theupdateframework/notary" title="notary" >}}.
The CLI command `docker trust` is a wrapper for notary.

## Sources

- https://docs.docker.com/engine/security/trust/trust_automation/
- https://docs.docker.com/engine/security/trust/#signing-images-with-docker-content-trust
- https://github.com/theupdateframework/notary
- https://stackoverflow.com/questions/48870664/escape-char-in-gitlab-secret-variables
