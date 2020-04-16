package model

// Typed constants
type ChannelType string

// CamelCase Constant Names
const (
	ChannelTypeOpen    ChannelType = "O"
	ChannelTypePrivate ChannelType = "P"
)

type Channel struct {
	// Member variables are not exported to ensure immutability.
	id       string `json:"id"`
	name     string `json:"name"`
	createAt int64  `json:"create_at"`
	// etc...

	// Question: what do we do when there's a semantically meaningful
	// "null" value for a member variable?
	schemeID *string `json:"scheme_id"`

	// Question: is this the best way of storing props and similar map/list data?
	props map[string]interface{} `json:"props" db:"-"`
}

// Getters to access the member variables are provided. These *never* return pointers.
// Correct capitalisation of initialisms
func (channel *Channel) GetID() string {
	return channel.id
}

// Returning `interface{}` feels gross. Can we do better than this?
func (channel *Channel) GetProp(key string) interface{} {
	return channel.props[key]
}

// "Patch" object holds changes to the object to make.
type ChannelPatch struct {
	Name *string `json:"name"`
	// etc...

	// Question: can we avoid pointers here and have some type like "NullableString"
	// that indicates whether the field should be set explicitly instead?
}

// Similarly to what we do for the "PATCH" API endpoints currently, we modify model
// objects by populating a "patch" object then calling a "ApplyPatch" method.
func (channel *Channel) ApplyPatch(patch ChannelPatch) Channel {
	// This method forces a deep-copy of the object to ensure immutability.
	newChannel := channel.DeepCopy()
	if patch.Name != nil {
		newChannel.name = *patch.Name
	}

	// Question: How do we handle setting / deletion of Props?

	return newChannel
}

// DeepCopy methods for model objects ensure immutability.
func (channel *Channel) DeepCopy() Channel {
	// Question: can we automate the implementation of these DeepCopy functions?
	// Question: if not, can we use govet to ensure they are correct?

	newChannel := Channel{
		id: channel.id,
		name: channel.name,
	}

	// For pointer types, copy the *value* not the pointer.
	if channel.schemeID != nil {
		*newChannel.schemeID = *channel.schemeID
	}

	// Question: how do we handle slices and maps on the model object, such as Props?

	return newChannel
}

// Question: how do we create a brand new Channel model object?

// Question: how do we populate a Channel model object when querying
// the database in the store layer?

// Question: do we provide any helper methods for JSON marshalling/unmarshalling?
