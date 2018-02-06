package immutable

// Stack implements a last in, first out container.
//
// Nil and the zero value for Stack are both empty stacks.
type Stack struct {
	top    interface{}
	bottom *Stack
}

// Empty returns true if the stack is empty.
//
// Complexity: O(1) worst-case
func (s *Stack) Empty() bool {
	return s == nil || s.bottom == nil
}

// Peek returns the top item on the stack.
//
// Complexity: O(1) worst-case
func (s *Stack) Peek() interface{} {
	return s.top
}

// Pop removes the top item from the stack.
//
// Complexity: O(1) worst-case
func (s *Stack) Pop() *Stack {
	return s.bottom
}

// Push places an item onto the top of the stack.
//
// Complexity: O(1) worst-case
func (s *Stack) Push(value interface{}) *Stack {
	if s == nil {
		s = &Stack{}
	}
	return &Stack{
		top:    value,
		bottom: s,
	}
}
