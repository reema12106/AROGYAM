import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Activity, User, Phone, CreditCard, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../lib/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Card, CardContent } from '../../components/ui/Card';
import { isValidABHA, isValidPhone } from '../../lib/utils';

const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  abha_number: z.string()
    .min(1, 'ABHA number is required')
    .refine(isValidABHA, 'Invalid ABHA format. Use XX-XXXX-XXXX-XXXX'),
  phone_number: z.string()
    .min(1, 'Phone number is required')
    .refine(isValidPhone, 'Invalid phone format. Use +91XXXXXXXXXX'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const [showPhone, setShowPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      abha_number: '',
      phone_number: '+91',
    },
  });

  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await authApi.register(data);
      toast.success('Registration successful! Please login to continue.');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-medical-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-medical-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-medical-600">
            Register with your ABHA number to access NAMASTE mapping services
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-medical-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-400" />
                  <input
                    {...form.register('name')}
                    type="text"
                    placeholder="Enter your full name"
                    className="input pl-10"
                    disabled={isLoading}
                  />
                </div>
                {form.formState.errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* ABHA Number */}
              <div>
                <label className="block text-sm font-medium text-medical-700 mb-2">
                  ABHA Number
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-400" />
                  <input
                    {...form.register('abha_number')}
                    type="text"
                    placeholder="XX-XXXX-XXXX-XXXX"
                    className="input pl-10"
                    disabled={isLoading}
                  />
                </div>
                {form.formState.errors.abha_number && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.abha_number.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-medical-500">
                  Your Ayushman Bharat Health Account number
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-medical-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-400" />
                  <input
                    {...form.register('phone_number')}
                    type={showPhone ? 'text' : 'password'}
                    placeholder="+91XXXXXXXXXX"
                    className="input pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPhone(!showPhone)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-medical-400 hover:text-medical-600"
                  >
                    {showPhone ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.formState.errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.phone_number.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-medical-500">
                  We'll send an OTP to this number for verification
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-medical-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in here
            </Link>
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="text-center">
          <p className="text-xs text-medical-500 max-w-sm mx-auto">
            By creating an account, you agree to our terms of service and privacy policy. 
            Your health data is protected and secure.
          </p>
        </div>
      </div>
    </div>
  );
}