package app

import (
	"fmt"
	"math/rand"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent nunc ante, scelerisque non purus a, faucibus tempor arcu. Praesent scelerisque tellus velit, eget consectetur lorem auctor nec. Curabitur molestie nunc enim, in varius sem porttitor vitae. Vestibulum ac ipsum cursus, congue ante eu, commodo neque. Vivamus et risus scelerisque, venenatis purus sit amet, porttitor nunc. Proin id nisl vel sem cursus semper. Curabitur ac facilisis ex. Aliquam non justo tristique ipsum commodo commodo non ut lectus. Aenean et finibus odio. Nulla pulvinar vulputate dui. Nulla vulputate condimentum consectetur.
Aliquam dignissim, neque non posuere aliquam, purus diam eleifend felis, vel porttitor ipsum lorem vel ex. Cras tincidunt arcu eget nisi tincidunt consequat. In eu arcu vitae enim elementum bibendum placerat vitae nisl. Donec accumsan ut dui sit amet tristique. Morbi ut tortor quis turpis convallis molestie ac sit amet tellus. Nunc convallis massa et neque feugiat commodo. Fusce pharetra nisl vitae efficitur ultrices. Etiam accumsan scelerisque magna a volutpat. Phasellus dignissim, ex a sollicitudin accumsan, mi elit pharetra lorem, vel dignissim neque est eu leo.
Nunc sed sapien faucibus quam varius maximus vitae ut lectus. Duis congue bibendum dui, in lobortis augue molestie eu. Morbi eleifend diam nec congue ornare. Phasellus iaculis nulla a congue placerat. Aenean pharetra nisi nunc, et blandit libero laoreet ut. Vestibulum consectetur risus vel tortor faucibus, et mollis tortor imperdiet. Donec aliquet sit amet enim consectetur aliquam. Phasellus non massa quam. Praesent augue enim, vulputate quis lobortis ut, dapibus a augue. Nunc sit amet velit et sapien ullamcorper dignissim eu sit amet magna. Nullam quis tempor nibh. Proin interdum dui vitae odio bibendum blandit. Vivamus a ullamcorper orci.
Donec maximus hendrerit pharetra. Morbi ut felis lectus. Curabitur eu accumsan eros. Interdum et malesuada fames ac ante ipsum primis in faucibus. Vivamus tristique quis nulla pulvinar lacinia. Aliquam cursus, sapien quis convallis blandit, arcu ante iaculis lorem, sed rutrum nunc odio ut ipsum. Quisque nec congue urna, nec sodales nisl. Donec et risus semper, auctor turpis non, hendrerit enim. Nunc sodales libero feugiat orci hendrerit feugiat. Mauris egestas varius nibh vitae dictum. In convallis laoreet urna sed hendrerit. Aenean mattis efficitur nulla id placerat. Suspendisse sit amet tempor neque. Praesent pharetra orci nunc, nec consectetur urna aliquet nec. Donec purus augue, ullamcorper ac luctus tempus, mattis in arcu.
Curabitur malesuada non leo volutpat pellentesque. Vestibulum varius, ligula in blandit ultrices, purus purus maximus dui, sit amet aliquet libero nisl ac ex. Proin efficitur, est id ultricies finibus, augue libero consectetur mi, eget molestie purus est quis diam. Etiam nec sem ac lectus mollis mollis at vitae ipsum. Praesent et tellus libero. Suspendisse sit amet elementum orci. Sed convallis tempus elit nec sodales. Sed sit amet mi eros. Ut eros turpis, ultrices eu bibendum efficitur, condimentum et ipsum. Nunc scelerisque in justo sit amet consequat. Maecenas congue ante non rhoncus mattis. Fusce sem felis, tincidunt eu metus sed, cursus lobortis urna. Suspendisse id egestas tortor. Ut facilisis mauris vitae urna pulvinar, vel viverra tortor bibendum.`

type MentionBenchmark struct {
	Name string
	Text string

	ProfileMap                  map[string]*model.User
	Groups                      map[string]*model.Group
	ChannelMemberNotifyPropsMap map[string]model.StringMap
}

func MakeMentionBenchmarks() []*MentionBenchmark {
	rand.Seed(1234567890)

	fakeWords := strings.Split(strings.TrimSpace(loremIpsum), " ")

	var benchmarks []*MentionBenchmark
	for _, numUsers := range []int{10, 100, 1000 /*, 10000, 100000, 1000000, 10000000*/} {
		users := make([]*model.User, numUsers)
		usersMap := make(map[string]*model.User, numUsers)
		channelMemberNotifyPropsMap := make(map[string]map[string]string, numUsers)
		for i := 0; i < numUsers; i++ {
			// Assumption #1 - Usernames are simple without punctuation
			user := &model.User{
				Id:        fmt.Sprintf("userid%d", i),
				Username:  fmt.Sprintf("user%duser", i),
				FirstName: fmt.Sprintf("User%d", i),
			}

			// Assumption #4 - Each user has two mention keywords, their at-mention and their case sensitive first name
			user.SetDefaultNotifications()
			user.NotifyProps["first_name"] = "true"

			usersMap[user.Id] = user
			users[i] = user
			channelMemberNotifyPropsMap[user.Id] = model.GetDefaultChannelNotifyProps()
		}

		for _, numWords := range []int{10, 100, 500 /*, 1000, 10000*/} {
			for _, numMentions := range []int{0, 5, 10, 20 /*, 50, 100, 1000*/} {
				if numUsers == 0 && numMentions > 0 {
					continue
				}

				words := make([]string, numWords)
				for i := 0; i < numWords; i++ {
					if i < numMentions {
						// Assumption #2 - For simplicity, the first M words of a post will mention a different user
						words[i] = "@" + users[i%len(users)].Username
					} else {
						// Assumption #3 - Words are simple latin words pulled from Lorem Ipsum without any punctuation
						words[i] = fakeWords[i%len(fakeWords)]
					}
				}

				name := fmt.Sprintf("%d users, %d words, %d mentions", numUsers, numWords, numMentions)
				text := strings.Join(words, " ")

				benchmarks = append(benchmarks, &MentionBenchmark{
					Name: name,
					Text: text,

					// Assumption #6 - The data pulled from the database for all cases is the same
					ProfileMap: usersMap,
					// Assumption #5 - We're not passing any Groups because they're presumably handled by this code
					// in the same way as a single mention keyword
					Groups: make(map[string]*model.Group),
				})
			}
		}
	}

	return benchmarks
}

func BenchmarkMentionParsing_Current(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)

				m := &ExplicitMentions{}
				m.processText(benchmark.Text, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_Current_Cached(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)

			for i := 0; i < b.N; i++ {
				m := &ExplicitMentions{}
				m.processText(benchmark.Text, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_NaiveRegex(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
				pattern := MakePatternFromKeywords(keywords, benchmark.Groups)

				m := &ExplicitMentions{}
				m.processTextNaiveRegex(benchmark.Text, pattern, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_NaiveRegex_Cached(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
			pattern := MakePatternFromKeywords(keywords, benchmark.Groups)

			for i := 0; i < b.N; i++ {
				m := &ExplicitMentions{}
				m.processTextNaiveRegex(benchmark.Text, pattern, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_SuffixArray(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
				pattern := MakePatternFromKeywords(keywords, benchmark.Groups)

				m := &ExplicitMentions{}
				m.processTextSuffixArray(benchmark.Text, pattern, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_SuffixArray_Cached(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
			pattern := MakePatternFromKeywords(keywords, benchmark.Groups)

			for i := 0; i < b.N; i++ {
				m := &ExplicitMentions{}
				m.processTextSuffixArray(benchmark.Text, pattern, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_AhoCorasick(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
				machine := MakeMachineFromKeywords(keywords, benchmark.Groups)

				m := &ExplicitMentions{}
				m.processTextAhoCorasick(benchmark.Text, machine, keywords, benchmark.Groups)
			}
		})
	}
}

func BenchmarkMentionParsing_AhoCorasick_Cached(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	for _, benchmark := range MakeMentionBenchmarks() {
		b.Run(benchmark.Name, func(b *testing.B) {
			keywords := th.App.getMentionKeywordsInChannel(benchmark.ProfileMap, true, benchmark.ChannelMemberNotifyPropsMap)
			machine := MakeMachineFromKeywords(keywords, benchmark.Groups)

			for i := 0; i < b.N; i++ {
				m := &ExplicitMentions{}
				m.processTextAhoCorasick(benchmark.Text, machine, keywords, benchmark.Groups)
			}
		})
	}
}
