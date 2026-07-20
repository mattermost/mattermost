package app

import "model"

func ListParamNotValid(list *model.StringList) {} // want `use of pointer to slice in function definition`
func ListParamValid(list model.StringList)     {}

func ListReturnNotValid() (list *model.StringList) { return nil } // want `use of pointer to slice in function definition`
func ListReturnValid() (list model.StringList)     { return nil }
