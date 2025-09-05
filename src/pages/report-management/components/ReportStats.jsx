import React from 'react';
import Icon from '../../../components/AppIcon';

const ReportStats = ({ 
  stats = {}, 
  className = "" 
}) => {
  const defaultStats = {
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    declined: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    ...stats
  };

  const statusCards = [
    {
      label: 'Total Reports',
      value: defaultStats?.total,
      icon: 'FileText',
      color: 'text-foreground',
      bgColor: 'bg-muted'
    },
    {
      label: 'Pending',
      value: defaultStats?.pending,
      icon: 'Clock',
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      label: 'Assigned',
      value: defaultStats?.assigned,
      icon: 'UserCheck',
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      label: 'In Progress',
      value: defaultStats?.inProgress,
      icon: 'Activity',
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      label: 'Resolved',
      value: defaultStats?.resolved,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      label: 'Declined',
      value: defaultStats?.declined,
      icon: 'XCircle',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    }
  ];

  const priorityCards = [
    {
      label: 'Critical',
      value: defaultStats?.critical,
      icon: 'AlertTriangle',
      color: 'text-error',
      bgColor: 'bg-error/10'
    },
    {
      label: 'High',
      value: defaultStats?.high,
      icon: 'AlertCircle',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    },
    {
      label: 'Medium',
      value: defaultStats?.medium,
      icon: 'Info',
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      label: 'Low',
      value: defaultStats?.low,
      icon: 'Minus',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted'
    }
  ];

  const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status Overview */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Report Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards?.map((card) => (
            <div key={card?.label} className={`p-4 rounded-lg border border-border ${card?.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon name={card?.icon} size={20} className={card?.color} />
                <span className={`text-2xl font-bold ${card?.color}`}>
                  {card?.value}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{card?.label}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {calculatePercentage(card?.value, defaultStats?.total)}%
                  </span>
                  <div className="w-12 bg-border rounded-full h-1">
                    <div 
                      className={`h-1 rounded-full transition-emergency ${
                        card?.color?.includes('warning') ? 'bg-warning' :
                        card?.color?.includes('primary') ? 'bg-primary' :
                        card?.color?.includes('accent') ? 'bg-accent' :
                        card?.color?.includes('success') ? 'bg-success' :
                        card?.color?.includes('destructive') ? 'bg-destructive' :
                        card?.color?.includes('error') ? 'bg-error' : 'bg-muted-foreground'
                      }`}
                      style={{ width: `${calculatePercentage(card?.value, defaultStats?.total)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Priority Distribution */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Priority Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {priorityCards?.map((card) => (
            <div key={card?.label} className={`p-4 rounded-lg border border-border ${card?.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon name={card?.icon} size={18} className={card?.color} />
                <span className={`text-xl font-bold ${card?.color}`}>
                  {card?.value}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{card?.label}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {calculatePercentage(card?.value, defaultStats?.total)}%
                  </span>
                  <div className="w-10 bg-border rounded-full h-1">
                    <div 
                      className={`h-1 rounded-full transition-emergency ${
                        card?.color?.includes('error') ? 'bg-error' :
                        card?.color?.includes('destructive') ? 'bg-destructive' :
                        card?.color?.includes('warning') ? 'bg-warning' : 'bg-muted-foreground'
                      }`}
                      style={{ width: `${calculatePercentage(card?.value, defaultStats?.total)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Response Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="Clock" size={20} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Avg Response Time</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Critical:</span>
              <span className="text-sm font-medium text-foreground">4.2 min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">High:</span>
              <span className="text-sm font-medium text-foreground">8.7 min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Medium:</span>
              <span className="text-sm font-medium text-foreground">15.3 min</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="Target" size={20} className="text-success" />
            <h4 className="text-sm font-semibold text-foreground">Success Rate</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Resolution:</span>
              <span className="text-sm font-medium text-success">94.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">On Time:</span>
              <span className="text-sm font-medium text-success">87.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Satisfaction:</span>
              <span className="text-sm font-medium text-success">91.8%</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="Users" size={20} className="text-accent" />
            <h4 className="text-sm font-semibold text-foreground">Resource Usage</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Active Responders:</span>
              <span className="text-sm font-medium text-foreground">12/18</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Utilization:</span>
              <span className="text-sm font-medium text-accent">67%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Avg Load:</span>
              <span className="text-sm font-medium text-foreground">2.3/5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportStats;