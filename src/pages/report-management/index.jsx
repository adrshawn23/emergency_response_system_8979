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
import TurnoverReportModal from './components/TurnoverReportModal';
import BulkActionsPanel from './components/BulkActionsPanel';
import ReportStats from './components/ReportStats';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import { mockEmergencyReports } from '../../data/mockData';

const ReportManagement = () => {
  const { user, profile } = useAuth();
  const { useMock } = useMockData();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('table');
  
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showTurnoverModal, setShowTurnoverModal] = useState(false);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Report Management', path: '/report-management' }
  ];

  const stats = {
    total: reports?.length,
    pending: reports?.filter(r => r?.status === 'pending')?.length,
    assigned: reports?.filter(r => r?.status === 'assigned')?.length,
    inProgress: reports?.filter(r => r?.status === 'in-progress')?.length,
    resolved: reports?.filter(r => r?.status === 'resolved')?.length,
    declined: reports?.filter(r => r?.status === 'declined')?.length,
    critical: reports?.filter(r => r?.priority === 'critical')?.length,
    high: reports?.filter(r => r?.priority === 'high')?.length,
    medium: reports?.filter(r => r?.priority === 'medium')?.length,
    low: reports?.filter(r => r?.priority === 'low')?.length
  };

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        if (useMock) {
          // Use mock data
          let mockData = [...mockEmergencyReports];
          if (profile?.role === 'resident') {
            mockData = mockData.filter(r => r.reporter_id === user.id);
          }
          setReports(mockData);
          setFilteredReports(mockData);
        } else {
          // Use Supabase
          let query = supabase.from('emergency_reports').select('*');
          
          if (profile?.role === 'resident') {
            query = query.eq('reporter_id', user.id);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false });
          
          if (error) throw error;
          setReports(data || []);
          setFilteredReports(data || []);
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user, profile, useMock]);

  useEffect(() => {
    let filtered = [...reports];

    if (filters?.status && filters?.status !== 'all') {
      filtered = filtered?.filter(report => report?.status === filters?.status);
    }
    if (filters?.priority && filters?.priority !== 'all') {
      filtered = filtered?.filter(report => report?.priority === filters?.priority);
    }
    if (filters?.incidentType && filters?.incidentType !== 'all') {
      filtered = filtered?.filter(report => report?.emergency_type === filters?.incidentType);
    }
    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered?.filter(report => new Date(report.created_at) >= fromDate);
    }
    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate?.setHours(23, 59, 59, 999);
      filtered = filtered?.filter(report => new Date(report.created_at) <= toDate);
    }
    if (filters?.location) {
      filtered = filtered?.filter(report => 
        report?.location?.toLowerCase()?.includes(filters?.location?.toLowerCase())
      );
    }
    if (filters?.reporter) {
      filtered = filtered?.filter(report => 
        report?.contact_name?.toLowerCase()?.includes(filters?.reporter?.toLowerCase())
      );
    }

    if (searchQuery) {
      filtered = filtered?.filter(report =>
        report?.report_id?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.location?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.description?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        report?.contact_name?.toLowerCase()?.includes(searchQuery?.toLowerCase())
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
      setSelectedReports(filteredReports?.map(report => report?.report_id));
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
      case 'turnover':
        setShowTurnoverModal(true);
        break;
      default:
        break;
    }
  };

  const handleAcceptReport = async (report) => {
    try {
      const { error } = await supabase
        .from('emergency_reports')
        .update({ status: 'assigned' })
        .eq('report_id', report.report_id);
      
      if (error) throw error;
      
      setReports(prev => prev?.map(r => 
        r?.report_id === report?.report_id 
          ? { ...r, status: 'assigned' }
          : r
      ));
    } catch (error) {
      console.error('Error accepting report:', error);
    }
  };

  const handleAssignResponder = async (assignmentData) => {
    try {
      const { error } = await supabase
        .from('emergency_reports')
        .update({ 
          status: 'assigned',
          assigned_to: assignmentData.responderId,
          priority: assignmentData.priority
        })
        .eq('report_id', assignmentData.reportId);
      
      if (error) throw error;
      
      setReports(prev => prev?.map(r => 
        r?.report_id === assignmentData?.reportId 
          ? { 
              ...r, 
              status: 'assigned',
              assigned_to: assignmentData.responderId,
              priority: assignmentData.priority
            }
          : r
      ));
      setShowAssignModal(false);
    } catch (error) {
      console.error('Error assigning responder:', error);
    }
  };

  const handleDeclineReport = async (declineData) => {
    try {
      if (useMock) {
        // Mock mode: update local state
        setReports(prev => prev?.map(r => 
          r?.report_id === declineData?.reportId 
            ? { ...r, status: 'declined', decline_reason: declineData.reason }
            : r
        ));
      } else {
        // Supabase mode
        const { error } = await supabase
          .from('emergency_reports')
          .update({ 
            status: 'declined',
            decline_reason: declineData.reason
          })
          .eq('report_id', declineData.reportId);
        
        if (error) throw error;
        
        setReports(prev => prev?.map(r => 
          r?.report_id === declineData?.reportId 
            ? { ...r, status: 'declined', decline_reason: declineData.reason }
            : r
        ));
      }
      setShowDeclineModal(false);
    } catch (error) {
      console.error('Error declining report:', error);
    }
  };

  const handleTurnoverReport = async (turnoverData) => {
    try {
      if (useMock) {
        // Mock mode: update local state with turnover report
        setReports(prev => prev?.map(r => 
          r?.report_id === turnoverData?.reportId 
            ? { 
                ...r, 
                status: 'resolved',
                turnover_report: turnoverData,
                resolved_at: turnoverData.submittedAt
              }
            : r
        ));
      } else {
        // Supabase mode
        const { error } = await supabase
          .from('emergency_reports')
          .update({ 
            status: 'resolved',
            turnover_report: turnoverData,
            resolved_at: turnoverData.submittedAt
          })
          .eq('report_id', turnoverData.reportId);
        
        if (error) throw error;
        
        setReports(prev => prev?.map(r => 
          r?.report_id === turnoverData?.reportId 
            ? { 
                ...r, 
                status: 'resolved',
                turnover_report: turnoverData,
                resolved_at: turnoverData.submittedAt
              }
            : r
        ));
      }
      setShowTurnoverModal(false);
    } catch (error) {
      console.error('Error submitting turnover report:', error);
    }
  };

  const handleBulkAction = async (actionData) => {
    try {
      switch (actionData?.action) {
        case 'accept':
          await supabase
            .from('emergency_reports')
            .update({ status: 'assigned' })
            .in('report_id', actionData.reportIds);
          setReports(prev => prev?.map(r => 
            actionData?.reportIds?.includes(r?.report_id) 
              ? { ...r, status: 'assigned' }
              : r
          ));
          break;
        case 'decline':
          await supabase
            .from('emergency_reports')
            .update({ status: 'declined' })
            .in('report_id', actionData.reportIds);
          setReports(prev => prev?.map(r => 
            actionData?.reportIds?.includes(r?.report_id) 
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
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
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

        <TurnoverReportModal
          report={selectedReport}
          isOpen={showTurnoverModal}
          onClose={() => {
            setShowTurnoverModal(false);
            setSelectedReport(null);
          }}
          onSubmit={handleTurnoverReport}
        />
      </div>
    </div>
  );
};

export default ReportManagement;