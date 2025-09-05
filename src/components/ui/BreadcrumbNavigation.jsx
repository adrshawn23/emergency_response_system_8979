import React from 'react';
import Icon from '../AppIcon';

const BreadcrumbNavigation = ({ 
  items = [], 
  onNavigate = () => {},
  className = "" 
}) => {
  if (!items || items?.length === 0) return null;

  const handleNavigation = (path, index) => {
    if (index < items?.length - 1) {
      onNavigate(path);
    }
  };

  return (
    <nav className={`flex items-center space-x-1 text-sm ${className}`} aria-label="Breadcrumb">
      <Icon name="Home" size={16} className="text-muted-foreground" />
      {items?.map((item, index) => (
        <React.Fragment key={index}>
          <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
          
          {index === items?.length - 1 ? (
            <span className="text-foreground font-medium" aria-current="page">
              {item?.label}
            </span>
          ) : (
            <button
              onClick={() => handleNavigation(item?.path, index)}
              className="text-muted-foreground hover:text-primary transition-emergency"
              title={`Navigate to ${item?.label}`}
            >
              {item?.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbNavigation;