// Auth types
export interface User {
  abha_number: string;
  phone_number: string;
  name: string;
  is_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    abha_number: string;
    phone_number: string;
    name?: string;
    otp_expiry_minutes?: number;
  };
}

// FHIR types
export interface FHIRCoding {
  system: string;
  code: string;
  display: string;
}

export interface FHIRCodeableConcept {
  coding: FHIRCoding[];
  text?: string;
}

export interface FHIRCondition {
  resourceType: 'Condition';
  id: string;
  code: FHIRCodeableConcept;
  clinicalStatus: FHIRCodeableConcept;
  category: FHIRCodeableConcept[];
  verificationStatus: FHIRCodeableConcept;
  subject?: {
    reference: string;
  };
  extension?: Array<{
    url: string;
    valueCodeableConcept: FHIRCodeableConcept;
  }>;
}

export interface FHIRBundleEntry {
  resource: FHIRCondition;
  search: {
    mode: string;
  };
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  total: number;
  entry: FHIRBundleEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// NAMASTE types
export interface NAMASTECode {
  id: number;
  code: string;
  display_name: string;
  category: string;
  system: string;
}

export interface ICD11Mapping {
  id: number;
  namaste_code: string;
  icd11_code: string;
  icd11_display_name: string;
  mapping_type: 'TM2' | 'Biomed' | 'TM2-fallback';
}

export interface MappingProfile {
  condition: NAMASTECode;
  mappings: ICD11Mapping[];
  mapping_case: string;
  confidence_score: number;
  recommendations: {
    primary?: ICD11Mapping;
    for_insurance?: ICD11Mapping;
    for_traditional_context?: ICD11Mapping;
    for_modern_context?: ICD11Mapping;
    requires_validation?: boolean;
  };
}

// Search types
export interface SearchParams {
  q: string;
  limit?: number;
  page?: number;
  patient_id?: string;
  mapping_type?: string;
}

export interface SearchResult {
  conditions: FHIRCondition[];
  total: number;
  page: number;
  pages: number;
}

// Encounter types
export interface Encounter {
  id: number;
  patient_id: string;
  encounter_type: string;
  notes: string;
  created_at: string;
}

export interface EncounterProblem {
  id: number;
  encounter_id: number;
  code_system: string;
  code: string;
  display_name: string;
  severity: string;
  created_at: string;
}

// Stats types
export interface MappingStats {
  mapping_type_distribution: Array<{
    mapping_type: string;
    count: number;
  }>;
  coverage_statistics: {
    total_conditions: number;
    mapped_conditions: number;
    unmapped_conditions: number;
    coverage_percentage: number;
  };
  multi_mapped_conditions: Array<{
    namaste_code: string;
    mapping_count: number;
  }>;
  last_updated: string;
}