FROM golang as builder

ENV GO111MODULE=on
ENV GOPATH=""

WORKDIR /go/app

COPY go.mod .
COPY go.sum .

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o mattermost ./cmd/mattermost/main.go

EXPOSE 8065
CMD ["./mattermost"]

#ENTRYPOINT ["bash", "build.sh"]

#FROM alpine:3.7
#RUN apk --no-cache add ca-certificates
#
#WORKDIR /
#COPY --from=builder /go/app/mattermost .
#
#EXPOSE 8065
#CMD ["./mattermost"]
