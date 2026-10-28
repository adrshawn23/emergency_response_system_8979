import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import CreateDepartmentModal from '../../department-management/components/CreateDepartmentModal';

const DepartmentManagementSection = () => {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (deptError) throw deptError;
        
        setDepartments(deptData || []);

        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('*');
        
        if (userError) throw userError;
        setUsers(userData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate member counts separately
  const departmentsWithCounts = departments?.map(dept => {
    const memberCount = users?.filter(u => u?.department_id === dept?.id)?.length || 0;
    return { ...dept, totalMembers: memberCount };
  });

  const filteredDepartmentsWithCounts = departmentsWithCounts?.filter(dept => {
    const matchesSearch = dept?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         dept?.description?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    return matchesSearch;
  });

  const handleCreateDepartment = async (departmentData) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentData.name,
          description: departmentData.description
        })
        .select()
        .single();
      
      if (error) throw error;
      const newDept = {
        ...data,
        totalMembers: 0,
        status: 'active'
      };
      setDepartments(prev => [...prev, newDept]);
    } catch (error) {
      console.error('Error creating department:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      throw error;
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('departments')
          .delete()
          .eq('id', departmentId);
        
        if (error) throw error;
        setDepartments(prev => prev?.filter(dept => dept?.id !== departmentId));
      } catch (error) {
        console.error('Error deleting department:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        throw error;
      }
    }
  };

  const handleAssignUsers = async (departmentId, selectedUserIds) => {
    try {
      for (const userId of selectedUserIds) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({ department_id: departmentId })
          .eq('id', userId)
          .select();
        
        if (error) throw error;
      }
      
      // Refresh departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (deptError) throw deptError;
      setDepartments(deptData || []);
      
      // Refresh users
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*');
      
      if (userError) throw userError;
      setUsers(userData || []);
    } catch (error) {
      console.error('Error assigning users:', JSON.stringify({
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      }, null, 2));
      throw error;
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ department_id: null })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Refresh departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (deptError) throw deptError;
      setDepartments(deptData || []);
      
      // Refresh users
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*');
      
      if (userError) throw userError;
      setUsers(userData || []);
    } catch (error) {
      console.error('Error removing user:', JSON.stringify({
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      }, null, 2));
      throw error;
    }
  };

  if (loading) {
    return <div className="mt-7 text-center text-slate-500">Loading departments...</div>;
  }

  return (
    <div className="mt-7 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Department Management</h3>
          <p className="text-sm text-slate-500">Create and manage emergency response departments</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Create Department
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {/* Department List */}
      {filteredDepartmentsWithCounts?.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Icon name="Building" size={48} className="text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No departments found</h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchTerm 
              ? 'Try adjusting your search criteria' 
              : 'Get started by creating your first department'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create First Department
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDepartmentsWithCounts?.map(department => (
            <div 
              key={department?.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-900">{department?.name}</h4>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{department?.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span><strong>{department?.totalMembers || 0}</strong> members</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDepartment(department);
                        setIsAssignModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Assign members
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDepartment(department?.id)}
                  className="ml-4 text-slate-400 hover:text-red-600"
                >
                  <Icon name="Trash2" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateDepartmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateDepartment={handleCreateDepartment}
      />

      {/* Assign Users Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">
                Assign members to {selectedDepartment?.name}
              </h3>
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedDepartment(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {users?.map(user => (
                <div
                  key={user?.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{user?.full_name || user?.email}</p>
                    <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                  </div>
                  {user?.department_id === selectedDepartment?.id ? (
                    <button
                      onClick={() => handleRemoveUser(user?.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssignUsers(selectedDepartment?.id, [user?.id])}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Assign
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagementSection;
