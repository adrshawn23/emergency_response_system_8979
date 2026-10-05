import React, { useState, useRef, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import { useMockData } from '../../contexts/MockDataContext';
import { useAuth } from '../../contexts/AuthContext';

const Header = ({ user = null, notificationCount = 0, onNavigate = () => {} }) => {
  const { useMock, toggleMockMode } = useMockData();
  const { signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const navigationItems = [
    { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', roles: ['all'] },
    { label: 'Emergency Report', path: '/emergency-report', icon: 'AlertTriangle', roles: ['resident', 'dispatcher', 'responder'] },
    { label: 'Report Management', path: '/report-management', icon: 'FileText', roles: ['dispatcher', 'responder', 'admin'] },
    { label: 'User Management', path: '/user-management', icon: 'Users', roles: ['admin'] },
    { label: 'Department Management', path: '/department-management', icon: 'Building', roles: ['admin'] }
  ];

  const mockNotifications = [
    { id: 1, type: 'emergency', title: 'High Priority Alert', message: 'Fire reported at Main Street', time: '2 min ago', priority: 'high' },
    { id: 2, type: 'system', title: 'System Update', message: 'Maintenance scheduled for tonight', time: '1 hour ago', priority: 'medium' },
    { id: 3, type: 'info', title: 'Training Reminder', message: 'Monthly safety training due', time: '3 hours ago', priority: 'low' }
  ];

  const getVisibleNavItems = () => {
    if (!user) return navigationItems?.filter(item => item?.roles?.includes('all'));
    return navigationItems?.filter(item => 
      item?.roles?.includes('all') || item?.roles?.includes(user?.role)
    );
  };

  const handleClickOutside = (event) => {
    if (userMenuRef?.current && !userMenuRef?.current?.contains(event?.target)) {
      setIsUserMenuOpen(false);
    }
    if (notificationRef?.current && !notificationRef?.current?.contains(event?.target)) {
      setIsNotificationOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigation = (path) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
    setIsUserMenuOpen(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-error';
      case 'medium': return 'text-warning';
      case 'low': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emergency': return 'AlertTriangle';
      case 'system': return 'Settings';
      case 'info': return 'Info';
      default: return 'Bell';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-card border-b border-border shadow-emergency z-1000">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo */}
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <Icon name="Shield" size={24} color="white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">Emergency Response</h1>
              <p className="text-xs text-muted-foreground">Command Center</p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-8">
          {getVisibleNavItems()?.map((item) => (
            <button
              key={item?.path}
              onClick={() => handleNavigation(item?.path)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-emergency rounded-md hover:bg-muted"
            >
              <Icon name={item?.icon} size={16} />
              <span>{item?.label}</span>
            </button>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Mock Mode Toggle */}
          <button
            onClick={toggleMockMode}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-md transition-emergency ${
              useMock 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            title={useMock ? 'Mock Mode Enabled' : 'Mock Mode Disabled'}
          >
            <Icon name={useMock ? 'Database' : 'Cloud'} size={14} />
            <span className="hidden sm:inline">{useMock ? 'Mock' : 'Live'}</span>
          </button>

          {/* Notifications */}
          {user && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-emergency rounded-md hover:bg-muted"
              >
                <Icon name="Bell" size={20} />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-secondary rounded-full animate-pulse-subtle">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-emergency-lg z-1010 animate-slide-down">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mockNotifications?.map((notification) => (
                      <div key={notification?.id} className="p-4 border-b border-border hover:bg-muted transition-emergency">
                        <div className="flex items-start space-x-3">
                          <div className={`flex-shrink-0 ${getPriorityColor(notification?.priority)}`}>
                            <Icon name={getNotificationIcon(notification?.type)} size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{notification?.title}</p>
                            <p className="text-sm text-muted-foreground">{notification?.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{notification?.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-border">
                    <Button variant="outline" size="sm" fullWidth>
                      View All Notifications
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Menu */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 p-2 text-sm font-medium text-foreground hover:text-primary transition-emergency rounded-md hover:bg-muted"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full text-xs font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="hidden md:block">{user?.name || 'User'}</span>
                <Icon name="ChevronDown" size={16} />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-emergency-lg z-1010 animate-slide-down">
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role || 'User'}</p>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        handleNavigation('/profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-emergency"
                    >
                      <Icon name="User" size={16} />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        handleNavigation('/settings');
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-emergency"
                    >
                      <Icon name="Settings" size={16} />
                      <span>Settings</span>
                    </button>
                  </div>
                  <div className="border-t border-border py-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-destructive hover:bg-muted transition-emergency"
                    >
                      <Icon name="LogOut" size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleNavigation('/login')}>
                Sign In
              </Button>
              <Button size="sm" onClick={() => handleNavigation('/register')}>
                Register
              </Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-emergency rounded-md hover:bg-muted"
          >
            <Icon name={isMobileMenuOpen ? "X" : "Menu"} size={20} />
          </button>
        </div>
      </div>
      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-card border-t border-border shadow-emergency-lg animate-slide-down">
          <nav className="px-4 py-4 space-y-2">
            {getVisibleNavItems()?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className="flex items-center space-x-3 w-full px-3 py-3 text-sm font-medium text-foreground hover:text-primary hover:bg-muted transition-emergency rounded-md"
              >
                <Icon name={item?.icon} size={18} />
                <span>{item?.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;