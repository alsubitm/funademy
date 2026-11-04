export interface InstructorDashboardData {
  viewer: { id: number | null; name: string; email: string | null; role: 'instructor' | 'admin' };
  runs: {
    id: number; title: string; program: string; location: string | null;
    capacity: number; active: boolean; startDate: string; endDate: string;
    students: { id: number; firstName: string; birthYear: number; status: string }[];
    sessions: {
      id: number; date: string; status: string; note: string | null;
      attendance: { studentId: number; status: string }[];
      preparationNote: string;
    }[];
  }[];
}
export interface InstructorManagementData {
  instructors: { id: number; name: string; email: string; active: boolean; courseRunIds: number[] }[];
  runs: { id: number; title: string; program: string }[];
}
