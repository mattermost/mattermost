package justext

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
)

type ResourceFunc func() ([]byte, error)

var stoplists = map[string]ResourceFunc{}

func RegisterStoplist(name string, resourceFunc ResourceFunc) {
	stoplists[name] = resourceFunc
}

/*
{
	"Afrikaans":               AfrikaansStoplist,
	"Albanian":                AlbanianStoplist,
	"Arabic":                  ArabicStoplist,
	"Aragonese":               AragoneseStoplist,
	"Armenian":                ArmenianStoplist,
	"Aromanian":               AromanianStoplist,
	"Asturian":                AsturianStoplist,
	"Azerbaijani":             AzerbaijaniStoplist,
	"Basque":                  BasqueStoplist,
	"Belarusian":              BelarusianStoplist,
	"Belarusian_Taraskievica": Belarusian_TaraskievicaStoplist,
	"Bengali":                 BengaliStoplist,
	"Bishnupriya_Manipuri":    Bishnupriya_ManipuriStoplist,
	"Bosnian":                 BosnianStoplist,
	"Breton":                  BretonStoplist,
	"Bulgarian":               BulgarianStoplist,
	"Catalan":                 CatalanStoplist,
	"Cebuano":                 CebuanoStoplist,
	"Chuvash":                 ChuvashStoplist,
	"Croatian":                CroatianStoplist,
	"Czech":                   CzechStoplist,
	"Danish":                  DanishStoplist,
	"Dutch":                   DutchStoplist,
	"English":                 EnglishStoplist,
	"Esperanto":               EsperantoStoplist,
	"Estonian":                EstonianStoplist,
	"Finnish":                 FinnishStoplist,
	"French":                  FrenchStoplist,
	"Galician":                GalicianStoplist,
	"Georgian":                GeorgianStoplist,
	"German":                  GermanStoplist,
	"Greek":                   GreekStoplist,
	"Gujarati":                GujaratiStoplist,
	"Haitian":                 HaitianStoplist,
	"Hebrew":                  HebrewStoplist,
	"Hindi":                   HindiStoplist,
	"Hungarian":               HungarianStoplist,
	"Icelandic":               IcelandicStoplist,
	"Ido":                     IdoStoplist,
	"Igbo":                    IgboStoplist,
	"Indonesian":              IndonesianStoplist,
	"Irish":                   IrishStoplist,
	"Italian":                 ItalianStoplist,
	"Javanese":                JavaneseStoplist,
	"Kannada":                 KannadaStoplist,
	"Kazakh":                  KazakhStoplist,
	"Korean":                  KoreanStoplist,
	"Kurdish":                 KurdishStoplist,
	"Kyrgyz":                  KyrgyzStoplist,
	"Latin":                   LatinStoplist,
	"Latvian":                 LatvianStoplist,
	"Lithuanian":              LithuanianStoplist,
	"Lombard":                 LombardStoplist,
	"Low_Saxon":               Low_SaxonStoplist,
	"Luxembourgish":           LuxembourgishStoplist,
	"Macedonian":              MacedonianStoplist,
	"Malay":                   MalayStoplist,
	"Malayalam":               MalayalamStoplist,
	"Maltese":                 MalteseStoplist,
	"Marathi":                 MarathiStoplist,
	"Neapolitan":              NeapolitanStoplist,
	"Nepali":                  NepaliStoplist,
	"Newar":                   NewarStoplist,
	"Norwegian_Bokmal":        Norwegian_BokmalStoplist,
	"Norwegian_Nynorsk":       Norwegian_NynorskStoplist,
	"Occitan":                 OccitanStoplist,
	"Persian":                 PersianStoplist,
	"Piedmontese":             PiedmonteseStoplist,
	"Polish":                  PolishStoplist,
	"Portuguese":              PortugueseStoplist,
	"Quechua":                 QuechuaStoplist,
	"Romanian":                RomanianStoplist,
	"Russian":                 RussianStoplist,
	"Samogitian":              SamogitianStoplist,
	"Serbian":                 SerbianStoplist,
	"Serbo_Croatian":          Serbo_CroatianStoplist,
	"Sicilian":                SicilianStoplist,
	"Simple_English":          Simple_EnglishStoplist,
	"Slovak":                  SlovakStoplist,
	"Slovenian":               SlovenianStoplist,
	"Spanish":                 SpanishStoplist,
	"Sundanese":               SundaneseStoplist,
	"Swahili":                 SwahiliStoplist,
	"Swedish":                 SwedishStoplist,
	"Tagalog":                 TagalogStoplist,
	"Tamil":                   TamilStoplist,
	"Telugu":                  TeluguStoplist,
	"Turkish":                 TurkishStoplist,
	"Turkmen":                 TurkmenStoplist,
	"Ukrainian":               UkrainianStoplist,
	"Urdu":                    UrduStoplist,
	"Uzbek":                   UzbekStoplist,
	"Vietnamese":              VietnameseStoplist,
	"Volapuk":                 VolapukStoplist,
	"Walloon":                 WalloonStoplist,
	"Waray_Waray":             Waray_WarayStoplist,
	"Welsh":                   WelshStoplist,
	"West_Frisian":            West_FrisianStoplist,
	"Western_Panjabi":         Western_PanjabiStoplist,
	"Yoruba":                  YorubaStoplist,
}
*/

func ReadStoplist(filename string) (map[string]bool, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	db := bytes.Split(data, []uint8("\n"))

	// Convert to map
	var list = make(map[string]bool)
	for _, val := range db {
		list[string(val)] = true
	}

	return list, nil
}

func GetStoplist(language string) (map[string]bool, error) {
	if _, ok := stoplists[language]; !ok {
		return nil, errors.New(fmt.Sprintf("Language %s not supported", language))
	}

	data, err := stoplists[language]()
	if err != nil {
		return nil, err
	}
	db := bytes.Split(data, []uint8("\n"))

	// Convert to map
	var list = make(map[string]bool)
	for _, val := range db {
		list[string(val)] = true
	}

	return list, nil
}
