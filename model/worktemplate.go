package model

type WorkTemplateCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WorkTemplate struct {
	ID           string                   `json:"id"`
	Category     string                   `json:"category"`
	UseCase      string                   `json:"useCase"`
	Illustration string                   `json:"illustration"`
	Visibility   string                   `json:"visibility"`
	FeatureFlag  *WorkTemplateFeatureFlag `json:"featureFlag,omitempty"`
	Description  Description              `json:"description"`
	Content      []WorkTemplateContent    `json:"content"`
}

type WorkTemplateFeatureFlag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type DescriptionContent struct {
	Message      string `json:"message"`
	Illustration string `json:"illustration"`
}

type Description struct {
	Channel     *DescriptionContent `json:"channel"`
	Board       *DescriptionContent `json:"board"`
	Playbook    *DescriptionContent `json:"playbook"`
	Integration *DescriptionContent `json:"integration"`
}

type WorkTemplateChannel struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Purpose      string `json:"purpose"`
	Playbook     string `json:"playbook"`
	Illustration string `json:"illustration"`
}

type WorkTemplateBoard struct {
	ID           string `json:"id"`
	Template     string `json:"template"`
	Name         string `json:"name"`
	Channel      string `json:"channel"`
	Illustration string `json:"illustration"`
}

type WorkTemplatePlaybook struct {
	Template     string `json:"template"`
	Name         string `json:"name"`
	ID           string `json:"id"`
	Illustration string `json:"illustration"`
}

type WorkTemplateIntegration struct {
	ID string `json:"id"`
}

type WorkTemplateContent struct {
	Channel     *WorkTemplateChannel     `json:"channel,omitempty"`
	Board       *WorkTemplateBoard       `json:"board,omitempty"`
	Playbook    *WorkTemplatePlaybook    `json:"playbook,omitempty"`
	Integration *WorkTemplateIntegration `json:"integration,omitempty"`
}
