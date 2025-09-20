import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Toaster } from 'sonner';

export function Layout() {
  return (
    <div className="min-h-screen bg-medical-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            border: '1px solid #e2e8f0',
            color: '#1e293b',
          },
        }}
      />
    </div>
  );
}