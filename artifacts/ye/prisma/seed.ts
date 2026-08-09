import { PrismaClient, Format } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * OFFICIAL PROGRAM CATALOG — FunAdemy Master Spec (Aug 2026)
 * Three fields → seven programs. Ages 4–18 sitewide.
 */
const programs = [
  // ——— العالم من حولنا · The World Around Us ———
  {
    slug: 'big-builders',
    kitCode: 'WORLD-01',
    nameEn: 'Big Builders',
    nameAr: 'البنّاؤون الصغار',
    ageMin: 4,
    ageMax: 6,
    format: Format.online,
    color: '#FFCA17',
    level: 1,
    taglineEn: 'Little ones build the world around them — first science concepts through bricks and stories.',
    taglineAr: 'يبني الصغار العالم من حولهم — أول مفاهيم العلوم بالمكعّبات والقصص',
    descEn:
      'Big Builders introduces children aged 4–6 to the world around them through storytelling and hands-on LEGO® building. Each 45-minute session pairs a story with a themed model — bridges, animals, vehicles — developing fine motor skills, spatial thinking, and early science vocabulary.',
    descAr:
      'يقدّم برنامج البنّاؤون الصغار للأطفال من ٤ إلى ٦ سنوات العالم من حولهم عبر القصص والبناء العملي بمكعبات LEGO®. كل حصة (٤٥ دقيقة) تجمع بين قصة ونموذج بموضوع مختلف — جسور وحيوانات ومركبات — لتنمية المهارات الحركية الدقيقة والتفكير المكاني ومفردات العلوم المبكرة.',
    buildsEn: ['Story bridges & towers', 'Animal models with moving parts', 'Simple vehicles & pulleys'],
    buildsAr: ['جسور وأبراج القصص', 'نماذج حيوانات بأجزاء متحركة', 'مركبات بسيطة وبكرات'],
    termsEn: ['45-minute live sessions', 'Class cap: 12 kids', 'Online'],
    termsAr: ['حصص مباشرة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'أونلاين'],
    position: 1,
  },
  // ——— البرمجة والروبوتات · Coding & Robotics ———
  {
    slug: 'smartivo',
    kitCode: 'CODE-01',
    nameEn: 'Smartivo',
    nameAr: 'سمارتيفو',
    ageMin: 4,
    ageMax: 6,
    format: Format.online,
    color: '#22DAFF',
    level: 2,
    taglineEn: 'All the coding foundations for little ones — hands-on or on screen.',
    taglineAr: 'جميع أساسيات البرمجة للصغار — ملموسة أو على الشاشة',
    descEn:
      'Smartivo builds early computational thinking for ages 4–6 in live 45-minute classes, fully online. Kids solve pattern puzzles, sequence challenges, and interactive logic games with a live teacher and a small group.',
    descAr:
      'يبني سمارتيفو التفكير الحاسوبي المبكر للأعمار ٤–٦ في حصص مباشرة مدتها ٤٥ دقيقة، أونلاين بالكامل. يحلّ الأطفال ألغاز الأنماط وتحديات التسلسل وألعاب المنطق التفاعلية مع معلّم مباشر ومجموعة صغيرة.',
    buildsEn: ['Pattern & sequence puzzles', 'Interactive logic games', 'Early digital literacy'],
    buildsAr: ['ألغاز الأنماط والتسلسل', 'ألعاب منطق تفاعلية', 'ثقافة رقمية مبكرة'],
    termsEn: ['45-minute live sessions', 'Class cap: 12 kids', 'Online'],
    termsAr: ['حصص مباشرة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'أونلاين'],
    position: 2,
  },
  // ——— الهندسة الميكانيكية · Mechanical Engineering ———
  {
    slug: 'bricks-challenge',
    kitCode: 'MECH-01',
    nameEn: 'Bricks Challenge',
    nameAr: 'تحدي المكعبات',
    ageMin: 6,
    ageMax: 10,
    format: Format.online,
    color: '#E5AE4A',
    level: 3,
    taglineEn: 'Classical mechanics fundamentals: gears, levers and models that move with real motors.',
    taglineAr: 'أساسيات الميكانيكا الكلاسيكية: تروس وروافع ونماذج تتحرك بمحركات حقيقية',
    descEn:
      'The flagship e² Young Engineers program. Ages 6–10 build a new motorized LEGO® model every 75-minute session — cranes, carousels, catapults — while learning the physics principle behind it: gear ratios, torque, center of gravity, and more.',
    descAr:
      'البرنامج الرائد لدى e² Young Engineers. يبني الأطفال من ٦ إلى ١٠ سنوات نموذج LEGO® متحركاً جديداً في كل حصة (٧٥ دقيقة) — رافعات ودوّارات ومقاليع — مع تعلّم المبدأ الفيزيائي خلفه: نسب التروس والعزم ومركز الثقل وغيرها.',
    buildsEn: ['Motorized crane & carousel', 'Catapults & racing cars', '40+ models across the year'],
    buildsAr: ['رافعة ودوّارة بمحرك', 'مقاليع وسيارات سباق', 'أكثر من ٤٠ نموذجاً خلال السنة'],
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'Online'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'أونلاين'],
    position: 3,
  },
  {
    slug: 'algoplay',
    kitCode: 'CODE-02',
    nameEn: 'AlgoPlay',
    nameAr: 'ألجوبلاي',
    ageMin: 6,
    ageMax: 10,
    format: Format.online,
    color: '#1C54CB',
    level: 4,
    taglineEn: 'Robotics fundamentals: building and programming on screen.',
    taglineAr: 'أساسيات الروبوتات: تركيب وبرمجة على الشاشة',
    descEn:
      'AlgoPlay takes ages 6–10 from play to programming. In live 75-minute online sessions, kids command virtual robots, chain loops and conditions, and debug their own solutions — the bridge between building and coding.',
    descAr:
      'ينقل ألجوبلاي الأطفال من ٦ إلى ١٠ سنوات من اللعب إلى البرمجة. في حصص أونلاين (٧٥ دقيقة) يوجّه الأطفال روبوتات افتراضية ويربطون الحلقات والشروط ويصحّحون حلولهم بأنفسهم — الجسر بين البناء والبرمجة.',
    buildsEn: ['Virtual robot missions', 'Loop & condition challenges', 'Debugging workshops'],
    buildsAr: ['مهمات روبوت افتراضية', 'تحديات الحلقات والشروط', 'ورش تصحيح الأخطاء'],
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'Online'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'أونلاين'],
    position: 4,
  },
  {
    slug: 'galileo-technic',
    kitCode: 'MECH-02',
    nameEn: 'Galileo Technic',
    nameAr: 'غاليليو تكنيك',
    ageMin: 7,
    ageMax: 10,
    format: Format.online,
    color: '#D3901B',
    level: 5,
    taglineEn: 'Advanced mechanics for builders ready for the bigger challenge.',
    taglineAr: 'الميكانيكا المتقدمة لبنّائين جاهزين للتحدي الأكبر',
    descEn:
      'For graduates of Bricks Challenge and ambitious builders aged 7–10. Galileo Technic tackles complex machines — differential gears, transmissions, walking mechanisms — with deeper engineering theory in every 75-minute session.',
    descAr:
      'لخرّيجي تحدي المكعبات والبنّائين الطموحين من ٧ إلى ١٠ سنوات. يتناول غاليليو تكنيك آلات معقّدة — تروس تفاضلية وناقلات حركة وآليات مشي — مع نظرية هندسية أعمق في كل حصة (٧٥ دقيقة).',
    buildsEn: ['Differential gear systems', 'Walking machines', 'Transmission mechanisms'],
    buildsAr: ['أنظمة تروس تفاضلية', 'آلات مشي', 'آليات نقل الحركة'],
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'Online'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'أونلاين'],
    position: 5,
  },
  {
    slug: 'robotoys',
    kitCode: 'CODE-03',
    nameEn: 'RoboToys',
    nameAr: 'روبوتويز',
    ageMin: 9,
    ageMax: 12,
    format: Format.online,
    color: '#11388E',
    level: 6,
    taglineEn: 'Advanced robotics — deeper projects and smarter logic.',
    taglineAr: 'الروبوتات المتقدمة — مشاريع أعمق ومنطق أذكى',
    descEn:
      'RoboToys takes ages 9–12 into advanced robotics in live 90-minute online sessions — richer projects, smarter logic, sensors and real problem solving that prepares them for written code.',
    descAr:
      'ينقل روبوتويز الأعمار ٩–١٢ إلى الروبوتات المتقدمة في حصص أونلاين (٩٠ دقيقة) — مشاريع أغنى ومنطق أذكى وحسّاسات وحلّ مشكلات حقيقي يمهّد للكود المكتوب.',
    buildsEn: ['Sensor-driven robots', 'Multi-step missions', 'Smart logic projects'],
    buildsAr: ['روبوتات بحسّاسات', 'مهمات متعددة الخطوات', 'مشاريع منطق ذكية'],
    termsEn: ['90-minute live sessions', 'Class cap: 16 kids', 'Online'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'أونلاين'],
    position: 6,
  },
  {
    slug: 'algoc',
    kitCode: 'CODE-04',
    nameEn: 'AlgoC',
    nameAr: 'ألجو سي',
    ageMin: 13,
    ageMax: 18,
    format: Format.online,
    color: '#101A38',
    level: 7,
    taglineEn: 'Software & robotics engineering for teens — the road to real development.',
    taglineAr: 'هندسة البرمجة والروبوتات للمراهقين — الطريق إلى التطوير الحقيقي',
    descEn:
      'AlgoC graduates teens aged 13–18 from blocks to real written code. Live 90-minute online sessions — max 8 students — cover variables, functions, and problem decomposition, ending each term with a coding project they present to the class.',
    descAr:
      'ينقل ألجو سي المراهقين من ١٣ إلى ١٨ سنة من المكعبات البرمجية إلى الكود الحقيقي. حصص أونلاين (٩٠ دقيقة) — ٨ طلاب كحد أقصى — تغطي المتغيرات والدوال وتفكيك المشكلات، وينتهي كل فصل بمشروع برمجي يعرضه الطالب أمام زملائه.',
    buildsEn: ['Real written code', 'Term coding projects', 'Problem decomposition skills'],
    buildsAr: ['كود برمجي حقيقي', 'مشاريع برمجية فصلية', 'مهارات تفكيك المشكلات'],
    termsEn: ['90-minute live sessions', 'Class cap: 8 students', 'Online'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', '٨ طلاب كحد أقصى', 'أونلاين'],
    position: 7,
  },
];

// weekday: 0=Sunday .. 6=Saturday — 14 slots.
// Evening & weekend live online slots match program durations (45/75/90).
const slotsBySlug: Record<string, { weekday: number; time: string; format: Format; location?: string; capacity: number; seatsLeft: number }[]> = {
  'big-builders': [
    { weekday: 6, time: '09:00', format: Format.online, capacity: 12, seatsLeft: 7 },
    { weekday: 6, time: '10:00', format: Format.online, capacity: 12, seatsLeft: 2 },
  ],
  smartivo: [
    { weekday: 0, time: '17:00', format: Format.online, capacity: 12, seatsLeft: 5 },
    { weekday: 2, time: '17:00', format: Format.online, capacity: 12, seatsLeft: 3 },
    { weekday: 6, time: '09:00', format: Format.online, capacity: 12, seatsLeft: 6 },
  ],
  'bricks-challenge': [
    { weekday: 6, time: '10:30', format: Format.online, capacity: 16, seatsLeft: 3 },
    { weekday: 6, time: '12:00', format: Format.online, capacity: 16, seatsLeft: 9 },
  ],
  algoplay: [
    { weekday: 1, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 6 },
    { weekday: 3, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 2 },
  ],
  'galileo-technic': [
    { weekday: 6, time: '11:45', format: Format.online, capacity: 16, seatsLeft: 8 },
    { weekday: 4, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 11 },
  ],
  robotoys: [
    { weekday: 1, time: '18:30', format: Format.online, capacity: 16, seatsLeft: 4 },
    { weekday: 3, time: '18:30', format: Format.online, capacity: 16, seatsLeft: 7 },
  ],
  algoc: [
    { weekday: 0, time: '19:00', format: Format.online, capacity: 8, seatsLeft: 2 },
    { weekday: 2, time: '19:00', format: Format.online, capacity: 8, seatsLeft: 5 },
  ],
};

const testimonials = [
  {
    name: 'Um Khalid',
    nameAr: 'أم خالد',
    area: 'Saudi Arabia',
    programEn: 'Bricks Challenge',
    programAr: 'تحدي المكعبات',
    quoteEn: 'My son built a motorized crane in his third class and explained gears to me at dinner. I was speechless.',
    quoteAr: 'ابني بنى رافعة بمحرك في حصته الثالثة وشرح لي التروس على العشاء. لم أجد كلمات.',
    position: 1,
  },
  {
    name: 'Abu Lama',
    nameAr: 'أبو لمى',
    area: 'Saudi Arabia',
    programEn: 'AlgoPlay',
    programAr: 'ألجوبلاي',
    quoteEn: "The live AlgoPlay class is the only screen time I don't feel guilty about. Live teacher, small group, real learning.",
    quoteAr: 'حصة ألجوبلاي المباشرة هي وقت الشاشة الوحيد الذي لا أشعر بالذنب تجاهه. معلّم مباشر ومجموعة صغيرة وتعلّم حقيقي.',
    position: 2,
  },
  {
    name: 'Um Yara',
    nameAr: 'أم يارا',
    area: 'Saudi Arabia',
    programEn: 'Smartivo',
    programAr: 'سمارتيفو',
    quoteEn: 'She started at Smartivo age 5. The clear path all the way to real coding at 13 is exactly why we chose FunAdemy.',
    quoteAr: 'بدأت في سمارتيفو بعمر ٥ سنوات. المسار الواضح وصولاً إلى البرمجة الحقيقية بعمر ١٣ هو سبب اختيارنا FunAdemy.',
    position: 3,
  },
];

const faqs = [
  {
    questionEn: "Which program is right for my child's age?",
    questionAr: 'أي برنامج يناسب عمر طفلي؟',
    answerEn:
      'Follow the Learning Path: ages 4–6 start with Big Builders or Smartivo, 6–10 with Bricks Challenge or AlgoPlay, 7–10 with Galileo Technic, 9–12 with RoboToys, and 13–18 with AlgoC. The free trial confirms the perfect fit.',
    answerAr:
      'اتبع مسار التعلّم: الأعمار ٤–٦ تبدأ بالبنّائين الصغار أو سمارتيفو، و٦–١٠ بتحدي المكعبات أو ألجوبلاي، و٧–١٠ بغاليليو تكنيك، و٩–١٢ بروبوتويز، و١٣–١٨ بألجو سي. الحصة التجريبية المجانية تؤكد الاختيار الأنسب.',
    position: 1,
  },
  {
    questionEn: 'Is the trial class really free?',
    questionAr: 'هل الحصة التجريبية مجانية فعلاً؟',
    answerEn: 'Yes — completely free with no commitment. Your child joins a real class, builds a real model, and you see exactly how sessions run before deciding.',
    answerAr: 'نعم — مجانية تماماً وبدون أي التزام. ينضم طفلك إلى حصة حقيقية ويبني نموذجاً حقيقياً وترى بنفسك كيف تسير الحصص قبل اتخاذ القرار.',
    position: 2,
  },
  {
    questionEn: 'How are classes delivered?',
    questionAr: 'كيف تُقدَّم الحصص؟',
    answerEn:
      'All programs run live online — a real teacher and a small group in every session, open to everyone from anywhere.',
    answerAr:
      'جميع البرامج أونلاين — معلّم حقيقي ومجموعة صغيرة في كل حصة، ومتاحة للجميع من أي مكان.',
    position: 3,
  },
  {
    questionEn: 'What do online classes require?',
    questionAr: 'ماذا تحتاج الحصص الأونلاين؟',
    answerEn: 'A computer or tablet with a camera and stable internet. Classes are live with a real teacher and a small group — never recorded videos.',
    answerAr: 'جهاز كمبيوتر أو تابلت بكاميرا واتصال إنترنت مستقر. الحصص مباشرة مع معلّم حقيقي ومجموعة صغيرة — وليست فيديوهات مسجّلة أبداً.',
    position: 4,
  },
  {
    questionEn: 'Do you provide the LEGO® kits?',
    questionAr: 'هل توفرون مجموعات المكعبات؟',
    answerEn: 'Yes — we guide you to the official e² Young Engineers kit your child needs at home, and building programs ship the kit to your door.',
    answerAr: 'نعم — نرشدك إلى مجموعة e² Young Engineers الرسمية التي يحتاجها طفلك في المنزل، وبرامج البناء تُشحن عدّتها إلى باب منزلك.',
    position: 5,
  },
  {
    questionEn: 'How does pricing work?',
    questionAr: 'كيف تعمل الأسعار؟',
    answerEn:
      'One simple plan: SAR 1,380 per child per program monthly, including 4–6 sessions per month (session length by age: 45/75/90 minutes). Families with 2+ children get 10% off each additional child, and the first trial class is free.',
    answerAr:
      'خطة واحدة بسيطة: ١٣٨٠ ريالاً للطفل للبرنامج شهرياً، وتشمل ٤–٦ حصص في الشهر (مدة الحصة حسب العمر: ٤٥/٧٥/٩٠ دقيقة). العائلات التي لديها طفلان أو أكثر تحصل على خصم ١٠٪ لكل طفل إضافي، والحصة التجريبية الأولى مجانية.',
    position: 6,
  },
];

/**
 * Phase 1 — course runs (one per program, from the primary slot pattern),
 * skills per program, and the shared badge shelf.
 */
const runsBySlug: Record<string, { weekday: number; time: string; format: Format; location?: string; capacity: number; seatsLeft: number }> = {
  'big-builders': { weekday: 6, time: '09:00', format: Format.online, capacity: 12, seatsLeft: 7 },
  smartivo: { weekday: 0, time: '17:00', format: Format.online, capacity: 12, seatsLeft: 5 },
  'bricks-challenge': { weekday: 6, time: '10:30', format: Format.online, capacity: 16, seatsLeft: 3 },
  algoplay: { weekday: 1, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 6 },
  'galileo-technic': { weekday: 6, time: '11:45', format: Format.online, capacity: 16, seatsLeft: 8 },
  robotoys: { weekday: 1, time: '18:30', format: Format.online, capacity: 16, seatsLeft: 4 },
  algoc: { weekday: 0, time: '19:00', format: Format.online, capacity: 8, seatsLeft: 2 },
};

const skillsBySlug: Record<string, { code: string; nameAr: string; nameEn: string }[]> = {
  'big-builders': [
    { code: 'world-towers', nameAr: 'بناء الأبراج المتوازنة', nameEn: 'Balanced towers' },
    { code: 'world-bridges', nameAr: 'الجسور والأقواس', nameEn: 'Bridges & arches' },
    { code: 'world-wheels', nameAr: 'العجلات والحركة', nameEn: 'Wheels & motion' },
    { code: 'world-story', nameAr: 'سرد قصة النموذج', nameEn: 'Model storytelling' },
  ],
  smartivo: [
    { code: 'code-patterns', nameAr: 'الأنماط والتسلسل', nameEn: 'Patterns & sequences' },
    { code: 'code-directions', nameAr: 'الاتجاهات والأوامر', nameEn: 'Directions & commands' },
    { code: 'code-logic-games', nameAr: 'ألعاب المنطق', nameEn: 'Logic games' },
    { code: 'code-digital', nameAr: 'الثقافة الرقمية المبكرة', nameEn: 'Early digital literacy' },
  ],
  'bricks-challenge': [
    { code: 'mech-gears', nameAr: 'التروس ونسب النقل', nameEn: 'Gears & ratios' },
    { code: 'mech-levers', nameAr: 'الروافع', nameEn: 'Levers' },
    { code: 'mech-pulleys', nameAr: 'البكرات', nameEn: 'Pulleys' },
    { code: 'mech-gravity', nameAr: 'مركز الثقل والتوازن', nameEn: 'Center of gravity' },
    { code: 'mech-motors', nameAr: 'المحركات والطاقة', nameEn: 'Motors & power' },
  ],
  algoplay: [
    { code: 'code-loops', nameAr: 'الحلقات التكرارية', nameEn: 'Loops' },
    { code: 'code-conditions', nameAr: 'الشروط', nameEn: 'Conditions' },
    { code: 'code-debugging', nameAr: 'تصحيح الأخطاء', nameEn: 'Debugging' },
    { code: 'code-missions', nameAr: 'تخطيط المهمات', nameEn: 'Mission planning' },
  ],
  'galileo-technic': [
    { code: 'mech-differential', nameAr: 'التروس التفاضلية', nameEn: 'Differential gears' },
    { code: 'mech-transmission', nameAr: 'نقل الحركة', nameEn: 'Transmission' },
    { code: 'mech-walkers', nameAr: 'آليات المشي', nameEn: 'Walking mechanisms' },
    { code: 'mech-structures', nameAr: 'الهياكل المتقدمة', nameEn: 'Advanced structures' },
  ],
  robotoys: [
    { code: 'robo-sensors', nameAr: 'الحسّاسات', nameEn: 'Sensors' },
    { code: 'robo-multistep', nameAr: 'المهمات متعددة الخطوات', nameEn: 'Multi-step missions' },
    { code: 'robo-smart-logic', nameAr: 'المنطق الذكي', nameEn: 'Smart logic' },
    { code: 'robo-problem', nameAr: 'حل المشكلات', nameEn: 'Problem solving' },
  ],
  algoc: [
    { code: 'prog-variables', nameAr: 'المتغيرات', nameEn: 'Variables' },
    { code: 'prog-functions', nameAr: 'الدوال', nameEn: 'Functions' },
    { code: 'prog-decomposition', nameAr: 'تفكيك المشكلات', nameEn: 'Problem decomposition' },
    { code: 'prog-project', nameAr: 'مشروع الفصل', nameEn: 'Term project' },
  ],
};

const badges = [
  { code: 'first-build', nameAr: 'أول نموذج', nameEn: 'First Build', descAr: 'أكمل أول نموذج في الحصة', descEn: 'Completed the first model in class', iconKey: 'star', position: 1 },
  { code: 'gear-master', nameAr: 'خبير التروس', nameEn: 'Gear Master', descAr: 'أتقن مهارات التروس ونسب النقل', descEn: 'Mastered gears and ratios', iconKey: 'gear', position: 2 },
  { code: 'perfect-month', nameAr: 'حضور مثالي', nameEn: 'Perfect Month', descAr: 'حضر جميع حصص الشهر', descEn: 'Attended every session in a month', iconKey: 'crown', position: 3 },
  { code: 'team-player', nameAr: 'روح الفريق', nameEn: 'Team Player', descAr: 'تعاون مميز مع زملائه', descEn: 'Outstanding teamwork', iconKey: 'bolt', position: 4 },
  { code: 'young-inventor', nameAr: 'المخترع الصغير', nameEn: 'Young Inventor', descAr: 'قدّم فكرة إبداعية خاصة به', descEn: 'Presented an original creative idea', iconKey: 'rocket', position: 5 },
  { code: 'path-climber', nameAr: 'متسلق المسار', nameEn: 'Path Climber', descAr: 'انتقل إلى برنامج المستوى التالي', descEn: 'Advanced to the next program on the path', iconKey: 'kite', position: 6 },
];

/** Generate weekly session dates for a run (Asia/Riyadh, stored as UTC noon-ish). */
function weeklyDates(start: Date, end: Date, weekday: number, time: string): Date[] {
  const [h, m] = time.split(':').map(Number);
  const dates: Date[] = [];
  const d = new Date(start);
  // JS getUTCDay(): 0=Sunday — matches our weekday convention.
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    // store as Riyadh local time (UTC+3)
    dates.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 3, m)));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}

async function seedPhase1() {
  // Badges (global shelf)
  for (const b of badges) {
    const { code, ...data } = b;
    await prisma.badge.upsert({ where: { code }, update: data, create: { code, ...data } });
  }

  const allPrograms = await prisma.program.findMany();
  for (const program of allPrograms) {
    // Skills per program
    let pos = 1;
    for (const s of skillsBySlug[program.slug] ?? []) {
      await prisma.skill.upsert({
        where: { code: s.code },
        update: { nameAr: s.nameAr, nameEn: s.nameEn, position: pos, programId: program.id },
        create: { ...s, position: pos, programId: program.id },
      });
      pos++;
    }

    // One course run per program (Sep–Dec 2026) with generated weekly sessions
    const runSpec = runsBySlug[program.slug];
    if (!runSpec) continue;
    const existing = await prisma.courseRun.count({ where: { programId: program.id } });
    if (existing > 0) continue;
    const startDate = new Date(Date.UTC(2026, 8, 1)); // Sep 1, 2026
    const endDate = new Date(Date.UTC(2026, 11, 17)); // Dec 17, 2026
    const run = await prisma.courseRun.create({
      data: {
        programId: program.id,
        titleAr: 'دفعة سبتمبر ٢٠٢٦',
        titleEn: 'September 2026 cohort',
        startDate,
        endDate,
        ...runSpec,
        monthlyPriceSar: 1380,
      },
    });
    await prisma.classSession.createMany({
      data: weeklyDates(startDate, endDate, runSpec.weekday, runSpec.time).map((date) => ({
        courseRunId: run.id,
        date,
      })),
    });
  }
}

async function main() {
  console.log('Seeding FunAdemy database…');

  const force = process.env.FORCE_RESEED === '1';
  if (force) {
    await prisma.booking.deleteMany();
    await prisma.scheduleSlot.deleteMany();
    await prisma.testimonial.deleteMany();
    await prisma.faqEntry.deleteMany();
    // Remove programs not in the official catalog
    await prisma.program.deleteMany({ where: { slug: { notIn: programs.map((p) => p.slug) } } });
  }

  for (const p of programs) {
    const { slug, ...data } = p;
    const program = await prisma.program.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
    const existing = await prisma.scheduleSlot.count({ where: { programId: program.id } });
    if (existing === 0) {
      for (const s of slotsBySlug[slug] ?? []) {
        await prisma.scheduleSlot.create({ data: { ...s, programId: program.id } });
      }
    }
  }

  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({ data: testimonials });
  }
  if ((await prisma.faqEntry.count()) === 0) {
    await prisma.faqEntry.createMany({ data: faqs });
  }

  await seedPhase1();

  // Shared brick counter (public.campaign_counters) — set launch value if lower.
  await prisma.$executeRaw`
    INSERT INTO public.campaign_counters (key, count) VALUES ('watan-bricks', 1847)
    ON CONFLICT (key) DO UPDATE SET count = GREATEST(campaign_counters.count, 1847)
  `;

  console.log('Seed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
