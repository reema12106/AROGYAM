import { Link } from 'react-router-dom';
import { Search, BookOpen, BarChart3, Code, ArrowRight, Activity, Shield, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

export function HomePage() {
  const features = [
    {
      icon: Search,
      title: 'Intelligent Search',
      description: 'Search NAMASTE conditions with smart ICD-11 mapping detection',
      link: '/search',
    },
    {
      icon: BookOpen,
      title: 'Mapping Cases',
      description: 'Understand the 4 types of NAMASTE-ICD11 mapping scenarios',
      link: '/mapping-cases',
    },
    {
      icon: Code,
      title: 'FHIR Resources',
      description: 'Access FHIR R4 compliant CodeSystems, ConceptMaps, and ValueSets',
      link: '/fhir',
    },
    {
      icon: BarChart3,
      title: 'Statistics',
      description: 'View mapping coverage and distribution analytics',
      link: '/stats',
    },
  ];

  const stats = [
    { label: 'NAMASTE Conditions', value: '20+' },
    { label: 'ICD-11 Mappings', value: '25+' },
    { label: 'Mapping Coverage', value: '95%' },
    { label: 'FHIR Compliant', value: 'R4' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center">
            <Activity className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-medical-900">
            NAMASTE to ICD-11
            <span className="block text-primary-600">Mapping Service</span>
          </h1>
          <p className="text-xl text-medical-600 max-w-3xl mx-auto leading-relaxed">
            National AYUSH Morbidity & Standardized Terminologies Electronic system 
            with intelligent ICD-11 mapping for traditional and modern medicine integration.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/search" className="btn-primary px-8 py-3 text-lg">
            Start Searching
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link to="/mapping-cases" className="btn-outline px-8 py-3 text-lg">
            Learn About Mappings
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-medical-600">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-medical-900 mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-medical-600 max-w-2xl mx-auto">
            Comprehensive tools for healthcare professionals to bridge traditional 
            and modern medical terminologies.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <Link key={index} to={feature.link} className="group">
              <Card className="h-full hover:shadow-lg transition-all duration-200 group-hover:border-primary-300">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                      <feature.icon className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-medical-900 group-hover:text-primary-600 transition-colors">
                        {feature.title}
                      </h3>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-medical-600 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-primary-600 mt-4 group-hover:translate-x-1 transition-transform">
                    <span className="text-sm font-medium">Explore</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white rounded-2xl p-8 md:p-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-medical-900 mb-4">
            Why Choose NAMASTE Mapping?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-medical-900">
              FHIR R4 Compliant
            </h3>
            <p className="text-medical-600">
              Fully compliant with FHIR R4 standards for seamless healthcare 
              system integration and interoperability.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-medical-900">
              Global Standards
            </h3>
            <p className="text-medical-600">
              Bridges traditional AYUSH medicine with international ICD-11 
              classification for global healthcare compatibility.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-medical-900">
              Real-time Mapping
            </h3>
            <p className="text-medical-600">
              Intelligent mapping detection with confidence scoring and 
              multiple mapping scenarios for comprehensive coverage.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}