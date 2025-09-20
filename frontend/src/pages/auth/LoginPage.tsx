import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Activity, Phone, CreditCard, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { isValidABHA, isValidPhone } from '../../lib/utils';

const loginSchema = z.object({
  abha_number: z.string()
    .min(1, 'ABHA number is required')
    .refine(isValidABHA, 'Invalid ABHA format. Use XX-XXXX-XXXX-XXXX'),
  phone_number: z.string()
    .min(1, 'Phone number is required')
    .refine(isValidPhone, 'Invalid phone format. Use +91XXXXXXXXXX'),
});

const otpSchema = z.object({
  otp_code: z.string()
    .min(6, 'OTP must be 6 digits')
    .max(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers'),
});

type LoginForm = z.infer<typeof loginSchema>;
type OTPForm = z.infer<typeof otpSchema>;

export function LoginPage() {
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [loginData, setLoginData] = useState<LoginForm | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/';

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      abha_number: '',
      phone_number: '+91',
    },
  });

  const otpForm = useForm<OTPForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp_code: '',
    },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await authApi.sendOtp(data);
      setLoginData(data);
      setStep('otp');
      toast.success('OTP sent to your phone number');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (data: OTPForm) => {
    if (!loginData) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.verifyOtp({
        ...loginData,
        otp_code: data.otp_code,
      });

      const { access_token, abha_number, phone_number } = response.data.data;
      
      // Get user profile
      const profileResponse = await authApi.getUserProfile();
      const userData = profileResponse.data.data;
      
      login(access_token, userData);
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!loginData) return;
    
    setIsLoading(true);
    try {
      await authApi.sendOtp(loginData);
      toast.success('OTP resent successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to resend OTP');
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
            {step === 'login' ? 'Sign in to NAMASTE' : 'Verify OTP'}
          </h2>
          <p className="mt-2 text-sm text-medical-600">
            {step === 'login' 
              ? 'Enter your ABHA number and phone to continue'
              : 'Enter the 6-digit code sent to your phone'
            }
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 'login' ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                {/* ABHA Number */}
                <div>
                  <label className="block text-sm font-medium text-medical-700 mb-2">
                    ABHA Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-400" />
                    <input
                      {...loginForm.register('abha_number')}
                      type="text"
                      placeholder="XX-XXXX-XXXX-XXXX"
                      className="input pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {loginForm.formState.errors.abha_number && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginForm.formState.errors.abha_number.message}
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-medical-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-400" />
                    <input
                      {...loginForm.register('phone_number')}
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
                  {loginForm.formState.errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginForm.formState.errors.phone_number.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Sending OTP...</span>
                    </div>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={otpForm.handleSubmit(handleOTPVerify)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-medical-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    {...otpForm.register('otp_code')}
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    className="input text-center text-2xl tracking-widest"
                    disabled={isLoading}
                    autoComplete="one-time-code"
                  />
                  {otpForm.formState.errors.otp_code && (
                    <p className="mt-1 text-sm text-red-600">
                      {otpForm.formState.errors.otp_code.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col space-y-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <LoadingSpinner size="sm" />
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      'Verify OTP'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="btn-outline w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resend OTP
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="text-sm text-medical-600 hover:text-primary-600 transition-colors"
                  >
                    ← Back to login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-medical-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}