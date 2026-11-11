/**
 * Curriculum configuration layer (homepage foundation).
 *
 * Everything that belongs to the curriculum licensor lives here and only here:
 * programme names and descriptions shown on the public homepage and the
 * approved footer credit line. Home components read `curriculum` and must keep
 * working when it is set to `null` (they render a FunAdemy-only empty state).
 *
 * Scope note: this covers the public homepage only. It is not a full-site
 * licence firewall; other routes and the database are outside this file.
 */

export type Localised = { en: string; ar: string };

export type Program = {
  id: string;
  name: string;
  category: 'building' | 'coding' | 'robotics' | string;
  categoryKey: 'catEarly' | 'catBuild' | 'catCode' | 'catRobot';
  age: string;
  image: string;
  /** true when the image is a generated casual-clothing illustration rather than a model render */
  photo: boolean;
  short: Localised;
  description: Localised;
  skills: { en: string[]; ar: string[] };
};

export type CurriculumCredit = {
  /** Approved credit line, shown once in the footer. */
  text: Localised;
  logo?: { src: string; alt: string; width: number; height: number };
};

export type CurriculumConfig = {
  programs: Program[];
  /** Alt text for model-render images (non-illustration programme images). */
  modelImageAlt: Localised;
  /** Alt text for generated casual-clothing illustrations reused on cards. */
  illustrationAlt: Localised;
  credit: CurriculumCredit | null;
};

const programs: Program[] = [
 {
  "id": "big-builders",
  "name": "Big Builders",
  "category": "building",
  "categoryKey": "catEarly",
  "age": "4–6",
  "image": "/v3/casual-hero.webp",
  "photo": true,
  "short": {
   "en": "First discoveries, built one brick at a time.",
   "ar": "أولى الاكتشافات، قطعة بناء بعد أخرى."
  },
  "description": {
   "en": "Stories and simple building challenges introduce the world of science. Young learners explore shapes, movement and everyday objects while developing coordination and spatial thinking.",
   "ar": "تفتح القصص وتحديات البناء البسيطة باب العلوم. يستكشف الصغار الأشكال والحركة والأشياء من حولهم، وينمّون التآزر الحركي والتفكير المكاني."
  },
  "skills": {
   "en": [
    "Exploring early science",
    "Building simple models",
    "Developing spatial thinking"
   ],
   "ar": [
    "استكشاف العلوم المبكرة",
    "بناء نماذج بسيطة",
    "تنمية التفكير المكاني"
   ]
  }
 },
 {
  "id": "smartivo",
  "name": "Smartivo",
  "category": "coding",
  "categoryKey": "catEarly",
  "age": "4–6",
  "image": "/v3/casual-school.webp",
  "photo": true,
  "short": {
   "en": "Spot a pattern. Plan a sequence. Let clever thinking begin.",
   "ar": "اكتشف نمطًا. رتّب خطواتك. ودع التفكير الذكي يبدأ."
  },
  "description": {
   "en": "Playful pattern puzzles, sequencing challenges and interactive logic games introduce early computational thinking. Children practice making a plan and discovering what happens next.",
   "ar": "تقدّم ألغاز الأنماط وتحديات التسلسل وألعاب المنطق التفاعلية أساسيات التفكير الحاسوبي. يتدرّب الأطفال على وضع خطة واكتشاف ما يحدث بعدها."
  },
  "skills": {
   "en": [
    "Recognizing patterns",
    "Following a sequence",
    "Solving logic puzzles"
   ],
   "ar": [
    "تمييز الأنماط",
    "ترتيب الخطوات",
    "حل ألغاز المنطق"
   ]
  }
 },
 {
  "id": "bricks",
  "name": "Bricks Challenge",
  "category": "building",
  "categoryKey": "catBuild",
  "age": "6–10",
  "image": "/v3/model-engineering.webp",
  "short": {
   "en": "Turn a handful of bricks into an “I built that!” moment.",
   "ar": "ركّب قطعة ورا قطعة، وبكل فخر قول: «أنا سويتها!»"
  },
  "description": {
   "en": "Explore mechanical ideas by building models. Young learners connect hands-on construction with the engineering concepts behind things that move.",
   "ar": "استكشاف الأفكار الميكانيكية ببناء النماذج. يربط الأطفال البناء العملي بالمفاهيم الهندسية التي تفسّر حركة الأشياء."
  },
  "skills": {
   "en": [
    "Building mechanical models",
    "Exploring how mechanisms work",
    "Testing and improving ideas"
   ],
   "ar": [
    "بناء نماذج ميكانيكية",
    "استكشاف عمل الآليات",
    "اختبار الأفكار وتطويرها"
   ]
  },
  "photo": false
 },
 {
  "id": "algoplay",
  "name": "AlgoPlay",
  "category": "coding",
  "categoryKey": "catCode",
  "age": "6–10",
  "image": "/v3/casual-coding.webp",
  "photo": true,
  "short": {
   "en": "Guide a virtual robot. Test a clever plan. Make logic click.",
   "ar": "وجّه روبوتًا افتراضيًا. اختبر خطة ذكية. واكتشف متعة المنطق."
  },
  "description": {
   "en": "Bring coding ideas to life through virtual robot missions. Learners explore loops and conditions, test their instructions and debug solutions one step at a time.",
   "ar": "حوّل أفكار البرمجة إلى مهام لروبوتات افتراضية. يستكشف المتعلمون الحلقات والشروط، ويختبرون تعليماتهم ويصحّحون الأخطاء خطوة بخطوة."
  },
  "skills": {
   "en": [
    "Using loops and conditions",
    "Planning robot instructions",
    "Finding and fixing errors"
   ],
   "ar": [
    "استخدام الحلقات والشروط",
    "تخطيط تعليمات الروبوت",
    "اكتشاف الأخطاء وتصحيحها"
   ]
  }
 },
 {
  "id": "galileo",
  "name": "Galileo Technic",
  "category": "building",
  "categoryKey": "catBuild",
  "age": "7–10",
  "image": "/v3/model-engineering.webp",
  "short": {
   "en": "Bigger mechanisms. Bolder engineering ideas.",
   "ar": "آليات أكثر تطورًا. وأفكار هندسية أجرأ."
  },
  "description": {
   "en": "Take mechanical exploration further with more complex builds. Learners investigate gear systems, transmission and walking mechanisms, connecting each design with the engineering ideas behind it.",
   "ar": "انتقل بالاستكشاف الميكانيكي إلى نماذج أكثر تعقيدًا. يتعرّف المتعلمون على أنظمة التروس ونقل الحركة وآليات المشي، ويربطون كل تصميم بالمفاهيم الهندسية التي تفسّره."
  },
  "skills": {
   "en": [
    "Exploring gear systems",
    "Understanding transmission",
    "Building complex mechanisms"
   ],
   "ar": [
    "استكشاف أنظمة التروس",
    "فهم نقل الحركة",
    "بناء آليات متقدمة"
   ]
  },
  "photo": false
 },
 {
  "id": "robotoys",
  "name": "RoboToys",
  "category": "robotics",
  "categoryKey": "catRobot",
  "age": "9–12",
  "image": "/v3/model-robotics.webp",
  "short": {
   "en": "Meet the moving, making, wonderfully inventive side of robotics.",
   "ar": "اكتشف جانب الروبوتات المليء بالحركة والبناء والأفكار المبتكرة."
  },
  "description": {
   "en": "Bring robotics and mechanisms together in hands-on model-building experiences. Explore how parts interact and turn an idea into something that moves.",
   "ar": "الجمع بين الروبوتات والآليات في تجارب بناء تطبيقية. استكشاف تفاعل الأجزاء وتحويل الفكرة إلى نموذج يتحرك."
  },
  "skills": {
   "en": [
    "Building robotic models",
    "Understanding mechanisms",
    "Experimenting with movement"
   ],
   "ar": [
    "بناء نماذج روبوتية",
    "فهم الآليات",
    "التجريب بالحركة"
   ]
  },
  "photo": false
 },
 {
  "id": "algoc",
  "name": "AlgoC",
  "category": "coding",
  "categoryKey": "catCode",
  "age": "13–18",
  "image": "/v3/model-coding.webp",
  "short": {
   "en": "From a clever idea to real code.",
   "ar": "من فكرة ذكية إلى كود حقيقي."
  },
  "description": {
   "en": "Move from programming blocks to written code. Teens work with variables and functions, break problems into smaller parts and develop coding projects they can explain and share.",
   "ar": "انتقل من المكعبات البرمجية إلى كتابة الكود. يستخدم اليافعون المتغيرات والدوال، ويقسّمون المشكلات إلى أجزاء أصغر، ويطوّرون مشاريع برمجية يمكنهم شرحها ومشاركتها."
  },
  "skills": {
   "en": [
    "Writing code with variables and functions",
    "Breaking down problems",
    "Developing coding projects"
   ],
   "ar": [
    "كتابة الكود باستخدام المتغيرات والدوال",
    "تفكيك المشكلات",
    "تطوير مشاريع برمجية"
   ]
  },
  "photo": false
 }
];

const config: CurriculumConfig = {
  programs,
  modelImageAlt: {
    en: 'Construction model render for this programme',
    ar: 'نموذج بناء توضيحي لهذا البرنامج',
  },
  illustrationAlt: {
    en: 'AI-generated illustration of children in casual clothes building and coding',
    ar: 'رسم توضيحي مولّد بالذكاء الاصطناعي لأطفال بملابس عادية يبنون ويبرمجون',
  },
  credit: {
    text: { en: 'Featuring licensed programs from', ar: 'نقدّم برامج مرخّصة من' },
    logo: { src: '/v3/ye-credit.webp', alt: 'Young Engineers', width: 112, height: 62 },
  },
};

/**
 * Set to `null` to remove all curriculum content from the homepage.
 * The homepage then shows a FunAdemy-only empty state and no credit line.
 */
export const curriculum: CurriculumConfig | null = config;

export const curriculumPrograms = (): Program[] => curriculum?.programs ?? [];
export const curriculumCredit = (): CurriculumCredit | null => curriculum?.credit ?? null;
