import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import './page.css';

export const metadata = {
  title: 'لوحة التحكم | فناديمي Funademy',
  robots: { index: false, follow: false }
};

export default async function AdminPage() {
  const isAdmin = await isAdminRequest();
  
  if (!isAdmin) {
    return <AdminLogin />;
  }

  const programs = await prisma.program.findMany({ 
    orderBy: { position: 'asc' },
    select: { id: true, nameAr: true }
  });
  
  return <AdminDashboard programs={programs} />;
}