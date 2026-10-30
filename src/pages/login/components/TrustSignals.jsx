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
    <div className="mt-8 pt-6 border-t border-slate-100">
      <div className="grid grid-cols-3 gap-3">
        {trustBadges?.map((badge, index) => (
          <div key={index} className="flex flex-col items-center gap-1 text-center">
            <Icon name={badge?.icon} size={16} className="text-slate-500" />
            <p className="text-[13px] font-medium text-slate-600">{badge?.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustSignals;