import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import Icon from '../../components/AppIcon';
import PersonalInfoSection from './components/PersonalInfoSection';
import AccountCredentialsSection from './components/AccountCredentialsSection';
import RoleSelectionSection from './components/RoleSelectionSection';
import EmergencyContactSection from './components/EmergencyContactSection';
import TrustIndicators from './components/TrustIndicators';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { isAddressInServiceArea } from '../../utils/geofence';
// IDs are uploaded after sign-in from the resident home verification card —
// the registration-stage upload was dropped because the file could not
// survive the email-confirmation step reliably.

// Emails must be real deliverable addresses — verification decisions are
// emailed to this address, so a fake address means the applicant never
// learns the outcome.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'guerrillamail.net', 'yopmail.com', 'trashmail.com', 'dispostable.com',
  'example.com', 'test.com', 'maildrop.cc', 'throwawaymail.com',
]);

// Frequent typos of popular providers → suggest the likely intended domain.
const EMAIL_TYPO_DOMAINS = {
  'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmal.com.ph': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmali.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloook.com': 'outlook.com', 'outlool.com': 'outlook.com',
  'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com',
};

const validateEmail = (raw) => {
  const email = (raw || '').trim().toLowerCase();
  if (!email) return 'Email is required';
  if (email.includes(' ')) return 'Email must not contain spaces';
  if (!EMAIL_RE.test(email)) {
    return 'Enter a real email address (e.g., name@gmail.com) — decisions are emailed here';
  }
  const domain = email.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return 'Temporary or disposable email addresses are not allowed — use Gmail, Yahoo, Outlook or another real email';
  }
  const suggestion = EMAIL_TYPO_DOMAINS[domain];
  if (suggestion) return `Did you mean ${email.split('@')[0]}@${suggestion}?`;
  return null;
};

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [submitPhase, setSubmitPhase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    residencyType: 'resident',
    
    // Account Credentials
    password: '',
    confirmPassword: '',
    
    // Role Selection
    role: '',
    
    // Emergency Contacts
    emergencyContacts: [],
    
    // Terms and Conditions
    agreeToTerms: false,
    agreeToPrivacy: false,
    agreeToEmergencyContact: false
  });

  const [errors, setErrors] = useState({});
  // Shown instead of the form once signup succeeds but email confirmation
  // is enabled — the applicant must enter the code before finishing.
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpResent, setOtpResent] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);

  // The OTP screen must survive a tab refresh: the auth session does not
  // exist until the code is entered, so the declared fields are stashed in
  // sessionStorage to restore the code-entry screen after a reload.
  const PENDING_REG_KEY = 'ers.pendingRegistration';

  const savePendingRegistration = async (userId) => {
    try {
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({
        userId,
        email: formData.email.trim().toLowerCase(),
      }));
    } catch { /* quota exceeded — OTP still works in this tab */ }
  };

  const readPendingRegistration = () => {
    try { return JSON.parse(sessionStorage.getItem(PENDING_REG_KEY) || 'null'); }
    catch { return null; }
  };

  // Restore the pending registration if the tab was refreshed mid-OTP.
  useEffect(() => {
    const pending = readPendingRegistration();
    if (!pending?.userId || !pending?.email) return;
    setFormData(prev => ({ ...prev, email: pending.email }));
    setPendingUserId(pending.userId);
    setAwaitingOtp(true);
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1: // Personal Information
        if (!formData?.firstName?.trim()) newErrors.firstName = 'First name is required';
        if (!formData?.lastName?.trim()) newErrors.lastName = 'Last name is required';
        const emailError = validateEmail(formData?.email);
        if (emailError) newErrors.email = emailError;
        if (!formData?.phone?.trim()) {
          newErrors.phone = 'Phone number is required';
        } else if (!/^0\d{10}$/.test(formData?.phone)) {
          newErrors.phone = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
        } else if (/^(\d)\1{10}$/.test(formData?.phone)) {
          newErrors.phone = 'Please enter a real phone number (not a repeated digit)';
        }
        if (!formData?.dateOfBirth) {
          newErrors.dateOfBirth = 'Date of birth is required';
        } else if (new Date(formData.dateOfBirth) > new Date()) {
          newErrors.dateOfBirth = 'Date of birth cannot be in the future';
        }
        if (!formData?.address?.trim()) {
          newErrors.address = 'Address is required';
        } else if (!isAddressInServiceArea(formData.address)) {
          newErrors.address = 'Address must be within Barangay Kalubihan to register. Any format works — e.g. "Brgy. Kalubihan, Cebu City" or the spelling shown on your ID.';
        }
        break;

      case 2: // Account Credentials
        if (!formData?.password) {
          newErrors.password = 'Password is required';
        } else if (formData?.password?.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/?.test(formData?.password)) {
          newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
        }
        if (!formData?.confirmPassword) {
          newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData?.password !== formData?.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        break;

      case 3: // Role Selection
        if (!formData?.role) newErrors.role = 'Please select your role';
        break;

      case 4: // Emergency Contacts & Terms
        // Emergency contacts validation
        formData?.emergencyContacts?.forEach((contact, index) => {
          if (!contact?.name?.trim()) {
            newErrors[`emergencyContact_${contact.id}_name`] = 'Contact name is required';
          }
          if (!contact?.phone?.trim()) {
            newErrors[`emergencyContact_${contact.id}_phone`] = 'Contact phone is required';
          } else if (!/^0\d{10}$/.test(contact?.phone)) {
            newErrors[`emergencyContact_${contact.id}_phone`] = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
          } else if (/^(\d)\1{10}$/.test(contact?.phone)) {
            newErrors[`emergencyContact_${contact.id}_phone`] = 'Please enter a real phone number (not a repeated digit)';
          }
          if (!contact?.relationship) {
            newErrors[`emergencyContact_${contact.id}_relationship`] = 'Relationship is required';
          }
        });

        // Terms validation
        if (!formData?.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms and conditions';
        if (!formData?.agreeToPrivacy) newErrors.agreeToPrivacy = 'You must agree to the privacy policy';
        if (!formData?.agreeToEmergencyContact) newErrors.agreeToEmergencyContact = 'You must agree to emergency contact usage';
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateStep(currentStep)) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Check for duplicate name (RPC — anonymous users can't read user_profiles under RLS)
      const fullName = `${formData.firstName} ${formData.lastName}`;
      const { data: nameTaken, error: checkError } = await supabase
        .rpc('is_name_taken', { p_name: fullName });

      if (checkError) throw checkError;

      if (nameTaken) {
        throw new Error('A user with this name already exists. Please contact support if this is an error.');
      }

      setSubmitPhase('Creating your account…');

      // Signup metadata carries only the declared profile fields. The ID image
      // and any OCR results are NEVER placed in auth metadata — the document
      // goes to private storage and server-controlled OCR afterwards.
      const { data, error: signUpError } = await signUp(
        formData.email.trim().toLowerCase(),
        formData.password,
        {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: fullName,
          phone: formData.phone,
          birthdate: formData.dateOfBirth,
          date_of_birth: formData.dateOfBirth,
          address: formData.address,
          residency_type: formData.residencyType || 'resident',
          emergency_contacts: formData.emergencyContacts?.map(contact => ({
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship
          })),
          role: formData.role
        }
      );

      if (signUpError) throw signUpError;
      if (!data?.user) throw new Error('Registration failed. Please try again.');

      // Already-registered emails get an obfuscated response: a user object,
      // no session, EMPTY identities — and no confirmation email is sent.
      // Detect it and fail clearly instead of showing a code screen that
      // can never be completed.
      if (!data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('This email is already registered. Try signing in, or use Forgot Password to recover the account.');
      }

      // Email confirmation ON → no session yet. Show the 6-digit code screen;
      // after verifyOtp produces a session, server-side ID verification runs.
      if (!data.session) {
        setPendingUserId(data.user.id);
        await savePendingRegistration(data.user.id);
        setAwaitingOtp(true);
        return; // finally{} clears loading state
      }

      // Email confirmation OFF → session already live. The ID is uploaded
      // from the resident home verification card after signing in.
      navigate('/login', { 
        state: { 
          message: 'Registration received — sign in and upload a clear photo of your ID from your home page to finish verification.',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: error?.message || 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
      setSubmitPhase('');
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setErrors({ otp: 'Enter the 6-digit code from the email' });
      return;
    }
    setErrors({});
    setIsLoading(true);
    setSubmitPhase('Verifying code…');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email.trim().toLowerCase(),
        token: code,
        type: 'signup',
      });
      if (error) throw error;

      // Session established. The ID is uploaded from the resident home
      // verification card after signing in.
      sessionStorage.removeItem(PENDING_REG_KEY);
      navigate('/login', {
        state: {
          message: 'Email verified — sign in and upload a clear photo of your ID from your home page to finish verification.',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      setErrors({ otp: error?.message || 'Incorrect or expired code — try again or resend.' });
    } finally {
      setIsLoading(false);
      setSubmitPhase('');
    }
  };

  const handleResendOtp = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email.trim().toLowerCase(),
      });
      if (error) throw error;
      setOtpResent(true);
    } catch (error) {
      console.error('Resend code failed:', error);
      setErrors({ otp: 'Could not resend the code — wait a moment and try again.' });
    }
  };

  const getStepTitle = (step) => {
    const titles = {
      1: 'Personal Information',
      2: 'Account Security',
      3: 'Role Selection',
      4: 'Emergency Contacts & Terms'
    };
    return titles?.[step];
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoSection
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
          />
        );
      case 2:
        return (
          <AccountCredentialsSection
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
          />
        );
      case 3:
        return (
          <RoleSelectionSection
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
          />
        );
      case 4:
        return (
          <div className="space-y-6">
            <EmergencyContactSection
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />
            {/* Terms and Conditions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Terms & Agreements</h3>
              
              <div className="space-y-3">
                <Checkbox
                  label="I agree to the Terms and Conditions"
                  description="By checking this box, you agree to our terms of service and user agreement"
                  checked={formData?.agreeToTerms}
                  onChange={(e) => handleInputChange({ target: { name: 'agreeToTerms', type: 'checkbox', checked: e?.target?.checked } })}
                  error={errors?.agreeToTerms}
                  required
                />
                
                <Checkbox
                  label="I agree to the Privacy Policy"
                  description="We will handle your personal information according to our privacy policy"
                  checked={formData?.agreeToPrivacy}
                  onChange={(e) => handleInputChange({ target: { name: 'agreeToPrivacy', type: 'checkbox', checked: e?.target?.checked } })}
                  error={errors?.agreeToPrivacy}
                  required
                />
                
                <Checkbox
                  label="I consent to emergency contact usage"
                  description="Allow us to contact your emergency contacts during emergency situations"
                  checked={formData?.agreeToEmergencyContact}
                  onChange={(e) => handleInputChange({ target: { name: 'agreeToEmergencyContact', type: 'checkbox', checked: e?.target?.checked } })}
                  error={errors?.agreeToEmergencyContact}
                  required
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95">
        <div className="w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600 ">
                <Icon name="Siren" size={20} color="white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Kalubihan Emergency Response</h1>
                <p className="text-xs text-muted-foreground">Create your account</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              iconName="ArrowLeft"
              iconPosition="left"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Progress Sidebar - Hidden on mobile, shown on lg screens */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
              <div className="sticky top-8 space-y-6">
                {/* Progress Steps */}
                <div className="bg-card rounded-2xl border border-slate-200/70 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Registration progress</h3>
                  <div className="space-y-3">
                    {Array.from({ length: totalSteps }, (_, index) => {
                      const step = index + 1;
                      const isActive = step === currentStep;
                      const isCompleted = step < currentStep;
                      
                      return (
                        <div key={step} className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                            isCompleted 
                              ? 'bg-success text-success-foreground' 
                              : isActive 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {isCompleted ? <Icon name="Check" size={16} /> : step}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              isActive ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {getStepTitle(step)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Trust Indicators */}
                <TrustIndicators />
              </div>
            </aside>

            {/* Main Form — swaps to the OTP screen once the account exists
                but the email still needs confirming */}
            <main className="flex-1 min-w-0 w-full">
              {awaitingOtp ? (
                <div className="bg-card rounded-2xl border border-slate-200/70 p-8 max-w-lg mx-auto space-y-6">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
                    <Icon name="MailCheck" size={28} className="text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
                    <p className="text-sm text-muted-foreground">
                      We sent a 6-digit verification code to{' '}
                      <span className="font-medium text-foreground">{formData?.email}</span>.
                      Enter it below to finish registering — this confirms the address is yours.
                    </p>
                  </div>

                  <div>
                    <Input
                      label="Verification code"
                      type="text"
                      inputMode="numeric"
                      name="otp"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e?.target?.value?.replace(/\D/g, '').slice(0, 6))}
                      error={errors?.otp}
                      required
                      className="w-full text-center tracking-widest text-lg"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    loading={isLoading}
                    iconName="ShieldCheck"
                    iconPosition="left"
                    className="w-full"
                  >
                    {isLoading ? (submitPhase || 'Verifying…') : 'Verify & finish registration'}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Didn't get the code? Check spam, or{' '}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-primary hover:underline font-medium"
                    >
                      resend it
                    </button>
                    {otpResent && <span className="text-success"> — sent again.</span>}
                  </p>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
              {/* Step Header */}
              <div className="bg-card rounded-2xl border border-slate-200/70 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Step {currentStep} of {totalSteps}: {getStepTitle(currentStep)}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentStep === 1 && "Let's start with your basic information"}
                      {currentStep === 2 && "Create secure login credentials"}
                      {currentStep === 3 && "Choose your role in the emergency response system"}
                      {currentStep === 4 && "Upload your ID for identity verification"}
                      {currentStep === 5 && "Add emergency contacts and review terms"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Progress</div>
                    <div className="text-lg font-semibold text-primary">
                      {Math.round((currentStep / totalSteps) * 100)}%
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-taste-500 transition-[width] duration-300"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step Content */}
              <div className="bg-card rounded-2xl border border-slate-200/70 p-6">
                {renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between bg-card rounded-2xl border border-slate-200/70 p-6">
                <div>
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      iconName="ChevronLeft"
                      iconPosition="left"
                    >
                      Previous
                    </Button>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  {currentStep < totalSteps ? (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      iconName="ChevronRight"
                      iconPosition="right"
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      loading={isLoading}
                      iconName="UserPlus"
                      iconPosition="left"
                      className="min-w-32"
                    >
                      {isLoading ? (submitPhase || 'Creating account…') : 'Create Account'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {errors?.submit && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Icon name="AlertCircle" size={16} className="text-error" />
                    <span className="text-sm text-error font-medium">{errors?.submit}</span>
                  </div>
                </div>
              )}
              </form>
              )}
            </main>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="border-t border-slate-200/70 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <p>&copy; {new Date()?.getFullYear()} Emergency Response System. All rights reserved.</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="hover:text-foreground transition-emergency">Privacy Policy</button>
              <button className="hover:text-foreground transition-emergency">Terms of Service</button>
              <button className="hover:text-foreground transition-emergency">Help & Support</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
