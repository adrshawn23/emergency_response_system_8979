import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';

const Notifications = () => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentUser = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'User', role: profile?.role };
  
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'New Emergency Report',
      message: 'Fire incident reported at 123 Main Street',
      type: 'emergency',
      timestamp: new Date(Date.now() - 300000),
      read: false,
      action: '/report-management'
    },
    {
      id: 2,
      title: 'Report Assigned',
      message: 'You have been assigned to report #RPT-001',
      type: 'assignment',
      timestamp: new Date(Date.now() - 900000),
      read: false,
      action: '/report-management'
    },
    {
      id: 3,
      title: 'Broadcast Received',
      message: 'Severe weather warning in your area',
      type: 'broadcast',
      timestamp: new Date(Date.now() - 1800000),
      read: true,
      action: '/broadcasting'
    },
    {
      id: 4,
      title: 'System Update',
      message: 'New features have been added to the dashboard',
      type: 'system',
      timestamp: new Date(Date.now() - 86400000),
      read: true,
      action: null
    },
    {
      id: 5,
      title: 'Report Status Changed',
      message: 'Report #RPT-002 status changed to resolved',
      type: 'info',
      timestamp: new Date(Date.now() - 172800000),
      read: true,
      action: '/report-management'
    }
  ]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Notifications', path: '/notifications' }
  ];

  const handleNavigation = (path) => {
    if (path) navigate(path);
  };

  const handleMarkAsRead = (notificationId) => {
    setNotifications(notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleDeleteNotification = (notificationId) => {
    setNotifications(notifications.filter(n => n.id !== notificationId));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emergency': return 'AlertTriangle';
      case 'assignment': return 'UserCheck';
      case 'broadcast': return 'Bell';
      case 'system': return 'Settings';
      case 'info': return 'Info';
      default: return 'Bell';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'emergency': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'assignment': return 'bg-primary/10 text-primary border-primary/20';
      case 'broadcast': return 'bg-warning/10 text-warning border-warning/20';
      case 'system': return 'bg-muted text-muted-foreground';
      case 'info': return 'bg-info/10 text-info border-info/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={currentUser} 
        notificationCount={unreadCount}
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
              <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
              <p className="text-muted-foreground mt-1">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications read'}
              </p>
            </div>
            
            {unreadCount > 0 && (
              <Button 
                variant="outline"
                onClick={handleMarkAllAsRead}
                iconName="Check"
                iconPosition="left"
                className="mt-4 lg:mt-0"
              >
                Mark All as Read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {notifications.map(notification => (
              <div 
                key={notification.id}
                className={`p-4 rounded-lg border shadow-sm transition-all ${
                  notification.read ? 'bg-muted/30 opacity-70' : 'bg-card border-primary/30'
                } ${getNotificationColor(notification.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${
                      notification.type === 'emergency' ? 'bg-destructive text-white' :
                      notification.type === 'assignment' ? 'bg-primary text-white' :
                      notification.type === 'broadcast' ? 'bg-warning text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Icon name={getNotificationIcon(notification.type)} size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className={`font-semibold ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                      </div>
                      <p className={`text-sm ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {notification.action && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        iconName="ExternalLink"
                        onClick={() => handleNavigation(notification.action)}
                      >
                        View
                      </Button>
                    )}
                    {!notification.read && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        iconName="Check"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      iconName="X"
                      onClick={() => handleDeleteNotification(notification.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {notifications.length === 0 && (
            <div className="text-center py-12">
              <Icon name="Bell" size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                You're all caught up! No new notifications at this time.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
