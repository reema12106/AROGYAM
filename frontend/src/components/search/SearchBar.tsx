import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search conditions...",
  className,
  disabled = false,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <div
        className={cn(
          'relative flex items-center border rounded-lg bg-white transition-all duration-200',
          isFocused
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-medical-300 hover:border-medical-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Search className="w-5 h-5 text-medical-400 ml-3" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-3 bg-transparent border-0 focus:outline-none placeholder:text-medical-500 text-medical-900"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-medical-400 hover:text-medical-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="btn-primary px-4 py-2 m-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </div>
    </form>
  );
}