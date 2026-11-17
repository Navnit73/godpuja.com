// Traditional aarti, mantras, chalisa and stotras for the content seed. These are long-established texts; they are SAMPLE
// content: a qualified person must proof-read every text and meaning before launch (the seed marks them "pending review").
export type Dev = { slug: string; title: string; type: "aarti" | "mantra" | "chalisa" | "stotra"; deity: string; language: "hindi" | "sanskrit" | "marathi"; summary: string; lyrics: string; meaning: string; transliteration?: string; tags: string[]; related?: string[] };

export const DEVOTIONALS: Dev[] = [
  { slug: "om-jai-jagdish-hare", title: "Om Jai Jagdish Hare", type: "aarti", deity: "Vishnu", language: "hindi", tags: ["daily", "evening", "universal"],
    summary: "The most widely sung aarti, offered to Lord Vishnu as the protector of devotees. Sung at the close of daily puja.",
    meaning: "The aarti praises the Lord as remover of troubles, mother and father, ocean of compassion and the one refuge of the devotee, and ends with a prayer for faith, devotion and service to the saintly.",
    related: ["om-jai-lakshmi-mata", "aarti-kunj-bihari-ki"],
    lyrics: `ॐ जय जगदीश हरे, स्वामी जय जगदीश हरे।
भक्त जनों के संकट, दास जनों के संकट, क्षण में दूर करे॥
ॐ जय जगदीश हरे॥

जो ध्यावे फल पावे, दुख बिनसे मन का, स्वामी दुख बिनसे मन का।
सुख सम्पत्ति घर आवे, सुख सम्पत्ति घर आवे, कष्ट मिटे तन का॥
ॐ जय जगदीश हरे॥

मात-पिता तुम मेरे, शरण गहूँ मैं किसकी, स्वामी शरण गहूँ मैं किसकी।
तुम बिन और न दूजा, तुम बिन और न दूजा, आस करूँ मैं जिसकी॥
ॐ जय जगदीश हरे॥

तुम पूरन परमात्मा, तुम अन्तर्यामी, स्वामी तुम अन्तर्यामी।
पारब्रह्म परमेश्वर, पारब्रह्म परमेश्वर, तुम सबके स्वामी॥
ॐ जय जगदीश हरे॥

तुम करुणा के सागर, तुम पालनकर्ता, स्वामी तुम पालनकर्ता।
मैं मूरख खल कामी, मैं सेवक तुम स्वामी, कृपा करो भर्ता॥
ॐ जय जगदीश हरे॥

तुम हो एक अगोचर, सबके प्राणपति, स्वामी सबके प्राणपति।
किस विधि मिलूँ दयामय, किस विधि मिलूँ दयामय, तुमको मैं कुमति॥
ॐ जय जगदीश हरे॥

दीनबन्धु दुखहर्ता, तुम ठाकुर मेरे, स्वामी तुम ठाकुर मेरे।
अपने हाथ उठाओ, अपने शरण लगाओ, द्वार पड़ा तेरे॥
ॐ जय जगदीश हरे॥

विषय विकार मिटाओ, पाप हरो देवा, स्वामी पाप हरो देवा।
श्रद्धा भक्ति बढ़ाओ, श्रद्धा भक्ति बढ़ाओ, सन्तन की सेवा॥
ॐ जय जगदीश हरे॥` },
  { slug: "sukhkarta-dukhharta-ganesh-aarti", title: "Sukhkarta Dukhharta — Ganesh Aarti", type: "aarti", deity: "Ganesha", language: "marathi", tags: ["ganesh chaturthi", "wednesday", "daily"],
    summary: "The beloved Marathi aarti to Lord Ganesha, composed by Samarth Ramdas, sung at every Ganesh puja.",
    meaning: "Ganesha is praised as the giver of joy and remover of sorrow, adorned with vermilion and a garland of pearls. The aarti asks him to protect the devotee in times of trouble.",
    related: ["vakratunda-mahakaya"],
    lyrics: `सुखकर्ता दुखहर्ता वार्ता विघ्नाची।
नुरवी पुरवी प्रेम कृपा जयाची।
सर्वांगी सुंदर उटी शेंदुराची।
कंठी झळके माळ मुक्ताफळांची॥

जय देव जय देव जय मंगलमूर्ती।
दर्शनमात्रे मन कामना पुरती॥
जय देव जय देव॥

रत्नखचित फरा तुज गौरीकुमरा।
चंदनाची उटी कुमकुम केशरा।
हीरे जडित मुकुट शोभतो बरा।
रुणझुणती नूपुरे चरणी घागरिया॥
जय देव जय देव॥

लंबोदर पीतांबर फणिवर वंदना।
सरळ सोंड वक्रतुंड त्रिनयना।
दास रामाचा वाट पाहे सदना।
संकटी पावावे निर्वाणी रक्षावे सुरवरवंदना॥
जय देव जय देव॥` },
  { slug: "om-jai-shiv-omkara", title: "Om Jai Shiv Omkara", type: "aarti", deity: "Shiva", language: "hindi", tags: ["monday", "maha shivratri", "daily"],
    summary: "The traditional aarti of Lord Shiva, sung on Mondays, during Shravan and on Maha Shivratri.",
    meaning: "The aarti describes Shiva in his many forms, seated with Brahma and Vishnu in the sacred syllable Om, dwelling in Kashi as Vishwanath, and promises the fulfilment of wishes to those who sing it.",
    related: ["om-namah-shivaya", "shiva-panchakshara-stotram", "mahamrityunjaya-mantra"],
    lyrics: `ॐ जय शिव ओंकारा, स्वामी जय शिव ओंकारा।
ब्रह्मा विष्णु सदाशिव, अर्द्धांगी धारा॥
ॐ हर हर हर महादेव॥

एकानन चतुरानन पंचानन राजे।
हंसासन गरुड़ासन वृषवाहन साजे॥
ॐ हर हर हर महादेव॥

दो भुज चार चतुर्भुज दसभुज अति सोहे।
तीनों रूप निरखता त्रिभुवन जन मोहे॥
ॐ हर हर हर महादेव॥

अक्षमाला वनमाला मुण्डमाला धारी।
त्रिपुरारी कंसारी कर माला धारी॥
ॐ हर हर हर महादेव॥

श्वेताम्बर पीताम्बर बाघम्बर अंगे।
सनकादिक गरुणादिक भूतादिक संगे॥
ॐ हर हर हर महादेव॥

कर के मध्य कमण्डलु चक्र त्रिशूलधारी।
सुखकारी दुखहारी जगपालन कारी॥
ॐ हर हर हर महादेव॥

ब्रह्मा विष्णु सदाशिव जानत अविवेका।
प्रणवाक्षर के मध्ये ये तीनों एका॥
ॐ हर हर हर महादेव॥

काशी में विश्वनाथ विराजत नन्दी ब्रह्मचारी।
नित उठ भोग लगावत महिमा अति भारी॥
ॐ हर हर हर महादेव॥

त्रिगुण शिवजी की आरती जो कोई नर गावे।
कहत शिवानन्द स्वामी मनवांछित फल पावे॥
ॐ हर हर हर महादेव॥` },
  { slug: "om-jai-lakshmi-mata", title: "Om Jai Lakshmi Mata", type: "aarti", deity: "Lakshmi", language: "hindi", tags: ["diwali", "friday", "prosperity"],
    summary: "The aarti of Goddess Lakshmi, sung on Diwali, Dhanteras and on Fridays.",
    meaning: "The aarti honours Lakshmi as the mother of the world who gives wealth and well-being, and says that no home is without virtue and abundance where she resides.",
    related: ["lakshmi-beej-mantra", "om-jai-jagdish-hare"],
    lyrics: `ॐ जय लक्ष्मी माता, मैया जय लक्ष्मी माता।
तुमको निसदिन सेवत, हर विष्णु विधाता॥
ॐ जय लक्ष्मी माता॥

उमा रमा ब्रह्माणी, तुम ही जग माता, मैया तुम ही जग माता।
सूर्य चन्द्रमा ध्यावत, नारद ऋषि गाता॥
ॐ जय लक्ष्मी माता॥

दुर्गा रूप निरंजनि, सुख सम्पत्ति दाता, मैया सुख सम्पत्ति दाता।
जो कोई तुमको ध्यावत, ऋद्धि सिद्धि धन पाता॥
ॐ जय लक्ष्मी माता॥

तुम पाताल निवासिनि, तुम ही शुभदाता, मैया तुम ही शुभदाता।
कर्म प्रभाव प्रकाशिनी, भवनिधि की त्राता॥
ॐ जय लक्ष्मी माता॥

जिस घर में तुम रहती, तहँ सब सद्गुण आता, मैया तहँ सब सद्गुण आता।
सब सम्भव हो जाता, मन नहिं घबराता॥
ॐ जय लक्ष्मी माता॥

तुम बिन यज्ञ न होते, वस्त्र न कोई पाता, मैया वस्त्र न कोई पाता।
खान पान का वैभव, सब तुमसे आता॥
ॐ जय लक्ष्मी माता॥

शुभ गुण मन्दिर सुन्दर, क्षीरोदधि जाता, मैया क्षीरोदधि जाता।
रत्न चतुर्दश तुम बिन, कोई नहीं पाता॥
ॐ जय लक्ष्मी माता॥

महालक्ष्मी जी की आरती, जो कोई नर गाता, मैया जो कोई जन गाता।
उर आनन्द समाता, पाप उतर जाता॥
ॐ जय लक्ष्मी माता॥` },
  { slug: "aarti-kije-hanuman-lala-ki", title: "Aarti Kije Hanuman Lala Ki", type: "aarti", deity: "Hanuman", language: "hindi", tags: ["tuesday", "saturday", "hanuman jayanti"],
    summary: "The aarti of Lord Hanuman, sung on Tuesdays and Saturdays and on Hanuman Jayanti.",
    meaning: "The aarti recalls Hanuman's deeds: burning Lanka, bringing the Sanjeevani herb for Lakshmana and serving Rama, and says that whoever sings it attains the highest abode.",
    related: ["hanuman-chalisa"],
    lyrics: `आरती कीजै हनुमान लला की। दुष्ट दलन रघुनाथ कला की॥

जाके बल से गिरिवर काँपे। रोग दोष जाके निकट न झाँके॥
अंजनि पुत्र महा बलदायी। संतन के प्रभु सदा सहायी॥
दे बीरा रघुनाथ पठाए। लंका जारि सिया सुधि लाए॥
लंका सो कोट समुद्र सी खाई। जात पवनसुत बार न लाई॥
लंका जारि असुर संहारे। सियारामजी के काज सँवारे॥
लक्ष्मण मूर्छित पड़े सकारे। आनि संजीवन प्राण उबारे॥
पैठि पाताल तोरि यम-कारे। अहिरावण की भुजा उखारे॥
बायें भुजा असुरदल मारे। दाहिने भुजा संतजन तारे॥
सुर नर मुनि जन आरती उतारें। जय जय जय हनुमान उचारें॥
कंचन थार कपूर लौ छाई। आरती करत अंजना माई॥
जो हनुमानजी की आरती गावै। बसि बैकुण्ठ परमपद पावै॥
आरती कीजै हनुमान लला की। दुष्ट दलन रघुनाथ कला की॥` },
  { slug: "aarti-kunj-bihari-ki", title: "Aarti Kunj Bihari Ki", type: "aarti", deity: "Krishna", language: "hindi", tags: ["janmashtami", "krishna", "daily"],
    summary: "The aarti of Shri Krishna, sung on Janmashtami and in Krishna temples every day.",
    meaning: "The aarti describes Krishna's beauty: the Baijanti garland, the flute, the earrings and the peacock-feather crown, and the sacred Ganga that flows from his feet.",
    related: ["hare-krishna-maha-mantra"],
    lyrics: `आरती कुंजबिहारी की, श्री गिरिधर कृष्ण मुरारी की॥

गले में बैजंती माला, बजावै मुरली मधुर बाला।
श्रवण में कुण्डल झलकाला, नंद के आनंद नंदलाला।
गगन सम अंग कांति काली, राधिका चमक रही आली।
लतन में ठाढ़े बनमाली, भ्रमर सी अलक, कस्तूरी तिलक, चंद्र सी झलक,
ललित छवि श्यामा प्यारी की॥
आरती कुंजबिहारी की, श्री गिरिधर कृष्ण मुरारी की॥

कनकमय मोर मुकुट बिलसै, देवता दरसन को तरसैं।
गगन सों सुमन रासि बरसै, बजे मुरचंग, मधुर मिरदंग, ग्वालिन संग,
अतुल रति गोप कुमारी की॥
आरती कुंजबिहारी की, श्री गिरिधर कृष्ण मुरारी की॥

जहां ते प्रकट भई गंगा, कलुष कलि हारिणि श्रीगंगा।
स्मरन ते होत मोह भंगा, बसी शिव सीस, जटा के बीच, हरै अघ कीच,
चरन छवि श्रीबनवारी की॥
आरती कुंजबिहारी की, श्री गिरिधर कृष्ण मुरारी की॥

चमकती उज्ज्वल तट रेनू, बज रही वृंदावन बेनू।
चहुं दिशि गोपी ग्वाल धेनू, हंसत मृदु मंद, चांदनी चंद, कटत भव फंद,
टेर सुन दीन दुखारी की॥
आरती कुंजबिहारी की, श्री गिरिधर कृष्ण मुरारी की॥` },
  { slug: "jai-ambe-gauri-aarti", title: "Jai Ambe Gauri", type: "aarti", deity: "Durga", language: "hindi", tags: ["navratri", "durga", "friday"],
    summary: "The aarti of Goddess Durga (Ambe), sung throughout Navratri.",
    meaning: "The aarti praises the Goddess as Gauri and Shyama, slayer of Shumbha, Nishumbha and Mahishasura, remover of her devotees' sorrows and giver of happiness.",
    related: ["om-jai-lakshmi-mata"],
    lyrics: `जय अम्बे गौरी, मैया जय श्यामा गौरी।
तुमको निशदिन ध्यावत, हरि ब्रह्मा शिवरी॥
ॐ जय अम्बे गौरी॥

मांग सिंदूर विराजत, टीको मृगमद को।
उज्ज्वल से दोउ नैना, चन्द्रवदन नीको॥
ॐ जय अम्बे गौरी॥

कनक समान कलेवर, रक्ताम्बर राजै।
रक्तपुष्प गल माला, कण्ठन पर साजै॥
ॐ जय अम्बे गौरी॥

केहरि वाहन राजत, खड्ग खप्पर धारी।
सुर-नर-मुनिजन सेवत, तिनके दुखहारी॥
ॐ जय अम्बे गौरी॥

कानन कुण्डल शोभित, नासाग्रे मोती।
कोटिक चन्द्र दिवाकर, सम राजत ज्योती॥
ॐ जय अम्बे गौरी॥

शुम्भ निशुम्भ बिदारे, महिषासुर घाती।
धूम्र विलोचन नैना, निशदिन मदमाती॥
ॐ जय अम्बे गौरी॥

चण्ड मुण्ड संहारे, शोणित बीज हरे।
मधु कैटभ दोउ मारे, सुर भयहीन करे॥
ॐ जय अम्बे गौरी॥

ब्रह्माणी रुद्राणी तुम कमला रानी।
आगम निगम बखानी, तुम शिव पटरानी॥
ॐ जय अम्बे गौरी॥

चौंसठ योगिनी गावत, नृत्य करत भैरू।
बाजत ताल मृदंगा, अरु बाजत डमरू॥
ॐ जय अम्बे गौरी॥

तुम ही जग की माता, तुम ही हो भरता।
भक्तन की दुख हरता, सुख सम्पत्ति करता॥
ॐ जय अम्बे गौरी॥

भुजा चार अति शोभित, वर मुद्रा धारी।
मनवांछित फल पावत, सेवत नर नारी॥
ॐ जय अम्बे गौरी॥

कन्चन थाल विराजत, अगर कपूर बाती।
श्रीमालकेतु में राजत, कोटि रतन ज्योति॥
ॐ जय अम्बे गौरी॥

श्री अम्बे जी की आरती, जो कोई नर गावै।
कहत शिवानन्द स्वामी, सुख सम्पत्ति पावै॥
ॐ जय अम्बे गौरी॥` },
  { slug: "hanuman-chalisa", title: "Hanuman Chalisa", type: "chalisa", deity: "Hanuman", language: "hindi", tags: ["tuesday", "saturday", "tulsidas"],
    summary: "The forty-verse hymn to Hanuman composed by Goswami Tulsidas, recited for strength and protection.",
    meaning: "Forty verses in praise of Hanuman: his strength, wisdom and devotion to Rama, his feats such as crossing the ocean and burning Lanka, and the benefits of devotion. It opens and closes with a doha.",
    related: ["aarti-kije-hanuman-lala-ki"],
    lyrics: `॥ दोहा ॥
श्रीगुरु चरन सरोज रज, निज मनु मुकुरु सुधारि।
बरनउँ रघुबर बिमल जसु, जो दायकु फल चारि॥
बुद्धिहीन तनु जानिके, सुमिरौं पवन-कुमार।
बल बुद्धि बिद्या देहु मोहिं, हरहु कलेस बिकार॥

॥ चौपाई ॥
जय हनुमान ज्ञान गुन सागर। जय कपीस तिहुँ लोक उजागर॥
राम दूत अतुलित बल धामा। अंजनि-पुत्र पवनसुत नामा॥
महाबीर बिक्रम बजरंगी। कुमति निवार सुमति के संगी॥
कंचन बरन बिराज सुबेसा। कानन कुंडल कुंचित केसा॥
हाथ बज्र औ ध्वजा बिराजै। काँधे मूँज जनेऊ साजै॥
संकर सुवन केसरीनंदन। तेज प्रताप महा जग बंदन॥
बिद्यावान गुनी अति चातुर। राम काज करिबे को आतुर॥
प्रभु चरित्र सुनिबे को रसिया। राम लखन सीता मन बसिया॥
सूक्ष्म रूप धरि सियहिं दिखावा। बिकट रूप धरि लंक जरावा॥
भीम रूप धरि असुर सँहारे। रामचन्द्र के काज सँवारे॥
लाय सजीवन लखन जियाये। श्रीरघुबीर हरषि उर लाये॥
रघुपति कीन्ही बहुत बड़ाई। तुम मम प्रिय भरतहि सम भाई॥
सहस बदन तुम्हरो जस गावैं। अस कहि श्रीपति कंठ लगावैं॥
सनकादिक ब्रह्मादि मुनीसा। नारद सारद सहित अहीसा॥
जम कुबेर दिगपाल जहाँ ते। कबि कोबिद कहि सके कहाँ ते॥
तुम उपकार सुग्रीवहिं कीन्हा। राम मिलाय राज पद दीन्हा॥
तुम्हरो मंत्र बिभीषन माना। लंकेस्वर भए सब जग जाना॥
जुग सहस्र जोजन पर भानू। लील्यो ताहि मधुर फल जानू॥
प्रभु मुद्रिका मेलि मुख माहीं। जलधि लाँघि गये अचरज नाहीं॥
दुर्गम काज जगत के जेते। सुगम अनुग्रह तुम्हरे तेते॥
राम दुआरे तुम रखवारे। होत न आज्ञा बिनु पैसारे॥
सब सुख लहै तुम्हारी सरना। तुम रक्षक काहू को डर ना॥
आपन तेज सम्हारो आपै। तीनों लोक हाँक तें काँपै॥
भूत पिसाच निकट नहिं आवै। महाबीर जब नाम सुनावै॥
नासै रोग हरै सब पीरा। जपत निरंतर हनुमत बीरा॥
संकट तें हनुमान छुड़ावै। मन क्रम बचन ध्यान जो लावै॥
सब पर राम तपस्वी राजा। तिन के काज सकल तुम साजा॥
और मनोरथ जो कोई लावै। सोई अमित जीवन फल पावै॥
चारों जुग परताप तुम्हारा। है परसिद्ध जगत उजियारा॥
साधु-संत के तुम रखवारे। असुर निकंदन राम दुलारे॥
अष्ट सिद्धि नौ निधि के दाता। अस बर दीन जानकी माता॥
राम रसायन तुम्हरे पासा। सदा रहो रघुपति के दासा॥
तुम्हरे भजन राम को पावै। जनम-जनम के दुख बिसरावै॥
अंत काल रघुबर पुर जाई। जहाँ जन्म हरि-भक्त कहाई॥
और देवता चित्त न धरई। हनुमत सेइ सर्ब सुख करई॥
संकट कटै मिटै सब पीरा। जो सुमिरै हनुमत बलबीरा॥
जै जै जै हनुमान गोसाईं। कृपा करहु गुरुदेव की नाईं॥
जो सत बार पाठ कर कोई। छूटहि बंदि महा सुख होई॥
जो यह पढ़ै हनुमान चलीसा। होय सिद्धि साखी गौरीसा॥
तुलसीदास सदा हरि चेरा। कीजै नाथ हृदय महँ डेरा॥

॥ दोहा ॥
पवन तनय संकट हरन, मंगल मूरति रूप।
राम लखन सीता सहित, हृदय बसहु सुर भूप॥` },
  { slug: "gayatri-mantra", title: "Gayatri Mantra", type: "mantra", deity: "Savitr", language: "sanskrit", tags: ["morning", "sandhya", "vedic"],
    summary: "The Vedic Gayatri Mantra, chanted at sunrise, noon and sunset.",
    meaning: "We meditate on the radiant glory of the divine Savitr (the sun as the source of life); may that divine light inspire and guide our understanding.",
    transliteration: "Om bhur bhuvah svah, tat savitur varenyam, bhargo devasya dhimahi, dhiyo yo nah prachodayat.",
    lyrics: `ॐ भूर्भुवः स्वः।
तत्सवितुर्वरेण्यं।
भर्गो देवस्य धीमहि।
धियो यो नः प्रचोदयात्॥` },
  { slug: "mahamrityunjaya-mantra", title: "Mahamrityunjaya Mantra", type: "mantra", deity: "Shiva", language: "sanskrit", tags: ["shiva", "health", "rigveda"],
    summary: "The great mantra to Shiva from the Rigveda, chanted for health, protection and peace.",
    meaning: "We worship the three-eyed Lord, who is fragrant and nourishes all beings. As a ripe cucumber is freed from its stalk, may he free us from the bondage of death and grant us immortality.",
    transliteration: "Om tryambakam yajamahe sugandhim pushti-vardhanam, urvarukam iva bandhanan mrityor mukshiya mamritat.",
    related: ["om-namah-shivaya"],
    lyrics: `ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्।
उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात्॥` },
  { slug: "om-namah-shivaya", title: "Om Namah Shivaya", type: "mantra", deity: "Shiva", language: "sanskrit", tags: ["shiva", "japa", "panchakshari"],
    summary: "The five-syllable (panchakshari) mantra of Shiva, the most common mantra for japa.",
    meaning: "Salutations to Shiva, the auspicious one. Its five syllables, na-ma-shi-va-ya, are said to represent the five elements.",
    transliteration: "Om namah shivaya.",
    related: ["shiva-panchakshara-stotram"],
    lyrics: `ॐ नमः शिवाय॥` },
  { slug: "hare-krishna-maha-mantra", title: "Hare Krishna Maha Mantra", type: "mantra", deity: "Krishna", language: "sanskrit", tags: ["krishna", "kirtan", "japa"],
    summary: "The sixteen-word maha mantra chanted in kirtan and japa.",
    meaning: "A call on the names of Krishna and Rama, and on Hare, the divine energy, asking for devotion and service.",
    transliteration: "Hare Krishna Hare Krishna, Krishna Krishna Hare Hare; Hare Rama Hare Rama, Rama Rama Hare Hare.",
    lyrics: `हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे।
हरे राम हरे राम राम राम हरे हरे॥` },
  { slug: "vakratunda-mahakaya", title: "Vakratunda Mahakaya", type: "mantra", deity: "Ganesha", language: "sanskrit", tags: ["ganesha", "beginnings", "wednesday"],
    summary: "A short Ganesha shloka recited before starting any new work.",
    meaning: "O Lord with the curved trunk and mighty body, whose radiance equals a million suns: please remove all obstacles from my undertakings, always.",
    transliteration: "Vakratunda mahakaya suryakoti-samaprabha, nirvighnam kuru me deva sarva-karyeshu sarvada.",
    related: ["sukhkarta-dukhharta-ganesh-aarti"],
    lyrics: `वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।
निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥` },
  { slug: "sahana-vavatu-shanti-mantra", title: "Om Saha Navavatu — Shanti Mantra", type: "mantra", deity: "", language: "sanskrit", tags: ["peace", "study", "upanishad"],
    summary: "The peace invocation from the Taittiriya Upanishad, recited before study and at the close of puja.",
    meaning: "May we be protected together, may we be nourished together, may we work together with great energy, may our study be luminous, and may there be no dislike among us. Om, peace, peace, peace.",
    transliteration: "Om saha navavatu, saha nau bhunaktu, saha viryam karavavahai, tejasvi navadhitam astu ma vidvishavahai. Om shantih shantih shantih.",
    lyrics: `ॐ सह नाववतु।
सह नौ भुनक्तु।
सह वीर्यं करवावहै।
तेजस्वि नावधीतमस्तु मा विद्विषावहै॥
ॐ शान्तिः शान्तिः शान्तिः॥` },
  { slug: "lakshmi-beej-mantra", title: "Lakshmi Beej Mantra", type: "mantra", deity: "Lakshmi", language: "sanskrit", tags: ["lakshmi", "diwali", "friday"],
    summary: "A seed (beej) mantra of Goddess Lakshmi, chanted on Fridays and during Diwali puja.",
    meaning: "Seed syllables invoking Mahalakshmi, the goddess of fortune and well-being. Shreem is her seed sound; the mantra is a salutation to her.",
    transliteration: "Om shreem hreem shreem kamale kamalalaye prasida prasida, om shreem hreem shreem mahalakshmyai namah.",
    related: ["om-jai-lakshmi-mata"],
    lyrics: `ॐ श्रीं ह्रीं श्रीं कमले कमलालये प्रसीद प्रसीद।
ॐ श्रीं ह्रीं श्रीं महालक्ष्म्यै नमः॥` },
  { slug: "guru-brahma-guru-vishnu", title: "Gurur Brahma Gurur Vishnu", type: "mantra", deity: "", language: "sanskrit", tags: ["guru", "guru purnima", "gratitude"],
    summary: "The well-known guru shloka, recited on Guru Purnima and before lessons.",
    meaning: "The guru is Brahma, the guru is Vishnu, the guru is Maheshwara (Shiva). The guru is the Supreme Reality itself; to that revered guru, salutations.",
    transliteration: "Gurur brahma gurur vishnuh gurur devo maheshvarah, guruh sakshat param brahma tasmai shri-gurave namah.",
    lyrics: `गुरुर्ब्रह्मा गुरुर्विष्णुः गुरुर्देवो महेश्वरः।
गुरुः साक्षात् परब्रह्म तस्मै श्रीगुरवे नमः॥` },
  { slug: "shanta-karam-vishnu-dhyana", title: "Shantakaram Bhujagashayanam", type: "mantra", deity: "Vishnu", language: "sanskrit", tags: ["vishnu", "dhyana", "morning"],
    summary: "A meditation verse on Lord Vishnu, often recited before beginning puja.",
    meaning: "I bow to Vishnu, who is peaceful in form, reclines on the serpent Shesha, has a lotus in his navel, is the lord of the gods, support of the universe, vast as the sky, dark as a cloud, of auspicious limbs, husband of Lakshmi, lotus-eyed, reachable by yogis in meditation, destroyer of the fear of worldly existence and sole lord of all worlds.",
    related: ["om-jai-jagdish-hare"],
    lyrics: `शान्ताकारं भुजगशयनं पद्मनाभं सुरेशं।
विश्वाधारं गगनसदृशं मेघवर्णं शुभाङ्गम्।
लक्ष्मीकान्तं कमलनयनं योगिभिर्ध्यानगम्यं।
वन्दे विष्णुं भवभयहरं सर्वलोकैकनाथम्॥` },
  { slug: "saraswati-vandana", title: "Ya Kundendu — Saraswati Vandana", type: "stotra", deity: "Saraswati", language: "sanskrit", tags: ["saraswati", "basant panchami", "study"],
    summary: "The Saraswati Vandana recited by students on Basant Panchami and before study.",
    meaning: "May Goddess Saraswati, white as jasmine, the moon and snow, robed in white, seated on a white lotus with the veena in her hands, worshipped by Brahma, Vishnu and Shiva, protect me and remove all dullness.",
    lyrics: `या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रावृता।
या वीणावरदण्डमण्डितकरा या श्वेतपद्मासना।
या ब्रह्माच्युतशंकरप्रभृतिभिर्देवैः सदा वन्दिता।
सा मां पातु सरस्वती भगवती निःशेषजाड्यापहा॥` },
  { slug: "shiva-panchakshara-stotram", title: "Shiva Panchakshara Stotram", type: "stotra", deity: "Shiva", language: "sanskrit", tags: ["shiva", "monday", "adi shankaracharya"],
    summary: "Five verses attributed to Adi Shankaracharya, each dedicated to one syllable of Om Namah Shivaya.",
    meaning: "Each of the five verses salutes Shiva through one syllable of the mantra: Na, Ma, Shi, Va and Ya, praising him as the lord adorned with a serpent garland, the one worshipped with Mandakini water and flowers, the destroyer of Daksha's sacrifice, the eternal one with matted locks.",
    related: ["om-namah-shivaya", "om-jai-shiv-omkara"],
    lyrics: `नागेन्द्रहाराय त्रिलोचनाय भस्माङ्गरागाय महेश्वराय।
नित्याय शुद्धाय दिगम्बराय तस्मै नकाराय नमः शिवाय॥

मन्दाकिनीसलिलचन्दनचर्चिताय नन्दीश्वरप्रमथनाथमहेश्वराय।
मन्दारपुष्पबहुपुष्पसुपूजिताय तस्मै मकाराय नमः शिवाय॥

शिवाय गौरीवदनाब्जबृन्दसूर्याय दक्षाध्वरनाशकाय।
श्रीनीलकण्ठाय वृषध्वजाय तस्मै शिकाराय नमः शिवाय॥

वसिष्ठकुम्भोद्भवगौतमार्यमुनीन्द्रदेवार्चितशेखराय।
चन्द्रार्कवैश्वानरलोचनाय तस्मै वकाराय नमः शिवाय॥

यज्ञस्वरूपाय जटाधराय पिनाकहस्ताय सनातनाय।
दिव्याय देवाय दिगम्बराय तस्मै यकाराय नमः शिवाय॥` },
];
