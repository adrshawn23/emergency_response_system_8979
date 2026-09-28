import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ReportDetailsModal = ({ 
  report, 
  isOpen, 
  onClose, 
  onReportAction,
  className = "" 
}) => {
  const [activeTab, setActiveTab] = useState('details');

  if (!isOpen || !report) return null;

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
    return new Date(timestamp)?.toLocaleString();
  };

  const mockResponseHistory = [
    {
      id: 1,
      action: 'Report Created',
      user: report?.reporter?.name,
      timestamp: report?.timestamp,
      details: 'Initial emergency report submitted'
    },
    {
      id: 2,
      action: 'Report Reviewed',
      user: 'Dispatcher Sarah Johnson',
      timestamp: new Date(report.timestamp.getTime() + 300000),
      details: 'Report reviewed and validated'
    },
    {
      id: 3,
      action: 'Responder Assigned',
      user: 'Dispatcher Sarah Johnson',
      timestamp: new Date(report.timestamp.getTime() + 600000),
      details: report?.assignedTo ? `Assigned to ${report?.assignedTo?.name}` : 'Awaiting assignment'
    }
  ];

  const tabs = [
    { id: 'details', label: 'Details', icon: 'FileText' },
    { id: 'location', label: 'Location', icon: 'MapPin' },
    { id: 'media', label: 'Media', icon: 'Image' },
    { id: 'history', label: 'History', icon: 'Clock' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className={`bg-card border border-border rounded-lg shadow-emergency-lg max-w-4xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Icon 
              name={getIncidentIcon(report?.incidentType)} 
              size={24} 
              className="text-primary" 
            />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Emergency Report #{report?.id}
              </h2>
              <p className="text-sm text-muted-foreground capitalize">
                {report?.incidentType?.replace('-', ' ')} Emergency
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 text-sm font-medium rounded-full border capitalize ${getPriorityColor(report?.priority)}`}>
              {report?.priority} Priority
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full border capitalize ${getStatusColor(report?.status)}`}>
              {report?.status?.replace('-', ' ')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              iconName="X"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {tabs?.map((tab) => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center space-x-2 py-4 text-sm font-medium border-b-2 transition-emergency ${
                  activeTab === tab?.id
                    ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={16} />
                <span>{tab?.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Reporter Information</label>
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {report?.reporter?.name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{report?.reporter?.name}</p>
                          <p className="text-xs text-muted-foreground">{report?.reporter?.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Incident Details</label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Type:</span>
                        <span className="text-sm text-foreground capitalize">{report?.incidentType?.replace('-', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Priority:</span>
                        <span className={`text-sm font-medium capitalize ${getPriorityColor(report?.priority)?.split(' ')?.[0]}`}>
                          {report?.priority}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className={`text-sm font-medium capitalize ${getStatusColor(report?.status)?.split(' ')?.[0]}`}>
                          {report?.status?.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Reported:</span>
                        <span className="text-sm text-foreground">{formatTimestamp(report?.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Assignment Information</label>
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      {report?.assignedTo ? (
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {report?.assignedTo?.name?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{report?.assignedTo?.name}</p>
                            <p className="text-xs text-muted-foreground">{report?.assignedTo?.department}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <Icon name="UserX" size={24} className="text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No responder assigned</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Response Time</label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Target Response:</span>
                        <span className="text-sm text-foreground">15 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Elapsed Time:</span>
                        <span className="text-sm text-warning font-medium">8 minutes</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-warning h-2 rounded-full" style={{ width: '53%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <p className="text-sm text-foreground">{report?.description}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Location Details</label>
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="MapPin" size={16} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">{report?.location}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {report?.coordinates?.lat || '40.7128'}, {report?.coordinates?.lng || '-74.0060'}
                  </p>
                </div>
              </div>
              
              <div className="h-64 bg-muted rounded-md overflow-hidden">
                <iframe
                  width="100%"
                  height="100%"
                  loading="lazy"
                  title={report?.location}
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${report?.coordinates?.lat || '40.7128'},${report?.coordinates?.lng || '-74.0060'}&z=14&output=embed`}
                  className="border-0"
                />
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Attached Images</label>
                {report?.images && report?.images?.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {report?.images?.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Evidence ${index + 1}`}
                          className="w-full h-32 object-cover rounded-md"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-emergency rounded-md flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconName="Expand"
                            className="text-white hover:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 p-8 text-center bg-muted rounded-md">
                    <Icon name="ImageOff" size={32} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No images attached</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Response History</label>
                <div className="mt-2 space-y-3">
                  {mockResponseHistory?.map((entry) => (
                    <div key={entry?.id} className="flex items-start space-x-3 p-3 bg-muted rounded-md">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{entry?.action}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(entry?.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">by {entry?.user}</p>
                        <p className="text-sm text-foreground mt-1">{entry?.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <div className="flex items-center space-x-2">
            <Icon name="Clock" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Last updated: {formatTimestamp(new Date())}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {report?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => onReportAction('decline', report)}
                  iconName="X"
                  iconPosition="left"
                >
                  Decline
                </Button>
                <Button
                  variant="success"
                  onClick={() => onReportAction('accept', report)}
                  iconName="Check"
                  iconPosition="left"
                >
                  Accept
                </Button>
              </>
            )}
            {(report?.status === 'assigned' || report?.status === 'pending') && (
              <Button
                variant="default"
                onClick={() => onReportAction('assign', report)}
                iconName="UserPlus"
                iconPosition="left"
              >
                Assign Responder
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailsModal;