import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const ReportTable = ({ 
  reports = [], 
  selectedReports = [], 
  onSelectReport, 
  onSelectAll, 
  onReportAction,
  onViewDetails,
  loading = false,
  className = "" 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-error bg-error/10 border-error/20';
      case 'high': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'medium': return 'text-warning bg-warning/10 border-warning/20';
      case 'low': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-foreground bg-muted border-border';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-warning bg-warning/10 border-warning/20';
      case 'assigned': return 'text-primary bg-primary/10 border-primary/20';
      case 'in-progress': return 'text-accent bg-accent/10 border-accent/20';
      case 'resolved': return 'text-success bg-success/10 border-success/20';
      case 'declined': return 'text-destructive bg-destructive/10 border-destructive/20';
      default: return 'text-foreground bg-muted border-border';
    }
  };

  const getIncidentIcon = (type) => {
    switch (type) {
      case 'fire': return 'Flame';
      case 'medical': return 'Heart';
      case 'police': return 'Shield';
      case 'accident': return 'Car';
      case 'natural': return 'CloudRain';
      default: return 'AlertTriangle';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date?.toLocaleDateString();
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedReports = React.useMemo(() => {
    let sortableReports = [...reports];
    if (sortConfig?.key) {
      sortableReports?.sort((a, b) => {
        if (a?.[sortConfig?.key] < b?.[sortConfig?.key]) {
          return sortConfig?.direction === 'asc' ? -1 : 1;
        }
        if (a?.[sortConfig?.key] > b?.[sortConfig?.key]) {
          return sortConfig?.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableReports;
  }, [reports, sortConfig]);

  const isAllSelected = selectedReports?.length === reports?.length && reports?.length > 0;
  const isIndeterminate = selectedReports?.length > 0 && selectedReports?.length < reports?.length;

  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-lg shadow-emergency ${className}`}>
        <div className="p-8 text-center">
          <Icon name="Loader2" size={32} className="text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg shadow-emergency overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={onSelectAll}
                />
              </th>
              <th className="text-left p-4 font-semibold text-foreground">
                <button
                  onClick={() => handleSort('incidentType')}
                  className="flex items-center space-x-1 hover:text-primary transition-emergency"
                >
                  <span>Type</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-foreground">
                <button
                  onClick={() => handleSort('location')}
                  className="flex items-center space-x-1 hover:text-primary transition-emergency"
                >
                  <span>Location</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-foreground">
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center space-x-1 hover:text-primary transition-emergency"
                >
                  <span>Priority</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-foreground">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 hover:text-primary transition-emergency"
                >
                  <span>Status</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-foreground">Reporter</th>
              <th className="text-left p-4 font-semibold text-foreground">Assigned To</th>
              <th className="text-left p-4 font-semibold text-foreground">
                <button
                  onClick={() => handleSort('timestamp')}
                  className="flex items-center space-x-1 hover:text-primary transition-emergency"
                >
                  <span>Time</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-right p-4 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedReports?.length === 0 ? (
              <tr>
                <td colSpan="9" className="p-8 text-center">
                  <Icon name="FileX" size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No reports found</p>
                </td>
              </tr>
            ) : (
              sortedReports?.map((report) => (
                <tr 
                  key={report?.id} 
                  className="border-b border-border hover:bg-muted/50 transition-emergency"
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selectedReports?.includes(report?.id)}
                      onChange={() => onSelectReport(report?.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Icon 
                        name={getIncidentIcon(report?.incidentType)} 
                        size={16} 
                        className="text-muted-foreground" 
                      />
                      <span className="text-sm font-medium text-foreground capitalize">
                        {report?.incidentType?.replace('-', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-1">
                      <Icon name="MapPin" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{report?.location}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border capitalize ${getPriorityColor(report?.priority)}`}>
                      {report?.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border capitalize ${getStatusColor(report?.status)}`}>
                      {report?.status?.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-foreground">
                          {report?.reporter?.name?.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-foreground">{report?.reporter?.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {report?.assignedTo ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {report?.assignedTo?.name?.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-foreground">{report?.assignedTo?.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {formatTimestamp(report?.timestamp)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(report)}
                        iconName="Eye"
                        title="View Details"
                      />
                      {report?.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReportAction('accept', report)}
                            iconName="Check"
                            title="Accept Report"
                            className="text-success hover:text-success"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReportAction('decline', report)}
                            iconName="X"
                            title="Decline Report"
                            className="text-destructive hover:text-destructive"
                          />
                        </>
                      )}
                      {(report?.status === 'assigned' || report?.status === 'pending') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReportAction('assign', report)}
                          iconName="UserPlus"
                          title="Assign Responder"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTable;