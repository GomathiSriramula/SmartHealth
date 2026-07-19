import React, { useState, useEffect } from 'react';
import { API_URL } from './api';

interface LandingPageProps {
  onGetStarted: () => void;
}

interface LandingStats {
  healthyAreas: number;
  atRisk: number;
  alertZones: number;
  totalMonitored: number;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [stats, setStats] = useState<LandingStats>({
    healthyAreas: 87,
    atRisk: 10,
    alertZones: 3,
    totalMonitored: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLandingStats();
  }, []);

  const fetchLandingStats = async () => {
    try {
      const response = await fetch(`${API_URL}/predictions/landing-stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      console.log('Landing stats received:', data);
      setStats({
        healthyAreas: data.healthyAreas ?? 87,
        atRisk: data.atRisk ?? 10,
        alertZones: data.alertZones ?? 3,
        totalMonitored: data.totalMonitored ?? 0
      });
    } catch (error) {
      console.error('Error fetching landing stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">HealthGuard</span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
                Smart Community
                <span className="text-blue-600"> Health Monitoring</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Community health surveillance for early detection of disease outbreaks. Collect case reports, analyze disease trends, and generate timely alerts to support public health response.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all transform hover:scale-105"
                >
                  Get Started
                </button>
                <button className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-gray-400 transition-colors">
                  Learn More
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-100 p-4 rounded-lg">
                    <div className="text-green-600 font-semibold">Healthy Areas</div>
                    <div className="text-2xl font-bold text-green-800">
                      {loading ? '...' : `${stats?.healthyAreas ?? 87}%`}
                    </div>
                  </div>
                  <div className="bg-yellow-100 p-4 rounded-lg">
                    <div className="text-yellow-600 font-semibold">At Risk</div>
                    <div className="text-2xl font-bold text-yellow-800">
                      {loading ? '...' : `${stats?.atRisk ?? 10}%`}
                    </div>
                  </div>
                  <div className="bg-red-100 p-4 rounded-lg">
                    <div className="text-red-600 font-semibold">Alert Zones</div>
                    <div className="text-2xl font-bold text-red-800">
                      {loading ? '...' : `${stats?.alertZones ?? 3}%`}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="text-blue-600 font-semibold">Monitored</div>
                    <div className="text-2xl font-bold text-blue-800">24/7</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Comprehensive Health Surveillance</h2>
            <p className="text-xl text-gray-600">Real-time community protection through rapid case reporting</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Automated Risk Analysis</h3>
              <p className="text-gray-600">Every case report is automatically screened against known symptom patterns and reporter-assessed severity to flag high-risk cases the moment they're submitted.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Community Case Reporting</h3>
              <p className="text-gray-600">Health workers, clinics, and community volunteers can quickly report suspected disease cases from their local areas. These reports help the system identify possible outbreaks early and support timely public health response.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Real-time Alerts</h3>
              <p className="text-gray-600">Instant notifications to health officials and community leaders when potential threats are detected.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Rapid Case Reporting</h3>
              <p className="text-gray-600">Health workers and operators can submit individual case reports or bulk-upload them via CSV for fast, large-scale data entry.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Analytics</h3>
              <p className="text-gray-600">Comprehensive dashboards for visualizing hotspots, tracking interventions, and optimizing resource allocation.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Community Engagement</h3>
              <p className="text-gray-600">Engage local communities with health awareness campaigns and preventive measure recommendations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-gray-600">Continuous Monitoring</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">95%</div>
              <div className="text-gray-600">Early Detection Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">500+</div>
              <div className="text-gray-600">Communities Protected</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-600 mb-2">&lt;2min</div>
              <div className="text-gray-600">Alert Response Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">Ready to Protect Your Community?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of health departments already using HealthGuard to prevent disease outbreaks
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Start Monitoring Now
          </button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;