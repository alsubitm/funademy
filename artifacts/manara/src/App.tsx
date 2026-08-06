import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { I18nProvider } from '@/lib/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import Home from '@/pages/Home';
import Pricing from '@/pages/Pricing';
import Curriculum from '@/pages/Curriculum';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ParentDashboard from '@/pages/ParentDashboard';
import ChildProfiles from '@/pages/ChildProfiles';
import Subscription from '@/pages/Subscription';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';
import ChildReport from '@/pages/ChildReport';
import ProfilePicker from '@/pages/ProfilePicker';
import AdminUsers from '@/pages/AdminUsers';
import AdminCurriculum from '@/pages/AdminCurriculum';
import AdminBlog from '@/pages/AdminBlog';
import AdminDashboard from '@/pages/AdminDashboard';
import Blog from '@/pages/Blog';
import BlogPostDetail from '@/pages/BlogPostDetail';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import ChildSafety from '@/pages/ChildSafety';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { KidLayout } from '@/components/layout/KidLayout';

import VerifyEmail from '@/pages/VerifyEmail';

// Placeholder Pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
    <h1 className="text-3xl font-bold mb-4">{title}</h1>
    <p className="text-muted-foreground">This page is under construction.</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            {/* Auth Routes */}
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/verify-email" component={VerifyEmail} />

            {/* Parent App Routes */}
            <Route path="/app/*">
              <AppLayout>
                <Switch>
                  <Route path="/app" component={ParentDashboard} />
                  <Route path="/app/children" component={ChildProfiles} />
                  <Route path="/app/children/:id" component={ChildReport} />
                  <Route path="/app/subscription" component={Subscription} />
                  <Route path="/app/settings" component={Settings} />
                  <Route path="/app/profiles" component={ProfilePicker} />
                  <Route component={NotFound} />
                </Switch>
              </AppLayout>
            </Route>

            {/* Child App Routes (KidLayout handles the shell) */}
            <Route path="/kid/*">
              <KidLayout />
            </Route>

            {/* Admin App Routes */}
            <Route path="/admin/*">
              <AdminLayout>
                <Switch>
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/users" component={AdminUsers} />
                  <Route path="/admin/curriculum" component={AdminCurriculum} />
                  <Route path="/admin/blog" component={AdminBlog} />
                  <Route component={NotFound} />
                </Switch>
              </AdminLayout>
            </Route>

            {/* Marketing Routes (catch-all) */}
            <Route>
              <MarketingLayout>
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/pricing" component={Pricing} />
                  <Route path="/curriculum" component={Curriculum} />
                  <Route path="/about" component={About} />
                  <Route path="/contact" component={Contact} />
                  <Route path="/blog" component={Blog} />
                  <Route path="/blog/:slug" component={BlogPostDetail} />
                  <Route path="/terms" component={Terms} />
                  <Route path="/privacy" component={Privacy} />
                  <Route path="/child-safety" component={ChildSafety} />
                  <Route component={NotFound} />
                </Switch>
              </MarketingLayout>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
