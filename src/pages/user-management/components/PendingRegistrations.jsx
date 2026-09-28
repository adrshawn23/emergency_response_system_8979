import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const PendingRegistrations = ({ 
  pendingUsers = [], 
  onApproveUser = () => {}, 
  onRejectUser = () => {} 
}) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const handleApprove = (user) => {
    onApproveUser(user?.id);
  };

  const handleReject = (user) => {
    setSelectedUser(user);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (selectedUser && rejectionReason?.trim()) {
      onRejectUser(selectedUser?.id, rejectionReason);
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedUser(null);
    }
  };

  const getRoleIcon = (role) => {
    const roleIcons = {
      admin: 'Shield',
      dispatcher: 'Radio',
      responder: 'Truck',
      resident: 'User'
    };
    return roleIcons?.[role] || 'User';
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - new Date(date)) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-emergency">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pending Registrations</h2>
            <p className="text-sm text-muted-foreground">
              {pendingUsers?.length} registration{pendingUsers?.length !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Icon name="Clock" size={16} className="text-warning" />
            <span className="text-sm font-medium text-warning">Requires Action</span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {pendingUsers?.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="CheckCircle" size={48} className="text-success mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No pending registrations at the moment.</p>
          </div>
        ) : (
          pendingUsers?.map((user) => (
            <div key={user?.id} className="p-6 hover:bg-muted/30 transition-emergency">
              <div className="flex items-start space-x-4">
                <div className="relative">
                  <img
                    src={user?.avatar}
                    alt={user?.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-warning border-2 border-card rounded-full flex items-center justify-center">
                    <Icon name="Clock" size={10} className="text-warning-foreground" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{user?.name}</h3>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-1">
                          <Icon name={getRoleIcon(user?.requestedRole)} size={14} className="text-muted-foreground" />
                          <span className="text-sm text-foreground capitalize">{user?.requestedRole}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Icon name="Building" size={14} className="text-muted-foreground" />
                          <span className="text-sm text-foreground">{user?.requestedDepartment}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Icon name="Calendar" size={14} className="text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Applied {formatTimeAgo(user?.applicationDate)}
                          </span>
                        </div>
                      </div>

                      {user?.message && (
                        <div className="mt-3 p-3 bg-muted rounded-lg">
                          <p className="text-sm text-foreground">{user?.message}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(user)}
                        iconName="X"
                        className="text-destructive hover:text-destructive"
                      >
                        Reject
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(user)}
                        iconName="Check"
                        className="bg-success hover:bg-success/90"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>

                  {/* ID Verification Documents */}
                  {user?.idDocuments && user?.idDocuments?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-foreground mb-2">ID Verification Documents</h4>
                      <div className="flex space-x-2">
                        {user?.idDocuments?.map((doc, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={doc?.url}
                              alt={doc?.name}
                              className="w-20 h-20 rounded-lg object-cover border border-border cursor-pointer hover:opacity-80 transition-emergency"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-emergency rounded-lg flex items-center justify-center">
                              <Icon name="Eye" size={16} className="text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2">
                              <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="ml-2 text-foreground">{user?.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address:</span>
                      <span className="ml-2 text-foreground">{user?.address}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050">
          <div className="bg-card rounded-lg border border-border shadow-emergency-lg w-full max-w-md mx-4">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Reject Registration</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please provide a reason for rejecting {selectedUser?.name}'s registration.
              </p>
            </div>
            
            <div className="p-6">
              <Input
                label="Rejection Reason"
                type="text"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e?.target?.value)}
                required
                description="This reason will be sent to the applicant via email."
              />
            </div>
            
            <div className="p-6 border-t border-border flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={!rejectionReason?.trim()}
                iconName="X"
              >
                Reject Registration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRegistrations;