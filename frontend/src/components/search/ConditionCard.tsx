import { ExternalLink, Info, MapPin } from 'lucide-react';
import { FHIRCondition } from '../../lib/types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getMappingTypeColor, extractFHIRCoding } from '../../lib/utils';

interface ConditionCardProps {
  condition: FHIRCondition;
  onViewDetails: (code: string) => void;
}

export function ConditionCard({ condition, onViewDetails }: ConditionCardProps) {
  const namasteCoding = extractFHIRCoding(condition, 'https://ayush.gov.in/namaste');
  const icd11Codings = condition.code.coding.filter(
    (c) => c.system === 'http://id.who.int/icd/release/11'
  );

  const mappingCase = condition.extension?.find(
    (ext) => ext.url === 'https://nrces.in/fhir/StructureDefinition/mapping-analysis'
  )?.valueCodeableConcept.coding[0];

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-medical-900 mb-1">
              {namasteCoding?.display || 'Unknown Condition'}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-medical-600">
              <code className="bg-medical-100 px-2 py-1 rounded font-mono">
                {namasteCoding?.code}
              </code>
              {mappingCase && (
                <Badge variant="secondary">
                  {mappingCase.display}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={() => onViewDetails(namasteCoding?.code || '')}
            className="p-2 text-medical-400 hover:text-primary-600 transition-colors"
            title="View detailed mapping"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {/* ICD-11 Mappings */}
        {icd11Codings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-medical-700 flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              ICD-11 Mappings
            </h4>
            <div className="space-y-2">
              {icd11Codings.map((coding, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-medical-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-medical-900">
                      {coding.display}
                    </p>
                    <code className="text-xs text-medical-600 font-mono">
                      {coding.code}
                    </code>
                  </div>
                  {/* We'd need to determine mapping type from the backend response */}
                  <Badge className="ml-2 bg-blue-100 text-blue-800">
                    ICD-11
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Status */}
        <div className="mt-4 pt-4 border-t border-medical-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-medical-600">Clinical Status:</span>
            <Badge variant="success">
              {condition.clinicalStatus.coding[0]?.display || 'Active'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}