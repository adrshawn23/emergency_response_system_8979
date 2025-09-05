import React from 'react';
import Icon from '../../../components/AppIcon';

const TrustIndicators = () => {
  const securityFeatures = [
    {
      icon: 'Shield',
      title: 'SSL Encrypted',
      description: '256-bit encryption protects your data'
    },
    {
      icon: 'Lock',
      title: 'Secure Storage',
      description: 'Your information is stored securely'
    },
    {
      icon: 'Eye',
      title: 'Privacy Protected',
      description: 'We never share your personal data'
    },
    {
      icon: 'CheckCircle',
      title: 'Verified System',
      description: 'Certified emergency response platform'
    }
  ];

  const complianceBadges = [
    {
      name: 'HIPAA Compliant',
      icon: 'FileCheck',
      color: 'text-success'
    },
    {
      name: 'SOC 2 Certified',
      icon: 'Award',
      color: 'text-primary'
    },
    {
      name: 'Emergency Services Approved',
      icon: 'Shield',
      color: 'text-accent'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Security Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityFeatures?.map((feature, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border">
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              <Icon name={feature?.icon} size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{feature?.title}</p>
              <p className="text-xs text-muted-foreground">{feature?.description}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Compliance Badges */}
      <div className="bg-muted rounded-lg p-4 border border-border">
        <h4 className="text-sm font-medium text-foreground mb-3 text-center">
          Trusted & Compliant Platform
        </h4>
        <div className="flex items-center justify-center space-x-6">
          {complianceBadges?.map((badge, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Icon name={badge?.icon} size={16} className={badge?.color} />
              <span className="text-xs font-medium text-foreground">{badge?.name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Emergency Services Partnership */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-4 border border-primary/20">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 p-2 bg-primary rounded-lg">
            <Icon name="Siren" size={20} color="white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Official Emergency Services Partner</h4>
            <p className="text-xs text-muted-foreground">
              Integrated with local police, fire, and medical emergency services for rapid response coordination
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustIndicators;