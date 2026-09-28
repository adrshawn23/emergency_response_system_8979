import React, { useState } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const Sidebar = ({ 
  isCollapsed = false, 
  onToggleCollapse = () => {}, 
  user = null, 
  onNavigate = () => {} 
}) => {
  const [activeItem, setActiveItem] = useState('/');

  const navigationItems = [
    { 
      label: 'Dashboard', 
      path: '/', 
      icon: 'LayoutDashboard', 
      roles: ['all'],
      description: 'Overview and quick actions'
    },
    { 
      label: 'Emergency Report', 
      path: '/emergency-report', 
      icon: 'AlertTriangle', 
      roles: ['resident', 'dispatcher', 'responder'],
      description: 'Report new incidents'
    },
    { 
      label: 'Report Management', 
      path: '/report-management', 
      icon: 'FileText', 
      roles: ['dispatcher', 'responder', 'admin'],
      description: 'Manage incident reports'
    },
    { 
      label: 'User Management', 
      path: '/user-management', 
      icon: 'Users', 
      roles: ['admin'],
      description: 'Manage system users'
    },
    { 
      label: 'Department Management', 
      path: '/department-management', 
      icon: 'Building', 
      roles: ['admin'],
      description: 'Manage departments'
    },
    {
      label: 'Service Area',
      path: '/geofence-settings',
      icon: 'MapPin',
      roles: ['admin'],
      description: 'Configure access radius'
    }
  ];

  const quickActions = [
    { 
      label: 'Emergency Alert', 
      icon: 'Siren', 
      action: 'emergency-alert',
      variant: 'destructive',
      roles: ['dispatcher', 'responder']
    },
    { 
      label: 'Quick Report', 
      icon: 'Plus', 
      action: 'quick-report',
      variant: 'default',
      roles: ['resident', 'dispatcher', 'responder']
    },
    { 
      label: 'System Status', 
      icon: 'Activity', 
      action: 'system-status',
      variant: 'outline',
      roles: ['admin', 'dispatcher']
    }
  ];

  const getVisibleNavItems = () => {
    if (!user) return navigationItems?.filter(item => item?.roles?.includes('all'));
    return navigationItems?.filter(item => 
      item?.roles?.includes('all') || item?.roles?.includes(user?.role)
    );
  };

  const getVisibleQuickActions = () => {
    if (!user) return [];
    return quickActions?.filter(action => 
      action?.roles?.includes(user?.role)
    );
  };

  const handleNavigation = (path) => {
    setActiveItem(path);
    onNavigate(path);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'emergency-alert': onNavigate('/emergency-alert');
        break;
      case 'quick-report': onNavigate('/emergency-report');
        break;
      case 'system-status': onNavigate('/system-status');
        break;
      default:
        break;
    }
  };

  return (
    <aside className={`fixed left-0 top-16 bottom-0 bg-card border-r border-border shadow-emergency z-1000 transition-emergency ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!isCollapsed && (
            <h2 className="text-sm font-semibold text-foreground">Navigation</h2>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-emergency"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"} size={16} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {getVisibleNavItems()?.map((item) => (
            <button
              key={item?.path}
              onClick={() => handleNavigation(item?.path)}
              className={`flex items-center w-full p-3 text-sm font-medium rounded-md transition-emergency ${
                activeItem === item?.path
                  ? 'bg-primary text-primary-foreground shadow-emergency'
                  : 'text-foreground hover:text-primary hover:bg-muted'
              }`}
              title={isCollapsed ? item?.label : ''}
            >
              <Icon 
                name={item?.icon} 
                size={18} 
                className={`flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`}
              />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div>{item?.label}</div>
                  <div className="text-xs opacity-75 mt-0.5">{item?.description}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Actions */}
        {user && getVisibleQuickActions()?.length > 0 && (
          <div className="p-4 border-t border-border">
            {!isCollapsed && (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Quick Actions
              </h3>
            )}
            <div className="space-y-2">
              {getVisibleQuickActions()?.map((action) => (
                <Button
                  key={action?.action}
                  variant={action?.variant}
                  size={isCollapsed ? "icon" : "sm"}
                  onClick={() => handleQuickAction(action?.action)}
                  className={isCollapsed ? "w-full" : "w-full justify-start"}
                  iconName={action?.icon}
                  iconPosition="left"
                  title={isCollapsed ? action?.label : ''}
                >
                  {!isCollapsed && action?.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* User Info */}
        {user && (
          <div className="p-4 border-t border-border">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <div className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full text-xs font-semibold flex-shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user?.role || 'User'}
                  </p>
                </div>
              )}
            </div>
            
            {!isCollapsed && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse-subtle"></div>
                    <span className="text-success font-medium">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last Active</span>
                  <span className="text-foreground">Just now</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
