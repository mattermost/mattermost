package dtos

// Impression struct to map an impression
type Impression struct {
	KeyName      string `json:"k"`
	BucketingKey string `json:"b"`
	FeatureName  string `json:"f"`
	Treatment    string `json:"t"`
	Label        string `json:"r"`
	ChangeNumber int64  `json:"c"`
	Time         int64  `json:"m"`
	Pt           int64  `json:"pt,omitempty"`
}

// ImpressionQueueObject struct mapping impressions
type ImpressionQueueObject struct {
	Metadata   Metadata   `json:"m"`
	Impression Impression `json:"i"`
}

// ImpressionDTO struct to map an impression
type ImpressionDTO struct {
	KeyName      string `json:"k"`
	Treatment    string `json:"t"`
	Time         int64  `json:"m"`
	ChangeNumber int64  `json:"c"`
	Label        string `json:"r"`
	BucketingKey string `json:"b,omitempty"`
	Pt           int64  `json:"pt,omitempty"`
}

// ImpressionsDTO struct mapping impressions to post
type ImpressionsDTO struct {
	TestName       string          `json:"f"`
	KeyImpressions []ImpressionDTO `json:"i"`
}

// ImpressionsInTimeFrameDTO struct mapping impressionsCount in time window
type ImpressionsInTimeFrameDTO struct {
	FeatureName string `json:"f"`
	TimeFrame   int64  `json:"m"`
	RawCount    int64  `json:"rc"`
}

// ImpressionsCountDTO struct mapping impressions count to post
type ImpressionsCountDTO struct {
	PerFeature []ImpressionsInTimeFrameDTO `json:"pf"`
}
