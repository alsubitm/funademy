import { PrismaClient, Format } from '@prisma/client';

const prisma = new PrismaClient();

const programs = [
  {
    slug: 'big-builders',
    kitCode: 'KIT-01',
    nameEn: 'Big Builders',
    nameAr: 'البنّاؤون الصغار',
    ageMin: 4,
    ageMax: 6,
    format: Format.in_person,
    color: '#FFC400',
    level: 1,
    taglineEn: 'First engineering concepts through guided LEGO® builds and stories — motor skills meet imagination.',
    taglineAr: 'أولى مفاهيم الهندسة عبر بناء نماذج LEGO® موجّهة وقصص ممتعة — مهارات حركية تلتقي بالخيال.',
    descEn:
      'Big Builders introduces children aged 4–6 to the world of engineering through storytelling and hands-on LEGO® building. Each session pairs a story with a themed model — bridges, animals, vehicles — developing fine motor skills, spatial thinking, and early math vocabulary.',
    descAr:
      'يقدّم برنامج البنّاؤون الصغار للأطفال من ٤ إلى ٦ سنوات عالم الهندسة عبر القصص والبناء العملي بمكعبات LEGO®. كل حصة تجمع بين قصة ونموذج بموضوع مختلف — جسور وحيوانات ومركبات — لتنمية المهارات الحركية الدقيقة والتفكير المكاني ومفردات الرياضيات المبكرة.',
    buildsEn: ['Story bridges & towers', 'Animal models with moving parts', 'Simple vehicles & pulleys'],
    buildsAr: ['جسور وأبراج القصص', 'نماذج حيوانات بأجزاء متحركة', 'مركبات بسيطة وبكرات'],
    termsEn: ['3 terms per year · 12 sessions each', '60-minute sessions', 'Small groups of 8–12'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'مدة الحصة ٦٠ دقيقة', 'مجموعات صغيرة ٨–١٢ طفلاً'],
    position: 1,
  },
  {
    slug: 'smartivo',
    kitCode: 'KIT-02',
    nameEn: 'Smartivo',
    nameAr: 'سمارتيفو',
    ageMin: 4,
    ageMax: 8,
    format: Format.online,
    color: '#37C8F5',
    level: 2,
    taglineEn: 'Playful screen-based logic — patterns, sequences and digital confidence for the youngest engineers.',
    taglineAr: 'منطق رقمي ممتع — أنماط وتسلسلات وثقة تقنية لأصغر المهندسين.',
    descEn:
      'Smartivo builds early computational thinking for ages 4–8 in live online classes. Kids solve pattern puzzles, sequence challenges, and interactive logic games with a live teacher and a small group — the only screen time that builds real skills.',
    descAr:
      'يبني سمارتيفو التفكير الحاسوبي المبكر للأعمار ٤–٨ في حصص مباشرة أونلاين. يحلّ الأطفال ألغاز الأنماط وتحديات التسلسل وألعاب المنطق التفاعلية مع معلّم مباشر ومجموعة صغيرة — وقت الشاشة الوحيد الذي يبني مهارات حقيقية.',
    buildsEn: ['Pattern & sequence puzzles', 'Interactive logic games', 'Early digital literacy'],
    buildsAr: ['ألغاز الأنماط والتسلسل', 'ألعاب منطق تفاعلية', 'ثقافة رقمية مبكرة'],
    termsEn: ['3 terms per year · 12 sessions each', '45-minute live sessions', 'Groups of 6–10'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'حصص مباشرة ٤٥ دقيقة', 'مجموعات من ٦–١٠'],
    position: 2,
  },
  {
    slug: 'bricks-challenge',
    kitCode: 'KIT-03',
    nameEn: 'Bricks Challenge',
    nameAr: 'تحدي المكعبات',
    ageMin: 6,
    ageMax: 10,
    format: Format.in_person,
    color: '#E5AE4A',
    level: 3,
    taglineEn: 'Real physics — gears, levers, torque and motors — through motorized models kids build themselves.',
    taglineAr: 'فيزياء حقيقية — تروس وروافع وعزم ومحركات — عبر نماذج متحركة يبنيها الأطفال بأنفسهم.',
    descEn:
      'The flagship e² Young Engineers program. Ages 6–10 build a new motorized LEGO® model every session — cranes, carousels, catapults — while learning the physics principle behind it: gear ratios, torque, center of gravity, and more.',
    descAr:
      'البرنامج الرائد لدى e² Young Engineers. يبني الأطفال من ٦ إلى ١٠ سنوات نموذج LEGO® متحركاً جديداً في كل حصة — رافعات ودوّارات ومقاليع — مع تعلّم المبدأ الفيزيائي خلفه: نسب التروس والعزم ومركز الثقل وغيرها.',
    buildsEn: ['Motorized crane & carousel', 'Catapults & racing cars', '40+ models across the year'],
    buildsAr: ['رافعة ودوّارة بمحرك', 'مقاليع وسيارات سباق', 'أكثر من ٤٠ نموذجاً خلال السنة'],
    termsEn: ['3 terms per year · 12 sessions each', '75-minute sessions @ Al Yasmin', 'Official YE kits provided'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'حصص ٧٥ دقيقة في الياسمين', 'مجموعات أدوات YE الرسمية متوفرة'],
    position: 3,
  },
  {
    slug: 'algoplay-robotoys',
    kitCode: 'KIT-04',
    nameEn: 'AlgoPlay · RoboToys',
    nameAr: 'ألجوبلاي · روبوتويز',
    ageMin: 7,
    ageMax: 11,
    format: Format.online,
    color: '#2764D6',
    level: 4,
    taglineEn: 'Algorithmic thinking and robotics logic — loops, conditions and commands through live challenges.',
    taglineAr: 'تفكير خوارزمي ومنطق روبوتات — حلقات وشروط وأوامر عبر تحديات مباشرة.',
    descEn:
      'AlgoPlay and RoboToys take ages 7–11 from play to programming. In live online sessions, kids command virtual robots, chain loops and conditions, and debug their own solutions — the bridge between building and coding.',
    descAr:
      'ينقل ألجوبلاي وروبوتويز الأطفال من ٧ إلى ١١ سنة من اللعب إلى البرمجة. في حصص مباشرة أونلاين يوجّه الأطفال روبوتات افتراضية ويربطون الحلقات والشروط ويصحّحون حلولهم بأنفسهم — الجسر بين البناء والبرمجة.',
    buildsEn: ['Virtual robot missions', 'Loop & condition challenges', 'Debugging workshops'],
    buildsAr: ['مهمات روبوت افتراضية', 'تحديات الحلقات والشروط', 'ورش تصحيح الأخطاء'],
    termsEn: ['3 terms per year · 12 sessions each', '60-minute live sessions', 'Level certificates per term'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'حصص مباشرة ٦٠ دقيقة', 'شهادة مستوى لكل فصل'],
    position: 4,
  },
  {
    slug: 'galileo-technic',
    kitCode: 'KIT-05',
    nameEn: 'Galileo Technic',
    nameAr: 'غاليليو تكنيك',
    ageMin: 8,
    ageMax: 12,
    format: Format.in_person,
    color: '#C98A1E',
    level: 4,
    taglineEn: 'Advanced mechanical engineering — complex machines for builders ready for the next challenge.',
    taglineAr: 'هندسة ميكانيكية متقدمة — آلات معقّدة للبنّائين المستعدين للتحدي التالي.',
    descEn:
      'For graduates of Bricks Challenge and ambitious builders aged 8–12. Galileo Technic tackles complex machines — differential gears, transmissions, walking mechanisms — with deeper engineering theory each session.',
    descAr:
      'لخرّيجي تحدي المكعبات والبنّائين الطموحين من ٨ إلى ١٢ سنة. يتناول غاليليو تكنيك آلات معقّدة — تروس تفاضلية وناقلات حركة وآليات مشي — مع نظرية هندسية أعمق في كل حصة.',
    buildsEn: ['Differential gear systems', 'Walking machines', 'Transmission mechanisms'],
    buildsAr: ['أنظمة تروس تفاضلية', 'آلات مشي', 'آليات نقل الحركة'],
    termsEn: ['3 terms per year · 12 sessions each', '90-minute sessions @ Al Yasmin', 'Prerequisite: Bricks Challenge or trial assessment'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'حصص ٩٠ دقيقة في الياسمين', 'المتطلب: تحدي المكعبات أو تقييم تجريبي'],
    position: 5,
  },
  {
    slug: 'algoc',
    kitCode: 'KIT-06',
    nameEn: 'AlgoC',
    nameAr: 'ألجو سي',
    ageMin: 10,
    ageMax: 15,
    format: Format.online,
    color: '#101A38',
    level: 5,
    taglineEn: 'From visual logic to written code — real programming foundations for future developers.',
    taglineAr: 'من المنطق المرئي إلى الكود المكتوب — أساسيات برمجة حقيقية لمطوّري المستقبل.',
    descEn:
      'AlgoC graduates kids aged 10–15 from blocks to real written code. Live online sessions cover variables, functions, and problem decomposition, ending each term with a coding project they present to the class.',
    descAr:
      'ينقل ألجو سي الأطفال من ١٠ إلى ١٥ سنة من المكعبات البرمجية إلى الكود الحقيقي. تغطي الحصص المباشرة المتغيرات والدوال وتفكيك المشكلات، وينتهي كل فصل بمشروع برمجي يعرضه الطالب أمام زملائه.',
    buildsEn: ['Real written code', 'Term coding projects', 'Problem decomposition skills'],
    buildsAr: ['كود برمجي حقيقي', 'مشاريع برمجية فصلية', 'مهارات تفكيك المشكلات'],
    termsEn: ['3 terms per year · 12 sessions each', '75-minute live sessions', 'Project showcase each term'],
    termsAr: ['٣ فصول في السنة · ١٢ حصة لكل فصل', 'حصص مباشرة ٧٥ دقيقة', 'عرض مشاريع نهاية كل فصل'],
    position: 6,
  },
];

// weekday: 0=Sunday .. 6=Saturday
const slotsBySlug: Record<string, { weekday: number; time: string; format: Format; location?: string; capacity: number; seatsLeft: number }[]> = {
  'big-builders': [
    { weekday: 6, time: '09:00', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 12, seatsLeft: 7 },
    { weekday: 6, time: '12:00', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 12, seatsLeft: 9 },
  ],
  smartivo: [
    { weekday: 0, time: '17:00', format: Format.online, capacity: 10, seatsLeft: 3 },
    { weekday: 2, time: '17:00', format: Format.online, capacity: 10, seatsLeft: 6 },
  ],
  'bricks-challenge': [
    { weekday: 6, time: '10:30', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 12, seatsLeft: 4 },
    { weekday: 6, time: '14:00', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 12, seatsLeft: 8 },
  ],
  'algoplay-robotoys': [
    { weekday: 1, time: '17:30', format: Format.online, capacity: 10, seatsLeft: 0 },
    { weekday: 3, time: '17:00', format: Format.online, capacity: 10, seatsLeft: 2 },
  ],
  'galileo-technic': [
    { weekday: 6, time: '16:00', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 10, seatsLeft: 6 },
    { weekday: 4, time: '17:30', format: Format.in_person, location: 'Al Yasmin partner school', capacity: 10, seatsLeft: 9 },
  ],
  algoc: [
    { weekday: 2, time: '18:00', format: Format.online, capacity: 10, seatsLeft: 5 },
    { weekday: 0, time: '18:30', format: Format.online, capacity: 10, seatsLeft: 7 },
  ],
};

const testimonials = [
  {
    name: 'Um Khalid',
    nameAr: 'أم خالد',
    area: 'An Narjis',
    programEn: 'Bricks Challenge',
    programAr: 'تحدي المكعبات',
    quoteEn: 'My son built a motorized crane in his third class and explained gears to me at dinner. I was speechless.',
    quoteAr: 'ابني بنى رافعة بمحرك في حصته الثالثة وشرح لي التروس على العشاء. لم أجد كلمات.',
    position: 1,
  },
  {
    name: 'Abu Lama',
    nameAr: 'أبو لمى',
    area: 'Al Sahafah',
    programEn: 'AlgoPlay Online',
    programAr: 'ألجوبلاي أونلاين',
    quoteEn: "The online AlgoPlay class is the only screen time I don't feel guilty about. Live teacher, small group, real learning.",
    quoteAr: 'حصة ألجوبلاي أونلاين هي وقت الشاشة الوحيد الذي لا أشعر بالذنب تجاهه. معلّم مباشر ومجموعة صغيرة وتعلّم حقيقي.',
    position: 2,
  },
  {
    name: 'Um Yara',
    nameAr: 'أم يارا',
    area: 'Al Yasmin',
    programEn: 'Smartivo',
    programAr: 'سمارتيفو',
    quoteEn: 'She started at Smartivo age 5. The path to real coding at 10 is exactly why we chose Young Engineers.',
    quoteAr: 'بدأت في سمارتيفو بعمر ٥ سنوات. المسار الواضح نحو البرمجة الحقيقية بعمر ١٠ هو سبب اختيارنا للمهندسين الصغار.',
    position: 3,
  },
];

const faqs = [
  {
    questionEn: "Which program is right for my child's age?",
    questionAr: 'أي برنامج يناسب عمر طفلي؟',
    answerEn:
      'Follow the Learning Path: ages 4–6 start with Big Builders or Smartivo, 6–10 with Bricks Challenge, 7–11 with AlgoPlay/RoboToys, 8–12 with Galileo Technic, and 10–15 with AlgoC. The free trial confirms the perfect fit.',
    answerAr:
      'اتبع مسار التعلّم: الأعمار ٤–٦ تبدأ بالبنّائين الصغار أو سمارتيفو، و٦–١٠ بتحدي المكعبات، و٧–١١ بألجوبلاي/روبوتويز، و٨–١٢ بغاليليو تكنيك، و١٠–١٥ بألجو سي. الحصة التجريبية المجانية تؤكد الاختيار الأنسب.',
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
    questionEn: 'Where do in-person classes take place?',
    questionAr: 'أين تُقام الحصص الحضورية؟',
    answerEn: 'At our partner school in Al Yasmin, North Riyadh — serving families across the 9 neighborhoods of our territory. Online programs are open to all of Riyadh North.',
    answerAr: 'في مدرستنا الشريكة بحي الياسمين شمال الرياض — نخدم العائلات في الأحياء التسعة ضمن نطاقنا. البرامج الأونلاين متاحة لكل شمال الرياض.',
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
    answerEn: 'Online programs are SAR 330/month and in-person SAR 380/month, each with one class per week. Families with 2+ children get 10% off every subscription.',
    answerAr: 'البرامج الأونلاين ٣٣٠ ريالاً شهرياً والحضورية ٣٨٠ ريالاً شهرياً، بواقع حصة أسبوعياً. العائلات التي لديها طفلان أو أكثر تحصل على خصم ١٠٪ على كل اشتراك.',
    position: 6,
  },
];

async function main() {
  console.log('Seeding YE database…');

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
