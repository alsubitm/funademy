import { arabicDigits } from '@/lib/constants';

export const watanonaDict = {
  ar: {
    heroKick: 'الحملة الوطنية',
    heroTitle: 'أطفالنا يبنون وطننا',
    heroLead: 'بمناسبة اليوم الوطني، يشارك مهندسونا الصغار في بناء أكبر خريطة للمملكة من مكعبات ليغو®، لتُكشف في معرضنا الاستثنائي.',
    
    cdDays: 'يوم',
    cdHours: 'ساعة',
    cdMins: 'دقيقة',
    cdSecs: 'ثانية',
    cdPassed: 'حان وقت المعرض!',

    wallKick: 'الخريطة التفاعلية',
    wallTitle: 'حائط الوطن',
    wallSub: 'كل مكعب يضعه طفل يقرّبنا من اكتمال الخريطة. شارك معنا الآن وضع مكعبك!',
    wallCountLbl: 'مكعب تم وضعه حتى الآن',
    wallPlaceBtn: 'ضع مكعبك الآن 🧱',
    wallRemaining: (rem: number) => `بقي لك ${arabicDigits(rem)} مكعبات اليوم`,
    wallLimitReached: 'شكراً لمشاركتك! لقد وصلت للحد الأقصى اليوم. عد غداً.',
    wallError: 'حدث خطأ، حاول مرة أخرى.',

    journeyKick: 'مسار الحملة',
    journeyTitle: 'كيف نبني وطننا؟',
    jSteps: [
      { title: '١. التسجيل', desc: 'سجل طفلك في أحد برامجنا.' },
      { title: '٢. البناء في الحصة', desc: 'يتعلم ويبني جزءاً من الخريطة أسبوعياً.' },
      { title: '٣. إنجاز المدينة', desc: 'نجمع ما بناه أطفالنا من كل أنحاء الرياض.' },
      { title: '٤. المعرض الختامي', desc: 'نركب الأجزاء لنشكل خريطة الوطن.' }
    ],

    exhibKick: 'المعرض الختامي',
    exhibTitle: 'معرض "وطننا الصغير"',
    exhibDesc: 'انضم إلينا يوم 23 سبتمبر للكشف عن أضخم خريطة للمملكة مبنية بأيادي أطفال الرياض.',
    exhibBtn: 'احجز تذكرتك مجاناً',

    sponsorsKick: 'رعاة الحملة',
    sponsorsTitle: 'كن جزءاً من الإنجاز',
    sponsorsSub: 'نرحب بالشركات والمؤسسات لرعاية هذه المبادرة الوطنية.',
    tiers: {
      diamond: { name: 'شريك ماسي', desc: 'رعاية رئيسية للحملة والمعرض مع تغطية إعلامية شاملة.' },
      gold: { name: 'شريك ذهبي', desc: 'تواجد بارز في المعرض الختامي والمواد الإعلانية.' },
      silver: { name: 'شريك فضي', desc: 'دعم مبادرة بناء الخريطة ومشاركة لوجستية.' }
    },
    sponsorBtn: 'تواصل للرعاية',
    
    enrollTitle: 'ابنِ مستقبله.. وابنِ وطننا',
    enrollBtn: 'سجل في البرامج الآن'
  },
  en: {
    heroKick: 'National Campaign',
    heroTitle: 'Our Children Build Our Homeland',
    heroLead: 'For Saudi National Day, our young engineers unite to build the largest LEGO® map of the Kingdom, unveiled at our spectacular exhibition.',
    
    cdDays: 'DAYS',
    cdHours: 'HRS',
    cdMins: 'MIN',
    cdSecs: 'SEC',
    cdPassed: 'The exhibition is live!',

    wallKick: 'Interactive Map',
    wallTitle: 'The Homeland Wall',
    wallSub: 'Every brick placed brings the map closer to completion. Place your brick now!',
    wallCountLbl: 'bricks placed so far',
    wallPlaceBtn: 'Place Your Brick 🧱',
    wallRemaining: (rem: number) => `${rem} bricks remaining today`,
    wallLimitReached: 'Thank you! Daily limit reached. Come back tomorrow.',
    wallError: 'Error occurred. Try again.',

    journeyKick: 'Campaign Journey',
    journeyTitle: 'How We Build It',
    jSteps: [
      { title: '1. Enroll', desc: 'Register your child in our programs.' },
      { title: '2. Build in Class', desc: 'They learn and build parts of the map weekly.' },
      { title: '3. City Milestones', desc: 'We combine builds from across Riyadh.' },
      { title: '4. The Unveiling', desc: 'All parts connect at the grand exhibition.' }
    ],

    exhibKick: 'Grand Exhibition',
    exhibTitle: '"Mini Watan" Exhibition',
    exhibDesc: 'Join us on Sep 23 as we unveil the massive Kingdom map built by the kids of Riyadh.',
    exhibBtn: 'Book Free Ticket',

    sponsorsKick: 'Sponsorships',
    sponsorsTitle: 'Be Part of the Achievement',
    sponsorsSub: 'We welcome companies to sponsor this national initiative.',
    tiers: {
      diamond: { name: 'Diamond Partner', desc: 'Main campaign sponsor with full media coverage.' },
      gold: { name: 'Gold Partner', desc: 'Prominent presence at the exhibition and media.' },
      silver: { name: 'Silver Partner', desc: 'Support the map building with logistical presence.' }
    },
    sponsorBtn: 'Contact to Sponsor',

    enrollTitle: 'Build Their Future.. Build Our Homeland',
    enrollBtn: 'Enroll in Programs'
  }
};
