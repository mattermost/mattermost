package redis

import (
	"net"
	"time"

	"github.com/go-redis/redis/internal/pool"
)

func (c *baseClient) Pool() pool.Pooler {
	return c.connPool
}

func (c *PubSub) SetNetConn(netConn net.Conn) {
	c.cn = pool.NewConn(netConn)
}

func (c *PubSub) ReceiveMessageTimeout(timeout time.Duration) (*Message, error) {
	return c.receiveMessage(timeout)
}

func (c *ClusterClient) SlotAddrs(slot int) []string {
	var addrs []string
	for _, n := range c.state().slotNodes(slot) {
		addrs = append(addrs, n.Client.getAddr())
	}
	return addrs
}

// SwapSlot swaps a slot's master/slave address for testing MOVED redirects.
func (c *ClusterClient) SwapSlotNodes(slot int) {
	nodes := c.state().slots[slot]
	if len(nodes) == 2 {
		nodes[0], nodes[1] = nodes[1], nodes[0]
	}
}
