package model

type StringList []string
type IntList []int

func ValidFuncDirect(a int, b []string) []int            { return nil }
func ValidFuncIndirect(a int, b StringList) IntList      { return nil }
func InvalidReturnDirect(a int, b StringList) *[]int     { return nil } // want `use of pointer to slice in function definition`
func InvalidReturnIndirect(a int, b StringList) *IntList { return nil } // want `use of pointer to slice in function definition`
func InvalidParamDirect(a *[]string, b int)              {}             // want `use of pointer to slice in function definition`
func InvalidParamIndirect(a int, b *StringList)          {}             // want `use of pointer to slice in function definition`
