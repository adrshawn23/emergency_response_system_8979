import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import Icon from '../../components/AppIcon';
import PersonalInfoSection from './components/PersonalInfoSection';
import AccountCredentialsSection from './components/AccountCredentialsSection';
import RoleSelectionSection from './components/RoleSelectionSection';
import IDUploadSection from './components/IDUploadSection';
import EmergencyContactSection from './components/EmergencyContactSection';
import TrustIndicators from './components/TrustIndicators';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    
    // Account Credentials
    password: '',
    confirmPassword: '',
    
    // Role Selection
    role: '',
    
    // ID Upload
    idDocument: null,
    
    // Emergency Contacts
    emergencyContacts: [],
    
    // Terms and Conditions
    agreeToTerms: false,
    agreeToPrivacy: false,
    agreeToEmergencyContact: false
  });

  const [errors, setErrors] = useState({});

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
        if (!formData?.email?.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/?.test(formData?.email)) {
          newErrors.email = 'Please enter a valid email address';
        }
        if (!formData?.phone?.trim()) {
          newErrors.phone = 'Phone number is required';
        } else if (!/^0\d{10}$/.test(formData?.phone)) {
          newErrors.phone = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
        }
        if (!formData?.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData?.address?.trim()) newErrors.address = 'Address is required';
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

      case 4: // ID Upload
        if (!formData?.idDocument) {
          newErrors.idDocument = 'ID document upload is required for verification';
        }
        break;

      case 5: // Emergency Contacts & Terms
        // Emergency contacts validation
        formData?.emergencyContacts?.forEach((contact, index) => {
          if (!contact?.name?.trim()) {
            newErrors[`emergencyContact_${contact.id}_name`] = 'Contact name is required';
          }
          if (!contact?.phone?.trim()) {
            newErrors[`emergencyContact_${contact.id}_phone`] = 'Contact phone is required';
          } else if (!/^0\d{10}$/.test(contact?.phone)) {
            newErrors[`emergencyContact_${contact.id}_phone`] = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
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
      const { data, error: signUpError } = await signUp(
        formData.email.trim(),
        formData.password,
        {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          date_of_birth: formData.dateOfBirth,
          address: formData.address,
          role: formData.role
        }
      );

      if (signUpError) throw signUpError;

      const userId = data.user.id;

      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: userId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        date_of_birth: formData.dateOfBirth,
        address: formData.address,
        role: formData.role,
        is_active: false
      });

      if (profileError) throw profileError;

      if (formData.emergencyContacts && formData.emergencyContacts.length > 0) {
        const { error: contactsError } = await supabase.from('emergency_contacts').insert(
          formData.emergencyContacts.map(contact => ({
            user_id: userId,
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship
          }))
        );

        if (contactsError) console.error('Failed to insert emergency contacts:', contactsError);
      }

      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please check your email for verification instructions.',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: error?.message || 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = (step) => {
    const titles = {
      1: 'Personal Information',
      2: 'Account Security',
      3: 'Role Selection',
      4: 'Identity Verification',
      5: 'Emergency Contacts & Terms'
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
          <IDUploadSection
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
          />
        );
      case 5:
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
      <div className="bg-card border-b border-border shadow-emergency">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Icon name="Shield" size={24} color="white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Emergency Response System</h1>
                <p className="text-sm text-muted-foreground">Create Your Account</p>
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Progress Steps */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">Registration Progress</h3>
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
          </div>

          {/* Main Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Step Header */}
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
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
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step Content */}
              <div className="bg-card rounded-lg border border-border p-6">
                {renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between bg-card rounded-lg border border-border p-6">
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
                      Create Account
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
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="bg-card border-t border-border mt-12">
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