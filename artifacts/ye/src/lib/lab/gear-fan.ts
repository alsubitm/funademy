import type { Lesson, SlotDef, Text } from './types';

/**
 * Gear-Driven Fan — an ORIGINAL FunAdemy practice activity.
 * Not an approved Young Engineers lesson. Replace this file (or add a sibling)
 * with the approved lesson's parts, steps and hints; controls read only from config.
 */

const AX = { L: { x: 100, y: 140 }, R: { x: 180, y: 140 }, F: { x: 270, y: 140 } };

const needBase: Text = { ar: 'ضع القاعدة أولًا.', en: 'Put the base down first.' };
const needSupport = (side: Text): Text => ({ ar: `يحتاج دعامة ${side.ar} أولًا.`, en: `Needs the ${side.en} support first.` });
const needAxle: Text = { ar: 'يحتاج محورًا في هذا الثقب أولًا.', en: 'Needs an axle in this hole first.' };

function column(key: 'L' | 'R' | 'F', side: Text, extra: { gear: boolean; crank: boolean; rotor: boolean }): SlotDef[] {
  const { x, y } = AX[key];
  const s: SlotDef[] = [
    { id: `support-${key}`, accepts: 'support', orientations: ['up'], requires: ['base'], x, y: 196, requiresHint: needBase },
    { id: `axle-${key}`, accepts: 'axle', orientations: ['through'], requires: [`support-${key}`], axis: key, x, y, requiresHint: needSupport(side) },
  ];
  if (extra.gear) s.push({ id: `gear-${key}`, accepts: 'gear', orientations: ['flat'], requires: [`axle-${key}`], axis: key, x: x, y: y - 30, requiresHint: needAxle });
  if (extra.crank) s.push({ id: `crank-${key}`, accepts: 'crank', orientations: ['out'], requires: [`axle-${key}`], axis: key, x: x - 26, y: y + 22, requiresHint: needAxle });
  if (extra.rotor) s.push({ id: `rotor-${key}`, accepts: 'rotor', orientations: ['front'], requires: [`axle-${key}`], axis: key, x: x + 30, y: y - 44, requiresHint: needAxle });
  return s;
}

export const gearFanLesson: Lesson = {
  id: 'gear-driven-fan',
  version: 1,
  title: { ar: 'مروحة تدور بالتروس', en: 'Gear-Driven Fan' },
  badge: { ar: 'نشاط تدريبي من FunAdemy — ليس درسًا معتمدًا من Young Engineers', en: 'FunAdemy practice activity — not an approved Young Engineers lesson' },
  objective: {
    ar: 'اكتشف كيف ينقل ترسان متشابكان الحركة، ولماذا يدور الترس الثاني في الاتجاه المعاكس.',
    en: 'Discover how two meshing gears pass motion along, and why the second gear turns the opposite way.',
  },
  minutes: '10–15',
  workbench: { width: 360, height: 290 },
  meshTolerance: 4,
  parts: [
    { id: 'base', name: { ar: 'القاعدة', en: 'Base plate' }, description: { ar: 'اللوح الذي يُبنى عليه كل شيء. يبقي النموذج ثابتًا.', en: 'Everything stands on it. Keeps the model steady.' }, quantity: 1, role: 'structure', orientations: ['flat'] },
    { id: 'support', name: { ar: 'دعامة', en: 'Support' }, description: { ar: 'عمود قائم فيه ثقب يحمل المحور. يجب أن يقف مستقيمًا.', en: 'An upright post with a hole that holds an axle. Must stand straight up.' }, quantity: 2, role: 'structure', orientations: ['side', 'up'] },
    { id: 'axle', name: { ar: 'محور', en: 'Axle' }, description: { ar: 'قضيب يمر عبر ثقب الدعامة. كل ما يُركّب عليه يدور معه.', en: 'A rod through the support hole. Everything on it turns together.' }, quantity: 2, role: 'axle', orientations: ['across', 'through'] },
    { id: 'gear', name: { ar: 'ترس', en: 'Gear' }, description: { ar: 'عجلة بأسنان. عندما تتشابك أسنان ترسين، يدفع أحدهما الآخر.', en: 'A wheel with teeth. When two gears’ teeth meet, one pushes the other.' }, quantity: 2, role: 'gear', orientations: ['flat'], radius: 40, teeth: 12 },
    { id: 'crank', name: { ar: 'ذراع التدوير', en: 'Hand crank' }, description: { ar: 'المقبض الذي تديره بيدك. هو مصدر الحركة.', en: 'The handle you turn. It is where the motion starts.' }, quantity: 1, role: 'input', orientations: ['in', 'out'] },
    { id: 'rotor', name: { ar: 'مروحة', en: 'Fan rotor' }, description: { ar: 'ثلاث ريش تدور لتحريك الهواء. هي هدف النموذج.', en: 'Three blades that spin to move air. The goal of the model.' }, quantity: 1, role: 'output', orientations: ['edge', 'front'] },
  ],
  axes: [{ id: 'L', ...AX.L }, { id: 'R', ...AX.R }, { id: 'F', ...AX.F }],
  slots: [
    { id: 'base', accepts: 'base', orientations: ['flat'], requires: [], x: 180, y: 256, requiresHint: needBase },
    ...column('L', { ar: 'اليسرى', en: 'left' }, { gear: true, crank: true, rotor: false }),
    ...column('R', { ar: 'الوسطى', en: 'middle' }, { gear: true, crank: false, rotor: true }),
    ...column('F', { ar: 'البعيدة', en: 'far right' }, { gear: true, crank: false, rotor: true }),
  ],
  steps: [
    { id: 's1', slot: 'base', text: { ar: 'ضع القاعدة على الطاولة.', en: 'Lay the base on the table.' }, hints: [{ ar: 'ابدأ بأكبر قطعة في الصينية.', en: 'Start with the biggest piece in the tray.' }, { ar: 'اسحب القاعدة إلى الخط المتقطع في الأسفل.', en: 'Drag the base to the dashed line at the bottom.' }] },
    { id: 's2', slot: 'support-L', text: { ar: 'ثبّت الدعامة الأولى على اليسار.', en: 'Stand the first support on the left.' }, hints: [{ ar: 'الدعامة يجب أن تقف مستقيمة — جرّب زر التدوير.', en: 'Supports must stand upright — try the rotate button.' }, { ar: 'النقطة المضيئة على اليسار هي مكانها.', en: 'The glowing point on the left is its spot.' }] },
    { id: 's3', slot: 'support-R', text: { ar: 'ثبّت الدعامة الثانية قريبة منها.', en: 'Stand the second support close to it.' }, hints: [{ ar: 'إذا كانت بعيدة جدًا فلن تلتقي أسنان الترسين.', en: 'Too far away and the gear teeth will never meet.' }, { ar: 'ضعها في النقطة الوسطى المضيئة.', en: 'Use the glowing middle point.' }] },
    { id: 's4', slot: 'axle-L', text: { ar: 'أدخل محورًا في الدعامة اليسرى.', en: 'Push an axle through the left support.' }, hints: [{ ar: 'المحور يجب أن يدخل في الثقب، لا أن يستلقي عرضيًا.', en: 'The axle goes into the hole, not lying across it.' }, { ar: 'دوّر المحور ثم ضعه على ثقب الدعامة اليسرى.', en: 'Rotate the axle, then drop it on the left hole.' }] },
    { id: 's5', slot: 'axle-R', text: { ar: 'أدخل المحور الثاني في الدعامة الأخرى.', en: 'Push the second axle through the other support.' }, hints: [{ ar: 'كل دعامة تحتاج محورها.', en: 'Each support needs its own axle.' }, { ar: 'ثقب الدعامة الوسطى يضيء الآن.', en: 'The middle support hole is glowing.' }] },
    { id: 's6', slot: 'gear-L', text: { ar: 'ركّب ترسًا على المحور الأيسر.', en: 'Slide a gear onto the left axle.' }, hints: [{ ar: 'الترس يُركّب على المحور.', en: 'Gears sit on axles.' }, { ar: 'النقطة فوق المحور الأيسر.', en: 'The point above the left axle.' }] },
    { id: 's7', slot: 'gear-R', text: { ar: 'ركّب الترس الثاني لتتشابك الأسنان.', en: 'Add the second gear so the teeth meet.' }, hints: [{ ar: 'يجب أن تلمس أسنانه أسنان الترس الأول.', en: 'Its teeth must touch the first gear’s teeth.' }, { ar: 'النقطة فوق المحور الأوسط.', en: 'The point above the middle axle.' }] },
    { id: 's8', slot: 'crank-L', text: { ar: 'ثبّت ذراع التدوير على المحور الأيسر.', en: 'Fix the crank to the left axle.' }, hints: [{ ar: 'المقبض يجب أن يتجه للخارج نحوك.', en: 'The handle must point outward, toward you.' }, { ar: 'النقطة أسفل المحور الأيسر.', en: 'The point below the left axle.' }] },
    { id: 's9', slot: 'rotor-R', text: { ar: 'ركّب المروحة على المحور الثاني.', en: 'Mount the fan on the second axle.' }, hints: [{ ar: 'الريش يجب أن تواجهك، لا أن تُرى من الحافة.', en: 'The blades should face you, not edge-on.' }, { ar: 'النقطة أعلى يمين المحور الأوسط.', en: 'The point up-right of the middle axle.' }] },
  ],
  success: { outputPart: 'rotor' },
  reasons: {
    'none-left': { ar: 'لم يتبقَّ من هذه القطعة في الصينية.', en: 'None of this piece left in the tray.' },
    'slot-occupied': { ar: 'هذا المكان مشغول. أزل القطعة أولًا.', en: 'That spot is taken. Remove the piece first.' },
    'wrong-part': { ar: 'هذه القطعة لا تثبت هنا. انظر إلى شكل نقطة التثبيت.', en: 'This piece does not fit here. Check the shape of the spot.' },
    'wrong-orientation': { ar: 'الاتجاه غير صحيح. دوّر القطعة ثم جرّب مجددًا.', en: 'Wrong way round. Rotate the piece and try again.' },
    'missing-dependency': { ar: 'شيء ما ينقص تحتها.', en: 'Something is missing underneath.' },
    unknown: { ar: 'عادت القطعة إلى الصينية.', en: 'The piece went back to the tray.' },
  },
  status: {
    empty: { ar: 'الطاولة فارغة. لا يوجد ما يتحرك بعد.', en: 'The bench is empty. Nothing can move yet.' },
    'no-input': { ar: 'لا يوجد ذراع تدوير. من أين ستبدأ الحركة؟', en: 'No crank yet. Where will the motion come from?' },
    'input-no-gear': { ar: 'الذراع يدور، لكن لا ترس على محوره لينقل الحركة.', en: 'The crank turns, but there is no gear on its axle to pass the motion on.' },
    'missing-follower': { ar: 'الذراع والترس الأول يدوران، لكن لا يوجد ترس ثانٍ. المروحة ساكنة.', en: 'The crank and first gear turn, but there is no second gear. The fan stays still.' },
    'gears-not-meshed': { ar: 'الذراع يدور، لكن الترسين غير متصلين. تحقق من أن أسنانهما تتلامس.', en: 'The crank turns, but the gears aren’t connected. Check whether their teeth meet.' },
    'output-missing': { ar: 'الترسان يدوران معًا! لكن المروحة غير مركّبة بعد.', en: 'Both gears turn together! But the fan rotor is missing.' },
    'output-still': { ar: 'المروحة على محور لا يدور. ضعها على محور الترس الثاني.', en: 'The fan is on an axle that is not turning. Put it on the second gear’s axle.' },
    success: { ar: 'نجحت! الحركة تنتقل من الذراع إلى المروحة.', en: 'It works! Motion travels from the crank to the fan.' },
  },
  orientationNames: {
    flat: { ar: 'مسطّح', en: 'flat' }, up: { ar: 'قائم', en: 'upright' }, side: { ar: 'مائل', en: 'on its side' },
    through: { ar: 'داخل الثقب', en: 'into the hole' }, across: { ar: 'عرضي', en: 'lying across' },
    out: { ar: 'للخارج', en: 'handle out' }, in: { ar: 'للداخل', en: 'handle in' },
    front: { ar: 'مواجه', en: 'facing you' }, edge: { ar: 'من الحافة', en: 'edge-on' },
  },
  reflection: {
    question: { ar: 'عندما يدور الترس الأول مع عقارب الساعة، في أي اتجاه يدور الترس الثاني؟', en: 'When the driving gear turns clockwise, which way does the second gear turn?' },
    options: [
      { id: 'cw', label: { ar: 'مع عقارب الساعة', en: 'Clockwise' } },
      { id: 'ccw', label: { ar: 'عكس عقارب الساعة', en: 'Counter-clockwise' } },
      { id: 'still', label: { ar: 'لا يدور', en: 'It does not turn' } },
    ],
    correct: 'ccw',
    explain: { ar: 'الأسنان المتشابكة تدفع بعضها في الاتجاه المعاكس، لذلك ينعكس الاتجاه مع كل ترس.', en: 'Meshing teeth push each other the opposite way, so direction flips at every gear.' },
  },
};
