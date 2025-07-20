import React from 'react';

const AppFooter = ({ onPolicyClick }) => {
    return (
        <footer className="relative z-10 w-full p-4 mt-auto bg-midnight-blue/50 text-center text-ethereal-white/60 font-manrope text-sm">
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2">
                <button onClick={() => onPolicyClick('Contact Us')} className="hover:text-pale-pink">Contact Us</button>
                <button onClick={() => onPolicyClick('Privacy')} className="hover:text-pale-pink">Privacy</button>
                <button onClick={() => onPolicyClick('Terms and Conditions')} className="hover:text-pale-pink">Terms</button>
                <button onClick={() => onPolicyClick('Cancellation & Refunds')} className="hover:text-pale-pink">Refunds</button>
                <button onClick={() => onPolicyClick('Shipping')} className="hover:text-pale-pink">Shipping</button>
            </div>
        </footer>
    );
};

export default AppFooter;
