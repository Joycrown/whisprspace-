'use client';

import React from 'react';
import Link from 'next/link';
import { Home, Search, ArrowLeft, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* 404 Illustration */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <h1 className="text-[150px] md:text-[200px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-orange-500 leading-none">
              404
            </h1>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-8 -right-8 bg-yellow-400 rounded-full p-3"
            >
              <MessageCircle className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Thread Not Found
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            Oops! The page you're looking for doesn't exist in our anonymous sanctuary.
          </p>
          <p className="text-md text-gray-500">
            It might have been deleted, moved, or never existed in the first place.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>

          <Link
            href="/threads"
            className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 border-2 border-purple-300 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-sm"
          >
            <Search className="w-5 h-5" />
            Browse Threads
          </Link>
        </motion.div>

        {/* Additional Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 p-6 bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Link href="/" className="text-purple-600 hover:text-purple-700 hover:underline">
              Home
            </Link>
            <Link href="/threads" className="text-purple-600 hover:text-purple-700 hover:underline">
              All Threads
            </Link>
            <Link href="/my-threads" className="text-purple-600 hover:text-purple-700 hover:underline">
              My Threads
            </Link>
            <Link href="/profile" className="text-purple-600 hover:text-purple-700 hover:underline">
              Profile
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
