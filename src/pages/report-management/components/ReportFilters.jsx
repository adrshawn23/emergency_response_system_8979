import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const ReportFilters = ({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'declined', label: 'Declined' }
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const incidentTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'fire', label: 'Fire Emergency' },
    { value: 'medical', label: 'Medical Emergency' },
    { value: 'police', label: 'Police Matter' },
    { value: 'accident', label: 'Traffic Accident' },
    { value: 'natural', label: 'Natural Disaster' },
    { value: 'other', label: 'Other' }
  ];

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    { value: 'fire', label: 'Fire Department' },
    { value: 'police', label: 'Police Department' },
    { value: 'medical', label: 'Medical Services' },
    { value: 'emergency', label: 'Emergency Management' }
  ];

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const hasActiveFilters = Object.values(filters)?.some(value => 
    value && value !== 'all' && value !== ''
  );

  return (
    <div className={`bg-card border border-border rounded-lg shadow-emergency ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon name="Filter" size={20} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            {hasActiveFilters && (
              <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                iconName="X"
                iconPosition="left"
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              iconName={isExpanded ? "ChevronUp" : "ChevronDown"}
              iconPosition="right"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </div>
      <div className={`transition-all duration-300 ${isExpanded ? 'block' : 'hidden'}`}>
        <div className="p-4 space-y-4">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Status"
              options={statusOptions}
              value={filters?.status || 'all'}
              onChange={(value) => handleFilterChange('status', value)}
              className="w-full"
            />
            
            <Select
              label="Priority"
              options={priorityOptions}
              value={filters?.priority || 'all'}
              onChange={(value) => handleFilterChange('priority', value)}
              className="w-full"
            />
            
            <Select
              label="Incident Type"
              options={incidentTypeOptions}
              value={filters?.incidentType || 'all'}
              onChange={(value) => handleFilterChange('incidentType', value)}
              className="w-full"
            />
            
            <Select
              label="Department"
              options={departmentOptions}
              value={filters?.department || 'all'}
              onChange={(value) => handleFilterChange('department', value)}
              className="w-full"
            />
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Date From"
              type="date"
              value={filters?.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e?.target?.value)}
              className="w-full"
            />
            
            <Input
              label="Date To"
              type="date"
              value={filters?.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e?.target?.value)}
              className="w-full"
            />
            
            <Input
              label="Location"
              type="text"
              placeholder="Search by location..."
              value={filters?.location || ''}
              onChange={(e) => handleFilterChange('location', e?.target?.value)}
              className="w-full"
            />
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Reporter Name"
              type="text"
              placeholder="Search by reporter name..."
              value={filters?.reporter || ''}
              onChange={(e) => handleFilterChange('reporter', e?.target?.value)}
              className="w-full"
            />
            
            <Input
              label="Assigned Responder"
              type="text"
              placeholder="Search by responder name..."
              value={filters?.responder || ''}
              onChange={(e) => handleFilterChange('responder', e?.target?.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>
      {/* Quick Filter Buttons */}
      <div className="p-4 border-t border-border">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters?.status === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', filters?.status === 'pending' ? 'all' : 'pending')}
          >
            Pending Reports
          </Button>
          <Button
            variant={filters?.priority === 'critical' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('priority', filters?.priority === 'critical' ? 'all' : 'critical')}
          >
            Critical Priority
          </Button>
          <Button
            variant={filters?.status === 'in-progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', filters?.status === 'in-progress' ? 'all' : 'in-progress')}
          >
            In Progress
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date()?.toISOString()?.split('T')?.[0];
              handleFilterChange('dateFrom', today);
              handleFilterChange('dateTo', today);
            }}
          >
            Today's Reports
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;