import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DepartmentHierarchy = ({ departments = [], onDepartmentSelect, selectedDepartment }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));

  // Build hierarchy structure
  const buildHierarchy = (departments) => {
    const hierarchy = {};
    const roots = [];

    // First pass: create all nodes
    departments?.forEach(dept => {
      hierarchy[dept.id] = {
        ...dept,
        children: []
      };
    });

    // Second pass: build parent-child relationships
    departments?.forEach(dept => {
      if (dept?.parentDepartment && hierarchy?.[dept?.parentDepartment]) {
        hierarchy?.[dept?.parentDepartment]?.children?.push(hierarchy?.[dept?.id]);
      } else {
        roots?.push(hierarchy?.[dept?.id]);
      }
    });

    return roots;
  };

  const hierarchyData = buildHierarchy(departments);

  const toggleExpanded = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet?.has(nodeId)) {
        newSet?.delete(nodeId);
      } else {
        newSet?.add(nodeId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-success';
      case 'inactive': return 'text-muted-foreground';
      case 'maintenance': return 'text-warning';
      default: return 'text-foreground';
    }
  };

  const renderNode = (node, level = 0) => {
    const isExpanded = expandedNodes?.has(node?.id);
    const hasChildren = node?.children && node?.children?.length > 0;
    const isSelected = selectedDepartment?.id === node?.id;

    return (
      <div key={node?.id} className="select-none">
        <div
          className={`flex items-center py-2 px-3 rounded-md hover:bg-muted transition-emergency cursor-pointer ${
            isSelected ? 'bg-primary/10 border border-primary/20' : ''
          }`}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => onDepartmentSelect(node)}
        >
          {/* Expand/Collapse Button */}
          <div className="w-6 h-6 flex items-center justify-center mr-2">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e?.stopPropagation();
                  toggleExpanded(node?.id);
                }}
                iconName={isExpanded ? "ChevronDown" : "ChevronRight"}
                className="w-4 h-4 p-0"
              />
            ) : (
              <div className="w-4 h-4"></div>
            )}
          </div>

          {/* Department Icon */}
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-md mr-3">
            <Icon name={node?.icon || 'Building'} size={16} className="text-primary" />
          </div>

          {/* Department Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground truncate">
                {node?.name}
              </span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(node?.status)}`}></div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>{node?.totalMembers} members</span>
              <span>{node?.activeResponders} active</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-emergency">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                // Handle quick edit
              }}
              iconName="Edit2"
              className="w-6 h-6 p-0"
              title="Quick edit"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                // Handle view details
              }}
              iconName="Eye"
              className="w-6 h-6 p-0"
              title="View details"
            />
          </div>
        </div>
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node?.children?.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Department Hierarchy</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedNodes(new Set(departments.map(d => d.id)))}
            iconName="Maximize2"
            iconPosition="left"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedNodes(new Set())}
            iconName="Minimize2"
            iconPosition="left"
          >
            Collapse All
          </Button>
        </div>
      </div>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {hierarchyData?.length > 0 ? (
          hierarchyData?.map(node => renderNode(node))
        ) : (
          <div className="text-center py-8">
            <Icon name="Building" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No departments found</p>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-medium text-foreground mb-2">Status Legend</h4>
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-muted-foreground">Active</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-warning rounded-full"></div>
            <span className="text-muted-foreground">Maintenance</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-muted-foreground">Inactive</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentHierarchy;