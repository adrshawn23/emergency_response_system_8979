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
          <div key={index} className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
              <Icon name={badge?.icon} size={16} className="text-indigo-600" />
            </div>
            <p className="text-[11px] font-semibold text-slate-700">{badge?.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustSignals;