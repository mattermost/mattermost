package app

import (
	"sync"
)

func func1() {
	var m sync.Mutex
	m.Lock() // want `possible return with mutex m locked`
	if true {
		return
	}
	m.Unlock()
}

func func2() {
	var m sync.Mutex
	m.Lock()
	if true {
	}
	m.Unlock()
}

func func3() {
	var m sync.Mutex
	m.Lock() // want `possible return with mutex m locked`
}

func func4() {
	var m sync.Mutex
	m.Lock()
	defer m.Unlock()
}

func func5() {
	var m sync.Mutex
	m.Lock() // want `possible return with mutex m locked`
	if true {
		return
	}
	if true {
		return
	}
}

func func6() {
	var m sync.Mutex
	if true {
		m.Lock()
		m.Unlock()
	}
}

type testStruct struct {
	m sync.Mutex
}

func func7() {
	var s testStruct
	s.m.Lock() // want `possible return with mutex m locked`
	if true {
		return
	}
	s.m.Unlock()
}

func func8() {
	var m sync.Mutex

	m.Lock()
	defer func() {
		m.Unlock()
	}()

	if true {
		return
	}
}

func func9() {
	var m sync.Mutex
	m.Lock()
	if true {
		m.Unlock()
		return
	}
	m.Unlock()
}

func func10() {
	var m sync.Mutex
	var n sync.Mutex

	m.Lock() // want `possible return with mutex m locked`
	n.Unlock()
}
