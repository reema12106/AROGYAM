import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Protected routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route 
                path="search" 
                element={
                  <ProtectedRoute>
                    <SearchPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Placeholder routes for future pages */}
              <Route 
                path="mapping/:code" 
                element={
                  <ProtectedRoute>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold text-medical-900 mb-4">
                        Mapping Details
                      </h1>
                      <p className="text-medical-600">
                        Detailed mapping view coming soon...
                      </p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="mapping-cases" 
                element={
                  <ProtectedRoute>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold text-medical-900 mb-4">
                        Mapping Cases
                      </h1>
                      <p className="text-medical-600">
                        Documentation for the 4 mapping scenarios coming soon...
                      </p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="fhir" 
                element={
                  <ProtectedRoute>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold text-medical-900 mb-4">
                        FHIR Resources
                      </h1>
                      <p className="text-medical-600">
                        FHIR CodeSystems, ConceptMaps, and ValueSets coming soon...
                      </p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="stats" 
                element={
                  <ProtectedRoute>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold text-medical-900 mb-4">
                        Statistics
                      </h1>
                      <p className="text-medical-600">
                        Mapping statistics and analytics coming soon...
                      </p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="profile" 
                element={
                  <ProtectedRoute>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold text-medical-900 mb-4">
                        User Profile
                      </h1>
                      <p className="text-medical-600">
                        Profile management coming soon...
                      </p>
                    </div>
                  </ProtectedRoute>
                } 
              />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;