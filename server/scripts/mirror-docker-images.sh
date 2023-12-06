#!/bin/bash
set -eu -o pipefail

# Assert that IMAGE_FILE var is given, and that the file exists
: ${IMAGES_FILE}
[ -f ${IMAGES_FILE} ] || {
  echo "Error: images spec file $IMAGES_FILE does not exist. Aborting." >&2
  exit 1
}

DRY_RUN=${DRY_RUN:-yes}
log () { echo "[$(date -Is)]" $*; }
get_image_specs_per_line () {
  jq -c '. as $images | keys[] | . as $image | $images[.] | keys[] | {dst_img_name: $image, dst_img_tag: ., src_img: $images[$image][.]}' <$IMAGES_FILE
}

log "Pusing images from given spec file: $IMAGES_FILE"
log "Content of the spec file:"
cat $IMAGES_FILE
get_image_specs_per_line | while read IMAGE_SPEC; do
  DST_IMG_NAME=$(jq -r '.dst_img_name' <<<$IMAGE_SPEC)
  DST_IMG_TAG=$(jq -r '.dst_img_tag' <<<$IMAGE_SPEC)
  SOURCE_IMAGE=$(jq -r '.src_img' <<<$IMAGE_SPEC)
  DESTINATION_IMAGE=mattermostdevelopment/mirrored-${DST_IMG_NAME}:${DST_IMG_TAG}
  if [ "${DRY_RUN,,}" = "no" ]; then
    log "Pushing image: $SOURCE_IMAGE ---> $DESTINATION_IMAGE"
    docker pull $SOURCE_IMAGE
    docker tag $SOURCE_IMAGE $DESTINATION_IMAGE
    docker push $DESTINATION_IMAGE
  else
    log "Pushing image: $SOURCE_IMAGE ---> $DESTINATION_IMAGE (dry run mode, set the DRY_RUN=no env var to disable)"
  fi
done
log "All images pushed."
