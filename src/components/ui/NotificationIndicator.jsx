import React, { useState, useRef, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const NotificationIndicator = ({ 
  notifications = [], 
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onNotificationClick = () => {},
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications?.filter(n => !n?.read)?.length;

  const handleClickOutside = (event) => {
    if (dropdownRef?.current && !dropdownRef?.current?.contains(event?.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-error';
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      case 'low': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-error text-error-foreground';
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emergency': return 'AlertTriangle';
      case 'system': return 'Settings';
      case 'user': return 'User';
      case 'report': return 'FileText';
      case 'alert': return 'Bell';
      default: return 'Info';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleNotificationClick = (notification) => {
    if (!notification?.read) {
      onMarkAsRead(notification?.id);
    }
    onNotificationClick(notification);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-emergency rounded-md hover:bg-muted"
        title={`${unreadCount} unread notifications`}
      >
        <Icon name="Bell" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium text-white bg-secondary rounded-full animate-pulse-subtle">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-popover border border-border rounded-lg shadow-emergency-lg z-1030 animate-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onMarkAllAsRead();
                  setIsOpen(false);
                }}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications?.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="Bell" size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications?.map((notification) => (
                <div
                  key={notification?.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-border hover:bg-muted transition-emergency cursor-pointer ${
                    !notification?.read ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 ${getPriorityColor(notification?.priority)}`}>
                      <Icon name={getNotificationIcon(notification?.type)} size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            !notification?.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification?.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification?.message}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-2">
                          {notification?.priority && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              getPriorityBadgeColor(notification?.priority)
                            }`}>
                              {notification?.priority}
                            </span>
                          )}
                          {!notification?.read && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {formatTime(notification?.timestamp)}
                        </p>
                        {notification?.actionRequired && (
                          <span className="text-xs text-primary font-medium">
                            Action Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications?.length > 0 && (
            <div className="p-4 border-t border-border">
              <Button variant="outline" size="sm" fullWidth onClick={() => setIsOpen(false)}>
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationIndicator;