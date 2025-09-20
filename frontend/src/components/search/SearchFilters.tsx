import { Filter, X } from 'lucide-react';
import { useState } from 'react';

interface SearchFiltersProps {
  mappingType: string;
  onMappingTypeChange: (type: string) => void;
  patientId: string;
  onPatientIdChange: (id: string) => void;
}

export function SearchFilters({
  mappingType,
  onMappingTypeChange,
  patientId,
  onPatientIdChange,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const mappingTypes = [
    { value: '', label: 'All Types' },
    { value: 'TM2', label: 'Traditional Medicine (TM2)' },
    { value: 'Biomed', label: 'Biomedical' },
    { value: 'TM2-fallback', label: 'Fallback Mapping' },
  ];

  const hasActiveFilters = mappingType || patientId;

  const clearFilters = () => {
    onMappingTypeChange('');
    onPatientIdChange('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
          hasActiveFilters
            ? 'border-primary-500 bg-primary-50 text-primary-700'
            : 'border-medical-300 bg-white text-medical-600 hover:bg-medical-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {hasActiveFilters && (
          <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {(mappingType ? 1 : 0) + (patientId ? 1 : 0)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-medical-200 rounded-lg shadow-lg z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-medical-900">Search Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-medical-500 hover:text-medical-700 flex items-center space-x-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Mapping Type Filter */}
              <div>
                <label className="block text-sm font-medium text-medical-700 mb-2">
                  Mapping Type
                </label>
                <select
                  value={mappingType}
                  onChange={(e) => onMappingTypeChange(e.target.value)}
                  className="input w-full"
                >
                  {mappingTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient ID Filter */}
              <div>
                <label className="block text-sm font-medium text-medical-700 mb-2">
                  Patient ID (Optional)
                </label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => onPatientIdChange(e.target.value)}
                  placeholder="Enter patient ID"
                  className="input w-full"
                />
                <p className="text-xs text-medical-500 mt-1">
                  Include patient reference in FHIR resources
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}