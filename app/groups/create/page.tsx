'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGroupStore } from '@/store/groupStore';
import { CreateGroupForm, GroupPrivacy } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Lock, Eye, Check, X, ArrowLeft } from 'lucide-react';

const CreateGroupPage = () => {
  const router = useRouter();
  const { createGroup, isLoading, error } = useGroupStore();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateGroupForm>({
    name: '',
    description: '',
    privacy: 'public',
    maxMembers: 50,
    rules: '',
    avatar: '#cccccc', // Default avatar color
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Group name is required.';
      if (!formData.description.trim()) newErrors.description = 'Description is required.';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (validateStep()) {
      try {
        const groupId = await createGroup(formData);
        if (groupId) {
          router.push(`/groups/${groupId}`);
        }
      } catch (err) {
        console.error('Failed to create group:', err);
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Group Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="e.g., Tech Enthusiasts"
              />
              {formErrors.name && <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm resize-none ${formErrors.description ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe your group's purpose..."
              ></textarea>
              {formErrors.description && <p className="mt-2 text-sm text-red-600">{formErrors.description}</p>}
            </div>
            <div>
              <label htmlFor="avatarColor" className="block text-sm font-medium text-gray-700">Group Avatar Color</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  id="avatarColor"
                  value={formData.avatar}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatar: e.target.value }))}
                  className="w-10 h-10 border border-gray-300 rounded-full cursor-pointer"
                />
                <div 
                  className="w-10 h-10 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: formData.avatar }}
                />
                <span className="text-sm text-gray-500">Select a color for your group's avatar.</span>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
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
            <div>
              <label htmlFor="maxMembers" className="block text-sm font-medium text-gray-700">Maximum Members</label>
              <input
                type="number"
                id="maxMembers"
                value={formData.maxMembers}
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
                placeholder="Outline your group's guidelines..."
              ></textarea>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New Group</h2>
            <button onClick={() => router.push('/groups')} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative mb-8">
            <div className="flex justify-between items-center">
              <div className="flex-1 text-center">
                <p className={`text-sm font-medium ${step === 1 ? 'text-purple-600' : 'text-gray-400'}`}>1. Basic Info</p>
              </div>
              <div className="w-1/3 border-t border-gray-300 absolute top-1/2 left-1/3 -translate-y-1/2"></div>
              <div className="flex-1 text-center">
                <p className={`text-sm font-medium ${step === 2 ? 'text-purple-600' : 'text-gray-400'}`}>2. Settings</p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="flex-1 flex flex-col">
            <div className="flex-1">
              {renderStep()}
            </div>

            <div className="flex justify-between items-center mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
              )}
              {step === 1 && <div /> /* Empty div to balance spacing */}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ml-auto"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ml-auto disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Group'}
                </button>
              )}
            </div>
            {error && <p className="mt-4 text-sm text-red-600 text-center">Error: {error}</p>}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateGroupPage;
