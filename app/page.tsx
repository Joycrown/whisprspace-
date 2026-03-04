'use client'
import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Vote, Shield, EyeOff, Heart, Send } from 'lucide-react';


const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '';
const authHref = appBaseUrl ? `${appBaseUrl}/auth` : '/auth';

const WhisprSpaceLanding = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const testimonials = [
    { text: "Finally, a place where I can be completely honest without worrying about my reputation.", author: "Anonymous User" },
    { text: "The group voting feature helped our community make decisions without bias or influence.", author: "Community Leader" },
    { text: "No more anxiety about likes or followers. Just pure, authentic conversations.", author: "Student" }
  ];

  const features = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Anonymous Expression",
      description: "Share your thoughts freely without revealing your identity"
    },
    {
      icon: <Vote className="w-6 h-6" />,
      title: "Democratic Voting",
      description: "Make group decisions through anonymous polls and voting"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Private Threads",
      description: "Create intimate spaces for meaningful discussions"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Quality-First Feed",
      description: "Prioritize thoughtful, helpful posts over hype"
    }
  ];
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-4 border-b border-gray-100 bg-white backdrop-blur-sm">
        <div className="w-full flex items-center justify-between px-6">
          <div className="flex items-center space-x-1">
            <img
               src="/assets/WS icon.png" 
               alt="WhisprSpace Logo" 
               className="w-10 h-18 pt-2 rounded-xl"
             />
            <span className="text-2xl font-bold text-gray-900">
              WhisprSpace
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-purple-600 transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-purple-600 transition-colors">How it Works</a>
            <a href={authHref}>
              <button className="bg-gradient-to-r from-purple-500 to-orange-500 text-white px-6 py-2 rounded-full hover:from-purple-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105">
                Get Started
              </button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-32">
        <div className="w-full px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`space-y-8 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-gray-900">
                  Speak
                  <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent"> Freely</span>
                  <br />
                  Stay Anonymous
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                  Join the revolution of authentic conversations. No judgment, no identity pressure, just real thoughts from real people.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={authHref}>
                  <button className="bg-gradient-to-r from-purple-500 to-orange-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 w-full sm:w-auto">
                    <span>Start Whispering</span>
                    <Send className="w-5 h-5" />
                  </button>
                </a>
                <a
                  href="#how-it-works"
                  className="border border-purple-500 text-purple-500 px-8 py-4 rounded-full text-lg font-semibold hover:bg-purple-500 hover:text-white transition-all duration-300 flex items-center justify-center w-full sm:w-auto"
                >
                  How It Works
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Anonymous by default</div>
                  <div className="text-lg font-semibold text-gray-900">No real identity required</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Private by design</div>
                  <div className="text-lg font-semibold text-gray-900">Small, focused communities</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Quality first</div>
                  <div className="text-lg font-semibold text-gray-900">Value over virality</div>
                </div>
              </div>
            </div>

            {/* Interactive Phone Mockup */}
            <div className={`relative transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="relative mx-auto w-80 h-96 bg-gray-900 rounded-3xl p-4 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-orange-600 rounded-2xl p-6 overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full"></div>
                      <div className="text-sm font-medium">WhisprSpace</div>
                      <Shield className="w-6 h-6" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-white bg-opacity-20 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
                            <EyeOff className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">Just posted my honest opinion about college pressures without worrying about professors seeing it 😅</p>
                            <div className="flex items-center mt-2 space-x-4 text-xs">
                              <div className="flex items-center space-x-1">
                                <Heart className="w-3 h-3" />
                                <span>42</span>
                              </div>
                              <span className="text-purple-200">2m ago</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white bg-opacity-15 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-teal-400 rounded-full flex items-center justify-center">
                            <Vote className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-2">Should we extend the project deadline?</p>
                            <div className="space-y-2">
                              <div className="bg-green-400 bg-opacity-30 rounded-lg p-2 text-xs">
                                <div className="flex justify-between">
                                  <span>Yes (67%)</span>
                                  <span>24 votes</span>
                                </div>
                              </div>
                              <div className="bg-red-400 bg-opacity-30 rounded-lg p-2 text-xs">
                                <div className="flex justify-between">
                                  <span>No (33%)</span>
                                  <span>12 votes</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center animate-bounce">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-r from-blue-400 to-teal-400 rounded-full flex items-center justify-center animate-pulse">
                <Shield className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              Why Choose
              <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent"> WhisprSpace?</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience social media the way it should be - authentic, anonymous, and anxiety-free
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-purple-300 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-orange-500 rounded-xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              Simple. Safe.
              <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent"> Secure.</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Create Your Anonymous Profile</h3>
              <p className="text-gray-600">Sign up without personal information. Your identity stays completely private.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Join or Create Threads</h3>
              <p className="text-gray-600">Find your community or build one. Share thoughts, vote on decisions, chat freely.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Contribute with Care</h3>
              <p className="text-gray-600">Share, listen, and reflect. The community favors value over virality.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="w-full text-center px-6">
          <h2 className="text-4xl font-bold mb-12 text-gray-900">What Our Community Says</h2>
          <div className="relative h-32">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-500 ${
                  currentTestimonial === index ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
                }`}
              >
                <blockquote className="text-xl italic mb-4 text-gray-700">{testimonial.text}</blockquote>
                <cite className="text-gray-500">- {testimonial.author}</cite>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="w-full text-center px-6">
          <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
            Ready to Speak
            <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent"> Your Truth?</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands who have already discovered the freedom of anonymous expression
          </p>
          <a href={authHref}>
            <button className="bg-gradient-to-r from-purple-500 to-orange-500 text-white px-12 py-4 rounded-full text-xl font-semibold hover:from-purple-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105">
              Start Your Journey
            </button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-100 border-t border-gray-200">
        <div className="w-full px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <img
                    src="/assets/WS icon.png"
                    alt="WhisprSpace Logo"
                    className="w-10 h-18 pt-2 rounded-xl"
                  />
                </div>
                <span className="text-lg font-bold text-gray-900">WhisprSpace</span>
              </div>
              <p className="text-gray-600 text-sm">Empowering authentic conversations through anonymity.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600">Features</a></li>
                <li><a href="#" className="hover:text-purple-600">Security</a></li>
                <li><a href="/privacy-policy" className="hover:text-purple-600">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600">About</a></li>
                <li><a href="#" className="hover:text-purple-600">Blog</a></li>
                <li><a href="#" className="hover:text-purple-600">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600">Help Center</a></li>
                <li><a href="/community-guidelines" className="hover:text-purple-600">Guidelines</a></li>
                <li><a href="#" className="hover:text-purple-600">Report</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-300 mt-8 pt-8 text-center text-sm text-gray-600">
            <p>&copy; {currentYear} WhisprSpace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhisprSpaceLanding;
