// /src/components/LandingPage.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { 
  Heart, 
  MessageSquare, 
  Bot, 
  Shield, 
  ArrowRight,
} from 'lucide-react';
import DemoMessages from '@/components/DemoMessages';
import DiscordLogo from './DiscordLogo';

const features = [
  {
    icon: Heart,
    title: "Heart-to-Heart Connections",
    description: "Foster genuine, meaningful conversations in a safe and supportive environment."
  },
  {
    icon: Bot,
    title: "AI-Powered Mediation",
    description: "Our intelligent H2Hbot helps guide discussions and provides constructive insights when needed."
  },
  {
    icon: Shield,
    title: "Safe & Private",
    description: "Your conversations are protected with state-of-the-art security and privacy measures."
  },
  {
    icon: MessageSquare,
    title: "Real-Time Chat",
    description: "Engage in fluid conversations with instant messaging and real-time updates."
  }
];

// const stats = [
//   { label: "Active Users", value: "tbd" },
//   { label: "Conversations Started", value: "tbd" },
//   { label: "Positive Feedback", value: "tbd%" },
//   { label: "Countries Reached", value: "tbd" }
// ];

export default function LandingPage() {
  const { status } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        <div className={`text-center space-y-6 transform transition-all duration-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <h1 className="text-4xl sm:text-6xl font-bold text-white">
            Have Better Conversations with
            <span className="text-blue-500"> H2H</span>
            <span className="text-sm align-top">.bot</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Experience heart-to-heart discussions with AI-assisted mediation that helps you connect, understand, and grow together.
          </p>
          
          {status !== 'authenticated' ? (
            <div className="flex justify-center gap-4 pt-8">
              <Link
                href="/signup"
                className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transform hover:scale-105 transition-all flex items-center gap-2"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/about"
                className="px-8 py-3 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transform hover:scale-105 transition-all"
              >
                Learn More
              </Link>
            </div>
          ) : (
            <Link
              href="/chat"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transform hover:scale-105 transition-all"
            >
              Go to Chats
            </Link>
          )}
        </div>

        {/* Demo Section */}
        <div className={`mt-16 transform transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <DemoMessages />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-white mb-16">Why Choose H2H.bot?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 rounded-xl bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all transform hover:-translate-y-1 ${
                  isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <feature.icon className="w-12 h-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/* <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`text-center transform transition-all duration-1000 ${
                  isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="bg-gray-800/50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">About</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/about" className="text-gray-400 hover:text-white">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/about#faq" className="text-gray-400 hover:text-white">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            
            {/* <div>
              <h3 className="text-lg font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="text-gray-400 hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-400 hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-gray-400 hover:text-white">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div> */}
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/about#contact" className="text-gray-400 hover:text-white">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="https://discord.gg/YXZb8YpKTN" target="_blank" className="text-gray-400 hover:text-white">
                    Discord Community
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Connect</h3>
              <div className="flex space-x-4">
                <a href="https://discord.gg/YXZb8YpKTN" target="_blank" className="pt-1 text-gray-400 hover:text-white">
                    <DiscordLogo className="w-6 h-6" />
                  </a>
                  <Link href="https://x.com/play_enjoyer" target="_blank" className="text-2xl text-gray-400 hover:text-white">
                    𝕏
                  </Link>

              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-700">
            <p className="text-center text-gray-400">
              © {new Date().getFullYear()} H2H.bot. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}