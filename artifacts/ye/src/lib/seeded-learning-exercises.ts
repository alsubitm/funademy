/** Authored starter exercises shared by the seed and learner regression tests. */
export function explorerExercises(lessonIdx: number) {
  const n = lessonIdx + 2;
  return [
    { type: 'multiple_choice' as const, promptAr: 'في هذا الدرس، كم عدد التفاحات؟', promptEn: 'In this lesson, how many apples?', options: ['2', '3', '4', '5'], correctAnswer: String(n > 4 ? 3 : n), position: 0 },
    { type: 'picture_select' as const, promptAr: 'اختر الشكل الدائري', promptEn: 'Select the circle shape', options: ['⬛', '⭕', '🔺', '🔷'], correctAnswer: '⭕', position: 1 },
    { type: 'multiple_choice' as const, promptAr: '2 + 1 = ?', promptEn: '2 + 1 = ?', options: ['1', '2', '3', '4'], correctAnswer: '3', position: 2 },
    { type: 'fill_blank' as const, promptAr: 'واحد، اثنان، ____', promptEn: 'One, two, ____', options: ['أربعة', 'ثلاثة', 'خمسة'], optionsEn: ['Four', 'Three', 'Five'], correctAnswer: 'ثلاثة', position: 3 },
    { type: 'multiple_choice' as const, promptAr: 'كم عدد التفاحات في مجموعة ثلاثة؟', promptEn: 'How many apples are in a group of three?', options: ['1', '2', '3', '4'], correctAnswer: '3', position: 4 },
  ];
}

export function builderExercises() {
  return [
    { type: 'multiple_choice' as const, promptAr: '3 × 4 = ?', promptEn: '3 × 4 = ?', options: ['10', '12', '14', '16'], correctAnswer: '12', position: 0 },
    { type: 'multiple_choice' as const, promptAr: 'أي من الكسور التالية يعبّر عن النصف؟', promptEn: 'Which fraction represents one half?', options: ['1/3', '1/2', '2/3', '3/4'], correctAnswer: '1/2', position: 1 },
    { type: 'fill_blank' as const, promptAr: '5 × 5 = ____', promptEn: '5 × 5 = ____', options: ['20', '25', '30'], correctAnswer: '25', position: 2 },
    { type: 'multiple_choice' as const, promptAr: 'اختر الجملة الاسمية الصحيحة', promptEn: 'Choose the correct nominal sentence', options: ['يركض الولد', 'السماء صافية', 'ذهبت المدرسة', 'قرأت الكتاب'], optionsEn: ['The boy runs', 'The sky is clear', 'Went to school', 'Read the book'], correctAnswer: 'السماء صافية', position: 3 },
    { type: 'multiple_choice' as const, promptAr: '2 × 3 = ?', promptEn: '2 × 3 = ?', options: ['4', '6', '8', '5'], correctAnswer: '6', position: 4 },
  ];
}
