import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const PolicyPage = ({ policy, onClose }) => {
    const policies = {
        'Contact Us': {
            title: 'Contact Us',
            content: (
                <>
                    <p>If you have any questions or concerns, please feel free to reach out to us.</p>
                    <p><strong>Email:</strong> nka271715@gmail.com</p>
                    <p><strong>Address:</strong> Dehradun, Uttarakhand, India</p>
                </>
            )
        },
        'Privacy': {
            title: 'Privacy Policy',
            content: (
                 <>
                    <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.</p>
                    <p><strong>Information We Collect:</strong> We collect your name and email address through Google Sign-In for authentication purposes. We also store your generated dream data (text and images) which is linked to your user account.</p>
                    <p><strong>How We Use Information:</strong> Your information is used to provide and improve our service, process your one-time payment, and secure your account. We do not share your personal data with third parties.</p>
                    <p><strong>Data Storage:</strong> Your dream text data is stored on Firebase Firestore. Your generated images are stored permanently in your browser's IndexedDB on your own device.</p>
                </>
            )
        },
        'Terms and Conditions': {
            title: 'Terms and Conditions',
            content: (
                <>
                    <p>By using LucidLens, you agree to these terms.</p>
                    <p><strong>Service:</strong> LucidLens provides AI-powered dream visualization. Access to the full service requires a one-time payment.</p>
                    <p><strong>Payment:</strong> The one-time fee of ₹10 is non-refundable and grants you lifetime access to the application under your registered account.</p>
                    <p><strong>User Conduct:</strong> You agree not to use the service to generate harmful, offensive, or illegal content. We reserve the right to terminate accounts that violate these terms.</p>
                </>
            )
        },
        'Cancellation & Refunds': {
            title: 'Cancellation & Refund Policy',
            content: (
                <>
                    <p>Due to the nature of our service, the one-time payment for unlocking LucidLens is final and non-refundable.</p>
                    <p>Once you have made the payment and your account is granted access, we cannot offer a refund. By completing the payment, you acknowledge and agree to this policy.</p>
                </>
            )
        },
        'Shipping': {
            title: 'Shipping & Delivery Policy',
            content: (
                <>
                    <p>LucidLens is a fully digital product. There are no physical goods to be shipped.</p>
                    <p><strong>Delivery:</strong> Upon successful completion of your one-time payment, access to the full features of the application will be granted to your account instantly. You can start visualizing and saving your dreams immediately.</p>
                </>
            )
        }
    };

    const selectedPolicy = policies[policy];

    if (!selectedPolicy) return null;

    return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] bg-opacity-90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-[#1c1c2b] border border-[#3a3a5a] shadow-xl rounded-xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-cormorant text-[#f6ced8]">{selectedPolicy.title}</h2>
                <button onClick={onClose} className="text-white hover:text-[#f6ced8] transition-colors"><X size={24} /></button>
            </div>
            <div className="prose prose-invert text-gray-200 font-manrope space-y-4">
                {selectedPolicy.content}
            </div>
        </motion.div>
    </motion.div>
);

};

export default PolicyPage;
