import React from 'react';
import Icon from '../../../components/AppIcon';

const TrustSignals = () => {
  const trustBadges = [
    {
      icon: 'Shield',
      title: 'SSL Secured',
      description: 'Your data is encrypted and secure'
    },
    {
      icon: 'Award',
      title: 'Emergency Certified',
      description: 'Compliant with emergency response standards'
    },
    {
      icon: 'Clock',
      title: '24/7 Available',
      description: 'Always ready for emergency situations'
    }
  ];

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {trustBadges?.map((badge, index) => (
          <div key={index} className="flex items-center space-x-2 text-center sm:text-left">
            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name={badge?.icon} size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">{badge?.title}</p>
              <p className="text-xs text-muted-foreground">{badge?.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustSignals;