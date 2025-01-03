// /src/components/AboutPage.tsx
"use client"

import React, { useEffect, useState } from 'react';
import { Mail, Plus, Minus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './providers/AuthProvider';
// import { useSearchParams } from 'next/navigation';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'what-is-h2h',
    question: 'What is H2H.bot?',
    answer: (
      <div className="space-y-4">
        <p>
          H2H.bot (Heart-to-Heart bot) is a platform designed to help people have more meaningful, empathetic conversations 
          with the assistance of AI-powered mediation. Whether you&apos;re working through a disagreement, sharing difficult feelings, 
          or just wanting to connect more deeply, H2H.bot provides a structured environment for heart-to-heart conversations.
        </p>
        <p>
          Our AI assistant, H2Hbot, can be called into any conversation using @bot to help guide discussions, 
          provide perspective, and ensure conversations remain constructive and empathetic.
        </p>
      </div>
    )
  },
  {
    id: 'hp',
    question: 'What are Heart Points?',
    answer: (
      <div className="space-y-4">
        <p>
          Heart Points (HP) are a way to recognize and encourage empathy, understanding, and constructive discussion in conversations. 
          There are two types of Heart Points:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Heart Points (HP):</strong> These can be awarded by users to each other when someone demonstrates 
            particularly empathetic or constructive behavior in a conversation.
          </li>
          <li>
            <strong>Heart-to-Heart Points (H2HP):</strong> These are awarded by H2Hbot when it recognizes exceptional 
            demonstrations of emotional vulnerability, conflict resolution, or breakthrough moments in understanding.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'bot-help',
    question: 'How can H2Hbot help my conversations?',
    answer: (
      <div className="space-y-4">
        <p>
          H2Hbot can assist your conversations in several ways:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Guide discussions in a constructive direction</li>
          <li>Provide neutral perspective when needed</li>
          <li>Suggest conversation topics and questions</li>
          <li>Help identify and validate emotions</li>
          <li>Mediate disagreements</li>
          <li>Recognize and encourage empathetic communication</li>
        </ul>
        <p>
          To get H2Hbot&apos;s help, simply include @bot in your message. For example: "@bot can you help us have a 
          productive conversation about..."
        </p>
      </div>
    )
  },
  {
    id: 'privacy',
    question: 'How private are my conversations?',
    answer: (
      <div className="space-y-4">
        <p>
          We take your privacy seriously. Your conversations are:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Encrypted in transit and at rest</li>
          <li>Only visible to conversation participants</li>
          <li>Never used for training AI models</li>
          <li>Never shared with third parties</li>
        </ul>
        <p>
          While H2Hbot has access to conversation context to provide assistance, this data is only used 
          in real-time to generate responses and is not stored or used for any other purpose.
        </p>
      </div>
    )
  },
  {
    id: 'limits',
    question: 'Are there any usage limits?',
    answer: (
      <div className="space-y-4">
        <p>
          To ensure quality of service and prevent abuse, we have some basic limits:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Free users can use @bot up to 20 times per week</li>
          <li>Free users can award 1 Heart Point (HP) per day</li>
          <li>Messages are limited to 1,500 characters</li>
          <li>Chat invites expire after 7 days</li>
        </ul>
        <p>
          Higher limits are available for subscribed users. Visit our{' '}
          <Link href="/subscribe" className="text-blue-500 hover:underline">
            subscription page
          </Link>{' '}
          to learn more.
        </p>
      </div>
    )
  }
];

const AboutPage = () => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  // const searchParams = useSearchParams();
  const { status } = useAuth();

  // Handle initial load with hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setExpandedItems(new Set([hash]));
      // Smooth scroll to the element
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* About Section */}
        <section className="mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">About H2H.bot</h1>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 space-y-4">
            <p className="text-gray-300">
              H2H.bot is a platform that helps people have more meaningful, empathetic conversations
              through AI-assisted mediation. Our goal is to create a space where people can connect
              more deeply, share openly, and understand each other better.
            </p>
            <p className="text-gray-300">
              Whether you&apos;re working through a disagreement, sharing difficult feelings, or just
              wanting to have a deeper conversation, our AI assistant H2Hbot is here to help guide
              your discussions and ensure they remain constructive and empathetic.
            </p>
            <div className="flex items-center gap-2 pt-4">
              <Link
                href={status === 'authenticated' ? "/chat" : "/signup"}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {status === 'authenticated' ? "Start Chatting" : "Get Started"}
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="mb-16 scroll-mt-16">
          <h2 className="text-3xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.id}
                id={item.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden scroll-mt-16"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors"
                >
                  <span className="text-lg font-medium">{item.question}</span>
                  {expandedItems.has(item.id) ? (
                    <Minus className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 flex-shrink-0" />
                  )}
                </button>
                <div
                  className={`px-6 transition-all duration-200 ease-in-out ${
                    expandedItems.has(item.id)
                      ? 'max-h-[1000px] py-4 opacity-100'
                      : 'max-h-0 py-0 opacity-0'
                  }`}
                >
                  <div className="text-gray-300 prose prose-invert">
                    {item.answer}
                  </div>
                  <div className="mt-4 text-sm text-gray-400">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/about#${item.id}`);
                      }}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Share link to answer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="scroll-mt-16">
          <h2 className="text-3xl font-bold text-white mb-6">Contact Us</h2>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
            <p className="text-gray-300 mb-6">
              Have questions, feedback, or need support? We&apos;re here to help!
            </p>
            <div className="space-y-4">
              <a
                href="mailto:support@h2h.bot"
                className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
              >
                <Mail className="w-5 h-5" />
                support@h2h.bot
              </a>
              <a
                href="https://discord.gg/YXZb8YpKTN"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-white hover:text-blue-400 transition-colors"
              >
                Join our Discord community
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;