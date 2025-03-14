FROM ubuntu:noble-20240605@sha256:2e863c44b718727c860746568e1d54afd13b2fa71b160f5cd9058fc436217b30

# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"

# Build Arguments
ARG PUID=2000
ARG PGID=2000
# MM_PACKAGE build arguments controls which version of mattermost to install, defaults to latest stable enterprise
# i.e. https://releases.mattermost.com/9.7.1/mattermost-9.7.1-linux-amd64.tar.gz
# ARG MM_PACKAGE="https://nimbupani-chat-builds.s3.us-east-1.amazonaws.com/builds/linux-amd64-latest.tar.gz?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEH8aCXVzLWVhc3QtMSJHMEUCIQDqkNRxLxYPGRf%2FEAve2UkJw7r8OC3Vsl7Rbs%2BJADMUlAIgQW%2FEosJhXASqsYw9HIBadN%2F7LewfnQNhvtjYDjDJ8CQq1AMIyP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgwyMTExMjU3NDA3NzYiDC%2BXtMzBCCcipX%2BEiyqoA43CgIQl6Ivbe%2Bgkfx6Urj2EhWsOs5MxMXz1%2FQYDJFoJUMqJxRziwkpqjhqRnS8Y%2FcKxEqq%2BZNYRZU4yaf3H5eK%2FsWdPi3QqtqhXhYt1ysTFKMjNE3wyBRLznqguN6XB3IX%2FhfGnhPCAL4szQH9AxP%2BbDAJ0BII%2F7Oy6nyvoHLWRYJiS03FmvYwUFQBujq90w7uXgzF14CwawIFaIgo6R7H%2F0polBKKZ0bqM7c9tx0YlJwIcF0cPdye031k%2FBhOHDrSvtprC3ABFtkMvuLtuB8vNMRZmQg7BC%2BcyRDLKZ7bHDYKTuTp0JpEhHP22cLAj81Exv2GVPO6Kai0YxUUovbV4lByj%2FEeQOAAFqXm%2FYbt17Dn0sci4jgyj6jsjz81vQ5%2FyG2Q%2Fp3VCyRBkw8PFRPF0e%2FkjVqjWzSJHw0p8z2t1Tc1AZCpR1hdQq4RkkpaYsdtB2w6KPhenGsNY%2BsFPDSHp98f1VFdK3cDmXxkGb8nfmmdnsu4bOyY6pMpcldO7oR3%2BKB5K5aPdYxs7hwUT9eyGdc2YdDToN1vUQfiuaY%2BHUs0F1UYjE0Yw0JDIvgY65AIck7%2Fy0NaXAKXjjzD8U5UKCSlGjSXrBTwdP9XPNyfjgQUohHLSHlMtfaPgt8n8NhY%2BuZgVYNbVEqg36GWQCl9FZO5GUXd%2FM%2Fvk9iMs6Rg5BoF80HNTo8eq%2BAzQTeSFVqxh8Ci8OxNrhD4CpmOPMPWae%2FabWUsJQAa4W1peZSBLAStOslSFtJl1QzEuvJI2yhZmyY2AgAPNet30HzOiW%2BEgaAP0a5rhSP4z%2BstFjwrqCTl44wmO0hApyTlsVLtSw54AWUJ2BCwDck4WFj%2BXoQyJqPnEEjpm%2FjVBVcejbyoNqjRhfTnCI2Lf2PpkGPiiFc9bML7FFmS0iNgyqIGxa7YNTTO2NJPD58PnwD1%2FUYDwhrhXADRkNlOQsWWCUgEDTvpxcvfvYl%2FzVcXIcrnmJnmctc1FfqPb%2FYVGy8M3%2FM01RFViMvCGDJqZMMvHJ3tYbIl3OhIUFM%2FQXj6oWG%2FGAmESB7DKdg%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATCKATETUFUDLRH7S%2F20250312%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250312T223251Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=f00faa02b658c931cfd683cae5a51d088c674f4855fc77c7c851e832068dad4c"
# ARG MM_PACKAGE="https://nimbupani-chat-builds.s3.us-east-1.amazonaws.com/test/mac-arm-package.tar.gz?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEID%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQCKiGAEooDZ5bGv5OZ968gDbo5%2BZF5VYG6PqN6Npina5QIhAJuDYDD%2FhmA8EPekoFeMY1IrXDuoQenxjFTmbe%2Fp1YI4KtQDCMj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjExMTI1NzQwNzc2IgxhDdHCbfZp%2F2xQWEMqqANslIRjSIaTZ8H1r7%2Bm1T95RCvqLu5Ey%2Fn7IKivFR1KBjmrWCkzoAM9TsrFSNNSOozqTr%2FHDfZLPjJkY1ZQCOCmjWNkl5Id3L3jJZWXfsisvkzoMc34bYiNrKFwagW7IQdUDYoMyi53BTumIhWwz7lIxoAerC5LYHgspkqRz4aVlIB4qA4WtAo7zI4aKtkeyNSAjU5S5IKtjHTUwIYbq5thvH7J6aaa1Yb%2BMBixGXlEIyf8sTYws7lgrIhAWTwFSUX5ELaCHgGVs61z4nEV6iKBee9g1DfDJCVG5ykYt58%2Bvgvo9bP%2BelB3zgrQ9D167RNvFQnoweBweJVtwFaEgQRk3RP3OEvN4dJK2F9kg0TQMbOGJH%2FTiHBApkLGNlkWbNCuQWc60BrABRrlsl09w9MvWPdldh5dk6CWU5M5cHUkOw74nffmA6dpQ32E8o0vXonw%2BIcbL3glIc8VXQYpOy1%2F0ePjlPtSVpezKVL26SyCUBqmV3CzTe4tLpz6i5lqBKx4RhE4cTJWpL5Fgv8CKJT4NWYEhtWfSM49RHp1DE%2FSLa9I6QQoO8RlMNCQyL4GOuMCmJvhE31YOUguVbelVi1yJE6bOPwZNK3jPNebwc0j7%2F7wsfk313DLp4xa1ZYyNRaxksxDg5zcDvVFf7Fv3xDg6Zk%2BbFHugYueWoaw1zrUgSsQx4kP9J6PATN7GIxtCtVE0lvGM0rB8SrLkVO8ERlsCRGqisvfAAArf0XEx9PEcQkWDhB15dBeD3pyWBvLkEM0GaPIGza2hsyLARdjN4w9GX8qlw2tZloK9E93K92ZMBfSfDCA5oDP2drZhK2WkzbI2QgghGnJ1kCE%2B4CcDPmIZBX9b%2FFOov73PLtQ0nV7k1JokheWQJWdHy16vlf9LF33M7GVmLLrrkBG0TKah%2F5lBQdUlqjK%2BeznBURtbHGTp6wQ78FUQsfbCG7qdMZQpCr4uiY%2BVSbIYl6d0D6HuqfYRolV2CBTlQHK3ifMAKiS3KioSR7E86Z%2FfcOfaaYKbkkFGGNUl%2BUdeM6gVP%2FS2q6NA%2BMF2w%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATCKATETUP433O3EY%2F20250312%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250312T232108Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=ec1822376be9d751849a3c0ea8cfe4a2196c925902982e68b6ed481fadc9755f"
ARG MM_PACKAGE="https://nimbupani-chat-builds.s3.us-east-1.amazonaws.com/test/mattermost-team-linux-amd64.tar.gz?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEJ7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQC%2F6tjzca20GmH7GomtNaPH1C7SDpDj7ZjJ0018UE5HgAIgHgxSxUTXxG3gPGHkqV4jxR03tRu2WYhQsuoD4Q0l8b0q1AMI5%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgwyMTExMjU3NDA3NzYiDI5yLn9ndJeYwVIfoyqoA0VHDiAymGrWOuuolFcclISH5swTwY%2BuB%2F1nV0BgU3H9xh78mMqyS5m7mHJohp0tWK2uXLsC%2BA7t8vVhSCQ6%2B0UHkfeCgJ5ipKMEecA866MkJ3egEq8xB%2B9mimuEQOMw%2FAjxawJ0VZdkmO6QD%2F5pnPL6gqY7Me5FemBEDnMeZ3sjEbX4DUvAV1uEjXsrb%2BHqurwXT2U5IXZiIwPuQkjBPaD%2BLDf7rWvcBlsv6BWdVuGrVsRF640Eof%2FI08kLpjUVFpZgb%2Bfk50TJJjVMLToxV83hVqe%2BP06Ie2FblZXiL9RxxdCP2W36Mc6F7rXMyQ4AKoxETDgqS3C%2FUGfnHZ8NISkbIPJclNpfmAJ27uPgZwbjDDUg6q62288NavWREna1cj5PqhUjbvZHO90Ep0n%2B%2FGey%2FwH2sIBA0t7GjXNxCaszclqw6CNhBOf7ooseBEbGsMXqjPhJB2wUwSAUp26tWWhHUj6YDEilRCT8mpSm4OCL4adCIl56r6DgubVqVfeK6RBHEa2SYnfNMts4OGMyfJCR%2FODBbn3OsQqP6E8yblo5QJWaBv26M5Qwm%2B%2FOvgY65AK4%2BQfAiOlphc4faWjIl2Q5yPxS3AEYxAGaZ5G9bqy6xbijXDCTB2jJAPwDcDHj%2Fx4Nn9s9o%2BSXRdCp19T1yhb9yIPIDrwR4LNdnWndGYCGh3G1VpmNU8oLsnGGMigR7CDF%2B5XeWCmxFH1mH7IOU67KY4FMTrRF2N9V4%2Fqz%2FJpK8AP5dAe%2FCS%2FgHF8woVF%2FpVs2woEYmQp2t0CuELyc1iwqlHIvEQMeTO5OtjcF%2FNKRVFt1m0Lo%2BfpgsB%2FHIYyhVh4i%2F6DJqMuMknVrIb8mD44hp%2FCaO95PtUIEBywKpCj44b6Nq74xvsilbEW4HVUQHXZjQdK8jRhiDDF518OOggCC19jq3j0ObR%2B%2BBeQY5NqD6TnuypQaPeiTMf%2BoOfDDGMz%2BvaQmBNGhvWsKBu2hpoUfzg4aJnGHxzWOiyYrBeGyCsiBBoAubBDzSNa%2BwEpJUwE8eXgjIQMnVt%2BPzUHCyqj5OZuk6w%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATCKATETUJJJIGYWY%2F20250314%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250314T052859Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=de633f460642ac381690f9e8d233e3a9c06689d09954bc91a9851b5f5426ccf4"

# # Install needed packages and indirect dependencies
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  ca-certificates \
  curl \
  media-types \
  mailcap \
  unrtf \
  wv \
  poppler-utils \
  tidy \
  tzdata \
  && rm -rf /var/lib/apt/lists/*

# Set mattermost group/user and download Mattermost
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && groupadd --gid ${PGID} mattermost \
  && useradd --uid ${PUID} --gid ${PGID} --comment "" --home-dir /mattermost mattermost \
  # && tar -xvzf $MM_PACKAGE \
  && curl -L $MM_PACKAGE | tar -xvz  \
  && chown -R mattermost:mattermost /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# We should refrain from running as privileged user
USER mattermost

# Healthcheck to make sure container is ready
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8065/api/v4/system/ping || exit 1

# Configure entrypoint and command with proper permissions
COPY --chown=mattermost:mattermost --chmod=765 entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /mattermost
CMD ["mattermost"]

EXPOSE 8065 8067 8074 8075

# Declare volumes for mount point directories
VOLUME ["/mattermost/data", "/mattermost/logs", "/mattermost/config", "/mattermost/plugins", "/mattermost/client/plugins"]
