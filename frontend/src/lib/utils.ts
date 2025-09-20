import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatPhoneNumber(phone: string) {
  // Format +91XXXXXXXXXX to +91 XXXXX XXXXX
  if (phone.startsWith('+91') && phone.length === 13) {
    return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

export function formatABHANumber(abha: string) {
  // Format XX-XXXX-XXXX-XXXX with proper spacing
  return abha.replace(/-/g, ' - ');
}

export function getMappingTypeColor(type: string) {
  switch (type) {
    case 'TM2':
      return 'bg-purple-100 text-purple-800';
    case 'Biomed':
      return 'bg-blue-100 text-blue-800';
    case 'TM2-fallback':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getMappingCaseDescription(mappingCase: string) {
  switch (mappingCase) {
    case 'case_1_tm2_only':
      return 'Traditional Medicine Only';
    case 'case_2_biomed_only':
      return 'Biomedical Only';
    case 'case_3_dual_match':
      return 'Dual Mapping Available';
    case 'case_4_fallback':
      return 'Fallback Mapping';
    case 'no_mapping':
      return 'No Mapping Available';
    default:
      return 'Unknown Mapping';
  }
}

export function getConfidenceColor(confidence: number) {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= 0.7) return 'text-yellow-600';
  return 'text-red-600';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function extractFHIRCoding(condition: any, system: string) {
  const coding = condition.code?.coding?.find((c: any) => c.system === system);
  return coding || null;
}

export function isValidABHA(abha: string) {
  const pattern = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
  return pattern.test(abha);
}

export function isValidPhone(phone: string) {
  const pattern = /^\+91[6-9]\d{9}$/;
  return pattern.test(phone);
}