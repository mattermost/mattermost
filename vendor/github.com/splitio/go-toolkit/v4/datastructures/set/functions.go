package set

// Union calculates the union of two or more sets
func Union(set1, set2 Set, sets ...Set) Set {
	u := set1.Copy()
	set2.Each(func(item interface{}) bool {
		u.Add(item)
		return true
	})

	for _, set := range sets {
		set.Each(func(item interface{}) bool {
			u.Add(item)
			return true
		})
	}

	return u
}

// Intersection calculates the intersection of two or more sets
func Intersection(set1, set2 Set, sets ...Set) Set {
	all := Union(set1, set2, sets...)
	result := Union(set1, set2, sets...)

	all.Each(func(item interface{}) bool {
		if !set1.Has(item) || !set2.Has(item) {
			result.Remove(item)
		}

		for _, set := range sets {
			if !set.Has(item) {
				result.Remove(item)
			}
		}
		return true
	})
	return result
}

// Difference calculates the difference of two or more sets
func Difference(set1, set2 Set, sets ...Set) Set {
	s := set1.Copy()
	s.Separate(set2)
	for _, set := range sets {
		s.Separate(set) // seperate is thread safe
	}
	return s
}

// SymmetricDifference calculates the symmetric difference of two or more sets
func SymmetricDifference(s Set, t Set) Set {
	u := Difference(s, t)
	v := Difference(t, s)
	return Union(u, v)
}
