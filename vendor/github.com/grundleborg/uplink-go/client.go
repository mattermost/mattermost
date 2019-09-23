package uplink

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type Client struct {
	key       string
	warehouse string
	server    string

	payloadChannel chan *payload
}

type payload struct {
	Warehouse       string                 `json:"warehouse"`
	Source          string                 `json:"source"`
	Schema          string                 `json:"schema"`
	ClientTimestamp int64                  `json:"client_timestamp"`
	Data            map[string]interface{} `json:"data"`
}

// New creates a new instance of the Uplink Client, to connect to the specified server with the provided source key.
//  c := client.New("https://uplink.example.com/v0/log", "unique_identifier_for_this_server")
func New(server string, warehouse string, key string) Client {
	c := Client{
		key:            key,
		warehouse:      warehouse,
		server:         server,
		payloadChannel: make(chan *payload),
	}

	c.startWorker()

	return c
}

func (c *Client) Close() error {
	// TODO: Implement me!
	return nil
}

// Track records the provided event and queues it to send to the server.
// Returns an error if this uplink client is already closed.
func (c *Client) Track(schema string, data map[string]interface{}) error {
	p := payload{
		Warehouse:       c.warehouse,
		Source:          c.key,
		Schema:          schema,
		ClientTimestamp: getMillis(),
		Data:            data,
	}

	c.payloadChannel <- &p

	return nil
}

func (c *Client) startWorker() {
	go c.worker()
}

func (c *Client) worker() {
	httpClient := &http.Client{}

	for {
		select {
		case p := <-c.payloadChannel:
			b, err := json.Marshal(&p)
			if err != nil {
				log.Printf("A json marshalling error occurred: %v\n", err.Error())
			}

			httpClient.Post(c.server, "text/json", bytes.NewBuffer(b))
		}
	}
}

func getMillis() int64 {
	return time.Now().UnixNano() / int64(time.Millisecond)
}
