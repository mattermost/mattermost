FROM golang:1.5

ENV SRC_DIR="/go/src/github.com/bkeroack/platform"

RUN mkdir -p $SRC_DIR
ADD . $SRC_DIR
WORKDIR $SRC_DIR

RUN go-wrapper download && \
    go-wrapper install && \
    $SRC_DIR/docker/build-client.sh && \
    $SRC_DIR/docker/mkdist.sh

CMD ['/opt/mattermost/bin/platform']
