import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';

const EmergencyContacts = () => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentUser = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'User', role: profile?.role };
  
  const [contacts, setContacts] = useState([
    {
      id: 1,
      name: 'Fire Department',
      phone: '911',
      type: 'emergency',
      icon: 'Flame'
    },
    {
      id: 2,
      name: 'Police Department',
      phone: '911',
      type: 'emergency',
      icon: 'Shield'
    },
    {
      id: 3,
      name: 'Medical Emergency',
      phone: '911',
      type: 'emergency',
      icon: 'Heart'
    },
    {
      id: 4,
      name: 'Poison Control',
      phone: '1-800-222-1222',
      type: 'emergency',
      icon: 'AlertTriangle'
    },
    {
      id: 5,
      name: 'Maria Rodriguez (Personal)',
      phone: '+1 (555) 123-4567',
      type: 'personal',
      icon: 'User'
    },
    {
      id: 6,
      name: 'John Smith (Neighbor)',
      phone: '+1 (555) 987-6543',
      type: 'personal',
      icon: 'User'
    }
  ]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', type: 'personal' });

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Emergency Contacts', path: '/emergency-contacts' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleAddContact = () => {
    if (newContact.name && newContact.phone) {
      setContacts([
        ...contacts,
        {
          id: Date.now(),
          name: newContact.name,
          phone: newContact.phone,
          type: newContact.type,
          icon: 'User'
        }
      ]);
      setNewContact({ name: '', phone: '', type: 'personal' });
      setIsAddModalOpen(false);
    }
  };

  const handleDeleteContact = (contactId) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setContacts(contacts.filter(c => c.id !== contactId));
    }
  };

  const handleCall = (phone) => {
    window.open(`tel:${phone}`);
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
              <h1 className="text-3xl font-bold text-foreground">Emergency Contacts</h1>
              <p className="text-muted-foreground mt-1">
                Manage your emergency and personal contacts
              </p>
            </div>
            
            <Button 
              onClick={() => setIsAddModalOpen(true)}
              iconName="Plus"
              iconPosition="left"
              className="mt-4 lg:mt-0"
            >
              Add Contact
            </Button>
          </div>

          {/* Emergency Contacts */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Emergency Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {contacts.filter(c => c.type === 'emergency').map(contact => (
                <div 
                  key={contact.id}
                  className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center"
                >
                  <div className="bg-destructive text-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Icon name={contact.icon} size={32} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{contact.name}</h3>
                  <p className="text-2xl font-bold text-destructive mb-4">{contact.phone}</p>
                  <Button 
                    onClick={() => handleCall(contact.phone)}
                    iconName="Phone"
                    className="w-full"
                  >
                    Call Now
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Contacts */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Personal Contacts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.filter(c => c.type === 'personal').map(contact => (
                <div 
                  key={contact.id}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-full">
                      <Icon name={contact.icon} size={24} />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      iconName="Trash2"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{contact.name}</h3>
                  <p className="text-muted-foreground mb-4">{contact.phone}</p>
                  <Button 
                    variant="outline"
                    onClick={() => handleCall(contact.phone)}
                    iconName="Phone"
                    className="w-full"
                  >
                    Call
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Contact Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-foreground mb-4">Add Contact</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                    <Input
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                    <Input
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                    <select
                      value={newContact.type}
                      onChange={(e) => setNewContact({ ...newContact, type: e.target.value })}
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="personal">Personal</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddContact}>
                    Add Contact
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EmergencyContacts;
