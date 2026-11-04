/** Shared wire contract. Access to a student room is invitation-specific. */
export type LivePhase = 'waiting' | 'teaching' | 'quiz' | 'ended';
export type LiveQuestion = { id: string; ar: string; en: string; options: { ar: string; en: string }[] };
export type LiveRoom = {
  id: string; title: string; instructorId: number; startsAt: string; durationMin: number;
  phase: LivePhase; step: number; motor: boolean; speed: number; reverse: boolean;
  version: number; meetUrl: string | null; calendarStatus: string;
};
export type LiveGuest = {
  id: string; name: string; email: string; joinPath: string;
  revoked: boolean; invitedAt: string | null; joinedAt: string | null;
  submittedAt: string | null; score: number | null;
};
export type LiveStaffResponse = {
  rooms: (LiveRoom & { guests: LiveGuest[] })[];
  instructors: { id: number; name: string }[]; role: 'admin' | 'instructor';
};
export type LiveStudentResponse = {
  room: LiveRoom; name: string; questions: LiveQuestion[];
  submission: { score: number; total: number } | null;
};
