import React, { useState, useEffect } from 'react';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import ReportFilters from './components/ReportFilters';
import ReportTable from './components/ReportTable';
import ReportDetailsModal from './components/ReportDetailsModal';
import AssignResponderModal from './components/AssignResponderModal';
import DeclineReasonModal from './components/DeclineReasonModal';
import BulkActionsPanel from './components/BulkActionsPanel';
import ReportStats from './components/ReportStats';

const ReportManagement = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('table'); // 'table', 'stats'
  
  // Modal states
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Mock data
  const mockReports = [
    {
      id: 'RPT-001',
      incidentType: 'fire',
      location: '123 Main Street, Downtown',
      priority: 'critical',
      status: 'pending',
      reporter: {
        name: 'John Smith',
        phone: '+1 (555) 123-4567'
      },
      assignedTo: null,
      description: `Large fire reported at residential building. Multiple residents trapped on upper floors. Heavy smoke visible from street level. Fire department response urgently needed.`,
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      coordinates: { lat: 40.7128, lng: -74.0060 },
      images: [
        'https://images.unsplash.com/photo-1574869711319-2a4b1d2b3c5c?w=400',
        'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'
      ]
    },
    {
      id: 'RPT-002',
      incidentType: 'medical',
      location: '456 Oak Avenue, Midtown',
      priority: 'high',
      status: 'assigned',
      reporter: {
        name: 'Sarah Johnson',
        phone: '+1 (555) 234-5678'
      },
      assignedTo: {
        name: 'Paramedic Mike Johnson',
        department: 'Medical Services'
      },
      description: `Elderly person collapsed at home. Conscious but experiencing chest pain and difficulty breathing. Family member requesting immediate medical assistance.`,
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      coordinates: { lat: 40.7589, lng: -73.9851 },
      images: []
    },
    {
      id: 'RPT-003',
      incidentType: 'police',
      location: '789 Pine Street, Uptown',
      priority: 'medium',
      status: 'in-progress',
      reporter: {
        name: 'Mike Davis',
        phone: '+1 (555) 345-6789'
      },
      assignedTo: {
        name: 'Officer John Martinez',
        department: 'Police Department'
      },
      description: `Suspicious activity reported near commercial building. Multiple individuals seen attempting to access restricted areas after business hours.`,
      timestamp: new Date(Date.now() - 2700000), // 45 minutes ago
      coordinates: { lat: 40.7831, lng: -73.9712 },
      images: [
        'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400'
      ]
    },
    {
      id: 'RPT-004',
      incidentType: 'accident',
      location: '321 Elm Street, Southside',
      priority: 'high',
      status: 'resolved',
      reporter: {
        name: 'Lisa Chen',
        phone: '+1 (555) 456-7890'
      },
      assignedTo: {
        name: 'Officer Lisa Thompson',
        department: 'Police Department'
      },
      description: `Multi-vehicle accident at busy intersection. Two cars involved with possible injuries. Traffic backup forming, need immediate response for scene management.`,
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      coordinates: { lat: 40.7282, lng: -73.9942 },
      images: []
    },
    {
      id: 'RPT-005',
      incidentType: 'natural',
      location: '654 Maple Drive, Westside',
      priority: 'low',
      status: 'declined',
      reporter: {
        name: 'Robert Wilson',
        phone: '+1 (555) 567-8901'
      },
      assignedTo: null,
      description: `Tree branch fell across sidewalk after recent storm. No immediate danger to pedestrians but may need removal for accessibility.`,
      timestamp: new Date(Date.now() - 5400000), // 1.5 hours ago
      coordinates: { lat: 40.7505, lng: -73.9934 },
      images: []
    },
    {
      id: 'RPT-006',
      incidentType: 'fire',
      location: '987 Cedar Lane, Eastside',
      priority: 'medium',
      status: 'assigned',
      reporter: {
        name: 'Emma Thompson',
        phone: '+1 (555) 678-9012'
      },
      assignedTo: {
        name: 'Firefighter Sarah Chen',
        department: 'Fire Department'
      },
      description: `Small kitchen fire reported in apartment building. Resident evacuated safely but smoke alarm system activated. Fire suppression needed.`,
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      coordinates: { lat: 40.7614, lng: -73.9776 },
      images: [
        'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400'
      ]
    }
  ];

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Report Management', path: '/report-management' }
  ];

  // Calculate stats
  const stats = {
    total: mockReports?.length,
    pending: mockReports?.filter(r => r?.status === 'pending')?.length,
    assigned: mockReports?.filter(r => r?.status === 'assigned')?.length,
    inProgress: mockReports?.filter(r => r?.status === 'in-progress')?.length,
    resolved: mockReports?.filter(r => r?.status === 'resolved')?.length,
    declined: mockReports?.filter(r => r?.status === 'declined')?.length,
    critical: mockReports?.filter(r => r?.priority === 'critical')?.length,
    high: mockReports?.filter(r => r?.priority === 'high')?.length,
    medium: mockReports?.filter(r => r?.priority === 'medium')?.length,
    low: mockReports?.filter(r => r?.priority === 'low')?.length
  };

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setReports(mockReports);
      setFilteredReports(mockReports);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Apply filters and search
    let filtered = [...reports];

    // Apply filters
    if (filters?.status && filters?.status !== 'all') {
      filtered = filtered?.filter(report => report?.status === filters?.status);
    }
    if (filters?.priority && filters?.priority !== 'all') {
      filtered = filtered?.filter(report => report?.priority === filters?.priority);
    }
    if (filters?.incidentType && filters?.incidentType !== 'all') {
      filtered = filtered?.filter(report => report?.incidentType === filters?.incidentType);
    }
    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered?.filter(report => new Date(report.timestamp) >= fromDate);
    }
    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate?.setHours(23, 59, 59, 999);
      filtered = filtered?.filter(report => new Date(report.timestamp) <= toDate);
    }
    if (filters?.location) {
      filtered = filtered?.filter(report => 
        report?.location?.toLowerCase()?.includes(filters?.location?.toLowerCase())
      );
    }
    if (filters?.reporter) {
      filtered = filtered?.filter(report => 
        report?.reporter?.name?.toLowerCase()?.includes(filters?.reporter?.toLowerCase())
      );
    }
    if (filters?.responder) {
      filtered = filtered?.filter(report => 
        report?.assignedTo?.name?.toLowerCase()?.includes(filters?.responder?.toLowerCase())
      );
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered?.filter(report =>
        report?.id?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.location?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.description?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.reporter?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase())
      );
    }

    setFilteredReports(filtered);
  }, [reports, filters, searchQuery]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleSelectReport = (reportId) => {
    setSelectedReports(prev => 
      prev?.includes(reportId) 
        ? prev?.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAll = () => {
    if (selectedReports?.length === filteredReports?.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports?.map(report => report?.id));
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  };

  const handleReportAction = (action, report) => {
    setSelectedReport(report);
    switch (action) {
      case 'assign':
        setShowAssignModal(true);
        break;
      case 'decline':
        setShowDeclineModal(true);
        break;
      case 'accept':
        handleAcceptReport(report);
        break;
      default:
        break;
    }
  };

  const handleAcceptReport = (report) => {
    setReports(prev => prev?.map(r => 
      r?.id === report?.id 
        ? { ...r, status: 'assigned' }
        : r
    ));
  };

  const handleAssignResponder = (assignmentData) => {
    setReports(prev => prev?.map(r => 
      r?.id === assignmentData?.reportId 
        ? { 
            ...r, 
            status: 'assigned',
            assignedTo: {
              name: assignmentData?.responderData?.label,
              department: assignmentData?.responderData?.department
            },
            priority: assignmentData?.priority
          }
        : r
    ));
    setShowAssignModal(false);
  };

  const handleDeclineReport = (declineData) => {
    setReports(prev => prev?.map(r => 
      r?.id === declineData?.reportId 
        ? { ...r, status: 'declined' }
        : r
    ));
    setShowDeclineModal(false);
  };

  const handleBulkAction = (actionData) => {
    switch (actionData?.action) {
      case 'accept':
        setReports(prev => prev?.map(r => 
          actionData?.reportIds?.includes(r?.id) 
            ? { ...r, status: 'assigned' }
            : r
        ));
        break;
      case 'decline':
        setReports(prev => prev?.map(r => 
          actionData?.reportIds?.includes(r?.id) 
            ? { ...r, status: 'declined' }
            : r
        ));
        break;
      case 'export':
        console.log('Exporting reports:', actionData?.reportIds);
        break;
      default:
        break;
    }
    setSelectedReports([]);
  };

  const handleNavigation = (path) => {
    window.location.href = path;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <BreadcrumbNavigation 
              items={breadcrumbItems} 
              onNavigate={handleNavigation}
              className="mb-2"
            />
            <div className="flex items-center space-x-3">
              <Icon name="FileText" size={32} className="text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Report Management</h1>
                <p className="text-muted-foreground">
                  Monitor and coordinate emergency incident responses
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-card border border-border rounded-lg p-1">
              <Button
                variant={currentView === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('table')}
                iconName="Table"
              >
                Table
              </Button>
              <Button
                variant={currentView === 'stats' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('stats')}
                iconName="BarChart3"
              >
                Stats
              </Button>
            </div>
            
            <Button
              variant="default"
              onClick={() => handleNavigation('/emergency-report')}
              iconName="Plus"
              iconPosition="left"
            >
              New Report
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Icon 
              name="Search" 
              size={20} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              type="text"
              placeholder="Search reports by ID, location, description, or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            iconName="RefreshCw"
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1000);
            }}
            title="Refresh reports"
          />
        </div>

        {/* Filters */}
        <ReportFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* Bulk Actions */}
        {selectedReports?.length > 0 && (
          <BulkActionsPanel
            selectedReports={selectedReports}
            onBulkAction={handleBulkAction}
            onClearSelection={() => setSelectedReports([])}
          />
        )}

        {/* Content */}
        {currentView === 'table' ? (
          <div className="space-y-4">
            {/* Results Summary */}
            <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Icon name="FileText" size={16} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {filteredReports?.length} of {reports?.length} reports
                  </span>
                </div>
                {selectedReports?.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Icon name="CheckSquare" size={16} className="text-primary" />
                    <span className="text-sm text-primary">
                      {selectedReports?.length} selected
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Download"
                  onClick={() => console.log('Export all reports')}
                >
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Filter"
                  onClick={() => console.log('Advanced filters')}
                >
                  Advanced
                </Button>
              </div>
            </div>

            {/* Reports Table */}
            <ReportTable
              reports={filteredReports}
              selectedReports={selectedReports}
              onSelectReport={handleSelectReport}
              onSelectAll={handleSelectAll}
              onReportAction={handleReportAction}
              onViewDetails={handleViewDetails}
              loading={loading}
            />
          </div>
        ) : (
          <ReportStats stats={stats} />
        )}

        {/* Modals */}
        <ReportDetailsModal
          report={selectedReport}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedReport(null);
          }}
          onReportAction={handleReportAction}
        />

        <AssignResponderModal
          report={selectedReport}
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedReport(null);
          }}
          onAssign={handleAssignResponder}
        />

        <DeclineReasonModal
          report={selectedReport}
          isOpen={showDeclineModal}
          onClose={() => {
            setShowDeclineModal(false);
            setSelectedReport(null);
          }}
          onDecline={handleDeclineReport}
        />
      </div>
    </div>
  );
};

export default ReportManagement;