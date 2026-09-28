/**
 * 20 starter prompts (ads, UGC, product shots, cinematic, fashion), each in
 * English and Arabic. English usually gives the models the best results;
 * the Arabic versions are ready to use as-is or via "Enhance prompt".
 */
export type StarterCategory = "ads" | "ugc" | "product" | "cinematic" | "fashion"

export type StarterPrompt = {
  id: string
  category: StarterCategory
  surface: "image" | "video"
  title: { en: string; ar: string }
  body: { en: string; ar: string }
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  // ─── Ads ────────────────────────────────────────────────────
  {
    id: "ads-watch-hero",
    category: "ads",
    surface: "video",
    title: { en: "Luxury watch hero shot", ar: "لقطة هيرو لساعة فخمة" },
    body: {
      en: "Slow dolly-in on a luxury chronograph resting on black marble, a thin rim light tracing the steel case, reflections sweeping across the sapphire crystal, macro 100mm lens, shallow depth of field, moody premium commercial.",
      ar: "دولي بطيء على ساعة كرونوغراف فخمة على رخام أسود، إضاءة رفيعة من الجنب بتحدد الهيكل الستيل، انعكاسات بتعدي على الزجاج، عدسة ماكرو 100mm، عمق ميدان ضحل، إعلان فخم بإحساس هادي.",
    },
  },
  {
    id: "ads-perfume-splash",
    category: "ads",
    surface: "video",
    title: { en: "Perfume splash", ar: "برفان وسط رذاذ مية" },
    body: {
      en: "A crystal perfume bottle suspended mid-air as a slow-motion wave of water crashes around it, golden backlight, droplets frozen in the air, black background, high-end fragrance commercial, 120fps look.",
      ar: "زجاجة برفان كريستال معلّقة في الهوا وموجة مية بالتصوير البطيء بتتكسر حواليها، إضاءة ذهبية من ورا، نقط مية متجمدة في الهوا، خلفية سودا، إعلان عطور راقي.",
    },
  },
  {
    id: "ads-food-burger",
    category: "ads",
    surface: "video",
    title: { en: "Burger ingredient drop", ar: "مكونات البرجر بتنزل" },
    body: {
      en: "Ingredients of a gourmet burger drop one by one in slow motion and stack perfectly: toasted brioche bun, seared patty with melting cheddar, crisp lettuce, tomato; warm studio light, dark background, appetizing food commercial.",
      ar: "مكونات برجر فاخر بتنزل واحدة ورا التانية بالتصوير البطيء وبتترص بالظبط: عيش بريوش محمص، لحمة مشوية والشيدر بيسيح، خس، طماطم؛ إضاءة استوديو دافية، خلفية غامقة، إعلان أكل يفتح النفس.",
    },
  },
  {
    id: "ads-car-night",
    category: "ads",
    surface: "video",
    title: { en: "Sports car at night", ar: "عربية سبور بالليل" },
    body: {
      en: "Low tracking shot of a matte black sports car gliding through a rain-soaked city street at night, neon reflections rippling on the wet asphalt and the car's body, anamorphic lens flares, cinematic automotive commercial.",
      ar: "لقطة تتبع واطية لعربية سبور سودا مطفية ماشية في شارع مبلول بالمطر بالليل، انعكاسات نيون على الأسفلت وعلى جسم العربية، فلير عدسة أنامورفيك، إعلان عربيات سينمائي.",
    },
  },

  // ─── UGC ────────────────────────────────────────────────────
  {
    id: "ugc-unboxing",
    category: "ugc",
    surface: "video",
    title: { en: "Selfie unboxing", ar: "أنبوكسنج سيلفي" },
    body: {
      en: "Handheld vertical selfie video of a young woman in her bright bedroom excitedly unboxing a skincare set, natural window light, authentic smartphone look, slight camera shake, genuine smile, UGC style.",
      ar: "فيديو سيلفي بالموبايل لبنت في أوضتها المنورة بتفتح بوكس سكين كير وهي فرحانة، إضاءة طبيعية من الشباك، شكل موبايل حقيقي، هزة كاميرا خفيفة، ابتسامة طبيعية، ستايل UGC.",
    },
  },
  {
    id: "ugc-coffee-review",
    category: "ugc",
    surface: "video",
    title: { en: "Café review to camera", ar: "ريفيو كافيه للكاميرا" },
    body: {
      en: "A young man sitting in a cozy café talks to his phone camera, lifts an iced latte and takes a sip, nods with approval, warm afternoon light, vertical 9:16, casual creator vlog aesthetic.",
      ar: "شاب قاعد في كافيه دافي بيتكلم لكاميرا الموبايل، بيرفع آيس لاتيه ويشرب، ويهز راسه إنه عاجبه، إضاءة عصاري دافية، طولي 9:16، ستايل فلوج كريتور عادي.",
    },
  },
  {
    id: "ugc-gym-routine",
    category: "ugc",
    surface: "video",
    title: { en: "Gym routine clip", ar: "كليب روتين جيم" },
    body: {
      en: "Vertical phone footage of a fitness creator finishing a set of kettlebell swings in a sunlit gym, then turning to the camera and giving a thumbs up, energetic, authentic, slight motion blur.",
      ar: "فيديو طولي بالموبايل لكريتور فيتنس بيخلص مجموعة كيتل بيل في جيم فيه شمس، وبعدين يبص للكاميرا ويعمل لايك، طاقة عالية، طبيعي، موشن بلر خفيف.",
    },
  },
  {
    id: "ugc-home-tour",
    category: "ugc",
    surface: "image",
    title: { en: "Cozy home shelfie", ar: "رف بيت دافي" },
    body: {
      en: "Smartphone photo of a cozy living-room shelf styled with plants, candles and a new ceramic vase, warm evening lamp light, slightly imperfect framing, authentic lifestyle post.",
      ar: "صورة موبايل لرف في ليفينج روم متزين بزرع وشموع وفازة سيراميك جديدة، نور أباجورة دافي بالليل، كادر مش مثالي أوي، بوست لايف ستايل طبيعي.",
    },
  },

  // ─── Product shots ──────────────────────────────────────────
  {
    id: "product-skincare-water",
    category: "product",
    surface: "image",
    title: { en: "Skincare on water", ar: "سكين كير على مية" },
    body: {
      en: "Minimal product photo of a frosted glass serum bottle standing on a still water surface with soft ripples, pastel blue background, diffused top light, crisp reflections, premium beauty packshot.",
      ar: "صورة منتج بسيطة لزجاجة سيروم زجاج مطفي واقفة على سطح مية هادي فيه تموجات خفيفة، خلفية لبني باستيل، إضاءة ناعمة من فوق، انعكاسات واضحة، باك شوت تجميل فخم.",
    },
  },
  {
    id: "product-sneaker-float",
    category: "product",
    surface: "image",
    title: { en: "Floating sneaker", ar: "كوتشي طاير" },
    body: {
      en: "A white running sneaker floating at a dynamic angle against a bold orange gradient backdrop, dramatic studio lighting with hard shadows, dust particles, hyper-detailed textures, e-commerce hero image.",
      ar: "كوتشي جري أبيض طاير بزاوية ديناميكية قدام خلفية جرادينت برتقالي قوي، إضاءة استوديو درامية بظلال حادة، ذرات تراب، تفاصيل خامات دقيقة جداً، صورة هيرو لمتجر أونلاين.",
    },
  },
  {
    id: "product-coffee-flatlay",
    category: "product",
    surface: "image",
    title: { en: "Coffee bag flat lay", ar: "فلات لاي كيس قهوة" },
    body: {
      en: "Top-down flat lay of a kraft coffee bag surrounded by roasted beans, a ceramic cup of espresso and a brass scoop on a linen cloth, soft morning light, earthy tones, artisan brand photography.",
      ar: "فلات لاي من فوق لكيس قهوة كرافت حواليه بن محمص وفنجان إسبريسو سيراميك ومعلقة نحاس على قماش كتان، نور صبح ناعم، ألوان ترابية، تصوير براند حِرفي.",
    },
  },
  {
    id: "product-360-spin",
    category: "product",
    surface: "video",
    title: { en: "360° product spin", ar: "لفة 360 للمنتج" },
    body: {
      en: "A wireless headphone slowly rotating 360 degrees on a glossy turntable, seamless white background, soft reflections, even studio lighting, clean e-commerce product video.",
      ar: "سماعة وايرلس بتلف 360 درجة ببطء على قاعدة لامعة، خلفية بيضا من غير فواصل، انعكاسات ناعمة، إضاءة استوديو متساوية، فيديو منتج نضيف للمتجر.",
    },
  },

  // ─── Cinematic ──────────────────────────────────────────────
  {
    id: "cinematic-desert-drone",
    category: "cinematic",
    surface: "video",
    title: { en: "Desert drone reveal", ar: "ريفيل درون في الصحرا" },
    body: {
      en: "Epic drone shot rising over golden sand dunes at sunrise to reveal a lone rider on horseback, long shadows, haze in the air, sweeping cinematic landscape, 24fps film look.",
      ar: "لقطة درون ملحمية بتطلع فوق كثبان رملية دهبي وقت الشروق وتكشف خيّال لوحده على حصان، ظلال طويلة، شبورة في الجو، منظر سينمائي واسع، إحساس فيلم 24fps.",
    },
  },
  {
    id: "cinematic-rainy-window",
    category: "cinematic",
    surface: "video",
    title: { en: "Rainy window portrait", ar: "بورتريه ورا شباك مطر" },
    body: {
      en: "Close-up of a woman looking out of a rain-streaked window at night, city bokeh lights behind the glass, raindrops tracing down, slow push-in, melancholic mood, teal and amber color grade.",
      ar: "كلوز أب لست بتبص من شباك عليه مطر بالليل، أنوار المدينة بوكيه ورا الإزاز، نقط المطر نازلة، زووم بطيء لجوه، إحساس حزين، تلوين تيل وأمبر.",
    },
  },
  {
    id: "cinematic-old-cairo",
    category: "cinematic",
    surface: "image",
    title: { en: "Old Cairo alley at dusk", ar: "حارة في القاهرة القديمة" },
    body: {
      en: "A narrow alley in Old Cairo at dusk, hanging lanterns glowing, an old man selling tea from a brass pot, dust in the golden light beams, rich textures, cinematic still, 35mm film grain.",
      ar: "حارة ضيقة في القاهرة القديمة وقت المغرب، فوانيس متعلقة منورة، راجل كبير بيبيع شاي من براد نحاس، تراب في أشعة النور الدهبي، خامات غنية، لقطة سينمائية، حبيبات فيلم 35mm.",
    },
  },
  {
    id: "cinematic-space-station",
    category: "cinematic",
    surface: "video",
    title: { en: "Orbit sunrise", ar: "شروق من المدار" },
    body: {
      en: "A slow orbit around a futuristic space station as the sun rises over Earth's horizon, lens flare, thin blue atmosphere line, stars fading, epic sci-fi establishing shot.",
      ar: "لفة بطيئة حوالين محطة فضاء مستقبلية والشمس بتطلع ورا حافة الأرض، فلير عدسة، خط الغلاف الجوي الأزرق الرفيع، النجوم بتختفي، لقطة افتتاحية خيال علمي ملحمية.",
    },
  },

  // ─── Fashion ────────────────────────────────────────────────
  {
    id: "fashion-neon-street",
    category: "fashion",
    surface: "image",
    title: { en: "Neon street editorial", ar: "إيديتوريال في شارع نيون" },
    body: {
      en: "Fashion editorial of a model in an oversized silver puffer jacket standing in a neon-lit Tokyo street at night, wet pavement reflections, confident pose, full body, shot on 50mm, vibrant magenta and cyan.",
      ar: "إيديتوريال فاشون لموديل لابس جاكيت بافر فضي أوفر سايز واقف في شارع نيون في طوكيو بالليل، انعكاسات على الرصيف المبلول، وقفة واثقة، فول بودي، عدسة 50mm، ألوان ماجنتا وسيان.",
    },
  },
  {
    id: "fashion-abaya-studio",
    category: "fashion",
    surface: "image",
    title: { en: "Modern abaya studio shot", ar: "عباية مودرن في الاستوديو" },
    body: {
      en: "Elegant studio portrait of a woman wearing a modern flowing black abaya with gold embroidery, soft beige backdrop, graceful movement of the fabric, soft key light, luxury modest-fashion campaign.",
      ar: "بورتريه استوديو أنيق لست لابسة عباية سودا مودرن منسابة بتطريز دهبي، خلفية بيج ناعمة، حركة القماش رقيقة، إضاءة ناعمة، حملة أزياء محتشمة فاخرة.",
    },
  },
  {
    id: "fashion-runway-walk",
    category: "fashion",
    surface: "video",
    title: { en: "Runway walk", ar: "مشية على الرانواي" },
    body: {
      en: "A model walks toward the camera on a minimalist white runway, flowing linen outfit moving with each step, front-row silhouettes blurred, camera slowly tracking backward, high-fashion show footage.",
      ar: "موديل ماشية ناحية الكاميرا على رانواي أبيض بسيط، لبس كتان منساب بيتحرك مع كل خطوة، ضيوف الصف الأول مغبشين، الكاميرا بترجع لورا ببطء، فيديو عرض أزياء راقي.",
    },
  },
  {
    id: "fashion-streetwear-drop",
    category: "fashion",
    surface: "image",
    title: { en: "Streetwear drop poster", ar: "بوستر دروب ستريت وير" },
    body: {
      en: "Streetwear campaign photo of two friends in matching graphic hoodies leaning on a graffiti wall, low angle, flash photography, gritty urban texture, bold typography space at the top, 4:5 poster.",
      ar: "صورة حملة ستريت وير لاتنين صحاب لابسين هودي بطبعات شبه بعض ساندين على حيطة جرافيتي، زاوية واطية، تصوير بالفلاش، خامات شارع خشنة، مساحة فوق للكتابة، بوستر 4:5.",
    },
  },
]
