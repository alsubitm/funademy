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
    termsEn: ['45-minute sessions', 'Class cap: 12 kids', 'In-person'],
    termsAr: ['مدة الحصة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'حضوري'],
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
      'Smartivo builds early computational thinking for ages 4–6 in live 45-minute classes, online or in person. Kids solve pattern puzzles, sequence challenges, and interactive logic games with a live teacher and a small group.',
    descAr:
      'يبني سمارتيفو التفكير الحاسوبي المبكر للأعمار ٤–٦ في حصص مباشرة مدتها ٤٥ دقيقة، أونلاين أو حضورياً. يحلّ الأطفال ألغاز الأنماط وتحديات التسلسل وألعاب المنطق التفاعلية مع معلّم مباشر ومجموعة صغيرة.',
    buildsEn: ['Pattern & sequence puzzles', 'Interactive logic games', 'Early digital literacy'],
    buildsAr: ['ألغاز الأنماط والتسلسل', 'ألعاب منطق تفاعلية', 'ثقافة رقمية مبكرة'],
    termsEn: ['45-minute live sessions', 'Class cap: 12 kids', 'Live online / in-person'],
    termsAr: ['حصص مباشرة ٤٥ دقيقة', 'الحد الأقصى ١٢ طفلاً', 'مباشر أونلاين / حضوري'],
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
    termsEn: ['75-minute sessions', 'Class cap: 16 kids', 'In-person'],
    termsAr: ['حصص ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري'],
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
      'ينقل ألجوبلاي الأطفال من ٦ إلى ١٠ سنوات من اللعب إلى البرمجة. في حصص مباشرة أونلاين (٧٥ دقيقة) يوجّه الأطفال روبوتات افتراضية ويربطون الحلقات والشروط ويصحّحون حلولهم بأنفسهم — الجسر بين البناء والبرمجة.',
    buildsEn: ['Virtual robot missions', 'Loop & condition challenges', 'Debugging workshops'],
    buildsAr: ['مهمات روبوت افتراضية', 'تحديات الحلقات والشروط', 'ورش تصحيح الأخطاء'],
    termsEn: ['75-minute live sessions', 'Class cap: 16 kids', 'Live online'],
    termsAr: ['حصص مباشرة ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'مباشر أونلاين'],
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
    termsEn: ['75-minute sessions', 'Class cap: 16 kids', 'In-person'],
    termsAr: ['حصص ٧٥ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'حضوري'],
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
      'ينقل روبوتويز الأعمار ٩–١٢ إلى الروبوتات المتقدمة في حصص مباشرة أونلاين (٩٠ دقيقة) — مشاريع أغنى ومنطق أذكى وحسّاسات وحلّ مشكلات حقيقي يمهّد للكود المكتوب.',
    buildsEn: ['Sensor-driven robots', 'Multi-step missions', 'Smart logic projects'],
    buildsAr: ['روبوتات بحسّاسات', 'مهمات متعددة الخطوات', 'مشاريع منطق ذكية'],
    termsEn: ['90-minute live sessions', 'Class cap: 16 kids', 'Live online'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', 'الحد الأقصى ١٦ طفلاً', 'مباشر أونلاين'],
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
      'ينقل ألجو سي المراهقين من ١٣ إلى ١٨ سنة من المكعبات البرمجية إلى الكود الحقيقي. حصص مباشرة أونلاين (٩٠ دقيقة) — ٨ طلاب كحد أقصى — تغطي المتغيرات والدوال وتفكيك المشكلات، وينتهي كل فصل بمشروع برمجي يعرضه الطالب أمام زملائه.',
    buildsEn: ['Real written code', 'Term coding projects', 'Problem decomposition skills'],
    buildsAr: ['كود برمجي حقيقي', 'مشاريع برمجية فصلية', 'مهارات تفكيك المشكلات'],
    termsEn: ['90-minute live sessions', 'Class cap: 8 students', 'Live online'],
    termsAr: ['حصص مباشرة ٩٠ دقيقة', '٨ طلاب كحد أقصى', 'مباشر أونلاين'],
    position: 7,
  },
];

// weekday: 0=Sunday .. 6=Saturday — 14 slots.
// Evening online slots match program durations (45/75/90); Saturday mornings
// in-person for the three building programs.
const slotsBySlug: Record<string, { weekday: number; time: string; format: Format; location?: string; capacity: number; seatsLeft: number }[]> = {
  'big-builders': [
    { weekday: 6, time: '09:00', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 12, seatsLeft: 7 },
    { weekday: 6, time: '10:00', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 12, seatsLeft: 2 },
  ],
  smartivo: [
    { weekday: 0, time: '17:00', format: Format.online, capacity: 12, seatsLeft: 5 },
    { weekday: 2, time: '17:00', format: Format.online, capacity: 12, seatsLeft: 3 },
    { weekday: 6, time: '09:00', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 12, seatsLeft: 6 },
  ],
  'bricks-challenge': [
    { weekday: 6, time: '10:30', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 16, seatsLeft: 3 },
    { weekday: 6, time: '12:00', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 16, seatsLeft: 9 },
  ],
  algoplay: [
    { weekday: 1, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 6 },
    { weekday: 3, time: '17:30', format: Format.online, capacity: 16, seatsLeft: 2 },
  ],
  'galileo-technic': [
    { weekday: 6, time: '11:45', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 16, seatsLeft: 8 },
    { weekday: 4, time: '17:30', format: Format.in_person, location: 'Partner school, Riyadh', capacity: 16, seatsLeft: 11 },
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
    area: 'Riyadh',
    programEn: 'Bricks Challenge',
    programAr: 'تحدي المكعبات',
    quoteEn: 'My son built a motorized crane in his third class and explained gears to me at dinner. I was speechless.',
    quoteAr: 'ابني بنى رافعة بمحرك في حصته الثالثة وشرح لي التروس على العشاء. لم أجد كلمات.',
    position: 1,
  },
  {
    name: 'Abu Lama',
    nameAr: 'أبو لمى',
    area: 'Riyadh',
    programEn: 'AlgoPlay',
    programAr: 'ألجوبلاي',
    quoteEn: "The live AlgoPlay class is the only screen time I don't feel guilty about. Live teacher, small group, real learning.",
    quoteAr: 'حصة ألجوبلاي المباشرة هي وقت الشاشة الوحيد الذي لا أشعر بالذنب تجاهه. معلّم مباشر ومجموعة صغيرة وتعلّم حقيقي.',
    position: 2,
  },
  {
    name: 'Um Yara',
    nameAr: 'أم يارا',
    area: 'Riyadh',
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
    questionEn: 'Are classes online or in person?',
    questionAr: 'هل الحصص أونلاين أم حضورية؟',
    answerEn:
      'Both. The building programs (Big Builders, Bricks Challenge, Galileo Technic) run in person in Riyadh, coding programs (AlgoPlay, RoboToys, AlgoC) run live online, and Smartivo is available both ways. Online classes are open to everyone.',
    answerAr:
      'كلاهما. برامج البناء (البنّاؤون الصغار، تحدي المكعبات، غاليليو تكنيك) حضورية في الرياض، وبرامج البرمجة (ألجوبلاي، روبوتويز، ألجو سي) مباشرة أونلاين، وسمارتيفو متاح بالطريقتين. الحصص الأونلاين متاحة للجميع.',
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
    answerEn: 'In-person programs use official e² Young Engineers kits provided in class. Online programs include guidance on the kit needed at home.',
    answerAr: 'البرامج الحضورية تستخدم مجموعات e² Young Engineers الرسمية المتوفرة في الحصة. البرامج الأونلاين تشمل إرشادات حول المجموعة المطلوبة في المنزل.',
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
