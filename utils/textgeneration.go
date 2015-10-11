// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"math/rand"
	"strings"
)

const (
	ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890"
	LOWERCASE    = "abcdefghijklmnopqrstuvwxyz"
)

// Strings that should pass as acceptable posts
var FUZZY_STRINGS_POSTS = []string{
	"*", "?", ".", "}{][)(><", "{}[]()<>",

	"qahwah ( قهوة)",
	"שָׁלוֹם עֲלֵיכֶם",
	"Ramen チャーシュー chāshū",
	"言而无信",
	"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒",
	"&amp; &lt; &qu",

	"' or '1'='1' -- ",
	"' or '1'='1' ({ ",
	"' or '1'='1' /* ",
	"1;DROP TABLE users",

	"<b><i><u><strong><em>",

	"sue@thatmightbe",
	"sue@thatmightbe.",
	"sue@thatmightbe.c",
	"sue@thatmightbe.co",
	"su+san@thatmightbe.com",
	"a@b.中国",
	"1@2.am",
	"a@b.co.uk",
	"a@b.cancerresearch",
	"local@[127.0.0.1]",

	"!@$%^&:*.,/|;'\"+=?`~#",
	"'\"/\\\"\"''\\/",
	"gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
	"gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
	"ą ć ę ł ń ó ś ź ż č ď ě ň ř š ť ž ă î ø å æ á é í ó ú Ç Ğ İ Ö Ş Ü",
	"abcdefghijklmnopqrstuvwrxyz0123456789 -_",
	"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒nͧ̍̓̃͋vok̂̓ͤ̓̂ěͬ ͆tͬ̐́̐͆h̒̏͌̓e͂ ̎̊h̽͆ͯ̄ͮi͊̂ͧͫ̇̃vͥͦ́ẻͤ-͒m̈́̀i̓ͮ͗̑͌̆̅n̓̓ͨd̊̑͛̔̚ ͨͮ̊̾rͪeͭͭ͑ͧ́͋p̈́̅̚rͧe̒̈̌s̍̽ͩ̓̇e͗n̏͊ͬͭtͨ͆ͤ̚iͪ͗̍n͐͒g̾ͦ̎ ͥ͌̽̊ͩͥ͗c̀ͬͣha̍̏̉ͪ̈̚o̊̏s̊̋̀̏̽̚.͒ͫ͛͛̎ͥ",
	"H҉̵̞̟̠̖̗̘Ȅ̐̑̒̚̕̚ IS C̒̓̔̿̿̿̕̚̚̕̚̕̚̕̚̕̚̕̚OMI҉̵̞̟̠̖̗̘NG > ͡҉҉ ̵̡̢̛̗̘̙̜̝̞̟̠͇̊̋̌̍̎̏̿̿̿̚ ҉ ҉҉̡̢̡̢̛̛̖̗̘̙̜̝̞̟̠̖̗̘̙̜̝̞̟̠̊̋̌̍̎̏̐̑̒̓̔̊̋̌̍̎̏̐̑ ͡҉҉",

	"<a href=\"//www.google.com\">Teh Googles</a>",
	"<img src=\"//upload.wikimedia.org/wikipedia/meta/b/be/Wikipedia-logo-v2_2x.png\" />",
	"&amp; &lt; &quot; &apos;",
	" %21 %23 %24 %26 %27 %28 %29 %2A	%2B	%2C	%2F	%3A	%3B	%3D	%3F	%40	%5B	%5D %0D %0A %0D%0A %20 %22 %25 %2D %2E %3C %3E %5C %5E %5F %60 %7B %7C %7D %7E",

	";alert('Well this is awkward.');",
	"<script type='text/javascript'>alert('yay puppies');</script>",

	"http?q=foobar%0d%0aContent-\nLength:%200%0d%0a%0d%0aHTTP/1.1%20200%20OK%0d%0aContent-\nType:%20text/html%0d%0aContent-Length:%2019%0d%0a%0d%0a<html>Shazam</html>",

	"apos'trophe@thatmightbe.com",
	"apos''''trophe@thatmightbe.com",
	"su+s+an@thatmightbe.com",
	"per.iod@thatmightbe.com",
	"per..iods@thatmightbe.com",
	".period@thatmightbe.com",
	"tom(comment)@thatmightbe.com",
	"(comment)tom@thatmightbe.com",
	"\"quotes\"@thatmightbe.com",
	"\"\\\"(),:;<>@[\\]\"@thatmightbe.com",
	"a!#$%&'*+-/=?^_`{|}~b@thatmightbe.com",
	"jill@(comment)example.com",
	"jill@example.com(comment)",
	"ben@ggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg.com",
	"judy@gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg.com",
	"ggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.com",
}

// Strings that should pass as acceptable team names
var FUZZY_STRINGS_NAMES = []string{
	"*",
	"?",
	".",
	"}{][)(><",
	"{}[]()<>",

	"qahwah ( قهوة)",
	"שָׁלוֹם עֲלֵיכֶם",
	"Ramen チャーシュー chāshū",
	"言而无信",
	"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒",
	"&amp; &lt; &qu",

	"' or '1'='1' -- ",
	"' or '1'='1' ({ ",
	"' or '1'='1' /* ",
	"1;DROP TABLE users",

	"<b><i><u><strong><em>",

	"sue@thatmightbe",
	"sue@thatmightbe.",
	"sue@thatmightbe.c",
	"sue@thatmightbe.co",
	"sue @ thatmightbe.com",
	"apos'trophe@thatmightbe.com",
	"apos''''trophe@thatmightbe.com",
	"su+san@thatmightbe.com",
	"su+s+an@thatmightbe.com",
	"per.iod@thatmightbe.com",
	"per..iods@thatmightbe.com",
	".period@thatmightbe.com",
	"tom(comment)@thatmightbe.com",
	"(comment)tom@thatmightbe.com",
	"\"quotes\"@thatmightbe.com",
	"\"\\\"(),:;<>@[\\]\"@thatmightbe.com",
	"a!#$%&'*+-/=?^_`{|}~b@thatmightbe.com",
	"local@[127.0.0.1]",
	"jill@(comment)example.com",
	"jill@example.com(comment)",
	"a@b.中国",
	"1@2.am",
	"a@b.co.uk",
	"a@b.cancerresearch",

	"<a href=\"//www.google.com\">Teh Googles</a>",
	"<img src=\"//upload.wikimedia.org/wikipelogo-v2_2x.png\" />",
	"<b><i><u><strong><em>",
	"&amp; &lt; &quot; &apos;",

	";alert('Well this is awkward.');",
	"<script type='text/javascript'>alert('yay puppies');</script>",

	"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒nͧ̍̓̃͋v",
	"H҉̵̞̟̠̖̗̘Ȅ̐̐̑̒̚OMI҉̵̞̟̠",
}

// Strings that should pass as acceptable emails
var FUZZY_STRINGS_EMAILS = []string{
	"sue@thatmightbe",
	"sue@thatmightbe.c",
	"sue@thatmightbe.co",
	"su+san@thatmightbe.com",
	"1@2.am",
	"a@b.co.uk",
	"a@b.cancerresearch",
	"su+s+an@thatmightbe.com",
	"per.iod@thatmightbe.com",
}

// Lovely giberish for all to use
const GIBBERISH_TEXT = `
Thus one besides much goodness shyly far some hyena overtook since rhinoceros nodded withdrew wombat before deserved apart a alongside the far dalmatian less ouch where yet a salmon.
Then jeez far marginal hey aboard more as leaned much oversold that inside spoke showed much went crud close save so and and after and informally much lion commendably less conductive oh excepting conductive compassionate jeepers hey a much leopard alas woolly untruthful outside snug rashly one cunning past fabulous adjusted far woodchuck and and indecisive crud loving exotic less resolute ladybug sprang drank under following far the as hence passably stolidly jeez the inset spaciously more cozily fishily the hey alas petted one audible yikes dear preparatory darn goldfinch gosh a then as moth more guinea.
Timid mislaid as salamander yikes alas ouch much that goldfinch shark in before instead dear one swore vivid versus one until regardless sang panther tolerable much preparatory hardily shuddered where coquettish far sheep coarsely exaggerated preparatory because cordial awesome gradually nutria that dear mocking behind off staunchly regarding a the komodo crud shrewd well jeez iguanodon strove strived and moodily and sought and and mounted gosh aboard crud spitefully boa.
One as highhanded fortuitous angelfish so one woodchuck dazedly kangaroo nasty instead far parrot away the worm yet testy where caribou a cuckoo onto dear reined because less tranquil kindhearted and shuddered plankton astride monkey methodically above evasive otter this wrung and courageous iguana wayward along cowered prior a.
Freely since ouch octopus the heated apart on hey the some pending placed fearless jeepers hardheadedly more that less jolly bit cuddled.
Caterpillar laboriously far wistful spilled aside far oriole newt and immeasurably yikes revealed raptly obdurately definitely scallop titilatingly one alongside monumentally ouch much wretched the spoke a before alas insolent abortive that turned hey hare much poignantly re-laid goodness yet the dear compassionate a hey scooped sped darn warmly oh and more darn craven that overtook fell and bluebird misheard that needless less ravenously in positively far romantically some babbled that rose honey then immaturely this and jollily irresistible much rarely earthworm parrot wow.
Less less bluntly jeez at goodness panther opposite oh purred a pathetically mildly less cat badly much much on from obscure in gull off manatee hatchet goodness euphemistically hence or understandable after this so that thus shook hence that mindfully yellow behind far bat wayward thanks more wrote so the flapped however alas and mallard that temperately irritably yikes squirrel.
Some reset some therefore demonstrably considering dachshund kindhearted far wow far whispered far clung this by partook much upon fit inscrutably so affirmative diligently far grinned and manifestly hummingbird hello caudal considering when aboard much buoyantly that unfitting far attractively far during much crud baneful jeez one toneless cynically oh spurious athletic meadowlark much generously one subconsciously arguable much forthrightly hawk inoffensively.
Snorted tidy stiffly against one fiendishly began burst hey revealed a beside the soothingly ceremonially affirmatively cowered when fitted this static hello emoted assenting however while far that gross besides because and dear.
Far therefore the blushed momentously the however one a wholeheartedly and considering incessantly that neurotically wore firefly grouped impotently dear one abjectly goodness so far a honey far insolently far so greyhound between above raucously echidna more halfhearted thankful squid one.
Raccoon cockatoo this while but this a far among ouch and hey alas scallop black sane as yikes hello sexy far tacky and balked wrongly more near shrewdly the yet gosh much caribou ruthlessly a on far a threw well less at the one after.
Spoke touched barbarously before much thus therefore darn scratched oh howled the less much hello after and jeez flagrantly weirdly crud komodo fabulous the much some cow jeering much egregiously a bucolically a admirably jeepers essential when ouch and tapir this while and wolverine.
Cm more much in this rewrote ouch on from aside wildebeest crane saddled where much opposite endearingly hummingbird together some beside a the goodness dear ouch ouch struck the input smooched shrugged until slick as waked hawk sincere irksomely.
Camel the pulled this richly grimaced leopard more false thought dear militant added yikes supp infallibly set orca beat hello while accurately reliably while lorikeet one strategic less hello without and smooched across plankton but jeepers pangolin the rich seal sneered pre-set lynx on radical nasty alas onto more hence flabby outbid murkily congenially dived much lubber added far eccentrically turtle before outsold onto ouch thus much and hawk tolerable much knitted yikes shot much limpet one this woolly much however hence up angry up well.
Unicorn yawned hello boundless this when express jaded closed wept tranquil after came airily merry much dismounted for much extensively less interminably far one far armadillo pled dolphin alas nutria and more oh positively koala grizzly after falcon goat strict hooted next browbeat split more far far antagonistic lingering the depending pending sheared since up before jeepers distant mastodon dropped as this more some much set far infinitesimal well shark grasshopper as hey one via some fishy and immaturely remote where weasel leopard annoying correctly wherever that sniffled much mandrill on jeez adventurous much.
Jeepers before spitefully buoyant concentric the reset moth a darn decidedly baboon giraffe outrageously groundhog on one at more overslept gosh worm away far far less much hysteric showed on so rattlesnake the and immature yikes baneful hence wow lynx hence past scornfully groaned pounded dived this one outside dachshund scowled one prior tenable therefore before scratched much much drank hey while added rabbit shark and supp cut this ironic limpet hedgehog bound more rebuking the jeepers thorough while more far due but yikes nastily brave dangerous opened tangibly aside after acrimoniously one cackled scratched.
Canny salmon hatchet more far opposite much coughed excited expedient far lizard one indiscriminate yikes jeez powerlessly forcefully tiger rooster and brought far more during this sank onto after then less amorally rude unerring some alongside irrespective bat hungrily kangaroo extravagantly inside ouch much gosh dreadfully oh much darn prior as fired guinea.
Irksomely upon up for amicably one since contrary one until flamingo tarantula far koala despite easy well gazelle ungracefully rose less that under hey more criminal unique furrowed so disbanded normal where one a a hey circuitous ouch feverish for the kookaburra and pithy far far then more the versus cliquishly across oh and explicitly much therefore as tamely alongside underlay much yikes imminently off however far across instantaneous therefore wallaby evidently foul foretold as far a jeepers invidious bearish.
More and until scandalously after wallaby petted oh much as poked much caterpillar drank beside rode actively walking scooped weird this duteous that far before human during dear house thrust more flinched opposite that ahead in far.
The painful essential jeepers merrily proudly essential and less far dismounted inside mongoose beyond confessedly robin shined heron the during since according suggestively and less some strident combed alas much man-of-war forgave so and to then inanimately.
Beside far this this a crud polite cantankerous exclusively misheard pled far circuitously and frugal less more temperately gauche goldfinch oh against this along excitedly goodhearted more classically quit serenely outside vulture ouch after one a this yet.
Less and handsomely manatee some amidst much reined komodo busted exultingly but fatuously less across mighty goodness objective alas glaringly gregariously hello the since one pridefully much well placed far less goodness jellyfish unnecessary reciprocating a far stylistic gazed one.
Hey rethought excepting lamely much and naughtily amidst more since jeez then bluebird hence less bald by some brought left the across logic loyal brightly jeez capitally that less more forward rebound a yikes chose convulsively confidently repeated broadcast much dipped when awesomely or some some regal the scowled merry zebra since more credible so inescapably fetchingly and lantern that due dear one went gosh wow well furrowed much much specially spoiled as vitally instead the seriously some rooster irrespective well imprecisely rapidly more llama.
Up to and hey without pill that this squid alas brusque on inventoried and spread the more excepting aristocratically due piquant wove beneath that macaw in more until much grimaced far and jeez enticingly unicorn some far crab more barring purely jeepers clear groomed glaring hey dear hence before the the this hello.`

func RandString(l int, charset string) string {
	ret := make([]byte, l)
	for i := 0; i < l; i++ {
		ret[i] = charset[rand.Intn(len(charset))]
	}
	return string(ret)
}

func RandomEmail(length Range, charset string) string {
	emaillen := RandIntFromRange(length)
	username := RandString(emaillen, charset)
	domain := "simulator.amazonses.com"
	return "success+" + username + "@" + domain
}

func FuzzEmail() string {
	return FUZZY_STRINGS_EMAILS[RandIntFromRange(Range{0, len(FUZZY_STRINGS_EMAILS) - 1})]
}

func RandomName(length Range, charset string) string {
	namelen := RandIntFromRange(length)
	return RandString(namelen, charset)
}

func FuzzName() string {
	return FUZZY_STRINGS_NAMES[RandIntFromRange(Range{0, len(FUZZY_STRINGS_NAMES) - 1})]
}

// Random selection of text for post
func RandomText(length Range, hashtags Range, mentions Range, users []string) string {
	textLength := RandIntFromRange(length)
	numHashtags := RandIntFromRange(hashtags)
	numMentions := RandIntFromRange(mentions)
	if textLength > len(GIBBERISH_TEXT) || textLength < 0 {
		textLength = len(GIBBERISH_TEXT)
	}
	startPosition := RandIntFromRange(Range{0, len(GIBBERISH_TEXT) - textLength - 1})

	words := strings.Split(GIBBERISH_TEXT[startPosition:startPosition+textLength], " ")
	for i := 0; i < numHashtags; i++ {
		randword := RandIntFromRange(Range{0, len(words) - 1})
		words = append(words, " #"+words[randword])
	}
	if len(users) > 0 {
		for i := 0; i < numMentions; i++ {
			randuser := RandIntFromRange(Range{0, len(users) - 1})
			words = append(words, " @"+users[randuser])
		}
	}

	// Shuffle the words
	for i := range words {
		j := rand.Intn(i + 1)
		words[i], words[j] = words[j], words[i]
	}

	return strings.Join(words, " ")
}

func FuzzPost() string {
	return FUZZY_STRINGS_POSTS[RandIntFromRange(Range{0, len(FUZZY_STRINGS_NAMES) - 1})]
}
