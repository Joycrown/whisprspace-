'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Lock, Eye, Check, AlertCircle } from 'lucide-react';
import { Group, GroupPrivacy } from '@/types';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onUpdate: (groupId: string, updates: Partial<Group>) => void;
  isLoading: boolean;
  error: string | null;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  group,
  onUpdate,
  isLoading,
  error,
}) => {
  const [formData, setFormData] = useState<Partial<Group>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description,
        privacy: group.privacy,
        maxMembers: group.maxMembers,
        rules: group.rules,
        avatar: group.avatar,
      });
    }
  }, [group]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'Group name is required.';
    if (!formData.description?.trim()) newErrors.description = 'Description is required.';
    if (!formData.maxMembers || formData.maxMembers < 5 || formData.maxMembers > 1000) {
      newErrors.maxMembers = 'Max members must be between 5 and 1000.';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onUpdate(group.id, formData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Group Settings</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* Name and Description */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Group Name</label>
              <input
                type="text"
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
              />
              {formErrors.name && <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm resize-none ${formErrors.description ? 'border-red-500' : 'border-gray-300'}`}
              ></textarea>
              {formErrors.description && <p className="mt-2 text-sm text-red-600">{formErrors.description}</p>}
            </div>

            {/* Privacy Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Settings</label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, privacy: 'public' }))}
                  className={`flex items-center justify-between w-full p-4 border rounded-md transition-all ${
                    formData.privacy === 'public' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Eye className={`w-5 h-5 ${formData.privacy === 'public' ? 'text-purple-600' : 'text-gray-700'}`} />
                    <div>
                      <p className={`font-medium ${formData.privacy === 'public' ? 'text-purple-900' : 'text-gray-900'}`}>Public</p>
                      <p className={`text-sm ${formData.privacy === 'public' ? 'text-purple-700' : 'text-gray-600'}`}>Anyone can see and join this group.</p>
                    </div>
                  </div>
                  {formData.privacy === 'public' && <Check className="w-5 h-5 text-purple-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, privacy: 'invite_only' }))}
                  className={`flex items-center justify-between w-full p-4 border rounded-md transition-all ${
                    formData.privacy === 'invite_only' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className={`w-5 h-5 ${formData.privacy === 'invite_only' ? 'text-purple-600' : 'text-gray-700'}`} />
                    <div>
                      <p className={`font-medium ${formData.privacy === 'invite_only' ? 'text-purple-900' : 'text-gray-900'}`}>Invite Only</p>
                      <p className={`text-sm ${formData.privacy === 'invite_only' ? 'text-purple-700' : 'text-gray-600'}`}>Members can join with an invite code or link.</p>
                    </div>
                  </div>
                  {formData.privacy === 'invite_only' && <Check className="w-5 h-5 text-purple-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, privacy: 'private' }))}
                  className={`flex items-center justify-between w-full p-4 border rounded-md transition-all ${
                    formData.privacy === 'private' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Lock className={`w-5 h-5 ${formData.privacy === 'private' ? 'text-purple-600' : 'text-gray-700'}`} />
                    <div>
                      <p className={`font-medium ${formData.privacy === 'private' ? 'text-purple-900' : 'text-gray-900'}`}>Private</p>
                      <p className={`text-sm ${formData.privacy === 'private' ? 'text-purple-700' : 'text-gray-600'}`}>Only invited members can join. Not discoverable.</p>
                    </div>
                  </div>
                  {formData.privacy === 'private' && <Check className="w-5 h-5 text-purple-600" />}
                </button>
              </div>
            </div>

            {/* Max Members and Rules */}
            <div>
              <label htmlFor="maxMembers" className="block text-sm font-medium text-gray-700">Maximum Members</label>
              <input
                type="number"
                id="maxMembers"
                value={formData.maxMembers || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                min="5"
                max="1000"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              />
              {formErrors.maxMembers && <p className="mt-2 text-sm text-red-600">{formErrors.maxMembers}</p>}
            </div>
            <div>
              <label htmlFor="rules" className="block text-sm font-medium text-gray-700">Group Rules (Optional)</label>
              <textarea
                id="rules"
                rows={3}
                value={formData.rules || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm resize-none"
              ></textarea>
            </div>
            
            {error && <p className="mt-4 text-sm text-red-600 text-center"><AlertCircle className="inline w-4 h-4 mr-1" />Error: {error}</p>}

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GroupSettingsModal;

