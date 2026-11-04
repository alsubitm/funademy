import type { LessonRules } from '@/lib/lesson-engine';

/** Bilingual string. Technical numbers (axle 12, axle 6) are kept as digits in both languages. */
export interface L { en: string; ar: string }
export interface Rect { x: number; y: number; w: number; h: number }
export interface PieceSpec { name: L; qty: number }

export interface LessonStep {
  /** Engine fields */
  id: string;
  partSetId: string;
  targetId: string;
  /** Content fields */
  number: number;
  title: L;
  instruction: L;
  pieces: PieceSpec[];
  engineeringNote: L;
  hint: L;
  /** Where the cyan dashed placement target is drawn on the build mat (model coordinates). */
  target: Rect;
  /** Which original SVG layer this step adds, and the layer's own bounding box (used for tray thumbnails). */
  svgLayer: { id: string; bbox: Rect };
  /** What "done" means for this step, shown after a correct placement. */
  completion: L;
  /** Source guide page (PDF page number, cover = 1). */
  pdfPage: number;
}

export interface Lesson extends LessonRules {
  code: string;
  program: L;
  title: L;
  objective: L;
  steps: readonly LessonStep[];
  /** Deterministic tray shuffle so children have to look, not just tap the first card. */
  trayOrder: readonly number[];
  /** Model coordinates for the build mat. */
  viewBox: Rect;
  /** Layers that sit on the separate motor platform before step 11 joins it to the tower. */
  detachedLayers: readonly string[];
  detachedOffset: { x: number; y: number };
  joinStepId: string;
  transmissionNote: L;
}

const p = (en: string, ar: string, qty: number): PieceSpec => ({ name: { en, ar }, qty });

export const windmillLesson: Lesson = {
  id: 'ye-bc-013-windmill',
  version: 1,
  code: 'BC.013',
  program: { en: 'Bricks Challenge', ar: 'Bricks Challenge' },
  title: { en: 'Build the Windmill', ar: 'ابنِ طاحونة الهواء' },
  objective: {
    en: 'Build the brick model step by step, then power the motor to see how a small gear drives the windmill.',
    ar: 'ابنِ نموذج القطع خطوة بخطوة، ثم شغّل المحرك لترى كيف يقود الترس الصغير طاحونة الهواء.',
  },
  // Illustrative schematic ratio — the BC.013 guide does not print tooth counts.
  transmission: { driverTeeth: 12, drivenTeeth: 36, driverRpm: 30 },
  transmissionNote: {
    en: 'Teaching schematic: tooth counts are illustrative. The printed guide does not list the exact kit gear teeth.',
    ar: 'رسم تعليمي: أعداد الأسنان توضيحية، فدليل البناء المطبوع لا يذكر أعداد أسنان تروس العُدّة بدقة.',
  },
  viewBox: { x: 20, y: 104, w: 640, h: 356 },
  detachedLayers: ['motor-base', 'motor'],
  detachedOffset: { x: 62, y: 0 },
  joinStepId: 's11-mesh',
  trayOrder: [7, 3, 12, 1, 10, 5, 14, 2, 9, 6, 13, 4, 11, 8],
  steps: [
    {
      id: 's01-foundation', partSetId: 'set-01', targetId: 't-01', number: 1, pdfPage: 2,
      title: { en: 'Foundation', ar: 'القاعدة' },
      instruction: {
        en: 'Lay the grey base plate, then build the red U-shaped frame with the green brick at the back.',
        ar: 'ضع لوح القاعدة الرمادي، ثم ابنِ الإطار الأحمر على شكل حرف U مع القطعة الخضراء في الخلف.',
      },
      pieces: [p('Grey studded base plate', 'لوح قاعدة رمادي بنتوءات', 1), p('Red bricks with holes', 'طوب أحمر مثقوب', 5), p('Green brick', 'طوبة خضراء', 1)],
      engineeringNote: {
        en: 'A wide, flat base spreads the weight so the windmill will not tip when the blades spin.',
        ar: 'القاعدة العريضة توزّع الوزن، فلا تنقلب الطاحونة عندما تدور الشفرات.',
      },
      hint: { en: 'Find the card with the big grey plate. The cyan box is at the bottom of the mat.', ar: 'ابحث عن البطاقة التي فيها اللوح الرمادي الكبير. المربع السماوي في أسفل لوحة البناء.' },
      target: { x: 46, y: 370, w: 276, h: 88 },
      svgLayer: { id: 'foundation', bbox: { x: 46, y: 370, w: 276, h: 88 } },
      completion: { en: 'Base plate and U-frame are locked.', ar: 'ثُبّتت القاعدة والإطار.' },
    },
    {
      id: 's02-braces', partSetId: 'set-02', targetId: 't-02', number: 2, pdfPage: 2,
      title: { en: 'Green braces', ar: 'الدعامات الخضراء' },
      instruction: {
        en: 'Stand two green braces on their small red supports inside the frame.',
        ar: 'ثبّت دعامتين خضراوين فوق قطعتيهما الحمراوين الصغيرتين داخل الإطار.',
      },
      pieces: [p('Tall green braces', 'دعامات خضراء طويلة', 2), p('Red support plates', 'ألواح دعم حمراء', 2)],
      engineeringNote: {
        en: 'Upright braces carry the load straight down into the base, like columns in a building.',
        ar: 'الدعامات الرأسية تنقل الحِمل مباشرة إلى القاعدة، مثل أعمدة المبنى.',
      },
      hint: { en: 'Two green pieces standing side by side.', ar: 'قطعتان خضراوان واقفتان جنبًا إلى جنب.' },
      target: { x: 100, y: 372, w: 160, h: 70 },
      svgLayer: { id: 'braces', bbox: { x: 100, y: 372, w: 160, h: 70 } },
      completion: { en: 'Both braces stand straight.', ar: 'الدعامتان واقفتان باستقامة.' },
    },
    {
      id: 's03-platform', partSetId: 'set-03', targetId: 't-03', number: 3, pdfPage: 2,
      title: { en: 'Bridge platform', ar: 'منصة الجسر' },
      instruction: { en: 'Bridge the two braces with the red studded platform.', ar: 'اربط الدعامتين بالمنصة الحمراء ذات النتوءات.' },
      pieces: [p('Red studded plates', 'ألواح حمراء بنتوءات', 2)],
      engineeringNote: {
        en: 'A plate across two supports makes a bridge. It locks the braces together so they cannot spread apart.',
        ar: 'اللوح الممتد فوق دعامتين يصنع جسرًا يربطهما، فلا تتباعدان.',
      },
      hint: { en: 'A flat red piece covered in studs.', ar: 'قطعة حمراء مسطّحة مليئة بالنتوءات.' },
      target: { x: 76, y: 356, w: 216, h: 32 },
      svgLayer: { id: 'platform', bbox: { x: 76, y: 356, w: 216, h: 32 } },
      completion: { en: 'The bridge joins both braces.', ar: 'الجسر يربط الدعامتين.' },
    },
    {
      id: 's04-course', partSetId: 'set-04', targetId: 't-04', number: 4, pdfPage: 2,
      title: { en: 'Second red course', ar: 'الصف الأحمر الثاني' },
      instruction: { en: 'Stack the second row of red bricks on the platform.', ar: 'ركّب الصف الثاني من الطوب الأحمر فوق المنصة.' },
      pieces: [p('Thick red bricks', 'طوب أحمر سميك', 2)],
      engineeringNote: {
        en: 'Each brick covers the seam below it. Staggered joints make a wall stronger.',
        ar: 'كل طوبة تغطي الفاصل الذي تحتها، وتبادل الفواصل يجعل الجدار أقوى.',
      },
      hint: { en: 'Two thick red bricks placed end to end.', ar: 'طوبتان حمراوان سميكتان متجاورتان.' },
      target: { x: 76, y: 322, w: 216, h: 50 },
      svgLayer: { id: 'course', bbox: { x: 76, y: 322, w: 216, h: 50 } },
      completion: { en: 'The second course is level.', ar: 'الصف الثاني مستوٍ.' },
    },
    {
      id: 's05-housing', partSetId: 'set-05', targetId: 't-05', number: 5, pdfPage: 3,
      title: { en: 'Axle housing', ar: 'حاضنة المحور' },
      instruction: { en: 'Add the green perforated housing. Its holes will hold the main axle.', ar: 'أضف الحاضنة الخضراء المثقوبة؛ ثقوبها ستحمل المحور الرئيسي.' },
      pieces: [p('Green perforated bricks', 'طوب أخضر مثقوب', 4), p('Red corner plates', 'ألواح زوايا حمراء', 2)],
      engineeringNote: {
        en: 'Holes in a brick act as bearings: the axle can spin inside them without wobbling.',
        ar: 'الثقوب في الطوبة تعمل كمحامل، فيدور المحور داخلها دون أن يتمايل.',
      },
      hint: { en: 'A green frame with round holes along its sides.', ar: 'إطار أخضر على جوانبه ثقوب دائرية.' },
      target: { x: 96, y: 286, w: 176, h: 54 },
      svgLayer: { id: 'housing', bbox: { x: 96, y: 286, w: 176, h: 54 } },
      completion: { en: 'The housing is ready for an axle.', ar: 'الحاضنة جاهزة لاستقبال المحور.' },
    },
    {
      id: 's06-axle12', partSetId: 'set-06', targetId: 't-06', number: 6, pdfPage: 3,
      title: { en: 'Upper tower and axle 12', ar: 'أعلى البرج والمحور 12' },
      instruction: {
        en: 'Build the alternating green and red courses, then slide the long black axle 12 through the holes.',
        ar: 'ابنِ الصفوف الخضراء والحمراء بالتناوب، ثم أدخِل المحور الأسود الطويل 12 عبر الثقوب.',
      },
      pieces: [p('Green bricks', 'طوب أخضر', 4), p('Red bricks', 'طوب أحمر', 4), p('Black cross axle, length 12', 'محور أسود متصالب، طول 12', 1)],
      engineeringNote: {
        en: 'The axle has a cross-shaped end, so every part slid onto it has to turn with it.',
        ar: 'مقطع المحور على شكل علامة +، لذلك كل قطعة تُركَّب عليه تدور معه.',
      },
      hint: { en: 'Look for the long black axle marked 12.', ar: 'ابحث عن المحور الأسود الطويل المكتوب عليه 12.' },
      target: { x: 108, y: 186, w: 290, h: 120 },
      svgLayer: { id: 'upper', bbox: { x: 108, y: 186, w: 290, h: 120 } },
      completion: { en: 'Axle 12 runs through the tower.', ar: 'المحور 12 يمرّ عبر البرج.' },
    },
    {
      id: 's07-gears', partSetId: 'set-07', targetId: 't-07', number: 7, pdfPage: 4,
      title: { en: 'Gears on the axle', ar: 'التروس على المحور' },
      instruction: {
        en: 'Slide the large grey gear, the small grey gear and the bushes onto the back of the main axle.',
        ar: 'أدخِل الترس الرمادي الكبير والترس الصغير والجُلَب في الطرف الخلفي من المحور الرئيسي.',
      },
      pieces: [p('Large grey gear', 'ترس رمادي كبير', 1), p('Small grey gear', 'ترس رمادي صغير', 1), p('Axle bushes', 'جُلَب المحور', 2)],
      engineeringNote: {
        en: 'Bushes stop parts sliding off the axle but still let it spin freely.',
        ar: 'الجُلَب تمنع القطع من الانزلاق عن المحور، وتتركه يدور بحرية.',
      },
      hint: { en: 'Grey wheels with teeth. They go on the gear side of the tower.', ar: 'عجلات رمادية لها أسنان، مكانها في جهة التروس من البرج.' },
      target: { x: 262, y: 144, w: 150, h: 138 },
      svgLayer: { id: 'gears', bbox: { x: 262, y: 144, w: 150, h: 138 } },
      completion: { en: 'Both gears sit on the main axle.', ar: 'الترسان على المحور الرئيسي.' },
    },
    {
      id: 's08-hub', partSetId: 'set-08', targetId: 't-08', number: 8, pdfPage: 4,
      title: { en: 'Rotor hub', ar: 'محور الدوّار' },
      instruction: {
        en: 'Fix the red four-arm hub on the front of the axle, opposite the gears.',
        ar: 'ثبّت الصليب الأحمر ذا الأذرع الأربع في مقدمة المحور، في الجهة المقابلة للتروس.',
      },
      pieces: [p('Red studded arm plates', 'ألواح أذرع حمراء بنتوءات', 2), p('Hub connector', 'وصلة المحور', 1)],
      engineeringNote: { en: 'Four equal arms keep the rotor balanced so it spins smoothly.', ar: 'الأذرع الأربع المتساوية تحفظ توازن الدوّار فيدور بسلاسة.' },
      hint: { en: 'A red cross shape.', ar: 'قطعة حمراء على شكل صليب.' },
      target: { x: 104, y: 178, w: 124, h: 124 },
      svgLayer: { id: 'hub', bbox: { x: 104, y: 178, w: 124, h: 124 } },
      completion: { en: 'The hub is fixed to the axle.', ar: 'ثُبّت الصليب على المحور.' },
    },
    {
      id: 's09-motor-base', partSetId: 'set-09', targetId: 't-09', number: 9, pdfPage: 5,
      title: { en: 'Motor platform', ar: 'منصة المحرك' },
      instruction: {
        en: 'Build the separate red and green base plate, then stack the yellow and grey perforated beams.',
        ar: 'ابنِ لوح القاعدة الأحمر والأخضر المنفصل، ثم رُصّ فوقه العوارض الصفراء والرمادية المثقوبة.',
      },
      pieces: [p('Red and green plates', 'ألواح حمراء وخضراء', 4), p('Yellow perforated beams', 'عوارض صفراء مثقوبة', 2), p('Dark grey perforated beam', 'عارضة رمادية داكنة مثقوبة', 1)],
      engineeringNote: { en: 'Building the motor on its own platform lets you check it before joining.', ar: 'بناء المحرك على منصة مستقلة يتيح فحصه قبل تركيبه.' },
      hint: { en: 'Striped yellow and dark grey beams. The cyan box is on the right, away from the tower.', ar: 'عوارض صفراء ورمادية متتالية. المربع السماوي على اليمين بعيدًا عن البرج.' },
      target: { x: 448, y: 290, w: 196, h: 150 },
      svgLayer: { id: 'motor-base', bbox: { x: 386, y: 290, w: 196, h: 150 } },
      completion: { en: 'The motor platform stands on its own.', ar: 'منصة المحرك قائمة وحدها.' },
    },
    {
      id: 's10-motor', partSetId: 'set-10', targetId: 't-10', number: 10, pdfPage: 5,
      title: { en: 'Motor and drive gear', ar: 'المحرك وترس القيادة' },
      instruction: {
        en: 'Mount the grey motor, push the short axle 6 into it and add the small drive gear.',
        ar: 'ركّب المحرك الرمادي، وأدخِل المحور القصير 6 فيه، ثم أضف ترس القيادة الصغير.',
      },
      pieces: [p('Electric motor', 'محرك كهربائي', 1), p('Cross axle, length 6', 'محور متصالب، طول 6', 1), p('Small drive gear', 'ترس قيادة صغير', 1)],
      engineeringNote: { en: 'The motor makes the turning force. The small gear is where that force leaves the motor.', ar: 'المحرك يصنع قوة الدوران، والترس الصغير هو مخرج هذه القوة.' },
      hint: { en: 'The grey cylinder with a short axle.', ar: 'الأسطوانة الرمادية ذات المحور القصير.' },
      target: { x: 430, y: 226, w: 206, h: 80 },
      svgLayer: { id: 'motor', bbox: { x: 368, y: 226, w: 206, h: 80 } },
      completion: { en: 'Motor, axle 6 and drive gear are mounted.', ar: 'رُكّب المحرك والمحور 6 وترس القيادة.' },
    },
    {
      id: 's11-mesh', partSetId: 'set-11', targetId: 't-11', number: 11, pdfPage: 6,
      title: { en: 'Mesh the gears', ar: 'تعشيق التروس' },
      instruction: {
        en: 'Slide the motor platform to the tower until the small gear teeth mesh with the large gear.',
        ar: 'قرّب منصة المحرك من البرج حتى تتداخل أسنان الترس الصغير مع أسنان الترس الكبير.',
      },
      pieces: [p('Red connector bricks', 'طوب ربط أحمر', 2), p('Green joining plate', 'لوح ربط أخضر', 1)],
      engineeringNote: { en: 'Meshed gears always turn in opposite directions.', ar: 'الترسان المتعشّقان يدوران دائمًا في اتجاهين متعاكسين.' },
      hint: { en: 'The cyan box is in the gap between the tower and the motor.', ar: 'المربع السماوي في الفراغ بين البرج والمحرك.' },
      target: { x: 296, y: 248, w: 110, h: 196 },
      svgLayer: { id: 'join', bbox: { x: 296, y: 394, w: 110, h: 50 } },
      completion: { en: 'The teeth are meshed. Motion can now travel.', ar: 'تعشّقت الأسنان، ويمكن للحركة أن تنتقل الآن.' },
    },
    {
      id: 's12-supports', partSetId: 'set-12', targetId: 't-12', number: 12, pdfPage: 6,
      title: { en: 'Yellow supports', ar: 'الدعامات الصفراء' },
      instruction: { en: 'Add the two yellow curved foot supports and the red end pieces.', ar: 'أضف الدعامتين الصفراوين المنحنيتين والقطعتين الحمراوين في الطرف.' },
      pieces: [p('Yellow curved slopes', 'منحدرات صفراء منحنية', 2), p('Red end pieces', 'قطع طرفية حمراء', 2)],
      engineeringNote: { en: 'Curved supports widen the footprint so the motor cannot rock backwards.', ar: 'الدعامات المنحنية توسّع مساحة الارتكاز فلا يهتز المحرك للخلف.' },
      hint: { en: 'Two curved yellow pieces.', ar: 'قطعتان صفراوان منحنيتان.' },
      target: { x: 386, y: 290, w: 232, h: 160 },
      svgLayer: { id: 'supports', bbox: { x: 386, y: 290, w: 232, h: 160 } },
      completion: { en: 'The motor platform is braced.', ar: 'منصة المحرك مسنودة.' },
    },
    {
      id: 's13-finish', partSetId: 'set-13', targetId: 't-13', number: 13, pdfPage: 7,
      title: { en: 'Blue slopes and top cap', ar: 'المنحدرات الزرقاء والغطاء' },
      instruction: { en: 'Lock the tower feet with the blue slopes and close the top with the red cap.', ar: 'ثبّت أقدام البرج بالمنحدرات الزرقاء، وأغلق القمة بالغطاء الأحمر.' },
      pieces: [p('Blue slope bricks', 'طوب أزرق مائل', 2), p('Red top bricks', 'طوب أحمر للقمة', 3)],
      engineeringNote: { en: 'Slopes brace the tower from the side, like a buttress on a wall.', ar: 'المنحدرات تسند البرج من الجانب، مثل الدعامات على الجدار.' },
      hint: { en: 'Blue pieces with a slanted top.', ar: 'قطع زرقاء سطحها مائل.' },
      target: { x: 48, y: 170, w: 226, h: 276 },
      svgLayer: { id: 'finish', bbox: { x: 48, y: 170, w: 226, h: 276 } },
      completion: { en: 'Feet locked and top capped.', ar: 'ثُبّتت الأقدام وأُغلقت القمة.' },
    },
    {
      id: 's14-blades', partSetId: 'set-14', targetId: 't-14', number: 14, pdfPage: 7,
      title: { en: 'Windmill blades', ar: 'شفرات الطاحونة' },
      instruction: {
        en: 'Attach the four yellow blades to the red cross, one on each arm, evenly spaced.',
        ar: 'ثبّت الشفرات الصفراء الأربع على الصليب الأحمر، شفرة على كل ذراع وبمسافات متساوية.',
      },
      pieces: [p('Yellow studded blades', 'شفرات صفراء بنتوءات', 4)],
      engineeringNote: { en: 'Equal spacing, 90 degrees apart, keeps the rotor balanced.', ar: 'التباعد المتساوي، 90 درجة بين كل شفرة وأخرى، يحفظ توازن الدوّار.' },
      hint: { en: 'Four long yellow beams.', ar: 'أربع عوارض صفراء طويلة.' },
      target: { x: 40, y: 110, w: 252, h: 256 },
      svgLayer: { id: 'blades', bbox: { x: 40, y: 110, w: 252, h: 256 } },
      completion: { en: 'All four blades are on. The windmill is built.', ar: 'رُكّبت الشفرات الأربع، واكتمل بناء الطاحونة.' },
    },
  ],
};
