import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import EmergencyTypeSelector from './components/EmergencyTypeSelector';
import LocationInput from './components/LocationInput';
import PrioritySelector from './components/PrioritySelector';
import ImageUpload from './components/ImageUpload';
import EmergencyContacts from './components/EmergencyContacts';
import SubmissionProgress from './components/SubmissionProgress';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import { mockEmergencyReports } from '../../data/mockData';

const EmergencyReport = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { useMock } = useMockData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    emergencyType: '',
    location: '',
    priority: '',
    description: '',
    contactName: '',
    contactPhone: '',
    images: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reportNumber, setReportNumber] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  // Auto-save to localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('emergency-report-draft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading saved draft:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (formData?.emergencyType || formData?.location || formData?.description) {
      localStorage.setItem('emergency-report-draft', JSON.stringify(formData));
    }
  }, [formData]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Emergency Report', path: '/emergency-report' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.emergencyType) {
      newErrors.emergencyType = 'Please select an emergency type';
    }

    if (!formData?.location?.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData?.priority) {
      newErrors.priority = 'Please select a priority level';
    }

    if (!formData?.description?.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData?.description?.trim()?.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData?.contactName?.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    if (!formData?.contactPhone?.trim()) {
      newErrors.contactPhone = 'Contact phone is required';
    } else if (!/^0\d{10}$/.test(formData?.contactPhone?.trim())) {
      newErrors.contactPhone = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      let reportData;
      
      if (useMock) {
        // Mock mode: add to mock data
        const newReport = {
          report_id: `REP-${String(mockEmergencyReports.length + 1).padStart(3, '0')}`,
          reporter_id: user.id,
          emergency_type: formData.emergencyType,
          location: formData.location,
          priority: formData.priority,
          description: formData.description,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          status: 'pending',
          images: formData.images,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assigned_to: null
        };
        mockEmergencyReports.unshift(newReport);
        reportData = newReport;
      } else {
        // Supabase mode
        const { data, error: reportError } = await supabase.from('emergency_reports').insert({
          reporter_id: user.id,
          emergency_type: formData.emergencyType,
          location: formData.location,
          priority: formData.priority,
          description: formData.description,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          status: 'pending',
          images: formData.images
        }).select().single();

        if (reportError) throw reportError;
        reportData = data;
      }

      setReportNumber(reportData.report_id);
      setIsSubmitted(true);
      
      localStorage.removeItem('emergency-report-draft');
      
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          emergencyType: '',
          location: '',
          priority: '',
          description: '',
          contactName: '',
          contactPhone: '',
          images: []
        });
        navigate('/');
      }, 5000);
      
    } catch (error) {
      setSubmissionError('Failed to submit emergency report. Please try again or call 911 for immediate assistance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getCharacterCount = () => {
    return formData?.description?.length;
  };

  const getCharacterCountColor = () => {
    const count = getCharacterCount();
    if (count < 10) return 'text-destructive';
    if (count > 500) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={user} 
        notificationCount={3}
        onNavigate={navigate}
      />
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        user={user}
        onNavigate={navigate}
      />
      <main className={`pt-16 transition-emergency ${
        isSidebarCollapsed ? 'pl-16' : 'pl-64'
      }`}>
        <div className="p-6">
          {/* Header Section */}
          <div className="mb-6">
            <BreadcrumbNavigation 
              items={breadcrumbItems}
              onNavigate={navigate}
            />
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-foreground">Emergency Report</h1>
              <p className="text-muted-foreground mt-1">
                Submit an emergency incident report to notify responders and coordinate assistance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center space-x-2 mb-6">
                    <Icon name="AlertTriangle" size={20} className="text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Emergency Details
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <EmergencyTypeSelector
                      selectedType={formData?.emergencyType}
                      onTypeSelect={(type) => handleInputChange('emergencyType', type)}
                      error={errors?.emergencyType}
                    />

                    <LocationInput
                      location={formData?.location}
                      onLocationChange={(location) => handleInputChange('location', location)}
                      error={errors?.location}
                    />

                    <PrioritySelector
                      selectedPriority={formData?.priority}
                      onPrioritySelect={(priority) => handleInputChange('priority', priority)}
                      error={errors?.priority}
                    />

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Detailed Description <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        value={formData?.description}
                        onChange={(e) => handleInputChange('description', e?.target?.value)}
                        placeholder="Provide a detailed description of the emergency situation, including what happened, when it occurred, and any immediate dangers or concerns..."
                        rows={6}
                        className={`w-full px-3 py-2 border rounded-md text-sm transition-emergency resize-none ${
                          errors?.description 
                            ? 'border-destructive focus:ring-destructive' :'border-border focus:ring-primary focus:border-primary'
                        }`}
                      />
                      <div className="flex justify-between items-center mt-2">
                        {errors?.description && (
                          <p className="text-sm text-destructive flex items-center space-x-1">
                            <Icon name="AlertCircle" size={16} />
                            <span>{errors?.description}</span>
                          </p>
                        )}
                        <p className={`text-xs ml-auto ${getCharacterCountColor()}`}>
                          {getCharacterCount()}/1000 characters
                          {getCharacterCount() < 10 && ' (minimum 10)'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center space-x-2 mb-6">
                    <Icon name="User" size={20} className="text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Contact Information
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Contact Name"
                      type="text"
                      placeholder="Your full name"
                      value={formData?.contactName}
                      onChange={(e) => handleInputChange('contactName', e?.target?.value)}
                      error={errors?.contactName}
                      required
                    />

                    <Input
                      label="Contact Phone"
                      type="tel"
                      placeholder="09948270026"
                      value={formData?.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e?.target?.value)}
                      error={errors?.contactPhone}
                      pattern="[0-9]{11}"
                      maxLength={11}
                      required
                    />
                  </div>
                </div>

                <ImageUpload
                  images={formData?.images}
                  onImagesChange={(images) => handleInputChange('images', images)}
                  maxImages={5}
                />

                {/* Submit Button */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Submit Emergency Report
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Review your information and submit to notify emergency responders
                      </p>
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      iconName="Send"
                      iconPosition="right"
                      className="bg-destructive hover:bg-destructive/90 text-white"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Emergency Report'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <EmergencyContacts />

              {/* Quick Tips */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Icon name="Lightbulb" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Quick Tips
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Icon name="CheckCircle" size={16} className="text-success mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Be as specific as possible with location details
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Icon name="CheckCircle" size={16} className="text-success mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Include photos if safe to do so
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Icon name="CheckCircle" size={16} className="text-success mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Stay available for responder contact
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Icon name="CheckCircle" size={16} className="text-success mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Save your report number for tracking
                    </p>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Icon name="Activity" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    System Status
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Emergency Services</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse-subtle"></div>
                      <span className="text-sm text-success font-medium">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Dispatch Center</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse-subtle"></div>
                      <span className="text-sm text-success font-medium">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Response Time</span>
                    <span className="text-sm text-foreground font-medium">5-15 min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SubmissionProgress
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        reportNumber={reportNumber}
        error={submissionError}
      />
    </div>
  );
};

export default EmergencyReport;