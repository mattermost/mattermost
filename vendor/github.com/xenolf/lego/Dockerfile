FROM alpine:3.6

ENV GOPATH /go
ENV LEGO_VERSION tags/v0.4.1

RUN apk update && apk add --no-cache --virtual run-dependencies ca-certificates && \
    apk add --no-cache --virtual build-dependencies go git musl-dev && \
    go get -u github.com/xenolf/lego && \
    cd ${GOPATH}/src/github.com/xenolf/lego && \
    git checkout ${LEGO_VERSION} && \
    go build -o /usr/bin/lego . && \
    apk del build-dependencies && \
    rm -rf ${GOPATH}

ENTRYPOINT [ "/usr/bin/lego" ]
