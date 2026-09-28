import React from 'react';
import Icon from '../../../components/AppIcon';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DepartmentDistribution = ({ departmentData = [] }) => {
  const defaultData = [
    { name: 'Fire Department', value: 45, color: '#EF4444' },
    { name: 'Police Department', value: 38, color: '#3B82F6' },
    { name: 'Medical Services', value: 32, color: '#10B981' },
    { name: 'Administration', value: 15, color: '#F59E0B' }
  ];

  const data = departmentData?.length > 0 ? departmentData : defaultData;
  const totalUsers = data?.reduce((sum, dept) => sum + dept?.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      return (
        <div className="bg-popover border border-border rounded-lg shadow-emergency-lg p-3">
          <p className="font-medium text-foreground">{data?.name}</p>
          <p className="text-sm text-muted-foreground">
            {data?.value} users ({((data?.value / totalUsers) * 100)?.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const getDepartmentIcon = (name) => {
    const icons = {
      'Fire Department': 'Flame',
      'Police Department': 'Shield',
      'Medical Services': 'Heart',
      'Administration': 'Building'
    };
    return icons?.[name] || 'Users';
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Department Distribution</h3>
          <p className="text-sm text-muted-foreground">User allocation across departments</p>
        </div>
        <div className="flex items-center space-x-2">
          <Icon name="PieChart" size={16} className="text-primary" />
          <span className="text-sm font-medium text-primary">Active Users</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry?.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Department List */}
        <div className="space-y-4">
          {data?.map((dept, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept?.color }}
                ></div>
                <Icon name={getDepartmentIcon(dept?.name)} size={16} className="text-muted-foreground" />
                <span className="font-medium text-foreground">{dept?.name}</span>
              </div>
              
              <div className="text-right">
                <p className="font-semibold text-foreground">{dept?.value}</p>
                <p className="text-xs text-muted-foreground">
                  {((dept?.value / totalUsers) * 100)?.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
          
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Total Users</span>
              <span className="font-bold text-lg text-primary">{totalUsers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentDistribution;