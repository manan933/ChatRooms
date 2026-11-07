import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { Check } from '../ui/Icons';
import BrandLogo from '../ui/BrandLogo';

export const LegalModal = ({ isOpen, onClose, initialTab = 'privacy' }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'privacy' | 'terms' | 'data'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size="sm" />
          <span>Legal, Privacy & Consent</span>
        </div>
      }
      size="lg"
    >
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer border-none ${
              activeTab === 'privacy'
                ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer border-none ${
              activeTab === 'terms'
                ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer border-none ${
              activeTab === 'data'
                ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'
            }`}
          >
            Data Collection & Consent
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 text-xs font-body leading-relaxed text-[var(--text-secondary)]">
          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">
                ChatRooms Privacy Policy
              </h3>
              <p>
                At ChatRooms, we respect your privacy. This policy describes how your information is collected, stored, and protected when you use our communication services.
              </p>
              <h4 className="font-heading font-bold text-[var(--text-primary)]">1. Information We Collect</h4>
              <p>
                We only collect information essential to providing real-time chat: your display name, username handle, email address for authentication, and encrypted credentials.
              </p>
              <h4 className="font-heading font-bold text-[var(--text-primary)]">2. Storage & Security</h4>
              <p>
                All passwords are cryptographically hashed using bcrypt (10 rounds). Messages and uploaded assets are stored securely and never shared with advertisers or third-party brokers.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">
                ChatRooms Terms of Service
              </h3>
              <p>
                By creating an account or accessing ChatRooms, you agree to these Terms of Service.
              </p>
              <h4 className="font-heading font-bold text-[var(--text-primary)]">1. Acceptable Use</h4>
              <p>
                You agree not to use ChatRooms for harassment, unlawful distribution of content, automated spamming, or attempting to breach platform security.
              </p>
              <h4 className="font-heading font-bold text-[var(--text-primary)]">2. Account Responsibility</h4>
              <p>
                You are responsible for maintaining the confidentiality of your credentials and for all messaging activities that occur under your account.
              </p>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-3">
              <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">
                What User Data Do We Collect?
              </h3>
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                <div className="flex items-start gap-2.5">
                  <Check size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[var(--text-primary)] font-heading">Identity Data:</strong> Name, chosen username, and email address for account creation.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[var(--text-primary)] font-heading">Communications Data:</strong> Message text, uploaded attachments, and channel memberships strictly for routing to your intended recipients.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[var(--text-primary)] font-heading">Session Cookies & Storage:</strong> JWT bearer authentication token and theme preference stored locally in your browser.
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                We do not use tracking pixels, ad networks, or third-party marketing trackers.
              </p>
            </div>
          )}
        </div>

        {/* Footer Accept Button */}
        <div className="pt-2 border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-xl font-heading text-xs font-bold transition-all cursor-pointer border-none"
          >
            I Understand
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LegalModal;
