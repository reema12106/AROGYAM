import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Search, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatABHANumber } from '../../lib/utils';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-medical-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-medical-900">NAMASTE</h1>
              <p className="text-xs text-medical-500 -mt-1">ICD-11 Mapping</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/search"
              className="flex items-center space-x-2 text-medical-600 hover:text-primary-600 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Link>
            <Link
              to="/mapping-cases"
              className="text-medical-600 hover:text-primary-600 transition-colors"
            >
              Mapping Cases
            </Link>
            <Link
              to="/fhir"
              className="text-medical-600 hover:text-primary-600 transition-colors"
            >
              FHIR Resources
            </Link>
            <Link
              to="/stats"
              className="text-medical-600 hover:text-primary-600 transition-colors"
            >
              Statistics
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-medical-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-medical-900">{user?.name}</p>
                    <p className="text-xs text-medical-500">
                      {user?.abha_number && formatABHANumber(user.abha_number)}
                    </p>
                  </div>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-medical-200 py-1">
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-medical-700 hover:bg-medical-50"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-medical-600 hover:text-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary px-4 py-2"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-medical-50"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 text-medical-600" />
              ) : (
                <Menu className="w-5 h-5 text-medical-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-medical-200 py-4">
            <nav className="flex flex-col space-y-3">
              <Link
                to="/search"
                className="flex items-center space-x-2 text-medical-600 hover:text-primary-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </Link>
              <Link
                to="/mapping-cases"
                className="text-medical-600 hover:text-primary-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Mapping Cases
              </Link>
              <Link
                to="/fhir"
                className="text-medical-600 hover:text-primary-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                FHIR Resources
              </Link>
              <Link
                to="/stats"
                className="text-medical-600 hover:text-primary-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Statistics
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}