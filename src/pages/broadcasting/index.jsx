import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';

const Broadcasting = () => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentUser = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'User', role: profile?.role };
  
  const [broadcasts, setBroadcasts] = useState([
    {
      id: 1,
      title: 'Severe Weather Warning',
      message: 'Heavy rainfall expected in the next 24 hours. Please stay indoors and avoid unnecessary travel.',
      type: 'critical',
      sender: 'Emergency Management',
      timestamp: new Date(Date.now() - 1800000),
      priority: 'high'
    },
    {
      id: 2,
      title: 'Road Closure Notice',
      message: 'Main Street will be closed for maintenance from 9 AM to 5 PM tomorrow.',
      type: 'warning',
      sender: 'Traffic Department',
      timestamp: new Date(Date.now() - 7200000),
      priority: 'medium'
    },
    {
      id: 3,
      title: 'Community Meeting',
      message: 'Monthly community safety meeting scheduled for this Friday at 7 PM.',
      type: 'info',
      sender: 'Community Center',
      timestamp: new Date(Date.now() - 86400000),
      priority: 'low'
    }
  ]);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(profile?.role === 'admin' || profile?.role === 'dispatcher');
  }, [profile]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Broadcasting', path: '/broadcasting' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const getBroadcastColor = (type) => {
    switch (type) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning': return 'bg-warning/10 text-warning border-warning/20';
      case 'info': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getBroadcastIcon = (type) => {
    switch (type) {
      case 'critical': return 'AlertTriangle';
      case 'warning': return 'AlertCircle';
      case 'info': return 'Info';
      default: return 'Bell';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={currentUser} 
        notificationCount={3}
        onNavigate={handleNavigation}
      />
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={setIsSidebarCollapsed}
        user={currentUser}
        onNavigate={handleNavigation}
      />
      <main className={`pt-16 transition-emergency ${
        isSidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        <div className="p-6 space-y-6">
          {/* Breadcrumb */}
          <BreadcrumbNavigation 
            items={breadcrumbItems}
            onNavigate={handleNavigation}
          />

          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Emergency Broadcasting</h1>
              <p className="text-muted-foreground mt-1">
                {isAdmin ? 'Send and manage emergency broadcasts' : 'View emergency broadcasts and alerts'}
              </p>
            </div>
            
            {isAdmin && (
              <Button 
                onClick={() => {/* TODO: Open create broadcast modal */}}
                iconName="Send"
                iconPosition="left"
                className="mt-4 lg:mt-0"
              >
                Send Broadcast
              </Button>
            )}
          </div>

          {/* Broadcasts List */}
          <div className="space-y-4">
            {broadcasts.map(broadcast => (
              <div 
                key={broadcast.id}
                className={`p-6 rounded-lg border shadow-sm ${getBroadcastColor(broadcast.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg ${
                      broadcast.type === 'critical' ? 'bg-destructive text-white' :
                      broadcast.type === 'warning' ? 'bg-warning text-white' :
                      'bg-primary text-white'
                    }`}>
                      <Icon name={getBroadcastIcon(broadcast.type)} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{broadcast.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          broadcast.priority === 'high' ? 'bg-destructive text-white' :
                          broadcast.priority === 'medium' ? 'bg-warning text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {broadcast.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-foreground mb-3">{broadcast.message}</p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>By {broadcast.sender}</span>
                        <span>•</span>
                        <span>{new Date(broadcast.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" iconName="Edit">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" iconName="Trash2" className="text-destructive">
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {broadcasts.length === 0 && (
            <div className="text-center py-12">
              <Icon name="Bell" size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No broadcasts</h3>
              <p className="text-muted-foreground mb-4">
                {isAdmin ? 'Send your first broadcast to notify residents' : 'No emergency broadcasts at this time'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Broadcasting;
