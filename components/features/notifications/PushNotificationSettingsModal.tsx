'use client'

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Check, AlertCircle, Settings } from 'lucide-react';

interface PushNotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PushNotificationSettingsModal: React.FC<PushNotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState(true); // Assume supported for now
  const [isPermissionGranted, setIsPermissionGranted] = useState(false); // Assume not granted initially

  // Simulate checking browser support and current permission
  // In a real app, this would use Notification API
  // useEffect(() => {
  //   if ('Notification' in window) {
  //     setIsBrowserSupported(true);
  //     setIsPermissionGranted(Notification.permission === 'granted');
  //     setIsPushEnabled(Notification.permission === 'granted');
  //   } else {
  //     setIsBrowserSupported(false);
  //   }
  // }, []);

  const handleTogglePush = async () => {
    if (!isBrowserSupported) {
      alert("Your browser does not support push notifications.");
      return;
    }

    if (isPushEnabled) {
      // Disable push notifications (placeholder)
      setIsPushEnabled(false);
      setIsPermissionGranted(false);
      alert("Push notifications disabled (placeholder).");
    } else {
      // Request permission and enable push notifications (placeholder)
      // In a real app, this would use Notification.requestPermission()
      const permissionResult = confirm("Allow WhisprSpace to send push notifications?");

      if (permissionResult) {
        setIsPermissionGranted(true);
        setIsPushEnabled(true);
        alert("Push notifications enabled (placeholder).");
      } else {
        setIsPermissionGranted(false);
        setIsPushEnabled(false);
        alert("Push notification permission denied.");
      }
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
          className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Push Notification Settings</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {!isBrowserSupported && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <AlertCircle className="inline w-5 h-5 mr-2" />
                <span className="block sm:inline">Your browser does not support push notifications.</span>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-purple-600" />
                <span className="text-gray-800 font-medium">Enable Push Notifications</span>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isPushEnabled ? 'bg-purple-600' : 'bg-gray-200'
                }`}
                disabled={!isBrowserSupported}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPushEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {isPushEnabled && isPermissionGranted && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Push notifications are enabled and granted.</span>
              </div>
            )}

            {isPushEnabled && !isPermissionGranted && isBrowserSupported && (
              <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>Permission denied. Please enable push notifications in your browser settings.</span>
              </div>
            )}

            <div className="text-sm text-gray-600 mt-4">
              <p>Push notifications allow you to receive real-time updates even when you are not actively using WhisprSpace.</p>
              <p className="mt-2">You can manage global push notification settings through your browser's site settings.</p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PushNotificationSettingsModal;

