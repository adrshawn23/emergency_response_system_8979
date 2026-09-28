import React from 'react';
import Icon from '../../../components/AppIcon';

const DepartmentStats = ({ departments = [] }) => {
  // Calculate statistics
  const totalDepartments = departments?.length;
  const activeDepartments = departments?.filter(d => d?.status === 'active')?.length;
  const totalMembers = departments?.reduce((sum, d) => sum + d?.totalMembers, 0);
  const totalActiveResponders = departments?.reduce((sum, d) => sum + d?.activeResponders, 0);
  const avgResponseTime = departments?.length > 0 
    ? Math.round(departments?.reduce((sum, d) => {
        const time = parseInt(d?.avgResponseTime?.replace('m', '')) || 0;
        return sum + time;
      }, 0) / departments?.length)
    : 0;
  const totalIncidents = departments?.reduce((sum, d) => sum + d?.incidentsHandled, 0);

  const stats = [
    {
      label: 'Total Departments',
      value: totalDepartments,
      icon: 'Building',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: '+2 this month',
      changeType: 'positive'
    },
    {
      label: 'Active Departments',
      value: activeDepartments,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: `${Math.round((activeDepartments / totalDepartments) * 100)}% active`,
      changeType: 'neutral'
    },
    {
      label: 'Total Members',
      value: totalMembers,
      icon: 'Users',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      change: '+12 this week',
      changeType: 'positive'
    },
    {
      label: 'Active Responders',
      value: totalActiveResponders,
      icon: 'Shield',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: `${Math.round((totalActiveResponders / totalMembers) * 100)}% active`,
      changeType: 'neutral'
    },
    {
      label: 'Avg Response Time',
      value: `${avgResponseTime}m`,
      icon: 'Clock',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      change: '-2m improved',
      changeType: 'positive'
    },
    {
      label: 'Incidents Handled',
      value: totalIncidents,
      icon: 'AlertTriangle',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      change: '+8 this week',
      changeType: 'neutral'
    }
  ];

  const getChangeColor = (type) => {
    switch (type) {
      case 'positive': return 'text-success';
      case 'negative': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getChangeIcon = (type) => {
    switch (type) {
      case 'positive': return 'TrendingUp';
      case 'negative': return 'TrendingDown';
      default: return 'Minus';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats?.map((stat, index) => (
        <div key={index} className="bg-card border border-border rounded-lg p-6 shadow-emergency hover:shadow-emergency-lg transition-emergency">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${stat?.bgColor}`}>
              <Icon name={stat?.icon} size={24} className={stat?.color} />
            </div>
            <div className={`flex items-center space-x-1 text-xs ${getChangeColor(stat?.changeType)}`}>
              <Icon name={getChangeIcon(stat?.changeType)} size={12} />
              <span>{stat?.change}</span>
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-1">{stat?.value}</h3>
            <p className="text-sm text-muted-foreground">{stat?.label}</p>
          </div>

          {/* Progress bar for percentage-based stats */}
          {stat?.label?.includes('Active') && totalDepartments > 0 && (
            <div className="mt-4">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${stat?.color?.replace('text-', 'bg-')}`}
                  style={{ width: `${(stat?.value / totalDepartments) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DepartmentStats;