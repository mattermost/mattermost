package iradix

import (
	"bytes"
)

// ReverseIterator is used to iterate over a set of nodes
// in reverse in-order
type ReverseIterator struct {
	i *Iterator
}

// NewReverseIterator returns a new ReverseIterator at a node
func NewReverseIterator(n *Node) *ReverseIterator {
	return &ReverseIterator{
		i: &Iterator{node: n},
	}
}

// SeekPrefixWatch is used to seek the iterator to a given prefix
// and returns the watch channel of the finest granularity
func (ri *ReverseIterator) SeekPrefixWatch(prefix []byte) (watch <-chan struct{}) {
	return ri.i.SeekPrefixWatch(prefix)
}

// SeekPrefix is used to seek the iterator to a given prefix
func (ri *ReverseIterator) SeekPrefix(prefix []byte) {
	ri.i.SeekPrefixWatch(prefix)
}

func (ri *ReverseIterator) recurseMax(n *Node) *Node {
	// Traverse to the maximum child
	if n.leaf != nil {
		return n
	}
	if len(n.edges) > 0 {
		// Add all the other edges to the stack (the max node will be added as
		// we recurse)
		m := len(n.edges)
		ri.i.stack = append(ri.i.stack, n.edges[:m-1])
		return ri.recurseMax(n.edges[m-1].node)
	}
	// Shouldn't be possible
	return nil
}

// SeekReverseLowerBound is used to seek the iterator to the largest key that is
// lower or equal to the given key. There is no watch variant as it's hard to
// predict based on the radix structure which node(s) changes might affect the
// result.
func (ri *ReverseIterator) SeekReverseLowerBound(key []byte) {
	// Wipe the stack. Unlike Prefix iteration, we need to build the stack as we
	// go because we need only a subset of edges of many nodes in the path to the
	// leaf with the lower bound.
	ri.i.stack = []edges{}
	n := ri.i.node
	search := key

	found := func(n *Node) {
		ri.i.node = n
		ri.i.stack = append(ri.i.stack, edges{edge{node: n}})
	}

	for {
		// Compare current prefix with the search key's same-length prefix.
		var prefixCmp int
		if len(n.prefix) < len(search) {
			prefixCmp = bytes.Compare(n.prefix, search[0:len(n.prefix)])
		} else {
			prefixCmp = bytes.Compare(n.prefix, search)
		}

		if prefixCmp < 0 {
			// Prefix is smaller than search prefix, that means there is no lower bound.
			// But we are looking in reverse, so the reverse lower bound will be the
			// largest leaf under this subtree, since it is the value that would come
			// right before the current search prefix if it were in the tree. So we need
			// to follow the maximum path in this subtree to find it.
			n = ri.recurseMax(n)
			if n != nil {
				found(n)
			}
			return
		}

		if prefixCmp > 0 {
			// Prefix is larger than search prefix, that means there is no reverse lower
			// bound since nothing comes before our current search prefix.
			ri.i.node = nil
			return
		}

		// Prefix is equal, we are still heading for an exact match. If this is a
		// leaf we're done.
		if n.leaf != nil {
			if bytes.Compare(n.leaf.key, key) < 0 {
				ri.i.node = nil
				return
			}
			found(n)
			return
		}

		// Consume the search prefix
		if len(n.prefix) > len(search) {
			search = []byte{}
		} else {
			search = search[len(n.prefix):]
		}

		// Otherwise, take the lower bound next edge.
		idx, lbNode := n.getLowerBoundEdge(search[0])

		// From here, we need to update the stack with all values lower than
		// the lower bound edge. Since getLowerBoundEdge() returns -1 when the
		// search prefix is larger than all edges, we need to place idx at the
		// last edge index so they can all be place in the stack, since they
		// come before our search prefix.
		if idx == -1 {
			idx = len(n.edges)
		}

		// Create stack edges for the all strictly lower edges in this node.
		if len(n.edges[:idx]) > 0 {
			ri.i.stack = append(ri.i.stack, n.edges[:idx])
		}

		// Exit if there's not lower bound edge. The stack will have the
		// previous nodes already.
		if lbNode == nil {
			ri.i.node = nil
			return
		}

		ri.i.node = lbNode
		// Recurse
		n = lbNode
	}
}

// Previous returns the previous node in reverse order
func (ri *ReverseIterator) Previous() ([]byte, interface{}, bool) {
	// Initialize our stack if needed
	if ri.i.stack == nil && ri.i.node != nil {
		ri.i.stack = []edges{
			{
				edge{node: ri.i.node},
			},
		}
	}

	for len(ri.i.stack) > 0 {
		// Inspect the last element of the stack
		n := len(ri.i.stack)
		last := ri.i.stack[n-1]
		m := len(last)
		elem := last[m-1].node

		// Update the stack
		if m > 1 {
			ri.i.stack[n-1] = last[:m-1]
		} else {
			ri.i.stack = ri.i.stack[:n-1]
		}

		// Push the edges onto the frontier
		if len(elem.edges) > 0 {
			ri.i.stack = append(ri.i.stack, elem.edges)
		}

		// Return the leaf values if any
		if elem.leaf != nil {
			return elem.leaf.key, elem.leaf.val, true
		}
	}
	return nil, nil, false
}
