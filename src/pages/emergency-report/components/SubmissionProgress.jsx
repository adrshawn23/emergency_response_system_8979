import React from 'react';
import Icon from '../../../components/AppIcon';

const SubmissionProgress = ({ 
  isSubmitting, 
  isSubmitted, 
  reportNumber = null,
  error = null 
}) => {
  if (!isSubmitting && !isSubmitted && !error) {
    return null;
  }

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050">
        <div className="bg-card rounded-lg p-8 max-w-md w-full mx-4 shadow-emergency-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin">
                <Icon name="Loader2" size={32} className="text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Submitting Emergency Report
            </h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your emergency report and notify the appropriate responders...
            </p>
            <div className="mt-6">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Uploading images and notifying dispatchers...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitted && reportNumber) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050">
        <div className="bg-card rounded-lg p-8 max-w-md w-full mx-4 shadow-emergency-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle" size={32} className="text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Report Submitted Successfully
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your emergency report has been submitted and dispatchers have been notified.
            </p>
            
            <div className="bg-muted rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Report Number:</span>
                <span className="text-sm font-mono font-bold text-primary">{reportNumber}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Save this number to track your report status
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="Clock" size={16} className="text-muted-foreground" />
                <span className="text-muted-foreground">Estimated response time: 5-15 minutes</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="Bell" size={16} className="text-muted-foreground" />
                <span className="text-muted-foreground">You'll receive updates via notifications</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="Phone" size={16} className="text-muted-foreground" />
                <span className="text-muted-foreground">Responders may contact you directly</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050">
        <div className="bg-card rounded-lg p-8 max-w-md w-full mx-4 shadow-emergency-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="XCircle" size={32} className="text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Submission Failed
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
            
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    For immediate emergencies
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If this is a life-threatening emergency, please call 911 directly
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SubmissionProgress;