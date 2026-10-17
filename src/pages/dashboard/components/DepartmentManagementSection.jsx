import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import CreateDepartmentModal from '../../department-management/components/CreateDepartmentModal';

const DepartmentManagementSection = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  useEffect(() => {
    const fetchDepartments = async () => {
      setLoading(true);
      try {
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('*, user_profiles(count)')
          .order('created_at', { ascending: false });
        
        if (deptError) throw deptError;
        
        const departmentsWithCounts = (deptData || []).map(dept => ({
          ...dept,
          totalMembers: dept.user_profiles?.[0]?.count || 0,
          status: dept.is_active ? 'active' : 'inactive'
        }));
        setDepartments(departmentsWithCounts);
      } catch (error) {
        console.error('Error fetching departments:', error);
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

    fetchDepartments();
  }, []);

  const filteredDepartments = departments?.filter(dept => {
    const matchesSearch = dept?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         dept?.description?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && dept?.is_active) ||
                         (statusFilter === 'inactive' && !dept?.is_active);
    return matchesSearch && matchesStatus;
  });

  const handleCreateDepartment = async (departmentData) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentData.name,
          type: departmentData.type,
          description: departmentData.description,
          contact_email: departmentData.contact_email || null,
          contact_phone: departmentData.contact_phone || null,
          is_active: true
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
          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {statusFilterOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Department List */}
      {filteredDepartments?.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Icon name="Building" size={48} className="text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No departments found</h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria' 
              : 'Get started by creating your first department'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create First Department
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDepartments?.map(department => (
            <div 
              key={department?.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-900">{department?.name}</h4>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      department?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {department?.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                      {department?.type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{department?.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span><strong>{department?.totalMembers || 0}</strong> members</span>
                    {department?.contact_email && <span>{department?.contact_email}</span>}
                    {department?.contact_phone && <span>{department?.contact_phone}</span>}
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
    </div>
  );
};

export default DepartmentManagementSection;
