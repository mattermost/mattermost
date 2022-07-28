#!/bin/bash
set -x 
GITHUB_HEAD_REF=release-7.12
GITHUB_REF_NAME=test-ref
          BRANCH_NAME="${GITHUB_HEAD_REF:-N/A}"
          if [[ "${BRANCH_NAME}" == "N/A" ]]; then
            BRANCH_NAME="${GITHUB_REF_NAME}"
          fi
          existed_in_remote=$(git ls-remote --heads origin ${BRANCH_NAME} | wc -l )
          if [[ ${existed_in_remote} != "0" ]]; then
              git checkout ${BRANCH_NAME}
          else
              git checkout master
          fi
