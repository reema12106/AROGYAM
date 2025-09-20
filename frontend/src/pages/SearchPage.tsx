import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SearchBar } from '../components/search/SearchBar';
import { SearchFilters } from '../components/search/SearchFilters';
import { ConditionCard } from '../components/search/ConditionCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Card, CardContent } from '../components/ui/Card';
import { searchApi } from '../lib/api';
import { debounce } from '../lib/utils';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mappingType, setMappingType] = useState('');
  const [patientId, setPatientId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [shouldSearch, setShouldSearch] = useState(false);
  
  const navigate = useNavigate();

  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['searchConditions', searchQuery, mappingType, patientId, currentPage],
    queryFn: () =>
      searchApi.searchConditions({
        q: searchQuery,
        limit: 10,
        page: currentPage,
        patient_id: patientId || undefined,
      }),
    enabled: shouldSearch && searchQuery.length >= 2,
    retry: 1,
  });

  const debouncedSearch = useCallback(
    debounce(() => {
      if (searchQuery.length >= 2) {
        setShouldSearch(true);
        setCurrentPage(1);
      }
    }, 500),
    [searchQuery]
  );

  const handleSearch = () => {
    if (searchQuery.length < 2) {
      toast.error('Please enter at least 2 characters to search');
      return;
    }
    setShouldSearch(true);
    setCurrentPage(1);
  };

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      debouncedSearch();
    } else {
      setShouldSearch(false);
    }
  };

  const handleViewDetails = (code: string) => {
    navigate(`/mapping/${code}`, { 
      state: { patientId: patientId || undefined } 
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bundle = searchResults?.data;
  const conditions = bundle?.entry?.map(entry => entry.resource) || [];
  const pagination = bundle?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-medical-900">
          Search NAMASTE Conditions
        </h1>
        <p className="text-lg text-medical-600 max-w-2xl mx-auto">
          Find traditional medicine conditions with intelligent ICD-11 mapping detection
        </p>
      </div>

      {/* Search Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <SearchBar
              value={searchQuery}
              onChange={handleQueryChange}
              onSearch={handleSearch}
              placeholder="Search by condition name, code, or category..."
              disabled={isLoading}
            />
            
            <div className="flex justify-between items-center">
              <SearchFilters
                mappingType={mappingType}
                onMappingTypeChange={setMappingType}
                patientId={patientId}
                onPatientIdChange={setPatientId}
              />
              
              {shouldSearch && searchQuery && (
                <div className="text-sm text-medical-600">
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Searching...</span>
                    </div>
                  ) : (
                    pagination && (
                      <span>
                        Showing {((pagination.page - 1) * pagination.limit) + 1}-
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} results
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <div>
                <h3 className="font-medium">Search Error</h3>
                <p className="text-sm mt-1">
                  {error instanceof Error ? error.message : 'Failed to search conditions'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {shouldSearch && !isLoading && !error && conditions.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-yellow-800 mb-2">
              No Results Found
            </h3>
            <p className="text-yellow-700">
              No conditions found for "{searchQuery}". Try different keywords or check your spelling.
            </p>
          </CardContent>
        </Card>
      )}

      {conditions.length > 0 && (
        <div className="space-y-6">
          {/* Results Grid */}
          <div className="grid gap-6">
            {conditions.map((condition, index) => (
              <ConditionCard
                key={`${condition.id}-${index}`}
                condition={condition}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  const isActive = page === pagination.page;
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-medical-600 hover:bg-medical-100'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!shouldSearch && (
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-primary-900 mb-2">
              How to Search
            </h3>
            <div className="text-primary-800 space-y-2">
              <p>• Enter at least 2 characters to start searching</p>
              <p>• Search by condition name (e.g., "diabetes", "fever")</p>
              <p>• Search by NAMASTE code (e.g., "NAM001")</p>
              <p>• Use filters to narrow down results by mapping type</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}