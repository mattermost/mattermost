package local

import (
	"fmt"
	"io/ioutil"
	"log"
	"regexp"
	"runtime/debug"
	"strings"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"

	yaml "gopkg.in/yaml.v2"
)

const (
	// SplitFileFormatClassic represents the file format of the standard split definition file <feature treatment>
	SplitFileFormatClassic = iota
	// SplitFileFormatJSON represents the file format of a JSON representation of split dtos
	SplitFileFormatJSON
	// SplitFileFormatYAML represents the file format of a YAML representation of split dtos
	SplitFileFormatYAML
)

// FileSplitFetcher struct fetches splits from a file
type FileSplitFetcher struct {
	splitFile        string
	fileFormat       int
	lastChangeNumber int64
}

// NewFileSplitFetcher returns a new instance of LocalFileSplitFetcher
func NewFileSplitFetcher(splitFile string, logger logging.LoggerInterface) *FileSplitFetcher {
	var r = regexp.MustCompile("(?i)(.yml$|.yaml$)")
	if r.MatchString(splitFile) {
		return &FileSplitFetcher{
			splitFile:  splitFile,
			fileFormat: SplitFileFormatYAML,
		}
	}
	logger.Warning("Localhost mode: .split mocks will be deprecated soon in favor of YAML files, which provide more targeting power. Take a look in our documentation.")
	return &FileSplitFetcher{
		splitFile:  splitFile,
		fileFormat: SplitFileFormatClassic,
	}
}

func parseSplitsClassic(data string) []dtos.SplitDTO {
	splits := make([]dtos.SplitDTO, 0)
	lines := strings.Split(data, "\n")
	for _, line := range lines {
		words := strings.Fields(line)
		if len(words) < 2 || len(words[0]) < 1 || words[0][0] == '#' {
			// Skip the line if it has less than two words, the words are empty strings or
			// it begins with '#' character
			continue
		}
		splitName := words[0]
		treatment := words[1]
		splits = append(splits, createSplit(
			splitName,
			treatment,
			createRolloutCondition(treatment),
			make(map[string]string),
		))
	}
	return splits
}

func createSplit(splitName string, treatment string, condition dtos.ConditionDTO, configurations map[string]string) dtos.SplitDTO {
	split := dtos.SplitDTO{
		Name:              splitName,
		TrafficAllocation: 100,
		Conditions:        []dtos.ConditionDTO{condition},
		Status:            "ACTIVE",
		DefaultTreatment:  "control",
		Configurations:    configurations,
	}
	return split
}

func createWhitelistedCondition(treatment string, keys interface{}) dtos.ConditionDTO {
	var whitelist []string
	switch keys := keys.(type) {
	case string:
		whitelist = []string{keys}
	case []string:
		whitelist = keys
	case []interface{}:
		whitelist = make([]string, 0)
		for _, key := range keys {
			k, ok := key.(string)
			if ok {
				whitelist = append(whitelist, k)
			}
		}
	default:
		whitelist = make([]string, 0)
	}
	return dtos.ConditionDTO{
		ConditionType: "WHITELIST",
		Label:         "LOCAL_",
		MatcherGroup: dtos.MatcherGroupDTO{
			Combiner: "AND",
			Matchers: []dtos.MatcherDTO{
				{
					MatcherType: "WHITELIST",
					Negate:      false,
					Whitelist: &dtos.WhitelistMatcherDataDTO{
						Whitelist: whitelist,
					},
				},
			},
		},
		Partitions: []dtos.PartitionDTO{
			{
				Size:      100,
				Treatment: treatment,
			},
		},
	}
}

func createRolloutCondition(treatment string) dtos.ConditionDTO {
	return dtos.ConditionDTO{
		ConditionType: "ROLLOUT",
		Label:         "LOCAL_ROLLOUT",
		MatcherGroup: dtos.MatcherGroupDTO{
			Combiner: "AND",
			Matchers: []dtos.MatcherDTO{
				{
					MatcherType: "ALL_KEYS",
					Negate:      false,
				},
			},
		},
		Partitions: []dtos.PartitionDTO{
			{
				Size:      100,
				Treatment: treatment,
			},
			{
				Size:      0,
				Treatment: "_",
			},
		},
	}
}

func createCondition(keys interface{}, treatment string) dtos.ConditionDTO {
	if keys != nil {
		return createWhitelistedCondition(treatment, keys)
	}
	return createRolloutCondition(treatment)
}

func parseSplitsYAML(data string) (d []dtos.SplitDTO) {
	// Set up a guard deferred function to recover if some error occurs during parsing
	defer func() {
		if r := recover(); r != nil {
			// At this point we'll only trust that the logger isn't panicking trust
			// that the logger isn't panicking
			log.Fatalf("Localhost Parsing: %v", string(debug.Stack()))
			d = make([]dtos.SplitDTO, 0)
		}
	}()

	splits := make([]dtos.SplitDTO, 0)

	var splitsFromYAML []map[string]map[string]interface{}
	err := yaml.Unmarshal([]byte(data), &splitsFromYAML)
	if err != nil {
		log.Fatalf("error: %v", err)
		return splits
	}

	splitsToParse := make(map[string]dtos.SplitDTO, 0)

	for _, splitMap := range splitsFromYAML {
		for splitName, splitParsed := range splitMap {
			split, ok := splitsToParse[splitName]
			treatment, isString := splitParsed["treatment"].(string)
			if !isString {
				break
			}
			config, isValidConfig := splitParsed["config"].(string)
			if !ok {
				configurations := make(map[string]string)
				if isValidConfig {
					configurations[treatment] = config
				}
				splitsToParse[splitName] = createSplit(
					splitName,
					treatment,
					createCondition(splitParsed["keys"], treatment),
					configurations,
				)
			} else {
				newCondition := createCondition(splitParsed["keys"], treatment)
				if newCondition.ConditionType == "ROLLOUT" {
					split.Conditions = append(split.Conditions, newCondition)
				} else {
					split.Conditions = append([]dtos.ConditionDTO{newCondition}, split.Conditions...)
				}
				configurations := split.Configurations
				if isValidConfig {
					configurations[treatment] = config
				}
				split.Configurations = configurations
				splitsToParse[splitName] = split
			}

		}
	}

	for _, split := range splitsToParse {
		splits = append(splits, split)
	}

	return splits
}

// Fetch parses the file and returns the appropriate structures
func (s *FileSplitFetcher) Fetch(changeNumber int64) (*dtos.SplitChangesDTO, error) {
	fileContents, err := ioutil.ReadFile(s.splitFile)
	if err != nil {
		return nil, err
	}

	var splits []dtos.SplitDTO
	var till int64
	since := s.lastChangeNumber
	if s.lastChangeNumber != 0 {
		//The first time we should return since == till
		till = since + 1
	}

	data := string(fileContents)
	switch s.fileFormat {
	case SplitFileFormatClassic:
		splits = parseSplitsClassic(data)
	case SplitFileFormatYAML:
		splits = parseSplitsYAML(data)
	case SplitFileFormatJSON:
		return nil, fmt.Errorf("JSON is not yet supported")
	default:
		return nil, fmt.Errorf("Unsupported file format")

	}

	s.lastChangeNumber++
	return &dtos.SplitChangesDTO{
		Splits: splits,
		Since:  since,
		Till:   till,
	}, nil
}
