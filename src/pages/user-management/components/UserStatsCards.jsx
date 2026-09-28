import React from 'react';
import Icon from '../../../components/AppIcon';

const UserStatsCards = ({ stats = {} }) => {
  const defaultStats = {
    totalUsers: 0,
    activeUsers: 0,
    pendingApprovals: 0,
    onlineUsers: 0,
    ...stats
  };

  const statsCards = [
    {
      title: 'Total Users',
      value: defaultStats?.totalUsers,
      icon: 'Users',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Active Users',
      value: defaultStats?.activeUsers,
      icon: 'UserCheck',
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: '+8%',
      changeType: 'positive'
    },
    {
      title: 'Pending Approvals',
      value: defaultStats?.pendingApprovals,
      icon: 'Clock',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      change: '-3%',
      changeType: 'negative'
    },
    {
      title: 'Online Now',
      value: defaultStats?.onlineUsers,
      icon: 'Wifi',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: '+15%',
      changeType: 'positive'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards?.map((card, index) => (
        <div key={index} className="bg-card rounded-lg border border-border shadow-emergency p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{card?.title}</p>
              <p className="text-2xl font-bold text-foreground mt-2">{card?.value?.toLocaleString()}</p>
              
              <div className="flex items-center mt-2">
                <Icon 
                  name={card?.changeType === 'positive' ? 'TrendingUp' : 'TrendingDown'} 
                  size={14} 
                  className={card?.changeType === 'positive' ? 'text-success' : 'text-destructive'} 
                />
                <span className={`text-sm font-medium ml-1 ${
                  card?.changeType === 'positive' ? 'text-success' : 'text-destructive'
                }`}>
                  {card?.change}
                </span>
                <span className="text-sm text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
            
            <div className={`w-12 h-12 rounded-lg ${card?.bgColor} flex items-center justify-center`}>
              <Icon name={card?.icon} size={24} className={card?.color} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserStatsCards;