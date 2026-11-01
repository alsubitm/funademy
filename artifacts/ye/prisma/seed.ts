import { PrismaClient, Format } from '@prisma/client';
import { explorerExercises, builderExercises } from '../src/lib/seeded-learning-exercises';
import { backfillEnglishLearningOptions } from '../src/lib/backfill-learning-options';

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
    format: Format.in_person,
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
    termsEn: ['45-minute live sessions', 'Class cap: 12 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'حضوري في الرياض'],
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
    format: Format.in_person,
    color: '#22DAFF',
    level: 2,
    taglineEn: 'All the coding foundations for little ones — hands-on or on screen.',
    taglineAr: 'جميع أساسيات البرمجة للصغار — ملموسة أو على الشاشة',
    descEn:
      'Smartivo builds early computational thinking for ages 4–6 in live 45-minute in-person classes in Riyadh. Kids solve pattern puzzles, sequence challenges, and interactive logic games with a live teacher and a small group.',
    descAr:
      'يبني سمارتيفو التفكير الحاسوبي المبكر للأعمار ٤–٦ في حصص مباشرة مدتها ٤٥ دقيقة، حضورياً في الرياض. يحلّ الأطفال ألغاز الأنماط وتحديات التسلسل وألعاب المنطق التفاعلية مع معلّم مباشر ومجموعة صغيرة.',
    buildsEn: ['Pattern & sequence puzzles', 'Interactive logic games', 'Early digital literacy'],
    buildsAr: ['ألغاز الأنماط والتسلسل', 'ألعاب منطق تفاعلية', 'ثقافة رقمية مبكرة'],
    termsEn: ['45-minute live sessions', 'Class cap: 12 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'حضوري في الرياض'],
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
    format: Format.in_person,
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
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري في الرياض'],
    position: 3,
  },
  {
    slug: 'algoplay',
    kitCode: 'CODE-02',
    nameEn: 'AlgoPlay',
    nameAr: 'ألجوبلاي',
    ageMin: 6,
    ageMax: 10,
    format: Format.in_person,
    color: '#1C54CB',
    level: 4,
    taglineEn: 'Robotics fundamentals: building and programming on screen.',
    taglineAr: 'أساسيات الروبوتات: تركيب وبرمجة على الشاشة',
    descEn:
      'AlgoPlay takes ages 6–10 from play to programming. In 75-minute in-person sessions, kids command virtual robots, chain loops and conditions, and debug their own solutions — the bridge between building and coding.',
    descAr:
      'ينقل ألجوبلاي الأطفال من ٦ إلى ١٠ سنوات من اللعب إلى البرمجة. في حصص حضورية (٧٥ دقيقة) يوجّه الأطفال روبوتات افتراضية ويربطون الحلقات والشروط ويصحّحون حلولهم بأنفسهم — الجسر بين البناء والبرمجة.',
    buildsEn: ['Virtual robot missions', 'Loop & condition challenges', 'Debugging workshops'],
    buildsAr: ['مهمات روبوت افتراضية', 'تحديات الحلقات والشروط', 'ورش تصحيح الأخطاء'],
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري في الرياض'],
    position: 4,
  },
  {
    slug: 'galileo-technic',
    kitCode: 'MECH-02',
    nameEn: 'Galileo Technic',
    nameAr: 'غاليليو تكنيك',
    ageMin: 7,
    ageMax: 10,
    format: Format.in_person,
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
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري في الرياض'],
    position: 5,
  },
  {
    slug: 'robotoys',
    kitCode: 'CODE-03',
    nameEn: 'RoboToys',
    nameAr: 'روبوتويز',
    ageMin: 9,
    ageMax: 12,
    format: Format.in_person,
    color: '#11388E',
    level: 6,
    taglineEn: 'Advanced robotics — deeper projects and smarter logic.',
    taglineAr: 'الروبوتات المتقدمة — مشاريع أعمق ومنطق أذكى',
    descEn:
      'RoboToys takes ages 9–12 into advanced robotics in 90-minute in-person sessions — richer projects, smarter logic, sensors and real problem solving that prepares them for written code.',
    descAr:
      'ينقل روبوتويز الأعمار ٩–١٢ إلى الروبوتات المتقدمة في حصص حضورية (٩٠ دقيقة) — مشاريع أغنى ومنطق أذكى وحسّاسات وحلّ مشكلات حقيقي يمهّد للكود المكتوب.',
    buildsEn: ['Sensor-driven robots', 'Multi-step missions', 'Smart logic projects'],
    buildsAr: ['روبوتات بحسّاسات', 'مهمات متعددة الخطوات', 'مشاريع منطق ذكية'],
    termsEn: ['90-minute live sessions', 'Class cap: 16 kids', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري في الرياض'],
    position: 6,
  },
  {
    slug: 'algoc',
    kitCode: 'CODE-04',
    nameEn: 'AlgoC',
    nameAr: 'ألجو سي',
    ageMin: 13,
    ageMax: 18,
    format: Format.in_person,
    color: '#101A38',
    level: 7,
    taglineEn: 'Software & robotics engineering for teens — the road to real development.',
    taglineAr: 'هندسة البرمجة والروبوتات للمراهقين — الطريق إلى التطوير الحقيقي',
    descEn:
      'AlgoC graduates teens aged 13–18 from blocks to real written code. In-person 90-minute sessions — max 8 students — cover variables, functions, and problem decomposition, ending each term with a coding project they present to the class.',
    descAr:
      'ينقل ألجو سي المراهقين من ١٣ إلى ١٨ سنة من المكعبات البرمجية إلى الكود الحقيقي. حصص حضورية (٩٠ دقيقة) — ٨ طلاب كحد أقصى — تغطي المتغيرات والدوال وتفكيك المشكلات، وينتهي كل فصل بمشروع برمجي يعرضه الطالب أمام زملائه.',
    buildsEn: ['Real written code', 'Term coding projects', 'Problem decomposition skills'],
    buildsAr: ['كود برمجي حقيقي', 'مشاريع برمجية فصلية', 'مهارات تفكيك المشكلات'],
    termsEn: ['90-minute live sessions', 'Class cap: 8 students', 'In-person in Riyadh'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', '٨ طلاب كحد أقصى', 'حضوري في الرياض'],
    position: 7,
  },
];

// weekday: 0=Sunday .. 6=Saturday — 14 slots.
// Evening & weekend in-person slots match program durations (45/75/90).
const slotsBySlug: Record<string, { weekday: number; time: string; format: Format; location?: string; capacity: number; seatsLeft: number }[]> = {
  'big-builders': [
    { weekday: 6, time: '09:00', format: Format.in_person, capacity: 12, seatsLeft: 7 },
    { weekday: 6, time: '10:00', format: Format.in_person, capacity: 12, seatsLeft: 2 },
  ],
  smartivo: [
    { weekday: 0, time: '17:00', format: Format.in_person, capacity: 12, seatsLeft: 5 },
    { weekday: 2, time: '17:00', format: Format.in_person, capacity: 12, seatsLeft: 3 },
    { weekday: 6, time: '09:00', format: Format.in_person, capacity: 12, seatsLeft: 6 },
  ],
  'bricks-challenge': [
    { weekday: 6, time: '10:30', format: Format.in_person, capacity: 16, seatsLeft: 3 },
    { weekday: 6, time: '12:00', format: Format.in_person, capacity: 16, seatsLeft: 9 },
  ],
  algoplay: [
    { weekday: 1, time: '17:30', format: Format.in_person, capacity: 16, seatsLeft: 6 },
    { weekday: 3, time: '17:30', format: Format.in_person, capacity: 16, seatsLeft: 2 },
  ],
  'galileo-technic': [
    { weekday: 6, time: '11:45', format: Format.in_person, capacity: 16, seatsLeft: 8 },
    { weekday: 4, time: '17:30', format: Format.in_person, capacity: 16, seatsLeft: 11 },
  ],
  robotoys: [
    { weekday: 1, time: '18:30', format: Format.in_person, capacity: 16, seatsLeft: 4 },
    { weekday: 3, time: '18:30', format: Format.in_person, capacity: 16, seatsLeft: 7 },
  ],
  algoc: [
    { weekday: 0, time: '19:00', format: Format.in_person, capacity: 8, seatsLeft: 2 },
    { weekday: 2, time: '19:00', format: Format.in_person, capacity: 8, seatsLeft: 5 },
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
      'All programs are in-person classes in Riyadh — a real teacher and a small group in every session.',
    answerAr:
      'جميع البرامج حصص حضورية في الرياض — معلّم حقيقي ومجموعة صغيرة في كل حصة.',
    position: 3,
  },
  {
    questionEn: 'Where are classes held?',
    questionAr: 'أين تُقام الحصص؟',
    answerEn: 'Classes are held in person in Riyadh. Contact us for current locations and schedules.',
    answerAr: 'تُقام الحصص حضورياً في الرياض. تواصل معنا لمعرفة المواقع والمواعيد الحالية.',
    position: 4,
  },
  {
    questionEn: 'Do you provide the LEGO® kits?',
    questionAr: 'هل توفرون مجموعات المكعبات؟',
    answerEn: 'Contact us for the equipment requirements of your child’s program.',
    answerAr: 'تواصل معنا لمعرفة متطلبات العدة لبرنامج طفلك.',
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
  'big-builders': { weekday: 6, time: '09:00', format: Format.in_person, capacity: 12, seatsLeft: 7 },
  smartivo: { weekday: 0, time: '17:00', format: Format.in_person, capacity: 12, seatsLeft: 5 },
  'bricks-challenge': { weekday: 6, time: '10:30', format: Format.in_person, capacity: 16, seatsLeft: 3 },
  algoplay: { weekday: 1, time: '17:30', format: Format.in_person, capacity: 16, seatsLeft: 6 },
  'galileo-technic': { weekday: 6, time: '11:45', format: Format.in_person, capacity: 16, seatsLeft: 8 },
  robotoys: { weekday: 1, time: '18:30', format: Format.in_person, capacity: 16, seatsLeft: 4 },
  algoc: { weekday: 0, time: '19:00', format: Format.in_person, capacity: 8, seatsLeft: 2 },
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

  // Blog posts migrated from the old Manara site (copy adapted to FunAdemy).
  // Idempotent: existing posts (possibly edited by admins) are left untouched.
  const blogPosts = [
    {
      slug: 'screen-time-balance',
      titleAr: 'كيف توازن بين وقت الشاشة والتعلم؟',
      excerptAr:
        'وقت الشاشة ليس عدواً إذا كان محتواه تعليمياً هادفاً. إليك 5 قواعد عملية للأسرة السعودية.',
      contentAr:
        'يقضي الطفل السعودي في المتوسط أكثر من 3 ساعات يومياً أمام الشاشات. السؤال ليس «كم»، بل «ماذا يشاهد؟»\n\n1. حدد وقتاً ثابتاً للتعلم الرقمي — 30 إلى 45 دقيقة كافية.\n2. اجعل التعلم قبل الترفيه، وليس بعده.\n3. استخدم أدوات التحكم الأبوي وحدود الوقت اليومية.\n4. شارك طفلك: اسأله عمّا تعلمه اليوم.\n5. كافئ الاستمرارية لا السرعة — الشارات والنقاط وسيلة وليست غاية.\n\nفي فناديمي، نوازن بين الشاشة واللعب الحقيقي: أطفالنا يبنون بأيديهم نماذج ليغو هندسية ثم يبرمجونها، فيتحول وقت الشاشة إلى أداة إبداع لا استهلاك.',
      coverEmoji: '⏰',
    },
    {
      slug: 'learning-through-play',
      titleAr: 'التعلم باللعب: لماذا يتذكر طفلك الألعاب وينسى الدروس؟',
      excerptAr: 'الدماغ يتعلم أفضل عندما يستمتع. نشرح علم التلعيب وكيف نطبقه في برامجنا.',
      contentAr:
        'عندما يلعب الطفل، يفرز دماغه الدوبامين — وهو نفس الناقل العصبي المسؤول عن تثبيت الذكريات.\n\nلهذا صممنا برامجنا حول ثلاث ركائز:\n\n**البناء بالأيدي:** كل مفهوم هندسي يتحول إلى نموذج ملموس يبنيه الطفل بنفسه.\n**التحدي المتدرج:** كل حصة تنتهي بتحدٍ يفخر الطفل بإنجازه.\n**الاحتفال بالإنجاز:** شهادات ومحطات إنجاز يشاركها الطفل مع عائلته.\n\nالنتيجة؟ طفل يطلب الحصة بنفسه، بدل أن تطارده بها.',
      coverEmoji: '🎮',
    },
    {
      slug: 'saudi-curriculum-guide',
      titleAr: 'دليل الوالدين للمنهج السعودي الجديد',
      excerptAr: 'ما الذي تغير في مناهج وزارة التعليم؟ وكيف تدعم طفلك في كل مرحلة؟',
      contentAr:
        'شهدت المناهج السعودية تطويراً مستمراً ضمن رؤية 2030، مع تركيز أكبر على المهارات التطبيقية والعلوم والتقنية.\n\n**المرحلة الابتدائية:** التركيز على أساسيات القراءة والحساب والاستكشاف العلمي.\n**المرحلة المتوسطة:** التفكير الناقد وحل المشكلات والبرمجة.\n**المرحلة الثانوية:** نظام المسارات الجديد ومسار الحاسب والهندسة.\n\nبرامج الهندسة والروبوتات في فناديمي تدعم مباشرة هذا التوجه: طفلك يطبق عملياً ما يدرسه نظرياً في المدرسة، ويبني مهارات STEM المطلوبة لمستقبله.',
      coverEmoji: '📖',
    },
  ];
  for (const post of blogPosts) {
    await prisma.blogPost.upsert({ where: { slug: post.slug }, update: {}, create: post });
  }

  await seedPhase1();

  // Shared brick counter (public.campaign_counters) — set launch value if lower.
  await prisma.$executeRaw`
    INSERT INTO public.campaign_counters (key, count) VALUES ('watan-bricks', 1847)
    ON CONFLICT (key) DO UPDATE SET count = GREATEST(campaign_counters.count, 1847)
  `;

  // ── Learning platform curriculum ─────────────────────────────────────────
  await seedCurriculum();

  console.log('Seed complete.');
}

// ────────────────────────────────────────────────────────────────────────────
// Curriculum seed — idempotent (upsert by slug / unique fields)
// Ported from Manara/API-server seed; 4 subjects × banded units/lessons
// ────────────────────────────────────────────────────────────────────────────

const YT_VIDEOS = [
  'https://www.youtube.com/watch?v=Xn9SC7EowXA',
  'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  'https://www.youtube.com/watch?v=kXYiU_JCYtU',
];

interface UnitPlan {
  titleAr: string;
  titleEn: string;
  band: 'explorers' | 'builders' | 'achievers' | 'graduates';
  lessons: Array<{ titleAr: string; titleEn: string; durationMinutes: number; isFreeSample?: boolean }>;
}

const CURRICULUM: Array<{
  nameAr: string;
  nameEn: string;
  slug: string;
  icon: string;
  color: string;
  units: UnitPlan[];
}> = [
  {
    nameAr: 'الرياضيات',
    nameEn: 'Math',
    slug: 'math',
    icon: '🔢',
    color: '#2563EB',
    units: [
      {
        titleAr: 'الأعداد من ١ إلى ١٠',
        titleEn: 'Numbers 1–10',
        band: 'explorers',
        lessons: [
          { titleAr: 'تعرّف على الأعداد', titleEn: 'Meet the numbers', durationMinutes: 6, isFreeSample: true },
          { titleAr: 'ترتيب الأعداد', titleEn: 'Ordering numbers', durationMinutes: 8 },
          { titleAr: 'الأعداد والأشياء', titleEn: 'Numbers and objects', durationMinutes: 10 },
          { titleAr: 'العدّ إلى ١٠', titleEn: 'Counting to 10', durationMinutes: 8 },
        ],
      },
      {
        titleAr: 'الأشكال الهندسية',
        titleEn: 'Shapes',
        band: 'explorers',
        lessons: [
          { titleAr: 'الأشكال حولنا', titleEn: 'Shapes around us', durationMinutes: 6 },
          { titleAr: 'المثلث والمربع', titleEn: 'Triangle and square', durationMinutes: 8 },
          { titleAr: 'الدائرة والمستطيل', titleEn: 'Circle and rectangle', durationMinutes: 8 },
          { titleAr: 'بناء بالأشكال', titleEn: 'Building with shapes', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'الجمع البسيط',
        titleEn: 'Simple addition',
        band: 'explorers',
        lessons: [
          { titleAr: 'ما هو الجمع؟', titleEn: 'What is addition?', durationMinutes: 6 },
          { titleAr: 'الجمع بالأشياء', titleEn: 'Adding with objects', durationMinutes: 8 },
          { titleAr: 'تدريب على الجمع', titleEn: 'Addition practice', durationMinutes: 10 },
          { titleAr: 'مسائل الجمع', titleEn: 'Addition problems', durationMinutes: 8 },
        ],
      },
      {
        titleAr: 'الضرب والقسمة',
        titleEn: 'Multiplication and division',
        band: 'builders',
        lessons: [
          { titleAr: 'جداول الضرب', titleEn: 'Multiplication tables', durationMinutes: 8, isFreeSample: true },
          { titleAr: 'الضرب في العقود', titleEn: 'Multiplying by tens', durationMinutes: 8 },
          { titleAr: 'مفهوم القسمة', titleEn: 'Division concept', durationMinutes: 10 },
          { titleAr: 'الضرب والقسمة معاً', titleEn: 'Multiplication and division together', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'الكسور',
        titleEn: 'Fractions',
        band: 'builders',
        lessons: [
          { titleAr: 'ما هو الكسر؟', titleEn: 'What is a fraction?', durationMinutes: 6 },
          { titleAr: 'النصف والربع', titleEn: 'Half and quarter', durationMinutes: 8 },
          { titleAr: 'مقارنة الكسور', titleEn: 'Comparing fractions', durationMinutes: 8 },
          { titleAr: 'الكسور في الحياة', titleEn: 'Fractions in daily life', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'القياس والهندسة',
        titleEn: 'Measurement and geometry',
        band: 'builders',
        lessons: [
          { titleAr: 'القياس بالسنتيمتر', titleEn: 'Measuring in centimetres', durationMinutes: 6 },
          { titleAr: 'المحيط والمساحة', titleEn: 'Perimeter and area', durationMinutes: 8 },
          { titleAr: 'الأشكال ثلاثية الأبعاد', titleEn: '3D shapes', durationMinutes: 10 },
          { titleAr: 'تطبيقات القياس', titleEn: 'Measurement applications', durationMinutes: 8 },
        ],
      },
    ],
  },
  {
    nameAr: 'اللغة العربية',
    nameEn: 'Arabic',
    slug: 'arabic',
    icon: '📖',
    color: '#059669',
    units: [
      {
        titleAr: 'الحروف الهجائية (أ–خ)',
        titleEn: 'Arabic alphabet (A–Kh)',
        band: 'explorers',
        lessons: [
          { titleAr: 'حرف الألف', titleEn: 'Letter alef', durationMinutes: 6, isFreeSample: true },
          { titleAr: 'حرف الباء والتاء', titleEn: 'Letters ba and ta', durationMinutes: 8 },
          { titleAr: 'حروف الجيم والحاء', titleEn: 'Letters jeem and ha', durationMinutes: 8 },
          { titleAr: 'مراجعة أ–خ', titleEn: 'Review A–Kh', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'الحروف الهجائية (د–ص)',
        titleEn: 'Arabic alphabet (D–S)',
        band: 'explorers',
        lessons: [
          { titleAr: 'حرف الدال والذال', titleEn: 'Letters dal and thal', durationMinutes: 6 },
          { titleAr: 'حروف الراء والزاي', titleEn: 'Letters ra and zay', durationMinutes: 8 },
          { titleAr: 'حروف السين والشين', titleEn: 'Letters seen and sheen', durationMinutes: 8 },
          { titleAr: 'مراجعة د–ص', titleEn: 'Review D–S', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'كلماتي الأولى',
        titleEn: 'My first words',
        band: 'explorers',
        lessons: [
          { titleAr: 'كلمات الجسم', titleEn: 'Body words', durationMinutes: 6 },
          { titleAr: 'كلمات المنزل', titleEn: 'Home words', durationMinutes: 8 },
          { titleAr: 'كلمات الطبيعة', titleEn: 'Nature words', durationMinutes: 8 },
          { titleAr: 'جمل قصيرة', titleEn: 'Short sentences', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'القراءة والفهم',
        titleEn: 'Reading and comprehension',
        band: 'builders',
        lessons: [
          { titleAr: 'قراءة نص قصير', titleEn: 'Reading a short text', durationMinutes: 8, isFreeSample: true },
          { titleAr: 'فهم المقروء', titleEn: 'Reading comprehension', durationMinutes: 10 },
          { titleAr: 'الأفكار الرئيسية', titleEn: 'Main ideas', durationMinutes: 8 },
          { titleAr: 'تلخيص النص', titleEn: 'Summarising text', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'قواعد النحو الأساسية',
        titleEn: 'Basic grammar rules',
        band: 'builders',
        lessons: [
          { titleAr: 'الجملة الاسمية', titleEn: 'Nominal sentence', durationMinutes: 6 },
          { titleAr: 'الجملة الفعلية', titleEn: 'Verbal sentence', durationMinutes: 8 },
          { titleAr: 'المبتدأ والخبر', titleEn: 'Subject and predicate', durationMinutes: 8 },
          { titleAr: 'الفاعل والمفعول', titleEn: 'Agent and object', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'الإملاء والكتابة',
        titleEn: 'Spelling and writing',
        band: 'builders',
        lessons: [
          { titleAr: 'قواعد الإملاء', titleEn: 'Spelling rules', durationMinutes: 6 },
          { titleAr: 'كتابة فقرة', titleEn: 'Writing a paragraph', durationMinutes: 10 },
          { titleAr: 'التشكيل والحركات', titleEn: 'Diacritics', durationMinutes: 8 },
          { titleAr: 'تطبيقات الكتابة', titleEn: 'Writing practice', durationMinutes: 10 },
        ],
      },
    ],
  },
  {
    nameAr: 'اللغة الإنجليزية',
    nameEn: 'English',
    slug: 'english',
    icon: '🌐',
    color: '#D97706',
    units: [
      {
        titleAr: 'أحرف الأبجدية الإنجليزية',
        titleEn: 'The English alphabet',
        band: 'explorers',
        lessons: [
          { titleAr: 'الحروف A–F', titleEn: 'Letters A–F', durationMinutes: 6, isFreeSample: true },
          { titleAr: 'الحروف G–L', titleEn: 'Letters G–L', durationMinutes: 6 },
          { titleAr: 'الحروف M–R', titleEn: 'Letters M–R', durationMinutes: 6 },
          { titleAr: 'الحروف S–Z', titleEn: 'Letters S–Z', durationMinutes: 6 },
        ],
      },
      {
        titleAr: 'الكلمات الأولى بالإنجليزية',
        titleEn: 'My first English words',
        band: 'explorers',
        lessons: [
          { titleAr: 'الألوان', titleEn: 'Colors', durationMinutes: 8 },
          { titleAr: 'الأرقام', titleEn: 'Numbers', durationMinutes: 8 },
          { titleAr: 'الحيوانات', titleEn: 'Animals', durationMinutes: 8 },
          { titleAr: 'الفواكه', titleEn: 'Fruits', durationMinutes: 8 },
        ],
      },
      {
        titleAr: 'جمل بسيطة بالإنجليزية',
        titleEn: 'Simple English sentences',
        band: 'builders',
        lessons: [
          { titleAr: 'I am / You are', titleEn: 'I am / You are', durationMinutes: 8, isFreeSample: true },
          { titleAr: 'أسئلة بسيطة', titleEn: 'Simple questions', durationMinutes: 8 },
          { titleAr: 'الوصف بالإنجليزية', titleEn: 'Describing in English', durationMinutes: 10 },
          { titleAr: 'قصة قصيرة', titleEn: 'Short story', durationMinutes: 10 },
        ],
      },
    ],
  },
  {
    nameAr: 'العلوم',
    nameEn: 'Science',
    slug: 'science',
    icon: '🔬',
    color: '#7C3AED',
    units: [
      {
        titleAr: 'الكائنات الحية',
        titleEn: 'Living things',
        band: 'explorers',
        lessons: [
          { titleAr: 'ما هي الكائنات الحية؟', titleEn: 'What are living things?', durationMinutes: 6, isFreeSample: true },
          { titleAr: 'النباتات', titleEn: 'Plants', durationMinutes: 8 },
          { titleAr: 'الحيوانات', titleEn: 'Animals', durationMinutes: 8 },
          { titleAr: 'البيئة والكائنات', titleEn: 'Environment and living things', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'المادة وخصائصها',
        titleEn: 'Matter and its properties',
        band: 'explorers',
        lessons: [
          { titleAr: 'الصلب والسائل والغاز', titleEn: 'Solid, liquid, gas', durationMinutes: 6 },
          { titleAr: 'خصائص المواد', titleEn: 'Properties of matter', durationMinutes: 8 },
          { titleAr: 'تغيرات المادة', titleEn: 'Changes of matter', durationMinutes: 8 },
          { titleAr: 'تجربة علمية', titleEn: 'Science experiment', durationMinutes: 10 },
        ],
      },
      {
        titleAr: 'الجسم البشري',
        titleEn: 'The human body',
        band: 'builders',
        lessons: [
          { titleAr: 'أجهزة الجسم', titleEn: 'Body systems', durationMinutes: 8, isFreeSample: true },
          { titleAr: 'الجهاز الهضمي', titleEn: 'Digestive system', durationMinutes: 8 },
          { titleAr: 'الجهاز التنفسي', titleEn: 'Respiratory system', durationMinutes: 8 },
          { titleAr: 'الصحة والنظافة', titleEn: 'Health and hygiene', durationMinutes: 10 },
        ],
      },
    ],
  },
];

async function seedCurriculum() {
  console.log('Seeding learning curriculum...');

  for (let sIdx = 0; sIdx < CURRICULUM.length; sIdx++) {
    const subjectDef = CURRICULUM[sIdx];

    // Upsert subject by slug
    const subject = await prisma.lrnSubject.upsert({
      where: { slug: subjectDef.slug },
      create: {
        nameAr: subjectDef.nameAr,
        nameEn: subjectDef.nameEn,
        slug: subjectDef.slug,
        icon: subjectDef.icon,
        color: subjectDef.color,
        position: sIdx,
      },
      update: {
        nameAr: subjectDef.nameAr,
        nameEn: subjectDef.nameEn,
        icon: subjectDef.icon,
        color: subjectDef.color,
        position: sIdx,
      },
    });

    // Band-position counters per band within this subject
    const bandPositions: Record<string, number> = {};

    for (const unitDef of subjectDef.units) {
      const bandPos = (bandPositions[unitDef.band] = (bandPositions[unitDef.band] ?? -1) + 1);

      // Upsert unit by subject + band + title (best available natural key)
      const existingUnit = await prisma.lrnUnit.findFirst({
        where: { subjectId: subject.id, band: unitDef.band, titleEn: unitDef.titleEn },
      });

      const unit = existingUnit
        ? await prisma.lrnUnit.update({
            where: { id: existingUnit.id },
            data: { position: bandPos, status: 'published' },
          })
        : await prisma.lrnUnit.create({
            data: {
              subjectId: subject.id,
              band: unitDef.band,
              titleAr: unitDef.titleAr,
              titleEn: unitDef.titleEn,
              position: bandPos,
              status: 'published',
            },
          });

      for (let lIdx = 0; lIdx < unitDef.lessons.length; lIdx++) {
        const lessonDef = unitDef.lessons[lIdx];

        const existingLesson = await prisma.lrnLesson.findFirst({
          where: { unitId: unit.id, titleEn: lessonDef.titleEn },
        });

        const lesson = existingLesson
          ? await prisma.lrnLesson.update({
              where: { id: existingLesson.id },
              data: {
                position: lIdx,
                durationMinutes: lessonDef.durationMinutes,
                videoUrl: YT_VIDEOS[lIdx % YT_VIDEOS.length],
                isFreeSample: lessonDef.isFreeSample ?? false,
                status: 'published',
              },
            })
          : await prisma.lrnLesson.create({
              data: {
                unitId: unit.id,
                titleAr: lessonDef.titleAr,
                titleEn: lessonDef.titleEn,
                videoUrl: YT_VIDEOS[lIdx % YT_VIDEOS.length],
                videoType: 'youtube',
                durationMinutes: lessonDef.durationMinutes,
                position: lIdx,
                status: 'published',
                isFreeSample: lessonDef.isFreeSample ?? false,
              },
            });

        // Seed exercises only if none exist
        const exerciseCount = await prisma.lrnExercise.count({ where: { lessonId: lesson.id } });
        if (exerciseCount === 0) {
          const exercises =
            unitDef.band === 'explorers' || unitDef.band === 'builders' && unitDef.titleEn.toLowerCase().includes('arabic')
              ? explorerExercises(lIdx)
              : builderExercises();
          await prisma.lrnExercise.createMany({
            data: exercises.map((e) => ({ ...e, lessonId: lesson.id })),
          });
        }
      }
    }
  }

  await backfillEnglishLearningOptions(prisma);
  console.log('Curriculum seed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
