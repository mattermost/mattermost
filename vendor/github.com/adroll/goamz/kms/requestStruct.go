package kms

type KMSAction interface {
	ActionName() string
}

type ProduceKeyOpt struct {
	EncryptionContext map[string]string `json:",omitempty"`
	GrantTokens       []string          `json:",omitempty"`
}

//The following structs are the parameters when requesting to AWS KMS
//http://docs.aws.amazon.com/kms/latest/APIReference/API_Operations.html
type DescribeKeyInfo struct {
	//4 forms for KeyId - http://docs.aws.amazon.com/kms/latest/APIReference/API_DescribeKey.html
	//1. Key ARN
	//2. Alias ARN
	//3. Globally Unique Key
	//4. Alias Name
	KeyId string
}

func (d *DescribeKeyInfo) ActionName() string {
	return "DescribeKey"
}

type ListAliasesInfo struct {
	//These parameters are optional. See http://docs.aws.amazon.com/kms/latest/APIReference/API_ListAliases.html
	Limit  int    `json:",omitempty"`
	Marker string `json:",omitempty"`
}

func (l *ListAliasesInfo) ActionName() string {
	return "ListAliases"
}

type EncryptInfo struct {
	//4 forms for KeyId - http://docs.aws.amazon.com/kms/latest/APIReference/API_Encrypt.html
	//1. Key ARN
	//2. Alias ARN
	//3. Globally Unique Key
	//4. Alias Name
	KeyId string
	ProduceKeyOpt
	Plaintext []byte
}

func (e *EncryptInfo) ActionName() string {
	return "Encrypt"
}

type DecryptInfo struct {
	CiphertextBlob []byte
	ProduceKeyOpt
}

func (d *DecryptInfo) ActionName() string {
	return "Decrypt"
}

type EnableKeyInfo struct {
	//2 forms for KeyId - http://docs.aws.amazon.com/kms/latest/APIReference/API_EnableKey.html
	//1. Key ARN
	//2. Globally Unique Key
	KeyId string
}

func (e *EnableKeyInfo) ActionName() string {
	return "EnableKey"
}

type DisableKeyInfo struct {
	//2 forms for KeyId - http://docs.aws.amazon.com/kms/latest/APIReference/API_DisableKey.html
	//1. Key ARN
	//2. Globally Unique KeyId
	KeyId string
}

func (d *DisableKeyInfo) ActionName() string {
	return "DisableKey"
}
