package flow

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

type Color string

const (
	ColorDefault Color = "default"
	ColorPrimary Color = "primary"
	ColorSuccess Color = "success"
	ColorGood    Color = "good"
	ColorWarning Color = "warning"
	ColorDanger  Color = "danger"
)

type Step struct {
	name        Name
	template    *model.SlackAttachment
	forwardTo   Name
	autoForward bool
	terminal    bool
	onRender    func(f *Flow)
	buttons     []Button
}

type Button struct {
	Name     string
	Disabled bool
	Color    Color

	// OnClick is called when the button is clicked. It returns the next step's
	// name and the state updates to apply.
	//
	// If Dialog is also specified, OnClick is executed first.
	OnClick func(f *Flow) (Name, State, error)

	// Dialog is the interactive dialog to display if the button is clicked
	// (OnClick is executed first). OnDialogSubmit must be provided.
	Dialog *model.Dialog

	// Function that is called when the dialog box is submitted. It can return a
	// general error, or field-specific errors. On success it returns the name
	// of the next step, and the state updates to apply.
	OnDialogSubmit func(f *Flow, submitted map[string]interface{}) (Name, State, map[string]string, error)
}

func NewStep(name Name) Step {
	return Step{
		name:     name,
		template: &model.SlackAttachment{},
	}
}

func (s Step) WithButton(buttons ...Button) Step {
	s.buttons = append(s.buttons, buttons...)
	return s
}

func (s Step) Terminal() Step {
	s.terminal = true
	return s
}

func (s Step) OnRender(f func(*Flow)) Step {
	s.onRender = f
	return s
}

func (s Step) Next(name Name) Step {
	s.forwardTo = name
	s.autoForward = true
	return s
}

func (s Step) WithImage(imageURL string) Step {
	if u, err := url.Parse(imageURL); err == nil {
		if u.Host != "" && (u.Scheme == "http" || u.Scheme == "https") {
			s.template.ImageURL = imageURL
		} else {
			s.template.ImageURL = u.Path
		}
	}
	return s
}

func (s Step) WithColor(color Color) Step {
	s.template.Color = string(color)
	return s
}

func (s Step) WithPretext(text string) Step {
	s.template.Pretext = text
	return s
}

func (s Step) WithField(title, value string) Step {
	s.template.Fields = append(s.template.Fields, &model.SlackAttachmentField{
		Title: title,
		Value: value,
	})
	return s
}

func (s Step) WithTitle(text string) Step {
	s.template.Title = text
	return s
}

func (s Step) WithText(text string) Step {
	s.template.Text = text
	return s
}

func (s Step) do(f *Flow) (*model.Post, bool, error) {
	if s.onRender != nil {
		s.onRender(f)
	}

	return s.render(f, false, 0)
}

func (s Step) done(f *Flow, selectedButton int) (*model.Post, error) {
	post, _, err := s.render(f, true, selectedButton)
	return post, err
}

func (s Step) render(f *Flow, done bool, selectedButton int) (*model.Post, bool, error) {
	sa := f.processAttachment(s.template)
	post := model.Post{}
	model.ParseSlackAttachment(&post, []*model.SlackAttachment{sa})

	if s.terminal {
		// Nothing else to do, do not display buttons on terminal posts.
		return &post, true, nil
	}

	buttons := processButtons(s.buttons, f.state.AppState)

	attachments, ok := post.GetProp("attachments").([]*model.SlackAttachment)
	if !ok || len(attachments) != 1 {
		return nil, false, errors.New("expected 1 slack attachment")
	}
	var actions []*model.PostAction
	if done {
		if selectedButton > 0 {
			action := renderButton(buttons[selectedButton-1], s.name, selectedButton, f.state.AppState)
			action.Disabled = true
			actions = append(actions, action)
		}
	} else {
		for i, b := range buttons {
			actions = append(actions, renderButton(b, s.name, i+1, f.state.AppState))
		}
	}
	attachments[0].Actions = actions
	return &post, false, nil
}

func (f *Flow) processAttachment(attachment *model.SlackAttachment) *model.SlackAttachment {
	if attachment == nil {
		return &model.SlackAttachment{Text: "ERROR"}
	}
	a := *attachment
	a.Pretext = formatState(attachment.Pretext, f.state.AppState)
	a.Title = formatState(attachment.Title, f.state.AppState)
	a.Text = formatState(attachment.Text, f.state.AppState)

	for _, field := range a.Fields {
		field.Title = formatState(field.Title, f.state.AppState)
		v := field.Value.(string)
		if v != "" {
			field.Value = formatState(v, f.state.AppState)
		}
	}

	a.Fallback = fmt.Sprintf("%s: %s", a.Title, a.Text)

	if attachment.ImageURL != "" {
		if u, err := url.Parse(attachment.ImageURL); err == nil {
			if u.Host != "" && (u.Scheme == "http" || u.Scheme == "https") {
				a.ImageURL = attachment.ImageURL
			} else {
				a.ImageURL = f.pluginURL + "/" + strings.TrimPrefix(attachment.ImageURL, "/")
			}
		}
	}

	return &a
}

func processButtons(in []Button, state State) []Button {
	var out []Button
	for _, b := range in {
		button := b
		button.Name = formatState(b.Name, state)
		out = append(out, button)
	}
	return out
}

func processDialog(in *model.Dialog, state State) model.Dialog {
	d := *in
	d.Title = formatState(d.Title, state)
	d.IntroductionText = formatState(d.IntroductionText, state)
	d.SubmitLabel = formatState(d.SubmitLabel, state)
	for i := range d.Elements {
		d.Elements[i].DisplayName = formatState(d.Elements[i].DisplayName, state)
		d.Elements[i].Name = formatState(d.Elements[i].Name, state)
		d.Elements[i].Default = formatState(d.Elements[i].Default, state)
		d.Elements[i].Placeholder = formatState(d.Elements[i].Placeholder, state)
		d.Elements[i].HelpText = formatState(d.Elements[i].HelpText, state)
	}
	return d
}

func renderButton(b Button, stepName Name, i int, state State) *model.PostAction {
	return &model.PostAction{
		Name:     formatState(b.Name, state),
		Disabled: b.Disabled,
		Style:    string(b.Color),
		Integration: &model.PostActionIntegration{
			Context: map[string]interface{}{
				contextStepKey:   string(stepName),
				contextButtonKey: strconv.Itoa(i),
			},
		},
	}
}

func buttonContext(request *model.PostActionIntegrationRequest) (Name, int, error) {
	fromString, ok := request.Context[contextStepKey].(string)
	if !ok {
		return "", 0, errors.New("missing step name")
	}
	fromName := Name(fromString)

	buttonStr, ok := request.Context[contextButtonKey].(string)
	if !ok {
		return "", 0, errors.New("missing  button id")
	}
	buttonIndex, err := strconv.Atoi(buttonStr)
	if err != nil {
		return "", 0, errors.Wrap(err, "invalid button number")
	}

	return fromName, buttonIndex, nil
}

func dialogContext(request *model.SubmitDialogRequest) (Name, int, error) {
	data := strings.Split(request.State, ",")
	if len(data) != 2 {
		return "", 0, errors.New("invalid request")
	}
	fromName := Name(data[0])
	buttonIndex, err := strconv.Atoi(data[1])
	if err != nil {
		return "", 0, errors.Wrap(err, "malformed button number")
	}
	return fromName, buttonIndex, nil
}
